export enum GameState {
  START = 0,
  TUTORIAL = 1,
  PLAYING = 2,
  PAUSED = 3,
  GAME_OVER = 4,
  VICTORY = 5,
}

export enum MaskType {
  NONE = 0,
  CHILD = 1,
  STUDENT = 2,
  WORKER = 3,
  SOCIAL = 4,
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  type?: "block" | "spike" | "goal" | "wall" | "memory";
  text?: string; // Human-readable label (kept for accessibility / debug)
  icon?: string; // Optional semantic glyph key (used for canvas pictogram)  icons?: string[];     // Optional: multiple semantic glyphs to compose a single obstacle  reqMask?: MaskType; // Mask required to pass the wall
  collected?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface BackgroundElement {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
  shape: "circle" | "rect";
}

export interface LevelConfig {
  id: number;
  name: string;
  bgGradient: [string, string];
  groundColor: string;
  reqMask: MaskType;
  message: string;
  obstacleType: string;
  length: number;
}

export const GRAVITY = 0.6;
export const JUMP_FORCE = -12;
export const SPEED = 5;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 450;
export const GROUND_HEIGHT = 50;
export const MAX_INTEGRITY = 100;
export const TOTAL_MEMORIES = 5;

// Leaderboard / per-level timing
export interface LevelTimeEntry {
  levelId: number;
  levelName: string;
  timeMs: number; // duration in milliseconds
  timestamp: number; // Date.now() when completed
}

export const TIMES_STORAGE_KEY = "htvn_level_times";

// Campaign (20-level) leaderboard — stores full-run times for pre-generated campaigns
export interface CampaignRunEntry {
  runId: string; // unique id for the run (uuid or timestamp string)
  totalTimeMs: number; // total campaign time in ms
  levels: number; // number of levels in the run (e.g. 20)
  timestamp: number; // Date.now() when completed
}

export const CAMPAIGN_TIMES_KEY = "htvn_campaign_times";

// Endless-run leaderboard (records how many levels were cleared in an endless run)
export interface EndlessRunEntry {
  runId: string;
  levelsCompleted: number;
  totalTimeMs: number;
  timestamp: number;
}
export const ENDLESS_RUNS_KEY = "htvn_endless_runs";
