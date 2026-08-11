import React, { useState } from 'react';
import { Plus, FileDown, Loader2, X, GripVertical } from 'lucide-react';
import type { Sandbox } from '../../store/useSandboxStore';
import { nestedOverlayOn, readableTextOn } from '../../utils/colorContrast';

interface Props {
  sandbox: Sandbox;
  activeGroupId: string | null;
  countFor: (groupId: string) => number;
  isGuestMode: boolean;
  isExporting: boolean;
  onSelect: (groupId: string) => void;
  onAddGroup: () => void;
  onRemoveGroup: (groupId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onExportCurrent: () => void;
  onExportAll: () => void;
}

/** Left rail listing every 모둠 — each entry opens that group's own canvas. */
export const GroupTabs: React.FC<Props> = ({
  sandbox,
  activeGroupId,
  countFor,
  isGuestMode,
  isExporting,
  onSelect,
  onAddGroup,
  onRemoveGroup,
  onReorder,
  onExportCurrent,
  onExportAll,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const canReorder = !isGuestMode && sandbox.groups.length > 1;

  const endDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <aside className="glass-panel sandbox-group-rail" style={styles.rail}>
      <div className="sandbox-rail-heading" style={styles.heading}>
        모둠
      </div>

      <div className="sandbox-rail-list" style={styles.list}>
        {sandbox.groups.map((group, index) => {
          const active = group.id === activeGroupId;
          const label = readableTextOn(group.color);
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;
          return (
            <div
              key={group.id}
              className="sandbox-rail-item"
              style={{
                ...styles.item,
                opacity: isDragging ? 0.45 : 1,
                boxShadow: isDropTarget ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                borderRadius: 10,
              }}
              draggable={canReorder}
              onDragStart={(e) => {
                if (!canReorder) return;
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                // Firefox refuses to start a drag without payload
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropIndex(index);
              }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                onReorder(dragIndex, index);
                endDrag();
              }}
              onDragEnd={endDrag}
            >
              <button
                onClick={() => onSelect(group.id)}
                style={{
                  ...styles.tab,
                  background: active ? group.color : 'transparent',
                  color: active ? label : 'var(--text-main)',
                  borderColor: active ? group.color : 'var(--glass-border)',
                  fontWeight: active ? 700 : 500,
                  cursor: canReorder ? 'grab' : 'pointer',
                }}
                title={
                  canReorder
                    ? `${group.name} 캔버스 열기 · 드래그해서 순서 변경`
                    : `${group.name} 캔버스 열기`
                }
              >
                {canReorder && (
                  <GripVertical
                    size={13}
                    style={{ flexShrink: 0, opacity: 0.55, color: active ? label : 'var(--text-muted)' }}
                  />
                )}
                <span style={{ ...styles.dot, background: active ? label : group.color }} />
                <span className="sandbox-rail-name" style={styles.tabName}>
                  {group.name}
                </span>
                <span
                  style={{
                    ...styles.count,
                    background: active ? nestedOverlayOn(group.color) : 'rgba(15,55,80,0.07)',
                    color: active ? label : 'var(--text-muted)',
                  }}
                >
                  {countFor(group.id)}
                </span>
              </button>

              {!isGuestMode && sandbox.groups.length > 1 && (
                <button
                  onClick={() => onRemoveGroup(group.id)}
                  className="sandbox-rail-remove"
                  style={styles.removeBtn}
                  title={`${group.name} 삭제`}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}

        {!isGuestMode && (
          <button onClick={onAddGroup} style={styles.addBtn} title="모둠 추가">
            <Plus size={14} />
            <span className="sandbox-rail-add-label">모둠 추가</span>
          </button>
        )}
      </div>

      <div className="sandbox-rail-actions" style={styles.actions}>
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
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  rail: {
    position: 'absolute',
    top: 68,
    left: 0,
    bottom: 0,
    width: 186,
    zIndex: 65,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '14px 12px',
    borderRadius: 0,
    borderTop: 'none',
    borderBottom: 'none',
    borderLeft: 'none',
  },
  heading: {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    paddingLeft: 4,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  },
  item: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 12px',
    borderRadius: 10,
    border: '1.5px solid var(--glass-border)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  tabName: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    flexShrink: 0,
  },
  count: {
    fontSize: '0.66rem',
    fontWeight: 700,
    borderRadius: 999,
    padding: '1px 7px',
    minWidth: 20,
    textAlign: 'center',
    flexShrink: 0,
  },
  removeBtn: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '1px solid var(--glass-border)',
    background: 'var(--bg-card-solid)',
    color: '#dc2626',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    boxShadow: '0 3px 8px rgba(22, 50, 74, 0.18)',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '9px 12px',
    borderRadius: 10,
    border: '1.5px dashed rgba(15,55,80,0.22)',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  pdfBtn: {
    justifyContent: 'center',
    padding: '8px 10px',
    fontSize: '0.78rem',
  },
};
