import {
  SceneId,
  GhostFormId,
  CandyType,
  RouteScores,
} from '../types';
import { THEME_COLORS, CANDIES, FORMS_META } from '../config/constants';
import { SCENE_SCRIPTS, CANDY_REACTIONS, POKE_DIALOGUES, TEASING_DIALOGUES, IDLE_DIALOGUES } from '../config/dialogues';
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

  // S25 final candy states
  public finalCandyClicks: number = 0;
  public finalCandyOpened: boolean = false;

  // S26 back cover idle timer
  public backCoverTimer: number = 0;
  public backCoverPeeked: boolean = false;

  // Idle timer for EGG03
  public tableIdleTimer: number = 0;

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
    this.pumpkinGame = new PumpkinMiniGame(audio);
    this.milkTeaGame = new MilkTeaMiniGame(audio);
    this.poetGame = new PoetMiniGame(audio);
    this.movieGame = new MovieMiniGame(audio);
    this.sleepwalkerGame = new SleepwalkerMiniGame(audio);

    this.bindMinigameEvents();
  }

  private bindMinigameEvents(): void {
    // Candy Rain completion
    this.candyRain.onGameComplete = (totalCaught) => {
      const state = this.persistence.getState();
      state.totalCandy += totalCaught;
      // Merge route scores
      Object.keys(this.candyRain.routeScoresEarned).forEach((k) => {
        const key = k as keyof RouteScores;
        state.routeScore[key] += this.candyRain.routeScoresEarned[key];
      });
      this.persistence.unlockWrapper('09'); // #09 好天气
      this.persistence.save();
      this.goToScene('S13');
    };

    this.candyRain.onEasterEggTriggered = (eggId) => {
      this.persistence.discoverEasterEgg(eggId);
    };

    this.candyRain.onGentleActTriggered = (act) => {
      this.persistence.recordGentleAct(act);
    };

    // Pumpkin
    this.pumpkinGame.onCompleted = () => {
      this.persistence.unlockWrapper('03');
      this.persistence.unlockForm('pumpkin');
      this.persistence.save();
      this.showDialogueQueue(['成熟果然要付出代价。', '南瓜图章已收录进手册。'], () => {
        this.goToScene('S20');
      });
    };

    // Milk tea
    this.milkTeaGame.onCompleted = () => {
      this.persistence.unlockWrapper('04');
      this.persistence.unlockForm('milktea');
      this.persistence.save();
      this.showDialogueQueue(['这杯喝完，谁来洗杯子？', '奶茶图章已收录进手册。'], () => {
        this.goToScene('S20');
      });
    };

    // Poet
    this.poetGame.onCompleted = (poem) => {
      const state = this.persistence.getState();
      state.savedPoems.push(poem);
      this.persistence.unlockWrapper('05');
      this.persistence.unlockForm('poet');
      this.persistence.save();
      this.showDialogueQueue(['我写完了。', '文学现在应该给我一颗糖。', '诗人图章已收录进手册。'], () => {
        this.goToScene('S20');
      });
    };

    // Movie
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

    // Sleepwalker
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

  public goToScene(scene: SceneId): void {
    this.currentScene = scene;
    const state = this.persistence.getState();
    state.scene = scene;

    // Audio theme router
    this.updateAudioForScene(scene);

    // Save checkpoint for major chapters
    if (['S01', 'S06', 'S09', 'S14', 'S21', 'S26', 'S27'].includes(scene)) {
      state.lastSafeCheckpoint = scene;
      this.persistence.save();
    }

    this.tableIdleTimer = 0;
    this.initSceneState(scene);

    if (this.onSceneChanged) {
      this.onSceneChanged(scene);
    }
  }

  private updateAudioForScene(scene: SceneId): void {
    if (scene === 'S00' || scene === 'S01' || scene === 'S02' || scene === 'S03' || scene === 'S04' || scene === 'S05') {
      this.audio.playTrack('cover');
    } else if (scene === 'S06' || scene === 'S07' || scene === 'S08') {
      this.audio.playTrack('feeding');
    } else if (scene === 'S09' || scene === 'S10' || scene === 'S11' || scene === 'S12' || scene === 'S13') {
      this.audio.playTrack('rain');
    } else if (scene.startsWith('S15') || scene.startsWith('S16') || scene.startsWith('S17') || scene.startsWith('S18') || scene.startsWith('S19') || scene === 'S14' || scene === 'S20') {
      this.audio.playTrack('transform');
    } else {
      this.audio.playTrack('ending');
    }
  }

  private initSceneState(scene: SceneId): void {
    this.ghost.reset();

    switch (scene) {
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
        this.candyRain.reset(1);
        this.setSubtitle('接糖波次 1/3：微甜好天气');
        break;

      case 'S11':
        this.candyRain.reset(2);
        this.setSubtitle('接糖波次 2/3：文学性降水（注意接住杂物）');
        break;

      case 'S12':
        this.candyRain.reset(3);
        this.setSubtitle('接糖波次 3/3：月亮雨与特别糖心');
        break;

      case 'S13':
        this.setSubtitle(SCENE_SCRIPTS.S13.line2(this.candyRain.caughtCandyCount));
        break;

      case 'S14': {
        this.determineMainForm();
        const main = this.persistence.getState().mainFormThisRun || 'poet';
        this.ghost.form = main;
        this.ghost.setAction('transform', 2.0);
        this.showDialogueQueue(SCENE_SCRIPTS.S14.lines, () => {
          this.enterMainFormMiniGame(main);
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

      case 'S20':
        this.ghost.form = 'default';
        this.showDialogueQueue(SCENE_SCRIPTS.S20.lines);
        break;

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
        const state = this.persistence.getState();
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
        const state = this.persistence.getState();
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
    }
  }

  private setSubtitle(text: string): void {
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
    if (this.typewriterTimer !== null) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }

    this.fullSubtitleText = text;
    this.subtitleText = '';
    this.typewriterIndex = 0;
    this.isTyping = true;

    // Speed: ~20 chars/sec = 50ms per char
    this.typewriterTimer = window.setInterval(() => {
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
    state.playedFormsThisRun.push(main);
    this.persistence.unlockForm(main);
    this.persistence.save();
    return main;
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

  // --- Chapter 1 Feeding Logic (S06 / S07) ---
  public feedCandy(type: CandyType): { success: boolean; comment: string } {
    const state = this.persistence.getState();
    state.totalCandy++;
    state.feedCounts[type] = (state.feedCounts[type] || 0) + 1;
    this.chapter1FeedCount++;
    this.chapter1FlavorsTried.add(type);

    // Apply route points
    const meta = CANDIES[type];
    state.routeScore[meta.primaryRoute] += meta.points;
    if (type === 'blackSugar') {
      state.routeScore.poet += 1;
    }

    // Ghost visual & audio
    this.ghost.setAction('eat', 0.6);
    this.audio.playSfx('swallow');

    // Dialogue feedback from S07
    let comment = '';
    const reaction = CANDY_REACTIONS[type];

    if (this.lastFedCandy === type) {
      this.consecutiveSameFeed++;
    } else {
      this.consecutiveSameFeed = 1;
      this.lastFedCandy = type;
    }

    if (this.consecutiveSameFeed === 4) {
      comment = SCENE_SCRIPTS.S06.consecutiveSame4;
      this.persistence.discoverEasterEgg('EGG04');
    } else if (this.consecutiveSameFeed >= 5) {
      comment = SCENE_SCRIPTS.S06.consecutiveSame5;
    } else if (state.feedCounts[type] === 1) {
      comment = reaction.first;
    } else {
      comment = reaction.repeat;
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

  public registerTeasingCandy(): void {
    this.teaserCount++;
    if (this.teaserCount >= 3) {
      this.typewrite(TEASING_DIALOGUES[1]);
      this.persistence.discoverEasterEgg('EGG05');
      this.persistence.recordGentleAct('noTeasingCount');
    } else {
      this.typewrite(TEASING_DIALOGUES[0]);
    }
    this.ghost.setAction('angry', 1.2);
  }

  // --- Chapter 4 S22 Wrapper Sorting ---
  public putWrapperInSlot(wrapperId: string): void {
    if (this.sortedWrappers.includes(wrapperId)) return;
    this.sortedWrappers.push(wrapperId);
    this.audio.playSfx('boop');

    const feedback = SCENE_SCRIPTS.S22.putFeedback[this.sortedWrappers.length - 1] || '这张收录了。';
    this.typewrite(feedback);

    if (this.sortedWrappers.length === 3) {
      // Check EGG11 reverse order
      if (this.sortedWrappers[0] > this.sortedWrappers[1] && this.sortedWrappers[1] > this.sortedWrappers[2]) {
        this.persistence.discoverEasterEgg('EGG11');
      }
      this.showDialogueQueue(SCENE_SCRIPTS.S22.completed);
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

    if (this.currentScene === 'S10' || this.currentScene === 'S11' || this.currentScene === 'S12') {
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
