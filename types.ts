export enum GameState {
  START,
  PLAYING,
  GAME_OVER,
  VICTORY
}

export enum MaskType {
  NONE = 0,
  CHILD = 1,
  STUDENT = 2,
  WORKER = 3,
  SOCIAL = 4
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  type?: 'block' | 'spike' | 'goal' | 'wall' | 'memory';
  text?: string;        // Text for Wall of Words
  reqMask?: MaskType;   // Mask required to pass the wall
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
  shape: 'circle' | 'rect';
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