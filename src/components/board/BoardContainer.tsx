import React, { useRef, useState } from 'react';
import { useBoardStore, useAuthStore } from '../../store/useBoardStore';
import type { Post } from '../../store/useBoardStore';
import { PostCard } from '../card/PostCard';

interface BoardContainerProps {
  isGuestMode?: boolean;
}

export const BoardContainer: React.FC<BoardContainerProps> = ({ isGuestMode = false }) => {
  const { 
    boards,
    posts, 
    addPost, 
    updatePost,
    deletePost,
    updateBoardMeta,
  } = useBoardStore();

  const {
    activeBoardId,
    panX,
    panY,
    scale,
    setPan,
    setScale
  } = useAuthStore();

  const boardRef = useRef<HTMLDivElement>(null);

  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  // Custom dragging state for cards in Canvas layout
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, cardX: 0, cardY: 0 });
  const [draggedPositions, setDraggedPositions] = useState<{ [postId: string]: { x: number, y: number } }>({});

  const [newColName, setNewColName] = React.useState('');
  const [editingColIdx, setEditingColIdx] = React.useState<number | null>(null);
  const [editingColName, setEditingColName] = React.useState('');
  const [isColumnDragging, setIsColumnDragging] = useState(false);

  // Find active board
  const activeBoard = boards.find(b => b.id === activeBoardId);

  // Sync columns based on board metadata and posts when board changes
  const customColumns = React.useMemo(() => {
    if (!activeBoard) return ['기본 컬럼'];
    const boardCols = activeBoard.columns || ['기본 컬럼'];
    const activeBoardPosts = posts.filter(p => p.boardId === activeBoardId);
    const postCols = activeBoardPosts
      .map(p => p.columnName || '기본 컬럼');
    return Array.from(new Set([...boardCols, ...postCols]));
  }, [activeBoard, posts, activeBoardId]);

  if (!activeBoard) return null;

  // Filter posts belonging to this board, matching guest/admin approval visibility
  const boardPosts = posts.filter(p => p.boardId === activeBoardId);

  // 1. Zoom Center Calculation (Cursor-centered zooming)
  const handleWheel = (e: React.WheelEvent) => {
    if (activeBoard.layout !== 'canvas') return;
    e.preventDefault();

    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Mouse coordinates relative to board element
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom direction
    const zoomIntensity = 0.08;
    const scaleFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    
    const newScale = Math.min(2.0, Math.max(0.25, scale * scaleFactor));
    
    // Zoom math: newPan = cursor - (cursor - oldPan) * (newScale / oldScale)
    const newPanX = mouseX - (mouseX - panX) * (newScale / scale);
    const newPanY = mouseY - (mouseY - panY) * (newScale / scale);

    setScale(parseFloat(newScale.toFixed(2)));
    setPan(Math.round(newPanX), Math.round(newPanY));
  };

  // 2. Infinite Pan (Middle click or Spacebar held, or drag empty background)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag pan on empty space background or canvas workspace div itself
    const isTargetBackground = 
      e.target === e.currentTarget || 
      e.target === boardRef.current || 
      (e.target as HTMLElement).style.width === '5000px';
      
    if (!isTargetBackground) return;
    
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffset.current = { x: panX, y: panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan(panOffset.current.x + dx, panOffset.current.y + dy);
    } else if (activeDragId) {
      // Scale coordinates: delta is divided by scale factor to follow cursor perfectly
      const dx = (e.clientX - dragStart.current.mouseX) / scale;
      const dy = (e.clientY - dragStart.current.mouseY) / scale;
      
      const newX = Math.round(dragStart.current.cardX + dx);
      const newY = Math.round(dragStart.current.cardY + dy);
      
      setDraggedPositions(prev => ({
        ...prev,
        [activeDragId]: { x: newX, y: newY }
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (activeDragId) {
      const finalPos = draggedPositions[activeDragId];
      if (finalPos) {
        updatePost(activeDragId, {
          positionX: finalPos.x,
          positionY: finalPos.y
        });
      }
      setActiveDragId(null);
    }
  };

  // Mobile Touch Pan handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeBoard.layout !== 'canvas') return;
    // Only drag pan on empty space background or canvas workspace div itself
    const isTargetBackground = 
      e.target === e.currentTarget || 
      e.target === boardRef.current || 
      (e.target as HTMLElement).style.width === '5000px';

    if (!isTargetBackground) return;

    if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panOffset.current = { x: panX, y: panY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPanning && e.touches.length === 1) {
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setPan(panOffset.current.x + dx, panOffset.current.y + dy);
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  // 3. Double click to add card (converts screen coords to canvas coords)
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isGuestMode) return;
    if (e.target !== e.currentTarget && e.target !== boardRef.current) return;

    const colors = [
      'var(--card-indigo)',
      'var(--card-emerald)',
      'var(--card-peach)',
      'var(--card-sky)',
      'var(--card-rose)',
      'var(--card-amber)'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    let posX = 100;
    let posY = 100;

    if (activeBoard.layout === 'canvas') {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        // Reverse translate & scale: canvasCoords = (screenCoords - pan) / scale
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        posX = Math.round((mouseX - panX) / scale - 150);
        posY = Math.round((mouseY - panY) / scale - 80);
        
        // Avoid overlap
        const cardWidth = 320;
        const cardHeight = 240;
        let overlapFound = true;
        let attempts = 0;
        
        while (overlapFound && attempts < 50) {
          overlapFound = false;
          for (const post of boardPosts) {
            const distanceX = Math.abs(post.positionX - posX);
            const distanceY = Math.abs(post.positionY - posY);
            if (distanceX < cardWidth - 20 && distanceY < cardHeight - 20) {
              overlapFound = true;
              posX += 40;
              posY += 40;
              break;
            }
          }
          attempts++;
        }
      }
    }

    addPost(activeBoard.id, {
      title: '',
      content: '',
      attachmentType: 'none',
      color: randomColor,
      positionX: posX,
      positionY: posY
    });
  };

  // 4. Custom Drag Handler passed to PostCards
  const startDragCard = (postId: string, clientX: number, clientY: number, currentX: number, currentY: number) => {
    if (activeBoard.layout !== 'canvas') return;
    setActiveDragId(postId);
    
    // Lift card z-index on click/drag
    const maxZ = boardPosts.reduce((max, p) => Math.max(max, p.zIndex), 0);
    updatePost(postId, { zIndex: maxZ + 1 });

    dragStart.current = {
      mouseX: clientX,
      mouseY: clientY,
      cardX: currentX,
      cardY: currentY
    };

    setDraggedPositions(prev => ({
      ...prev,
      [postId]: { x: currentX, y: currentY }
    }));
  };

  // 5. Masonry Column Calculator (Wall layout)
  const renderWallLayout = () => {
    const columns: Post[][] = [[], [], [], [], [], []]; // 6 columns for wall
    boardPosts.forEach((post) => {
      // Calculate column heights (longer content = taller card representation)
      const colHeights = columns.map(col => 
        col.reduce((sum, p) => sum + (p.content.length > 150 ? 320 : 220) + (p.attachmentUrl ? 180 : 0), 0)
      );
      const shortestColIdx = colHeights.indexOf(Math.min(...colHeights));
      columns[shortestColIdx].push(post);
    });

    return (
      <div className="wall-layout-container" style={styles.wallGrid}>
        {columns.map((col, colIdx) => (
          <div key={colIdx} style={styles.wallColumn}>
            {col.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                layoutMode="wall"
                isGuestMode={isGuestMode}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    if (customColumns.includes(newColName.trim())) {
      window.alert('이미 존재하는 컬럼 이름입니다.');
      return;
    }
    const updatedCols = [...(activeBoard.columns || ['기본 컬럼']), newColName.trim()];
    updateBoardMeta(activeBoard.id, { columns: updatedCols });
    setNewColName('');
  };

  const handleDeleteColumn = (colName: string) => {
    if (window.confirm(`'${colName}' 컬럼과 컬럼 안의 모든 카드를 삭제하시겠습니까?`)) {
      const toDelete = posts.filter(p => p.boardId === activeBoardId && (p.columnName || '기본 컬럼') === colName);
      toDelete.forEach(p => deletePost(p.id));
      const updatedCols = (activeBoard.columns || ['기본 컬럼']).filter(c => c !== colName);
      updateBoardMeta(activeBoard.id, { columns: updatedCols });
    }
  };

  const handleRenameColumnSubmit = (idx: number) => {
    const oldName = customColumns[idx];
    const newName = editingColName.trim();
    if (!newName) return;
    if (oldName === newName) {
      setEditingColIdx(null);
      return;
    }
    
    posts.forEach(p => {
      if (p.boardId === activeBoardId && (p.columnName || '기본 컬럼') === oldName) {
        updatePost(p.id, { columnName: newName });
      }
    });

    const updatedCols = (activeBoard.columns || ['기본 컬럼']).map((c, i) => i === idx ? newName : c);
    updateBoardMeta(activeBoard.id, { columns: updatedCols });
    setEditingColIdx(null);
  };

  const renderColumnLayout = () => {
    return (
      <div className="column-view-wrapper" style={styles.columnViewWrapper}>
        <div className="column-layout-container" style={styles.columnContainer}>
          {customColumns.map((colName, idx) => {
            const colPosts = boardPosts.filter(p => (p.columnName || '기본 컬럼') === colName);
            return (
              <div 
                key={colName} 
                className="column-card-box"
                style={styles.columnCard}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const postId = e.dataTransfer.getData('text/plain');
                  if (postId) {
                    const targetPost = posts.find(p => p.id === postId);
                    if (targetPost) {
                      // Check permissions: if guest mode, they can only move their own guest posts
                      if (isGuestMode && !targetPost.isGuestPost) return;
                      updatePost(postId, { columnName: colName });
                    }
                  }
                }}
              >
                {/* Column Header */}
                <div style={styles.columnHeader}>
                  {editingColIdx === idx && !isGuestMode ? (
                    <input 
                      value={editingColName}
                      onChange={(e) => setEditingColName(e.target.value)}
                      onBlur={() => handleRenameColumnSubmit(idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameColumnSubmit(idx);
                        if (e.key === 'Escape') setEditingColIdx(null);
                      }}
                      style={styles.columnRenameInput}
                      autoFocus
                    />
                  ) : (
                    <span 
                      onDoubleClick={() => {
                        if (!isGuestMode) {
                          setEditingColIdx(idx);
                          setEditingColName(colName);
                        }
                      }}
                      style={styles.columnTitle}
                      title={!isGuestMode ? "더블클릭하여 편집" : undefined}
                    >
                      {colName} <span style={styles.columnPostCount}>{colPosts.length}</span>
                    </span>
                  )}

                  {!isGuestMode && (
                    <button 
                      onClick={() => handleDeleteColumn(colName)}
                      style={styles.deleteColBtn}
                      title="컬럼 삭제"
                    >
                      <span style={{ fontSize: '10px', fontWeight: 'bold' }}>X</span>
                    </button>
                  )}
                </div>

                {/* Add Card Button for this Column (Moved to Top) */}
                <div style={{ padding: '0 12px 10px 12px' }}>
                  <button 
                    onClick={() => {
                      addPost(activeBoard.id, {
                        title: '',
                        content: '',
                        attachmentType: 'none',
                        color: 'var(--card-indigo)',
                        positionX: 0,
                        positionY: 0,
                        columnName: colName,
                        author: isGuestMode ? '' : '관리자',
                        password: isGuestMode ? '' : undefined,
                        isApproved: true,
                        isGuestPost: isGuestMode,
                        isDraft: true
                      });
                    }}
                    style={styles.addCardColBtn}
                  >
                    + 카드 추가
                  </button>
                </div>

                {/* Cards List */}
                <div 
                  style={{
                    ...styles.columnCardList,
                    outline: 'none',
                    transition: 'background 0.2s ease',
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    // Optional visual hint: can add a class or temporary background color
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const postId = e.dataTransfer.getData('text/plain');
                    if (postId) {
                      const targetPost = posts.find(p => p.id === postId);
                      if (targetPost) {
                        if (isGuestMode && !targetPost.isGuestPost) return;
                        // Move to this column and place at the end
                        const maxPosY = colPosts.reduce((max, p) => Math.max(max, p.positionY), 0);
                        updatePost(postId, { columnName: colName, positionY: maxPosY + 10 });
                      }
                    }
                  }}
                >
                  {colPosts
                    .sort((a, b) => a.positionY - b.positionY)
                    .map((post) => (
                      <div
                        key={post.id}
                        draggable={!isGuestMode || post.isGuestPost}
                        onDragStartCapture={(e: React.DragEvent) => {
                          e.dataTransfer.setData('text/plain', post.id);
                          setIsColumnDragging(true);
                        }}
                        onDragEndCapture={() => {
                          setIsColumnDragging(false);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const el = e.currentTarget as HTMLDivElement;
                          const rect = el.getBoundingClientRect();
                          const relativeY = e.clientY - rect.top;
                          const isUpperHalf = relativeY < rect.height / 2;

                          if (isUpperHalf) {
                            el.style.borderTop = '2px solid var(--color-primary)';
                            el.style.borderBottom = 'none';
                            el.style.paddingTop = '6px';
                            el.style.paddingBottom = '0px';
                            el.setAttribute('data-drop-pos', 'before');
                          } else {
                            el.style.borderTop = 'none';
                            el.style.borderBottom = '2px solid var(--color-primary)';
                            el.style.paddingTop = '0px';
                            el.style.paddingBottom = '6px';
                            el.setAttribute('data-drop-pos', 'after');
                          }
                        }}
                        onDragLeave={(e) => {
                          const el = e.currentTarget as HTMLDivElement;
                          el.style.borderTop = 'none';
                          el.style.borderBottom = 'none';
                          el.style.paddingTop = '0px';
                          el.style.paddingBottom = '0px';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsColumnDragging(false);
                          const el = e.currentTarget as HTMLDivElement;
                          const dropPos = el.getAttribute('data-drop-pos') || 'before';
                          el.style.borderTop = 'none';
                          el.style.borderBottom = 'none';
                          el.style.paddingTop = '0px';
                          el.style.paddingBottom = '0px';

                          const draggedId = e.dataTransfer.getData('text/plain');
                          if (draggedId && draggedId !== post.id) {
                            const draggedPost = posts.find(p => p.id === draggedId);
                            if (draggedPost) {
                              if (isGuestMode && !draggedPost.isGuestPost) return;

                              // Get other posts in this target column (excluding dragged post)
                              const otherPosts = colPosts
                                .filter(p => p.id !== draggedId)
                                .sort((a, b) => a.positionY - b.positionY);
                              
                              // Find target drop index
                              const targetIndex = otherPosts.findIndex(p => p.id === post.id);
                              
                              // Insert dragged post at targetIndex (before or after based on pointer position)
                              const reordered = [...otherPosts];
                              if (targetIndex !== -1) {
                                const insertIdx = dropPos === 'before' ? targetIndex : targetIndex + 1;
                                reordered.splice(insertIdx, 0, { ...draggedPost, columnName: colName });
                              } else {
                                reordered.push({ ...draggedPost, columnName: colName });
                              }

                              // Update all column posts with clean normalized positionY (index * 10)
                              reordered.forEach((p, idx) => {
                                updatePost(p.id, {
                                  columnName: colName,
                                  positionY: idx * 10
                                });
                              });
                            }
                          }
                        }}
                        style={{
                          transition: 'all 0.2s ease',
                          borderTop: 'none',
                        }}
                      >
                        <PostCard 
                          post={post} 
                          layoutMode="column"
                          isGuestMode={isGuestMode}
                          isAnyCardDragging={isColumnDragging}
                        />
                      </div>
                    ))}
                </div>
              </div>
            );
          })}

          {/* Add Column Box */}
          {!isGuestMode && (
            <div style={styles.addColumnBox}>
              <form onSubmit={handleAddColumn} style={styles.addColumnForm}>
                <input 
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="새 컬럼 추가..."
                  style={styles.addColumnInput}
                />
                <button type="submit" style={styles.addColumnBtn}>
                  추가
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={boardRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      style={{ 
        ...styles.boardViewport, 
        background: activeBoard.wallpaper,
        backgroundSize: activeBoard.wallpaper.startsWith('url') ? 'cover' : 'auto',
        backgroundPosition: 'center',
        cursor: isPanning ? 'grabbing' : 'default',
        padding: activeBoard.layout === 'column' ? '0' : '30px'
      }}
    >
      {/* Grid Mode Rendering */}
      {activeBoard.layout === 'grid' && (
        <div className="grid-layout-container" style={styles.gridContainer}>
          {boardPosts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              layoutMode="grid"
              isGuestMode={isGuestMode}
            />
          ))}
        </div>
      )}

      {/* Wall Mode Rendering */}
      {activeBoard.layout === 'wall' && renderWallLayout()}

      {/* Canvas Mode Workspace */}
      {activeBoard.layout === 'canvas' && (
        <div 
          style={{
            ...styles.canvasCanvas,
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          }}
        >
          {boardPosts.map(post => {
            const tempPos = draggedPositions[post.id];
            const posX = tempPos ? tempPos.x : post.positionX;
            const posY = tempPos ? tempPos.y : post.positionY;
            return (
              <PostCard 
                key={post.id} 
                post={{ ...post, positionX: posX, positionY: posY }} 
                layoutMode="canvas"
                onStartDrag={startDragCard}
                isGuestMode={isGuestMode}
              />
            );
          })}
        </div>
      )}

      {/* Column Mode Rendering */}
      {activeBoard.layout === 'column' && renderColumnLayout()}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  boardViewport: {
    position: 'absolute',
    top: '76px', // Header offset
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    padding: '30px',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '24px',
    width: '100%',
    maxWidth: '1800px',
    overflowY: 'auto',
    paddingBottom: '40px',
    height: 'fit-content',
    maxHeight: '100%',
  },
  wallGrid: {
    display: 'flex',
    gap: '24px',
    width: '100%',
    maxWidth: '1800px',
    overflowY: 'auto',
    paddingBottom: '40px',
    height: '100%',
  },
  wallColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    height: 'fit-content',
  },
  canvasCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '5000px',
    height: '5000px',
    transformOrigin: '0 0',
  },
  columnViewWrapper: {
    width: '100%',
    height: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: '0px',
  },
  columnContainer: {
    display: 'flex',
    gap: '20px',
    height: '100%',
    padding: '16px 16px 0px 16px',
    alignItems: 'stretch',
  },
  columnCard: {
    width: '280px',
    minWidth: '280px',
    backgroundColor: 'var(--bg-column)',
    border: '1px solid var(--border-column)',
    borderBottom: 'none',
    borderRadius: '16px 16px 0px 0px',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  columnHeader: {
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-card-base)',
  },
  columnTitle: {
    fontSize: '0.875rem',
    fontWeight: 'bold',
    color: 'var(--text-main)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  columnPostCount: {
    fontSize: '0.725rem',
    background: 'rgba(128,128,128,0.1)',
    padding: '2px 6px',
    borderRadius: '8px',
    color: 'var(--text-muted)',
  },
  columnRenameInput: {
    background: 'rgba(0,0,0,0.1)',
    border: '1px solid var(--color-primary)',
    borderRadius: '6px',
    color: 'var(--text-main)',
    fontSize: '0.875rem',
    padding: '2px 6px',
    outline: 'none',
    width: '180px',
  },
  deleteColBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    padding: '2px',
    transition: 'all 0.15s ease',
  },
  columnCardList: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    flex: 1,
  },
  addCardColBtn: {
    width: '100%',
    padding: '8px',
    background: 'rgba(128, 128, 128, 0.05)',
    border: '1px dashed var(--border-card-base)',
    borderRadius: '10px',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  addColumnBox: {
    width: '280px',
    minWidth: '280px',
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    border: '1px dashed var(--border-card-base)',
    borderRadius: '16px',
    padding: '12px',
    alignSelf: 'flex-start',
  },
  addColumnForm: {
    display: 'flex',
    gap: '8px',
  },
  addColumnInput: {
    flex: 1,
    background: 'rgba(128,128,128,0.1)',
    border: '1px solid var(--border-card-base)',
    borderRadius: '8px',
    color: 'var(--text-main)',
    fontSize: '0.8rem',
    padding: '6px 10px',
    outline: 'none',
  },
  addColumnBtn: {
    background: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  }
};
