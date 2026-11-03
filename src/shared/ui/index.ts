/**
 * Shared UI. One component per file; values come from src/styles/tokens.css.
 * New screens use Screen, TopBar, PressButton, IconButton, Panel, Pill and Brick.
 * Stars, ResultCard and LevelGrid are the games' current pieces (legacy.tsx), kept until the games move off them.
 */
import './ui.css';

export { Brick, type BrickProps } from './Brick';
export { PressButton, type PressButtonProps, type PressSize, type PressVariant } from './PressButton';
export { IconButton, type IconButtonProps } from './IconButton';
export { TopBar, type TopBarProps } from './TopBar';
export { Panel, type PanelProps } from './Panel';
export { Pill, type PillProps } from './Pill';
export { Screen, type ScreenProps } from './Screen';
export { Icon, type IconName, type IconProps } from './Icon';
export { useLayout, computeLayout, TABLET_INNER, TABLET_MIN_WIDTH, type Layout } from './layout';
export { BRICK_COLORS, PALETTE, type BrickColor } from './palette';
export { cx } from './cx';
export { LevelGrid, ResultCard, Stars } from './legacy';
