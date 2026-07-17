import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * A minimal horizontal split pane with a draggable divider. Used for the
 * sidebar / main / console layout. No dependency — keeps the bundle lean.
 */
export function ResizablePanels({
  left,
  right,
  initialLeft = 320,
  minLeft = 200,
  maxLeft = 720,
}: {
  left: ReactNode;
  right: ReactNode;
  initialLeft?: number;
  minLeft?: number;
  maxLeft?: number;
}) {
  const [width, setWidth] = useState(initialLeft);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = Math.min(maxLeft, Math.max(minLeft, e.clientX - rect.left));
      setWidth(next);
    },
    [minLeft, maxLeft],
  );

  const stop = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stop);
    };
  }, [onMove, stop]);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div style={{ width }} className="h-full shrink-0 overflow-hidden">
        {left}
      </div>
      <div
        className="w-1 cursor-col-resize bg-base-700 hover:bg-accent transition-colors shrink-0"
        onMouseDown={() => {
          dragging.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
      />
      <div className="h-full flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
