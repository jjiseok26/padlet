import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import mqtt from 'mqtt';
import {
  findOrCreatePadletFolder,
  loadPadletDataFromDrive,
  savePadletDataToDrive
} from '../services/googleDriveService';
import { hasMyReaction, setMyReaction, loadMyReactions, saveMyReactions } from '../utils/cardHelpers';
import { collectDriveExtra, applyDriveExtra } from '../services/driveBridge';

export type LayoutType = 'grid' | 'wall' | 'canvas' | 'column';
export type AttachmentType = 'image' | 'video' | 'link' | 'file' | 'none';

export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Reactions {
  like: number;
  love: number;
  clap: number;
  fire: number;
}

export interface Post {
  id: string;
  boardId: string; // Relational foreign key
  title: string;
  content: string;
  attachmentUrl?: string;
  attachmentType: AttachmentType;
  color: string; // Custom HSL background color variable name
  positionX: number;
  positionY: number;
  zIndex: number;
  createdAt: string;
  comments: Comment[];
  reactions: Reactions;
  author: string;
  password?: string;
  isApproved: boolean;
  isGuestPost: boolean;
  isDraft?: boolean;
  columnName?: string; // Trello style column identification
}

export interface Board {
  id: string;
  title: string;
  description: string;
  layout: LayoutType;
  wallpaper: string;
  createdAt: string;
  requireApproval: boolean;
  columns?: string[];
  deletedPostIds?: string[];
}

export interface User {
  username: string;
  email?: string;
  picture?: string;
  role: string;
  googleAccessToken?: string;
  googleDriveFolderId?: string;
}

export type DriveSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

// 1. Board Store Interface (Manual localStorage persist)
interface BoardState {
  boards: Board[];
  posts: Post[];
  adminPassword?: string;

  // Actions
  changeAdminPassword: (newPassword: string) => void;
  importBoardData: (board: Board, posts: Post[]) => void;
  createBoard: (title: string, description: string, layout: LayoutType, wallpaper: string, requireApproval: boolean) => string;
  updateBoardMeta: (boardId: string, updates: Partial<Omit<Board, 'id' | 'createdAt'>>) => void;
  deleteBoard: (boardId: string) => void;
  addPost: (
    boardId: string,
    post: Omit<Post, 'id' | 'boardId' | 'createdAt' | 'comments' | 'reactions' | 'zIndex' | 'author' | 'isApproved' | 'isGuestPost' | 'password' | 'isDraft' | 'columnName'> & {
      author?: string;
      password?: string;
      isApproved?: boolean;
      isGuestPost?: boolean;
      isDraft?: boolean;
      columnName?: string;
    }
  ) => void;
  updatePost: (id: string, updates: Partial<Omit<Post, 'id' | 'boardId' | 'createdAt'>>) => void;
  deletePost: (id: string) => void;
  addComment: (postId: string, author: string, content: string) => void;
  deleteComment: (postId: string, commentId: string) => void;
  /** Toggle a reaction once per browser; second click removes it. */
  toggleReaction: (postId: string, type: keyof Reactions) => void;
  addReaction: (postId: string, type: keyof Reactions) => void;
}

// 2. Auth Store Interface (Persisted on sessionStorage per-tab)
interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  activeBoardId: string; // 'dashboard' or specific board ID
  panX: number;
  panY: number;
  scale: number;
  driveSyncStatus: DriveSyncStatus;
  lastDriveSyncTime: string | null;
  driveSyncError: string | null;

  googleLogin: (userData: { name: string; email?: string; picture?: string; accessToken: string }) => Promise<boolean>;
  login: (username?: string, password?: string) => boolean;
  logout: () => void;
  syncWithGoogleDrive: () => Promise<boolean>;
  setDriveSyncStatus: (status: DriveSyncStatus, error?: string | null) => void;
  setActiveBoardId: (boardId: string) => void;
  setPan: (panX: number, panY: number) => void;
  setScale: (scale: number) => void;
}



const INITIAL_BOARDS: Board[] = [];

const INITIAL_POSTS: Post[] = [];

// Helper to load initial state from localStorage securely
const loadInitialBoardState = () => {
  try {
    const dataStr = localStorage.getItem('padlet-board-storage-local');
    if (dataStr) {
      const parsed = JSON.parse(dataStr);
      if (parsed && parsed.state) {
        const loadedBoards = parsed.state.boards || INITIAL_BOARDS;
        const loadedPosts = parsed.state.posts || INITIAL_POSTS;
        
        // Gather all deleted IDs from boards
        const allDeletedIds = new Set<string>();
        loadedBoards.forEach((b: any) => b.deletedPostIds?.forEach((id: string) => allDeletedIds.add(id)));
        
        // Filter loaded posts to exclude deleted ones
        const filteredPosts = loadedPosts.filter((p: any) => !allDeletedIds.has(p.id));

        return {
          boards: loadedBoards,
          posts: filteredPosts,
          adminPassword: parsed.state.adminPassword || 'admin'
        };
      }
    }
  } catch (e) {
    console.error('Failed to load initial board state', e);
  }
  return {
    boards: INITIAL_BOARDS,
    posts: INITIAL_POSTS,
    adminPassword: 'admin'
  };
};

// Debounced auto-sync to Google Drive
let autoSyncTimeout: any = null;

const triggerAutoDriveSync = () => {
  const authState = useAuthStore.getState();
  if (!authState.isAuthenticated || !authState.currentUser?.googleAccessToken) return;

  if (autoSyncTimeout) clearTimeout(autoSyncTimeout);

  useAuthStore.setState({ driveSyncStatus: 'syncing' });

  autoSyncTimeout = setTimeout(async () => {
    try {
      await authState.syncWithGoogleDrive();
    } catch (err: any) {
      console.error('Auto drive sync failed:', err);
    }
  }, 1200);
};

// Helper to save state directly to localStorage synchronously
const saveBoardState = (boards: Board[], posts: Post[], adminPassword?: string) => {
  try {
    const data = {
      state: {
        boards,
        posts: posts.filter(p => !p.isDraft), // Exclude temporary draft edits
        adminPassword
      },
      version: 0
    };
    localStorage.setItem('padlet-board-storage-local', JSON.stringify(data));
    triggerAutoDriveSync();
  } catch (e) {
    console.error('Failed to save board state', e);
  }
};

export const useBoardStore = create<BoardState>((set, get) => {
  const initial = loadInitialBoardState();

  return {
    boards: initial.boards,
    posts: initial.posts,
    adminPassword: initial.adminPassword,

    changeAdminPassword: (newPassword) => {
      set({ adminPassword: newPassword });
      saveBoardState(get().boards, get().posts, newPassword);
    },

    importBoardData: (importedBoard, importedPosts) => {
      set((state) => {
        const boardExists = state.boards.some((b) => b.id === importedBoard.id);
        const updatedBoards = boardExists
          ? state.boards.map((b) => {
              if (b.id === importedBoard.id) {
                const combinedDeleted = Array.from(new Set([...(b.deletedPostIds || []), ...(importedBoard.deletedPostIds || [])]));
                return { ...b, ...importedBoard, deletedPostIds: combinedDeleted };
              }
              return b;
            })
          : [...state.boards, importedBoard];

        // Gather all deleted IDs
        const targetBoard = updatedBoards.find(b => b.id === importedBoard.id);
        const deletedIds = new Set<string>(targetBoard?.deletedPostIds || []);

        const importedPostIds = importedPosts.map((p) => p.id);
        const filteredExistingPosts = state.posts.filter((p) => !importedPostIds.includes(p.id));
        const combinedPosts = [...filteredExistingPosts, ...importedPosts];
        
        // Filter out posts that are in the tombstone list
        const updatedPosts = combinedPosts.filter(p => !deletedIds.has(p.id));

        saveBoardState(updatedBoards, updatedPosts, state.adminPassword);
        return {
          boards: updatedBoards,
          posts: updatedPosts,
        };
      });
    },

    createBoard: (title, description, layout, wallpaper, requireApproval) => {
      const newId = `board-${Math.random().toString(36).substr(2, 9)}`;
      const newBoard: Board = {
        id: newId,
        title,
        description,
        layout,
        wallpaper,
        createdAt: new Date().toISOString(),
        requireApproval
      };
      set((state) => {
        const updatedBoards = [...state.boards, newBoard];
        saveBoardState(updatedBoards, state.posts, state.adminPassword);
        return { boards: updatedBoards };
      });
      return newId;
    },

    updateBoardMeta: (boardId, updates) =>
      set((state) => {
        const updatedBoards = state.boards.map((b) => (b.id === boardId ? { ...b, ...updates } : b));
        saveBoardState(updatedBoards, state.posts, state.adminPassword);
        return { boards: updatedBoards };
      }),

    deleteBoard: (boardId) =>
      set((state) => {
        const updatedBoards = state.boards.filter((b) => b.id !== boardId);
        const updatedPosts = state.posts.filter((p) => p.boardId !== boardId);
        saveBoardState(updatedBoards, updatedPosts, state.adminPassword);
        return {
          boards: updatedBoards,
          posts: updatedPosts
        };
      }),

    addPost: (boardId, postData) =>
      set((state) => {
        const boardPosts = state.posts.filter((p) => p.boardId === boardId);
        const maxZIndex = boardPosts.reduce((max, p) => Math.max(max, p.zIndex), 0);
        
        const {
          author = '관리자',
          isApproved = true,
          isGuestPost = false,
          password,
          isDraft = false,
          columnName = '기본 컬럼',
          ...restPostData
        } = postData;

        const newPost: Post = {
          ...restPostData,
          author,
          isApproved,
          isGuestPost,
          password,
          isDraft,
          columnName,
          id: `post-${Math.random().toString(36).substr(2, 9)}`,
          boardId,
          createdAt: new Date().toISOString(),
          comments: [],
          reactions: { like: 0, love: 0, clap: 0, fire: 0 },
          zIndex: maxZIndex + 1,
        };
        const updatedPosts = [...state.posts, newPost];
        saveBoardState(state.boards, updatedPosts, state.adminPassword);
        return { posts: updatedPosts };
      }),

    updatePost: (id, updates) =>
      set((state) => {
        const updatedPosts = state.posts.map((p) => (p.id === id ? { ...p, ...updates } : p));
        saveBoardState(state.boards, updatedPosts, state.adminPassword);
        return { posts: updatedPosts };
      }),

    deletePost: (id) =>
      set((state) => {
        const postToDelete = state.posts.find(p => p.id === id);
        const updatedPosts = state.posts.filter((p) => p.id !== id);
        
        let updatedBoards = state.boards;
        if (postToDelete) {
          updatedBoards = state.boards.map(b => {
            if (b.id === postToDelete.boardId) {
              const currentDeleted = b.deletedPostIds || [];
              if (!currentDeleted.includes(id)) {
                return {
                  ...b,
                  deletedPostIds: [...currentDeleted, id]
                };
              }
            }
            return b;
          });
        }

        // Clear local reaction marks for deleted card
        const mine = loadMyReactions();
        if (mine[id]) {
          delete mine[id];
          saveMyReactions(mine);
        }

        saveBoardState(updatedBoards, updatedPosts, state.adminPassword);
        return { 
          boards: updatedBoards,
          posts: updatedPosts 
        };
      }),

    addComment: (postId, author, content) =>
      set((state) => {
        const updatedPosts = state.posts.map((p) => {
          if (p.id !== postId) return p;
          const newComment: Comment = {
            id: `comment-${Math.random().toString(36).substr(2, 9)}`,
            author,
            content,
            createdAt: new Date().toISOString(),
          };
          return { ...p, comments: [...p.comments, newComment] };
        });
        saveBoardState(state.boards, updatedPosts, state.adminPassword);
        return { posts: updatedPosts };
      }),

    deleteComment: (postId, commentId) =>
      set((state) => {
        const updatedPosts = state.posts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            comments: p.comments.filter((c) => c.id !== commentId)
          };
        });
        saveBoardState(state.boards, updatedPosts, state.adminPassword);
        return { posts: updatedPosts };
      }),

    addReaction: (postId, type) => {
      // Back-compat alias → toggle once per browser
      get().toggleReaction(postId, type);
    },

    toggleReaction: (postId, type) =>
      set((state) => {
        const already = hasMyReaction(postId, type);
        const updatedPosts = state.posts.map((p) => {
          if (p.id !== postId) return p;
          const current = p.reactions?.[type] ?? 0;
          const nextCount = already ? Math.max(0, current - 1) : current + 1;
          return {
            ...p,
            reactions: {
              like: p.reactions?.like ?? 0,
              love: p.reactions?.love ?? 0,
              clap: p.reactions?.clap ?? 0,
              fire: p.reactions?.fire ?? 0,
              [type]: nextCount,
            },
          };
        });
        setMyReaction(postId, type, !already);
        saveBoardState(state.boards, updatedPosts, state.adminPassword);
        return { posts: updatedPosts };
      }),
  };
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      currentUser: null,
      activeBoardId: 'dashboard',
      panX: 0,
      panY: 0,
      scale: 1.0,
      driveSyncStatus: 'idle',
      lastDriveSyncTime: null,
      driveSyncError: null,

      setDriveSyncStatus: (status, error = null) => {
        set({ driveSyncStatus: status, driveSyncError: error });
      },

      googleLogin: async (userData) => {
        try {
          if (!userData.accessToken || userData.accessToken.startsWith('demo-token-')) {
            set({
              driveSyncStatus: 'error',
              driveSyncError: '유효한 Google 계정 로그인이 필요합니다.'
            });
            return false;
          }

          set({
            driveSyncStatus: 'syncing',
            driveSyncError: null
          });

          // 1. Find or create 'padlet' folder in Google Drive
          const folderId = await findOrCreatePadletFolder(userData.accessToken);

          const userObj: User = {
            username: userData.name,
            email: userData.email,
            picture: userData.picture,
            role: '교사',
            googleAccessToken: userData.accessToken,
            googleDriveFolderId: folderId
          };

          set({
            isAuthenticated: true,
            currentUser: userObj
          });

          // 2. Try loading data from Google Drive padlet/padlet_data.json
          const driveData = await loadPadletDataFromDrive(userData.accessToken, folderId);
          if (driveData && driveData.boards && Array.isArray(driveData.boards)) {
            // Restore from Drive
            useBoardStore.setState({
              boards: driveData.boards,
              posts: driveData.posts
            });
            saveBoardState(driveData.boards, driveData.posts);
            applyDriveExtra(driveData as unknown as Record<string, unknown>);
          } else {
            // Sync initial local data to Google Drive
            const currentBoards = useBoardStore.getState().boards;
            const currentPosts = useBoardStore.getState().posts;
            await savePadletDataToDrive(userData.accessToken, folderId, {
              boards: currentBoards,
              posts: currentPosts,
              ...collectDriveExtra(),
            });
          }

          set({
            driveSyncStatus: 'synced',
            lastDriveSyncTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          });

          return true;
        } catch (err: any) {
          console.error('Google Drive Login Sync error:', err);
          set({
            driveSyncStatus: 'error',
            driveSyncError: err.message || 'Google Drive 연동 중 오류 발생'
          });
          return false;
        }
      },

      syncWithGoogleDrive: async () => {
        const currentUser = get().currentUser;
        if (!currentUser || !currentUser.googleAccessToken) {
          return false;
        }

        try {
          set({ driveSyncStatus: 'syncing', driveSyncError: null });

          const folderId = currentUser.googleDriveFolderId || (await findOrCreatePadletFolder(currentUser.googleAccessToken));
          if (!currentUser.googleDriveFolderId) {
            set({ currentUser: { ...currentUser, googleDriveFolderId: folderId } });
          }

          const boards = useBoardStore.getState().boards;
          const posts = useBoardStore.getState().posts.filter(p => !p.isDraft);

          const success = await savePadletDataToDrive(currentUser.googleAccessToken, folderId, {
            boards,
            posts,
            ...collectDriveExtra(),
          });

          if (success) {
            set({
              driveSyncStatus: 'synced',
              lastDriveSyncTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            });
            return true;
          } else {
            set({ driveSyncStatus: 'error', driveSyncError: 'Google Drive 저장 실패' });
            return false;
          }
        } catch (err: any) {
          console.error('Manual drive sync failed:', err);
          set({ driveSyncStatus: 'error', driveSyncError: err.message });
          return false;
        }
      },

      // Admin password login is disabled — Google OAuth only
      login: () => false,

      logout: () => {
        set({
          isAuthenticated: false,
          currentUser: null,
          activeBoardId: 'dashboard',
          driveSyncStatus: 'idle',
          lastDriveSyncTime: null,
          driveSyncError: null
        });
      },

      setActiveBoardId: (boardId) => set({ 
        activeBoardId: boardId,
        panX: 0,
        panY: 0,
        scale: 1.0 
      }),

      setPan: (panX, panY) => set({ panX, panY }),
      setScale: (scale) => set({ scale }),
    }),
    {
      name: 'padlet-board-storage-session',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

// 3. MQTT Real-time Synchronization Setup
const clientId = `client-${Math.random().toString(36).substring(2, 9)}`;
const hostName = typeof window !== 'undefined' ? window.location.host : 'localhost';
const topic = `antigravity/padlet/v1/sync/${encodeURIComponent(hostName).replace(/%/g, '_')}`;

let isSyncingFromNetwork = false;
let mqttClient: any = null;

// --- Shared MQTT bus so other features (sandbox rooms) can reuse one connection ---
type TopicHandler = (payload: any) => void;
const extraTopicHandlers = new Map<string, Set<TopicHandler>>();

export const mqttClientId = clientId;
export const mqttHostKey = encodeURIComponent(hostName).replace(/%/g, '_');

export const mqttSubscribe = (targetTopic: string, handler: TopicHandler): (() => void) => {
  let handlers = extraTopicHandlers.get(targetTopic);
  if (!handlers) {
    handlers = new Set();
    extraTopicHandlers.set(targetTopic, handlers);
    mqttClient?.subscribe(targetTopic, (err: any) => {
      if (err) console.error('[MQTT] subscribe failed:', targetTopic, err);
    });
  }
  handlers.add(handler);

  return () => {
    const set = extraTopicHandlers.get(targetTopic);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      extraTopicHandlers.delete(targetTopic);
      mqttClient?.unsubscribe(targetTopic);
    }
  };
};

export const mqttPublish = (targetTopic: string, payload: unknown): boolean => {
  if (!mqttClient || !mqttClient.connected) return false;
  try {
    mqttClient.publish(targetTopic, JSON.stringify(payload), { qos: 0 });
    return true;
  } catch (e) {
    console.error('[MQTT] publish failed:', targetTopic, e);
    return false;
  }
};

export const isMqttConnected = (): boolean => Boolean(mqttClient?.connected);

export const initMQTT = () => {
  if (typeof window === 'undefined') return;
  if (mqttClient) return;

  const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
  console.log(`[MQTT] Connecting to broker... Topic: ${topic}, ClientId: ${clientId}`);

  try {
    // Add simple polyfills just in case browser build complains about Node internals
    if (typeof window !== 'undefined') {
      if (!(window as any).process) {
        (window as any).process = { env: {} };
      }
      if (!(window as any).Buffer) {
        (window as any).Buffer = {
          isBuffer: () => false,
          from: (str: string) => ({ toString: () => str })
        };
      }
    }

    mqttClient = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 2000,
    });

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connected to broker successfully.');
      mqttClient.subscribe(topic, (err: any) => {
        if (!err) {
          console.log(`[MQTT] Subscribed to topic: ${topic}`);
        } else {
          console.error('[MQTT] Subscription failed:', err);
        }
      });
      // Restore feature topics (sandbox rooms) after a reconnect
      extraTopicHandlers.forEach((_handlers, extraTopic) => {
        mqttClient.subscribe(extraTopic);
      });
    });

    mqttClient.on('message', (receivedTopic: string, message: any) => {
      if (receivedTopic !== topic) {
        // Route other topics (e.g. sandbox rooms) to their subscribers
        const handlers = extraTopicHandlers.get(receivedTopic);
        if (handlers) {
          let parsed: any = null;
          try {
            parsed = JSON.parse(message.toString());
          } catch {
            return;
          }
          handlers.forEach((fn) => {
            try {
              fn(parsed);
            } catch (e) {
              console.error('[MQTT] topic handler failed', e);
            }
          });
        }
        return;
      }
      try {
        const payload = JSON.parse(message.toString());
        if (payload.senderId === clientId) return; // Ignore own messages

        // Handle viewport synchronization from Admin to Guests (Disabled follow behavior)
        if (payload.type === 'viewport') {
          // Do nothing - do not update guest panX, panY, and scale
          return;
        }

        isSyncingFromNetwork = true;

        // Preserve current local drafts from being overwritten
        const localDrafts = useBoardStore.getState().posts.filter(p => p.isDraft);
        const localBoards = useBoardStore.getState().boards;
        const networkBoards = payload.boards || [];
        const networkPosts = payload.posts || [];
        
        // Accumulate all deletedPostIds from both local and network boards (tombstones)
        const allDeletedIds = new Set<string>();
        localBoards.forEach(b => b.deletedPostIds?.forEach(id => allDeletedIds.add(id)));
        networkBoards.forEach((b: any) => b.deletedPostIds?.forEach((id: string) => allDeletedIds.add(id)));

        // Filter network posts using tombstones
        const filteredNetworkPosts = networkPosts.filter((p: any) => !allDeletedIds.has(p.id));

        const networkPostIds = filteredNetworkPosts.map((p: any) => p.id);
        const filteredDrafts = localDrafts.filter(d => !networkPostIds.includes(d.id));
        const mergedPosts = [...filteredNetworkPosts, ...filteredDrafts];

        // Merge deletedPostIds on incoming boards to ensure they propagate correctly
        const mergedBoards = networkBoards.map((nb: any) => {
          const lb = localBoards.find(b => b.id === nb.id);
          if (lb) {
            const combinedDeleted = Array.from(new Set([...(lb.deletedPostIds || []), ...(nb.deletedPostIds || [])]));
            return { ...nb, deletedPostIds: combinedDeleted };
          }
          return nb;
        });

        // Update Zustand store state
        useBoardStore.setState({
          boards: mergedBoards,
          posts: mergedPosts
        });

        // Save to localstorage synchronously to persist changes
        saveBoardState(mergedBoards, mergedPosts, useBoardStore.getState().adminPassword);
        
        isSyncingFromNetwork = false;
      } catch (e) {
        console.error('[MQTT] Error processing incoming message:', e);
        isSyncingFromNetwork = false;
      }
    });

    mqttClient.on('error', (err: any) => {
      console.error('[MQTT] Connection error:', err);
    });

    mqttClient.on('close', () => {
      console.warn('[MQTT] Connection closed.');
    });
  } catch (e) {
    console.error('[MQTT] Failed to initialize MQTT:', e);
  }
};

// Automatically trigger connection on store load
initMQTT();

// Subscribe to Zustand store changes and broadcast via MQTT
useBoardStore.subscribe((state) => {
  if (isSyncingFromNetwork) return; // Prevent loop when setting state from network
  if (!mqttClient || !mqttClient.connected) return;

  try {
    const payload = {
      senderId: clientId,
      boards: state.boards,
      posts: state.posts.filter(p => !p.isDraft) // Filter out local drafts
    };
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 }); // Fast delivery with QoS 0
    console.log('[MQTT] State change published.');
  } catch (e) {
    console.error('[MQTT] Failed to publish state update:', e);
  }
});

// Subscribe to Auth store changes (viewport/board movement by Admin) and broadcast via MQTT
useAuthStore.subscribe((state) => {
  if (isSyncingFromNetwork) return;
  if (!state.isAuthenticated) return; // Only Admin broadcasts their layout viewport
  if (!mqttClient || !mqttClient.connected) return;

  try {
    const payload = {
      type: 'viewport',
      senderId: clientId,
      activeBoardId: state.activeBoardId,
      panX: state.panX,
      panY: state.panY,
      scale: state.scale
    };
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 });
    console.log('[MQTT] Admin Viewport alignment published.');
  } catch (e) {
    console.error('[MQTT] Failed to publish viewport update:', e);
  }
});


