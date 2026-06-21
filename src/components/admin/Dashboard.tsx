import React, { useState } from 'react';
import { useBoardStore, useAuthStore } from '../../store/useBoardStore';
import type { LayoutType } from '../../store/useBoardStore';
import { 
  Plus, 
  Trash2, 
  LayoutGrid, 
  Columns, 
  Move, 
  Calendar, 
  ArrowRight,
  FolderHeart,
  X,
  Layers,
  LogOut,
  Key,
  Share2,
  Search,
  Kanban,
  Upload,
  HelpCircle
} from 'lucide-react';
import { GuideModal } from '../board/GuideModal';

export const Dashboard: React.FC = () => {
  const { 
    boards, 
    posts, 
    createBoard, 
    deleteBoard, 
    updateBoardMeta,
    changeAdminPassword,
    importBoardData
  } = useBoardStore();

  const { setActiveBoardId, logout } = useAuthStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLayout, setNewLayout] = useState<LayoutType>('canvas');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Password change & Toast state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'title'>('latest');
  const [searchQuery, setSearchQuery] = useState('');

  // Curated premium wallpaper options for new boards
  const wallpaperPresets = [
    { name: '다크 인디고', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' },
    { name: '딥 퍼플', value: 'linear-gradient(135deg, #180828 0%, #0c0214 100%)' },
    { name: '포레스트 에메랄드', value: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)' },
    { name: '심해 티어', value: 'linear-gradient(135deg, #1e3a8a 0%, #0d9488 100%)' },
    { name: '버건디 나이트', value: 'linear-gradient(135deg, #310818 0%, #110006 100%)' },
    { name: '미스틱 오로라', value: 'linear-gradient(135deg, #581c87 0%, #b5179e 100%)' },
    { name: '딥 Navy', value: '#0f172a' },
    { name: '인크 Black', value: '#030712' }
  ];
  const [selectedWallpaper, setSelectedWallpaper] = useState(wallpaperPresets[0].value);

  const handleCopyShareLink = (boardId: string) => {
    const targetBoard = boards.find((b) => b.id === boardId);
    const targetPosts = posts.filter((p) => p.boardId === boardId);
    
    if (!targetBoard) {
      showToast('보드를 찾을 수 없습니다.');
      return;
    }

    try {
      const shareData = {
        board: targetBoard,
        posts: targetPosts
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
        showToast('공유 링크가 클립보드에 복사되었습니다!');
      }).catch(() => {
        showToast('링크 복사에 실패했습니다.');
      });
    } catch (err) {
      console.error(err);
      showToast('링크 인코딩 과정에 오류가 발생했습니다.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordInput.trim()) {
      setPasswordError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('비밀번호가 일치하지 않습니다.');
      return;
    }
    changeAdminPassword(newPasswordInput.trim());
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError('');
    setIsPasswordModalOpen(false);
    showToast('교사 비밀번호가 성공적으로 변경되었습니다!');
  };

  const handleCreateBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newBoardId = createBoard(
      newTitle.trim(),
      newDesc.trim() || '추가 설명이 없는 보드입니다.',
      newLayout,
      selectedWallpaper,
      false // Always false
    );

    // Reset fields & Close modal
    setNewTitle('');
    setNewDesc('');
    setNewLayout('canvas');
    setSelectedWallpaper(wallpaperPresets[0].value);
    setIsModalOpen(false);

    // Automatically enter the newly created board
    setActiveBoardId(newBoardId);
  };

  // Helper to count posts in a board
  const getPostCount = (boardId: string) => {
    return posts.filter(p => p.boardId === boardId).length;
  };

  const filteredBoards = boards.filter(board => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return board.title.toLowerCase().includes(query) || board.description.toLowerCase().includes(query);
  });

  const sortedBoards = [...filteredBoards].sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title, 'ko', { sensitivity: 'base' });
    }
    return 0;
  });

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Validation: JSON must contain board and posts
        if (!json || !json.board || !json.board.id || !Array.isArray(json.posts)) {
          showToast('올바르지 않은 보드 백업 파일(JSON)입니다.');
          return;
        }

        // Import
        importBoardData(json.board, json.posts);
        showToast(`'${json.board.title}' 보드가 성공적으로 불러오기 되었습니다!`);
        
        // Reset file input value so same file can be uploaded again
        e.target.value = '';
      } catch (err) {
        console.error(err);
        showToast('파일을 읽는 도중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={styles.dashboardViewport}>
      <div style={styles.dashboardContainer}>
        {/* Header */}
        <header id="teacher-dashboard-header" style={styles.header}>
          <div>
            <h1 style={styles.title}>내 크리에이티브 보드 교사용 대시보드</h1>
            <p style={styles.subtitle}>아이디어 수집과 기획 캔버스를 생성하고 관리하는 공간입니다.</p>
          </div>
          <div className="button-container-mobile" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Hidden File Input */}
            <input 
              type="file" 
              id="json-import-input" 
              accept=".json" 
              onChange={handleImportFile} 
              style={{ display: 'none' }}
            />
            <label 
              htmlFor="json-import-input" 
              className="button-premium"
              style={{ cursor: 'pointer' }}
              title="보드 JSON 파일 가져오기 (복원)"
            >
              <Upload size={16} />
              <span>보드 불러오기</span>
            </label>

            <button 
              className="button-premium"
              onClick={() => setIsGuideOpen(true)}
              title="사용 설명서 보기"
            >
              <HelpCircle size={16} />
              <span>설명서</span>
            </button>
            <button 
              className="button-premium" 
              onClick={() => setIsPasswordModalOpen(true)}
              title="비밀번호 변경"
            >
              <Key size={16} />
              <span>암호 변경</span>
            </button>
            <button 
              className="button-premium" 
              onClick={logout}
              title="로그아웃"
            >
              <LogOut size={16} />
              <span>로그아웃</span>
            </button>
            <button 
              className="button-premium active" 
              onClick={() => setIsModalOpen(true)}
              style={styles.createBtn}
            >
              <Plus size={18} />
              <span>새 보드 만들기</span>
            </button>
          </div>
        </header>

        {/* Stats Counter Row */}
        <div className="glass-panel" style={styles.statsPanel}>
          <div style={styles.statItem}>
            <FolderHeart size={20} color="var(--color-primary)" />
            <div>
              <div style={styles.statNum}>{boards.length}개</div>
              <div style={styles.statLabel}>전체 보드</div>
            </div>
          </div>
          <div style={styles.verticalDivider} />
          <div style={styles.statWelcome}>
            <span>✨ 캔버스를 클릭해 아이디어를 구상해보세요. 더블 클릭으로 새 카드를 부착할 수 있습니다.</span>
          </div>
        </div>

        {/* Filter & Search Controls Row */}
        <div style={styles.filterRow}>
          {/* Search Input */}
          <div style={styles.searchContainer}>
            <Search size={16} color="var(--text-muted)" style={styles.searchIcon} />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="보드 검색..."
              style={styles.searchInput}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={styles.searchClearBtn} title="검색어 지우기">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sorting Bar */}
          <div style={styles.sortBar}>
            <span style={styles.sortLabel}>정렬:</span>
            <div style={styles.sortOptions}>
              <button 
                style={{ ...styles.sortTab, ...(sortBy === 'latest' ? styles.sortTabActive : {}) }}
                onClick={() => setSortBy('latest')}
              >
                최신순
              </button>
              <button 
                style={{ ...styles.sortTab, ...(sortBy === 'oldest' ? styles.sortTabActive : {}) }}
                onClick={() => setSortBy('oldest')}
              >
                과거순
              </button>
              <button 
                style={{ ...styles.sortTab, ...(sortBy === 'title' ? styles.sortTabActive : {}) }}
                onClick={() => setSortBy('title')}
              >
                제목순
              </button>
            </div>
          </div>
        </div>

        {/* Boards Grid */}
        <div style={styles.grid}>
          {/* Add Board Placeholder Card */}
          <div 
            className="glass-card add-placeholder-card" 
            style={{ ...styles.boardCard, ...styles.addPlaceholderCard }}
            onClick={() => setIsModalOpen(true)}
          >
            <div style={styles.addPlaceholderIconWrapper}>
              <Plus size={32} color="var(--text-muted)" />
            </div>
            <h3 style={styles.addPlaceholderTitle}>새 보드 만들기</h3>
            <p style={styles.addPlaceholderDesc}>새로운 기획 및 협업 캔버스를 추가합니다.</p>
          </div>

          {sortedBoards.length === 0 && searchQuery ? (
            <div className="glass-card" style={styles.noResultsCard}>
              <Search size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <h3 style={styles.noResultsTitle}>검색 결과가 없습니다</h3>
              <p style={styles.noResultsDesc}>다른 키워드로 검색하거나 입력값을 확인해 주세요.</p>
            </div>
          ) : (
            sortedBoards.map(board => {
            const cardCount = getPostCount(board.id);
            const isPattern = board.wallpaper.startsWith('url');
            
            return (
              <div key={board.id} className="glass-card" style={styles.boardCard}>
                {/* Board Wallpaper Thumbnail Preview */}
                <div 
                  style={{ 
                    ...styles.cardThumbnail,
                    background: board.wallpaper,
                    backgroundSize: isPattern ? 'cover' : 'auto',
                    backgroundPosition: 'center'
                  }}
                  onClick={() => setActiveBoardId(board.id)}
                >
                  <div style={styles.badgeOverlay}>
                    {board.layout === 'canvas' && <span style={styles.layoutBadge}><Move size={10} /> Canvas</span>}
                    {board.layout === 'grid' && <span style={styles.layoutBadge}><LayoutGrid size={10} /> Grid</span>}
                    {board.layout === 'wall' && <span style={styles.layoutBadge}><Columns size={10} /> Wall</span>}
                    {board.layout === 'column' && <span style={styles.layoutBadge}><Kanban size={10} /> Column</span>}
                  </div>
                </div>

                {/* Card Info */}
                <div style={styles.cardInfo} onClick={() => setActiveBoardId(board.id)}>
                  <h3 style={styles.boardTitle}>{board.title}</h3>
                  <p style={styles.boardDesc}>{board.description}</p>
                  
                  <div style={styles.boardMetaRow}>
                    <div style={styles.metaLabelItem}>
                      <Layers size={12} />
                      <span>카드 {cardCount}개</span>
                    </div>
                    <div style={styles.metaLabelItem}>
                      <Calendar size={12} />
                      <span>{new Date(board.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Layout & Actions Footer */}
                <div style={styles.cardFooter}>
                  {/* Quick Layout selectors */}
                  <div style={styles.quickLayoutGroup}>
                    <button
                      onClick={() => updateBoardMeta(board.id, { layout: 'canvas' })}
                      style={{ 
                        ...styles.quickLayoutBtn,
                        color: board.layout === 'canvas' ? 'var(--color-primary)' : 'var(--text-muted)'
                      }}
                      title="Canvas로 빠른 변경"
                    >
                      <Move size={14} />
                    </button>
                    <button
                      onClick={() => updateBoardMeta(board.id, { layout: 'grid' })}
                      style={{ 
                        ...styles.quickLayoutBtn,
                        color: board.layout === 'grid' ? 'var(--color-primary)' : 'var(--text-muted)'
                      }}
                      title="Grid로 빠른 변경"
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      onClick={() => updateBoardMeta(board.id, { layout: 'wall' })}
                      style={{ 
                        ...styles.quickLayoutBtn,
                        color: board.layout === 'wall' ? 'var(--color-primary)' : 'var(--text-muted)'
                      }}
                      title="Wall로 빠른 변경"
                    >
                      <Columns size={14} />
                    </button>
                    <button
                      onClick={() => updateBoardMeta(board.id, { layout: 'column' })}
                      style={{ 
                        ...styles.quickLayoutBtn,
                        color: board.layout === 'column' ? 'var(--color-primary)' : 'var(--text-muted)'
                      }}
                      title="Column으로 빠른 변경"
                    >
                      <Kanban size={14} />
                    </button>
                  </div>

                  <div style={styles.cardFooterActions}>
                    <button 
                      onClick={() => handleCopyShareLink(board.id)} 
                      style={styles.shareBoardBtn}
                      className="share-board-btn"
                      title="공유 링크 복사"
                    >
                      <Share2 size={14} />
                    </button>
                    <button 
                      onClick={() => deleteBoard(board.id)} 
                      style={styles.deleteBoardBtn}
                      className="delete-board-btn"
                      title="보드 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button 
                      onClick={() => setActiveBoardId(board.id)}
                      style={styles.openBoardBtn}
                    >
                      <span>열기</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* PASSWORD CHANGE MODAL */}
      {isPasswordModalOpen && (
        <div style={styles.modalBackdrop}>
          <div className="glass-panel" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2>교사 암호 변경</h2>
              <button onClick={() => { setIsPasswordModalOpen(false); setPasswordError(''); }} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>새 비밀번호</label>
                <input 
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="새 비밀번호 입력"
                  style={styles.formInput}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>비밀번호 확인</label>
                <input 
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="비밀번호 확인 입력"
                  style={styles.formInput}
                  required
                />
              </div>

              {passwordError && (
                <div style={styles.errorText}>
                  {passwordError}
                </div>
              )}

              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => { setIsPasswordModalOpen(false); setPasswordError(''); }} 
                  style={styles.cancelBtn}
                >
                  취소
                </button>
                <button type="submit" className="button-premium active" style={styles.submitBtn}>
                  변경 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div style={styles.toast}>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CREATE BOARD MODAL */}
      {isModalOpen && (
        <div style={styles.modalBackdrop}>
          <div className="glass-panel" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2>새 보드 생성</h2>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBoardSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>보드 제목</label>
                <input 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 마케팅 기획 보드"
                  required
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>보드 설명</label>
                <textarea 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="보드의 기획 목적을 간단히 설명해주세요..."
                  style={{ ...styles.formInput, height: '60px', resize: 'none' }}
                />
              </div>

              {/* Layout Picker */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>기본 레이아웃</label>
                <div style={styles.layoutRadioGroup}>
                  <button
                    type="button"
                    onClick={() => setNewLayout('canvas')}
                    style={{ 
                      ...styles.layoutRadioBtn,
                      border: newLayout === 'canvas' ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.08)',
                      backgroundColor: newLayout === 'canvas' ? 'rgba(129,140,248,0.1)' : 'transparent'
                    }}
                  >
                    <Move size={14} />
                    <span>Canvas (자유 배치)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLayout('grid')}
                    style={{ 
                      ...styles.layoutRadioBtn,
                      border: newLayout === 'grid' ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.08)',
                      backgroundColor: newLayout === 'grid' ? 'rgba(129,140,248,0.1)' : 'transparent'
                    }}
                  >
                    <LayoutGrid size={14} />
                    <span>Grid (바둑판 배열)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLayout('wall')}
                    style={{ 
                      ...styles.layoutRadioBtn,
                      border: newLayout === 'wall' ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.08)',
                      backgroundColor: newLayout === 'wall' ? 'rgba(129,140,248,0.1)' : 'transparent'
                    }}
                  >
                    <Columns size={14} />
                    <span>Wall (벽돌형 배열)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLayout('column')}
                    style={{ 
                      ...styles.layoutRadioBtn,
                      border: newLayout === 'column' ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.08)',
                      backgroundColor: newLayout === 'column' ? 'rgba(129,140,248,0.1)' : 'transparent'
                    }}
                  >
                    <Kanban size={14} />
                    <span>Column (컬럼 배치)</span>
                  </button>
                </div>
              </div>

              {/* Wallpaper Picker */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>보드 배경</label>
                <div style={styles.colorPresetGrid}>
                  {wallpaperPresets.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setSelectedWallpaper(preset.value)}
                      style={{
                        ...styles.colorPresetDot,
                        background: preset.value,
                        border: selectedWallpaper === preset.value ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)'
                      }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>


              <div style={styles.modalActions}>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="button-premium"
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="button-premium active"
                >
                  생성 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    width: '100%',
    margin: '16px 0 0 0',
    flexWrap: 'wrap',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    padding: '6px 12px',
    width: '280px',
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  searchIcon: {
    marginRight: '8px',
    flexShrink: 0,
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '0.825rem',
    width: '100%',
    padding: '2px 18px 2px 0',
  },
  searchClearBtn: {
    position: 'absolute',
    right: '10px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsCard: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
    minHeight: '220px',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  noResultsTitle: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '4px',
  },
  noResultsDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  sortBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    margin: 0,
  },
  sortLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  sortOptions: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '2px',
  },
  sortTab: {
    padding: '4px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.775rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  sortTabActive: {
    background: 'var(--color-primary)',
    color: '#030712',
    fontWeight: 'bold',
  },
  dashboardViewport: {
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    backgroundColor: '#030712',
    padding: '40px 24px',
  },
  dashboardContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '20px',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: '700',
    background: 'linear-gradient(to right, #ffffff, #93c5fd, #c084fc)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  createBtn: {
    padding: '10px 20px',
  },
  statsPanel: {
    padding: '20px 24px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statNum: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  verticalDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statWelcome: {
    flex: 1,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textAlign: 'right',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '24px',
    paddingBottom: '60px',
  },
  boardCard: {
    height: '240px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  cardThumbnail: {
    height: '90px',
    position: 'relative',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  badgeOverlay: {
    position: 'absolute',
    top: '10px',
    left: '10px',
  },
  layoutBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(3px)',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  cardInfo: {
    padding: '16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  boardTitle: {
    fontSize: '0.975rem',
    fontWeight: '600',
    color: '#ffffff',
  },
  boardDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '4px',
    lineHeight: '1.4',
  },
  boardMetaRow: {
    display: 'flex',
    gap: '16px',
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
    marginTop: '8px',
  },
  metaLabelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  cardFooter: {
    padding: '12px 16px',
    background: 'rgba(0,0,0,0.15)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickLayoutGroup: {
    display: 'flex',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '2px',
    gap: '2px',
  },
  quickLayoutBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  deleteBoardBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  openBoardBtn: {
    background: 'var(--color-primary)',
    color: '#030712',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontWeight: 'bold',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  addPlaceholderCard: {
    border: '2px dashed rgba(255,255,255,0.15)',
    background: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: 'none',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  addPlaceholderIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  addPlaceholderTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--text-main)',
  },
  addPlaceholderDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
    maxWidth: '240px',
  },

  /* MODAL */
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalContent: {
    width: '420px',
    padding: '24px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  formInput: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#ffffff',
    padding: '10px',
    fontSize: '0.85rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  layoutRadioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  layoutRadioBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    color: '#ffffff',
    textAlign: 'left',
    fontSize: '0.8rem',
    transition: 'all 0.15s ease',
  },
  colorPresetGrid: {
    display: 'flex',
    gap: '10px',
  },
  colorPresetDot: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
  },
  shareBoardBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-primary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  toast: {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(129, 140, 248, 0.95)',
    color: '#ffffff',
    padding: '10px 24px',
    borderRadius: '30px',
    zIndex: 10000,
    boxShadow: '0 8px 30px rgba(129, 140, 248, 0.35)',
    fontSize: '0.85rem',
    fontWeight: '500',
    backdropFilter: 'blur(8px)',
  },
  errorText: {
    color: '#f87171',
    fontSize: '0.75rem',
    marginTop: '4px',
  },
  cancelBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '8px 16px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  submitBtn: {
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '0.85rem',
  },
  formGroupRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginTop: '6px',
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  checkboxInput: {
    marginTop: '4px',
    cursor: 'pointer',
    width: '16px',
    height: '16px',
    accentColor: 'var(--color-primary)',
  },
  checkboxLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#ffffff',
  },
  checkboxSublabel: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
    lineHeight: '1.3',
  }
};
