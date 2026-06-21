import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import mqtt from 'mqtt';

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
  role: string;
}

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

  login: (username: string, password: string) => boolean;
  logout: () => void;
  setActiveBoardId: (boardId: string) => void;
  setPan: (panX: number, panY: number) => void;
  setScale: (scale: number) => void;
}

const PRESET_WALLPAPERS = [
  'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', // Dark Indigo
  'linear-gradient(135deg, #180828 0%, #0c0214 100%)', // Deep Purple Glow
  'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', // Forest Emerald
  'linear-gradient(135deg, #1e3a8a 0%, #0d9488 100%)', // Deep Sea Teal
  'linear-gradient(135deg, #310818 0%, #110006 100%)', // Burgundy Night
  'linear-gradient(135deg, #581c87 0%, #b5179e 100%)', // Mystic Aurora
];

const INITIAL_BOARDS: Board[] = [
  {
    id: 'board-1',
    title: '🎨 브레인스토밍 디자인 보드',
    description: '아이디어 구상 및 인터페이스 디자인 기획 공간',
    layout: 'canvas',
    wallpaper: PRESET_WALLPAPERS[0],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    requireApproval: false,
  },
  {
    id: 'board-2',
    title: '📝 프로젝트 개발 스프린트',
    description: '구현 태스크 관리 및 검증 일정 보드',
    layout: 'grid',
    wallpaper: PRESET_WALLPAPERS[1],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    requireApproval: false,
  },
  {
    id: 'board-3',
    title: '📸 주간 영감 & 피드백 아카이브',
    description: '참고할 디자인과 미디어들을 모아두는 곳',
    layout: 'wall',
    wallpaper: PRESET_WALLPAPERS[2],
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    requireApproval: false,
  }
];

const INITIAL_POSTS: Post[] = [
  // Board 1 Posts (Canvas layout)
  {
    id: 'post-1',
    boardId: 'board-1',
    title: '✨ 환영합니다! 캔버스 보드입니다.',
    content: '캔버스 레이아웃은 Miro나 Figma처럼 무한히 넓은 공간입니다. 빈 곳을 더블클릭하면 새 카드가 생성됩니다. 마우스 드래그로 위치를 자유롭게 조정할 수 있습니다!',
    attachmentType: 'none',
    color: 'var(--card-indigo)',
    positionX: 80,
    positionY: 80,
    zIndex: 1,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    comments: [
      { id: 'c1', author: '관리자', content: '캔버스에서는 휠을 돌려 줌인/줌아웃(축소/확대)을 할 수 있어요!', createdAt: new Date(Date.now() - 3600000 * 2).toISOString() }
    ],
    reactions: { like: 5, love: 3, clap: 2, fire: 4 },
    author: '관리자',
    isApproved: true,
    isGuestPost: false
  },
  {
    id: 'post-2',
    boardId: 'board-1',
    title: '🔗 기획 단계 참고 리서치',
    content: '우아한 글래스모피즘 스타일 구현 팁. 웹사이트 URL 링크를 입력하면 카드 내부에 미디어 박스 정보가 표시됩니다.',
    attachmentUrl: 'https://deepmind.google',
    attachmentType: 'link',
    color: 'var(--card-peach)',
    positionX: 180,
    positionY: 340,
    zIndex: 2,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    comments: [],
    reactions: { like: 3, love: 4, clap: 5, fire: 1 },
    author: '관리자',
    isApproved: true,
    isGuestPost: false
  },

  // Board 2 Posts (Grid layout)
  {
    id: 'post-3',
    boardId: 'board-2',
    title: '🚀 스프린트 1단계: 프로젝트 환경 구성',
    content: 'React + Vite 빌드 파이프라인 확인 완료. HSL 색상 변수를 활용한 전역 테마 스타일시트 작성 완료.',
    attachmentType: 'none',
    color: 'var(--card-emerald)',
    positionX: 0,
    positionY: 0,
    zIndex: 1,
    createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    comments: [
      { id: 'c2', author: '리드 개발자', content: '빌드가 성공적으로 돌아가는지 먼저 체크했습니다.', createdAt: new Date(Date.now() - 3600000 * 9).toISOString() }
    ],
    reactions: { like: 7, love: 2, clap: 8, fire: 3 },
    author: '관리자',
    isApproved: true,
    isGuestPost: false
  },
  {
    id: 'post-4',
    boardId: 'board-2',
    title: '🎨 스프린트 2단계: 다중 캔버스 관리자 대시보드',
    content: '보드 생성, 레이아웃 빠른 변경, 보드 삭제, 보드별 분리 저장 및 데이터 관계 매핑 고도화 작업.',
    attachmentType: 'none',
    color: 'var(--card-rose)',
    positionX: 0,
    positionY: 0,
    zIndex: 2,
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    comments: [],
    reactions: { like: 9, love: 6, clap: 4, fire: 5 },
    author: '관리자',
    isApproved: true,
    isGuestPost: false
  },

  // Board 3 Posts (Wall layout)
  {
    id: 'post-5',
    boardId: 'board-3',
    title: '📸 이번 주 영감을 주는 해변 이미지',
    content: '주간 디자인 참고 자료용 고화질 랜드스케이프 이미지 첨부.',
    attachmentUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    attachmentType: 'image',
    color: 'var(--card-sky)',
    positionX: 0,
    positionY: 0,
    zIndex: 1,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    comments: [],
    reactions: { like: 12, love: 10, clap: 6, fire: 8 },
    author: '관리자',
    isApproved: true,
    isGuestPost: false
  }
];

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

    addReaction: (postId, type) =>
      set((state) => {
        const updatedPosts = state.posts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            reactions: {
              ...p.reactions,
              [type]: p.reactions[type] + 1,
            },
          };
        });
        saveBoardState(state.boards, updatedPosts, state.adminPassword);
        return { posts: updatedPosts };
      }),
  };
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      currentUser: null,
      activeBoardId: 'dashboard',
      panX: 0,
      panY: 0,
      scale: 1.0,

      login: (username, password) => {
        const currentPassword = useBoardStore.getState().adminPassword || 'admin';
        if (username === 'admin' && password === currentPassword) {
          set({ 
            isAuthenticated: true,
            currentUser: { username: 'admin', role: '교사' }
          });
          return true;
        }
        return false;
      },

      logout: () => {
        set({
          isAuthenticated: false,
          currentUser: null,
          activeBoardId: 'dashboard'
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
    });

    mqttClient.on('message', (receivedTopic: string, message: any) => {
      if (receivedTopic !== topic) return;
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


