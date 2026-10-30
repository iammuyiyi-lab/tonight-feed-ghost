import { PersistenceSystem } from './systems/persistence';
import { AudioDirector } from './systems/audio';
import { GhostActor } from './systems/ghost';
import { InputRouter } from './systems/input';
import { SceneDirector } from './systems/director';
import { EndingCardRenderer } from './views/endingCardView';
import { QADevView } from './views/qaView';
import { THEME_COLORS, CANDIES, FORMS_META } from './config/constants';
import { SCENE_SCRIPTS, V2_SCRIPTS } from './config/dialogues';
import { CANDY_WRAPPERS } from './config/collectibles';
import { CandyType, SceneId, GhostFormId, DEFAULT_CUSTOM_MESSAGE, DEFAULT_MESSAGE_BUTTON_LABEL } from './types';
import { PumpkinFaceType } from './games/pumpkinGame';
import { PunctuationType } from './games/milkTeaGame';
import { DreamShape } from './games/sleepwalkerGame';

class GameApp {
  private persistence: PersistenceSystem;
  private audio: AudioDirector;
  private ghost: GhostActor;
  private director: SceneDirector;
  private input: InputRouter;
  private qaView: QADevView | null = null;

  // DOM elements
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stageContainer: HTMLElement;
  private pageIndicator: HTMLElement;
  private subtitleContainer: HTMLElement;
  private subtitleTextEl: HTMLElement;
  private subtitleTagEl: HTMLElement;
  private skipHintEl: HTMLElement;
  private minigameOverlay: HTMLElement;
  private bottomActionRow: HTMLElement;
  private modalOverlay: HTMLElement;
  private settingsBtn: HTMLElement;
  private topResetBtn: HTMLElement;
  private transientBubbleEl: HTMLElement;
  private ghostSpeechBubble: HTMLElement;
  private ghostBubbleText: HTMLElement;

  // Dragging candy state
  private draggingCandy: CandyType | null = null;
  private candyDragX: number = 0;
  private candyDragY: number = 0;
  private candyTeaseTracker: { approached: boolean; count: number } = { approached: false, count: 0 };

  // Flying candy animation state
  private flyingCandy: {
    type: CandyType;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: number;
    duration: number;
    onComplete: () => void;
  } | null = null;

  // S04 / P01 Trial Candy screen position
  private s04CandyPos = { x: 180, y: 380 };

  // S02 / P00 Moon state
  private moonX: number = 0;
  private moonY: number = 0;
  private moonRadius: number = 32;

  // Canvas size and animation
  private dpr: number = 1;
  private width: number = 360;
  private height: number = 600;
  private lastTime: number = 0;

  constructor() {
    this.persistence = new PersistenceSystem();
    this.audio = new AudioDirector();
    this.ghost = new GhostActor();
    this.director = new SceneDirector(this.persistence, this.audio, this.ghost);

    // Fetch DOM references
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.stageContainer = document.getElementById('stageContainer')!;
    this.pageIndicator = document.getElementById('pageIndicator')!;
    this.subtitleContainer = document.getElementById('subtitleContainer')!;
    this.subtitleTextEl = document.getElementById('subtitleText')!;
    this.subtitleTagEl = document.getElementById('subtitleTag')!;
    this.skipHintEl = document.getElementById('skipHint')!;
    this.minigameOverlay = document.getElementById('minigameOverlay')!;
    this.bottomActionRow = document.getElementById('bottomActionRow')!;
    this.modalOverlay = document.getElementById('modalOverlay')!;
    this.settingsBtn = document.getElementById('settingsBtn')!;
    this.topResetBtn = document.getElementById('topResetBtn')!;
    this.transientBubbleEl = document.getElementById('transientBubble') || document.createElement('div');
    this.ghostSpeechBubble = document.getElementById('ghostSpeechBubble')!;
    this.ghostBubbleText = document.getElementById('ghostBubbleText')!;

    this.input = new InputRouter(this.stageContainer);

    this.init();
  }

  private async init(): Promise<void> {
    await this.persistence.whenReady();

    // Check URL parameters for custom message sharing
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        const msgParam = urlParams.get('msg');
        if (msgParam) {
          this.persistence.setCustomMessage(msgParam);
        }
        const btnParam = urlParams.get('btn');
        if (btnParam) {
          this.persistence.setCustomMessageButton(btnParam);
        }
      }
    } catch (_) {}

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Apply reduced motion preference
    this.applyMotionPreference();

    // Load and apply initial audio settings
    const savedAudioState = this.persistence.getState();
    this.audio.setSettings(savedAudioState.settings.bgmEnabled, savedAudioState.settings.sfxEnabled);

    // Global audio unlock on first user gesture anywhere (using capture to bypass stopPropagation)
    let audioUnlockedOnce = false;
    const unlockAudioOnGesture = async () => {
      if (audioUnlockedOnce) return;
      audioUnlockedOnce = true;
      ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'].forEach((evt) => {
        window.removeEventListener(evt, unlockAudioOnGesture, { capture: true });
      });
      await this.audio.unlock();
      this.director.ensureAudioForCurrentScene();
    };
    ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, unlockAudioOnGesture, { capture: true, passive: true });
    });

    this.bindDOMEvents();
    this.bindInputEvents();

    // P1-06: Only initialize QA Dev View in development mode or via ?qa=1 query param
    const isDev = (import.meta as any).env?.DEV || window.location.search.includes('qa=1');
    if (isDev) {
      this.qaView = new QADevView(this.persistence, (scene) => this.director.goToScene(scene));
      this.qaView.init();
    }

    // Scene changed hook
    this.director.onSceneChanged = (scene) => {
      this.updateHeader(scene);
      this.renderControlsForScene(scene);
    };

    // Subtitle updated hook (fallback / backwards compat)
    this.director.onSubtitleUpdated = (text, isDone) => {
      if (text) {
        this.subtitleTextEl.innerText = text;
        this.subtitleContainer.style.opacity = '1';
        this.subtitleContainer.style.pointerEvents = 'auto';
      } else {
        this.subtitleTextEl.innerText = '';
        this.subtitleContainer.style.opacity = '0';
        this.subtitleContainer.style.pointerEvents = 'none';
      }
      this.skipHintEl.style.opacity = isDone ? '0' : '0.7';
      requestAnimationFrame(() => updateNarrationSafeBottom());
    };

    // Ghost speech bubble hook (character dialogue)
    this.director.onGhostSpeechUpdated = (text) => {
      if (text) {
        this.ghostBubbleText.innerText = text;
        this.ghostSpeechBubble.style.display = 'flex';
        this.ghostSpeechBubble.classList.add('visible');
        this.updateGhostBubblePosition();
      } else {
        this.ghostSpeechBubble.style.display = 'none';
        this.ghostSpeechBubble.classList.remove('visible');
      }
    };

    // Observe subtitle container to dynamically set --narration-safe-bottom
    const updateNarrationSafeBottom = () => {
      const rect = this.subtitleContainer.getBoundingClientRect();
      const height = rect.height || 68;
      const safeBottom = Math.max(116, Math.round(14 + height + 18));
      document.documentElement.style.setProperty('--narration-safe-bottom', `${safeBottom}px`);
    };

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => updateNarrationSafeBottom()).observe(this.subtitleContainer);
    }
    updateNarrationSafeBottom();

    // Guide narration / hint hook
    this.director.onGuideUpdated = (text, type) => {
      if (this.subtitleTagEl) {
        if (type === 'hint') {
          this.subtitleTagEl.innerText = '💡 提示';
          this.subtitleTagEl.className = 'subtitle-tag tag-hint';
        } else {
          this.subtitleTagEl.innerText = '📖 旁白';
          this.subtitleTagEl.className = 'subtitle-tag tag-narration';
        }
      }
      if (text) {
        this.subtitleTextEl.innerText = text;
        this.subtitleContainer.style.opacity = '1';
        this.subtitleContainer.style.pointerEvents = 'auto';
      } else {
        this.subtitleTextEl.innerText = '';
        this.subtitleContainer.style.opacity = '0';
        this.subtitleContainer.style.pointerEvents = 'none';
      }
      requestAnimationFrame(() => updateNarrationSafeBottom());
    };

    // Decoupled transient bubble hook (P0-02)
    this.director.onTransientBubbleUpdated = (text) => {
      if (text) {
        this.transientBubbleEl.innerText = text;
        this.transientBubbleEl.classList.add('visible');
      } else {
        this.transientBubbleEl.classList.remove('visible');
      }
    };

    // Action controls updated hook
    this.director.onActionControlsUpdated = () => {
      this.renderControlsForScene(this.director.currentScene);
    };

    // P0-02: Check saved checkpoint on startup
    this.handleStartupCheckpoint();

    // Start Game Render Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  private applyMotionPreference(): void {
    const state = this.persistence.getState();
    const systemReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldReduce = state.settings.reduceMotion || systemReduce;

    this.ghost.reduceMotion = shouldReduce;
    this.director.candyRain.reduceMotion = shouldReduce;
    if (shouldReduce) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
  }

  // P0: Startup recovery from checkpoint for V2 streamlined 4-chapter mainline
  private handleStartupCheckpoint(): void {
    const state = this.persistence.getState();
    const checkpoint = state.lastSafeCheckpoint || 'C01';

    if (['C01', 'C02', 'C03', 'C04', 'S27'].includes(checkpoint)) {
      this.director.goToScene(checkpoint);
    } else {
      this.director.goToScene('C01');
    }
  }

  private resizeCanvas(): void {
    const rect = this.stageContainer.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);

    // Adjust ghost position to center of stage
    this.ghost.x = this.width / 2;
    this.ghost.y = this.height * 0.48;

    // Adjust candy rain rail (P0-01: match bottom rail physics)
    this.director.candyRain.stageWidth = this.width;
    this.director.candyRain.stageHeight = this.height;
    this.director.candyRain.ghostY = this.height - 110;
    this.director.candyRain.ghostX = this.ghost.x;

    // Moon position in P00 / S01 / S02
    this.moonX = this.width * 0.72;
    this.moonY = this.height * 0.22;

    // P01 / S04 Trial Candy position
    this.s04CandyPos = { x: this.width / 2, y: this.height * 0.75 };
  }

  private bindDOMEvents(): void {
    // Fast skip subtitles on click
    this.subtitleContainer.addEventListener('click', () => {
      this.director.skipOrNextDialogue();
    });

    // P0-02: Stop pointer and click event propagation from controls/overlays to stage container
    this.minigameOverlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.minigameOverlay.addEventListener('click', (e) => e.stopPropagation());
    this.bottomActionRow.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.bottomActionRow.addEventListener('click', (e) => e.stopPropagation());

    // Settings Modal
    this.settingsBtn.addEventListener('click', async () => {
      await this.audio.unlock();
      this.audio.playSfx('boop');
      this.openSettingsModal();
    });

    // Top Header Reset Button (One-click direct reset)
    if (this.topResetBtn) {
      this.topResetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.audio.unlock();
        this.audio.playSfx('boop');
        this.confirmAndResetProgress();
      });
    }

    // Ghost Speech Bubble Click to advance dialogue or page
    this.ghostSpeechBubble.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.director.currentScene === 'C02' && this.director.c02SelectedCandy) {
        this.director.nextC02DialogueStep();
      } else if (this.director.currentScene === 'C01') {
        if (!this.director.c01SignTapped) {
          this.director.tapC01();
          this.renderControlsForScene('C01');
        } else {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('C02');
        }
      } else if (this.director.currentScene === 'C03' && this.director.c03Finished) {
        this.director.advanceFromC03();
      }
    });

    // Pause on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.director.candyRain.isPaused = true;
      } else {
        this.director.candyRain.isPaused = false;
      }
    });

    // Global window listeners for candy drag interaction
    window.addEventListener('pointermove', (e) => {
      if (this.draggingCandy) {
        const rect = this.stageContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.candyDragX = x;
        this.candyDragY = y;
        this.ghost.setLookAt(x, y, this.ghost.x, this.ghost.y);

        const mouthX = this.ghost.x;
        const mouthY = this.ghost.y - 14;
        const dist = Math.sqrt((x - mouthX) ** 2 + (y - mouthY) ** 2);
        if (dist < 85) {
          this.ghost.setAction('anticipate');
          this.candyTeaseTracker.approached = true;
        } else if (this.candyTeaseTracker.approached && dist > 140) {
          this.candyTeaseTracker.approached = false;
          this.candyTeaseTracker.count++;
          if (this.candyTeaseTracker.count >= 3) {
            this.director.registerTeasingCandy();
          }
          if (this.ghost.action === 'anticipate') {
            this.ghost.setAction('idle');
          }
        }
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.draggingCandy) {
        const rect = this.stageContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.handleCandyDrop(x, y);
      }
    });
  }

  private startCandyDrag(type: CandyType, clientX: number, clientY: number): void {
    const rect = this.stageContainer.getBoundingClientRect();
    this.draggingCandy = type;
    this.candyDragX = clientX - rect.left;
    this.candyDragY = clientY - rect.top;
    this.candyTeaseTracker = { approached: false, count: 0 };
  }

  private triggerCandyFlyFeed(type: CandyType, fromEl?: HTMLElement, onDone?: () => void): void {
    let startX = this.width / 2;
    let startY = this.height - 40;
    if (fromEl) {
      const rect = fromEl.getBoundingClientRect();
      const stageRect = this.stageContainer.getBoundingClientRect();
      startX = rect.left + rect.width / 2 - stageRect.left;
      startY = rect.top + rect.height / 2 - stageRect.top;
    }
    const targetX = this.ghost.x;
    const targetY = this.ghost.y - 14;

    this.audio.playSfx('twinkle');
    this.flyingCandy = {
      type,
      startX,
      startY,
      targetX,
      targetY,
      progress: 0,
      duration: 0.32,
      onComplete: () => {
        this.ghost.setAction('eat', 0.55);
        this.audio.playSfx('swallow');
        if (onDone) {
          onDone();
        }
      }
    };
  }

  private handleCandyDrop(x: number, y: number): void {
    if (!this.draggingCandy) return;
    const type = this.draggingCandy;
    this.draggingCandy = null;

    const mouthX = this.ghost.x;
    const mouthY = this.ghost.y - 14;
    const dist = Math.sqrt((x - mouthX) ** 2 + (y - mouthY) ** 2);

    if (dist < 95) {
      // Suction and feed!
      this.ghost.setAction('eat', 0.6);
      this.audio.playSfx('swallow');
      if (this.director.currentScene === 'C02') {
        this.director.feedCandyInC02(type);
        this.renderControlsForScene('C02');
      } else if (this.director.currentScene === 'P01') {
        this.director.p01Fed = true;
        this.director.feedCandy('pumpkin');
        this.director.setSubtitle(V2_SCRIPTS.P01.fedLine);
        this.renderControlsForScene('P01');
      } else if (this.director.currentScene === 'S04') {
        this.director.goToScene('S05');
      } else {
        const isHungryFeed = this.ghost.action === 'anticipate';
        this.director.feedCandy(type, isHungryFeed);
        this.renderControlsForScene(this.director.currentScene);
      }
    } else {
      // Dropped away
      this.audio.playSfx('boop');
      this.ghost.setAction('idle');
      if (this.director.currentScene === 'C02') {
        this.director.showTransientBubble('糖掉在纸上了。点选下方糖果也可以直接喂给半糖～');
      } else if (this.director.currentScene === 'P01') {
        this.ghost.setAction('angry', 1.0);
        this.director.showTransientBubble('拖偏了。可以点选糖果直接喂食～');
      } else if (this.director.currentScene === 'S04') {
        this.ghost.setAction('angry', 1.0);
        this.director.showDialogueQueue([SCENE_SCRIPTS.S04.wrongDrop]);
      }
    }
  }

  private bindInputEvents(): void {
    // Pointer move for eye tracking and candy drag
    this.input.onPointerMove = (x, y) => {
      this.ghost.setLookAt(x, y, this.ghost.x, this.ghost.y);

      // Handle candy rain horizontal ghost dragging
      if (['P02', 'S10', 'S11', 'S12'].includes(this.director.currentScene) && this.input.pointer.isDown) {
        this.director.candyRain.ghostX = Math.max(50, Math.min(this.width - 50, x));
        this.ghost.x = this.director.candyRain.ghostX;
      }
    };

    // Drag start on S04 / P01 trial candy
    this.input.onDragStart = (x, y) => {
      if ((this.director.currentScene === 'P01' && !this.director.p01Fed) || this.director.currentScene === 'S04') {
        const dx = x - this.s04CandyPos.x;
        const dy = y - this.s04CandyPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 45) {
          this.draggingCandy = 'pumpkin';
          this.candyDragX = x;
          this.candyDragY = y;
          this.candyTeaseTracker = { approached: false, count: 0 };
        }
      }
    };

    // Tap on stage
    this.input.onTap = (x, y) => {
      this.handleStageTap(x, y);
    };

    // Long press
    this.input.onLongPress = (x, y) => {
      this.handleStageLongPress(x, y);
    };

    // Drag cancel rollback
    this.input.onDragCancel = () => {
      this.draggingCandy = null;
      this.ghost.setAction('idle');
    };

    // Drag end: drop candy into ghost mouth
    this.input.onDragEnd = (x, y) => {
      if (this.draggingCandy) {
        this.handleCandyDrop(x, y);
      }
    };
  }

  private handleStageTap(x: number, y: number): void {
    const s = this.director.currentScene;

    // Check tap on ghost
    const dx = x - this.ghost.x;
    const dy = y - this.ghost.y;
    const onGhost = Math.sqrt(dx * dx + dy * dy) < 80;

    if (onGhost) {
      if (s === 'C01') {
        if (!this.director.c01SignTapped) {
          this.director.tapC01();
          this.renderControlsForScene('C01');
        } else {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('C02');
        }
        return;
      } else if (s === 'C02') {
        if (this.director.c02SelectedCandy) {
          this.director.nextC02DialogueStep();
          return;
        }
      } else if (s === 'C03') {
        if (!this.director.c03Finished) {
          if (this.ghost.form === 'pumpkin') {
            this.director.straightenPumpkinHatC03();
            return;
          } else if (this.ghost.form === 'milktea') {
            this.director.shakeMilkTeaC03();
            return;
          } else if (this.ghost.form === 'movie') {
            this.director.hitMovieSlateC03();
            return;
          }
        } else {
          this.director.advanceFromC03();
          return;
        }
      } else if (s === 'C04') {
        this.director.flipC04Note();
        return;
      }

      this.audio.playSfx('poke');
      const { pokeCount5In5s } = this.ghost.poke();

      if (pokeCount5In5s) {
        // P0-02: Decoupled transient bubble prevents deleting pending scene transition callbacks
        this.director.showTransientBubble('这一章我有意见。');
        this.persistence.discoverEasterEgg('EGG01');
      } else {
        if (s === 'P01') {
          this.director.showTransientBubble(V2_SCRIPTS.P01.poke);
        } else if (s === 'P03') {
          this.director.showTransientBubble(V2_SCRIPTS.P03.pokeEgg);
        } else if (s === 'S03') {
          this.director.showTransientBubble('我们还没熟到可以戳脸。');
        } else if (s === 'S04') {
          // Flip cardboard sign
          this.ghost.isNoteFlipped = !this.ghost.isNoteFlipped;
        } else if (s === 'S27' && this.ghost.action === 'sleep') {
          // Poked sleeping ghost (ordinary wake)
          this.ghost.setAction('idle');
          this.director.showTransientBubble('……睡醒了。');
        }
      }
      return;
    }

    // General stage tap to turn page when action is complete
    if (s === 'C01' && this.director.c01SignTapped) {
      this.audio.playSfx('pageFlip');
      this.director.goToScene('C02');
      return;
    }
    if (s === 'C02' && this.director.c02SelectedCandy) {
      this.director.nextC02DialogueStep();
      return;
    }
    if (s === 'C03' && this.director.c03Finished) {
      this.director.advanceFromC03();
      return;
    }

    // P00: Tap moon drops ink specks
    if (s === 'P00') {
      const dMoonX = x - this.moonX;
      const dMoonY = y - this.moonY;
      if (Math.sqrt(dMoonX * dMoonX + dMoonY * dMoonY) < this.moonRadius * 1.5) {
        this.audio.playSfx('twinkle');
        this.director.showTransientBubble(V2_SCRIPTS.P00.moonTap);
        return;
      }
    }

    // S02: Tap on bulged page corner
    if (s === 'S02') {
      const cornerX = this.width - 40;
      const cornerY = this.height - 80;
      if (Math.abs(x - cornerX) < 60 && Math.abs(y - cornerY) < 60) {
        this.audio.playSfx('pageFlip');
        this.director.goToScene('S03');
        return;
      }
    }

    // S27 Free mode: gentle wake with star (EGG12)
    if (s === 'S27' && this.ghost.action === 'sleep') {
      const topY = this.height * 0.25;
      if (y < topY) {
        this.audio.playSfx('twinkle');
        this.ghost.setAction('idle');
        this.director.showDialogueQueue(['你是不是把天调亮了一点。']);
        this.persistence.recordGentleAct('wokeWithStar');
        this.persistence.discoverEasterEgg('EGG12');
        return;
      }
    }
  }

  private handleStageLongPress(x: number, y: number): void {
    const s = this.director.currentScene;

    // S02 / S27: Long press Moon for 600ms (EGG02)
    const dMoonX = x - this.moonX;
    const dMoonY = y - this.moonY;
    if (Math.sqrt(dMoonX * dMoonX + dMoonY * dMoonY) < this.moonRadius * 1.5) {
      this.audio.playSfx('twinkle');
      this.director.showDialogueQueue(['不好吃，有点孤独。', '获得：月亮糖。']);
      this.persistence.discoverEasterEgg('EGG02');
      this.persistence.recordGentleAct('returnedMoonCandy');
      return;
    }

    // Long press ghost to inflate
    const dx = x - this.ghost.x;
    const dy = y - this.ghost.y;
    if (Math.sqrt(dx * dx + dy * dy) < 80) {
      this.audio.playSfx('boop');
      this.ghost.setAction('inflate', 1.2);
      this.director.showDialogueQueue([SCENE_SCRIPTS.S06.longPressComplain]);
    }
  }

  // --- Header Updating ---
  private updateHeader(scene: SceneId): void {
    let indicator = '第一页 · 遇见 ｜ 第一章：有只鬼掉进了书里';
    if (scene === 'C01') {
      indicator = '第一页 · 遇见 ｜ 第一章：有只鬼掉进了书里';
    } else if (scene === 'C02') {
      const step = Math.min(5, this.director.eatenCandiesInRun.length + 1);
      indicator = `第二页 · 一颗糖 (${step}/5) ｜ 第二章：给一只鬼一颗糖`;
    } else if (scene === 'C03') {
      const step = Math.min(5, this.director.eatenCandiesInRun.length);
      indicator = `第三页 · 小小后遗症 (${step}/5) ｜ 第三章：小小后遗症`;
    } else if (scene === 'C04') {
      indicator = '终章 · 五味俱全的手写信 ｜ 终章：一张被墨水浸透的回礼';
    } else if (scene === 'S27') {
      indicator = '夜班 · 自由喂养';
    } else if (scene === 'S28') {
      indicator = '幽灵手册 · 记录';
    } else if (scene === 'S29') {
      indicator = '纸签 · 设置';
    } else if (scene === 'S30') {
      indicator = '隐藏心事 · 秘密';
    } else if (scene === 'P00') {
      indicator = '扉页 · 今晚有鬼借宿';
    } else if (scene === 'P01') {
      indicator = '第一页 · 遇见';
    } else if (scene === 'P02') {
      indicator = '第二页 · 一颗糖';
    } else if (scene === 'P03') {
      indicator = '第三页 · 小小后遗症';
    } else if (scene === 'P04' || scene === 'P05') {
      indicator = '第四页 · 回礼';
    } else if (['S00', 'S01', 'S02', 'S03', 'S04', 'S05'].includes(scene)) {
      indicator = '第一页 · 遇见';
    } else if (['S06', 'S07', 'S08'].includes(scene)) {
      indicator = '第二页 · 一颗糖';
    } else if (scene.startsWith('S15') || scene.startsWith('S16') || scene.startsWith('S17') || scene.startsWith('S18') || scene.startsWith('S19') || scene === 'S14' || scene === 'S20') {
      indicator = '第三页 · 小小后遗症';
    } else if (['S21', 'S22', 'S23', 'S24', 'S25', 'S26'].includes(scene)) {
      indicator = '第四页 · 回礼';
    }
    this.pageIndicator.innerText = indicator;
  }

  // --- Dynamic Action Controls per Scene ---
  private renderControlsForScene(scene: SceneId): void {
    this.bottomActionRow.innerHTML = '';
    this.minigameOverlay.innerHTML = '';
    const state = this.persistence.getState();

    switch (scene) {
      case 'C01': {
        if (!this.director.c01SignTapped) {
          const tapBtn = document.createElement('button');
          tapBtn.className = 'paper-btn accent';
          tapBtn.innerText = '轻触半糖 / 招手 👋';
          tapBtn.onclick = async () => {
            await this.audio.unlock();
            this.director.tapC01();
            this.renderControlsForScene('C01');
          };
          this.bottomActionRow.appendChild(tapBtn);
        } else {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'paper-btn accent';
          nextBtn.innerText = '翻向第二页 · 挑选夜色 🍬 →';
          nextBtn.onclick = async () => {
            await this.audio.unlock();
            this.audio.playSfx('pageFlip');
            this.director.goToScene('C02');
          };
          this.bottomActionRow.appendChild(nextBtn);
        }
        break;
      }

      case 'C02': {
        const remainingCount = 5 - this.director.eatenCandiesInRun.length;
        const currentStep = Math.min(5, this.director.eatenCandiesInRun.length);

        if (this.director.c02SelectedCandy) {
          const type = this.director.c02SelectedCandy;
          const meta = CANDIES[type];
          const steps = this.director.getC02DialogueSteps(type);
          const currentStepIdx = this.director.c02DialogueStep;
          const currentStepData = steps[currentStepIdx] || steps[0];

          const banner = document.createElement('div');
          banner.className = 'c02-status-banner';
          banner.innerHTML = `
            <div class="banner-title">第 ${currentStep} / 5 幕 · ${meta.name} 专属对白</div>
            <div class="banner-sub">点击下方按钮推进幽灵台词 (${currentStepIdx + 1} / ${steps.length})</div>
          `;
          this.bottomActionRow.appendChild(banner);

          const stepBtn = document.createElement('button');
          stepBtn.className = 'paper-btn accent';
          stepBtn.style.width = '100%';
          stepBtn.style.padding = '12px 16px';
          stepBtn.style.fontSize = '15px';
          stepBtn.innerText = currentStepData.buttonLabel;
          stepBtn.onclick = async () => {
            await this.audio.unlock();
            this.director.nextC02DialogueStep();
          };
          this.bottomActionRow.appendChild(stepBtn);
          break;
        }

        const banner = document.createElement('div');
        banner.className = 'c02-status-banner';
        banner.innerHTML = `
          <div class="banner-title">第 ${currentStep + 1} / 5 幕 · 品尝夜色</div>
          <div class="banner-sub">请从余下 ${remainingCount} 颗纸包糖中挑选一颗喂给半糖</div>
        `;
        this.bottomActionRow.appendChild(banner);

        const tray = document.createElement('div');
        tray.className = 'candy-feeding-tray';

        const candyTypes: CandyType[] = ['pumpkin', 'milk', 'star', 'blackSugar', 'cloud'];
        candyTypes.forEach((type) => {
          const meta = CANDIES[type];
          const isEaten = this.director.eatenCandiesInRun.includes(type);

          const candyEl = document.createElement('div');
          candyEl.className = `feed-candy-item ${isEaten ? 'eaten' : 'available'}`;
          candyEl.setAttribute('data-candy', type);

          const icon = this.getCandySvgIcon(type);
          candyEl.innerHTML = `
            <div class="feed-candy-badge" style="background: ${meta.color}; border: 2px solid ${meta.accent};">
              ${icon}
              ${isEaten ? '<span class="eaten-stamp">已收录</span>' : ''}
            </div>
            <div class="feed-candy-name">${meta.name}</div>
          `;

          if (!isEaten) {
            candyEl.onclick = (e) => {
              e.stopPropagation();
              if (this.director.currentPhase === 'interactive' && !this.flyingCandy) {
                this.triggerCandyFlyFeed(type, candyEl, () => {
                  this.director.feedCandyInC02(type);
                  this.renderControlsForScene('C02');
                });
              }
            };

            candyEl.onpointerdown = (e) => {
              if (this.director.currentPhase === 'interactive' && !this.flyingCandy) {
                this.startCandyDrag(type, e.clientX, e.clientY);
              }
            };
          } else {
            candyEl.onclick = (e) => {
              e.stopPropagation();
              this.director.showTransientBubble(`这颗${meta.name}已品尝过，请挑一颗尚未拆封的夜色～`);
            };
          }

          tray.appendChild(candyEl);
        });

        this.bottomActionRow.appendChild(tray);
        break;
      }

      case 'C03': {
        const form = this.ghost.form;
        if (form === 'pumpkin') {
          if (!this.director.c03Finished) {
            const straightenBtn = document.createElement('button');
            straightenBtn.className = 'paper-btn accent';
            straightenBtn.innerText = '扶正帽子 🍂';
            straightenBtn.onclick = () => {
              this.director.straightenPumpkinHatC03();
            };
            this.bottomActionRow.appendChild(straightenBtn);
          } else {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'paper-btn accent';
            if (this.director.eatenCandiesInRun.length < 5) {
              const rem = 5 - this.director.eatenCandiesInRun.length;
              nextBtn.innerText = `翻向下一页 · 继续选糖 (还剩 ${rem} 颗) →`;
            } else {
              nextBtn.innerText = '翻向终章 · 领取手写回礼 📖';
            }
            nextBtn.onclick = () => this.director.advanceFromC03();
            this.bottomActionRow.appendChild(nextBtn);
          }
        } else if (form === 'milktea') {
          if (!this.director.c03Finished) {
            const shakeBtn = document.createElement('button');
            shakeBtn.className = 'paper-btn accent';
            shakeBtn.innerText = '帮它吹一口气 💨';
            shakeBtn.onclick = () => {
              this.director.shakeMilkTeaC03();
            };
            this.bottomActionRow.appendChild(shakeBtn);
          } else {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'paper-btn accent';
            if (this.director.eatenCandiesInRun.length < 5) {
              const rem = 5 - this.director.eatenCandiesInRun.length;
              nextBtn.innerText = `翻向下一页 · 继续选糖 (还剩 ${rem} 颗) →`;
            } else {
              nextBtn.innerText = '翻向终章 · 领取手写回礼 📖';
            }
            nextBtn.onclick = () => this.director.advanceFromC03();
            this.bottomActionRow.appendChild(nextBtn);
          }
        } else if (form === 'poet') {
          if (!this.director.c03Finished) {
            const container = document.createElement('div');
            container.className = 'poet-v2-chips-container';

            const words: Array<'月亮' | '糖纸' | '失眠'> = ['月亮', '糖纸', '失眠'];
            words.forEach((w) => {
              const chip = document.createElement('button');
              chip.className = 'poet-word-chip';
              chip.innerText = `【${w}】`;
              chip.onclick = (e) => {
                e.stopPropagation();
                this.director.choosePoetWordC03(w);
              };
              container.appendChild(chip);
            });
            this.minigameOverlay.appendChild(container);
          } else {
            const poem = this.director.poetGame.generatedPoem;
            if (poem) {
              const card = document.createElement('div');
              card.className = 'poet-manuscript-card';
              card.innerHTML = `
                <div class="poet-manuscript-title">${poem.title}</div>
                <div class="poet-manuscript-line">${poem.lines[0]}</div>
                <div class="poet-manuscript-line">${poem.lines[1]}</div>
                <div class="poet-manuscript-line">${poem.lines[2]}</div>
              `;
              this.minigameOverlay.appendChild(card);
            }
            const foldBtn = document.createElement('button');
            foldBtn.className = 'paper-btn accent';
            if (this.director.eatenCandiesInRun.length < 5) {
              const rem = 5 - this.director.eatenCandiesInRun.length;
              foldBtn.innerText = `折起诗页 · 继续选糖 (还剩 ${rem} 颗) →`;
            } else {
              foldBtn.innerText = '折起诗页 · 翻向终章 📖';
            }
            foldBtn.onclick = () => {
              this.director.finishPoetC03();
            };
            this.bottomActionRow.appendChild(foldBtn);
          }
        } else if (form === 'movie') {
          if (!this.director.c03Finished) {
            const clapperBtn = document.createElement('button');
            clapperBtn.className = 'paper-btn accent';
            clapperBtn.innerText = '🎬 咔！开拍';
            clapperBtn.onclick = () => {
              this.director.hitMovieSlateC03();
            };
            this.bottomActionRow.appendChild(clapperBtn);
          } else {
            const titleCard = document.createElement('div');
            titleCard.className = 'movie-title-card-overlay';
            titleCard.innerHTML = `
              <div class="movie-film-banner">场次 01 · 镜次 01 🎬</div>
              <div class="movie-film-title">《一秒钟的黑白长镜头》</div>
              <div class="movie-film-sub">零预算 · 无台词 · 纯天然夜色出品</div>
            `;
            this.minigameOverlay.appendChild(titleCard);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'paper-btn accent';
            if (this.director.eatenCandiesInRun.length < 5) {
              const rem = 5 - this.director.eatenCandiesInRun.length;
              nextBtn.innerText = `翻向下一页 · 继续选糖 (还剩 ${rem} 颗) →`;
            } else {
              nextBtn.innerText = '翻向终章 · 领取手写回礼 📖';
            }
            nextBtn.onclick = () => this.director.advanceFromC03();
            this.bottomActionRow.appendChild(nextBtn);
          }
        } else if (form === 'sleepwalk') {
          if (!this.director.c03Finished) {
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'sleepwalk-cards-container';

            const dreams: Array<{ id: 'door' | 'boat' | 'window'; label: string; sketch: string }> = [
              {
                id: 'door',
                label: '纸门',
                sketch: `<svg viewBox="0 0 60 60" class="dream-sketch-svg"><rect x="15" y="10" width="30" height="42" fill="none" stroke="#47392F" stroke-width="2.5"/><line x1="38" y1="32" x2="40" y2="32" stroke="#47392F" stroke-width="3"/><rect x="22" y="18" width="16" height="26" fill="none" stroke="#A5A0C8" stroke-width="1.8" stroke-dasharray="2,2"/></svg>`,
              },
              {
                id: 'boat',
                label: '纸船',
                sketch: `<svg viewBox="0 0 60 60" class="dream-sketch-svg"><path d="M12 36 L48 36 L40 46 L20 46 Z" fill="none" stroke="#47392F" stroke-width="2.5"/><path d="M30 16 L30 36 L18 36 Z" fill="none" stroke="#A5A0C8" stroke-width="2"/><path d="M8 50 Q 30 54 52 50" fill="none" stroke="#47392F" stroke-width="1.5"/></svg>`,
              },
              {
                id: 'window',
                label: '窗台',
                sketch: `<svg viewBox="0 0 60 60" class="dream-sketch-svg"><rect x="14" y="12" width="32" height="36" fill="none" stroke="#47392F" stroke-width="2.5"/><line x1="30" y1="12" x2="30" y2="48" stroke="#47392F" stroke-width="1.5"/><line x1="14" y1="30" x2="46" y2="30" stroke="#47392F" stroke-width="1.5"/><circle cx="22" cy="22" r="3" fill="#F4CA64"/></svg>`,
              },
            ];

            dreams.forEach((d) => {
              const card = document.createElement('div');
              card.className = 'dream-art-card';
              card.innerHTML = `
                <div class="dream-card-sketch">${d.sketch}</div>
                <div class="dream-card-name">【${d.label}】</div>
              `;
              card.onclick = (e) => {
                e.stopPropagation();
                this.director.chooseSleepwalkerDreamC03(d.id);
              };
              cardsContainer.appendChild(card);
            });
            this.minigameOverlay.appendChild(cardsContainer);
          } else if (this.director.c03ChosenDream) {
            const dreamAnim = document.createElement('div');
            dreamAnim.className = 'dream-visual-presentation';
            if (this.director.c03ChosenDream === 'door') {
              dreamAnim.innerHTML = `<div class="dream-anim-symbol">🚪 💡</div><div class="dream-anim-caption">门后总有一盏等你的灯</div>`;
            } else if (this.director.c03ChosenDream === 'boat') {
              dreamAnim.innerHTML = `<div class="dream-anim-symbol spin-boat">⛵ 🌙</div><div class="dream-anim-caption">在深蓝墨色里慢慢漂流</div>`;
            } else {
              dreamAnim.innerHTML = `<div class="dream-anim-symbol">🪟 🌙 ✨</div><div class="dream-anim-caption">把失眠与烦恼轻轻关在窗外</div>`;
            }
            this.minigameOverlay.appendChild(dreamAnim);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'paper-btn accent';
            if (this.director.eatenCandiesInRun.length < 5) {
              const rem = 5 - this.director.eatenCandiesInRun.length;
              nextBtn.innerText = `翻向下一页 · 继续选糖 (还剩 ${rem} 颗) →`;
            } else {
              nextBtn.innerText = '翻向终章 · 领取手写回礼 📖';
            }
            nextBtn.onclick = () => this.director.advanceFromC03();
            this.bottomActionRow.appendChild(nextBtn);
          }
        }
        break;
      }

      case 'C04': {
        // 1. Mount animated handwritten letter card above narration bar
        let letterContainer = this.minigameOverlay.querySelector('.c04-letter-container') as HTMLElement;
        if (!letterContainer) {
          letterContainer = document.createElement('div');
          letterContainer.className = 'c04-letter-container';
          letterContainer.innerHTML = `
            <div class="c04-letter-card ${this.director.c04Flipped ? 'flipped' : ''}">
              <div class="letter-face letter-front">
                <div class="letter-tape"></div>
                <div class="letter-title">《深夜饲养手札 · 终章》</div>
                <div class="letter-body">今夜宜喂鬼。也宜对自己稍微好一点。</div>
                <div class="letter-flip-tip">（轻触信札或下方按钮翻面 ↩）</div>
              </div>
              <div class="letter-face letter-back">
                <div class="letter-tape"></div>
                <div class="letter-title">《信札背面 · 回礼》</div>
                <div class="letter-body">
                  所有尝过的滋味，最后都会变成骨头里的引力。<br>
                  天亮之后，即便做回普通人，也别忘了今晚有一只鬼，曾认真收下过你的甜意。
                </div>
                <div class="letter-flip-tip">（轻触信札或下方按钮翻回正面 ↩）</div>
              </div>
            </div>
          `;
          letterContainer.onclick = async (e) => {
            e.stopPropagation();
            await this.audio.unlock();
            this.director.flipC04Note();
          };
          this.minigameOverlay.appendChild(letterContainer);
        } else {
          const cardEl = letterContainer.querySelector('.c04-letter-card');
          if (cardEl) {
            if (this.director.c04Flipped) {
              cardEl.classList.add('flipped');
            } else {
              cardEl.classList.remove('flipped');
            }
          }
        }

        // 2. Bottom Action Buttons: Flip and Message from Yang
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '8px';
        row.style.width = '100%';

        const flipBtn = document.createElement('button');
        flipBtn.className = 'paper-btn secondary';
        flipBtn.innerText = this.director.c04Flipped ? '翻回信札正面 ↩' : '翻看手写信背面 📜';
        flipBtn.onclick = async () => {
          await this.audio.unlock();
          this.director.flipC04Note();
        };
        row.appendChild(flipBtn);

        const msgBtn = document.createElement('button');
        msgBtn.className = 'paper-btn accent';
        msgBtn.innerText = this.persistence.getCustomMessageButton();
        msgBtn.onclick = async () => {
          await this.audio.unlock();
          this.showCustomMessageModal();
        };
        row.appendChild(msgBtn);

        this.bottomActionRow.appendChild(row);
        break;
      }

      case 'P00': {
        const startBtn = document.createElement('button');
        startBtn.className = 'paper-btn accent';
        startBtn.innerText = '翻开今晚';
        startBtn.onclick = async () => {
          await this.audio.unlock();
          this.audio.playSfx('pageFlip');
          this.director.goToScene('P01');
        };
        this.bottomActionRow.appendChild(startBtn);

        if (state.firstRunCompleted) {
          const freeModeBtn = document.createElement('button');
          freeModeBtn.className = 'paper-btn secondary';
          freeModeBtn.innerText = '半糖的夜班 (自由模式)';
          freeModeBtn.onclick = async () => {
            await this.audio.unlock();
            this.director.goToScene('S27');
          };
          this.bottomActionRow.appendChild(freeModeBtn);
        }
        break;
      }

      case 'P01': {
        if (this.director.p01Fed) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'paper-btn accent';
          nextBtn.innerText = '继续翻页 →';
          nextBtn.onclick = () => {
            this.audio.playSfx('pageFlip');
            this.director.goToScene('P02');
          };
          this.bottomActionRow.appendChild(nextBtn);
        } else {
          const tapFeedBtn = document.createElement('button');
          tapFeedBtn.className = 'paper-btn secondary';
          tapFeedBtn.innerText = '喂它南瓜糖';
          tapFeedBtn.onclick = () => {
            this.audio.playSfx('swallow');
            this.ghost.setAction('eat', 0.6);
            this.director.p01Fed = true;
            this.director.feedCandy('pumpkin');
            this.director.setSubtitle(V2_SCRIPTS.P01.fedLine);
            this.renderControlsForScene('P01');
          };
          this.bottomActionRow.appendChild(tapFeedBtn);
        }
        break;
      }

      case 'P02': {
        if (this.director.candyRain.caughtCandyCount >= 3) {
          const earlyExitBtn = document.createElement('button');
          earlyExitBtn.className = 'paper-btn secondary';
          earlyExitBtn.innerText = '收起雨伞 / 翻页 →';
          earlyExitBtn.onclick = () => {
            this.director.candyRain.completeRainEarly();
          };
          this.bottomActionRow.appendChild(earlyExitBtn);
        }
        break;
      }

      case 'P03': {
        if (this.director.poetGame.step === 'selectWords') {
          const container = document.createElement('div');
          container.className = 'poet-rows-container';

          const rows = [
            ['月亮', '路灯', '南瓜', '旧窗'],
            ['糖纸', '鞋带', '晚风', '书签'],
            ['打嗝', '漂流', '保密', '发芽'],
          ];

          rows.forEach((r, rowIdx) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'poet-row';
            r.forEach((word) => {
              const chip = document.createElement('button');
              chip.className = `poet-word-chip ${this.director.poetGame.selectedWords[rowIdx] === word ? 'selected' : ''}`;
              chip.innerText = word;
              chip.onclick = (e) => {
                e.stopPropagation();
                this.director.poetGame.pickWord(rowIdx, word);
                this.renderControlsForScene('P03');
              };
              rowEl.appendChild(chip);
            });
            container.appendChild(rowEl);
          });
          this.minigameOverlay.appendChild(container);
        } else if (this.director.poetGame.step === 'recite') {
          const poem = this.director.poetGame.generatedPoem;
          if (poem) {
            const card = document.createElement('div');
            card.className = 'poet-manuscript-card';
            card.innerHTML = `
              <div class="poet-manuscript-title">${poem.title}</div>
              <div class="poet-manuscript-line">${poem.lines[0]}</div>
              <div class="poet-manuscript-line">${poem.lines[1]}</div>
              <div class="poet-manuscript-line">${poem.lines[2]}</div>
            `;
            this.minigameOverlay.appendChild(card);
          }
          const foldBtn = document.createElement('button');
          foldBtn.className = 'paper-btn accent';
          foldBtn.id = 'foldPoemBtn';
          foldBtn.innerText = '把诗折起来 →';
          foldBtn.onclick = (e) => {
            e.stopPropagation();
            this.audio.playSfx('pageFlip');
            this.director.goToScene('P04');
          };
          this.bottomActionRow.appendChild(foldBtn);
        }
        break;
      }

      case 'P04': {
        const quotesContainer = document.createElement('div');
        quotesContainer.className = 'quote-selector-container';

        const quotes = V2_SCRIPTS.P04.quotes;
        quotes.forEach((q) => {
          const quoteCard = document.createElement('div');
          quoteCard.className = `quote-card ${this.director.p04SelectedQuote === q ? 'selected' : ''}`;
          quoteCard.innerText = `“${q}”`;
          quoteCard.onclick = (e) => {
            e.stopPropagation();
            this.director.p04SelectedQuote = q;
            this.audio.playSfx('boop');
            this.renderControlsForScene('P04');
          };
          quotesContainer.appendChild(quoteCard);
        });
        this.minigameOverlay.appendChild(quotesContainer);

        const writeBackBtn = document.createElement('button');
        writeBackBtn.className = 'paper-btn accent';
        writeBackBtn.innerText = '写在背面 →';
        writeBackBtn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('P05');
        };
        this.bottomActionRow.appendChild(writeBackBtn);
        break;
      }

      case 'P05': {
        state.firstRunCompleted = true;
        state.chosenQuote = this.director.p04SelectedQuote;
        this.persistence.unlockWrapper('11');
        this.persistence.save();

        const saveBtn = document.createElement('button');
        saveBtn.className = 'paper-btn accent';
        saveBtn.innerText = '收下这张糖纸';
        saveBtn.onclick = () => {
          const dataUrl = EndingCardRenderer.renderCardToDataUrl(
            state,
            '半糖的饲养员',
            '愿你拥有许多不必解释的快乐',
            this.director.p04SelectedQuote
          );
          this.showCardPreviewModal(dataUrl);
        };

        const freeModeBtn = document.createElement('button');
        freeModeBtn.className = 'paper-btn secondary';
        freeModeBtn.innerText = '再喂一颗';
        freeModeBtn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S27');
        };

        const closeBookBtn = document.createElement('button');
        closeBookBtn.className = 'paper-btn secondary';
        closeBookBtn.innerText = '合上这本书';
        closeBookBtn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('P00');
        };

        this.bottomActionRow.appendChild(saveBtn);
        this.bottomActionRow.appendChild(freeModeBtn);
        this.bottomActionRow.appendChild(closeBookBtn);
        break;
      }

      case 'S00': {
        const checkpoint = state.lastSafeCheckpoint || 'S01';
        const hasProgress = checkpoint !== 'S01';

        if (state.firstRunCompleted) {
          const continueBtn = document.createElement('button');
          continueBtn.className = 'paper-btn';
          continueBtn.innerText = '继续自由喂养';
          continueBtn.onclick = async () => {
            await this.audio.unlock();
            this.director.goToScene('S27');
          };

          const restartBtn = document.createElement('button');
          restartBtn.className = 'paper-btn secondary';
          restartBtn.innerText = '重新翻阅绘本';
          restartBtn.onclick = async () => {
            await this.audio.unlock();
            this.director.startNewRun();
          };

          this.bottomActionRow.appendChild(continueBtn);
          this.bottomActionRow.appendChild(restartBtn);
        } else if (hasProgress) {
          const continueBtn = document.createElement('button');
          continueBtn.className = 'paper-btn';
          continueBtn.innerText = `继续上次进度 (${checkpoint})`;
          continueBtn.onclick = async () => {
            await this.audio.unlock();
            this.audio.playSfx('pageFlip');
            this.director.goToScene(checkpoint);
          };

          const readFromStartBtn = document.createElement('button');
          readFromStartBtn.className = 'paper-btn secondary';
          readFromStartBtn.innerText = '从头再读';
          readFromStartBtn.onclick = async () => {
            await this.audio.unlock();
            this.director.startNewRun();
          };

          this.bottomActionRow.appendChild(continueBtn);
          this.bottomActionRow.appendChild(readFromStartBtn);
        } else {
          const btn = document.createElement('button');
          btn.className = 'paper-btn';
          btn.innerText = '翻开这本书';
          btn.onclick = async () => {
            await this.audio.unlock();
            this.audio.playSfx('pageFlip');
            this.director.goToScene('S01');
          };
          this.bottomActionRow.appendChild(btn);
        }
        break;
      }

      case 'S01': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '翻开';
        btn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S02');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S02': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn secondary';
        btn.innerText = '是谁？';
        btn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S03');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S03': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '拉它一把';
        btn.onclick = () => {
          this.audio.playSfx('boop');
          this.director.goToScene('S04');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S04': {
        // P1-02: Draggable candy is primary on canvas; provide fallback button
        const hint = document.createElement('div');
        hint.style.fontSize = '13px';
        hint.style.color = THEME_COLORS.inkBrown;
        hint.innerText = '将下方的试吃糖果拖进半糖嘴里 🍬';
        this.bottomActionRow.appendChild(hint);

        const assistBtn = document.createElement('button');
        assistBtn.className = 'paper-btn secondary';
        assistBtn.innerText = '递给它试吃糖果';
        assistBtn.onclick = () => {
          this.ghost.setAction('eat', 0.6);
          this.audio.playSfx('swallow');
          this.director.goToScene('S05');
        };
        this.bottomActionRow.appendChild(assistBtn);
        break;
      }

      case 'S05': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '翻开一只鬼的基本食谱';
        btn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S06');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S06':
      case 'S07': {
        this.renderCandyTray();
        // Check if >= 6 candies and >= 2 flavors fed
        if (this.director.chapter1FeedCount >= 6 && this.director.chapter1FlavorsTried.size >= 2) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'paper-btn accent';
          nextBtn.style.marginTop = '8px';
          nextBtn.innerText = '吃饱了，观察变化 →';
          nextBtn.onclick = () => {
            this.audio.playSfx('pageFlip');
            this.director.goToScene('S08');
          };
          this.bottomActionRow.appendChild(nextBtn);
        }
        break;
      }

      case 'S08': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '出去走走';
        btn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S09');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S09': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '伸手接住';
        btn.onclick = () => {
          this.audio.playSfx('boop');
          this.director.goToScene('S10');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S10':
      case 'S11':
      case 'S12': {
        const hint = document.createElement('div');
        hint.style.fontSize = '13px';
        hint.style.color = THEME_COLORS.inkBrown;
        hint.innerText = '左右拖动半糖接住掉落物';
        this.bottomActionRow.appendChild(hint);
        break;
      }

      case 'S13': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '继续观察异常现象';
        btn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S14');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S14': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '接受事实';
        btn.onclick = () => {
          const main = this.director.determineMainForm();
          this.director.enterMainFormMiniGame(main);
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      case 'S15_A': {
        if (this.director.pumpkinGame.step === 'adjustHat') {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.gap = '14px';
          const leftBtn = document.createElement('button');
          leftBtn.className = 'paper-btn secondary';
          leftBtn.innerText = '← 向左拨正';
          leftBtn.onclick = () => {
            this.director.pumpkinGame.handleSwipe('left');
            this.renderControlsForScene('S15_A');
          };
          const rightBtn = document.createElement('button');
          rightBtn.className = 'paper-btn secondary';
          rightBtn.innerText = '向右拨正 →';
          rightBtn.onclick = () => {
            this.director.pumpkinGame.handleSwipe('right');
            this.renderControlsForScene('S15_A');
          };
          row.appendChild(leftBtn);
          row.appendChild(rightBtn);
          this.bottomActionRow.appendChild(row);
        } else if (this.director.pumpkinGame.step === 'drawFace') {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.gap = '8px';
          const faces: Array<{ id: PumpkinFaceType; name: string }> = [
            { id: 'smile', name: '🙂 乐观微笑' },
            { id: 'serious', name: '😐 学术严肃' },
            { id: 'sad', name: '🙁 忧伤文学' },
          ];
          faces.forEach((f) => {
            const b = document.createElement('button');
            b.className = 'paper-btn secondary';
            b.innerText = f.name;
            b.onclick = () => {
              this.director.pumpkinGame.chooseFace(f.id);
            };
            row.appendChild(b);
          });
          this.bottomActionRow.appendChild(row);
        }
        break;
      }

      case 'S16_B': {
        if (this.director.milkTeaGame.step === 'shakeCup') {
          const btn = document.createElement('button');
          btn.className = 'paper-btn secondary';
          btn.innerText = `摇一摇杯子（${this.director.milkTeaGame.shakeCount}/3）`;
          btn.onclick = () => {
            this.director.milkTeaGame.registerShake(60);
            this.renderControlsForScene('S16_B');
          };
          this.bottomActionRow.appendChild(btn);
        } else if (this.director.milkTeaGame.step === 'arrangePunctuation') {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.gap = '8px';
          const puncts: Array<{ id: PunctuationType; label: string }> = [
            { id: 'period', label: '。 句号' },
            { id: 'exclamation', label: '！ 叹号' },
            { id: 'question', label: '？ 问号' },
          ];
          puncts.forEach((p) => {
            const b = document.createElement('button');
            b.className = 'paper-btn secondary';
            b.innerText = p.label;
            b.onclick = () => {
              this.director.milkTeaGame.autoArrangePunctuation(p.id);
            };
            row.appendChild(b);
          });
          this.bottomActionRow.appendChild(row);
        }
        break;
      }

      case 'S17_C': {
        if (this.director.poetGame.step === 'selectWords') {
          const container = document.createElement('div');
          container.className = 'poet-rows-container';

          const rows = [
            ['月亮', '楼梯', '南瓜', '失眠'],
            ['糖纸', '鞋带', '夜风', '旧书'],
            ['打嗝', '漂流', '保密', '发芽'],
          ];

          rows.forEach((r, rowIdx) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'poet-row';
            r.forEach((word) => {
              const chip = document.createElement('button');
              chip.className = `poet-word-chip ${this.director.poetGame.selectedWords[rowIdx] === word ? 'selected' : ''}`;
              chip.innerText = word;
              chip.onclick = () => {
                this.director.poetGame.pickWord(rowIdx, word);
                this.renderControlsForScene('S17_C');
              };
              rowEl.appendChild(chip);
            });
            container.appendChild(rowEl);
          });
          this.minigameOverlay.appendChild(container);
        } else if (this.director.poetGame.step === 'recite') {
          const poem = this.director.poetGame.generatedPoem;
          if (poem) {
            const card = document.createElement('div');
            card.className = 'poet-manuscript-card';
            card.innerHTML = `
              <div class="poet-manuscript-title">${poem.title}</div>
              <div class="poet-manuscript-line">${poem.lines[0]}</div>
              <div class="poet-manuscript-line">${poem.lines[1]}</div>
              <div class="poet-manuscript-line">${poem.lines[2]}</div>
            `;
            this.minigameOverlay.appendChild(card);
          }
          const nextBtn = document.createElement('button');
          nextBtn.className = 'paper-btn accent';
          nextBtn.innerText = '收起这首没用的诗 →';
          nextBtn.onclick = (e) => {
            e.stopPropagation();
            this.audio.playSfx('pageFlip');
            this.director.goToScene('S20');
          };
          this.bottomActionRow.appendChild(nextBtn);
        }
        break;
      }

      case 'S18_D': {
        const game = this.director.movieGame;
        if (game.currentTake === 1) {
          const btn = document.createElement('button');
          btn.className = 'paper-btn secondary';
          btn.innerText = '镜幕 1：抬头望月亮';
          btn.onclick = () => {
            game.finishTake1();
            this.renderControlsForScene('S18_D');
          };
          this.bottomActionRow.appendChild(btn);
        } else if (game.currentTake === 2) {
          const btn = document.createElement('button');
          btn.className = 'paper-btn secondary';
          btn.innerText = '镜幕 2：滑过落叶并摔倒';
          btn.onclick = () => {
            game.finishTake2();
            this.renderControlsForScene('S18_D');
          };
          this.bottomActionRow.appendChild(btn);
        } else if (game.currentTake === 3) {
          const btn = document.createElement('button');
          btn.className = 'paper-btn secondary';
          btn.innerText = '镜幕 3：举起糖果迎向天空';
          btn.onclick = () => {
            game.finishTake3();
            this.renderControlsForScene('S18_D');
          };
          this.bottomActionRow.appendChild(btn);
        }
        break;
      }

      case 'S19_E': {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        const shapes: Array<{ id: DreamShape; label: string }> = [
          { id: 'door', label: '🚪 纸门' },
          { id: 'boat', label: '⛵ 纸船' },
          { id: 'window', label: '🪟 窗户' },
        ];
        shapes.forEach((s) => {
          const b = document.createElement('button');
          b.className = `paper-btn secondary ${this.director.sleepwalkerGame.chosenShape === s.id ? 'accent' : ''}`;
          b.innerText = s.label;
          b.onclick = () => {
            this.director.sleepwalkerGame.selectShape(s.id);
            this.director.sleepwalkerGame.autoComplete();
          };
          row.appendChild(b);
        });
        this.bottomActionRow.appendChild(row);
        break;
      }

      // P0-04: S20 Real second transformation mini-interaction
      case 'S20': {
        if (!this.director.s20ChosenForm) {
          // Present top 2 runner-up candidates
          const candidates = this.director.s20Candidates;
          candidates.forEach((formId) => {
            const btn = document.createElement('button');
            btn.className = 'paper-btn secondary';
            btn.innerText = `体验：${FORMS_META[formId].name}`;
            btn.onclick = () => {
              this.director.s20ChosenForm = formId;
              this.ghost.form = formId;
              this.ghost.setAction('transform', 1.5);
              this.audio.playSfx('boop');
              this.renderControlsForScene('S20');
            };
            this.bottomActionRow.appendChild(btn);
          });
        } else if (!this.director.s20MiniStepDone) {
          // Real interactive micro-game for chosen form
          const f = this.director.s20ChosenForm;
          const actionBtn = document.createElement('button');
          actionBtn.className = 'paper-btn accent';

          if (f === 'pumpkin') {
            actionBtn.innerText = '一划扶正南瓜帽';
            actionBtn.onclick = () => {
              this.director.s20MiniStepDone = true;
              this.audio.playSfx('boop');
              this.director.showDialogueQueue(['成熟有点硌。']);
              this.recordS20Completion(f);
              this.renderControlsForScene('S20');
            };
          } else if (f === 'milktea') {
            actionBtn.innerText = '一划摇匀奶茶杯';
            actionBtn.onclick = () => {
              this.director.s20MiniStepDone = true;
              this.audio.playSfx('boop');
              this.director.showDialogueQueue(['人生起伏可饮。']);
              this.recordS20Completion(f);
              this.renderControlsForScene('S20');
            };
          } else if (f === 'poet') {
            actionBtn.innerText = '点词成句：废话也要有韵脚';
            actionBtn.onclick = () => {
              this.director.s20MiniStepDone = true;
              this.audio.playSfx('chime');
              this.director.showDialogueQueue(['我宣布，废话也要有韵脚。']);
              this.recordS20Completion(f);
              this.renderControlsForScene('S20');
            };
          } else if (f === 'movie') {
            actionBtn.innerText = '开拍：零预算文艺镜头';
            actionBtn.onclick = () => {
              this.director.s20MiniStepDone = true;
              this.audio.playSfx('clapper');
              this.director.showDialogueQueue(['预算是零，野心很多。']);
              this.recordS20Completion(f);
              this.renderControlsForScene('S20');
            };
          } else {
            actionBtn.innerText = '将一颗星轻放入睡帽';
            actionBtn.onclick = () => {
              this.director.s20MiniStepDone = true;
              this.audio.playSfx('twinkle');
              this.director.showDialogueQueue(['允许再睡三秒。']);
              this.recordS20Completion(f);
              this.renderControlsForScene('S20');
            };
          }

          this.bottomActionRow.appendChild(actionBtn);
        } else {
          // Completed mini-game -> proceed to S21
          const nextBtn = document.createElement('button');
          nextBtn.className = 'paper-btn';
          nextBtn.innerText = '继续前往第四章 →';
          nextBtn.onclick = () => {
            this.audio.playSfx('pageFlip');
            this.director.goToScene('S21');
          };
          this.bottomActionRow.appendChild(nextBtn);
        }
        break;
      }

      case 'S21': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '替它收拾糖纸';
        btn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S22');
        };
        this.bottomActionRow.appendChild(btn);
        break;
      }

      // P1-01: True wrapper sorting and reverse order EGG11 reachability
      case 'S22': {
        // Collectible wrappers available for sorting (ensure at least 3)
        const myWrappers = Array.from(new Set([...state.collectibles, '01', '02', '09'])).slice(0, 5);

        const container = document.createElement('div');
        container.className = 'wrapper-slots-container';

        for (let i = 0; i < 3; i++) {
          const slot = document.createElement('div');
          const placedId = this.director.sortedWrappers[i];
          slot.className = `wrapper-slot ${placedId ? 'filled' : ''}`;

          if (placedId) {
            const w = CANDY_WRAPPERS.find((x) => x.id === placedId);
            slot.innerHTML = `<strong>#${placedId}</strong><br>${w?.title || '糖纸'}<br><span style="font-size: 10px; opacity: 0.6;">(轻触取出)</span>`;
            slot.onclick = () => {
              this.director.removeWrapperFromSlot(i);
              this.renderControlsForScene('S22');
            };
          } else {
            slot.innerHTML = `槽位 ${i + 1}<br>(请选下方糖纸)`;
          }
          container.appendChild(slot);
        }
        this.minigameOverlay.appendChild(container);

        // Render available wrappers on the table
        const pickerRow = document.createElement('div');
        pickerRow.style.display = 'flex';
        pickerRow.style.flexWrap = 'wrap';
        pickerRow.style.gap = '8px';
        pickerRow.style.justifyContent = 'center';
        pickerRow.style.width = '100%';

        myWrappers.forEach((id) => {
          const isPlaced = this.director.sortedWrappers.includes(id);
          const w = CANDY_WRAPPERS.find((x) => x.id === id);
          const chip = document.createElement('button');
          chip.className = `paper-sign-btn ${isPlaced ? 'active' : ''}`;
          chip.innerText = `#${id} ${w?.title || '糖纸'}`;
          chip.disabled = isPlaced;
          chip.onclick = () => {
            // Find first empty slot
            let emptyIdx = this.director.sortedWrappers.findIndex((x) => !x);
            if (emptyIdx === -1 && this.director.sortedWrappers.length < 3) {
              emptyIdx = this.director.sortedWrappers.length;
            }
            if (emptyIdx !== -1 && emptyIdx < 3) {
              this.director.putWrapperInSlot(id, emptyIdx);
              this.renderControlsForScene('S22');
            }
          };
          pickerRow.appendChild(chip);
        });

        this.bottomActionRow.appendChild(pickerRow);

        const filledCount = this.director.sortedWrappers.filter((x) => !!x).length;
        if (filledCount >= 3) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'paper-btn';
          nextBtn.style.marginTop = '8px';
          nextBtn.innerText = '合上这一页';
          nextBtn.onclick = () => {
            this.audio.playSfx('pageFlip');
            this.director.goToScene('S23');
          };
          this.bottomActionRow.appendChild(nextBtn);
        }
        break;
      }

      case 'S23': {
        const stampBtn = document.createElement('button');
        stampBtn.className = 'paper-btn secondary';
        stampBtn.innerText = '盖章确认收据 🐾';
        stampBtn.onclick = () => {
          this.director.applyReceiptStamp();
        };

        const nextBtn = document.createElement('button');
        nextBtn.className = 'paper-btn';
        nextBtn.innerText = '拆开信纸';
        nextBtn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S24');
        };

        this.bottomActionRow.appendChild(stampBtn);
        this.bottomActionRow.appendChild(nextBtn);
        break;
      }

      case 'S24': {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'paper-btn secondary';
        saveBtn.innerText = '保存纪念卡';
        saveBtn.onclick = async () => {
          if (this.director.lastEndingCardUrl) {
            const res = await EndingCardRenderer.triggerSaveOrShare(this.director.lastEndingCardUrl);
            if (res.fallbackView) {
              this.showCardPreviewModal(this.director.lastEndingCardUrl);
            }
          }
        };

        const nextBtn = document.createElement('button');
        nextBtn.className = 'paper-btn';
        nextBtn.innerText = '再翻一页';
        nextBtn.onclick = () => {
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S25');
        };

        this.bottomActionRow.appendChild(saveBtn);
        this.bottomActionRow.appendChild(nextBtn);
        break;
      }

      case 'S25': {
        const candyBtn = document.createElement('button');
        candyBtn.className = 'paper-btn accent';
        candyBtn.innerText = this.director.finalCandyOpened ? '万圣节快乐' : '点开最后一颗糖';
        candyBtn.onclick = () => {
          this.director.clickFinalCandy();
          this.renderControlsForScene('S25');
        };
        this.bottomActionRow.appendChild(candyBtn);

        if (this.director.finalCandyOpened) {
          const endBtn = document.createElement('button');
          endBtn.className = 'paper-btn';
          endBtn.innerText = '合上书底';
          endBtn.onclick = () => {
            this.audio.playSfx('pageFlip');
            this.director.goToScene('S26');
          };
          this.bottomActionRow.appendChild(endBtn);
        }
        break;
      }

      case 'S26': {
        const b1 = document.createElement('button');
        b1.className = 'paper-btn secondary';
        b1.innerText = '再喂它一颗';
        b1.onclick = () => this.director.goToScene('S27');

        const b3 = document.createElement('button');
        b3.className = 'paper-btn';
        b3.innerText = '再读一遍';
        b3.onclick = () => {
          this.director.startNewRun();
        };

        this.bottomActionRow.appendChild(b1);
        this.bottomActionRow.appendChild(b3);
        break;
      }

      case 'S27': {
        this.renderCandyTray();
        // Free Mode form selector chips
        const formRow = document.createElement('div');
        formRow.style.display = 'flex';
        formRow.style.gap = '6px';
        formRow.style.marginTop = '6px';
        formRow.style.overflowX = 'auto';
        formRow.style.width = '100%';

        this.persistence.getState().unlockedForms.forEach((fId) => {
          const btn = document.createElement('button');
          btn.className = `paper-sign-btn ${this.ghost.form === fId ? 'active' : ''}`;
          btn.innerText = FORMS_META[fId].icon + ' ' + FORMS_META[fId].name;
          btn.onclick = () => {
            this.ghost.form = fId;
            this.audio.playSfx('boop');
            this.renderControlsForScene('S27');
          };
          formRow.appendChild(btn);
        });

        // Check if Heart Form S30 is accessible (P1-04)
        if (
          (this.persistence.countGentleActs() >= 2 && this.persistence.getState().feedCounts.heart > 0) ||
          this.persistence.getState().unlockedForms.includes('heart')
        ) {
          const heartRibbon = document.createElement('button');
          heartRibbon.className = 'paper-sign-btn';
          heartRibbon.style.background = '#F9E2E2';
          heartRibbon.style.borderColor = THEME_COLORS.accentRed;
          heartRibbon.innerText = '❤️ 隐藏心事';
          heartRibbon.onclick = () => {
            this.director.goToScene('S30');
          };
          formRow.appendChild(heartRibbon);
        }

        this.bottomActionRow.appendChild(formRow);
        break;
      }

      case 'S30': {
        const b = document.createElement('button');
        b.className = 'paper-btn secondary';
        b.innerText = '轻轻留着心事';
        b.onclick = () => {
          this.persistence.unlockForm('heart');
          this.persistence.discoverEasterEgg('EGG13');
          this.director.showDialogueQueue(SCENE_SCRIPTS.S30.finalLines, () => {
            this.director.goToScene('S27');
          });
        };
        this.bottomActionRow.appendChild(b);
        break;
      }
    }
  }

  // Record S20 completion and unlock
  private recordS20Completion(formId: GhostFormId): void {
    const state = this.persistence.getState();
    state.secondFormThisRun = formId;
    if (!state.playedFormsThisRun.includes(formId)) {
      state.playedFormsThisRun.push(formId);
    }
    this.persistence.unlockForm(formId);
    this.persistence.save();
  }

  // --- Candy Tray Renderer (S06 / S27) ---
  private renderCandyTray(): void {
    const tray = document.createElement('div');
    tray.className = 'candy-tray';

    const candyTypes: CandyType[] = ['pumpkin', 'milk', 'star', 'mint', 'cloud', 'blackSugar'];
    if (this.persistence.getState().feedCounts.heart > 0 || this.director.currentScene === 'S27') {
      candyTypes.push('heart');
    }

    candyTypes.forEach((cType) => {
      const meta = CANDIES[cType];
      const item = document.createElement('div');
      item.className = 'candy-tray-item';
      item.innerHTML = `
        <div class="candy-dot" style="background: ${meta.color}; border-color: ${meta.accent};"></div>
        <div class="candy-label">${meta.name}</div>
      `;

      // Touch drag initiation
      item.addEventListener('pointerdown', (e) => {
        if (!this.flyingCandy) {
          this.startCandyDrag(cType, e.clientX, e.clientY);
        }
      });

      // Tap alternative with animated flying candy
      item.addEventListener('click', () => {
        if (!this.flyingCandy) {
          this.triggerCandyFlyFeed(cType, item, () => {
            const isHungryFeed = this.ghost.action === 'anticipate';
            this.director.feedCandy(cType, isHungryFeed);
            this.renderControlsForScene(this.director.currentScene);
          });
        }
      });

      tray.appendChild(item);
    });

    this.bottomActionRow.appendChild(tray);
  }

  // --- Modals (Settings, Handbook, Card Preview) ---
  private openSettingsModal(): void {
    const state = this.persistence.getState();
    this.modalOverlay.style.display = 'flex';
    this.modalOverlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <div class="settings-title">🔖 纸签设置</div>
        </div>
        <div class="handbook-content">
          <div class="settings-row">
            <span class="settings-label">背景音乐</span>
            <label class="switch">
              <input type="checkbox" id="bgmToggle" ${state.settings.bgmEnabled ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <span class="settings-label">按键音效</span>
            <label class="switch">
              <input type="checkbox" id="sfxToggle" ${state.settings.sfxEnabled ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <span class="settings-label">减少动态 (舒适模式)</span>
            <label class="switch">
              <input type="checkbox" id="motionToggle" ${state.settings.reduceMotion ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-message-section" style="margin-top: 14px; padding-top: 14px; border-top: 1.5px dashed rgba(71, 57, 47, 0.3);">
            <button class="paper-btn accent" id="openMessageEditorBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>✏️ 编辑专属留言</span>
            </button>
            <div style="font-size: 11px; color: var(--color-ink-light); text-align: center; margin-top: 6px;">
              像 txt 记事本一样自由写信，Enter 换行、空格留空
            </div>
          </div>
          <div class="settings-reset-section" style="margin-top: 14px; padding-top: 14px; border-top: 1.5px dashed rgba(71, 57, 47, 0.3);">
            <button class="paper-btn danger-btn" id="settingsResetBtn" style="width: 100%;">
              ↺ 一键重置所有进度
            </button>
            <div style="font-size: 11px; color: var(--color-ink-light); text-align: center; margin-top: 6px;">
              清空所有糖纸与记录，翻回第一页重新开始
            </div>
          </div>
        </div>
        <div class="settings-footer">
          <button class="paper-btn close-settings-btn">合上设置</button>
        </div>
      </div>
    `;

    const bgmEl = document.getElementById('bgmToggle') as HTMLInputElement;
    const sfxEl = document.getElementById('sfxToggle') as HTMLInputElement;
    const motionEl = document.getElementById('motionToggle') as HTMLInputElement;

    bgmEl.addEventListener('change', () => {
      state.settings.bgmEnabled = bgmEl.checked;
      this.audio.setSettings(state.settings.bgmEnabled, state.settings.sfxEnabled);
      this.persistence.save();
    });

    sfxEl.addEventListener('change', () => {
      state.settings.sfxEnabled = sfxEl.checked;
      this.audio.setSettings(state.settings.bgmEnabled, state.settings.sfxEnabled);
      this.persistence.save();
    });

    motionEl.addEventListener('change', () => {
      state.settings.reduceMotion = motionEl.checked;
      this.applyMotionPreference();
      this.persistence.save();
    });

    document.getElementById('openMessageEditorBtn')?.addEventListener('click', () => {
      this.openMessageEditorModal();
    });

    document.getElementById('settingsResetBtn')?.addEventListener('click', () => {
      this.confirmAndResetProgress();
    });

    this.modalOverlay.querySelector('.close-settings-btn')?.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
    });
  }

  private confirmAndResetProgress(): void {
    const isConfirmed = window.confirm('确定要一键重置所有进度吗？\n所有已收集的糖纸、解锁的夜色形态将全部清空，书页将重新翻回第一页。');
    if (isConfirmed) {
      this.modalOverlay.style.display = 'none';
      this.audio.playSfx('pageFlip');
      this.director.resetAllProgress();
      this.renderControlsForScene('C01');
    }
  }

  

  private showCardPreviewModal(dataUrl: string): void {
    this.modalOverlay.style.display = 'flex';
    this.modalOverlay.innerHTML = `
      <div class="card-preview-modal">
        <img src="${dataUrl}" alt="万圣节快乐持有证" />
        <div class="settings-footer" style="flex-direction: column; gap: 8px;">
          <div style="font-size: 13px; color: ${THEME_COLORS.inkBrown}; text-align: center; font-weight: bold;">
            长按上方图片即可选择【存储图像】保存至系统相册
          </div>
          <button class="paper-btn close-card-btn">完成</button>
        </div>
      </div>
    `;
    this.modalOverlay.querySelector('.close-card-btn')?.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
    });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private showCustomMessageModal(onBack?: () => void): void {
    this.audio.unlock();
    this.audio.playSfx('chime');
    const message = this.persistence.getCustomMessage();
    this.modalOverlay.style.display = 'flex';
    this.modalOverlay.className = 'modal-overlay yang-modal-overlay';
    this.modalOverlay.innerHTML = `
      <div class="yang-message-modal">
        <div class="yang-modal-stamp">🎃 10.31 万圣夜</div>
        <div class="custom-message-content">${this.escapeHtml(message)}</div>
        <div class="yang-modal-footer">
          <button class="paper-btn accent yang-close-btn">收下心意 🧡</button>
        </div>
      </div>
    `;

    this.modalOverlay.querySelector('.yang-close-btn')?.addEventListener('click', () => {
      this.audio.playSfx('twinkle');
      this.modalOverlay.style.display = 'none';
      this.modalOverlay.className = 'modal-overlay';
      if (onBack) onBack();
    });

    this.modalOverlay.onclick = (e) => {
      if (e.target === this.modalOverlay) {
        this.modalOverlay.style.display = 'none';
        this.modalOverlay.className = 'modal-overlay';
        if (onBack) onBack();
      }
    };
  }

  // Alias for backward compatibility & test suites
  private showYangMessageModal(): void {
    this.showCustomMessageModal();
  }

  private openMessageEditorModal(): void {
    const currentMsg = this.persistence.getCustomMessage();
    const currentBtn = this.persistence.getCustomMessageButton();
    this.modalOverlay.style.display = 'flex';
    this.modalOverlay.className = 'modal-overlay';
    this.modalOverlay.innerHTML = `
      <div class="settings-modal message-editor-modal" style="max-height: 90vh; display: flex; flex-direction: column; width: 92%; max-width: 360px;">
        <div class="settings-header">
          <div class="settings-title">✏️ 编辑专属留言</div>
          <button class="close-editor-btn" style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--color-ink-brown); padding: 4px 8px;">✕</button>
        </div>
        <div class="handbook-content" style="flex: 1; overflow-y: auto; padding: 6px 0; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 11.5px; color: var(--color-ink-light); line-height: 1.5; background: rgba(237, 154, 85, 0.12); padding: 8px 10px; border-radius: 6px;">
            📝 <strong>txt 文档格式</strong>：支持直接按 <strong>Enter 换行</strong>、<strong>空格键留空</strong>，输入什么内容就原样排版呈现。
          </div>
          <div>
            <label style="font-size: 12px; font-weight: bold; color: var(--color-ink-brown); display: block; margin-bottom: 4px;">
              按钮名称（可选）：
            </label>
            <input type="text" id="editorBtnInput" value="${this.escapeHtml(currentBtn)}" placeholder="来自TA的留言 💌" style="width: 100%; box-sizing: border-box; padding: 7px 10px; border: 1.5px solid var(--color-ink-brown); border-radius: 6px; font-size: 13.5px; background: #FFFDF9; color: var(--color-ink-brown);" />
          </div>
          <div style="flex: 1; display: flex; flex-direction: column;">
            <label style="font-size: 12px; font-weight: bold; color: var(--color-ink-brown); display: block; margin-bottom: 4px;">
              留言正文（支持多行/换行/空格）：
            </label>
            <textarea id="editorTextInput" rows="8" placeholder="在此写下留给TA的信...&#10;支持按 Enter 键换行&#10;支持空格与段落排版" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1.5px solid var(--color-ink-brown); border-radius: 6px; font-size: 13.5px; line-height: 1.6; font-family: inherit; background: #FFFDF9; color: var(--color-ink-brown); resize: vertical; min-height: 140px; white-space: pre-wrap;">${this.escapeHtml(currentMsg)}</textarea>
          </div>
          <div id="editorNotice" style="display: none; font-size: 12px; color: #2E7D32; font-weight: bold; text-align: center; padding: 4px 0;">
            ✓ 留言已成功保存！
          </div>
        </div>
        <div class="settings-footer" style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; margin-top: 10px;">
          <button class="paper-btn secondary editor-reset-btn" style="flex: 1; min-width: 80px; padding: 7px 8px; font-size: 12.5px;">恢复默认</button>
          <button class="paper-btn secondary editor-preview-btn" style="flex: 1; min-width: 80px; padding: 7px 8px; font-size: 12.5px;">👁️ 预览信札</button>
          <button class="paper-btn accent editor-save-btn" style="flex: 1.2; min-width: 100px; padding: 7px 8px; font-size: 12.5px;">💾 保存留言</button>
        </div>
        <div style="margin-top: 8px; text-align: center;">
          <button class="editor-copy-link-btn" style="background: none; border: none; font-size: 11.5px; color: #8C3B2B; text-decoration: underline; cursor: pointer; padding: 3px;">
            🔗 复制专属分享链接（发送给TA直接看）
          </button>
        </div>
      </div>
    `;

    const btnInput = document.getElementById('editorBtnInput') as HTMLInputElement;
    const textInput = document.getElementById('editorTextInput') as HTMLTextAreaElement;
    const noticeEl = document.getElementById('editorNotice') as HTMLElement;

    const showNotice = (text: string, isError: boolean = false) => {
      noticeEl.innerText = text;
      noticeEl.style.color = isError ? '#D32F2F' : '#2E7D32';
      noticeEl.style.display = 'block';
      setTimeout(() => {
        if (noticeEl) noticeEl.style.display = 'none';
      }, 3000);
    };

    // Save
    this.modalOverlay.querySelector('.editor-save-btn')?.addEventListener('click', () => {
      const msg = textInput.value;
      const btn = btnInput.value.trim() || DEFAULT_MESSAGE_BUTTON_LABEL;
      this.persistence.setCustomMessage(msg);
      this.persistence.setCustomMessageButton(btn);
      this.audio.playSfx('boop');
      showNotice('✓ 留言已成功保存！');
    });

    // Reset default
    this.modalOverlay.querySelector('.editor-reset-btn')?.addEventListener('click', () => {
      textInput.value = DEFAULT_CUSTOM_MESSAGE;
      btnInput.value = DEFAULT_MESSAGE_BUTTON_LABEL;
      this.persistence.setCustomMessage(DEFAULT_CUSTOM_MESSAGE);
      this.persistence.setCustomMessageButton(DEFAULT_MESSAGE_BUTTON_LABEL);
      this.audio.playSfx('boop');
      showNotice('已恢复为默认温馨留言模版');
    });

    // Preview
    this.modalOverlay.querySelector('.editor-preview-btn')?.addEventListener('click', () => {
      const msg = textInput.value;
      const btn = btnInput.value.trim() || DEFAULT_MESSAGE_BUTTON_LABEL;
      this.persistence.setCustomMessage(msg);
      this.persistence.setCustomMessageButton(btn);
      this.showCustomMessageModal(() => {
        this.openMessageEditorModal();
      });
    });

    // Copy share link
    this.modalOverlay.querySelector('.editor-copy-link-btn')?.addEventListener('click', () => {
      const msg = textInput.value;
      const btn = btnInput.value.trim() || DEFAULT_MESSAGE_BUTTON_LABEL;
      this.persistence.setCustomMessage(msg);
      this.persistence.setCustomMessageButton(btn);

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('msg', msg);
        if (btn && btn !== DEFAULT_MESSAGE_BUTTON_LABEL) {
          url.searchParams.set('btn', btn);
        } else {
          url.searchParams.delete('btn');
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url.toString()).then(() => {
            showNotice('✓ 分享链接已复制到剪贴板！');
          }).catch(() => {
            window.prompt('请长按复制下方专属链接：', url.toString());
          });
        } else {
          window.prompt('请长按复制下方专属链接：', url.toString());
        }
      } catch (err) {
        showNotice('复制失败，请手动在浏览器地址栏添加参数', true);
      }
    });

    // Close
    const closeBtn = this.modalOverlay.querySelector('.close-editor-btn');
    closeBtn?.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
      if (this.director.currentScene === 'C04') {
        this.renderControlsForScene('C04');
      }
    });
  }

  private showCertificateModal(): void {
    const state = this.persistence.getState();
    const isFullRun = this.director.eatenCandiesInRun.length >= 5;
    const endingTitle = isFullRun ? '深夜守夜人 · 荣誉证书' : '万圣节快乐持有证';
    const subNote = isFullRun ? '以极大的耐心与温柔，陪一只不合群的鬼尝遍了五种夜色。' : (state.chosenQuote || '有些夜晚并不特别。有人替它多留了一颗糖。');
    const cardUrl = EndingCardRenderer.renderCardToDataUrl(state, endingTitle, subNote, state.chosenQuote);
    state.firstRunCompleted = true;
    this.persistence.save();

    this.modalOverlay.style.display = 'flex';
    this.modalOverlay.innerHTML = `
      <div class="card-preview-modal">
        <img src="${cardUrl}" alt="万圣节快乐持有证" />
        <div class="settings-footer" style="flex-direction: column; gap: 8px;">
          <div style="font-size: 13px; color: ${THEME_COLORS.inkBrown}; text-align: center; font-weight: bold;">
            长按上方图片存储至相册，或选择下方动作：
          </div>
          <div style="display: flex; gap: 10px; width: 100%; justify-content: center;">
            <button class="paper-btn secondary" id="certRestartBtn">再翻一次 ↺</button>
            <button class="paper-btn accent" id="certFreeFeedBtn">去看看半糖 👻</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('certRestartBtn')?.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
      this.director.startNewRun();
    });

    document.getElementById('certFreeFeedBtn')?.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
      this.director.goToScene('S27');
    });
  }

  private getCandySvgIcon(type: CandyType): string {
    switch (type) {
      case 'pumpkin':
        return `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 4 C11 2 13 2 12 1 M6 7 C3 9 3 17 6 19 C8 21 16 21 18 19 C21 17 21 9 18 7 C15 5 9 5 6 7 Z" fill="#ED9A55" stroke="#47392F" stroke-width="1.5"/></svg>`;
      case 'milk':
        return `<svg viewBox="0 0 24 24" width="22" height="22"><rect x="4" y="6" width="16" height="12" rx="4" fill="#FFFFFF" stroke="#47392F" stroke-width="1.5"/><circle cx="9" cy="12" r="1.5" fill="#47392F"/><circle cx="15" cy="12" r="1.5" fill="#47392F"/></svg>`;
      case 'star':
        return `<svg viewBox="0 0 24 24" width="22" height="22"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="#F4CA64" stroke="#47392F" stroke-width="1.5"/></svg>`;
      case 'blackSugar':
        return `<svg viewBox="0 0 24 24" width="22" height="22"><rect x="5" y="5" width="14" height="14" rx="2" fill="#653D2A" stroke="#47392F" stroke-width="1.5"/><line x1="8" y1="8" x2="16" y2="16" stroke="#3E2417" stroke-width="1.2"/></svg>`;
      case 'cloud':
        return `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 16 A4 4 0 0 1 7 8 A5 5 0 0 1 17 8 A4 4 0 0 1 17 16 Z" fill="#F0EFF9" stroke="#47392F" stroke-width="1.5"/></svg>`;
      case 'mint':
        return `<svg viewBox="0 0 24 24" width="22" height="22"><polygon points="12,3 21,12 12,21 3,12" fill="#A0D8C3" stroke="#47392F" stroke-width="1.5"/></svg>`;
      case 'heart':
        return `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 21 C12 21 3 13 3 7 A4.5 4.5 0 0 1 12 5 A4.5 4.5 0 0 1 21 7 C21 13 12 21 12 21 Z" fill="#B66862" stroke="#47392F" stroke-width="1.5"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="8" fill="#F4CA64" stroke="#47392F" stroke-width="1.5"/></svg>`;
    }
  }

  // Position ghost speech bubble relative to ghost head apex (zero overlap)
  private updateGhostBubblePosition(): void {
    if (!this.ghostSpeechBubble || !this.ghostSpeechBubble.classList.contains('visible')) return;
    const s = this.director.currentScene;
    const isCandyRain = ['P02', 'S10', 'S11', 'S12'].includes(s);
    const gx = isCandyRain ? this.director.candyRain.ghostX : (this.ghost.x || (this.width / 2));
    const gy = isCandyRain ? this.director.candyRain.ghostY : (this.ghost.y || (this.height * 0.48));
    const anchor = this.ghost.getSpeechBubbleAnchor(gx, gy);
    this.ghostSpeechBubble.style.left = `${Math.round(anchor.x)}px`;
    this.ghostSpeechBubble.style.top = `${Math.round(anchor.y)}px`;
  }

  // --- Main Animation & Render Loop ---
  private renderLoop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    // Director update (ghost state, minigames, timers)
    this.director.update(dt);
    this.input.update(dt);

    // Dynamic positioning of ghost speech bubble relative to ghost head
    this.updateGhostBubblePosition();

    // Update flying candy animation
    if (this.flyingCandy) {
      this.flyingCandy.progress += dt / this.flyingCandy.duration;
      if (this.flyingCandy.progress >= 0.5 && this.ghost.action !== 'anticipate') {
        this.ghost.setAction('anticipate');
      }
      if (this.flyingCandy.progress >= 1) {
        const cb = this.flyingCandy.onComplete;
        this.flyingCandy = null;
        cb();
      }
    }

    // Canvas rendering
    this.renderCanvas();

    requestAnimationFrame((t) => this.renderLoop(t));
  }

  private renderCanvas(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const s = this.director.currentScene;

    // 1. Draw Scene Background Atmosphere
    this.renderBackground(ctx, s);

    // 2. Minigame specific drawings
    if (['P02', 'S10', 'S11', 'S12'].includes(s)) {
      this.director.candyRain.render(ctx);
    }

    // 3. Render Half-Candy (GhostActor)
    if (s !== 'P00' && s !== 'S00' && s !== 'S01' && s !== 'S02') {
      if (['P02', 'S10', 'S11', 'S12'].includes(s)) {
        // P0-01: Render ghost exactly at the candy rain lower rail to match collision bounds
        this.ghost.render(ctx, this.director.candyRain.ghostX, this.director.candyRain.ghostY);
      } else {
        this.ghost.render(ctx, this.ghost.x, this.ghost.y);
      }
    }

    // 4. In P01 / S04: Render draggable Trial Candy on table if not dragging
    if (((s === 'P01' && !this.director.p01Fed) || s === 'S04') && !this.draggingCandy) {
      this.renderTrialCandy(ctx, this.s04CandyPos.x, this.s04CandyPos.y);
    }

    // 5. Render Dragging Candy under finger
    if (this.draggingCandy) {
      this.renderDraggingCandy(ctx, this.draggingCandy, this.candyDragX, this.candyDragY);
    }

    // 6. Render Flying Candy Arc
    if (this.flyingCandy) {
      const { type, startX, startY, targetX, targetY, progress } = this.flyingCandy;
      const p = Math.min(1, Math.max(0, progress));
      const arcY = Math.sin(p * Math.PI) * 70;
      const curX = startX + (targetX - startX) * p;
      const curY = startY + (targetY - startY) * p - arcY;
      this.renderDraggingCandy(ctx, type, curX, curY);
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D, scene: SceneId): void {
    ctx.save();

    if (scene === 'C01' || scene === 'C02' || scene === 'C03' || scene === 'C04') {
      ctx.fillStyle = '#F7E9D2';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.strokeStyle = 'rgba(71, 57, 47, 0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(18, 18, this.width - 36, this.height - 36);

      ctx.fillStyle = 'rgba(71, 57, 47, 0.04)';
      ctx.beginPath();
      ctx.arc(this.width - 32, 32, 20, 0, Math.PI * 2);
      ctx.fill();
    } else if (scene === 'P00') {
      // Midnight book cover for V2 literary edition
      ctx.fillStyle = '#1F2942';
      ctx.fillRect(0, 0, this.width, this.height);

      // Aged paper inner frame
      ctx.strokeStyle = 'rgba(247, 233, 210, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, this.width - 32, this.height - 32);

      // Slanted silver/warm crescent moon
      const breath = this.ghost.reduceMotion ? 0 : Math.sin(performance.now() * 0.002) * 2;
      ctx.beginPath();
      ctx.arc(this.moonX, this.moonY, 36 + breath, 0, Math.PI * 2);
      ctx.fillStyle = '#ED9A55';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.moonX + 10, this.moonY - 6, 32 + breath, 0, Math.PI * 2);
      ctx.fillStyle = '#1F2942';
      ctx.fill();

      // Title 《今夜宜喂鬼》
      ctx.fillStyle = '#F7E9D2';
      ctx.font = 'bold 30px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText('《今夜宜喂鬼》', this.width / 2, this.height * 0.48);

      ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#ED9A55';
      ctx.fillText('深夜读物，建议配糖', this.width / 2, this.height * 0.55);

      // Marginal print
      ctx.font = 'italic 13px "PingFang SC", "Microsoft YaHei", serif';
      ctx.fillStyle = 'rgba(247, 233, 210, 0.65)';
      ctx.fillText('十月的最后几页，总有些小东西不愿归档。', this.width / 2, this.height * 0.68);
    } else if (scene === 'S00') {
      // Print shop stamp page
      ctx.fillStyle = '#1F2942';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#F7E9D2';
      ctx.beginPath();
      ctx.roundRect(24, 24, this.width - 48, this.height - 48, 12);
      ctx.fill();

      // Stamp in center
      ctx.strokeStyle = THEME_COLORS.inkBrown;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.width / 2 - 50, this.height / 2 - 50, 100, 100);
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👻', this.width / 2, this.height / 2);
    } else if (scene === 'S01') {
      // Midnight book cover
      ctx.fillStyle = '#1F2942';
      ctx.fillRect(0, 0, this.width, this.height);

      // Gold breathing moon with bite mark
      const breath = this.ghost.reduceMotion ? 0 : Math.sin(performance.now() * 0.002) * 2;
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height * 0.38, 48 + breath, 0, Math.PI * 2);
      ctx.fillStyle = '#ED9A55';
      ctx.fill();

      // Title
      ctx.fillStyle = '#F7E9D2';
      ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", serif';
      ctx.textAlign = 'center';
      ctx.fillText('《今夜宜喂鬼》', this.width / 2, this.height * 0.54);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#A5A0C8';
      ctx.fillText('不给糖就捣蛋，以及其他小事。', this.width / 2, this.height * 0.60);
    } else if (scene === 'S02') {
      // Page 1: Moon
      ctx.beginPath();
      ctx.arc(this.moonX, this.moonY, this.moonRadius, 0.4, Math.PI * 1.6, false);
      ctx.fillStyle = '#47392F';
      ctx.fill();

      // Corner bulge on bottom right
      ctx.beginPath();
      ctx.moveTo(this.width - 50, this.height - 30);
      ctx.quadraticCurveTo(this.width - 20, this.height - 50, this.width - 10, this.height - 20);
      ctx.fillStyle = '#EADBBE';
      ctx.fill();
      ctx.strokeStyle = THEME_COLORS.inkBrown;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (['P02', 'S09', 'S10', 'S11', 'S12'].includes(scene)) {
      // Candy Rain Sky Horizon
      ctx.strokeStyle = 'rgba(71, 57, 47, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, this.height - 90);
      ctx.lineTo(this.width, this.height - 90);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderTrialCandy(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);

    // Subtle breathing pulse
    const s = 1.0 + (this.ghost.reduceMotion ? 0 : Math.sin(performance.now() * 0.003) * 0.05);
    ctx.scale(s, s);

    ctx.fillStyle = 'rgba(237, 154, 85, 0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ED9A55';
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // White wrapper twists
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-28, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(28, -8);
    ctx.lineTo(28, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private renderDraggingCandy(ctx: CanvasRenderingContext2D, type: CandyType, x: number, y: number): void {
    ctx.save();
    const meta = CANDIES[type];
    ctx.translate(x, y);

    // Glow under dragged candy
    ctx.fillStyle = 'rgba(237, 154, 85, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();

    // Candy body
    ctx.fillStyle = meta.color;
    ctx.strokeStyle = meta.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// Start app once DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
