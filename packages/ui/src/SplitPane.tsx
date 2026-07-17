import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Horizontal resizable split pane with a draggable divider. Redesigned with a
 * subtler divider that highlights on hover/drag.
 */
export function SplitPane({
  left,
  right,
  initialLeft = 300,
  minLeft = 200,
  maxLeft = 560,
}: {
  left: ReactNode;
  right: ReactNode;
  initialLeft?: number;
  minLeft?: number;
  maxLeft?: number;
}) {
  const [width, setWidth] = useState(initialLeft);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setWidth(Math.min(maxLeft, Math.max(minLeft, e.clientX - rect.left)));
    },
    [minLeft, maxLeft],
  );

  useEffect(() => {
    if (!dragging) return;
    const up = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, onMove]);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div style={{ width }} className="h-full shrink-0 overflow-hidden">
        {left}
      </div>
      <div
        onMouseDown={() => {
          setDragging(true);
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        className={`w-px shrink-0 cursor-col-resize relative group ${dragging ? '' : ''}`}
        style={{ background: 'var(--border-subtle)' }}
      >
        <div
          className={`absolute inset-y-0 -left-1 -right-1 transition-colors ${dragging ? 'bg-indigo-500/30' : 'group-hover:bg-indigo-500/15'}`}
        />
      </div>
      <div className="h-full flex-1 min-w-0 overflow-hidden">{right}</div>
    </div>
  );
}
