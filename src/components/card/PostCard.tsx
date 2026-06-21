import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useBoardStore } from '../../store/useBoardStore';
import type { Post, Reactions } from '../../store/useBoardStore';
import { LinkPreview } from './LinkPreview';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  MessageSquare, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Heart, 
  ThumbsUp, 
  Sparkles, 
  Smile, 
  CornerDownLeft,
  X
} from 'lucide-react';

interface PostCardProps {
  post: Post;
  layoutMode: 'grid' | 'wall' | 'canvas' | 'column';
  onStartDrag?: (postId: string, clientX: number, clientY: number, currentX: number, currentY: number) => void;
  isGuestMode?: boolean;
  isAnyCardDragging?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({ post, layoutMode, onStartDrag, isGuestMode = false, isAnyCardDragging = false }) => {
  const { 
    updatePost, 
    deletePost, 
    addComment, 
    deleteComment,
    addReaction,
  } = useBoardStore();

  const [isEditing, setIsEditing] = useState(post.isDraft || false);
  const [showComments, setShowComments] = useState(false);

  React.useEffect(() => {
    if (post.isDraft) {
      setIsEditing(true);
    } else if (post.isDraft === false && !post.isApproved) {
      setIsEditing(false);
    }
  }, [post.isDraft, post.isApproved]);

  // Edit fields
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [attachUrl, setAttachUrl] = useState(post.attachmentUrl || '');
  const [attachType, setAttachType] = useState(post.attachmentType);
  const [cardBg, setCardBg] = useState(post.color);
  const [authorState, setAuthorState] = useState(post.author);
  const [passwordState, setPasswordState] = useState(post.password || '');

  // Comment input
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');

  // Password verification states
  const [passwordAction, setPasswordAction] = useState<'edit' | 'delete' | null>(null);
  const [passwordVerificationInput, setPasswordVerificationInput] = useState('');


  const [isDragging, setIsDragging] = useState(false);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (layoutMode !== 'canvas' || isEditing) return;
    if (e.button !== 0) return;
    
    // 게스트 모드인 경우, 자신이 작성한 글(post.isGuestPost)만 옮길 수 있게 보장
    if (isGuestMode && !post.isGuestPost) return;
    
    e.preventDefault();
    if (onStartDrag) {
      onStartDrag(post.id, e.clientX, e.clientY, post.positionX, post.positionY);
    }
  };

  const handleCancel = () => {
    if (post.isDraft) {
      deletePost(post.id);
    } else {
      setIsEditing(false);
      setTitle(post.title);
      setContent(post.content);
      setAttachUrl(post.attachmentUrl || '');
      setAttachType(post.attachmentType);
      setCardBg(post.color);
      setAuthorState(post.author);
      setPasswordState(post.password || '');
    }
  };

  const handleSave = () => {
    if (isGuestMode || post.isGuestPost) {
      if (!authorState.trim()) {
        window.alert('작성자 이름을 입력해주세요.');
        return;
      }
      if (!passwordState.trim()) {
        window.alert('수정 및 삭제를 위해 비밀번호를 입력해주세요.');
        return;
      }
    }
    
    updatePost(post.id, {
      title: title.trim() || '제목 없음',
      content: content.trim() || '내용 없음',
      attachmentUrl: attachUrl,
      attachmentType: attachType,
      color: cardBg,
      author: authorState.trim(),
      password: passwordState,
      isDraft: false
    });
    
    setIsEditing(false);
  };


  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const authorName = commentAuthor.trim() || (isGuestMode ? '익명 방문자' : '관리자');
    addComment(post.id, authorName, commentText.trim());
    setCommentText('');
    setCommentAuthor('');
  };

  const handleVerifyPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordVerificationInput === post.password) {
      const action = passwordAction;
      setPasswordAction(null);
      setPasswordVerificationInput('');
      
      if (action === 'edit') {
        setIsEditing(true);
      } else if (action === 'delete') {
        deletePost(post.id);
      }
    } else {
      window.alert('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleEditClick = () => {
    if (isGuestMode && post.isGuestPost) {
      if (!post.password) {
        setIsEditing(true);
      } else {
        setPasswordAction('edit');
        setPasswordVerificationInput('');
      }
    } else {
      setIsEditing(true);
    }
  };

  const handleReactionClick = (type: keyof Reactions) => {
    addReaction(post.id, type);
  };

  const handleDeleteClick = () => {
    if (isGuestMode && post.isGuestPost) {
      if (!post.password) {
        deletePost(post.id);
      } else {
        setPasswordAction('delete');
        setPasswordVerificationInput('');
      }
    } else {
      if (window.confirm('이 카드를 정말로 삭제하시겠습니까?')) {
        deletePost(post.id);
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isGuestMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('a')) {
      return;
    }
    setIsEditing(true);
  };

  // Curated premium HSL presets
  const colorPresets = [
    { name: 'Indigo', value: 'var(--card-indigo)' },
    { name: 'Emerald', value: 'var(--card-emerald)' },
    { name: 'Peach', value: 'var(--card-peach)' },
    { name: 'Sky Blue', value: 'var(--card-sky)' },
    { name: 'Rose', value: 'var(--card-rose)' },
    { name: 'Amber Gold', value: 'var(--card-amber)' },
    { name: 'Violet', value: 'var(--card-violet)' },
    { name: 'Mint', value: 'var(--card-mint)' }
  ];

  // Canvas card styles
  const cardStyle: React.CSSProperties = layoutMode === 'canvas' 
    ? {
        position: 'absolute',
        left: `${post.positionX}px`,
        top: `${post.positionY}px`,
        zIndex: post.zIndex,
        width: '300px',
        backgroundColor: cardBg,
        border: isEditing 
          ? '1px solid var(--color-primary)' 
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isEditing 
          ? '0 12px 30px rgba(129, 140, 248, 0.2)' 
          : '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        transition: 'border 0.3s ease, box-shadow 0.3s ease',
      }
    : {
        width: '100%',
        flexShrink: 0,
        backgroundColor: cardBg,
        border: isEditing 
          ? '1px solid var(--color-primary)' 
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isEditing 
          ? '0 12px 30px rgba(129, 140, 248, 0.2)' 
          : 'none',
        transition: 'border 0.3s ease, box-shadow 0.3s ease',
      };

  const renderEditorContent = () => (
    <div style={styles.editorContainer}>
      <div style={{ height: '6px', backgroundColor: cardBg, margin: '-24px -20px 16px -20px', borderRadius: '16px 16px 0 0' }} />
      <div style={{ ...styles.editorHeader, cursor: 'grab' }}>
        <span style={styles.editorTitle}>{post.isDraft ? '새 카드 작성' : '카드 수정'}</span>
        <button onClick={handleCancel} style={styles.closeEditorBtn}>
          <X size={14} />
        </button>
      </div>

      <div style={styles.fieldGroup}>
        {(isGuestMode || post.isGuestPost) && (
          <div style={styles.guestFieldsRow}>
            <input 
              value={authorState}
              onChange={(e) => setAuthorState(e.target.value)}
              placeholder="이름"
              style={{ ...styles.editInput, flex: '1 1 0px', minWidth: '0', marginBottom: '6px' }}
            />
            <input 
              type="password"
              value={passwordState}
              onChange={(e) => setPasswordState(e.target.value)}
              placeholder="비밀번호"
              style={{ ...styles.editInput, flex: '1 1 0px', minWidth: '0', marginBottom: '6px' }}
            />
          </div>
        )}
        <input 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          style={styles.editInput}
          autoFocus
        />
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 적어주세요..."
          style={{ ...styles.editInput, height: '120px', resize: 'none' }}
        />
      </div>

      {/* Media Attachments Picker */}
      <div style={styles.attachmentSection}>
        <span style={styles.sectionLabel}>첨부 파일 추가</span>
        <div style={styles.attachmentTypes}>
          <button 
            type="button"
            onClick={() => {
              setAttachType('none');
              setAttachUrl('');
            }}
            style={{ ...styles.attachTypeBtn, background: attachType === 'none' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          >
            없음
          </button>
          <button 
            type="button"
            onClick={() => {
              setAttachType('link');
              setAttachUrl('');
            }}
            style={{ 
              ...styles.attachTypeBtn, 
              background: attachType === 'link' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: attachType === 'link' ? 'var(--color-accent)' : 'inherit' 
            }}
          >
            <LinkIcon size={12} /> 링크 주소
          </button>
          <button 
            type="button"
            onClick={() => {
              setAttachType('file');
              setAttachUrl('');
            }}
            style={{ 
              ...styles.attachTypeBtn, 
              background: attachType === 'file' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: attachType === 'file' ? 'var(--color-primary)' : 'inherit'
            }}
          >
            <ImageIcon size={12} /> 파일 업로드
          </button>
        </div>
        {attachType === 'link' && (
          <input 
            value={attachUrl}
            onChange={(e) => setAttachUrl(e.target.value)}
            placeholder="링크 URL을 붙여넣으세요 (예: google.com)..."
            style={styles.attachmentInput}
          />
        )}
        {attachType === 'file' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64String = reader.result as string;
                    // base64String will contain data:image/...;base64,... or similar.
                    setAttachUrl(base64String);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              style={styles.attachmentInput}
            />
            {attachUrl && attachUrl.startsWith('data:') && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {attachUrl.startsWith('data:image/') ? (
                  <div style={{ marginTop: '4px' }}>
                    <p style={{ marginBottom: '4px' }}>업로드된 이미지 미리보기:</p>
                    <img 
                      src={attachUrl} 
                      alt="Uploaded preview" 
                      style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '6px', objectFit: 'contain' }} 
                    />
                  </div>
                ) : (
                  <span>파일이 업로드되었습니다. ({attachUrl.split(';')[0]})</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Color Presets */}
      <div style={styles.colorPresetsSection}>
        <span style={styles.sectionLabel}>카드 배경색</span>
        <div style={styles.colorGrid}>
          {colorPresets.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setCardBg(preset.value)}
              style={{
                ...styles.colorDot,
                backgroundColor: preset.value,
                border: cardBg === preset.value ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)'
              }}
              title={preset.name}
            />
          ))}
        </div>
      </div>

      <div style={styles.editorActions}>
        <button onClick={handleDeleteClick} style={styles.deleteBtn}>
          <Trash2 size={14} />
          <span>삭제</span>
        </button>
        <button onClick={handleSave} style={styles.saveBtn}>
          저장
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isEditing && typeof document !== 'undefined' && createPortal(
        <div style={styles.modalBackdrop}>
          <motion.div 
            drag
            dragMomentum={false}
            style={{ ...styles.card, ...styles.editorModalContent, backgroundColor: 'var(--bg-card-solid)' }}
          >
            {renderEditorContent()}
          </motion.div>
        </div>,
        document.body
      )}

      <motion.div 
        id={post.id}
        layout={layoutMode !== 'canvas'} 
        className="glass-card"
        draggable={layoutMode === 'column' && (!isGuestMode || post.isGuestPost)}
        onDragStartCapture={(e: React.DragEvent) => {
          if (layoutMode === 'column') {
            e.dataTransfer.setData('text/plain', post.id);
            setIsDragging(true);
          }
        }}
        onDragEnd={() => {
          setIsDragging(false);
        }}
        style={{ 
          ...styles.card, 
          ...cardStyle, 
          display: isEditing ? 'none' : styles.card.display,
          cursor: isDragging 
            ? 'grabbing' 
            : (layoutMode === 'column' && (!isGuestMode || post.isGuestPost) ? 'grab' : styles.card.cursor)
        }}
        onDoubleClick={handleDoubleClick}
        whileHover={layoutMode === 'canvas' ? { scale: 1.015 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* PASSWORD VERIFICATION OVERLAY */}
        {passwordAction && (
        <div style={styles.passwordOverlay}>
          <span style={styles.passwordOverlayTitle}>비밀번호 확인</span>
          <p style={styles.passwordOverlayDesc}>
            이 카드를 {passwordAction === 'edit' ? '수정' : '삭제'}하려면 설정한 비밀번호를 입력하세요.
          </p>
          <form onSubmit={handleVerifyPasswordSubmit} style={styles.passwordForm}>
            <input 
              type="password"
              value={passwordVerificationInput}
              onChange={(e) => setPasswordVerificationInput(e.target.value)}
              placeholder="비밀번호"
              style={styles.passwordInput}
              autoFocus
            />
            <div style={styles.passwordOverlayActions}>
              <button 
                type="button" 
                onClick={() => setPasswordAction(null)} 
                style={styles.passwordCancelBtn}
              >
                취소
              </button>
              <button type="submit" style={styles.passwordConfirmBtn}>
                확인
              </button>
            </div>
          </form>
        </div>
      )}

      {false ? null : (
        /* VIEW MODE UI */
        <>
          {/* Header Drag Handle */}
          <div 
            onMouseDown={handleHeaderMouseDown}
            style={{ 
              ...styles.cardHeader,
              cursor: (layoutMode === 'canvas' || layoutMode === 'column') && (!isGuestMode || post.isGuestPost) ? 'grab' : 'default'
            }}
          >
            <h3 style={styles.cardTitle}>{post.title}</h3>
            <div style={styles.headerActions}>
              {(!isGuestMode || post.isGuestPost) && !(isDragging || (layoutMode === 'column' && isAnyCardDragging)) && (
                <>
                  <button 
                    onClick={handleEditClick} 
                    style={styles.cardHeaderBtn}
                    title="카드 편집"
                  >
                    <ImageIcon size={12} />
                  </button>
                  <button 
                    onClick={handleDeleteClick} 
                    style={{ ...styles.cardHeaderBtn, color: '#f87171' }}
                    title="카드 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Attachment rendering */}
          {!(isDragging || (layoutMode === 'column' && isAnyCardDragging)) && (post.attachmentType === 'image' || post.attachmentType === 'file') && post.attachmentUrl && (
            <div style={styles.attachmentWrapper}>
              {post.attachmentUrl.startsWith('data:image/') || post.attachmentType === 'image' ? (
                <img 
                  src={post.attachmentUrl} 
                  alt={post.title} 
                  style={styles.attachmentImage}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=350&q=80';
                  }}
                />
              ) : (
                <div style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.8rem'
                }}>
                  <ImageIcon size={20} style={{ color: 'var(--color-primary)' }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      첨부파일
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {post.attachmentUrl.startsWith('data:') ? post.attachmentUrl.split(';')[0].replace('data:', '') : '다운로드 가능 파일'}
                    </div>
                  </div>
                  <a 
                    href={post.attachmentUrl} 
                    download={`attachment_${post.id}`}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--color-primary)',
                      color: '#030712',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontWeight: 'bold',
                      fontSize: '0.75rem'
                    }}
                  >
                    다운로드
                  </a>
                </div>
              )}
            </div>
          )}

          {!(isDragging || (layoutMode === 'column' && isAnyCardDragging)) && post.attachmentType === 'link' && post.attachmentUrl && (
            <div style={styles.attachmentWrapper}>
              <LinkPreview url={post.attachmentUrl} />
            </div>
          )}

          {/* Content Body */}
          {!(isDragging || (layoutMode === 'column' && isAnyCardDragging)) && (
            <div style={styles.cardBody}>
              <div style={styles.authorRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={styles.authorBadge}>{post.author || '익명'}</span>
                </div>
                <span style={styles.timestamp}>
                  {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p style={styles.cardContent}>{post.content}</p>
              
              {/* Auto Link Preview in Content */}
              {(() => {
                // If there's already an explicit attachment url, we skip duplicate inline parsing
                if (post.attachmentUrl) return null;

                // Simple URL Regex to match standard hyperlinks (http, https, www, or typical domains)
                const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|[a-zA-Z0-9.-]+\.(?:com|net|org|kr|io|gov)\b)/gi;
                const matches = post.content.match(urlRegex);
                if (matches && matches.length > 0) {
                  let foundUrl = matches[0];
                  // Normalize if it's just www. or a raw domain
                  if (!foundUrl.startsWith('http://') && !foundUrl.startsWith('https://')) {
                    foundUrl = 'https://' + foundUrl;
                  }
                  return (
                    <div style={{ marginTop: '10px' }}>
                      <LinkPreview url={foundUrl} />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Footer Interactions */}
          {!(isDragging || (layoutMode === 'column' && isAnyCardDragging)) && (
            <>
              <div style={styles.cardFooter}>
                <div style={styles.reactionContainer}>
                  <button 
                    onClick={() => handleReactionClick('like')} 
                    style={styles.reactionBtn}
                    title="좋아요"
                  >
                    <ThumbsUp size={12} />
                    <span>{post.reactions.like}</span>
                  </button>
                  <button 
                    onClick={() => handleReactionClick('love')} 
                    style={styles.reactionBtn}
                    title="하트"
                  >
                    <Heart size={12} style={{ fill: post.reactions.love > 0 ? '#f43f5e' : 'none', color: post.reactions.love > 0 ? '#f43f5e' : 'inherit' }} />
                    <span>{post.reactions.love}</span>
                  </button>
                  <button 
                    onClick={() => handleReactionClick('clap')} 
                    style={styles.reactionBtn}
                    title="박수"
                  >
                    <Smile size={12} />
                    <span>{post.reactions.clap}</span>
                  </button>
                  <button 
                    onClick={() => handleReactionClick('fire')} 
                    style={styles.reactionBtn}
                    title="최고"
                  >
                    <Sparkles size={12} />
                    <span>{post.reactions.fire}</span>
                  </button>
                </div>

                <button 
                  onClick={() => setShowComments(!showComments)} 
                  style={{
                    ...styles.commentToggleBtn,
                    color: showComments ? 'var(--color-primary)' : 'var(--text-muted)'
                  }}
                >
                  <MessageSquare size={13} />
                  <span>{post.comments.length}</span>
                </button>
              </div>

              {/* Comments Panel */}
              <AnimatePresence>
                {showComments && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={styles.commentsPanel}
                  >
                    {/* List of comments */}
                    <div style={styles.commentsList}>
                      {post.comments.length === 0 ? (
                        <p style={styles.noCommentsText}>댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                      ) : (
                        post.comments.map(c => (
                          <div key={c.id} style={styles.commentItem}>
                            <div style={styles.commentHeader}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={styles.commentAuthor}>{c.author}</span>
                                {(!isGuestMode || post.isGuestPost) && (
                                  <button 
                                    onClick={() => {
                                      if (window.confirm('이 댓글을 삭제하시겠습니까?')) {
                                        deleteComment(post.id, c.id);
                                      }
                                    }}
                                    style={styles.commentDeleteBtn}
                                    title="댓글 삭제"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                              <span style={styles.commentTime}>
                                {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={styles.commentTextContent}>{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment Input */}
                    <form onSubmit={handleCommentSubmit} style={styles.commentForm}>
                      {isGuestMode && (
                        <input 
                          value={commentAuthor}
                          onChange={(e) => setCommentAuthor(e.target.value)}
                          placeholder="이름"
                          style={styles.commentAuthorInput}
                        />
                      )}
                      <input 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="댓글 추가..."
                        style={styles.commentInput}
                      />
                      <button type="submit" style={styles.commentSubmitBtn}>
                        <CornerDownLeft size={12} />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

        </>
        )}
      </motion.div>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  cardHeader: {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-card-base)',
  },
  cardTitle: {
    fontSize: '0.925rem',
    fontWeight: '600',
    color: 'var(--text-main)',
    marginRight: '8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  cardHeaderBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  },
  attachmentWrapper: {
    width: '100%',
    padding: '0 16px',
    marginTop: '12px',
  },
  attachmentImage: {
    width: '100%',
    height: '140px',
    objectFit: 'cover',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  cardBody: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardContent: {
    fontSize: '0.875rem',
    color: 'var(--text-main)',
    wordBreak: 'break-word',
    userSelect: 'text',
    lineHeight: '1.45',
    whiteSpace: 'pre-wrap',
  },
  timestamp: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    alignSelf: 'flex-end',
  },
  cardFooter: {
    padding: '10px 16px',
    borderTop: '1px solid var(--border-card-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(128,128,128,0.05)',
  },
  reactionContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  reactionBtn: {
    background: 'rgba(128,128,128,0.05)',
    border: '1px solid var(--border-card-base)',
    borderRadius: '6px',
    padding: '3px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.725rem',
    transition: 'all 0.15s ease',
  },
  commentToggleBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.725rem',
  },
  commentsPanel: {
    borderTop: '1px solid var(--border-card-base)',
    background: 'rgba(128,128,128,0.08)',
    padding: '12px 16px',
  },
  commentsList: {
    maxHeight: '120px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '10px',
  },
  commentItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    paddingBottom: '6px',
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.7rem',
  },
  commentAuthor: {
    fontWeight: 'bold',
    color: 'var(--color-primary)',
  },
  commentTime: {
    color: 'var(--text-muted)',
  },
  commentTextContent: {
    fontSize: '0.775rem',
    color: 'var(--text-main)',
    userSelect: 'text',
  },
  noCommentsText: {
    fontSize: '0.75rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '10px 0',
  },
  commentForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(128,128,128,0.1)',
    border: '1px solid var(--border-card-base)',
    borderRadius: '8px',
    padding: '2px 6px',
  },
  commentInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-main)',
    fontSize: '0.75rem',
    padding: '4px 0',
  },
  commentAuthorInput: {
    width: '50px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'none',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    outline: 'none',
    color: 'var(--color-primary)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    padding: '4px 6px 4px 2px',
    borderRadius: '4px 0 0 4px',
  },
  commentSubmitBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Editor Mode Styles */
  editorContainer: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editorTitle: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: 'var(--color-primary)',
  },
  closeEditorBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  editInput: {
    background: 'rgba(128,128,128,0.08)',
    border: '1px solid var(--border-card-base)',
    borderRadius: '8px',
    color: 'var(--text-main)',
    padding: '8px',
    fontSize: '0.8rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  attachmentSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  attachmentTypes: {
    display: 'flex',
    gap: '4px',
  },
  attachTypeBtn: {
    flex: 1,
    fontSize: '0.7rem',
    padding: '4px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
  },
  attachmentInput: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#ffffff',
    padding: '6px',
    fontSize: '0.75rem',
    outline: 'none',
  },
  colorPresetsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  colorGrid: {
    display: 'flex',
    gap: '8px',
  },
  colorDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  editorActions: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '4px',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#f87171',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.775rem',
  },
  saveBtn: {
    background: 'var(--color-primary)',
    color: '#030712',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '0.775rem',
    cursor: 'pointer',
  },
  guestFieldsRow: {
    display: 'flex',
    gap: '8px',
    width: '100%',
  },
  editorModalContent: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '380px',
    maxWidth: 'calc(100vw - 48px)',
    padding: '24px 20px',
    borderRadius: '16px',
    border: '1.5px solid var(--color-primary)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  authorRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '6px',
  },
  authorBadge: {
    fontSize: '0.725rem',
    fontWeight: 'bold',
    color: 'var(--color-primary)',
    background: 'rgba(129, 140, 248, 0.1)',
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid rgba(129, 140, 248, 0.2)',
  },
  moderationPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.12)',
    borderTop: '1px solid rgba(239, 68, 68, 0.2)',
    borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
    textAlign: 'center',
  },
  moderationText: {
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: '#f87171',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  moderationActions: {
    display: 'flex',
    gap: '10px',
    width: '100%',
  },
  rejectBtn: {
    flex: 1,
    padding: '6px 12px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.15s ease',
  },
  approveBtn: {
    flex: 1,
    padding: '6px 12px',
    background: 'rgba(34, 197, 94, 0.3)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    borderRadius: '6px',
    color: '#4ade80',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.15s ease',
  },
  pendingBadge: {
    fontSize: '0.675rem',
    fontWeight: 'bold',
    color: '#fbbf24',
    background: 'rgba(251, 191, 36, 0.1)',
    padding: '2px 6px',
    borderRadius: '12px',
    border: '1px solid rgba(251, 191, 36, 0.2)',
  },
  passwordOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.96)',
    backdropFilter: 'blur(8px)',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    textAlign: 'center',
  },
  passwordOverlayTitle: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '4px',
  },
  passwordOverlayDesc: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
    marginBottom: '12px',
  },
  passwordForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    maxWidth: '220px',
  },
  passwordInput: {
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#ffffff',
    padding: '8px 12px',
    fontSize: '0.8rem',
    outline: 'none',
    textAlign: 'center',
    width: '100%',
  },
  passwordOverlayActions: {
    display: 'flex',
    gap: '8px',
    width: '100%',
  },
  passwordCancelBtn: {
    flex: 1,
    padding: '6px 10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.725rem',
    transition: 'all 0.15s ease',
  },
  passwordConfirmBtn: {
    flex: 1,
    padding: '6px 10px',
    background: 'var(--color-primary)',
    border: 'none',
    borderRadius: '6px',
    color: '#030712',
    cursor: 'pointer',
    fontSize: '0.725rem',
    fontWeight: 'bold',
    transition: 'all 0.15s ease',
  },
  commentDeleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.15s ease',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(3, 7, 18, 0.55)',
    backdropFilter: 'blur(5px)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  shareModalContent: {
    width: '100%',
    maxWidth: '420px',
    padding: '24px',
    borderRadius: '16px',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
  },
  shareModalText: {
    fontSize: '0.825rem',
    color: '#ffffff',
    lineHeight: '1.5',
    textAlign: 'center',
    margin: '10px 0 20px 0',
  },
  shareModalActions: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  shareModalCancelBtn: {
    flex: 1,
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    transition: 'all 0.15s ease',
  },
  shareModalCopyBtn: {
    flex: 2,
    padding: '10px',
    background: 'var(--color-primary)',
    border: 'none',
    borderRadius: '8px',
    color: '#030712',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    transition: 'all 0.15s ease',
  }
};
