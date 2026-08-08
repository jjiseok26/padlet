import React, { useState } from 'react';
import { Plus, Users, Share2, Trash2, ArrowRight, X } from 'lucide-react';
import { useSandboxStore, SANDBOX_BACKGROUNDS } from '../../store/useSandboxStore';

interface Props {
  onToast: (message: string) => void;
}

/** Dashboard block listing collaborative canvases and creating new ones. */
export const SandboxSection: React.FC<Props> = ({ onToast }) => {
  const { sandboxes, elements, createSandbox, deleteSandbox, setActiveSandboxId } = useSandboxStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [background, setBackground] = useState(SANDBOX_BACKGROUNDS[0].value);
  const [groupCount, setGroupCount] = useState(4);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const groupNames = Array.from({ length: groupCount }, (_, i) => `${i + 1}모둠`);
    const id = createSandbox(title, description, background, groupNames);

    setTitle('');
    setDescription('');
    setGroupCount(4);
    setIsModalOpen(false);
    setActiveSandboxId(id);
  };

  const handleShare = (sandboxId: string) => {
    const url = `${window.location.origin}?sandbox=${encodeURIComponent(sandboxId)}`;
    navigator.clipboard
      .writeText(url)
      .then(() => onToast('참여 링크가 복사되었습니다!'))
      .catch(() => onToast('링크 복사에 실패했습니다.'));
  };

  const countFor = (sandboxId: string) => elements.filter((el) => el.sandboxId === sandboxId).length;

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <p style={styles.sectionDesc}>
          모둠마다 자기 캔버스를 갖고, 같은 모둠 학생들이 동시에 그리고 쓰며 협업합니다.
        </p>
        <button className="button-premium active" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} />
          <span>새 캔버스</span>
        </button>
      </div>

      {sandboxes.length === 0 ? (
        <div
          className="glass-card add-placeholder-card"
          style={styles.emptyCard}
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={28} color="var(--text-muted)" />
          <h3 style={styles.emptyTitle}>첫 협업 캔버스 만들기</h3>
          <p style={styles.emptyDesc}>모둠 수를 정하면 영역이 자동으로 나뉩니다.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {sandboxes.map((sandbox) => (
            <div key={sandbox.id} className="glass-card" style={styles.card}>
              <div style={styles.cardTop}>
                <h3 style={styles.cardTitle}>{sandbox.title}</h3>
                <button
                  className="delete-board-btn"
                  onClick={() => {
                    if (window.confirm(`'${sandbox.title}' 캔버스를 삭제할까요?`)) {
                      deleteSandbox(sandbox.id);
                      onToast('캔버스를 삭제했습니다.');
                    }
                  }}
                  style={styles.deleteBtn}
                  title="캔버스 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <p style={styles.cardDesc}>{sandbox.description || '설명이 없는 캔버스입니다.'}</p>

              <div style={styles.groupChips}>
                {sandbox.groups.slice(0, 5).map((group) => (
                  <span key={group.id} style={{ ...styles.chip, background: `${group.color}1a`, color: group.color }}>
                    {group.name}
                  </span>
                ))}
                {sandbox.groups.length > 5 && (
                  <span style={styles.chipMuted}>+{sandbox.groups.length - 5}</span>
                )}
              </div>

              <div style={styles.cardMeta}>
                <span style={styles.metaItem}>
                  <Users size={12} /> 모둠 {sandbox.groups.length}개
                </span>
                <span style={styles.metaItem}>작업 {countFor(sandbox.id)}개</span>
              </div>

              <div style={styles.cardActions}>
                <button className="button-premium" onClick={() => handleShare(sandbox.id)} title="참여 링크 복사">
                  <Share2 size={14} />
                </button>
                <button
                  className="button-premium active"
                  onClick={() => setActiveSandboxId(sandbox.id)}
                  style={styles.openBtn}
                >
                  <span>열기</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div style={styles.backdrop} onClick={() => setIsModalOpen(false)}>
          <form
            className="glass-panel modal-responsive"
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0 }}>새 협업 캔버스</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>캔버스 이름</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 4학년 과학 브레인스토밍"
                style={styles.input}
                autoFocus
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>설명 (선택)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 모둠별로 실험 아이디어를 정리해요"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>모둠 수: {groupCount}개</label>
              <input
                type="range"
                min={1}
                max={10}
                value={groupCount}
                onChange={(e) => setGroupCount(Number(e.target.value))}
                style={{ accentColor: 'var(--color-primary)' }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>캔버스 배경</label>
              <div style={styles.bgRow}>
                {SANDBOX_BACKGROUNDS.map((bg) => (
                  <button
                    type="button"
                    key={bg.value}
                    onClick={() => setBackground(bg.value)}
                    style={{
                      ...styles.bgBtn,
                      borderColor: background === bg.value ? 'var(--color-primary)' : 'var(--glass-border)',
                      fontWeight: background === bg.value ? 700 : 500,
                    }}
                  >
                    {bg.name}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="button-premium active" style={styles.submit}>
              캔버스 만들고 열기
            </button>
          </form>
        </div>
      )}
    </section>
  );
};

const styles: Record<string, React.CSSProperties> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#ffffff',
    background: 'var(--color-primary)',
    borderRadius: 999,
    padding: '3px 9px',
  },
  sectionDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 18,
  },
  card: {
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    margin: 0,
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 6,
    padding: 4,
    flexShrink: 0,
  },
  cardDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: 0,
    minHeight: 32,
  },
  groupChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    fontSize: '0.68rem',
    fontWeight: 700,
    borderRadius: 999,
    padding: '3px 9px',
  },
  chipMuted: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    padding: '3px 6px',
  },
  cardMeta: {
    display: 'flex',
    gap: 12,
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  cardActions: {
    display: 'flex',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 6,
  },
  openBtn: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 6,
    cursor: 'pointer',
    border: '2px dashed rgba(15, 55, 80, 0.18)',
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    margin: 0,
  },
  emptyDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 55, 80, 0.26)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: 16,
  },
  modal: {
    width: 440,
    maxWidth: '100%',
    padding: 24,
    borderRadius: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modalHeader: {
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
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  label: {
    fontSize: '0.73rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid var(--glass-border)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: '0.88rem',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--text-main)',
  },
  bgRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  bgBtn: {
    padding: '7px 12px',
    borderRadius: 9,
    border: '1.5px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.75)',
    color: 'var(--text-main)',
    fontSize: '0.76rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  submit: {
    justifyContent: 'center',
    padding: 12,
  },
};
