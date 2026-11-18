/* Pattern Train's drawn parts (six-games brief 7.6): a car's shape, the locomotive, the cars on their rail, and the
   ghost of the last train that slides out on Next. All of it is decoration for the one role="img" row. */
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import type { Car, ShapeId } from './cars';
import type { TrainSlot } from './play';

/** The ghost leaves over --bw-base (200 ms); this is the longest it stays if animationend never fires. */
const GHOST_MAX_MS = 260;

/** Each shape in a 30 unit box, the board's outlines: the triangle and the star are the points the old clip-paths named. */
const OUTLINE: Record<ShapeId, ReactElement> = {
  circle: <circle cx="15" cy="15" r="15" />,
  square: <rect width="30" height="30" rx="6" />,
  triangle: <polygon points="15,1.2 29.4,28.2 0.6,28.2" />,
  star: <polygon points="15,0 18.3,10.5 29.4,10.5 20.4,17.1 23.7,27.3 15,21 6.3,27.3 9.6,17.1 0.6,10.5 11.7,10.5" />,
};

/**
 * A car's shape in its colour, with the --bw-purple-edge outline (pattern.css paints both). Size comes from --pat-shape
 * (36px in a car, 46px on a choice); the drawing scales with it.
 */
export function Shape({ car }: { car: Car }) {
  return (
    <svg className="pat-shape" data-shape={car.shape} data-color={car.color} viewBox="0 0 30 30" aria-hidden="true">
      {OUTLINE[car.shape]}
    </svg>
  );
}

function Cars({ slots }: { slots: readonly TrainSlot[] }) {
  return (
    <>
      <div className="pat-loco" aria-hidden="true">
        <span className="pat-loco__stack" />
        <span className="pat-loco__body" />
        <span className="pat-loco__window" />
        <span className="pat-wheel pat-wheel--loco pat-wheel--left" />
        <span className="pat-wheel pat-wheel--loco pat-wheel--right" />
      </div>
      {slots.map((slot, i) => (
        <div key={i} className="pat-car" aria-hidden="true">
          <span className={`pat-car__body is-${slot.state}`}>{slot.car && <Shape car={slot.car} />}</span>
          <span className="pat-wheel pat-wheel--left" />
          <span className="pat-wheel pat-wheel--right" />
        </div>
      ))}
    </>
  );
}

export interface TrainProps {
  /** The cars after the locomotive; none draws the locomotive alone (the finished state). */
  slots: readonly TrainSlot[];
  /** The row's name for assistive tech ("Train: red circle, ..., empty car."). Without it the whole row is hidden from them. */
  label?: string;
  /** The last puzzle's train, when this one arrives on Next: it slides out to the right while the new one fades in (350 ms in all). */
  ghost?: readonly TrainSlot[];
  /** The zoom for this train and its ghost (play.ts `trainZoom`); without it the CSS draws 0.78. */
  zoom?: number;
}

/**
 * The train on its rail. Give it a new key for each puzzle (PlayScreen does, for everything in its top): the ghost
 * and the arrival run once as it mounts. Neither takes a tap: the ghost has no pointer events and the choices
 * below are live from the first frame. Under reduced motion the ghost is not drawn and the new train just fades.
 */
export function Train({ slots, label, ghost, zoom }: TrainProps) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ghost) return;
    const id = window.setTimeout(() => setGone(true), GHOST_MAX_MS);
    return () => window.clearTimeout(id);
  }, [ghost]);

  return (
    <div className="pat-rail-wrap" style={zoom === undefined ? undefined : ({ '--pat-train-zoom': zoom } as CSSProperties)}>
      <div
        className={ghost ? 'pat-train is-arriving' : 'pat-train'}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <Cars slots={slots} />
      </div>
      {ghost && !gone && (
        <div className="pat-train pat-ghost" aria-hidden="true" onAnimationEnd={() => setGone(true)}>
          <Cars slots={ghost} />
        </div>
      )}
      <div className="pat-rail" aria-hidden="true" />
    </div>
  );
}
