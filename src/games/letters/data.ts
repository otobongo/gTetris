/* Letter Builder content: letter colors, the curated kid-safe word list and letter groups.
   Everything here is plain data so it can be tested without a browser. */

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type BrickColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink';

const CYCLE: BrickColor[] = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

/** Every letter keeps the same brick color everywhere in the game (A and a share it). */
export function letterColor(ch: string): BrickColor {
  const i = ALPHABET.indexOf(ch.toUpperCase());
  return CYCLE[(i < 0 ? 0 : i) % CYCLE.length];
}

export interface Word {
  word: string;
  emoji: string;
}

/** Curated, kid-safe words. Grouped by length; CVC = consonant, short vowel, consonant (easiest to sound out). */
export const CVC: Word[] = [
  { word: 'cat', emoji: '🐱' },
  { word: 'dog', emoji: '🐶' },
  { word: 'sun', emoji: '☀️' },
  { word: 'bus', emoji: '🚌' },
  { word: 'pig', emoji: '🐷' },
  { word: 'hat', emoji: '🎩' },
  { word: 'bed', emoji: '🛏️' },
  { word: 'box', emoji: '📦' },
  { word: 'fox', emoji: '🦊' },
  { word: 'bat', emoji: '🦇' },
  { word: 'map', emoji: '🗺️' },
  { word: 'web', emoji: '🕸️' },
  { word: 'net', emoji: '🥅' },
  { word: 'van', emoji: '🚐' },
  { word: 'hen', emoji: '🐔' },
  { word: 'bug', emoji: '🐛' },
  { word: 'pan', emoji: '🍳' },
  { word: 'pen', emoji: '🖊️' },
  { word: 'cup', emoji: '🥤' },
  { word: 'cap', emoji: '🧢' },
  { word: 'tub', emoji: '🛁' },
  { word: 'nut', emoji: '🥜' },
  { word: 'leg', emoji: '🦵' },
];

export const THREE: Word[] = [
  { word: 'cow', emoji: '🐮' },
  { word: 'ant', emoji: '🐜' },
  { word: 'egg', emoji: '🥚' },
  { word: 'car', emoji: '🚗' },
  { word: 'key', emoji: '🔑' },
  { word: 'bee', emoji: '🐝' },
  { word: 'owl', emoji: '🦉' },
  { word: 'pie', emoji: '🥧' },
  { word: 'bow', emoji: '🎀' },
];

export const FOUR: Word[] = [
  { word: 'fish', emoji: '🐟' },
  { word: 'frog', emoji: '🐸' },
  { word: 'cake', emoji: '🎂' },
  { word: 'duck', emoji: '🦆' },
  { word: 'bear', emoji: '🐻' },
  { word: 'ball', emoji: '⚽' },
  { word: 'star', emoji: '⭐' },
  { word: 'moon', emoji: '🌙' },
  { word: 'tree', emoji: '🌳' },
  { word: 'boat', emoji: '⛵' },
  { word: 'bird', emoji: '🐦' },
  { word: 'lion', emoji: '🦁' },
  { word: 'milk', emoji: '🥛' },
  { word: 'corn', emoji: '🌽' },
  { word: 'sock', emoji: '🧦' },
  { word: 'ship', emoji: '🚢' },
  { word: 'drum', emoji: '🥁' },
  { word: 'bell', emoji: '🔔' },
  { word: 'leaf', emoji: '🍃' },
  { word: 'snow', emoji: '❄️' },
  { word: 'door', emoji: '🚪' },
  { word: 'hand', emoji: '✋' },
  { word: 'foot', emoji: '🦶' },
  { word: 'nose', emoji: '👃' },
  { word: 'book', emoji: '📖' },
  { word: 'crab', emoji: '🦀' },
  { word: 'goat', emoji: '🐐' },
  { word: 'wolf', emoji: '🐺' },
  { word: 'pear', emoji: '🍐' },
  { word: 'kiwi', emoji: '🥝' },
  { word: 'bike', emoji: '🚲' },
  { word: 'gift', emoji: '🎁' },
  { word: 'ring', emoji: '💍' },
  { word: 'coat', emoji: '🧥' },
  { word: 'rose', emoji: '🌹' },
];

export const FIVE: Word[] = [
  { word: 'apple', emoji: '🍎' },
  { word: 'horse', emoji: '🐴' },
  { word: 'mouse', emoji: '🐭' },
  { word: 'house', emoji: '🏠' },
  { word: 'train', emoji: '🚂' },
  { word: 'snake', emoji: '🐍' },
  { word: 'tiger', emoji: '🐯' },
  { word: 'zebra', emoji: '🦓' },
  { word: 'clock', emoji: '🕐' },
  { word: 'crown', emoji: '👑' },
  { word: 'pizza', emoji: '🍕' },
  { word: 'robot', emoji: '🤖' },
  { word: 'sheep', emoji: '🐑' },
  { word: 'whale', emoji: '🐳' },
  { word: 'shark', emoji: '🦈' },
  { word: 'panda', emoji: '🐼' },
  { word: 'koala', emoji: '🐨' },
  { word: 'camel', emoji: '🐫' },
  { word: 'bread', emoji: '🍞' },
  { word: 'grape', emoji: '🍇' },
  { word: 'lemon', emoji: '🍋' },
  { word: 'chick', emoji: '🐤' },
  { word: 'plant', emoji: '🌱' },
  { word: 'cloud', emoji: '☁️' },
  { word: 'truck', emoji: '🚚' },
  { word: 'plane', emoji: '✈️' },
  { word: 'candy', emoji: '🍬' },
  { word: 'heart', emoji: '❤️' },
  { word: 'spoon', emoji: '🥄' },
];

export const SIX: Word[] = [
  { word: 'rabbit', emoji: '🐰' },
  { word: 'turtle', emoji: '🐢' },
  { word: 'monkey', emoji: '🐵' },
  { word: 'banana', emoji: '🍌' },
  { word: 'carrot', emoji: '🥕' },
  { word: 'rocket', emoji: '🚀' },
  { word: 'flower', emoji: '🌸' },
  { word: 'cookie', emoji: '🍪' },
  { word: 'castle', emoji: '🏰' },
  { word: 'pencil', emoji: '✏️' },
  { word: 'orange', emoji: '🍊' },
  { word: 'parrot', emoji: '🦜' },
  { word: 'guitar', emoji: '🎸' },
  { word: 'cheese', emoji: '🧀' },
];

export const ALL_WORDS: Word[] = [...CVC, ...THREE, ...FOUR, ...FIVE, ...SIX];

/** Letters that make the same sound at the start of a word. Never offer one of these as a "wrong" choice
    for the other, or a child who sounds a word out correctly (k-a-t) would be marked wrong. */
export const SOUND_ALIKE: string[][] = [
  ['C', 'K', 'Q'],
  ['C', 'S'],
  ['G', 'J'],
  ['S', 'Z'],
  ['X', 'Z'],
];

export function soundsAlike(a: string, b: string): boolean {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (A === B) return true;
  return SOUND_ALIKE.some((g) => g.includes(A) && g.includes(B));
}

/** Words whose first letter makes its usual sound, so "which letter does it start with?" has one fair answer.
    Leaves out digraphs (sh, ch, wh, th), soft c/g and vowels that do not say their short sound. */
const VOWEL_OK = new Set(['apple', 'ant', 'egg']);
export function hasClearFirstSound(word: string): boolean {
  const w = word.toLowerCase();
  if (/^(sh|ch|wh|th|ph|kn|wr)/.test(w)) return false;
  if (/^c[eiy]/.test(w) || /^g[eiy]/.test(w)) return false;
  if (/^[aeiou]/.test(w)) return VOWEL_OK.has(w);
  return true;
}

/** Upper and lower case look alike: the gentle start for matching. */
export const LOOK_ALIKE = 'CKOPSUVWXZ'.split('');
/** Lowercase letters kids most often mix up. */
export const TRICKY = 'BDPQ'.split('');
