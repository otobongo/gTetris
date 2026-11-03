import { PIECES, boundsOf, shapeOf, type PieceId } from './pieces';

/** Small static picture of a brick (spawn orientation). Built from spans so it can sit inside text. */
export function MiniPiece({ id, size, dim }: { id: PieceId | null; size: number; dim?: boolean }) {
  if (!id) return <span className="drop-mini" style={{ width: size * 2, height: size * 2 }} />;
  const cells = shapeOf(id, 0);
  const b = boundsOf(cells);
  return (
    <span
      className={`drop-mini${dim ? ' is-dim' : ''}`}
      style={{ width: b.w * size, height: b.h * size }}
      role="img"
      aria-label={PIECES[id].name}
    >
      {cells.map(([x, y]) => (
        <span
          key={`${x},${y}`}
          className="brick brick--studs drop-mini__cell"
          data-color={PIECES[id].color}
          style={{ left: (x - b.minX) * size, top: (y - b.minY) * size, width: size - 1, height: size - 1 }}
        />
      ))}
    </span>
  );
}
