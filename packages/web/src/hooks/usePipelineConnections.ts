/**
 * usePipelineConnections — measures the screen geometry of each pipeline row
 * and exposes SVG-ready connection coordinates.
 *
 * A ResizeObserver keeps measurements current whenever the container resizes
 * (viewport change, panel open/close, etc.).
 */
import type { MutableRefObject, RefObject } from 'react';
import { useCallback, useLayoutEffect, useState } from 'react';

/** Diagram-relative pixel coordinates of one connection line. */
export interface ConnectionGeometry {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Width/height of the SVG overlay that covers the diagram container. */
export interface SvgDimensions {
  readonly width: number;
  readonly height: number;
}

export function usePipelineConnections(
  diagramRef: RefObject<HTMLDivElement | null>,
  rowEls: MutableRefObject<(HTMLDivElement | null)[]>,
  rowCount: number,
): { geoms: ConnectionGeometry[]; svgDims: SvgDimensions } {
  const [geoms, setGeoms] = useState<ConnectionGeometry[]>([]);
  const [svgDims, setSvgDims] = useState<SvgDimensions>({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    const diagramRect = diagram.getBoundingClientRect();
    setSvgDims({ width: diagramRect.width, height: diagramRect.height });

    const newGeoms: ConnectionGeometry[] = [];
    for (let connectionIndex = 0; connectionIndex < rowCount - 1; connectionIndex++) {
      const fromEl = rowEls.current[connectionIndex];
      const toEl = rowEls.current[connectionIndex + 1];
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      newGeoms.push({
        x1: fromRect.left + fromRect.width / 2 - diagramRect.left,
        y1: fromRect.bottom - diagramRect.top,
        x2: toRect.left + toRect.width / 2 - diagramRect.left,
        y2: toRect.top - diagramRect.top,
      });
    }
    setGeoms(newGeoms);
  }, [diagramRef, rowEls, rowCount]);

  // Measure synchronously after DOM commit, then track resizes.
  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    const diagram = diagramRef.current;
    if (diagram) observer.observe(diagram);
    return () => observer.disconnect();
  }, [measure, diagramRef]);

  return { geoms, svgDims };
}
