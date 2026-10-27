import { SaveState, SceneId, CandyType, GhostFormId, CollectibleWrapper, EasterEggRecord, PoemRecord } from '../types';

const STORAGE_KEY = 'tonight_feed_ghost_save_v1';
const DB_NAME = 'TonightFeedGhostDB';
const DB_VERSION = 1;
const STORE_NAME = 'save_state';

export const INITIAL_SAVE_STATE: SaveState = {
  version: 3,
  chapter: 0,
  scene: 'C01',
  lastSafeCheckpoint: 'C01',
  firstRunCompleted: false,
  totalCandy: 0,
  feedCounts: {
    pumpkin: 0,
    milk: 0,
    star: 0,
    mint: 0,
    cloud: 0,
    blackSugar: 0,
    heart: 0,
    moon: 0,
  },
  routeScore: {
    pumpkin: 0,
    milktea: 0,
    poet: 0,
    movie: 0,
    sleepwalk: 0,
  },
  unlockedForms: ['default'],
  playedFormsThisRun: ['default'],
  collectibles: [],
  easterEggs: [],
  gentleActs: {
    noTeasingCount: 0,
    pickedBookmark: false,
    returnedMoonCandy: false,
    wokeWithStar: false,
    stoppedCandyNearGhost: false,
  },
  cardSaved: false,
  replayCount: 0,
  savedPoems: [],
  settings: {
    bgmEnabled: true,
    sfxEnabled: true,
    reduceMotion: false,
  },
};

export class PersistenceSystem {
  private state: SaveState;
  private db: IDBDatabase | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.state = { ...INITIAL_SAVE_STATE };
    this.readyPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.loadFromLocalStorage();
      return;
    }

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        req.onsuccess = async () => {
          this.db = req.result;
          await this.loadFromIDB();
          resolve();
        };

        req.onerror = () => {
          console.warn('IndexedDB open error, fallback to localStorage');
          this.loadFromLocalStorage();
          resolve();
        };
      } catch (err) {
        console.warn('IndexedDB not supported, fallback to localStorage', err);
        this.loadFromLocalStorage();
        resolve();
      }
    });
  }

  public async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  public getState(): SaveState {
    return this.state;
  }

  public async save(partial?: Partial<SaveState>): Promise<void> {
    if (partial) {
      this.state = { ...this.state, ...partial };
    }

    // Always mirror to localStorage as an immediate backup
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(this.state, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async loadFromIDB(): Promise<void> {
    if (!this.db) {
      this.loadFromLocalStorage();
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('current');
        req.onsuccess = () => {
          if (req.result) {
            this.state = this.sanitizeState(req.result);
          } else {
            this.loadFromLocalStorage();
          }
          resolve();
        };
        req.onerror = () => {
          this.loadFromLocalStorage();
          resolve();
        };
      } catch {
        this.loadFromLocalStorage();
        resolve();
      }
    });
  }

  private loadFromLocalStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.state = this.sanitizeState(parsed);
        }
      }
    } catch (err) {
      console.warn('Corrupted localStorage data, resetting to initial state', err);
      this.state = { ...INITIAL_SAVE_STATE };
    }
  }

  private sanitizeState(data: any): SaveState {
    if (!data || typeof data !== 'object') {
      return { ...INITIAL_SAVE_STATE };
    }

    const mapLegacyScene = (s: any): SceneId => {
      if (['C01', 'C02', 'C03', 'C04', 'S27', 'S28', 'S29', 'S30'].includes(s)) return s as SceneId;
      if (['P00', 'S00', 'S01', 'S02', 'S03'].includes(s)) return 'C01';
      if (['P01', 'S04', 'S05', 'S06', 'S07', 'S08'].includes(s)) return 'C02';
      if (['P02', 'P03', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15_A', 'S16_B', 'S17_C', 'S18_D', 'S19_E', 'S20'].includes(s)) return 'C03';
      if (['P04', 'P05', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26'].includes(s)) return 'C04';
      return 'C01';
    };

    return {
      version: 3,
      chapter: typeof data.chapter === 'number' ? data.chapter : 0,
      scene: mapLegacyScene(data.scene),
      lastSafeCheckpoint: mapLegacyScene(data.lastSafeCheckpoint),
      firstRunCompleted: !!data.firstRunCompleted,
      totalCandy: typeof data.totalCandy === 'number' ? data.totalCandy : 0,
      feedCounts: {
        pumpkin: data.feedCounts?.pumpkin || 0,
        milk: data.feedCounts?.milk || 0,
        star: data.feedCounts?.star || 0,
        mint: data.feedCounts?.mint || 0,
        cloud: data.feedCounts?.cloud || 0,
        blackSugar: data.feedCounts?.blackSugar || 0,
        heart: data.feedCounts?.heart || 0,
        moon: data.feedCounts?.moon || 0,
      },
      routeScore: {
        pumpkin: data.routeScore?.pumpkin || 0,
        milktea: data.routeScore?.milktea || 0,
        poet: data.routeScore?.poet || 0,
        movie: data.routeScore?.movie || 0,
        sleepwalk: data.routeScore?.sleepwalk || 0,
      },
      unlockedForms: Array.isArray(data.unlockedForms) ? data.unlockedForms : ['default'],
      playedFormsThisRun: Array.isArray(data.playedFormsThisRun) ? data.playedFormsThisRun : ['default'],
      mainFormThisRun: data.mainFormThisRun,
      secondFormThisRun: data.secondFormThisRun,
      collectibles: Array.isArray(data.collectibles) ? data.collectibles : [],
      easterEggs: Array.isArray(data.easterEggs) ? data.easterEggs : [],
      gentleActs: {
        noTeasingCount: data.gentleActs?.noTeasingCount || 0,
        pickedBookmark: !!data.gentleActs?.pickedBookmark,
        returnedMoonCandy: !!data.gentleActs?.returnedMoonCandy,
        wokeWithStar: !!data.gentleActs?.wokeWithStar,
        stoppedCandyNearGhost: !!data.gentleActs?.stoppedCandyNearGhost,
      },
      lastEndingTitle: data.lastEndingTitle,
      lastCardData: data.lastCardData,
      cardSaved: !!data.cardSaved,
      replayCount: typeof data.replayCount === 'number' ? data.replayCount : 0,
      savedPoems: Array.isArray(data.savedPoems) ? data.savedPoems : [],
      settings: {
        bgmEnabled: data.settings?.bgmEnabled ?? true,
        sfxEnabled: data.settings?.sfxEnabled ?? true,
        reduceMotion: data.settings?.reduceMotion ?? false,
      },
    };
  }

  public savePoem(poem: PoemRecord): void {
    this.state.savedPoems.push(poem);
    this.save();
  }

  public unlockWrapper(wrapperId: string): boolean {
    if (!this.state.collectibles.includes(wrapperId)) {
      this.state.collectibles.push(wrapperId);
      this.save();
      return true;
    }
    return false;
  }

  public unlockForm(formId: GhostFormId): boolean {
    if (!this.state.unlockedForms.includes(formId)) {
      this.state.unlockedForms.push(formId);
      this.save();
      return true;
    }
    return false;
  }

  public discoverEasterEgg(eggId: string): boolean {
    if (!this.state.easterEggs.includes(eggId)) {
      this.state.easterEggs.push(eggId);
      this.save();
      return true;
    }
    return false;
  }

  public recordGentleAct(actKey: keyof import('../types').GentleActs): void {
    if (actKey === 'noTeasingCount') {
      this.state.gentleActs.noTeasingCount++;
    } else {
      (this.state.gentleActs as any)[actKey] = true;
    }
    this.save();
  }

  public countGentleActs(): number {
    let count = 0;
    if (this.state.gentleActs.noTeasingCount >= 2) count++;
    if (this.state.gentleActs.pickedBookmark) count++;
    if (this.state.gentleActs.returnedMoonCandy) count++;
    if (this.state.gentleActs.wokeWithStar) count++;
    if (this.state.gentleActs.stoppedCandyNearGhost) count++;
    return count;
  }

  public resetForNewRun(): void {
    this.state.scene = 'S01';
    this.state.chapter = 0;
    this.state.lastSafeCheckpoint = 'S01';
    this.state.playedFormsThisRun = ['default'];
    this.state.mainFormThisRun = undefined;
    this.state.secondFormThisRun = undefined;
    this.state.routeScore = {
      pumpkin: 0,
      milktea: 0,
      poet: 0,
      movie: 0,
      sleepwalk: 0,
    };
    this.state.replayCount++;
    this.save();
  }
}
