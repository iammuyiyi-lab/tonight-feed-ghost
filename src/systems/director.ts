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

  // Real-time Ghost Speech Bubble (Follows Ghost directly on canvas)
  public setGhostSpeech(text: string | null, autoDismissSeconds?: number): void {
    if (this.ghostSpeechTimer !== null) {
      clearTimeout(this.ghostSpeechTimer);
      this.ghostSpeechTimer = null;
    }
    this.ghostSpeech = text;
    if (this.onGhostSpeechUpdated) {
      this.onGhostSpeechUpdated(text);
    }
    if (text && autoDismissSeconds && autoDismissSeconds > 0) {
      this.ghostSpeechTimer = setTimeout(() => {
        this.ghostSpeech = null;
        if (this.onGhostSpeechUpdated) {
          this.onGhostSpeechUpdated(null);
        }
        this.ghostSpeechTimer = null;
      }, autoDismissSeconds * 1000);
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
          this.setGhostSpeech('珍珠好像沉底了……留了一个未完成的悬念。');
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
        this.ghost.setAction('idle');
        this.ghost.isHoldingNote = true;
        this.ghost.noteFrontText = CHAPTER_SCRIPTS.C04.noteFrontLines.join(' ');
        const souvenir = state.chosenQuote || CANDY_RESPONSES[state.mainFormThisRun === 'pumpkin' ? 'pumpkin' : state.mainFormThisRun === 'milktea' ? 'milk' : state.mainFormThisRun === 'movie' ? 'blackSugar' : state.mainFormThisRun === 'sleepwalk' ? 'cloud' : 'star'].souvenirQuote;
        this.ghost.noteBackText = souvenir;
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
  public feedCandyInC02(type: CandyType): { success: boolean; comment: string } {
    if (this.currentPhase !== 'interactive') {
      return { success: false, comment: '' };
    }
    this.currentPhase = 'resolving';
    this.c02SelectedCandy = type;
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

    // First dialogue
    const comment = candyResp.firstDialogue[0];
    const speech = candyResp.firstDialogue.join(' ');
    this.setGuide('糖分在纸页上徐徐化开，唤醒了一段夜色……', 'narration');
    this.setGhostSpeech(speech);

    const epoch = this.sceneEpoch;
    setTimeout(() => {
      if (this.sceneEpoch !== epoch) return;
      this.ghost.targetLookY = 0.85;
      const abLines = (CHAPTER_SCRIPTS.C02.abnormality as any)[type] || [
        '等一下，这颗糖有一点副作用。',
        '说明书早就过期了。',
      ];
      this.setGuide('半糖低头端详自己，身体发生了奇妙的诗意异变。', 'narration');
      this.setGhostSpeech(abLines.join(' '));
      setTimeout(() => {
        if (this.sceneEpoch === epoch) {
          this.goToScene('C03');
        }
      }, 1400);
    }, 1600);

    if (this.onActionControlsUpdated) {
      this.onActionControlsUpdated();
    }
    return { success: true, comment };
  }

  public tapC01(): void {
    if (this.c01SignTapped) return;
    this.c01SignTapped = true;
    this.currentPhase = 'resolving';
    this.ghost.setAction('bounce', 0.8);
    this.ghost.expression = 'joy';
    this.audio.playSfx('boop');
    this.setGuide('半糖看起来很高兴。', 'narration');
    this.setGhostSpeech(CHAPTER_SCRIPTS.C01.tapResponse);
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
    const epoch = this.sceneEpoch;
    setTimeout(() => {
      if (this.sceneEpoch === epoch) {
        this.goToScene('C02');
      }
    }, 900);
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
    const epoch = this.sceneEpoch;
    setTimeout(() => {
      if (this.sceneEpoch !== epoch) return;
      if (this.eatenCandiesInRun.length < 5) {
        const remainingCount = 5 - this.eatenCandiesInRun.length;
        this.setGhostSpeech(`（细细回味）胃里存下了一段故事。但长夜未央，托盘里还剩 ${remainingCount} 颗不同滋味的糖。`);
        this.setGuide(`点击下方翻页按钮，翻向下一页继续品尝（还剩 ${remainingCount} 颗）。`, 'hint');
        if (this.onActionControlsUpdated) this.onActionControlsUpdated();
      } else {
        this.setGhostSpeech('五颗糖都吃完了……南瓜的秋意、标点的留白、诗人的废诗、默片的克制，还有云朵的逃跑。谢谢你陪我读完这个夜晚。');
        this.setGuide('夜色已完全在纸页上化开。点击翻向终章，收下回礼。', 'hint');
        if (this.onActionControlsUpdated) this.onActionControlsUpdated();
      }
    }, 1300);
  }

  public straightenPumpkinHatC03(): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'resolving';
    this.ghost.hatTilt = 0;
    this.ghost.headTiltBack = -0.15;
    this.audio.playSfx('boop');
    this.persistence.unlockWrapper('03');
    this.persistence.save();
    this.setGuide(CHAPTER_SCRIPTS.C03.pumpkin.philosophy, 'narration');
    this.setGhostSpeech(CHAPTER_SCRIPTS.C03.pumpkin.line);
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
    this.scheduleNextAfterC03();
  }

  public shakeMilkTeaC03(): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'resolving';
    this.ghost.showQuestionPearls = true;
    this.audio.playSfx('boop');
    this.persistence.unlockWrapper('04');
    this.persistence.save();
    const line = CHAPTER_SCRIPTS.C03.milktea.lines.join(' ');
    this.setGuide(CHAPTER_SCRIPTS.C03.milktea.philosophy, 'narration');
    this.setGhostSpeech(line);
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
    this.scheduleNextAfterC03();
  }

  public choosePoetWordC03(word: '月亮' | '糖纸' | '失眠'): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'resolving';
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
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
  }

  public finishPoetC03(): void {
    this.advanceFromC03();
  }

  public hitMovieSlateC03(): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'resolving';
    this.audio.playSfx('clapper');
    this.ghost.setAction('tumble', 1.2);
    this.persistence.unlockWrapper('06');
    this.persistence.save();
    this.setGuide(CHAPTER_SCRIPTS.C03.movie.philosophy, 'narration');
    this.setGhostSpeech(CHAPTER_SCRIPTS.C03.movie.line);
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
    this.scheduleNextAfterC03();
  }

  public chooseSleepwalkerDreamC03(dreamId: 'door' | 'boat' | 'window'): void {
    if (this.c03Finished) return;
    this.c03Finished = true;
    this.currentPhase = 'resolving';
    this.c03ChosenDream = dreamId;
    const card = CHAPTER_SCRIPTS.C03.sleepwalk.cards.find(c => c.id === dreamId);
    const line = card ? card.line : '我梦见天上下起了不会过期的糖。';
    this.audio.playSfx('twinkle');
    this.persistence.unlockWrapper('07');
    this.persistence.save();
    this.setGuide(line, 'narration');
    this.setGhostSpeech(line);
    if (this.onActionControlsUpdated) this.onActionControlsUpdated();
    const epoch = this.sceneEpoch;
    setTimeout(() => {
      if (this.sceneEpoch !== epoch) return;
      this.ghost.targetFloatOffsetY = 0;
      this.ghost.setAction('idle');
      this.setGuide(CHAPTER_SCRIPTS.C03.sleepwalk.philosophy, 'narration');
      this.setGhostSpeech(CHAPTER_SCRIPTS.C03.sleepwalk.outroLine);
      this.scheduleNextAfterC03();
    }, 1300);
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
