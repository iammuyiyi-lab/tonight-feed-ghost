import { PersistenceSystem } from './systems/persistence';
import { AudioDirector } from './systems/audio';
import { GhostActor } from './systems/ghost';
import { InputRouter } from './systems/input';
import { SceneDirector } from './systems/director';
import { HandbookView } from './views/handbookView';
import { EndingCardRenderer } from './views/endingCardView';
import { QADevView } from './views/qaView';
import { THEME_COLORS, CANDIES, FORMS_META } from './config/constants';
import { SCENE_SCRIPTS } from './config/dialogues';
import { CANDY_WRAPPERS } from './config/collectibles';
import { CandyType, SceneId, GhostFormId } from './types';
import { PumpkinFaceType } from './games/pumpkinGame';
import { PunctuationType } from './games/milkTeaGame';
import { DreamShape } from './games/sleepwalkerGame';

class GameApp {
  private persistence: PersistenceSystem;
  private audio: AudioDirector;
  private ghost: GhostActor;
  private director: SceneDirector;
  private input: InputRouter;
  private handbookView: HandbookView;
  private qaView: QADevView;

  // DOM elements
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stageContainer: HTMLElement;
  private pageIndicator: HTMLElement;
  private subtitleContainer: HTMLElement;
  private subtitleTextEl: HTMLElement;
  private skipHintEl: HTMLElement;
  private minigameOverlay: HTMLElement;
  private bottomActionRow: HTMLElement;
  private modalOverlay: HTMLElement;
  private settingsBtn: HTMLElement;
  private handbookBtn: HTMLElement;

  // Dragging candy state in S04 / S06 / S27
  private draggingCandy: CandyType | null = null;
  private candyDragX: number = 0;
  private candyDragY: number = 0;
  private candyTeaseTracker: { approached: boolean; count: number } = { approached: false, count: 0 };

  // S02 Moon Long-Press state
  private moonX: number = 0;
  private moonY: number = 0;
  private moonRadius: number = 32;

  // S02 Bulge tap state
  private bulgeClicked: boolean = false;

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
    this.handbookView = new HandbookView(this.persistence.getState());

    // Fetch DOM references
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.stageContainer = document.getElementById('stageContainer')!;
    this.pageIndicator = document.getElementById('pageIndicator')!;
    this.subtitleContainer = document.getElementById('subtitleContainer')!;
    this.subtitleTextEl = document.getElementById('subtitleText')!;
    this.skipHintEl = document.getElementById('skipHint')!;
    this.minigameOverlay = document.getElementById('minigameOverlay')!;
    this.bottomActionRow = document.getElementById('bottomActionRow')!;
    this.modalOverlay = document.getElementById('modalOverlay')!;
    this.settingsBtn = document.getElementById('settingsBtn')!;
    this.handbookBtn = document.getElementById('handbookBtn')!;

    this.input = new InputRouter(this.stageContainer);
    this.qaView = new QADevView(this.persistence, (scene) => this.director.goToScene(scene));

    this.init();
  }

  private async init(): Promise<void> {
    await this.persistence.whenReady();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.bindDOMEvents();
    this.bindInputEvents();
    this.qaView.init();

    // Scene changed hook
    this.director.onSceneChanged = (scene) => {
      this.updateHeader(scene);
      this.renderControlsForScene(scene);
    };

    // Subtitle updated hook
    this.director.onSubtitleUpdated = (text, isDone) => {
      this.subtitleTextEl.innerText = text;
      this.skipHintEl.style.opacity = isDone ? '0' : '0.7';
    };

    // Start with S00 or last checkpoint
    this.director.goToScene('S00');

    // Start Game Render Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.renderLoop(t));
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
    this.ghost.y = this.height * 0.52;

    // Adjust candy rain rail
    this.director.candyRain.stageWidth = this.width;
    this.director.candyRain.stageHeight = this.height;
    this.director.candyRain.ghostX = this.ghost.x;

    // Moon position in S01 / S02
    this.moonX = this.width * 0.72;
    this.moonY = this.height * 0.22;
  }

  private bindDOMEvents(): void {
    // Fast skip subtitles on click
    this.subtitleContainer.addEventListener('click', () => {
      this.director.skipOrNextDialogue();
    });

    // Settings Modal
    this.settingsBtn.addEventListener('click', () => {
      this.openSettingsModal();
    });

    // Handbook Modal
    this.handbookBtn.addEventListener('click', () => {
      this.openHandbookModal();
    });
  }

  private bindInputEvents(): void {
    // Pointer move for eye tracking and candy drag
    this.input.onPointerMove = (x, y) => {
      this.ghost.setLookAt(x, y, this.ghost.x, this.ghost.y);

      // Handle candy rain horizontal ghost dragging
      if (['S10', 'S11', 'S12'].includes(this.director.currentScene) && this.input.pointer.isDown) {
        this.director.candyRain.ghostX = Math.max(50, Math.min(this.width - 50, x));
        this.ghost.x = this.director.candyRain.ghostX;
      }

      // Handle dragging candy in feeding scenes
      if (this.draggingCandy) {
        this.candyDragX = x;
        this.candyDragY = y;

        // Check distance to ghost mouth
        const mouthX = this.ghost.x;
        const mouthY = this.ghost.y - 14;
        const dist = Math.sqrt((x - mouthX) ** 2 + (y - mouthY) ** 2);

        if (dist < 60) {
          this.ghost.setAction('anticipate');
          this.candyTeaseTracker.approached = true;
        } else if (this.candyTeaseTracker.approached && dist > 140) {
          // Teased ghost!
          this.candyTeaseTracker.approached = false;
          this.candyTeaseTracker.count++;
          if (this.candyTeaseTracker.count >= 3) {
            this.director.registerTeasingCandy();
          }
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

    // Drag end: drop candy into ghost mouth
    this.input.onDragEnd = (x, y) => {
      if (this.draggingCandy) {
        const mouthX = this.ghost.x;
        const mouthY = this.ghost.y - 14;
        const dist = Math.sqrt((x - mouthX) ** 2 + (y - mouthY) ** 2);

        if (dist < 72) {
          // Suction and feed!
          if (this.director.currentScene === 'S04') {
            this.ghost.setAction('eat', 0.6);
            this.audio.playSfx('swallow');
            this.director.goToScene('S05');
          } else {
            this.director.feedCandy(this.draggingCandy);
            this.renderControlsForScene(this.director.currentScene);
          }
        } else {
          // Dropped on empty floor: bouncy elastic return
          this.audio.playSfx('boop');
          if (this.director.currentScene === 'S04') {
            this.ghost.setAction('angry', 1.0);
            this.director.showDialogueQueue([SCENE_SCRIPTS.S04.wrongDrop]);
          }
        }
        this.draggingCandy = null;
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
      this.audio.playSfx('poke');
      const { pokeCount5In5s } = this.ghost.poke();

      if (pokeCount5In5s) {
        this.director.showDialogueQueue(['这一章我有意见。']);
        this.persistence.discoverEasterEgg('EGG01');
      } else {
        if (s === 'S03') {
          this.director.showDialogueQueue(['我们还没熟到可以戳脸。']);
        } else if (s === 'S04') {
          // Flip cardboard sign
          this.ghost.isNoteFlipped = !this.ghost.isNoteFlipped;
        } else if (s === 'S27' && this.ghost.action === 'sleep') {
          // Poked sleeping ghost (ordinary)
          this.ghost.setAction('idle');
          this.director.showDialogueQueue(['……睡醒了。']);
        }
      }
      return;
    }

    // S02: Tap on bulged page corner
    if (s === 'S02') {
      const cornerX = this.width - 40;
      const cornerY = this.height - 80;
      if (Math.abs(x - cornerX) < 60 && Math.abs(y - cornerY) < 60) {
        this.bulgeClicked = true;
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
    let indicator = 'Ⅰ / Ⅴ';
    if (['S00', 'S01', 'S02', 'S03', 'S04', 'S05'].includes(scene)) {
      indicator = '序章 · 掉落';
    } else if (['S06', 'S07', 'S08'].includes(scene)) {
      indicator = 'Ⅰ / Ⅴ · 食谱';
    } else if (['S09', 'S10', 'S11', 'S12', 'S13'].includes(scene)) {
      indicator = 'Ⅱ / Ⅴ · 糖雨';
    } else if (scene.startsWith('S15') || scene.startsWith('S16') || scene.startsWith('S17') || scene.startsWith('S18') || scene.startsWith('S19') || scene === 'S14' || scene === 'S20') {
      indicator = 'Ⅲ / Ⅴ · 变身';
    } else if (['S21', 'S22', 'S23', 'S24'].includes(scene)) {
      indicator = 'Ⅳ / Ⅴ · 付账';
    } else if (['S25', 'S26'].includes(scene)) {
      indicator = 'Ⅴ / Ⅴ · 尾声';
    } else if (scene === 'S27') {
      indicator = '自由喂养 · 夜班';
    } else if (scene === 'S30') {
      indicator = '隐藏心事 · 秘密';
    }
    this.pageIndicator.innerText = indicator;
  }

  // --- Dynamic Action Controls per Scene ---
  private renderControlsForScene(scene: SceneId): void {
    this.bottomActionRow.innerHTML = '';
    this.minigameOverlay.innerHTML = '';

    switch (scene) {
      case 'S00': {
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '翻开这本书';
        btn.onclick = async () => {
          await this.audio.unlock();
          this.audio.playSfx('pageFlip');
          this.director.goToScene('S01');
        };
        this.bottomActionRow.appendChild(btn);
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
        // Feed trial candy button / drag target
        const btn = document.createElement('button');
        btn.className = 'paper-btn';
        btn.innerText = '递给它试吃糖果';
        btn.onclick = () => {
          this.ghost.setAction('eat', 0.6);
          this.audio.playSfx('swallow');
          this.director.goToScene('S05');
        };
        this.bottomActionRow.appendChild(btn);
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
        // Candy rain gameplay instructions
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
        // Pumpkin Hat Adjustment + Face Draw UI
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
        // Milk tea Shake + Punctuation arrange
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
        // Poet word chip selector
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
        }
        break;
      }

      case 'S18_D': {
        // Movie Takes 1, 2, 3
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
        // Sleepwalker Constellation
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

      case 'S20': {
        // Second form selection bookmarks
        const state = this.persistence.getState();
        const main = state.mainFormThisRun || 'poet';
        const allCandidates: GhostFormId[] = ['pumpkin', 'milktea', 'poet', 'movie', 'sleepwalk'];
        const remaining = allCandidates.filter((f) => f !== main);

        const b1 = document.createElement('button');
        b1.className = 'paper-btn secondary';
        b1.innerText = `体验：${FORMS_META[remaining[0]].name}`;
        b1.onclick = () => {
          this.audio.playSfx('boop');
          this.director.showDialogueQueue(['糖分有续集。', `${FORMS_META[remaining[0]].name}体验完成。`], () => {
            this.director.goToScene('S21');
          });
        };

        const b2 = document.createElement('button');
        b2.className = 'paper-btn secondary';
        b2.innerText = `体验：${FORMS_META[remaining[1]].name}`;
        b2.onclick = () => {
          this.audio.playSfx('boop');
          this.director.showDialogueQueue(['糖分有续集。', `${FORMS_META[remaining[1]].name}体验完成。`], () => {
            this.director.goToScene('S21');
          });
        };

        this.bottomActionRow.appendChild(b1);
        this.bottomActionRow.appendChild(b2);
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

      case 'S22': {
        // S22 wrapper sorting slots
        const container = document.createElement('div');
        container.className = 'wrapper-slots-container';

        for (let i = 0; i < 3; i++) {
          const slot = document.createElement('div');
          const placedId = this.director.sortedWrappers[i];
          slot.className = `wrapper-slot ${placedId ? 'filled' : ''}`;
          if (placedId) {
            const w = CANDY_WRAPPERS.find((x) => x.id === placedId);
            slot.innerHTML = `<strong>#${placedId}</strong><br>${w?.title || '糖纸'}`;
          } else {
            slot.innerHTML = `槽位 ${i + 1}<br>(轻触放入)`;
            slot.onclick = () => {
              const state = this.persistence.getState();
              const available = ['01', '02', '03', '04', '05', '06', '07', '08', '09'].filter(
                (id) => !this.director.sortedWrappers.includes(id)
              );
              if (available.length > 0) {
                this.director.putWrapperInSlot(available[0]);
                this.renderControlsForScene('S22');
              }
            };
          }
          container.appendChild(slot);
        }
        this.minigameOverlay.appendChild(container);

        if (this.director.sortedWrappers.length >= 3) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'paper-btn';
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

        const b2 = document.createElement('button');
        b2.className = 'paper-btn secondary';
        b2.innerText = '查看饲养手册';
        b2.onclick = () => this.openHandbookModal();

        const b3 = document.createElement('button');
        b3.className = 'paper-btn';
        b3.innerText = '再读一遍';
        b3.onclick = () => {
          this.persistence.resetForNewRun();
          this.director.goToScene('S01');
        };

        this.bottomActionRow.appendChild(b1);
        this.bottomActionRow.appendChild(b2);
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

        // Check if Heart Form S30 is accessible
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
        this.draggingCandy = cType;
        const rect = this.stageContainer.getBoundingClientRect();
        this.candyDragX = e.clientX - rect.left;
        this.candyDragY = e.clientY - rect.top;
      });

      // Tap alternative
      item.addEventListener('click', () => {
        this.director.feedCandy(cType);
        this.renderControlsForScene(this.director.currentScene);
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
      this.persistence.save();
    });

    this.modalOverlay.querySelector('.close-settings-btn')?.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
    });
  }

  private openHandbookModal(): void {
    this.modalOverlay.style.display = 'flex';
    this.handbookView.render(
      this.modalOverlay,
      (formId) => {
        // Replay form minigame
        this.modalOverlay.style.display = 'none';
        this.director.enterMainFormMiniGame(formId);
      },
      () => {
        this.modalOverlay.style.display = 'none';
      }
    );
  }

  private showCardPreviewModal(dataUrl: string): void {
    this.modalOverlay.style.display = 'flex';
    this.modalOverlay.innerHTML = `
      <div class="card-preview-modal">
        <img src="${dataUrl}" alt="万圣节快乐持有证" />
        <div class="settings-footer" style="flex-direction: column; gap: 8px;">
          <div style="font-size: 12px; color: ${THEME_COLORS.inkLight}; text-align: center;">
            长按上方卡片即可在手机中【存储图像】
          </div>
          <button class="paper-btn close-card-btn">完成</button>
        </div>
      </div>
    `;
    this.modalOverlay.querySelector('.close-card-btn')?.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
    });
  }

  // --- Main Animation & Render Loop ---
  private renderLoop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    // Director update (ghost state, minigames, timers)
    this.director.update(dt);
    this.input.update(dt);

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
    if (['S10', 'S11', 'S12'].includes(s)) {
      this.director.candyRain.render(ctx);
    }

    // 3. Render Half-Candy (GhostActor)
    if (s !== 'S00' && s !== 'S01' && s !== 'S02') {
      this.ghost.render(ctx, this.ghost.x, this.ghost.y);
    }

    // 4. Render Dragging Candy under finger
    if (this.draggingCandy) {
      this.renderDraggingCandy(ctx, this.draggingCandy, this.candyDragX, this.candyDragY);
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D, scene: SceneId): void {
    ctx.save();

    if (scene === 'S00') {
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
      const breath = Math.sin(performance.now() * 0.002) * 2;
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
    } else if (['S09', 'S10', 'S11', 'S12'].includes(scene)) {
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
