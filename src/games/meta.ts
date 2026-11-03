/** Level counts and chapters a game publishes for Home and the Levels screen. */
export interface Chapter {
  title: string;
  /** Short inline note after the heading (14/700). Empty when there is none. */
  note: string;
  /** First level of the chapter, as a 0-based index. */
  start: number;
  /** Number of levels in the chapter. */
  count: number;
  /** Open-ended chapter: Levels shows a "More soon" tile after its levels. */
  more?: boolean;
}

export interface GameMeta {
  levelCount: number;
  chapters: Chapter[];
}
