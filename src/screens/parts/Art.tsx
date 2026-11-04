import type { CSSProperties } from 'react';
import { ART_BOX, type ArtPiece } from '../../games/registry';
import { Brick, type BrickColor } from '../../shared/ui';
import type { AvatarColor } from '../../shared/progress';
import { stickerCells, type Sticker } from '../logic/stickers';

/** A Home card's 56 x 44 art box (registry art), scaled when `scale` is set. Decorative. */
export function GameArt({ art, scale = 1 }: { art: readonly ArtPiece[]; scale?: number }) {
  return (
    <span className="sc-art" aria-hidden="true" style={{ width: ART_BOX.width * scale, height: ART_BOX.height * scale }}>
      {art.map((a, i) => {
        const pos: CSSProperties = { left: a.x * scale, top: a.y * scale, width: a.w * scale, height: a.h * scale };
        if (a.kind === 'brick') {
          return (
            <Brick
              key={i}
              color={a.color ?? 'red'}
              stud={a.stud ? a.stud * scale : undefined}
              width={a.w * scale}
              height={a.h * scale}
              radius={5 * scale}
              className="sc-art__piece"
              style={{ ...pos, fontSize: (a.fontSize ?? 15) * scale }}
            >
              {a.text}
            </Brick>
          );
        }
        if (a.kind === 'glyph') {
          return (
            <span key={i} className="sc-art__piece sc-art__glyph" style={{ ...pos, fontSize: (a.fontSize ?? 20) * scale }}>
              {a.text}
            </span>
          );
        }
        return (
          <span
            key={i}
            className={`sc-art__piece sc-art__${a.kind}${a.blend ? ' sc-art__blend' : ''}`}
            data-brick={a.color}
            style={{ ...pos, borderRadius: a.kind === 'tile' ? (a.radius ?? 4) * scale : undefined }}
          />
        );
      })}
    </span>
  );
}

/** A child's brick: their colour and initial (avatars on Home, Who's playing, Break, Settings). */
export function Avatar({ name, color, size, radius, fontSize }: { name: string; color: AvatarColor | BrickColor; size: number; radius: number; fontSize: number }) {
  return (
    <Brick color={color} width={size} height={size} radius={radius} className="sc-avatar" style={{ fontSize }}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </Brick>
  );
}

/** The four-brick logo and wordmark (Who's playing, Sign in, Sign up). */
export function Wordmark({ size = 'md', as = 'div' }: { size?: 'md' | 'lg'; as?: 'div' | 'h1' }) {
  const Tag = as;
  return (
    <div className={`sc-wordmark sc-wordmark--${size}`}>
      <span className="sc-wordmark__bricks" aria-hidden="true">
        {(['red', 'yellow', 'green', 'blue'] as const).map((c) =>
          size === 'lg' ? <Brick key={c} color={c} stud={13} cols={2} rows={2} radius={6} /> : <span key={c} className="sc-wordmark__dot" data-brick={c} />,
        )}
      </span>
      <Tag className="sc-wordmark__name">Brickwise</Tag>
    </div>
  );
}

/** Sticker art: the 5 x 5 brick mosaic, in colour when earned, as a silhouette when not. */
export function Mosaic({ sticker, got, cell, gap }: { sticker: Sticker; got: boolean; cell: number; gap: number }) {
  return (
    <span className="sc-mosaic" style={{ gridTemplateColumns: `repeat(5, ${cell}px)`, gridAutoRows: `${cell}px`, gap }} aria-hidden="true">
      {stickerCells(sticker).map((c, i) =>
        !c ? <span key={i} /> : got ? <Brick key={i} color={c} stud={cell} radius={2} /> : <span key={i} className="sc-mosaic__ghost" />,
      )}
    </span>
  );
}
