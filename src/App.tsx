import React, { useState, useEffect } from 'react';
import { useBoardStore, useAuthStore } from './store/useBoardStore';
import { Login } from './components/admin/Login';
import { Dashboard } from './components/admin/Dashboard';
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
  const [isWallpaperOpen, setIsWallpaperOpen] = useState(false);

  // 1. Synchronously parse URL parameter using TextDecoder for robust unicode support
  const params = new URLSearchParams(window.location.search);
  const shareDataEncoded = params.get('share');
  const sharedBoardId = params.get('board');

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
    // Clean up the URL query parameters to avoid stale imports on browser reload
    if (shareDataEncoded || sharedBoardId) {
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [shareDataEncoded, sharedBoardId, boards, importBoardData]);

  // 4. Asynchronously align store activeBoardId with target shared link id
  useEffect(() => {
    if (isGuestShareMode && targetSharedBoardId && activeBoardId !== targetSharedBoardId) {
      setActiveBoardId(targetSharedBoardId);
    }
  }, [isGuestShareMode, targetSharedBoardId, activeBoardId, setActiveBoardId]);

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const isLightBg = activeBoard ? isLightColor(activeBoard.wallpaper) : false;

  const isViewingBoardAsGuest = !isAuthenticated && activeBoardId !== 'dashboard' && boards.some(b => b.id === activeBoardId);
  const isGuestView = isGuestShareMode || isViewingBoardAsGuest;

  return (
    <div 
      className={isLightBg ? 'light-theme' : ''} 
      style={{
        ...styles.appContainer,
        backgroundColor: isLightBg ? '#f3f4f6' : '#030712'
      }}
    >
      {isGuestView ? (
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
    backgroundColor: '#030712',
  }
};

export default App;
