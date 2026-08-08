import React from 'react';
import { Plus, FileDown, Loader2 } from 'lucide-react';
import type { Sandbox } from '../../store/useSandboxStore';

interface Props {
  sandbox: Sandbox;
  activeGroupId: string | null;
  myGroupId: string | null;
  countFor: (groupId: string) => number;
  isGuestMode: boolean;
  isExporting: boolean;
  onSelect: (groupId: string) => void;
  onAddGroup: () => void;
  onExportCurrent: () => void;
  onExportAll: () => void;
}

/** One tab per 모둠 — each opens that group's own canvas page. */
export const GroupTabs: React.FC<Props> = ({
  sandbox,
  activeGroupId,
  myGroupId,
  countFor,
  isGuestMode,
  isExporting,
  onSelect,
  onAddGroup,
  onExportCurrent,
  onExportAll,
}) => {
  return (
    <div className="glass-panel sandbox-group-tabs" style={styles.bar}>
      <div style={styles.tabScroller}>
        {sandbox.groups.map((group) => {
          const active = group.id === activeGroupId;
          const mine = group.id === myGroupId;
          return (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              style={{
                ...styles.tab,
                background: active ? group.color : 'transparent',
                color: active ? '#ffffff' : 'var(--text-main)',
                borderColor: active ? group.color : 'var(--glass-border)',
                fontWeight: active ? 700 : 500,
              }}
              title={`${group.name} 캔버스 열기`}
            >
              <span
                style={{
                  ...styles.dot,
                  background: active ? 'rgba(255,255,255,0.85)' : group.color,
                }}
              />
              <span>{group.name}</span>
              {mine && (
                <span
                  style={{
                    ...styles.mineTag,
                    background: active ? 'rgba(255,255,255,0.26)' : `${group.color}1f`,
                    color: active ? '#ffffff' : group.color,
                  }}
                >
                  내 모둠
                </span>
              )}
              <span
                style={{
                  ...styles.count,
                  background: active ? 'rgba(255,255,255,0.24)' : 'rgba(15,55,80,0.07)',
                  color: active ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {countFor(group.id)}
              </span>
            </button>
          );
        })}

        {!isGuestMode && (
          <button onClick={onAddGroup} style={styles.addTab} title="모둠 추가">
            <Plus size={15} />
          </button>
        )}
      </div>

      <div style={styles.actions}>
        <button
          className="button-premium"
          onClick={onExportCurrent}
          disabled={isExporting || !activeGroupId}
          style={styles.pdfBtn}
          title="현재 모둠 캔버스를 PDF로 저장"
        >
          {isExporting ? <Loader2 size={14} className="spin" /> : <FileDown size={14} />}
          <span>PDF</span>
        </button>
        {!isGuestMode && sandbox.groups.length > 1 && (
          <button
            className="button-premium"
            onClick={onExportAll}
            disabled={isExporting}
            style={styles.pdfBtn}
            title="모든 모둠 캔버스를 한 PDF로 저장"
          >
            <FileDown size={14} />
            <span>전체 PDF</span>
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    zIndex: 65,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 16px',
    borderRadius: 0,
    borderLeft: 'none',
    borderRight: 'none',
  },
  tabScroller: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
    flex: 1,
    minWidth: 0,
    paddingBottom: 2,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 14px',
    borderRadius: 999,
    border: '1.5px solid var(--glass-border)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    flexShrink: 0,
  },
  mineTag: {
    fontSize: '0.6rem',
    fontWeight: 700,
    borderRadius: 999,
    padding: '1px 7px',
  },
  count: {
    fontSize: '0.66rem',
    fontWeight: 700,
    borderRadius: 999,
    padding: '1px 7px',
    minWidth: 20,
    textAlign: 'center',
  },
  addTab: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1.5px dashed rgba(15,55,80,0.22)',
    background: 'transparent',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  pdfBtn: {
    padding: '7px 12px',
    fontSize: '0.78rem',
  },
};
