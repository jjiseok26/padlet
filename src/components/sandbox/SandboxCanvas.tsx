import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSandboxStore, GROUP_PAGE } from '../../store/useSandboxStore';
import type { Sandbox, SandboxElement, SandboxGroup } from '../../store/useSandboxStore';
import { sendCursor } from '../../store/usePresenceStore';
import { PresenceCursors } from './PresenceCursors';
import { SandboxElementView } from './SandboxElementView';

interface SandboxCanvasProps {
  sandbox: Sandbox;
  group: SandboxGroup | null;
  canEdit: boolean;
}

const BACKGROUND_STYLES: Record<string, React.CSSProperties> = {
  'grid-light': {
    backgroundColor: '#fbfdff',
    backgroundImage:
      'linear-gradient(rgba(15,55,80,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,55,80,0.06) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
  },
  'dot-light': {
    backgroundColor: '#fbfdff',
    backgroundImage: 'radial-gradient(rgba(15,55,80,0.14) 1.4px, transparent 1.4px)',
    backgroundSize: '26px 26px',
  },
  'plain-light': { backgroundColor: '#fbfdff' },
  'plain-mint': { backgroundColor: '#f0fbf7' },
  'plain-sky': { backgroundColor: '#f1f8fe' },
};

const NOTE_WIDTH = 220;
const NOTE_HEIGHT = 160;
const TEXT_WIDTH = 260;
const TEXT_HEIGHT = 60;

/** Screen point → canvas coordinate, undoing pan and zoom. */
const toCanvasPoint = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  panX: number,
  panY: number,
  scale: number
) => ({
  x: (clientX - rect.left - panX) / scale,
  y: (clientY - rect.top - panY) / scale,
});

export const SandboxCanvas: React.FC<SandboxCanvasProps> = ({ sandbox, group, canEdit }) => {
  const {
    elements,
    tool,
    drawColor,
    strokeWidth,
    panX,
    panY,
    scale,
    myName,
    selectedElementId,
    setViewport,
    setSelectedElementId,
    addElement,
    updateElement,
    deleteElement,
    setTool,
  } = useSandboxStore();

  const activeGroupId = group?.id ?? null;

  const viewportRef = useRef<HTMLDivElement>(null);

  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // In-progress freehand stroke, kept local until pointer up
  const [draftPoints, setDraftPoints] = useState<number[] | null>(null);
  const draftOrigin = useRef({ x: 0, y: 0 });

  // In-progress shape drag
  const [draftShape, setDraftShape] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const shapeStart = useRef({ x: 0, y: 0 });

  // Element dragging
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Each 모둠 has its own page, so only that group's work is on screen
  const sandboxElements = elements
    .filter((el) => el.sandboxId === sandbox.id && el.groupId === activeGroupId)
    .sort((a, b) => a.zIndex - b.zIndex);

  const getRect = () => viewportRef.current?.getBoundingClientRect();

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = getRect();
    if (!rect) return;

    const isBackground = e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true';
    const point = toCanvasPoint(e.clientX, e.clientY, rect, panX, panY, scale);

    // Middle mouse or pan tool always pans
    if (e.button === 1 || tool === 'pan' || (tool === 'select' && isBackground && e.shiftKey)) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    if (!canEdit) {
      if (isBackground) {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
      }
      return;
    }

    if (tool === 'select') {
      if (isBackground) {
        setSelectedElementId(null);
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
      }
      return;
    }

    if (tool === 'pen' || tool === 'eraser') {
      draftOrigin.current = point;
      setDraftPoints([0, 0]);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
      shapeStart.current = point;
      setDraftShape({ x: point.x, y: point.y, w: 0, h: 0 });
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === 'note') {
      const x = point.x - NOTE_WIDTH / 2;
      const y = point.y - NOTE_HEIGHT / 2;
      const id = addElement(sandbox.id, {
        groupId: activeGroupId,
        type: 'note',
        x,
        y,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        text: '',
        color: drawColor,
        authorName: myName || '익명',
      });
      setSelectedElementId(id);
      setTool('select');
      return;
    }

    if (tool === 'text') {
      const id = addElement(sandbox.id, {
        groupId: activeGroupId,
        type: 'text',
        x: point.x,
        y: point.y,
        width: TEXT_WIDTH,
        height: TEXT_HEIGHT,
        text: '',
        color: drawColor,
        authorName: myName || '익명',
      });
      setSelectedElementId(id);
      setTool('select');
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = getRect();
    if (!rect) return;

    const point = toCanvasPoint(e.clientX, e.clientY, rect, panX, panY, scale);
    sendCursor(point.x, point.y);

    if (isPanning) {
      setViewport(
        panStart.current.panX + (e.clientX - panStart.current.x),
        panStart.current.panY + (e.clientY - panStart.current.y)
      );
      return;
    }

    if (dragState.current) {
      const { id, offsetX, offsetY } = dragState.current;
      const x = point.x - offsetX;
      const y = point.y - offsetY;
      updateElement(id, { x, y });
      return;
    }

    if (draftPoints) {
      setDraftPoints((prev) =>
        prev ? [...prev, point.x - draftOrigin.current.x, point.y - draftOrigin.current.y] : prev
      );
      return;
    }

    if (draftShape) {
      setDraftShape({
        x: Math.min(shapeStart.current.x, point.x),
        y: Math.min(shapeStart.current.y, point.y),
        w: Math.abs(point.x - shapeStart.current.x),
        h: Math.abs(point.y - shapeStart.current.y),
      });
    }
  };

  const handlePointerUp = () => {
    if (isPanning) setIsPanning(false);
    dragState.current = null;

    if (draftPoints && draftPoints.length >= 4) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < draftPoints.length; i += 2) {
        xs.push(draftPoints[i]);
        ys.push(draftPoints[i + 1]);
      }
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const normalized: number[] = [];
      for (let i = 0; i < draftPoints.length; i += 2) {
        normalized.push(draftPoints[i] - minX, draftPoints[i + 1] - minY);
      }

      const originX = draftOrigin.current.x + minX;
      const originY = draftOrigin.current.y + minY;

      addElement(sandbox.id, {
        groupId: activeGroupId,
        type: 'draw',
        x: originX,
        y: originY,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
        points: normalized,
        color: tool === 'eraser' ? '#ffffff' : drawColor,
        strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
        authorName: myName || '익명',
      });
    }
    setDraftPoints(null);

    if (draftShape && draftShape.w > 6 && draftShape.h > 6) {
      addElement(sandbox.id, {
        groupId: activeGroupId,
        type: tool === 'line' ? 'line' : tool === 'ellipse' ? 'ellipse' : 'rect',
        x: draftShape.x,
        y: draftShape.y,
        width: draftShape.w,
        height: draftShape.h,
        color: drawColor,
        strokeWidth,
        authorName: myName || '익명',
      });
      setTool('select');
    }
    setDraftShape(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = getRect();
    if (!rect) return;

    const nextScale = Math.min(2.5, Math.max(0.25, scale * (e.deltaY > 0 ? 0.92 : 1.08)));
    // Keep the point under the cursor anchored while zooming
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const ratio = nextScale / scale;
    setViewport(cx - (cx - panX) * ratio, cy - (cy - panY) * ratio, nextScale);
  };

  const startElementDrag = useCallback(
    (element: SandboxElement, clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect || !canEdit) return;
      const point = toCanvasPoint(clientX, clientY, rect, panX, panY, scale);
      dragState.current = { id: element.id, offsetX: point.x - element.x, offsetY: point.y - element.y };
      setSelectedElementId(element.id);
    },
    [canEdit, panX, panY, scale, setSelectedElementId]
  );

  // Delete selected element with keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!canEdit || !selectedElementId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteElement(selectedElementId);
      }
      if (e.key === 'Escape') setSelectedElementId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, selectedElementId, deleteElement, setSelectedElementId]);

  const cursorStyle =
    tool === 'pan' || isPanning
      ? 'grabbing'
      : tool === 'pen' || tool === 'eraser'
        ? 'crosshair'
        : tool === 'note' || tool === 'text'
          ? 'copy'
          : tool === 'rect' || tool === 'ellipse' || tool === 'line'
            ? 'crosshair'
            : 'default';

  return (
    <div
      ref={viewportRef}
      style={{ ...styles.viewport, cursor: cursorStyle }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      data-canvas-bg="true"
    >
      <div
        data-canvas-world="true"
        style={{
          ...styles.world,
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
        }}
      >
        {/* The active 모둠's page */}
        {group && (
          <div
            data-group-page="true"
            style={{
              ...styles.page,
              width: GROUP_PAGE.width,
              height: GROUP_PAGE.height,
              borderColor: `${group.color}55`,
              ...(BACKGROUND_STYLES[sandbox.background] || BACKGROUND_STYLES['grid-light']),
            }}
          >
            <div style={{ ...styles.pageLabel, background: group.color }}>{group.name}</div>
          </div>
        )}

        {/* Persisted elements */}
        {sandboxElements.map((element) => (
          <SandboxElementView
            key={element.id}
            element={element}
            isSelected={element.id === selectedElementId}
            canEdit={canEdit}
            groupColor={group?.color}
            onStartDrag={startElementDrag}
          />
        ))}

        {/* Live stroke preview */}
        {draftPoints && draftPoints.length >= 4 && (
          <svg style={styles.draftLayer} overflow="visible">
            <polyline
              points={pointsToSvg(draftPoints, draftOrigin.current.x, draftOrigin.current.y)}
              fill="none"
              stroke={tool === 'eraser' ? '#ffffff' : drawColor}
              strokeWidth={tool === 'eraser' ? strokeWidth * 3 : strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Live shape preview */}
        {draftShape && (
          <div
            style={{
              position: 'absolute',
              left: draftShape.x,
              top: draftShape.y,
              width: draftShape.w,
              height: draftShape.h,
              border: `${strokeWidth}px solid ${drawColor}`,
              borderRadius: tool === 'ellipse' ? '50%' : tool === 'line' ? 0 : 12,
              pointerEvents: 'none',
              opacity: 0.75,
            }}
          />
        )}

        <PresenceCursors />
      </div>
    </div>
  );
};

const pointsToSvg = (points: number[], originX: number, originY: number): string => {
  const parts: string[] = [];
  for (let i = 0; i < points.length; i += 2) {
    parts.push(`${originX + points[i]},${originY + points[i + 1]}`);
  }
  return parts.join(' ');
};

const styles: Record<string, React.CSSProperties> = {
  viewport: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    touchAction: 'none',
    background: 'linear-gradient(160deg, #eef5fa 0%, #f4f9fd 100%)',
  },
  world: {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: '0 0',
    width: 0,
    height: 0,
  },
  page: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderStyle: 'solid',
    borderWidth: 2,
    borderRadius: 18,
    pointerEvents: 'none',
    boxShadow: '0 18px 50px rgba(22, 50, 74, 0.12)',
  },
  pageLabel: {
    position: 'absolute',
    top: -15,
    left: 24,
    padding: '5px 16px',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: 700,
    boxShadow: '0 6px 16px rgba(22, 50, 74, 0.18)',
  },
  draftLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    pointerEvents: 'none',
  },
};
