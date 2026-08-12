import React, { useState, useEffect, useRef } from 'react';
import { useBoardStore, useAuthStore } from './store/useBoardStore';
import { useSandboxStore } from './store/useSandboxStore';
import { Login } from './components/admin/Login';
import { Dashboard } from './components/admin/Dashboard';
import { SandboxWorkspace } from './components/sandbox/SandboxWorkspace';
import { BoardHeader } from './components/board/BoardHeader';
import { BoardContainer } from './components/board/BoardContainer';
import { WallpaperPicker } from './components/board/WallpaperPicker';
import './App.css';

const isLightColor = (colorStr: string): boolean => {
  if (!colorStr) return false;
  if (colorStr.startsWith('url')) return false;

  // Match 3 or 6 digit hex colors
  const hexColors = colorStr.match(/#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b/g) || [];
  if (hexColors.length === 0) {
    if (colorStr.includes('(밝음)')) return true;
    return false;
  }

  let totalLuminance = 0;
  hexColors.forEach(hex => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(char => char + char).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    totalLuminance += luminance;
  });

  const avgLuminance = totalLuminance / hexColors.length;
  return avgLuminance > 0.6;
};

const App: React.FC = () => {
  const { isAuthenticated, activeBoardId, setActiveBoardId } = useAuthStore();
  const { boards, importBoardData } = useBoardStore();
  const { activeSandboxId, setActiveSandboxId } = useSandboxStore();
  const [isWallpaperOpen, setIsWallpaperOpen] = useState(false);

  // 1. Synchronously parse URL parameter using TextDecoder for robust unicode support
  const params = new URLSearchParams(window.location.search);
  const shareDataEncoded = params.get('share');
  const sharedBoardId = params.get('board');
  const sharedSandboxId = params.get('sandbox');
  // Held in state because the query string is cleared right after we read it
  const [linkedSandboxId, setLinkedSandboxId] = useState<string | null>(sharedSandboxId);
  const openedLinkRef = useRef(false);

  let sharedBoardData: any = null;
  if (shareDataEncoded) {
    try {
      const normalized = shareDataEncoded.replace(/ /g, '+');
      
      // Attempt 1: Modern standard TextDecoder method
      try {
        const binary = atob(normalized);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const jsonStr = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.board && Array.isArray(parsed.posts)) {
          sharedBoardData = parsed;
        }
      } catch (e) {
        console.warn('Standard TextDecoder failed, attempting fallback legacy decoder...', e);
        // Attempt 2: Fallback to escape/unescape method for legacy URLs
        const jsonStr = decodeURIComponent(escape(atob(normalized)));
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.board && Array.isArray(parsed.posts)) {
          sharedBoardData = parsed;
        }
      }
    } catch (err) {
      console.error('Failed to parse share parameter synchronously:', err);
    }
  }

  const targetSharedBoardId = sharedBoardData ? sharedBoardData.board.id : sharedBoardId;

  // 2. Synchronous guest mode evaluation (bypass loading flags)
  const isGuestShareMode = !!targetSharedBoardId && (
    !!sharedBoardData || boards.some(b => b.id === targetSharedBoardId)
  );

  // 3. Asynchronously import shared data into local state
  useEffect(() => {
    if (sharedBoardData) {
      const exists = boards.some(b => b.id === sharedBoardData.board.id);
      if (!exists) {
        importBoardData(sharedBoardData.board, sharedBoardData.posts);
      }
    }
    // Board links carry a full copy of the board, so drop them once imported to
    // avoid re-importing stale data on reload. The sandbox id is left in place —
    // it is what makes refreshing and copying the address bar work.
    if (shareDataEncoded || sharedBoardId) {
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      url.searchParams.delete('board');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
    }
  }, [shareDataEncoded, sharedBoardId, boards, importBoardData]);

  // 4. Asynchronously align store activeBoardId with target shared link id
  useEffect(() => {
    if (isGuestShareMode && targetSharedBoardId && activeBoardId !== targetSharedBoardId) {
      setActiveBoardId(targetSharedBoardId);
    }
  }, [isGuestShareMode, targetSharedBoardId, activeBoardId, setActiveBoardId]);

  const activeBoard = boards.find(b => b.id === activeBoardId);
  // Default app chrome is bright; switch to dark tokens only for dark wallpapers
  const useDarkTheme = !!activeBoard && !isLightColor(activeBoard.wallpaper) && !String(activeBoard.wallpaper).includes('(밝음)');

  // A share link must open the canvas for signed-in people too, otherwise they
  // land on the dashboard because the guest route only covers signed-out visitors.
  useEffect(() => {
    if (!linkedSandboxId || !isAuthenticated || openedLinkRef.current) return;
    openedLinkRef.current = true;
    setActiveSandboxId(linkedSandboxId);
    setLinkedSandboxId(null);
  }, [linkedSandboxId, isAuthenticated, setActiveSandboxId]);

  // Keep the address bar on whichever canvas is open, so a refresh reopens it
  // and the URL stays copyable straight from the browser.
  const openSandboxId = isAuthenticated ? activeSandboxId : linkedSandboxId;
  useEffect(() => {
    const url = new URL(window.location.href);
    const inUrl = url.searchParams.get('sandbox');
    if (openSandboxId === inUrl) return;

    if (openSandboxId) url.searchParams.set('sandbox', openSandboxId);
    else url.searchParams.delete('sandbox');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  }, [openSandboxId]);

  const isViewingBoardAsGuest = !isAuthenticated && activeBoardId !== 'dashboard' && boards.some(b => b.id === activeBoardId);
  const isGuestView = isGuestShareMode || isViewingBoardAsGuest;

  return (
    <div 
      className={useDarkTheme ? 'dark-theme' : ''} 
      style={{
        ...styles.appContainer,
        background: useDarkTheme
          ? 'linear-gradient(160deg, #030712 0%, #0b1220 100%)'
          : 'linear-gradient(160deg, #e8f4fc 0%, #f7fbff 42%, #eef8f4 100%)',
        backgroundColor: useDarkTheme ? '#030712' : '#f0f7fb',
      }}
    >
      {linkedSandboxId && !isAuthenticated ? (
        /* Students join a collaborative canvas straight from the share link */
        <SandboxWorkspace
          sandboxId={linkedSandboxId}
          isGuestMode={true}
          onExit={() => setLinkedSandboxId(null)}
        />
      ) : isAuthenticated && activeSandboxId ? (
        /* Teacher-owned collaborative canvas */
        <SandboxWorkspace
          sandboxId={activeSandboxId}
          isGuestMode={false}
          onExit={() => setActiveSandboxId(null)}
        />
      ) : isGuestView ? (
        /* Render Shared Board Workspace for Guest (Bypass Login) */
        <>
          <BoardHeader 
            onToggleWallpaperPicker={() => setIsWallpaperOpen(true)} 
            isGuestMode={true} 
          />
          <BoardContainer isGuestMode={true} />
        </>
      ) : !isAuthenticated ? (
        /* Force Teacher Login gateway if unauthenticated */
        <Login />
      ) : activeBoardId === 'dashboard' ? (
        /* Render Dashboard if authenticated and activeBoard is dashboard */
        <Dashboard />
      ) : (
        /* Render individual Board Workspace for Admin */
        <>
          <BoardHeader 
            onToggleWallpaperPicker={() => setIsWallpaperOpen(true)} 
            isGuestMode={false} 
          />
          <BoardContainer isGuestMode={false} />
          <WallpaperPicker 
            isOpen={isWallpaperOpen} 
            onClose={() => setIsWallpaperOpen(false)} 
          />
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    width: '100vw',
    height: '100vh',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f0f7fb',
  }
};

export default App;
