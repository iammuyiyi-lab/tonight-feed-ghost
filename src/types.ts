export type SceneId =
  | 'P00' // V2 Cover: Tonight a ghost stays over
  | 'P01' // V2 Page 1: An unqualified scarer (feed 1 candy)
  | 'P02' // V2 Page 2: Candy weather report (single wave)
  | 'P03' // V2 Page 3: A useless poem (3 words -> poem)
  | 'P04' // V2 Page 4: Ghost ledger (pick 1 of 3 quotes)
  | 'P05' // V2 Epilogue: An extra candy left for you (certificate)
  | 'S00' // Loading / print shop
  | 'S01' // Cover
  | 'S02' // Page 1: moon hungry
  | 'S03' // Page 1 back: ghost falls down
  | 'S04' // Trick or treat application
  | 'S05' // First swallow world view
  | 'S06' // Chapter 1: Ghost's basic recipe
  | 'S07' // Flavor echo (embedded in S06)
  | 'S08' // Sugar decides fate
  | 'S09' // Chapter 2 title: Sugar rain
  | 'S10' // Rain wave 1 (Good weather)
  | 'S11' // Rain wave 2 (Literary precipitation)
  | 'S12' // Rain wave 3 (Messy moon rain)
  | 'S13' // Rain receipt
  | 'S14' // Chapter 3 title: Transformation incident
  | 'S15_A' // Pumpkin Ghost mini-game
  | 'S16_B' // Milk Tea Ghost mini-game
  | 'S17_C' // Poet Ghost mini-game
  | 'S18_D' // Movie Ghost mini-game
  | 'S19_E' // Sleepwalker Ghost mini-game
  | 'S20' // Second mini-form choice
  | 'S21' // Chapter 4 title: Ghost pays bill
  | 'S22' // Sort wrappers on table
  | 'S23' // Ridiculous receipt stamped
  | 'S24' // Commemorative Card
  | 'S25' // Epilogue: Last candy
  | 'S26' // Back cover
  | 'S27' // Free Feed Mode
  | 'S28' // Ghost Handbook
  | 'S29' // Settings & Pause modal
  | 'S30'; // Hidden Heart Ghost

export type GhostFormId =
  | 'default'
  | 'pumpkin'
  | 'milktea'
  | 'poet'
  | 'movie'
  | 'sleepwalk'
  | 'heart';

export type GhostAction =
  | 'idle'
  | 'look-at-finger'
  | 'anticipate'
  | 'eat'
  | 'chew'
  | 'burp'
  | 'bounce'
  | 'tumble'
  | 'inflate'
  | 'deflate'
  | 'sleep'
  | 'angry'
  | 'shy'
  | 'transform'
  | 'hold-note'
  | 'wave';

export type GhostExpression =
  | 'calm'
  | 'alert'
  | 'smug'
  | 'awkward'
  | 'joy'
  | 'hungry'
  | 'complain'
  | 'dizzy'
  | 'sleepy'
  | 'guilty'
  | 'soft'
  | 'surprised';

export interface CatchBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  mouthX: number;
  mouthY: number;
  radius: number;
}

export type CandyType =
  | 'pumpkin'
  | 'milk'
  | 'star'
  | 'mint'
  | 'cloud'
  | 'blackSugar'
  | 'heart'
  | 'moon';

export interface RouteScores {
  pumpkin: number;
  milktea: number;
  poet: number;
  movie: number;
  sleepwalk: number;
}

export interface CollectibleWrapper {
  id: string; // '01' - '12'
  title: string;
  text: string;
  source: string;
}

export interface PoemRecord {
  title: string;
  lines: string[];
  materials: [string, string, string];
  timestamp: number;
}

export interface EasterEggRecord {
  id: string;
  name: string;
  desc: string;
  discoveredAt: number;
}

export interface GameSettings {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  reduceMotion: boolean;
}

export interface GentleActs {
  noTeasingCount: number; // >= 2 qualifies
  pickedBookmark: boolean;
  returnedMoonCandy: boolean;
  wokeWithStar: boolean;
  stoppedCandyNearGhost: boolean;
}

export interface SaveState {
  version: number;
  chapter: number;
  scene: SceneId;
  lastSafeCheckpoint: SceneId;
  firstRunCompleted: boolean;
  totalCandy: number;
  feedCounts: Record<CandyType, number>;
  routeScore: RouteScores;
  unlockedForms: GhostFormId[];
  playedFormsThisRun: GhostFormId[];
  mainFormThisRun?: GhostFormId;
  secondFormThisRun?: GhostFormId;
  collectibles: string[]; // wrapper ids: '01' - '12'
  easterEggs: string[]; // 'EGG01' - 'EGG15'
  gentleActs: GentleActs;
  lastEndingTitle?: string;
  chosenQuote?: string;
  lastCardData?: {
    endingTitle: string;
    subNote: string;
    chosenQuote?: string;
    favoriteCandy: CandyType;
    favoriteCandyName: string;
    mainForm: GhostFormId;
    mainFormName: string;
    date: string;
  };
  cardSaved: boolean;
  replayCount: number;
  savedPoems: PoemRecord[];
  settings: GameSettings;
}
