import React, { useState } from 'react';
import { Home, Share2, Users, Plus, Trash2, Download, Wifi, WifiOff, X, Eraser } from 'lucide-react';
import { useSandboxStore } from '../../store/useSandboxStore';
import type { Sandbox } from '../../store/useSandboxStore';
import { usePresenceStore } from '../../store/usePresenceStore';
import { isMqttConnected } from '../../store/useBoardStore';

interface Props {
  sandbox: Sandbox;
  isGuestMode: boolean;
  onExit: () => void;
  onToast: (message: string) => void;
}

export const SandboxHeader: React.FC<Props> = ({ sandbox, isGuestMode, onExit, onToast }) => {
  const {
    elements,
    myGroupId,
    myName,
    setIdentity,
    addGroup,
    removeGroup,
    clearGroupElements,
    updateSandbox,
    setActiveGroupId,
  } = useSandboxStore();
  const peers = usePresenceStore((state) => state.peers);

  const [showGroups, setShowGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [titleDraft, setTitleDraft] = useState(sandbox.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const peerList = Object.values(peers);
  const connected = isMqttConnected();
  const myGroup = sandbox.groups.find((g) => g.id === myGroupId);

  const handleShare = () => {
    const url = `${window.location.origin}?sandbox=${encodeURIComponent(sandbox.id)}`;
    navigator.clipboard
      .writeText(url)
      .then(() => onToast('참여 링크가 복사되었습니다! 학생들에게 전달하세요.'))
      .catch(() => onToast('링크 복사에 실패했습니다.'));
  };

  const handleExport = () => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        sandbox,
        elements: elements.filter((el) => el.sandboxId === sandbox.id),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sandbox.title.replace(/[^\w\sㄱ-힣]/g, '') || 'sandbox'}_export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast('캔버스를 JSON으로 저장했습니다.');
    } catch {
      onToast('내보내기에 실패했습니다.');
    }
  };

  const commitTitle = () => {
    setIsEditingTitle(false);
    const next = titleDraft.trim();
    if (next && next !== sandbox.title) updateSandbox(sandbox.id, { title: next });
  };

  const countFor = (groupId: string | null) =>
    elements.filter((el) => el.sandboxId === sandbox.id && el.groupId === groupId).length;

  return (
    <>
      <header className="glass-panel sandbox-header" style={styles.header}>
        <div style={styles.left}>
          <button className="button-premium" onClick={onExit} title={isGuestMode ? '나가기' : '대시보드로'}>
            <Home size={16} />
          </button>

          {isEditingTitle && !isGuestMode ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === 'Enter' && commitTitle()}
              style={styles.titleInput}
              autoFocus
            />
          ) : (
            <h1
              style={styles.title}
              onDoubleClick={() => !isGuestMode && setIsEditingTitle(true)}
              title={isGuestMode ? sandbox.title : '더블클릭하여 이름 변경'}
            >
              {sandbox.title}
            </h1>
          )}

          <span style={{ ...styles.statusPill, color: connected ? '#0f766e' : '#b45309' }}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? '실시간 연결됨' : '연결 대기중'}
          </span>
        </div>

        <div style={styles.right}>
          {/* Live participants */}
          <div style={styles.presenceRow} title={`${peerList.length + 1}명 참여 중`}>
            <span style={{ ...styles.avatar, background: myGroup?.color || 'var(--color-primary)' }}>
              {(myName || '나').slice(0, 1)}
            </span>
            {peerList.slice(0, 4).map((peer) => (
              <span key={peer.clientId} style={{ ...styles.avatar, background: peer.color }} title={peer.name}>
                {peer.name.slice(0, 1)}
              </span>
            ))}
            {peerList.length > 4 && <span style={styles.moreCount}>+{peerList.length - 4}</span>}
          </div>

          <button className="button-premium" onClick={() => setShowGroups(true)} title="모둠 관리">
            <Users size={16} />
            <span>모둠 {myGroup ? `· ${myGroup.name}` : ''}</span>
          </button>

          {!isGuestMode && (
            <>
              <button className="button-premium active" onClick={handleShare} title="참여 링크 복사">
                <Share2 size={16} />
                <span>참여 링크</span>
              </button>
              <button className="button-premium" onClick={handleExport} title="JSON 내보내기">
                <Download size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {showGroups && (
        <div style={styles.backdrop} onClick={() => setShowGroups(false)}>
          <div
            className="glass-panel modal-responsive"
            style={styles.panel}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.panelHeader}>
              <h2 style={{ margin: 0 }}>모둠 관리</h2>
              <button onClick={() => setShowGroups(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <p style={styles.hint}>
              내 모둠을 고르면 그 영역이 강조되고, 그 안에 만든 작업이 자동으로 모둠에 기록됩니다.
            </p>

            <div style={styles.groupList}>
              {sandbox.groups.map((group) => {
                const active = group.id === myGroupId;
                return (
                  <div
                    key={group.id}
                    style={{
                      ...styles.groupRow,
                      borderColor: active ? group.color : 'var(--glass-border)',
                      background: active ? `${group.color}12` : 'rgba(255,255,255,0.65)',
                    }}
                  >
                    <button
                      onClick={() => {
                        setIdentity(myName, group.id, group.color);
                        setActiveGroupId(group.id);
                      }}
                      style={styles.groupSelect}
                      title="이 모둠으로 참여"
                    >
                      <span style={{ ...styles.groupDot, background: group.color }} />
                      <span style={{ fontWeight: active ? 700 : 500 }}>{group.name}</span>
                      <span style={styles.countTag}>{countFor(group.id)}개</span>
                    </button>

                    {!isGuestMode && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => {
                            if (window.confirm(`'${group.name}'의 작업을 모두 지울까요?`)) {
                              clearGroupElements(sandbox.id, group.id);
                            }
                          }}
                          style={styles.iconBtn}
                          title="이 모둠 작업 비우기"
                        >
                          <Eraser size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`'${group.name}' 모둠을 삭제할까요? 작업은 남습니다.`)) {
                              removeGroup(sandbox.id, group.id);
                            }
                          }}
                          style={{ ...styles.iconBtn, color: '#dc2626' }}
                          title="모둠 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!isGuestMode && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newGroupName.trim()) return;
                  addGroup(sandbox.id, newGroupName);
                  setNewGroupName('');
                }}
                style={styles.addRow}
              >
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="새 모둠 이름"
                  style={styles.input}
                  maxLength={20}
                />
                <button type="submit" className="button-premium active" style={{ padding: '9px 14px' }}>
                  <Plus size={15} />
                  <span>추가</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 68,
    zIndex: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 18px',
    gap: 12,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  title: {
    fontSize: '1.15rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '32vw',
    cursor: 'default',
  },
  titleInput: {
    fontSize: '1.05rem',
    fontWeight: 700,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--color-primary)',
    outline: 'none',
    background: 'rgba(255,255,255,0.9)',
    color: 'var(--text-main)',
    fontFamily: 'inherit',
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: '0.7rem',
    fontWeight: 600,
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid var(--glass-border)',
    borderRadius: 999,
    padding: '4px 10px',
    whiteSpace: 'nowrap',
  },
  presenceRow: {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    color: '#ffffff',
    fontSize: '0.72rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #ffffff',
    marginLeft: -6,
    textTransform: 'uppercase',
  },
  moreCount: {
    marginLeft: 4,
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 55, 80, 0.24)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: 16,
  },
  panel: {
    width: 460,
    maxWidth: '100%',
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: 24,
    borderRadius: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    margin: 0,
    lineHeight: 1.5,
  },
  groupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  groupRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 12,
    border: '1.5px solid var(--glass-border)',
  },
  groupSelect: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    textAlign: 'left',
    fontSize: '0.88rem',
    color: 'var(--text-main)',
    fontFamily: 'inherit',
    padding: '4px 0',
  },
  groupDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
  countTag: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    background: 'rgba(15,55,80,0.06)',
    borderRadius: 999,
    padding: '2px 8px',
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.8)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  addRow: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid var(--glass-border)',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: '0.85rem',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--text-main)',
  },
};
