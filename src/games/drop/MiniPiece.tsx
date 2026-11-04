import { Brick } from '../../shared/ui';
import { PIECES, boundsOf, shapeOf, type PieceId } from './pieces';

/**
 * Small static picture of a brick in its spawn orientation, one stud per square. With a box it
 * shrinks to fit and sits centred in it (the Next tile uses 76 x 40, squares of 18px at most:
 * 16px bricks with a 2px gap).
 */
export function MiniPiece({ id, unit = 18, boxW, boxH, dim }: { id: PieceId; unit?: number; boxW?: number; boxH?: number; dim?: boolean }) {
  const cells = shapeOf(id, 0);
  const b = boundsOf(cells);
  const pitch = Math.max(6, Math.min(unit, boxW ? Math.floor(boxW / b.w) : unit, boxH ? Math.floor(boxH / b.h) : unit));
  const w = b.w * pitch;
  const h = b.h * pitch;
  return (
    <span
      className={`drop-mini${dim ? ' is-dim' : ''}`}
      style={{ width: boxW ?? w, height: boxH ?? h }}
      role="img"
      aria-label={PIECES[id].name}
    >
      <span className="drop-mini__fit" style={{ width: w, height: h }}>
        {cells.map(([x, y]) => (
          <Brick
            key={`${x},${y}`}
            color={PIECES[id].color}
            stud={pitch - 2}
            radius={4}
            style={{ position: 'absolute', left: (x - b.minX) * pitch + 1, top: (y - b.minY) * pitch + 1 }}
          />
        ))}
      </span>
    </span>
  );
}
