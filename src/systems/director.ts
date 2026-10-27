import {
  SceneId,
  GhostFormId,
  CandyType,
  RouteScores,
  ScenePhase,
} from '../types';
import { THEME_COLORS, CANDIES, FORMS_META } from '../config/constants';
import { SCENE_SCRIPTS, V2_SCRIPTS, CANDY_REACTIONS, POKE_DIALOGUES, TEASING_DIALOGUES, IDLE_DIALOGUES, CANDY_RESPONSES, CHAPTER_SCRIPTS } from '../config/dialogues';
import { evaluateEndingTitle, CANDY_WRAPPERS } from '../config/collectibles';
import { PersistenceSystem } from './persistence';
import { AudioDirector } from './audio';
import { GhostActor } from './ghost';
import { CandyRainGame } from '../games/candyRain';
import { PumpkinMiniGame, PumpkinFaceType } from '../games/pumpkinGame';
import { MilkTeaMiniGame, PunctuationType } from '../games/milkTeaGame';
import { PoetMiniGame } from '../games/poetGame';
import { MovieMiniGame } from '../games/movieGame';
import { SleepwalkerMiniGame, DreamShape } from '../games/sleepwalkerGame';
import { EndingCardRenderer } from '../views/endingCardView';
import { HandbookView } from '../views/handbookView';

export class SceneDirector {
  public currentScene: SceneId = 'S00';
  public ghost: GhostActor;
  public persistence: PersistenceSystem;
  public audio: AudioDirector;

  // Scene transition Epoch / Token to prevent stale async callbacks
  public sceneEpoch: number = 0;

  // Minigame instances
  public candyRain: CandyRainGame;
  public pumpkinGame: PumpkinMiniGame;
  public milkTeaGame: MilkTeaMiniGame;
  public poetGame: PoetMiniGame;
  public movieGame: MovieMiniGame;
  public sleepwalkerGame: SleepwalkerMiniGame;

  // Dialogue & subtitle state
  public subtitleText: string = '';
  public fullSubtitleText: string = '';
  public isTyping: boolean = false;
  private typewriterTimer: number | null = null;
  private typewriterIndex: number = 0;

  // Scene-specific flags and counters
  public chapter1FeedCount: number = 0;
  public chapter1FlavorsTried: Set<CandyType> = new Set();
  public consecutiveSameFeed: number = 0;
  public lastFedCandy: CandyType | null = null;
  public teaserCount: number = 0;
  public sortedWrappers: string[] = []; // for S22
  public stampsApplied: number = 0; // for S23
  public lastEndingCardUrl: string | null = null;
  public endingTitle: string = '深夜喂鬼员';
  public endingSubNote: string = '今晚你做的最大善事，是喂饱了一只鬼。';

  // S20 Second transformation state
  public s20Candidates: GhostFormId[] = [];
  public s20ChosenForm: GhostFormId | null = null;
  public s20MiniStepDone: boolean = false;

  // S25 final candy states
  public finalCandyClicks: number = 0;
  public finalCandyOpened: boolean = false;

  // S26 back cover idle timer
  public backCoverTimer: number = 0;
  public backCoverPeeked: boolean = false;

  // Idle timer for EGG03
  public tableIdleTimer: number = 0;

  // P0-02: Transient speech bubble decoupled from dialogue queue
  public transientBubbleText: string | null = null;
  private transientBubbleTimer: any = null;
  public onTransientBubbleUpdated: ((text: string | null) => void) | null = null;

  // V2 Streamlined Storyline State
  public currentPhase: ScenePhase = 'enter';
  public lastFeedTime: number = 0;
  public repeatFeedIndices: Record<CandyType, number> = {
    pumpkin: 0,
    milk: 0,
    star: 0,
    blackSugar: 0,
    cloud: 0,
    mint: 0,
    heart: 0,
    moon: 0,
  };
  public c01SignTapped: boolean = false;
  public c02SelectedCandy: CandyType | null = null;
  public c02DialogueStep: number = 0;
  public c03Finished: boolean = false;
  public c03ChosenDream: string | null = null;
  public c04Flipped: boolean = false;
  public eatenCandiesInRun: CandyType[] = [];
  public p01Fed: boolean = false;
  public p01IdleTimer: number = 0;
  public p04SelectedQuote: string = '有些夜晚并不特别。有人替它多留了一颗糖。';

  // Dedicated Ghost Speech Bubble & Narrative Guidance Separation
  public ghostSpeech: string | null = null;
  public onGhostSpeechUpdated: ((text: string | null) => void) | null = null;
  private ghostSpeechTimer: any = null;

  public guideText: string = '';
  public guideType: 'narration' | 'hint' = 'narration';
  public onGuideUpdated: ((text: string, type: 'narration' | 'hint') => void) | null = null;

  // Subtitle queue for multi-line dialogues
  private dialogueQueue: string[] = [];
  private onQueueComplete: (() => void) | null = null;

  // UI callbacks
  public onSceneChanged: ((scene: SceneId) => void) | null = null;
  public onSubtitleUpdated: ((text: string, isDone: boolean) => void) | null = null;
  public onActionControlsUpdated: (() => void) | null = null;

  constructor(persistence: PersistenceSystem, audio: AudioDirector, ghost: GhostActor) {
    this.persistence = persistence;
    this.audio = audio;
    this.ghost = ghost;

    this.candyRain = new CandyRainGame(audio);
    this.candyRain.ghostActor = ghost;
    this.pumpkinGame = new PumpkinMiniGame(audio);
    this.milkTeaGame = new MilkTeaMiniGame(audio);
    this.poetGame = new PoetMiniGame(audio);
    this.movieGame = new MovieMiniGame(audio);
    this.sleepwalkerGame = new SleepwalkerMiniGame(audio);

    this.bindMinigameEvents();
  }

  // P0-02: Show a temporary speech bubble without destroying dialogueQueue or onQueueComplete
  public showTransientBubble(text: string, duration: number = 2.5): void {
    if (this.transientBubbleTimer !== null) {
      clearTimeout(this.transientBubbleTimer);
      this.transientBubbleTimer = null;
    }
    this.transientBubbleText = text;
    if (this.onTransientBubbleUpdated) {
      this.onTransientBubbleUpdated(text);
    }
    this.transientBubbleTimer = setTimeout(() => {
      this.transientBubbleText = null;
      if (this.onTransientBubbleUpdated) {
        this.onTransientBubbleUpdated(null);
      }
      this.transientBubbleTimer = null;
    }, duration * 1000);
  }

  // Real-time Ghost Speech Bubble (Follows Ghost directly on canvas, zero timers)
  public setGhostSpeech(text: string | null): void {
    if (this.ghostSpeechTimer !== null) {
      clearTimeout(this.ghostSpeechTimer);
      this.ghostSpeechTimer = null;
    }
    this.ghostSpeech = text;
    if (this.onGhostSpeechUpdated) {
      this.onGhostSpeechUpdated(text);
    }
  }

  // Story narration & player guidance bar text
  public setGuide(text: string, type: 'narration' | 'hint' = 'narration'): void {
    this.guideText = text;
    this.guideType = type;
    this.fullSubtitleText = text;
    this.subtitleText = text;
    if (this.onGuideUpdated) {
      this.onGuideUpdated(text, type);
    }
    if (this.onSubtitleUpdated) {
      this.onSubtitleUpdated(text, true);
    }
  }

  private bindMinigameEvents(): void {
    // Candy Rain wave synchronization (P0-05)
    this.candyRain.onWaveComplete = (wave) => {
      if (wave === 1) {
        this.goToScene('S11');
      } else if (wave === 2) {
        this.goToScene('S12');
      }
    };

    // Candy Rain completion
    this.candyRain.onGameComplete = (totalCaught) => {
      const state = this.persistence.getState();
      state.totalCandy += totalCaught;
      // Merge route scores
      Object.keys(this.candyRain.routeScoresEarned).forEach((k) => {
        const key = k as keyof RouteScores;
        state.routeScore[key] += this.candyRain.routeScoresEarned[key];
      });

      if (this.currentScene === 'P02') {
        this.persistence.unlockWrapper('01');
        this.persistence.save();
        this.showDialogueQueue([V2_SCRIPTS.P02.burp], () => {
          this.goToScene('P03');
        });
      } else {
        this.persistence.unlockWrapper('09'); // #09 好天气
        this.persistence.save();
        this.goToScene('S13');
      }
    };

    this.candyRain.onEasterEggTriggered = (eggId) => {
      this.persistence.discoverEasterEgg(eggId);
    };

    this.candyRain.onGentleActTriggered = (act) => {
      this.persistence.recordGentleAct(act);
    };

    // Pumpkin S15_A
    this.pumpkinGame.onCompleted = () => {
      this.persistence.unlockWrapper('03');
      this.persistence.unlockForm('pumpkin');
      this.persistence.save();
      this.showDialogueQueue(['成熟果然要付出代价。', '南瓜图章已收录进手册。'], () => {
        this.goToScene('S20');
      });
    };

    // Milk tea S16_B
    this.milkTeaGame.onCompleted = () => {
      this.persistence.unlockWrapper('04');
      this.persistence.unlockForm('milktea');
      this.persistence.save();
      this.showDialogueQueue(['这杯喝完，谁来洗杯子？', '奶茶图章已收录进手册。'], () => {
        this.goToScene('S20');
      });
    };

    // Poet S17_C / P03
    this.poetGame.onCompleted = (poem) => {
      const state = this.persistence.getState();
      state.savedPoems.push(poem);
      this.persistence.unlockWrapper('05');
      this.persistence.unlockForm('poet');
      this.persistence.save();
      if (this.currentScene === 'P03') {
        this.setSubtitle(V2_SCRIPTS.P03.finished);
        if (this.onActionControlsUpdated) {
          this.onActionControlsUpdated();
        }
      } else {
        this.showDialogueQueue(['我写完了。', '文学现在应该给我一颗糖。', '诗人图章已收录进手册。'], () => {
          this.goToScene('S20');
        });
      }
    };

    // Movie S18_D
    this.movieGame.onCompleted = () => {
      this.persistence.unlockWrapper('06');
      this.persistence.unlockForm('movie');
      this.persistence.save();
      this.showDialogueQueue(['感谢自己出演。', '电影图章已收录进手册。'], () => {
        this.goToScene('S20');
      });
    };
    this.movieGame.onEasterEggTriggered = (eggId) => {
      this.persistence.discoverEasterEgg(eggId);
    };

    // Sleepwalker S19_E
    this.sleepwalkerGame.onCompleted = () => {
      this.persistence.unlockWrapper('07');
      this.persistence.unlockForm('sleepwalk');
      this.persistence.save();
      this.showDialogueQueue(['原来梦也要下班。', '梦游图章已收录进手册。'], () => {
        this.goToScene('S20');
      });
    };
    this.sleepwalkerGame.onEasterEggTriggered = (eggId) => {
      this.persistence.discoverEasterEgg(eggId);
    };
  }

  // P0-03: Complete state reset for fresh new run without leaking counts
  public startNewRun(): void {
    this.chapter1FeedCount = 0;
    this.chapter1FlavorsTried.clear();
    this.consecutiveSameFeed = 0;
    this.lastFedCandy = null;
    this.teaserCount = 0;
    this.sortedWrappers = [];
    this.stampsApplied = 0;
    this.s20Candidates = [];
    this.s20ChosenForm = null;
    this.s20MiniStepDone = false;
    this.finalCandyClicks = 0;
    this.finalCandyOpened = false;
    this.backCoverTimer = 0;
    this.backCoverPeeked = false;
    this.tableIdleTimer = 0;
    this.p01Fed = false;
    this.p01IdleTimer = 0;
    this.p04SelectedQuote = '有些夜晚并不特别。有人替它多留了一颗糖。';
    this.c01SignTapped = false;
    this.c02SelectedCandy = null;
    this.c02DialogueStep = 0;
    this.c03Finished = false;
    this.c03ChosenDream = null;
    this.c04Flipped = false;
    this.eatenCandiesInRun = [];

    this.candyRain.resetEntireRainGame();
    this.pumpkinGame.reset();
    this.milkTeaGame.reset();
    this.poetGame.reset();
    this.movieGame.reset();
    this.sleepwalkerGame.reset();

    this.persistence.resetForNewRun();
    this.goToScene('C01');
  }

  // Full reset all progress
  public resetAllProgress(): void {
    this.persistence.resetAllProgress();
    this.startNewRun();
    this.goToScene('C01');
    this.setGuide('已为你重置所有阅读与投喂进度，书页重新回到第一页。', 'narration');
    this.setGhostSpeech('书页重新白了。你好，今晚有糖吗？');
  }

  public goToScene(scene: SceneId): void {
    this.sceneEpoch++;
    const currentEpoch = this.sceneEpoch;

    // Clear any active dialogue timers
    if (this.typewriterTimer !== null) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    this.isTyping = false;
    this.dialogueQueue = [];
    this.onQueueComplete = null;

    this.currentScene = scene;
    const state = this.persistence.getState();
    state.scene = scene;

    // Audio theme router
    this.updateAudioForScene(scene);

    // Save checkpoint for major chapters
    if (['C01', 'C02', 'C03', 'C04', 'P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'S01', 'S06', 'S09', 'S14', 'S21', 'S26', 'S27'].includes(scene)) {
      state.lastSafeCheckpoint = scene;
      this.persistence.save();
    }

    this.tableIdleTimer = 0;
    this.initSceneState(scene, currentEpoch);

    if (this.onSceneChanged) {
      this.onSceneChanged(scene);
    }
  }

  public ensureAudioForCurrentScene(): void {
    this.updateAudioForScene(this.currentScene);
  }

  private updateAudioForScene(scene: SceneId): void {
    if (scene === 'C01' || scene === 'P00' || scene === 'S00' || scene === 'S01' || scene === 'S02' || scene === 'S03' || scene === 'S04' || scene === 'S05') {
      this.audio.playTrack('cover');
    } else if (scene === 'C02' || scene === 'P01' || scene === 'P04' || scene === 'S06' || scene === 'S07' || scene === 'S08') {
      this.audio.playTrack('feeding');
    } else if (scene === 'P02' || scene === 'S09' || scene === 'S10' || scene === 'S11' || scene === 'S12' || scene === 'S13') {
      this.audio.playTrack('rain');
    } else if (scene === 'C03' || scene === 'P03' || scene.startsWith('S15') || scene.startsWith('S16') || scene.startsWith('S17') || scene.startsWith('S18') || scene.startsWith('S19') || scene === 'S14' || scene === 'S20') {
      this.audio.playTrack('transform');
    } else {
      this.audio.playTrack('ending');
    }
  }

  private initSceneState(scene: SceneId, currentEpoch: number): void {
    this.ghost.reset();
    const state = this.persistence.getState();

    switch (scene) {
      case 'C01': {
        this.ghost.setAction('bounce');
        this.ghost.isHoldingNote = true;
        this.ghost.noteFrontText = CHAPTER_SCRIPTS.C01.signText;
        this.ghost.isNoteFlipped = false;
        this.c01SignTapped = false;
        this.currentPhase = 'interactive';
        this.setGuide('一只饥饿的幽灵从书页角落钻了出来。', 'narration');
        this.setGhostSpeech('我本来不是要来这里的。不过既然来了……有糖吗？');
        break;
      }

      case 'C02': {
        this.ghost.setAction('idle');
        this.ghost.form = 'default';
        this.c02SelectedCandy = null;
        this.c02DialogueStep = 0;
        this.currentPhase = 'interactive';
        const progressCount = Math.min(4, this.eatenCandiesInRun.length);
        const stepNote = CHAPTER_SCRIPTS.C02.stepNotes[progressCount] || CHAPTER_SCRIPTS.C02.stepNotes[0];
        const stepSpeech = CHAPTER_SCRIPTS.C02.ghostSpeechSteps[progressCount] || CHAPTER_SCRIPTS.C02.ghostSpeechSteps[0];
        this.setGuide(stepNote, 'narration');
        this.setGhostSpeech(stepSpeech);
        break;
      }

      case 'C03': {
        this.currentPhase = 'interactive';
        this.c03Finished = false;
        this.c03ChosenDream = null;
        const form = state.mainFormThisRun || 'pumpkin';
        this.ghost.form = form;
        if (form === 'pumpkin') {
          this.ghost.hatTilt = -0.38;
          this.ghost.headTiltBack = 0;
          this.setGuide(CHAPTER_SCRIPTS.C03.pumpkin.prompt, 'hint');
          this.setGhostSpeech('头顶有点重……视野歪了。秋意正在倾斜。');
        } else if (form === 'milktea') {
          this.ghost.showQuestionPearls = false;
          this.setGuide(CHAPTER_SCRIPTS.C03.milktea.prompt, 'hint');
          this.setGhostSpeech('不要戳我，我现在只有两分硬度……吹一口气，或许还能抢救一下。');
        } else if (form === 'poet') {
          this.poetGame.reset();
          this.setGuide(CHAPTER_SCRIPTS.C03.poet.prompt, 'hint');
          this.setGhostSpeech('我需要一个词来结束这一首烂诗。');
        } else if (form === 'movie') {
          this.movieGame.reset();
          this.setGuide(CHAPTER_SCRIPTS.C03.movie.prompt, 'hint');
          this.setGhostSpeech('摄影机在哪里？先打板。今晚没有重拍。');
        } else if (form === 'sleepwalk') {
          this.sleepwalkerGame.reset();
          this.ghost.targetFloatOffsetY = -20;
          this.setGuide(CHAPTER_SCRIPTS.C03.sleepwalk.prompt, 'hint');
          this.setGhostSpeech('梦里有好多种可能……替我选一个降落点。');
        }
        break;
      }

      case 'C04': {
        this.ghost.form = 'default';
        this.ghost.setAction('bounce', 0.8);
        this.ghost.expression = 'joy';
        this.ghost.isHoldingNote = false;
        this.ghost.noteFrontText = '';
        this.ghost.noteBackText = '';
        this.ghost.isNoteFlipped = false;
        this.c04Flipped = false;
        this.currentPhase = 'interactive';
        this.setGuide('五页夜色全部品尝完毕，半糖将手写信札郑重递给了你。', 'narration');
        this.setGhostSpeech('五颗糖都吃完了……这是给你的回礼。不许嫌弃。');
        break;
      }

      case 'P00':
        this.ghost.setAction('idle');
        this.setSubtitle(V2_SCRIPTS.P00.marginal);
        break;

      case 'P01':
        this.ghost.setAction('hold-note');
        this.ghost.isHoldingNote = true;
        this.ghost.noteFrontText = V2_SCRIPTS.P01.signFront;
        this.ghost.noteBackText = V2_SCRIPTS.P01.signBack;
        this.ghost.isNoteFlipped = false;
        this.p01Fed = false;
        this.p01IdleTimer = 0;
        this.setSubtitle('拖动南瓜糖喂饱它。');
        break;

      case 'P02':
        this.candyRain.startSingleWaveMode(40);
        this.ghost.setAction('idle');
        this.setSubtitle(`${V2_SCRIPTS.P02.forecast} ${V2_SCRIPTS.P02.ghostLine}`);
        break;

      case 'P03':
        this.ghost.form = 'poet';
        this.ghost.setAction('idle');
        this.poetGame.reset();
        this.setSubtitle(V2_SCRIPTS.P03.marginal);
        break;

      case 'P04':
        this.ghost.form = 'default';
        this.ghost.setAction('idle');
        this.showDialogueQueue(V2_SCRIPTS.P04.ghostLines);
        break;

      case 'P05':
        this.ghost.form = 'default';
        this.ghost.setAction('idle');
        this.finalCandyClicks = 0;
        this.finalCandyOpened = false;
        this.showDialogueQueue(V2_SCRIPTS.P05.scareLines);
        break;

      case 'S00':
        this.setSubtitle(SCENE_SCRIPTS.S00.ready);
        break;

      case 'S01':
        this.ghost.setAction('idle');
        this.setSubtitle(SCENE_SCRIPTS.S01.subtitle);
        break;

      case 'S02':
        this.showDialogueQueue(SCENE_SCRIPTS.S02.lines);
        break;

      case 'S03':
        this.ghost.setAction('tumble');
        this.showDialogueQueue(SCENE_SCRIPTS.S03.lines);
        break;

      case 'S04':
        this.ghost.setAction('hold-note');
        this.showDialogueQueue(SCENE_SCRIPTS.S04.lines);
        break;

      case 'S05':
        this.ghost.setAction('bounce');
        this.persistence.unlockWrapper('01');
        this.showDialogueQueue(SCENE_SCRIPTS.S05.lines);
        break;

      case 'S06':
      case 'S07':
        this.ghost.setAction('idle');
        this.setSubtitle('一只鬼的基本食谱：请投喂至少6颗糖，并品尝两种以上口味。');
        break;

      case 'S08':
        this.ghost.setAction('burp');
        this.showDialogueQueue(SCENE_SCRIPTS.S08.lines);
        break;

      case 'S09':
        this.showDialogueQueue(SCENE_SCRIPTS.S09.lines);
        break;

      case 'S10':
        this.candyRain.resetWave(1);
        this.setSubtitle('接糖波次 1/3：微甜好天气');
        break;

      case 'S11':
        this.candyRain.resetWave(2);
        this.setSubtitle('接糖波次 2/3：气象通知：空气中含有少量文学');
        break;

      case 'S12':
        this.candyRain.resetWave(3);
        this.setSubtitle('接糖波次 3/3：最后一阵雨，来自月亮背面');
        break;

      case 'S13':
        this.setSubtitle(SCENE_SCRIPTS.S13.line2(this.candyRain.caughtCandyCount));
        break;

      case 'S14': {
        this.determineMainForm();
        const main = state.mainFormThisRun || 'poet';
        this.ghost.form = main;
        this.ghost.setAction('transform', 2.0);
        this.showDialogueQueue(SCENE_SCRIPTS.S14.lines, () => {
          if (this.sceneEpoch === currentEpoch) {
            this.enterMainFormMiniGame(main);
          }
        });
        break;
      }

      case 'S15_A':
        this.ghost.form = 'pumpkin';
        this.pumpkinGame.reset();
        this.setSubtitle('南瓜幽灵：横向滑动调整南瓜帽');
        break;

      case 'S16_B':
        this.ghost.form = 'milktea';
        this.milkTeaGame.reset();
        this.setSubtitle('奶茶幽灵：横向拖动摇匀奶茶');
        break;

      case 'S17_C':
        this.ghost.form = 'poet';
        this.poetGame.reset();
        this.setSubtitle('诗人幽灵：每行选择一个词作诗');
        break;

      case 'S18_D':
        this.ghost.form = 'movie';
        this.movieGame.reset();
        this.setSubtitle('电影幽灵：完成三幕小镜头拍摄');
        break;

      case 'S19_E':
        this.ghost.form = 'sleepwalk';
        this.sleepwalkerGame.reset();
        this.setSubtitle('梦游幽灵：拖动星星连缀成梦');
        break;

      case 'S20': {
        this.ghost.form = 'default';
        this.s20ChosenForm = null;
        this.s20MiniStepDone = false;
        this.s20Candidates = this.calculateS20Candidates();
        this.showDialogueQueue(SCENE_SCRIPTS.S20.lines);
        break;
      }

      case 'S21':
        this.showDialogueQueue(SCENE_SCRIPTS.S21.lines);
        break;

      case 'S22':
        this.sortedWrappers = [];
        this.setSubtitle(SCENE_SCRIPTS.S22.guide);
        break;

      case 'S23':
        this.stampsApplied = 0;
        this.showDialogueQueue(SCENE_SCRIPTS.S23.lines);
        break;

      case 'S24': {
        const titleInfo = evaluateEndingTitle(state);
        this.endingTitle = titleInfo.title;
        this.endingSubNote = titleInfo.subNote;
        this.lastEndingCardUrl = EndingCardRenderer.renderCardToDataUrl(state, this.endingTitle, this.endingSubNote);
        this.setSubtitle('已为你生成《万圣节快乐持有证》');
        break;
      }

      case 'S25':
        this.finalCandyClicks = 0;
        this.finalCandyOpened = false;
        this.ghost.setAction('shy');
        this.showDialogueQueue(SCENE_SCRIPTS.S25.lines);
        break;

      case 'S26': {
        state.firstRunCompleted = true;
        this.persistence.save();
        this.backCoverTimer = 0;
        this.backCoverPeeked = false;
        this.setSubtitle(SCENE_SCRIPTS.S26.closing1 + ' ' + SCENE_SCRIPTS.S26.closing2);
        break;
      }

      case 'S27':
        this.setSubtitle('自由喂养模式：夜班没有下班时间，可以自由投喂与切换形态。');
        break;

      case 'S30':
        this.ghost.form = 'heart';
        this.ghost.setAction('shy');
        this.showDialogueQueue(SCENE_SCRIPTS.S30.lines);
        break;
    }
  }

  // --- Dialogue Typewriter & Queue ---
  public showDialogueQueue(lines: string[], onComplete?: () => void): void {
    this.dialogueQueue = [...lines];
    this.onQueueComplete = onComplete || null;
    this.nextDialogueInQueue();
  }

  public nextDialogueInQueue(): void {
    if (this.dialogueQueue.length > 0) {
      const line = this.dialogueQueue.shift()!;
      this.typewrite(line);
    } else {
      if (this.onQueueComplete) {
        const cb = this.onQueueComplete;
        this.onQueueComplete = null;
        cb();
      }
    }
  }

  public skipOrNextDialogue(): void {
    if (this.isTyping) {
      // Instantly reveal current line
      if (this.typewriterTimer !== null) {
        clearInterval(this.typewriterTimer);
        this.typewriterTimer = null;
      }
      this.isTyping = false;
      this.subtitleText = this.fullSubtitleText;
      if (this.onSubtitleUpdated) {
        this.onSubtitleUpdated(this.subtitleText, true);
      }
    } else if (this.dialogueQueue.length > 0) {
      this.nextDialogueInQueue();
    } else if (this.onQueueComplete) {
      // P0-02: Safely trigger and clear pending onQueueComplete without deadlocking
      const cb = this.onQueueComplete;
      this.onQueueComplete = null;
      cb();
    }
  }

  public setSubtitle(text: string): void {
    if (this.typewriterTimer !== null) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    this.isTyping = false;
    this.subtitleText = text;
    this.fullSubtitleText = text;
    if (this.onSubtitleUpdated) {
      this.onSubtitleUpdated(text, true);
    }
  }

  private typewrite(text: string): void {
    const epoch = this.sceneEpoch;
    if (this.typewriterTimer !== null) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }

    this.fullSubtitleText = text;
    this.subtitleText = '';
    this.typewriterIndex = 0;
    this.isTyping = true;

    // Speed: ~22 chars/sec = 45ms per char
    this.typewriterTimer = setInterval(() => {
      if (this.sceneEpoch !== epoch) {
        clearInterval(this.typewriterTimer!);
        return;
      }

      if (this.typewriterIndex < this.fullSubtitleText.length) {
        this.subtitleText += this.fullSubtitleText[this.typewriterIndex];
        this.typewriterIndex++;
        if (this.onSubtitleUpdated) {
          this.onSubtitleUpdated(this.subtitleText, false);
        }
      } else {
        if (this.typewriterTimer !== null) {
          clearInterval(this.typewriterTimer);
          this.typewriterTimer = null;
        }
        this.isTyping = false;
        if (this.onSubtitleUpdated) {
          this.onSubtitleUpdated(this.subtitleText, true);
        }
      }
    }, 45);
  }

  // --- Route & Form Resolution ---
  public determineMainForm(): GhostFormId {
    const scores = this.persistence.getState().routeScore;
    // Route priority tiebreaker: poet > milktea > pumpkin > movie > sleepwalk
    const candidates: Array<{ form: GhostFormId; score: number; priority: number }> = [
      { form: 'poet', score: scores.poet, priority: 5 },
      { form: 'milktea', score: scores.milktea, priority: 4 },
      { form: 'pumpkin', score: scores.pumpkin, priority: 3 },
      { form: 'movie', score: scores.movie, priority: 2 },
      { form: 'sleepwalk', score: scores.sleepwalk, priority: 1 },
    ];

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.priority - a.priority;
    });

    const main = candidates[0].form;
    const state = this.persistence.getState();
    state.mainFormThisRun = main;
    if (!state.playedFormsThisRun.includes(main)) {
      state.playedFormsThisRun.push(main);
    }
    this.persistence.unlockForm(main);
    this.persistence.save();
    return main;
  }

  // P0-04: Calculate top 2 non-main forms for S20
  public calculateS20Candidates(): GhostFormId[] {
    const state = this.persistence.getState();
    const main = state.mainFormThisRun || 'poet';
    const scores = state.routeScore;

    const allForms: Array<{ form: GhostFormId; score: number; priority: number }> = [
      { form: 'poet' as GhostFormId, score: scores.poet, priority: 5 },
      { form: 'milktea' as GhostFormId, score: scores.milktea, priority: 4 },
      { form: 'pumpkin' as GhostFormId, score: scores.pumpkin, priority: 3 },
      { form: 'movie' as GhostFormId, score: scores.movie, priority: 2 },
      { form: 'sleepwalk' as GhostFormId, score: scores.sleepwalk, priority: 1 },
    ].filter((item): item is { form: GhostFormId; score: number; priority: number } => item.form !== main);

    allForms.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.priority - a.priority;
    });

    return [allForms[0].form, allForms[1].form];
  }

  public enterMainFormMiniGame(form: GhostFormId): void {
    switch (form) {
      case 'pumpkin':
        this.goToScene('S15_A');
        break;
      case 'milktea':
        this.goToScene('S16_B');
        break;
      case 'poet':
        this.goToScene('S17_C');
        break;
      case 'movie':
        this.goToScene('S18_D');
        break;
      case 'sleepwalk':
        this.goToScene('S19_E');
        break;
      default:
        this.goToScene('S17_C');
        break;
    }
  }

  // --- Chapter 1 & V2 Feeding Logic ---
  public getC02DialogueSteps(type: CandyType): Array<{ ghostSpeech: string; guideText: string; buttonLabel: string }> {
    const candyResp = CANDY_RESPONSES[type] || CANDY_RESPONSES.pumpkin;
    const firstLine = candyResp.firstDialogue[0] || '我好像成熟了。';
    const secondLine = candyResp.firstDialogue[1] || '但只是植物学意义上的。';
    const abLines = (CHAPTER_SCRIPTS.C02.abnormality as any)[type] || [
      '等一下，这颗糖有一点副作用。',
      '说明书早就过期了。',
    ];
    const abLine = abLines.join(' ');

    const guides: Record<string, [string, string, string]> = {
      pumpkin: [
        '半糖品尝了一口南瓜糖，身体微微变圆。',
        '半糖低头看了看自己，似乎察觉到了一点异样。',
        '秋意在纸页上徐徐发酵，准备翻向下一页。',
      ],
      milk: [
        '你递给它一颗方方正正、裹着薄糯米纸的牛奶糖。',
        '奶糖在它肚子里慢吞吞地化开，泛起一层暖融融的乳白微光。',
        '温热的奶香在纸页间漫开，半糖舒服得快要融化了，准备翻向下一页。',
      ],
      star: [
        '微光在纸面上泛起，一滴墨水落在了半糖头顶。',
        '空白的诗页在它身边悄然浮起。',
        '字句即将变成今晚的押韵，准备翻向下一页。',
      ],
      blackSugar: [
        '灯光忽然有了胶片的颗粒感，像一出黑白默片。',
        '半糖换上了一副严肃认真的默片神情。',
        '老胶卷在夜色里轻声转动，准备翻向下一页。',
      ],
      cloud: [
        '周围的重力悄悄减退，半糖开始向半空漂浮。',
        '一顶睡帽从纸页上方轻轻飘落。',
        '梦境在现实边缘轻轻降落，准备翻向下一页。',
      ],
    };

    const candyGuides = guides[type] || guides.pumpkin;

    return [
      {
        ghostSpeech: firstLine,
        guideText: candyGuides[0],
        buttonLabel: '接着说 💬 (1/3)',
      },
      {
        ghostSpeech: secondLine,
        guideText: candyGuides[1],
        buttonLabel: '查看身体异变 🍂 (2/3)',
      },
      {
        ghostSpeech: abLine,
        guideText: candyGuides[2],
        buttonLabel: '翻页 · 查看小小后遗症 🍂 → (3/3)',
      },
    ];
  }

  public feedCandyInC02(type: CandyType): { success: boolean; comment: string } {
    if (this.currentPhase !== 'interactive') {
      return { success: false, comment: '' };
    }
    this.currentPhase = 'interactive';
    this.c02SelectedCandy = type;
    this.c02DialogueStep = 0;

    const state = this.persistence.getState();
    state.totalCandy++;
    state.feedCounts[type] = (state.feedCounts[type] || 0) + 1;
    this.chapter1FlavorsTried.add(type);

    if (!this.eatenCandiesInRun.includes(type)) {
      this.eatenCandiesInRun.push(type);
    }

    const candyResp = CANDY_RESPONSES[type] || CANDY_RESPONSES.pumpkin;
    state.mainFormThisRun = candyResp.formId;
    if (!state.playedFormsThisRun.includes(candyResp.formId)) {
      state.playedFormsThisRun.push(candyResp.formId);
    }
    this.persistence.unlockForm(candyResp.formId);
    state.chosenQuote = candyResp.souvenirQuote;
    this.persistence.save();

    // Trigger visual reaction
    this.ghost.playCandyFeedback(type, 3.2);
    const sfxName = (candyResp.soundId as any) || 'swallow';
    this.audio.playSfx(sfxName);

    // Apply Step 0 dialogue
    const steps = this.getC02DialogueSteps(type);
    const step0 = steps[0];
    this.ghost.targetLookY = 0;
    this.setGhostSpeech(step0.ghostSpeech);
    this.setGuide(step0.guideText, 'narration');

    if (this.onActionControlsUpdated) {
      this.onActionControlsUpdated();
    }
    return { success: true, comment: step0.ghostSpeech };
  }

  public nextC02DialogueStep(): boolean {
    if (!this.c02SelectedCandy) return false;
    const steps = this.getC02DialogueSteps(this.c02SelectedCandy);
    if (this.c02DialogueStep < steps.length - 1) {
      this.c02DialogueStep++;
      const current = steps[this.c02DialogueStep];
      this.audio.playSfx('boop');
      if (this.c02DialogueStep === 2) {
        this.ghost.targetLookY = 0.85;
      }
      this.setGhostSpeech(current.ghostSpeech);
      this.setGuide(current.guideText, 'narration');
      if (this.onActionControlsUpdated) {
        this.onActionControlsUpdated();
      }
      return true;
    } else {
      // Reached last step, advance to C03!
      this.audio.playSfx('pageFlip');
      this.goToScene('C03');
      return true;
    }
  }

  public tapC01(): void {
    if (this.c01SignTapped) return;
    this.c01SignTapped = true;
    this.currentPhase = 'interactive';
    this.ghost.isHoldingNote = false;
    this.ghost.setAction('bounce', 1.0);
    this.ghost.expression = 'joy';
    this.audio.playSfx('boop');
    this.setGuide('半糖放下了小纸牌，看起来很高兴。点击下方翻页开始挑选糖果。', 'hint');
    this.setGhostSpeech(CHAPTER_SCRIPTS.C01.tapResponse);
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
  }

  public advanceFromC03(): void {
    this.audio.playSfx('pageFlip');
    if (this.eatenCandiesInRun.length < 5) {
      this.goToScene('C02');
    } else {
      this.goToScene('C04');
    }
  }

  public scheduleNextAfterC03(): void {
    // Retain dialogue and philosophy without overwriting; update controls for page-turn button
    this.currentPhase = 'interactive';
    if (this.onActionControlsUpdated) {
      this.onActionControlsUpdated();
    }
  }

  public straightenPumpkinHatC03(): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'interactive';
    this.ghost.hatTilt = 0;
    this.ghost.headTiltBack = -0.15;
    this.audio.playSfx('boop');
    this.persistence.unlockWrapper('03');
    this.persistence.save();
    this.setGuide(CHAPTER_SCRIPTS.C03.pumpkin.philosophy, 'narration');
    this.setGhostSpeech(CHAPTER_SCRIPTS.C03.pumpkin.line);
    this.scheduleNextAfterC03();
  }

  public shakeMilkTeaC03(): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'interactive';
    this.ghost.showQuestionPearls = true;
    this.ghost.expression = 'soft';
    this.ghost.setAction('bounce', 0.8);
    this.audio.playSfx('boop');
    this.persistence.unlockWrapper('04');
    this.persistence.save();
    const line = CHAPTER_SCRIPTS.C03.milktea.lines.join(' ');
    this.setGuide(CHAPTER_SCRIPTS.C03.milktea.philosophy, 'narration');
    this.setGhostSpeech(line);
    this.scheduleNextAfterC03();
  }

  public choosePoetWordC03(word: '月亮' | '糖纸' | '失眠'): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'interactive';
    const poemData = CHAPTER_SCRIPTS.C03.poet.poems[word];
    this.poetGame.generatedPoem = {
      title: poemData.title,
      lines: [...poemData.lines],
      materials: [word, '', ''],
      timestamp: Date.now(),
    };
    this.persistence.savePoem(this.poetGame.generatedPoem);
    this.persistence.unlockWrapper('05');
    this.persistence.save();
    this.audio.playSfx('chime');
    this.setGuide(CHAPTER_SCRIPTS.C03.poet.philosophy, 'narration');
    this.setGhostSpeech(CHAPTER_SCRIPTS.C03.poet.line);
    this.scheduleNextAfterC03();
  }

  public finishPoetC03(): void {
    this.advanceFromC03();
  }

  public hitMovieSlateC03(): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'interactive';
    this.audio.playSfx('clapper');
    this.ghost.setAction('tumble', 1.2);
    this.persistence.unlockWrapper('06');
    this.persistence.save();
    this.setGuide(CHAPTER_SCRIPTS.C03.movie.philosophy, 'narration');
    this.setGhostSpeech(CHAPTER_SCRIPTS.C03.movie.line);
    this.scheduleNextAfterC03();
  }

  public chooseSleepwalkerDreamC03(dreamId: 'door' | 'boat' | 'window'): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'interactive';
    this.c03ChosenDream = dreamId;
    const card = CHAPTER_SCRIPTS.C03.sleepwalk.cards.find(c => c.id === dreamId);
    const line = card ? card.line : '我梦见趴在纸糊的窗台边，把所有的失眠和烦恼，都轻轻关在窗外。';
    const philosophy = card ? (card as any).philosophy : CHAPTER_SCRIPTS.C03.sleepwalk.philosophy;
    this.audio.playSfx('twinkle');
    this.persistence.unlockWrapper('07');
    this.persistence.save();
    this.ghost.targetFloatOffsetY = 0;
    this.ghost.setAction('idle');
    this.ghost.expression = 'sleepy';
    this.setGuide(philosophy, 'narration');
    this.setGhostSpeech(line);
    this.scheduleNextAfterC03();
  }

  public flipC04Note(): void {
    this.c04Flipped = !this.c04Flipped;
    this.ghost.isNoteFlipped = this.c04Flipped;
    this.audio.playSfx('pageFlip');
    if (this.c04Flipped) {
      this.setGuide('信札背面写着写给今晚的一首短诗。', 'narration');
      this.setGhostSpeech('背面写着写给今晚的一首短诗，你看看。');
    } else {
      this.setGuide('信札正面：' + CHAPTER_SCRIPTS.C04.noteFrontLines.join(' '), 'narration');
      this.setGhostSpeech('翻回正面了。今夜宜喂鬼，也宜对自己好一点。');
    }
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
  }

  public feedCandy(type: CandyType, isHungryFeedWithoutTeasing: boolean = false): { success: boolean; comment: string } {
    if (this.currentScene === 'C02') {
      return this.feedCandyInC02(type);
    }

    const state = this.persistence.getState();
    state.totalCandy++;
    state.feedCounts[type] = (state.feedCounts[type] || 0) + 1;
    this.chapter1FeedCount++;
    this.chapter1FlavorsTried.add(type);

    // P1-04: Gentle act: feeding hungry ghost directly without teasing
    if (isHungryFeedWithoutTeasing && this.teaserCount === 0) {
      this.persistence.recordGentleAct('noTeasingCount');
    }

    // Apply route points
    const meta = CANDIES[type];
    if (meta) {
      state.routeScore[meta.primaryRoute] += meta.points;
      if (type === 'blackSugar') {
        state.routeScore.poet += 1;
      }
    }

    // Ghost visual & audio
    this.ghost.playCandyFeedback(type, 2.0);
    const candyResp = CANDY_RESPONSES[type];
    const sfx = (candyResp?.soundId as any) || 'swallow';
    this.audio.playSfx(sfx);

    // Dialogue feedback with cycle and rapid-feed retort
    let comment = '';
    const now = Date.now();
    const isRapid = (now - this.lastFeedTime < 2500) && (this.lastFedCandy === type);
    this.lastFeedTime = now;

    if (this.lastFedCandy === type) {
      this.consecutiveSameFeed++;
    } else {
      this.consecutiveSameFeed = 1;
      this.lastFedCandy = type;
    }

    if (isRapid && candyResp) {
      comment = candyResp.rapidDialogue;
      this.ghost.setAction('angry', 1.5);
      this.ghost.expression = 'complain';
      if (this.consecutiveSameFeed >= 4) {
        this.persistence.discoverEasterEgg('EGG04');
      }
    } else if (candyResp) {
      if (state.feedCounts[type] === 1) {
        comment = candyResp.firstDialogue[0];
      } else if (state.feedCounts[type] === 2) {
        this.repeatFeedIndices[type] = 1;
        comment = candyResp.repeatDialogues[0][0];
      } else {
        const list = candyResp.repeatDialogues;
        const idx = (this.repeatFeedIndices[type]++) % list.length;
        comment = list[idx][0];
      }
      if (this.consecutiveSameFeed >= 4) {
        this.persistence.discoverEasterEgg('EGG04');
      }
    } else if (this.consecutiveSameFeed === 4) {
      comment = SCENE_SCRIPTS.S06.consecutiveSame4;
      this.persistence.discoverEasterEgg('EGG04');
    } else if (this.consecutiveSameFeed >= 5) {
      comment = SCENE_SCRIPTS.S06.consecutiveSame5;
    } else {
      const reaction = CANDY_REACTIONS[type];
      comment = state.feedCounts[type] === 1 ? reaction.first : reaction.repeat;
    }

    this.typewrite(comment);

    // Flavor wrapper unlock check
    if (this.chapter1FlavorsTried.size >= 3) {
      this.persistence.unlockWrapper('02');
    }
    if (state.feedCounts.mint >= 3) {
      this.persistence.unlockWrapper('08');
    }

    this.persistence.save();
    return { success: true, comment };
  }

  // P1-04: Teasing only counts as mischief/egg, NEVER as gentle act
  public registerTeasingCandy(): void {
    this.teaserCount++;
    if (this.teaserCount >= 3) {
      this.typewrite(TEASING_DIALOGUES[1]);
      this.persistence.discoverEasterEgg('EGG05');
    } else {
      this.typewrite(TEASING_DIALOGUES[0]);
    }
    this.ghost.setAction('angry', 1.2);
  }

  // --- Chapter 4 S22 Wrapper Sorting (P1-01) ---
  public putWrapperInSlot(wrapperId: string, slotIndex: number): void {
    // If slot index already has a wrapper, replace it
    if (slotIndex >= 0 && slotIndex < 3) {
      // Remove wrapperId if it was already in another slot
      this.sortedWrappers = this.sortedWrappers.map((w, idx) => (idx === slotIndex ? wrapperId : (w === wrapperId ? '' : w)));
      if (this.sortedWrappers.length <= slotIndex) {
        this.sortedWrappers[slotIndex] = wrapperId;
      }
    } else {
      if (!this.sortedWrappers.includes(wrapperId)) {
        this.sortedWrappers.push(wrapperId);
      }
    }

    this.audio.playSfx('boop');
    const validCount = this.sortedWrappers.filter((w) => !!w).length;
    const feedback = SCENE_SCRIPTS.S22.putFeedback[validCount - 1] || '这张收录了。';
    this.typewrite(feedback);

    if (validCount === 3) {
      // P1-01: True reverse order check (EGG11)
      const w0 = this.sortedWrappers[0];
      const w1 = this.sortedWrappers[1];
      const w2 = this.sortedWrappers[2];
      if (w0 > w1 && w1 > w2) {
        this.persistence.discoverEasterEgg('EGG11');
      }
      this.showDialogueQueue(SCENE_SCRIPTS.S22.completed);
    }
  }

  public removeWrapperFromSlot(slotIndex: number): void {
    if (this.sortedWrappers[slotIndex]) {
      this.sortedWrappers[slotIndex] = '';
      this.audio.playSfx('boop');
      this.setSubtitle('已取出该张糖纸，可重新排版。');
    }
  }

  // --- Chapter 4 S23 Ridiculous Receipt Stamp ---
  public applyReceiptStamp(): void {
    this.stampsApplied++;
    this.audio.playSfx('stamp');

    if (this.stampsApplied > 3) {
      this.typewrite(SCENE_SCRIPTS.S23.overStamp);
    } else {
      this.typewrite(`已盖上小幽灵爪印（${this.stampsApplied}/3）`);
    }
  }

  // --- S25 Final Candy Interaction ---
  public clickFinalCandy(): void {
    if (this.finalCandyOpened) return;
    this.finalCandyClicks++;

    if (this.finalCandyClicks < 3) {
      this.audio.playSfx('boop');
      this.ghost.setAction('shy');
      this.typewrite(SCENE_SCRIPTS.S25.eggTease);
      this.persistence.discoverEasterEgg('EGG06');
    } else {
      // Unwrap candy
      this.finalCandyOpened = true;
      this.audio.playSfx('twinkle');
      this.persistence.unlockWrapper('11'); // #11 偏爱
      this.showDialogueQueue([
        ...SCENE_SCRIPTS.S25.candyUnwrapLines,
        ...SCENE_SCRIPTS.S25.finalLines,
      ]);
    }
  }

  // --- Loop Update for Timers ---
  public update(dt: number): void {
    this.ghost.update(dt);

    if (this.currentScene === 'P01' && !this.p01Fed) {
      this.p01IdleTimer += dt;
      if (this.p01IdleTimer >= 3.0 && !this.ghost.isNoteFlipped) {
        this.ghost.isNoteFlipped = true;
      }
    } else if (this.currentScene === 'P02' || this.currentScene === 'S10' || this.currentScene === 'S11' || this.currentScene === 'S12') {
      this.candyRain.update(dt);
    } else if (this.currentScene === 'S19_E') {
      this.sleepwalkerGame.update(dt);
    } else if (this.currentScene === 'S26') {
      this.backCoverTimer += dt;
      if (this.backCoverTimer >= 12.0 && !this.backCoverPeeked) {
        this.backCoverPeeked = true;
        this.typewrite(SCENE_SCRIPTS.S26.idlePeek);
        this.persistence.discoverEasterEgg('EGG14');
      }
    } else if (this.currentScene === 'S06' || this.currentScene === 'S27') {
      this.tableIdleTimer += dt;
      if (this.tableIdleTimer >= 12.0 && !this.persistence.getState().easterEggs.includes('EGG03')) {
        this.typewrite(SCENE_SCRIPTS.S06.bookEasterEgg);
        this.ghost.setAction('hold-note');
        this.persistence.discoverEasterEgg('EGG03');
      }
    }
  }
}
