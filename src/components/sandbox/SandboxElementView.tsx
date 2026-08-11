import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useSandboxStore } from '../../store/useSandboxStore';
import type { SandboxElement } from '../../store/useSandboxStore';
import { mqttClientId } from '../../store/useBoardStore';
import { readableTextOn } from '../../utils/colorContrast';

interface Props {
  element: SandboxElement;
  isSelected: boolean;
  canEdit: boolean;
  groupColor?: string;
  onStartDrag: (element: SandboxElement, clientX: number, clientY: number) => void;
}

const pointsToSvg = (points: number[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < points.length; i += 2) {
    parts.push(`${points[i]},${points[i + 1]}`);
  }
  return parts.join(' ');
};

const SandboxElementViewBase: React.FC<Props> = ({
  element,
  isSelected,
  canEdit,
  groupColor,
  onStartDrag,
}) => {
  const { updateElement, deleteElement, tool } = useSandboxStore();
  // Only the author drops straight into edit mode. Otherwise a note someone
  // else is still typing would open as an empty editor on every other screen.
  const [isEditingText, setIsEditingText] = useState(
    element.text === '' && element.type !== 'draw' && element.authorId === mqttClientId
  );
  const [draftText, setDraftText] = useState(element.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditingText) setDraftText(element.text || '');
  }, [element.text, isEditingText]);

  useEffect(() => {
    if (!isEditingText) return;
    // Focus on the next frame: the click that created this element is still
    // being dispatched, and the browser would move focus back to <body>.
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isEditingText]);

  const commitText = () => {
    setIsEditingText(false);
    if (draftText !== element.text) updateElement(element.id, { text: draftText });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canEdit || isEditingText) return;
    if (e.button !== 0) return;
    // With a creation tool active the click belongs to the canvas, otherwise
    // you could never draw or place a note on top of existing work.
    if (tool !== 'select') return;
    e.stopPropagation();
    onStartDrag(element, e.clientX, e.clientY);
  };

  const selectionRing = isSelected
    ? { outline: '2px solid var(--color-primary)', outlineOffset: 3 }
    : {};

  const tagBackground = groupColor || '#16324a';
  const authorTag = element.authorName ? (
    <div
      style={{
        ...styles.authorTag,
        background: tagBackground,
        color: readableTextOn(tagBackground),
      }}
    >
      {element.authorName}
    </div>
  ) : null;

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.width;
    const startHeight = element.height;
    const { scale } = useSandboxStore.getState();

    const onMove = (move: PointerEvent) => {
      const width = Math.max(16, startWidth + (move.clientX - startX) / scale);
      const height =
        element.type === 'line' ? 0 : Math.max(16, startHeight + (move.clientY - startY) / scale);
      updateElement(element.id, { width, height });
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const resizeHandle =
    canEdit && isSelected ? (
      <div
        onPointerDown={startResize}
        style={{
          ...styles.resizeHandle,
          cursor: element.type === 'line' ? 'ew-resize' : 'nwse-resize',
        }}
        title="드래그해서 크기 조절"
      />
    ) : null;

  const deleteButton =
    canEdit && isSelected ? (
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          deleteElement(element.id);
        }}
        style={styles.deleteBtn}
        title="삭제"
      >
        <Trash2 size={12} />
      </button>
    ) : null;

  if (element.type === 'draw') {
    const width = Math.max(element.width, 1);
    const height = Math.max(element.height, 1);
    const stroke = element.strokeWidth || 4;
    return (
      <svg
        style={{
          position: 'absolute',
          left: element.x - stroke,
          top: element.y - stroke,
          width: width + stroke * 2,
          height: height + stroke * 2,
          zIndex: element.zIndex,
          overflow: 'visible',
          pointerEvents: canEdit ? 'auto' : 'none',
          cursor: canEdit ? 'move' : 'default',
          ...selectionRing,
        }}
        onPointerDown={handlePointerDown}
      >
        <polyline
          points={pointsToSvg(element.points || [])}
          transform={`translate(${stroke}, ${stroke})`}
          fill="none"
          stroke={element.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    cursor: canEdit ? 'move' : 'default',
    ...selectionRing,
  };

  if (element.type === 'rect' || element.type === 'ellipse' || element.type === 'line') {
    const stroke = element.strokeWidth || 3;

    // Keep the `border` shorthand and its longhands apart. Setting
    // `borderTop: undefined` alongside `border` made React clear the top edge,
    // which is why rectangles and circles looked sliced off at the top.
    const shapeStyle: React.CSSProperties =
      element.type === 'line'
        ? {
            ...baseStyle,
            height: 0,
            borderTop: `${stroke}px solid ${element.color}`,
            background: 'transparent',
          }
        : {
            ...baseStyle,
            border: `${stroke}px solid ${element.color}`,
            borderRadius: element.type === 'ellipse' ? '50%' : 12,
            background: `${element.color}12`,
          };

    return (
      <div style={shapeStyle} onPointerDown={handlePointerDown}>
        {deleteButton}
        {resizeHandle}
      </div>
    );
  }

  if (element.type === 'text') {
    return (
      <div style={baseStyle} onPointerDown={handlePointerDown} onDoubleClick={() => canEdit && setIsEditingText(true)}>
        {isEditingText ? (
          <textarea
            ref={textareaRef}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitText}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="텍스트 입력"
            style={{ ...styles.textArea, color: element.color, fontWeight: 700, fontSize: '1.05rem' }}
          />
        ) : (
          <div style={{ ...styles.textDisplay, color: element.color }}>
            {element.text || '텍스트'}
          </div>
        )}
        {deleteButton}
        {authorTag}
      </div>
    );
  }

  // Sticky note
  return (
    <div
      style={{
        ...baseStyle,
        background: '#ffffff',
        borderRadius: 14,
        border: `1px solid ${element.color}33`,
        borderTop: `6px solid ${element.color}`,
        boxShadow: '0 10px 24px rgba(22, 50, 74, 0.12)',
        padding: '14px 14px 22px 14px',
        display: 'flex',
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={() => canEdit && setIsEditingText(true)}
    >
      {isEditingText ? (
        <textarea
          ref={textareaRef}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={commitText}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="내용을 입력하세요"
          style={styles.textArea}
        />
      ) : (
        <div style={{ ...styles.noteText, opacity: element.text ? 1 : 0.45 }}>
          {element.text || '더블클릭해서 작성'}
        </div>
      )}
      {deleteButton}
      {authorTag}
    </div>
  );
};

// Canvas re-renders on every pointer move while drawing, so skip untouched elements
export const SandboxElementView = React.memo(SandboxElementViewBase);

const styles: Record<string, React.CSSProperties> = {
  textArea: {
    width: '100%',
    height: '100%',
    resize: 'none',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: 'var(--card-text)',
  },
  noteText: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: 'var(--card-text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  textDisplay: {
    width: '100%',
    height: '100%',
    fontSize: '1.05rem',
    fontWeight: 700,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  authorTag: {
    position: 'absolute',
    bottom: -10,
    left: 10,
    padding: '2px 9px',
    borderRadius: 999,
    fontSize: '0.62rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    maxWidth: '80%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resizeHandle: {
    position: 'absolute',
    right: -7,
    bottom: -7,
    width: 14,
    height: 14,
    borderRadius: 4,
    background: 'var(--color-primary)',
    border: '2px solid #ffffff',
    boxShadow: '0 2px 6px rgba(22, 50, 74, 0.3)',
    touchAction: 'none',
  },
  deleteBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: 'none',
    background: '#ef4444',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(239, 68, 68, 0.35)',
  },
};
