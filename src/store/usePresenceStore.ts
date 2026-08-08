import { create } from 'zustand';
import { mqttClientId, mqttPublish, mqttSubscribe } from './useBoardStore';
import { sandboxPresenceTopic } from './useSandboxStore';

export interface Peer {
  clientId: string;
  name: string;
  color: string;
  groupId: string | null;
  x: number;
  y: number;
  lastSeen: number;
}

/** Peers stop being drawn once they go quiet for this long. */
const PEER_TIMEOUT_MS = 12000;
const HEARTBEAT_MS = 4000;
const CURSOR_THROTTLE_MS = 60;

interface PresenceState {
  peers: Record<string, Peer>;
  upsertPeer: (peer: Peer) => void;
  removePeer: (clientId: string) => void;
  prunePeers: () => void;
  clearPeers: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  peers: {},

  upsertPeer: (peer) =>
    set((state) => ({ peers: { ...state.peers, [peer.clientId]: peer } })),

  removePeer: (clientId) =>
    set((state) => {
      if (!state.peers[clientId]) return state;
      const peers = { ...state.peers };
      delete peers[clientId];
      return { peers };
    }),

  prunePeers: () => {
    const cutoff = Date.now() - PEER_TIMEOUT_MS;
    const current = get().peers;
    const stale = Object.values(current).filter((p) => p.lastSeen < cutoff);
    if (stale.length === 0) return;
    const peers = { ...current };
    stale.forEach((p) => delete peers[p.clientId]);
    set({ peers });
  },

  clearPeers: () => set({ peers: {} }),
}));

interface PresenceSelf {
  name: string;
  color: string;
  groupId: string | null;
}

let unsubscribe: (() => void) | null = null;
let heartbeat: any = null;
let pruneTimer: any = null;
let lastCursorSentAt = 0;
let activeTopic: string | null = null;
let self: PresenceSelf = { name: '', color: '#0ea5e9', groupId: null };
let lastCursor = { x: 0, y: 0 };

const publishPresence = (type: 'presence' | 'leave') => {
  if (!activeTopic) return;
  mqttPublish(activeTopic, {
    type,
    clientId: mqttClientId,
    name: self.name,
    color: self.color,
    groupId: self.groupId,
    x: lastCursor.x,
    y: lastCursor.y,
  });
};

export const startPresence = (sandboxId: string, identity: PresenceSelf): void => {
  const topic = sandboxPresenceTopic(sandboxId);
  self = identity;

  if (activeTopic === topic) {
    publishPresence('presence');
    return;
  }

  stopPresence();
  activeTopic = topic;
  usePresenceStore.getState().clearPeers();

  unsubscribe = mqttSubscribe(topic, (payload) => {
    if (!payload || payload.clientId === mqttClientId) return;

    if (payload.type === 'leave') {
      usePresenceStore.getState().removePeer(payload.clientId);
      return;
    }

    if (payload.type === 'presence') {
      usePresenceStore.getState().upsertPeer({
        clientId: payload.clientId,
        name: payload.name || '익명',
        color: payload.color || '#0ea5e9',
        groupId: payload.groupId ?? null,
        x: Number(payload.x) || 0,
        y: Number(payload.y) || 0,
        lastSeen: Date.now(),
      });
    }
  });

  publishPresence('presence');
  heartbeat = setInterval(() => publishPresence('presence'), HEARTBEAT_MS);
  pruneTimer = setInterval(() => usePresenceStore.getState().prunePeers(), 3000);
};

export const updatePresenceIdentity = (identity: PresenceSelf): void => {
  self = identity;
  publishPresence('presence');
};

export const sendCursor = (x: number, y: number): void => {
  lastCursor = { x, y };
  const now = Date.now();
  if (now - lastCursorSentAt < CURSOR_THROTTLE_MS) return;
  lastCursorSentAt = now;
  publishPresence('presence');
};

export const stopPresence = (): void => {
  if (activeTopic) publishPresence('leave');
  unsubscribe?.();
  unsubscribe = null;
  if (heartbeat) clearInterval(heartbeat);
  if (pruneTimer) clearInterval(pruneTimer);
  heartbeat = null;
  pruneTimer = null;
  activeTopic = null;
  usePresenceStore.getState().clearPeers();
};
