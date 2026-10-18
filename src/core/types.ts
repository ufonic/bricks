export const BOARD_SIZE = 8;

export type ColorId = 'yellow' | 'blue' | 'orange' | 'green' | 'red' | 'purple' | 'cyan';
export type Tier = 'easy' | 'medium' | 'hard';
export type Coord = [number, number];

/** `start` marks a pre-placed level obstacle (counts toward "Clear blocks"). */
export type Cell =
  | { kind: 'empty' }
  | { kind: 'block'; color: ColorId; start?: boolean }
  | { kind: 'gem'; color: ColorId }
  | { kind: 'stone'; hp: 1 | 2 }
  | { kind: 'lock' };

export type Board = Cell[][];

/** A piece shape: one orientation of a family, with cells normalized to (0,0). */
export interface Shape {
  id: string;
  cells: Coord[];
  tier: Tier;
  weight: number;
  rows: number;
  cols: number;
}

export interface Piece {
  id: string;
  cells: Coord[];
  tier: Tier;
  color: ColorId;
}

export type TierWeights = Record<Tier, number>;

export type GameMode = 'level' | 'endless' | 'daily';
export type ObjectiveType = 'score' | 'lines' | 'clearBlocks' | 'gems';
export type Mechanic = 'lines' | 'clearBlocks' | 'gems' | 'moves' | 'stone' | 'lock';

export interface Objective {
  type: ObjectiveType;
  target: number;
}

/** Everything about a level that the game needs once it has started. */
export interface LevelInfo {
  objectives: Objective[];
  moveLimit: number | null;
  /** Placements the bot needed to meet the goal; stars compare the player's moves to it. */
  parMoves: number;
  difficulty: number;
  boss: boolean;
  breather: boolean;
  /** Mechanics present, used for first-time tips. */
  mechanics: Mechanic[];
}

export interface Progress {
  lines: number;
  gems: number;
  /** Starting cells (blocks, gems, stones) removed. */
  blocksCleared: number;
}

export type GameStatus = 'playing' | 'won' | 'lost' | 'over';

export interface Snapshot {
  board: Board;
  tray: (Piece | null)[];
  score: number;
  combo: number;
  movesUsed: number;
  rngState: number;
  progress: Progress;
  goalMet: boolean;
  tierWeights: TierWeights;
}

export interface GameState extends Snapshot {
  mode: GameMode;
  levelNumber?: number;
  dailyDate?: string;
  level: LevelInfo | null;
  status: GameStatus;
  undoStack: Snapshot[];
  undosUsed: number;
  /** Starting cells at the beginning, for "Clear blocks" progress. */
  startCells: number;
}

export interface ClearedCell {
  row: number;
  col: number;
  before: Cell;
  after: Cell;
}

export type GameEvent =
  | { type: 'invalid' }
  | { type: 'placed'; pieceIndex: number; row: number; col: number; cells: Coord[]; color: ColorId; points: number }
  | {
      type: 'linesCleared';
      rows: number[];
      cols: number[];
      cells: ClearedCell[];
      lines: number;
      combo: number;
      points: number;
    }
  | { type: 'boardClear'; points: number }
  | { type: 'gemsCollected'; count: number }
  | { type: 'dealt' }
  | { type: 'objectiveMet' }
  | { type: 'gameOver'; status: GameStatus };
