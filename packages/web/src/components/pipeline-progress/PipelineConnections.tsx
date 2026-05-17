/**
 * PipelineConnections — SVG overlay that draws animated connection lines
 * between pipeline stage rows.
 *
 * Three visual states per connection:
 *   pending  — dim colour, solid line
 *   flowing  — primary colour, animated dashed line (upstream done, downstream running)
 *   done     — success colour, solid line
 */
import GlobalStyles from '@mui/material/GlobalStyles';
import { useTheme } from '@mui/material/styles';
import type { ConnectionGeometry, SvgDimensions } from '../../hooks/usePipelineConnections.js';
import type { StageStatus } from '../../hooks/usePipelineProgress.js';

/** Half-width of the arrowhead triangle (px). */
const ARROWHEAD_HALF_WIDTH_PX = 5;

/** Height of the arrowhead triangle (px). */
const ARROWHEAD_HEIGHT_PX = 8;

/** Stroke width of each connection line (px). */
const CONNECTION_STROKE_WIDTH_PX = 2;

/** Dash + gap pattern for flowing connections (px): "dash gap". */
const FLOWING_DASH_PATTERN = '7 4';

/**
 * Total length of one dash+gap cycle (px).
 * Must equal the sum of values in FLOWING_DASH_PATTERN.
 * Used as the starting stroke-dashoffset so the animation loops seamlessly.
 */
export const FLOWING_DASH_CYCLE_PX = 11;

/** Duration of one flowing-dash animation cycle. */
const FLOWING_DASH_DURATION = '0.55s';

interface Props {
  geoms: ConnectionGeometry[];
  svgDims: SvgDimensions;
  rowStatuses: StageStatus[];
}

export function PipelineConnections({ geoms, svgDims, rowStatuses }: Props) {
  const theme = useTheme();

  const pickColor = (upstream: StageStatus, downstream: StageStatus): string => {
    if (downstream === 'done') return theme.palette.success.main;
    if (upstream === 'done') return theme.palette.primary.main;
    return theme.palette.action.disabled;
  };

  return (
    <>
      <GlobalStyles
        styles={{
          '@keyframes flow-dash': {
            from: { strokeDashoffset: FLOWING_DASH_CYCLE_PX },
            to: { strokeDashoffset: 0 },
          },
        }}
      />

      {svgDims.width > 0 && geoms.length > 0 && (
        <svg
          width={svgDims.width}
          height={svgDims.height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 0,
          }}
          aria-hidden="true"
        >
          {geoms.map((geom, connectionIndex) => {
            const upstream = rowStatuses[connectionIndex];
            const downstream = rowStatuses[connectionIndex + 1];
            const color = pickColor(upstream, downstream);
            const isFlowing = upstream === 'done' && downstream !== 'done';

            // Arrowhead tip at (x2, y2); line trunk ends at the triangle base.
            const arrowBaseY = geom.y2 - ARROWHEAD_HEIGHT_PX;
            const arrowPoints = [
              `${geom.x2},${geom.y2}`,
              `${geom.x2 - ARROWHEAD_HALF_WIDTH_PX},${arrowBaseY}`,
              `${geom.x2 + ARROWHEAD_HALF_WIDTH_PX},${arrowBaseY}`,
            ].join(' ');

            const connectionKey = `${geom.x1}-${geom.y1}-${geom.x2}-${geom.y2}`;
            return (
              <g key={connectionKey}>
                <line
                  x1={geom.x1}
                  y1={geom.y1}
                  x2={geom.x2}
                  y2={arrowBaseY}
                  stroke={color}
                  strokeWidth={CONNECTION_STROKE_WIDTH_PX}
                  strokeDasharray={isFlowing ? FLOWING_DASH_PATTERN : undefined}
                  style={
                    isFlowing
                      ? { animation: `flow-dash ${FLOWING_DASH_DURATION} linear infinite` }
                      : { transition: 'stroke 0.4s ease' }
                  }
                />
                <polygon
                  points={arrowPoints}
                  fill={color}
                  style={{ transition: 'fill 0.4s ease' }}
                />
              </g>
            );
          })}
        </svg>
      )}
    </>
  );
}
