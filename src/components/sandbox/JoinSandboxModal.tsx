import React, { useState } from 'react';
import { Users } from 'lucide-react';
import type { Sandbox } from '../../store/useSandboxStore';

interface Props {
  sandbox: Sandbox;
  initialName: string;
  onJoin: (name: string, groupId: string | null) => void;
}

/** Asks a participant for their name and 모둠 before they can draw on the canvas. */
export const JoinSandboxModal: React.FC<Props> = ({ sandbox, initialName, onJoin }) => {
  const [name, setName] = useState(initialName);
  const [groupId, setGroupId] = useState<string | null>(sandbox.groups[0]?.id ?? null);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    onJoin(name.trim(), groupId);
  };

  return (
    <div style={styles.backdrop}>
      <form className="glass-panel modal-responsive" style={styles.modal} onSubmit={handleSubmit}>
        <div style={styles.header}>
          <div style={styles.iconWrap}>
            <Users size={22} color="var(--color-primary)" />
          </div>
          <h2 style={{ margin: 0 }}>{sandbox.title}</h2>
          <p style={styles.subtitle}>
            {sandbox.description || '모둠을 선택하고 함께 캔버스를 채워보세요.'}
          </p>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>이름</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 김하늘"
            style={styles.input}
            autoFocus
            maxLength={20}
          />
        </div>

        {sandbox.groups.length > 0 && (
          <div style={styles.field}>
            <label style={styles.label}>모둠 선택</label>
            <div style={styles.groupGrid}>
              {sandbox.groups.map((group) => {
                const active = group.id === groupId;
                return (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => setGroupId(group.id)}
                    style={{
                      ...styles.groupBtn,
                      borderColor: active ? group.color : 'var(--glass-border)',
                      background: active ? `${group.color}1a` : 'rgba(255,255,255,0.7)',
                      color: active ? group.color : 'var(--text-main)',
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <span style={{ ...styles.groupDot, background: group.color }} />
                    {group.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" className="button-premium active" style={styles.submit}>
          캔버스 참여하기
        </button>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 55, 80, 0.28)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4000,
    padding: 16,
  },
  modal: {
    width: 420,
    maxWidth: '100%',
    padding: 28,
    borderRadius: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: 'var(--color-primary-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid var(--glass-border)',
    borderRadius: 10,
    padding: '11px 12px',
    fontSize: '0.92rem',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--text-main)',
  },
  groupGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  groupBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1.5px solid var(--glass-border)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  error: {
    background: 'rgba(220, 38, 38, 0.08)',
    border: '1px solid rgba(220, 38, 38, 0.2)',
    borderRadius: 10,
    padding: '9px 12px',
    color: '#b91c1c',
    fontSize: '0.78rem',
    fontWeight: 500,
  },
  submit: {
    justifyContent: 'center',
    padding: 12,
  },
};
