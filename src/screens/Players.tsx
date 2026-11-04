import { useState } from 'react';
import { progressStore, totalStars, useProgressState } from '../shared/progress';
import { go, toHref } from '../shared/router';
import { sfx } from '../shared/sound';
import { Icon, PressButton, Screen } from '../shared/ui';
import { Avatar, Wordmark } from './parts/Art';
import { AddChild, bandText } from './parts/AddChild';
import './screens.css';

/**
 * Who's playing (design/canvas/Main.dc.html): pick a child's brick, then Play. On the first run,
 * with nobody set up yet, it asks for the first child's name and age band right here.
 */
export default function Players() {
  const state = useProgressState();
  const [selected, setSelected] = useState<string | null>(state.activePlayerId ?? state.players[0]?.id ?? null);
  const current = state.players.find((p) => p.id === selected) ?? state.players[0] ?? null;

  if (state.players.length === 0) {
    return (
      <Screen padding="roomy" gap={18}>
        <Wordmark size="lg" />
        <h1 className="sc-players__title">Who's playing?</h1>
        <AddChild
          heading="Add your first child"
          onAdded={(p) => {
            progressStore.setActivePlayer(p.id);
            go('/');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen padding="roomy" gap={18}>
      <Wordmark size="lg" />
      <h1 className="sc-players__title">Who's playing?</h1>
      <div className="sc-scroll">
        <div className="sc-players">
          {state.players.map((p) => {
            const stars = totalStars(p);
            return (
              <button
                key={p.id}
                type="button"
                className="sc-player"
                aria-pressed={p.id === current?.id}
                onClick={() => {
                  sfx.tap();
                  setSelected(p.id);
                }}
              >
                <Avatar name={p.name} color={p.color} size={76} radius={22} fontSize={38} />
                <span className="sc-player__name">{p.name}</span>
                <span className="sc-player__meta">
                  {bandText(p.ageBand)} · {stars} {stars === 1 ? 'star' : 'stars'}
                </span>
              </button>
            );
          })}
          <a className="sc-add" href={toHref('/settings')}>
            <span className="sc-add__plus">
              <Icon name="plus" size={30} strokeWidth={3} />
            </span>
            <span className="sc-add__title">Add a child</span>
            <span className="sc-helper">A grown-up adds children in Settings</span>
          </a>
        </div>
      </div>
      <p className="sc-sub sc-center">Each child keeps their own stars, levels and timer.</p>
      {current && (
        <PressButton variant="green" size="xl" icon="play" iconEnd block href={toHref('/')} onClick={() => progressStore.setActivePlayer(current.id)}>
          Play as {current.name}
        </PressButton>
      )}
    </Screen>
  );
}
