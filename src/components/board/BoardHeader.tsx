import React, { useState } from 'react';
import { useBoardStore, useAuthStore } from '../../store/useBoardStore';
import { 
  LayoutGrid, 
  Columns, 
  Move, 
  Image, 
  Plus, 
  Edit2, 
  Check,
  Home,
  Share2,
  Kanban
} from 'lucide-react';

interface BoardHeaderProps {
  onToggleWallpaperPicker: () => void;
  isGuestMode?: boolean;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({ onToggleWallpaperPicker, isGuestMode = false }) => {
  const { 
    boards,
    posts,
    updateBoardMeta, 
    addPost,
  } = useBoardStore();

  const {
    activeBoardId,
    setActiveBoardId,
    scale,
    setScale
  } = useAuthStore();

  // Find currently active board
  const activeBoard = boards.find(b => b.id === activeBoardId);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [titleInput, setTitleInput] = useState(activeBoard?.title || '');
  const [descInput, setDescInput] = useState(activeBoard?.description || '');

  if (!activeBoard) return null;

  const handleCopyShareLink = () => {
    const boardPosts = posts.filter((p) => p.boardId === activeBoard.id);
    try {
      const shareData = {
        board: activeBoard,
        posts: boardPosts
      };

      const jsonStr = JSON.stringify(shareData);
      const bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const encodedData = btoa(binary);

      const origin = window.location.origin;
      const shareUrl = `${origin}?share=${encodeURIComponent(encodedData)}`;

      navigator.clipboard.writeText(shareUrl).then(() => {
        setToastMessage('공유 링크가 복사되었습니다!');
        setTimeout(() => setToastMessage(''), 2000);
      }).catch(() => {
        setToastMessage('링크 복사에 실패했습니다.');
        setTimeout(() => setToastMessage(''), 2000);
      });
    } catch (err) {
      console.error(err);
      setToastMessage('링크 인코딩 과정에 오류가 발생했습니다.');
      setTimeout(() => setToastMessage(''), 2000);
    }
  };

  const handleSaveMeta = () => {
    updateBoardMeta(activeBoard.id, { title: titleInput, description: descInput });
    setIsEditingTitle(false);
  };


  const handleAddNewPost = () => {
    // Generate default coordinates in center of screen
    const centerX = window.innerWidth / 2 - 150;
    const centerY = window.innerHeight / 2 - 150;
    
    const colors = [
      'var(--card-indigo)',
      'var(--card-emerald)',
      'var(--card-peach)',
      'var(--card-sky)',
      'var(--card-rose)',
      'var(--card-amber)'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    addPost(activeBoard.id, {
      title: '',
      content: '',
      attachmentType: 'none',
      color: randomColor,
      positionX: centerX,
      positionY: centerY,
      author: isGuestMode ? '' : '관리자',
      password: isGuestMode ? '' : undefined,
      isApproved: true,
      isGuestPost: isGuestMode,
      isDraft: true
    });
  };

  return (
    <header className="glass-panel" style={styles.header}>
      {/* Home / Back to Dashboard */}
      {!isGuestMode ? (
        <button 
          className="button-premium" 
          onClick={() => setActiveBoardId('dashboard')}
          style={styles.homeBtn}
          title="대시보드로 돌아가기"
        >
          <Home size={18} />
          <span>대시보드</span>
        </button>
      ) : (
        <button 
          className="button-premium" 
          onClick={() => {
            setActiveBoardId('dashboard');
            window.location.href = window.location.origin;
          }}
          style={styles.homeBtn}
          title="관리자 로그인으로 가기"
        >
          <Home size={18} />
          <span>관리자 로그인</span>
        </button>
      )}

      <div style={styles.divider} />

      {/* Title & Description Section */}
      <div style={styles.metaSection}>
        {isEditingTitle ? (
          <div style={styles.editMetaForm}>
            <input 
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              style={styles.metaInputTitle}
              placeholder="보드 제목"
              autoFocus
            />
            <input 
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              style={styles.metaInputDesc}
              placeholder="설명 추가..."
            />
            <button onClick={handleSaveMeta} style={styles.metaSaveBtn}>
              <Check size={16} />
            </button>
          </div>
        ) : (
          <div style={styles.metaDisplay} onClick={() => {
            if (isGuestMode) return;
            setTitleInput(activeBoard.title);
            setDescInput(activeBoard.description);
            setIsEditingTitle(true);
          }}>
            <div style={styles.titleWrapper}>
              <h1>{activeBoard.title}</h1>
              {!isGuestMode && <Edit2 size={12} style={styles.editIcon} />}

            </div>
            <p style={styles.descText}>{activeBoard.description}</p>
          </div>
        )}
      </div>

      {/* Control Tools Section */}
      <div style={styles.controlsSection}>
        {/* Zoom Level in Canvas Mode */}
        {activeBoard.layout === 'canvas' && (
          <div style={styles.zoomControls}>
            <button 
              className="button-premium" 
              onClick={() => setScale(Math.max(0.2, parseFloat((scale - 0.1).toFixed(1))))}
              style={styles.zoomBtn}
            >
              -
            </button>
            <span style={styles.zoomVal}>{Math.round(scale * 100)}%</span>
            <button 
              className="button-premium" 
              onClick={() => setScale(Math.min(2.0, parseFloat((scale + 0.1).toFixed(1))))}
              style={styles.zoomBtn}
            >
              +
            </button>
          </div>
        )}

        {/* Share Link Button - Only for Admin */}
        {!isGuestMode && (
          <button className="button-premium" onClick={handleCopyShareLink} title="가상 공유 링크 복사">
            <Share2 size={16} />
            <span style={styles.btnLabel}>링크 공유</span>
          </button>
        )}

        {!isGuestMode && (
          <>
            {/* Layout Selectors */}
            <div style={styles.buttonGroup}>
              <button 
                className={`button-premium ${activeBoard.layout === 'grid' ? 'active' : ''}`}
                onClick={() => updateBoardMeta(activeBoard.id, { layout: 'grid' })}
                title="격자(Grid)형 레이아웃"
              >
                <LayoutGrid size={16} />
                <span style={styles.btnLabel}>Grid</span>
              </button>
              
              <button 
                className={`button-premium ${activeBoard.layout === 'wall' ? 'active' : ''}`}
                onClick={() => updateBoardMeta(activeBoard.id, { layout: 'wall' })}
                title="벽돌(Wall/Masonry)형 레이아웃"
              >
                <Columns size={16} />
                <span style={styles.btnLabel}>Wall</span>
              </button>

              <button 
                className={`button-premium ${activeBoard.layout === 'canvas' ? 'active' : ''}`}
                onClick={() => updateBoardMeta(activeBoard.id, { layout: 'canvas' })}
                title="자유(Canvas)형 레이아웃"
              >
                <Move size={16} />
                <span style={styles.btnLabel}>Canvas</span>
              </button>

              <button 
                className={`button-premium ${activeBoard.layout === 'column' ? 'active' : ''}`}
                onClick={() => updateBoardMeta(activeBoard.id, { layout: 'column' })}
                title="컬럼(Column/Kanban)형 레이아웃"
              >
                <Kanban size={16} />
                <span style={styles.btnLabel}>Column</span>
              </button>
            </div>

            {/* Wallpaper Picker */}
            <button className="button-premium" onClick={onToggleWallpaperPicker}>
              <Image size={16} />
              <span style={styles.btnLabel}>배경화면</span>
            </button>

            <div style={styles.divider} />
          </>
        )}

        {/* Add Card Action - Always visible for guest posting */}
        <button className="button-premium active" onClick={handleAddNewPost} style={styles.addButton}>
          <Plus size={18} />
          <span>카드 추가</span>
        </button>
      </div>

      {/* Toast Alert Inside Header */}
      {toastMessage && (
        <div style={styles.toast}>
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '76px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    zIndex: 100,
  },
  homeBtn: {
    marginRight: '4px',
  },
  metaSection: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    marginLeft: '16px',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pendingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    border: '1.5px solid rgba(251, 191, 36, 0.4)',
    borderRadius: '20px',
    padding: '4px 10px',
    color: '#fbbf24',
    fontSize: '0.725rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 0 10px rgba(251, 191, 36, 0.1)',
  },
  pendingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#fbbf24',
    boxShadow: '0 0 6px #fbbf24',
  },
  editIcon: {
    opacity: 0,
    color: 'var(--text-muted)',
    transition: 'opacity 0.2s ease',
  },
  metaDisplay: {
    padding: '4px',
    borderRadius: '8px',
  },
  descText: {
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '2px',
  },
  editMetaForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: 'rgba(0, 0, 0, 0.4)',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    position: 'relative',
    width: '280px',
  },
  metaInputTitle: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    outline: 'none',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '0.95rem',
  },
  metaInputDesc: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
  metaSaveBtn: {
    position: 'absolute',
    right: '8px',
    top: '8px',
    background: 'var(--color-primary)',
    border: 'none',
    borderRadius: '4px',
    color: '#030712',
    cursor: 'pointer',
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  buttonGroup: {
    display: 'flex',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '2px',
  },
  btnLabel: {
    display: 'inline',
  },
  zoomControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '2px 8px',
  },
  zoomBtn: {
    padding: '2px 6px',
    fontSize: '0.8rem',
    borderRadius: '6px',
  },
  zoomVal: {
    fontSize: '0.8rem',
    width: '38px',
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
  divider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: '0 8px',
  },
  addButton: {
    padding: '8px 16px',
  },
  toast: {
    position: 'fixed',
    top: '90px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(129, 140, 248, 0.95)',
    color: '#ffffff',
    padding: '8px 20px',
    borderRadius: '20px',
    zIndex: 10000,
    boxShadow: '0 4px 20px rgba(129, 140, 248, 0.25)',
    fontSize: '0.8rem',
    fontWeight: '500',
    backdropFilter: 'blur(8px)',
  }
};
