import { create } from 'zustand';
import { isMqttConnected, mqttClientId, mqttHostKey, mqttPublish, mqttSubscribe } from './useBoardStore';
import { registerDriveExtra } from '../services/driveBridge';

export type SandboxTool =
  | 'select'
  | 'pan'
  | 'pen'
  | 'eraser'
  | 'note'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line';

export type SandboxElementType = 'note' | 'text' | 'rect' | 'ellipse' | 'line' | 'draw' | 'image';

export interface SandboxGroup {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SandboxElement {
  id: string;
  sandboxId: string;
  groupId: string | null;
  type: SandboxElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color: string;
  strokeWidth?: number;
  /** Flattened [x0,y0,x1,y1,...] in canvas coordinates, relative to element origin. */
  points?: number[];
  src?: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  zIndex: number;
}

export interface Sandbox {
  id: string;
  title: string;
  description: string;
  background: string;
  createdAt: string;
  /** Bumped on every change so an older snapshot cannot undo a newer one. */
  updatedAt?: string;
  groups: SandboxGroup[];
  /** Tombstones so deletes survive peer merges. */
  deletedElementIds?: string[];
  allowGuestEdit: boolean;
}

const STORAGE_KEY = 'padlet-sandbox-storage-local';
const IDENTITY_KEY = 'padlet-sandbox-identity';

/** Deep enough that white labels on these fills clear WCAG AA. */
export const GROUP_COLORS = [
  '#0369a1',
  '#047857',
  '#b45309',
  '#b91c1c',
  '#6d28d9',
  '#be185d',
  '#0f766e',
  '#4338ca',
];

export const SANDBOX_BACKGROUNDS = [
  { name: '그리드 화이트', value: 'grid-light' },
  { name: '도트 화이트', value: 'dot-light' },
  { name: '플레인 화이트', value: 'plain-light' },
  { name: '민트 페이퍼', value: 'plain-mint' },
  { name: '스카이 페이퍼', value: 'plain-sky' },
];

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = () => new Date().toISOString();

const touch = (sandbox: Sandbox): Sandbox => ({ ...sandbox, updatedAt: nowISO() });

const timeOf = (value?: string): number => (value ? new Date(value).getTime() : 0);

interface StoredIdentity {
  name: string;
  color: string;
  groupId: string | null;
}

const loadIdentity = (): StoredIdentity => {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string') {
        return {
          name: parsed.name,
          color: parsed.color || GROUP_COLORS[0],
          groupId: parsed.groupId ?? null,
        };
      }
    }
  } catch {
    /* ignore malformed identity */
  }
  return { name: '', color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)], groupId: null };
};

const saveIdentity = (identity: StoredIdentity) => {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch (e) {
    console.warn('Failed to persist sandbox identity', e);
  }
};

const loadInitial = (): { sandboxes: Sandbox[]; elements: SandboxElement[] } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sandboxes: Sandbox[] = Array.isArray(parsed?.sandboxes) ? parsed.sandboxes : [];
      const elements: SandboxElement[] = Array.isArray(parsed?.elements) ? parsed.elements : [];
      const deleted = new Set<string>();
      sandboxes.forEach((s) => s.deletedElementIds?.forEach((id) => deleted.add(id)));
      return { sandboxes, elements: elements.filter((el) => !deleted.has(el.id)) };
    }
  } catch (e) {
    console.error('Failed to load sandbox state', e);
  }
  return { sandboxes: [], elements: [] };
};

let persistTimer: any = null;

/** Debounced because dragging and drawing fire on every pointer move. */
const persist = (sandboxes: Sandbox[], elements: SandboxElement[]) => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sandboxes, elements }));
    } catch (e) {
      console.error('Failed to save sandbox state', e);
    }
  }, 300);
};

const roomTopic = (sandboxId: string) => `antigravity/padlet/v1/sandbox/${mqttHostKey}/${sandboxId}`;

/**
 * The canvas is also published here as a retained message, which the broker
 * keeps as the topic's last known value. That is what lets someone opening a
 * share link load the canvas even when nobody else has it open.
 */
const archiveTopic = (sandboxId: string) => `${roomTopic(sandboxId)}/archive`;

/** Retained payloads have to fit in a single broker packet. */
const MAX_ARCHIVE_BYTES = 700_000;

/** Every 모둠 works on its own page, so all groups share one coordinate space. */
export const GROUP_PAGE = { width: 1600, height: 1000 };

interface SandboxState {
  sandboxes: Sandbox[];
  elements: SandboxElement[];
  activeSandboxId: string | null;
  activeGroupId: string | null;

  // Local participant identity
  myName: string;
  myColor: string;
  myGroupId: string | null;

  // Canvas UI state (local only)
  tool: SandboxTool;
  drawColor: string;
  strokeWidth: number;
  panX: number;
  panY: number;
  scale: number;
  selectedElementId: string | null;

  // Sandbox CRUD
  createSandbox: (title: string, description: string, background: string, groupNames: string[]) => string;
  deleteSandbox: (sandboxId: string) => void;
  updateSandbox: (sandboxId: string, updates: Partial<Omit<Sandbox, 'id' | 'createdAt'>>) => void;
  importSandbox: (sandbox: Sandbox, elements: SandboxElement[]) => void;

  // Group CRUD
  addGroup: (sandboxId: string, name: string) => void;
  updateGroup: (sandboxId: string, groupId: string, updates: Partial<Omit<SandboxGroup, 'id'>>) => void;
  removeGroup: (sandboxId: string, groupId: string) => void;

  // Element CRUD
  addElement: (
    sandboxId: string,
    element: Omit<SandboxElement, 'id' | 'sandboxId' | 'createdAt' | 'updatedAt' | 'zIndex' | 'authorName' | 'authorId'> &
      Partial<Pick<SandboxElement, 'authorName' | 'authorId'>>
  ) => string;
  updateElement: (id: string, updates: Partial<Omit<SandboxElement, 'id' | 'sandboxId' | 'createdAt'>>) => void;
  deleteElement: (id: string) => void;
  clearGroupElements: (sandboxId: string, groupId: string | null) => void;

  // Session
  setActiveSandboxId: (id: string | null) => void;
  setActiveGroupId: (id: string | null) => void;
  setIdentity: (name: string, groupId: string | null, color?: string) => void;
  setTool: (tool: SandboxTool) => void;
  setDrawColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setViewport: (panX: number, panY: number, scale?: number) => void;
  setSelectedElementId: (id: string | null) => void;
  resetViewport: () => void;
}

const initial = loadInitial();
const identity = loadIdentity();

/** Guards against echoing network-applied changes back onto the wire. */
let applyingRemote = false;

export const useSandboxStore = create<SandboxState>((set, get) => {
  const commit = (sandboxes: Sandbox[], elements: SandboxElement[]) => {
    persist(sandboxes, elements);
    if (!applyingRemote) broadcastState(sandboxes, elements);
  };

  return {
    sandboxes: initial.sandboxes,
    elements: initial.elements,
    activeSandboxId: null,
    activeGroupId: null,

    myName: identity.name,
    myColor: identity.color,
    myGroupId: identity.groupId,

    tool: 'select',
    drawColor: '#0f766e',
    strokeWidth: 4,
    panX: 0,
    panY: 0,
    scale: 1,
    selectedElementId: null,

    createSandbox: (title, description, background, groupNames) => {
      const id = uid('sandbox');
      const cleanNames = groupNames.map((n) => n.trim()).filter(Boolean);
      const names = cleanNames.length > 0 ? cleanNames : ['1모둠', '2모둠', '3모둠', '4모둠'];

      const groups: SandboxGroup[] = names.map((name, index) => ({
        id: uid('group'),
        name,
        color: GROUP_COLORS[index % GROUP_COLORS.length],
        x: 0,
        y: 0,
        width: GROUP_PAGE.width,
        height: GROUP_PAGE.height,
      }));

      const sandbox: Sandbox = {
        id,
        title: title.trim() || '새 협업 캔버스',
        description: description.trim(),
        background: background || 'grid-light',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        groups,
        deletedElementIds: [],
        allowGuestEdit: true,
      };

      const sandboxes = [...get().sandboxes, sandbox];
      set({ sandboxes });
      commit(sandboxes, get().elements);
      // Make the share link answerable straight away, before any edits
      archiveState(sandbox, get().elements);
      return id;
    },

    deleteSandbox: (sandboxId) => {
      const sandboxes = get().sandboxes.filter((s) => s.id !== sandboxId);
      const elements = get().elements.filter((el) => el.sandboxId !== sandboxId);
      set({ sandboxes, elements });
      forgetSandboxArchive(sandboxId);
      commit(sandboxes, elements);
    },

    updateSandbox: (sandboxId, updates) => {
      const sandboxes = get().sandboxes.map((s) => (s.id === sandboxId ? touch({ ...s, ...updates }) : s));
      set({ sandboxes });
      commit(sandboxes, get().elements);
    },

    importSandbox: (sandbox, importedElements) => {
      const exists = get().sandboxes.some((s) => s.id === sandbox.id);
      const sandboxes = exists
        ? get().sandboxes.map((s) => (s.id === sandbox.id ? touch({ ...s, ...sandbox }) : s))
        : [...get().sandboxes, touch(sandbox)];

      const importedIds = new Set(importedElements.map((el) => el.id));
      const elements = [...get().elements.filter((el) => !importedIds.has(el.id)), ...importedElements];

      set({ sandboxes, elements });
      commit(sandboxes, elements);
    },

    addGroup: (sandboxId, name) => {
      const sandboxes = get().sandboxes.map((s) => {
        if (s.id !== sandboxId) return s;
        const index = s.groups.length;
        const group: SandboxGroup = {
          id: uid('group'),
          name: name.trim() || `${index + 1}모둠`,
          color: GROUP_COLORS[index % GROUP_COLORS.length],
          x: 0,
          y: 0,
          width: GROUP_PAGE.width,
          height: GROUP_PAGE.height,
        };
        return touch({ ...s, groups: [...s.groups, group] });
      });
      set({ sandboxes });
      commit(sandboxes, get().elements);
    },

    updateGroup: (sandboxId, groupId, updates) => {
      const sandboxes = get().sandboxes.map((s) =>
        s.id === sandboxId
          ? touch({ ...s, groups: s.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)) })
          : s
      );
      set({ sandboxes });
      commit(sandboxes, get().elements);
    },

    removeGroup: (sandboxId, groupId) => {
      // Each 모둠 owns a page, so its work goes with it — leaving the elements
      // behind would only hide them on a page nobody can open.
      const removed = get()
        .elements.filter((el) => el.sandboxId === sandboxId && el.groupId === groupId)
        .map((el) => el.id);

      const sandboxes = get().sandboxes.map((s) => {
        if (s.id !== sandboxId) return s;
        const tombstones = new Set([...(s.deletedElementIds || []), ...removed]);
        return touch({
          ...s,
          groups: s.groups.filter((g) => g.id !== groupId),
          deletedElementIds: Array.from(tombstones),
        });
      });
      const elements = get().elements.filter((el) => !removed.includes(el.id));
      const myGroupId = get().myGroupId === groupId ? null : get().myGroupId;

      set({ sandboxes, elements, myGroupId });
      commit(sandboxes, elements);
    },

    addElement: (sandboxId, element) => {
      const state = get();
      const id = uid('el');
      const maxZ = state.elements.reduce((max, el) => Math.max(max, el.zIndex), 0);

      const newElement: SandboxElement = {
        ...element,
        id,
        sandboxId,
        authorName: element.authorName || state.myName || '익명',
        authorId: element.authorId || mqttClientId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        zIndex: maxZ + 1,
      };

      const elements = [...state.elements, newElement];
      set({ elements });
      commit(state.sandboxes, elements);
      return id;
    },

    updateElement: (id, updates) => {
      const elements = get().elements.map((el) =>
        el.id === id ? { ...el, ...updates, updatedAt: nowISO() } : el
      );
      set({ elements });
      commit(get().sandboxes, elements);
    },

    deleteElement: (id) => {
      const target = get().elements.find((el) => el.id === id);
      const elements = get().elements.filter((el) => el.id !== id);

      let sandboxes = get().sandboxes;
      if (target) {
        sandboxes = sandboxes.map((s) => {
          if (s.id !== target.sandboxId) return s;
          const tombstones = s.deletedElementIds || [];
          return tombstones.includes(id) ? s : touch({ ...s, deletedElementIds: [...tombstones, id] });
        });
      }

      set({ elements, sandboxes, selectedElementId: null });
      commit(sandboxes, elements);
    },

    clearGroupElements: (sandboxId, groupId) => {
      const removed = get()
        .elements.filter((el) => el.sandboxId === sandboxId && el.groupId === groupId)
        .map((el) => el.id);
      if (removed.length === 0) return;

      const elements = get().elements.filter((el) => !removed.includes(el.id));
      const sandboxes = get().sandboxes.map((s) => {
        if (s.id !== sandboxId) return s;
        const tombstones = new Set([...(s.deletedElementIds || []), ...removed]);
        return touch({ ...s, deletedElementIds: Array.from(tombstones) });
      });

      set({ elements, sandboxes, selectedElementId: null });
      commit(sandboxes, elements);
    },

    setActiveSandboxId: (id) =>
      set({ activeSandboxId: id, activeGroupId: null, panX: 0, panY: 0, scale: 1, selectedElementId: null }),

    setActiveGroupId: (id) => set({ activeGroupId: id, selectedElementId: null }),

    setIdentity: (name, groupId, color) => {
      const nextColor = color || get().myColor;
      set({ myName: name, myGroupId: groupId, myColor: nextColor });
      saveIdentity({ name, groupId, color: nextColor });
    },

    setTool: (tool) => set({ tool, selectedElementId: tool === 'select' ? get().selectedElementId : null }),
    setDrawColor: (drawColor) => set({ drawColor }),
    setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
    setViewport: (panX, panY, scale) => set(scale === undefined ? { panX, panY } : { panX, panY, scale }),
    setSelectedElementId: (selectedElementId) => set({ selectedElementId }),
    resetViewport: () => set({ panX: 0, panY: 0, scale: 1 }),
  };
});

// --- Realtime room sync -------------------------------------------------

let publishTimer: any = null;
let archiveTimer: any = null;

const snapshotPayload = (sandbox: Sandbox, elements: SandboxElement[]) => ({
  type: 'sandbox-state' as const,
  senderId: mqttClientId,
  savedAt: new Date().toISOString(),
  sandbox,
  elements: elements.filter((el) => el.sandboxId === sandbox.id),
});

/** Keeps the broker's retained copy current so late visitors get the canvas. */
const archiveState = (sandbox: Sandbox, elements: SandboxElement[]) => {
  const payload = snapshotPayload(sandbox, elements);
  const size = JSON.stringify(payload).length;
  if (size > MAX_ARCHIVE_BYTES) {
    console.warn(
      `[sandbox] canvas is ${size} bytes, too large to keep a shareable copy on the broker`
    );
    return;
  }
  mqttPublish(archiveTopic(sandbox.id), payload, { retain: true });
};

const broadcastState = (sandboxes: Sandbox[], elements: SandboxElement[]) => {
  const activeId = useSandboxStore.getState().activeSandboxId;
  if (!activeId) return;

  const sandbox = sandboxes.find((s) => s.id === activeId);
  if (!sandbox) return;

  // Coalesce rapid edits (drawing strokes) into one publish
  if (publishTimer) clearTimeout(publishTimer);
  publishTimer = setTimeout(() => {
    mqttPublish(roomTopic(activeId), snapshotPayload(sandbox, elements));
  }, 120);

  // The retained copy changes less often; it only needs to settle after edits
  if (archiveTimer) clearTimeout(archiveTimer);
  archiveTimer = setTimeout(() => {
    const latest = useSandboxStore.getState();
    const current = latest.sandboxes.find((s) => s.id === activeId);
    if (current) archiveState(current, latest.elements);
  }, 1500);
};

const mergeRemote = (sandbox: Sandbox, remoteElements: SandboxElement[]) => {
  const state = useSandboxStore.getState();

  const localSandbox = state.sandboxes.find((s) => s.id === sandbox.id);
  const tombstones = new Set<string>([
    ...(localSandbox?.deletedElementIds || []),
    ...(sandbox.deletedElementIds || []),
  ]);

  // Group and title edits are last-write-wins on updatedAt. Without this an
  // older snapshot — a stale retained copy, or a peer that has not caught up —
  // could bring a deleted 모둠 back.
  const remoteIsNewer = !localSandbox || timeOf(sandbox.updatedAt) >= timeOf(localSandbox.updatedAt);
  const winner = remoteIsNewer ? sandbox : localSandbox;

  const mergedSandbox: Sandbox = {
    ...winner,
    deletedElementIds: Array.from(tombstones),
  };

  const sandboxes = localSandbox
    ? state.sandboxes.map((s) => (s.id === sandbox.id ? mergedSandbox : s))
    : [...state.sandboxes, mergedSandbox];

  // Last-write-wins per element, then drop anything tombstoned
  const byId = new Map<string, SandboxElement>();
  state.elements
    .filter((el) => el.sandboxId === sandbox.id)
    .forEach((el) => byId.set(el.id, el));

  remoteElements.forEach((remote) => {
    const local = byId.get(remote.id);
    if (!local || new Date(remote.updatedAt).getTime() >= new Date(local.updatedAt).getTime()) {
      byId.set(remote.id, remote);
    }
  });

  // Deletions only travel as tombstones, so a peer with partial state
  // can never silently erase work it simply hasn't received yet.
  tombstones.forEach((id) => byId.delete(id));

  const otherElements = state.elements.filter((el) => el.sandboxId !== sandbox.id);
  const elements = [...otherElements, ...Array.from(byId.values())];

  applyingRemote = true;
  useSandboxStore.setState({ sandboxes, elements });
  persist(sandboxes, elements);
  applyingRemote = false;
};

let unsubscribeRoom: (() => void) | null = null;
let joinedSandboxId: string | null = null;
let catchUpTimer: any = null;

/**
 * Ask peers for the canvas until we actually have it. The MQTT socket is
 * usually still connecting on a fresh page load, so a single request would
 * be dropped and a guest following a share link would never sync.
 */
const requestSnapshotUntilSynced = (sandboxId: string) => {
  if (catchUpTimer) clearInterval(catchUpTimer);
  let attempts = 0;

  const ask = () => {
    attempts += 1;
    const hasSandbox = useSandboxStore.getState().sandboxes.some((s) => s.id === sandboxId);
    if (hasSandbox || attempts > 25 || joinedSandboxId !== sandboxId) {
      clearInterval(catchUpTimer);
      catchUpTimer = null;
      return;
    }
    mqttPublish(roomTopic(sandboxId), { type: 'sandbox-request', senderId: mqttClientId });
  };

  ask();
  catchUpTimer = setInterval(ask, 1200);
};

let unsubscribeArchive: (() => void) | null = null;

/** Subscribe to the active sandbox room; call again when the sandbox changes. */
export const joinSandboxRoom = (sandboxId: string | null): void => {
  if (joinedSandboxId === sandboxId) return;

  unsubscribeRoom?.();
  unsubscribeArchive?.();
  unsubscribeRoom = null;
  unsubscribeArchive = null;
  if (catchUpTimer) {
    clearInterval(catchUpTimer);
    catchUpTimer = null;
  }
  joinedSandboxId = sandboxId;
  if (!sandboxId) return;

  // The retained copy is delivered as soon as we subscribe, so a visitor with
  // only the link gets the canvas without anyone else being online.
  unsubscribeArchive = mqttSubscribe(archiveTopic(sandboxId), (payload) => {
    // Skip our own copy coming back: applying it could undo an edit we made
    // after publishing it.
    if (!payload || !payload.sandbox || payload.senderId === mqttClientId) return;
    mergeRemote(payload.sandbox as Sandbox, (payload.elements || []) as SandboxElement[]);
  });

  unsubscribeRoom = mqttSubscribe(roomTopic(sandboxId), (payload) => {
    if (!payload || payload.senderId === mqttClientId) return;

    if (payload.type === 'sandbox-state' && payload.sandbox) {
      mergeRemote(payload.sandbox as Sandbox, (payload.elements || []) as SandboxElement[]);
      return;
    }

    if (payload.type === 'sandbox-request') {
      publishSandboxSnapshot(sandboxId);
    }
  });

  requestSnapshotUntilSynced(sandboxId);
};

export const publishSandboxSnapshot = (sandboxId: string): void => {
  const state = useSandboxStore.getState();
  const sandbox = state.sandboxes.find((s) => s.id === sandboxId);
  if (!sandbox) return;
  mqttPublish(roomTopic(sandboxId), snapshotPayload(sandbox, state.elements));
  archiveState(sandbox, state.elements);
};

/** Drops the retained copy so a deleted canvas stops answering its share link. */
export const forgetSandboxArchive = (sandboxId: string): void => {
  mqttPublish(archiveTopic(sandboxId), null, { retain: true });
};

/**
 * Keeps trying until the shareable copy is actually stored. On a fresh page
 * load the socket is usually still connecting, and a dropped publish would
 * leave the share link unanswerable until the next edit.
 */
export const ensureSandboxArchived = (sandboxId: string): (() => void) => {
  let attempts = 0;
  let timer: any = null;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const tick = () => {
    attempts += 1;
    const state = useSandboxStore.getState();
    const sandbox = state.sandboxes.find((s) => s.id === sandboxId);
    if (sandbox && isMqttConnected()) {
      publishSandboxSnapshot(sandboxId);
      stop();
      return;
    }
    if (attempts > 20) stop();
  };

  tick();
  timer = setInterval(tick, 1500);
  return stop;
};

/** Viewport that frames one 모둠 page inside the given viewport. */
export const computeFitViewport = (
  viewportWidth: number,
  viewportHeight: number,
  padding = 60
): { panX: number; panY: number; scale: number } => {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { panX: 0, panY: 0, scale: 1 };
  }

  const contentWidth = GROUP_PAGE.width + padding * 2;
  const contentHeight = GROUP_PAGE.height + padding * 2;
  const scale = Math.max(0.2, Math.min(1, viewportWidth / contentWidth, viewportHeight / contentHeight));

  return {
    scale,
    panX: (viewportWidth - GROUP_PAGE.width * scale) / 2,
    panY: (viewportHeight - GROUP_PAGE.height * scale) / 2,
  };
};

export const sandboxPresenceTopic = (sandboxId: string) =>
  `antigravity/padlet/v1/sandbox/${mqttHostKey}/${sandboxId}/presence`;

// Contribute sandbox data to the Google Drive payload
registerDriveExtra(
  () => {
    const state = useSandboxStore.getState();
    return { sandboxes: state.sandboxes, sandboxElements: state.elements };
  },
  (data) => {
    const sandboxes = Array.isArray(data.sandboxes) ? (data.sandboxes as Sandbox[]) : null;
    const elements = Array.isArray(data.sandboxElements) ? (data.sandboxElements as SandboxElement[]) : null;
    if (!sandboxes && !elements) return;

    const nextSandboxes = sandboxes ?? useSandboxStore.getState().sandboxes;
    const nextElements = elements ?? useSandboxStore.getState().elements;
    useSandboxStore.setState({ sandboxes: nextSandboxes, elements: nextElements });
    persist(nextSandboxes, nextElements);
  }
);
