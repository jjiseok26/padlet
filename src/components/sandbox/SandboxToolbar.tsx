import React from 'react';
import {
  MousePointer2,
  Hand,
  Pencil,
  Eraser,
  StickyNote,
  Type,
  Square,
  Circle,
  Minus,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { useSandboxStore } from '../../store/useSandboxStore';
import type { SandboxTool } from '../../store/useSandboxStore';

const TOOLS: { tool: SandboxTool; icon: React.ReactNode; label: string }[] = [
  { tool: 'select', icon: <MousePointer2 size={17} />, label: '선택 / 이동' },
  { tool: 'pan', icon: <Hand size={17} />, label: '화면 이동' },
  { tool: 'pen', icon: <Pencil size={17} />, label: '펜' },
  { tool: 'eraser', icon: <Eraser size={17} />, label: '지우개' },
  { tool: 'note', icon: <StickyNote size={17} />, label: '메모지' },
  { tool: 'text', icon: <Type size={17} />, label: '텍스트' },
  { tool: 'rect', icon: <Square size={17} />, label: '사각형' },
  { tool: 'ellipse', icon: <Circle size={17} />, label: '원' },
  { tool: 'line', icon: <Minus size={17} />, label: '선' },
];

const COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#1f2937'];
const WIDTHS = [2, 4, 8, 14];

interface Props {
  canEdit: boolean;
}

export const SandboxToolbar: React.FC<Props> = ({ canEdit }) => {
  const {
    tool,
    setTool,
    drawColor,
    setDrawColor,
    strokeWidth,
    setStrokeWidth,
    scale,
    panX,
    panY,
    setViewport,
    resetViewport,
  } = useSandboxStore();

  const zoom = (factor: number) => {
    const next = Math.min(2.5, Math.max(0.25, scale * factor));
    setViewport(panX, panY, next);
  };

  return (
    <div className="glass-panel sandbox-toolbar" style={styles.wrapper}>
      {canEdit && (
        <>
          <div style={styles.group}>
            {TOOLS.map((item) => (
              <button
                key={item.tool}
                onClick={() => setTool(item.tool)}
                title={item.label}
                style={{
                  ...styles.toolBtn,
                  background: tool === item.tool ? 'var(--color-primary)' : 'transparent',
                  color: tool === item.tool ? '#ffffff' : 'var(--text-main)',
                }}
              >
                {item.icon}
              </button>
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.group}>
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setDrawColor(color)}
                title={`색상 ${color}`}
                style={{
                  ...styles.colorDot,
                  background: color,
                  transform: drawColor === color ? 'scale(1.22)' : 'scale(1)',
                  boxShadow: drawColor === color ? `0 0 0 3px ${color}44` : 'none',
                }}
              />
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.group}>
            {WIDTHS.map((width) => (
              <button
                key={width}
                onClick={() => setStrokeWidth(width)}
                title={`두께 ${width}px`}
                style={{
                  ...styles.toolBtn,
                  background: strokeWidth === width ? 'var(--color-primary-soft)' : 'transparent',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 18,
                    height: Math.min(width, 10),
                    borderRadius: 999,
                    background: strokeWidth === width ? 'var(--color-primary)' : 'var(--text-muted)',
                  }}
                />
              </button>
            ))}
          </div>

          <div style={styles.divider} />
        </>
      )}

      <div style={styles.group}>
        <button onClick={() => zoom(0.9)} title="축소" style={styles.toolBtn}>
          <ZoomOut size={16} />
        </button>
        <span style={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
        <button onClick={() => zoom(1.1)} title="확대" style={styles.toolBtn}>
          <ZoomIn size={16} />
        </button>
        <button onClick={resetViewport} title="화면 초기화" style={styles.toolBtn}>
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'absolute',
    bottom: 22,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 16,
    maxWidth: 'calc(100vw - 32px)',
    overflowX: 'auto',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: 24,
    background: 'var(--glass-border)',
    flexShrink: 0,
  },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-main)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s ease',
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '2px solid #ffffff',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  zoomLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    minWidth: 38,
    textAlign: 'center',
    fontWeight: 600,
  },
};
