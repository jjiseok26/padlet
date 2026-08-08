import { create } from 'zustand';
import { mqttClientId, mqttHostKey, mqttPublish, mqttSubscribe } from './useBoardStore';
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
  groups: SandboxGroup[];
  /** Tombstones so deletes survive peer merges. */
  deletedElementIds?: string[];
  allowGuestEdit: boolean;
}

const STORAGE_KEY = 'padlet-sandbox-storage-local';
const IDENTITY_KEY = 'padlet-sandbox-identity';

export const GROUP_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
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

interface SandboxState {
  sandboxes: Sandbox[];
  elements: SandboxElement[];
  activeSandboxId: string | null;

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

      const columns = Math.min(names.length, 3);
      const zoneWidth = 720;
      const zoneHeight = 560;
      const gap = 60;

      const groups: SandboxGroup[] = names.map((name, index) => ({
        id: uid('group'),
        name,
        color: GROUP_COLORS[index % GROUP_COLORS.length],
        x: (index % columns) * (zoneWidth + gap),
        y: Math.floor(index / columns) * (zoneHeight + gap),
        width: zoneWidth,
        height: zoneHeight,
      }));

      const sandbox: Sandbox = {
        id,
        title: title.trim() || '새 협업 캔버스',
        description: description.trim(),
        background: background || 'grid-light',
        createdAt: nowISO(),
        groups,
        deletedElementIds: [],
        allowGuestEdit: true,
      };

      const sandboxes = [...get().sandboxes, sandbox];
      set({ sandboxes });
      commit(sandboxes, get().elements);
      return id;
    },

    deleteSandbox: (sandboxId) => {
      const sandboxes = get().sandboxes.filter((s) => s.id !== sandboxId);
      const elements = get().elements.filter((el) => el.sandboxId !== sandboxId);
      set({ sandboxes, elements });
      commit(sandboxes, elements);
    },

    updateSandbox: (sandboxId, updates) => {
      const sandboxes = get().sandboxes.map((s) => (s.id === sandboxId ? { ...s, ...updates } : s));
      set({ sandboxes });
      commit(sandboxes, get().elements);
    },

    importSandbox: (sandbox, importedElements) => {
      const exists = get().sandboxes.some((s) => s.id === sandbox.id);
      const sandboxes = exists
        ? get().sandboxes.map((s) => (s.id === sandbox.id ? { ...s, ...sandbox } : s))
        : [...get().sandboxes, sandbox];

      const importedIds = new Set(importedElements.map((el) => el.id));
      const elements = [...get().elements.filter((el) => !importedIds.has(el.id)), ...importedElements];

      set({ sandboxes, elements });
      commit(sandboxes, elements);
    },

    addGroup: (sandboxId, name) => {
      const sandboxes = get().sandboxes.map((s) => {
        if (s.id !== sandboxId) return s;
        const index = s.groups.length;
        const columns = 3;
        const zoneWidth = 720;
        const zoneHeight = 560;
        const gap = 60;
        const group: SandboxGroup = {
          id: uid('group'),
          name: name.trim() || `${index + 1}모둠`,
          color: GROUP_COLORS[index % GROUP_COLORS.length],
          x: (index % columns) * (zoneWidth + gap),
          y: Math.floor(index / columns) * (zoneHeight + gap),
          width: zoneWidth,
          height: zoneHeight,
        };
        return { ...s, groups: [...s.groups, group] };
      });
      set({ sandboxes });
      commit(sandboxes, get().elements);
    },

    updateGroup: (sandboxId, groupId, updates) => {
      const sandboxes = get().sandboxes.map((s) =>
        s.id === sandboxId
          ? { ...s, groups: s.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)) }
          : s
      );
      set({ sandboxes });
      commit(sandboxes, get().elements);
    },

    removeGroup: (sandboxId, groupId) => {
      const sandboxes = get().sandboxes.map((s) =>
        s.id === sandboxId ? { ...s, groups: s.groups.filter((g) => g.id !== groupId) } : s
      );
      // Keep the work, just detach it from the removed zone
      const elements = get().elements.map((el) =>
        el.sandboxId === sandboxId && el.groupId === groupId ? { ...el, groupId: null } : el
      );
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
          return tombstones.includes(id) ? s : { ...s, deletedElementIds: [...tombstones, id] };
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
        return { ...s, deletedElementIds: Array.from(tombstones) };
      });

      set({ elements, sandboxes, selectedElementId: null });
      commit(sandboxes, elements);
    },

    setActiveSandboxId: (id) => set({ activeSandboxId: id, panX: 0, panY: 0, scale: 1, selectedElementId: null }),

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

const broadcastState = (sandboxes: Sandbox[], elements: SandboxElement[]) => {
  const activeId = useSandboxStore.getState().activeSandboxId;
  if (!activeId) return;

  const sandbox = sandboxes.find((s) => s.id === activeId);
  if (!sandbox) return;

  // Coalesce rapid edits (drawing strokes) into one publish
  if (publishTimer) clearTimeout(publishTimer);
  publishTimer = setTimeout(() => {
    mqttPublish(roomTopic(activeId), {
      type: 'sandbox-state',
      senderId: mqttClientId,
      sandbox,
      elements: elements.filter((el) => el.sandboxId === activeId),
    });
  }, 120);
};

const mergeRemote = (sandbox: Sandbox, remoteElements: SandboxElement[]) => {
  const state = useSandboxStore.getState();

  const localSandbox = state.sandboxes.find((s) => s.id === sandbox.id);
  const tombstones = new Set<string>([
    ...(localSandbox?.deletedElementIds || []),
    ...(sandbox.deletedElementIds || []),
  ]);

  const mergedSandbox: Sandbox = {
    ...sandbox,
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

/** Subscribe to the active sandbox room; call again when the sandbox changes. */
export const joinSandboxRoom = (sandboxId: string | null): void => {
  if (joinedSandboxId === sandboxId) return;

  unsubscribeRoom?.();
  unsubscribeRoom = null;
  if (catchUpTimer) {
    clearInterval(catchUpTimer);
    catchUpTimer = null;
  }
  joinedSandboxId = sandboxId;
  if (!sandboxId) return;

  unsubscribeRoom = mqttSubscribe(roomTopic(sandboxId), (payload) => {
    if (!payload || payload.senderId === mqttClientId) return;

    if (payload.type === 'sandbox-state' && payload.sandbox) {
      mergeRemote(payload.sandbox as Sandbox, (payload.elements || []) as SandboxElement[]);
      return;
    }

    if (payload.type === 'sandbox-request') {
      const state = useSandboxStore.getState();
      const sandbox = state.sandboxes.find((s) => s.id === sandboxId);
      if (!sandbox) return;
      mqttPublish(roomTopic(sandboxId), {
        type: 'sandbox-state',
        senderId: mqttClientId,
        sandbox,
        elements: state.elements.filter((el) => el.sandboxId === sandboxId),
      });
    }
  });

  requestSnapshotUntilSynced(sandboxId);
};

export const publishSandboxSnapshot = (sandboxId: string): void => {
  const state = useSandboxStore.getState();
  const sandbox = state.sandboxes.find((s) => s.id === sandboxId);
  if (!sandbox) return;
  mqttPublish(roomTopic(sandboxId), {
    type: 'sandbox-state',
    senderId: mqttClientId,
    sandbox,
    elements: state.elements.filter((el) => el.sandboxId === sandboxId),
  });
};

/** Viewport that frames every 모둠 zone, so a canvas opens showing the whole space. */
export const computeFitViewport = (
  groups: SandboxGroup[],
  viewportWidth: number,
  viewportHeight: number
): { panX: number; panY: number; scale: number } => {
  if (groups.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { panX: 60, panY: 50, scale: 1 };
  }

  const padding = 90;
  const minX = Math.min(...groups.map((g) => g.x)) - padding;
  const minY = Math.min(...groups.map((g) => g.y)) - padding;
  const maxX = Math.max(...groups.map((g) => g.x + g.width)) + padding;
  const maxY = Math.max(...groups.map((g) => g.y + g.height)) + padding;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const scale = Math.max(0.25, Math.min(1, viewportWidth / contentWidth, viewportHeight / contentHeight));

  return {
    scale,
    panX: (viewportWidth - contentWidth * scale) / 2 - minX * scale,
    panY: (viewportHeight - contentHeight * scale) / 2 - minY * scale,
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
