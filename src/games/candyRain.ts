import { CandyType } from '../types';
import { THEME_COLORS, CANDIES } from '../config/constants';
import { AudioDirector } from '../systems/audio';
import { GhostActor } from '../systems/ghost';

export interface FallingItem {
  id: number;
  type: 'candy' | 'bookmark' | 'paperNote' | 'milkCup' | 'sock' | 'movieTicket' | 'inkBottle' | 'moonShard' | 'heart';
  candyType?: CandyType;
  x: number;
  y: number;
  speed: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  caught: boolean;
}

export class CandyRainGame {
  public wave: number = 1; // 1, 2, 3
  public waveTimeRemaining: number = 22;
  public caughtCandyCount: number = 0;
  public consecutiveCatches: number = 0;
  public isPaused: boolean = false;
  public isFinished: boolean = false;
  public reduceMotion: boolean = false;

  // Active falling items
  public items: FallingItem[] = [];
  private nextItemId: number = 1;
  private spawnTimer: number = 0;
  private audio: AudioDirector;

  // Ghost Actor reference & collision rail
  public ghostActor: GhostActor | null = null;
  public ghostX: number = 150;
  public ghostY: number = 490;
  public ghostWidth: number = 90;
  public stageWidth: number = 360;
  public stageHeight: number = 600;

  // Single-wave mode for 3-5 min literary story (P02)
  public isSingleWave: boolean = false;
  public totalItemsSpawned: number = 0;
  public calloutCount: number = 0;
  public static showDebugBounds: boolean = false;

  // Dialogue callout triggered during rain
  public currentCallout: string | null = null;
  public calloutTimer: number = 0;

  // Tracked catches for scores
  public routeScoresEarned = {
    pumpkin: 0,
    milktea: 0,
    poet: 0,
    movie: 0,
    sleepwalk: 0,
  };

  public onWaveComplete: ((wave: number) => void) | null = null;
  public onGameComplete: ((totalCaught: number) => void) | null = null;
  public onEasterEggTriggered: ((eggId: string) => void) | null = null;
  public onGentleActTriggered: ((act: keyof import('../types').GentleActs) => void) | null = null;

  constructor(audio: AudioDirector) {
    this.audio = audio;
    this.resetEntireRainGame();
  }

  // Full reset for a fresh new run
  public resetEntireRainGame(): void {
    this.wave = 1;
    this.waveTimeRemaining = 22;
    this.caughtCandyCount = 0;
    this.consecutiveCatches = 0;
    this.items = [];
    this.spawnTimer = 0.5;
    this.isPaused = false;
    this.isFinished = false;
    this.isSingleWave = false;
    this.totalItemsSpawned = 0;
    this.calloutCount = 0;
    this.currentCallout = null;
    this.calloutTimer = 0;
    this.routeScoresEarned = {
      pumpkin: 0,
      milktea: 0,
      poet: 0,
      movie: 0,
      sleepwalk: 0,
    };
  }

  // Single wave configuration for P02 (~35-45s)
  public startSingleWaveMode(duration: number = 40): void {
    this.resetEntireRainGame();
    this.isSingleWave = true;
    this.wave = 1;
    this.waveTimeRemaining = duration;
    this.spawnTimer = 0.6;
  }

  // Early advance when player caught at least 3 candies
  public completeRainEarly(): void {
    if (this.isFinished) return;
    this.isFinished = true;
    if (this.onGameComplete) {
      this.onGameComplete(this.caughtCandyCount);
    }
  }

  // Wave reset that preserves current run scores
  public resetWave(wave: number): void {
    this.wave = wave;
    this.waveTimeRemaining = 22;
    this.items = [];
    this.spawnTimer = 0.5;
    this.currentCallout = null;
    this.calloutTimer = 0;
  }

  public update(dt: number): void {
    if (this.isPaused || this.isFinished) return;

    this.waveTimeRemaining -= dt;
    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) {
        this.currentCallout = null;
      }
    }

    // Spawn falling items
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnItem();
      // Wave 1: 0.9 - 1.3s, Wave 2: 0.8 - 1.1s, Wave 3: 0.6 - 0.9s
      const interval = this.wave === 1 ? 1.0 : this.wave === 2 ? 0.9 : 0.75;
      this.spawnTimer = interval + Math.random() * 0.3;
    }

    // Update positions and check collisions using GhostActor's actual screen bounds
    this.ghostY = this.stageHeight - 110;
    const bounds = this.ghostActor
      ? this.ghostActor.getCatchBounds(this.ghostX, this.ghostY)
      : {
          left: this.ghostX - 50,
          right: this.ghostX + 50,
          top: this.ghostY - 102,
          bottom: this.ghostY + 102,
          centerX: this.ghostX,
          centerY: this.ghostY,
          mouthX: this.ghostX,
          mouthY: this.ghostY - 14,
          radius: 50,
        };

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * dt;
      if (!this.reduceMotion) {
        item.rotation += item.rotSpeed * dt;
      }

      // Exact collision with ghost upper body and mouth
      const itemRadius = item.size * 0.5;
      const inY = item.y + itemRadius >= bounds.top && item.y - itemRadius <= bounds.mouthY + 35;
      const inX = item.x + itemRadius >= bounds.left && item.x - itemRadius <= bounds.right;

      if (!item.caught && inY && inX) {
        item.caught = true;
        if (this.ghostActor) {
          this.ghostActor.setAction('eat', 0.35);
        }
        this.handleCatch(item);
        this.items.splice(i, 1);
        continue;
      }

      // Check floor miss (absorbed into page bottom)
      if (item.y > this.stageHeight + 30) {
        if (!item.caught) {
          this.consecutiveCatches = 0;
        }
        this.items.splice(i, 1);
      }
    }

    // Check wave transition or single-wave finish
    if (this.waveTimeRemaining <= 0) {
      if (this.isSingleWave) {
        this.isFinished = true;
        if (this.onGameComplete) {
          this.onGameComplete(this.caughtCandyCount);
        }
      } else if (this.wave < 3) {
        const finishedWave = this.wave;
        this.wave++;
        this.waveTimeRemaining = 22;
        if (this.onWaveComplete) {
          this.onWaveComplete(finishedWave);
        }
      } else {
        this.isFinished = true;
        // Guaranteed bonus if player missed red heart in wave 3
        if (this.routeScoresEarned.poet === 0 && this.caughtCandyCount === 0) {
          this.routeScoresEarned.poet += 2;
        }
        if (this.onGameComplete) {
          this.onGameComplete(this.caughtCandyCount);
        }
      }
    }
  }

  private spawnItem(): void {
    let x = 30 + Math.random() * (this.stageWidth - 60);
    let speed = 110 + this.wave * 20 + Math.random() * 30;
    const rotSpeed = this.reduceMotion ? 0 : (Math.random() - 0.5) * 2.5;

    let type: FallingItem['type'] = 'candy';
    let candyType: CandyType = 'pumpkin';

    if (this.isSingleWave) {
      // P02 single-wave pacing:
      // First 3 items are guaranteed easy candies dropped near ghost for immediate success!
      if (this.totalItemsSpawned < 3) {
        x = Math.max(40, Math.min(this.stageWidth - 40, this.ghostX + (Math.random() - 0.5) * 50));
        speed = 115;
        const easyTypes: CandyType[] = ['pumpkin', 'milk', 'star'];
        candyType = easyTypes[this.totalItemsSpawned % easyTypes.length];
        type = 'candy';
      } else {
        const roll = Math.random();
        if (roll < 0.55) {
          type = 'candy';
          const options: CandyType[] = ['pumpkin', 'milk', 'star', 'mint', 'cloud'];
          candyType = options[Math.floor(Math.random() * options.length)];
        } else if (roll < 0.70) {
          type = 'paperNote';
        } else if (roll < 0.82) {
          type = 'bookmark';
        } else if (roll < 0.92) {
          type = 'sock';
        } else {
          type = 'moonShard';
        }
      }
      this.totalItemsSpawned++;
    } else if (this.wave === 1) {
      // Good weather: candies
      const options: CandyType[] = ['pumpkin', 'milk', 'star', 'cloud'];
      candyType = options[Math.floor(Math.random() * options.length)];
      type = 'candy';
    } else if (this.wave === 2) {
      // Literary precipitation: items + candy
      const roll = Math.random();
      if (roll < 0.22) {
        type = 'paperNote';
      } else if (roll < 0.40) {
        type = 'movieTicket';
      } else if (roll < 0.55) {
        type = 'milkCup';
      } else if (roll < 0.68) {
        type = 'sock';
      } else if (roll < 0.80) {
        type = 'inkBottle';
      } else if (roll < 0.90) {
        type = 'bookmark';
      } else {
        type = 'candy';
        candyType = 'star';
      }
    } else {
      // Messy moon rain
      const roll = Math.random();
      if (roll < 0.35) {
        type = 'moonShard';
      } else if (roll < 0.50 && this.waveTimeRemaining < 16 && this.waveTimeRemaining > 4) {
        type = 'heart';
        candyType = 'heart';
      } else {
        type = 'candy';
        const candOptions: CandyType[] = ['cloud', 'mint', 'star', 'pumpkin'];
        candyType = candOptions[Math.floor(Math.random() * candOptions.length)];
      }
    }

    this.items.push({
      id: this.nextItemId++,
      type,
      candyType,
      x,
      y: -30,
      speed,
      rotation: 0,
      rotSpeed,
      size: type === 'candy' || type === 'heart' ? 24 : 28,
      caught: false,
    });
  }

  private handleCatch(item: FallingItem): void {
    this.consecutiveCatches++;
    this.audio.playSfx('catch');

    // Literary absurd callouts for single-wave P02 (limited to max 2 with interval)
    if (this.isSingleWave && this.calloutCount < 2 && this.calloutTimer <= 0) {
      if (item.type === 'paperNote') {
        this.showCallout('空气里有点不负责的文学。', 2.0);
        this.calloutCount++;
      } else if (item.type === 'bookmark') {
        this.showCallout('这大概是某本书逃出来的骨头。', 2.0);
        this.calloutCount++;
      } else if (item.type === 'sock') {
        this.showCallout('天气预报没有说这个。', 2.0);
        this.calloutCount++;
      } else if (this.consecutiveCatches >= 3) {
        this.showCallout('我今天的运气有具体的形状。', 1.8);
        this.calloutCount++;
      }
    }

    if (item.type === 'candy') {
      this.caughtCandyCount++;
      if (item.candyType) {
        const meta = CANDIES[item.candyType];
        this.routeScoresEarned[meta.primaryRoute] += 1;
      }
      if (!this.isSingleWave && this.consecutiveCatches === 5) {
        this.showCallout('我可能天生适合农业。', 1.8);
      }
    } else if (item.type === 'paperNote') {
      if (!this.isSingleWave) {
        this.showCallout('不许饿着故事里的鬼。', 2.0);
      }
      this.routeScoresEarned.poet += 2;
    } else if (item.type === 'movieTicket') {
      this.showCallout('主角竟然是我？', 2.0);
      this.routeScoresEarned.movie += 2;
    } else if (item.type === 'milkCup') {
      this.showCallout('这杯里只有哲学。', 2.0);
      this.routeScoresEarned.milktea += 2;
    } else if (item.type === 'sock') {
      if (!this.isSingleWave) {
        this.showCallout('命运为什么有味道？', 2.2);
      }
      if (this.onEasterEggTriggered) {
        this.onEasterEggTriggered('EGG07');
      }
    } else if (item.type === 'inkBottle') {
      this.showCallout('我的思想漏出来了。', 2.0);
      this.routeScoresEarned.poet += 2;
    } else if (item.type === 'bookmark') {
      if (!this.isSingleWave) {
        this.showCallout('书签……卡在身体里了。', 2.0);
      }
      if (this.onGentleActTriggered) {
        this.onGentleActTriggered('pickedBookmark');
      }
      if (this.onEasterEggTriggered) {
        this.onEasterEggTriggered('EGG08');
      }
    } else if (item.type === 'moonShard') {
      if (!this.isSingleWave) {
        this.showCallout('月亮原来这么轻。', 2.0);
      }
      this.routeScoresEarned.sleepwalk += 2;
    } else if (item.type === 'heart') {
      this.caughtCandyCount++;
      this.showCallout('咳，这只是普通糖。', 2.2);
      this.routeScoresEarned.poet += 3;
    }
  }

  private showCallout(text: string, duration: number): void {
    this.currentCallout = text;
    this.calloutTimer = duration;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const item of this.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      if (!this.reduceMotion) {
        ctx.rotate(item.rotation);
      }
      this.renderItemIcon(ctx, item);
      ctx.restore();
    }

    // Callout popup above ghost
    if (this.currentCallout) {
      this.renderCalloutBox(ctx);
    }

    // QA Debug outline when enabled
    if (CandyRainGame.showDebugBounds || GhostActor.showDebugBounds) {
      const bounds = this.ghostActor
        ? this.ghostActor.getCatchBounds(this.ghostX, this.ghostY)
        : { left: this.ghostX - 50, right: this.ghostX + 50, top: this.ghostY - 102, bottom: this.ghostY + 102, mouthX: this.ghostX, mouthY: this.ghostY - 14 };
      ctx.save();
      ctx.strokeStyle = '#28a745';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
      ctx.fillStyle = '#dc3545';
      ctx.beginPath();
      ctx.arc(bounds.mouthX, bounds.mouthY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private renderItemIcon(ctx: CanvasRenderingContext2D, item: FallingItem): void {
    const s = item.size;
    ctx.strokeStyle = THEME_COLORS.inkBrown;
    ctx.lineWidth = 2;

    switch (item.type) {
      case 'candy': {
        const col = item.candyType ? CANDIES[item.candyType].color : '#ED9A55';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Candy wrapper twists
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-s * 0.45, 0);
        ctx.lineTo(-s * 0.75, -s * 0.3);
        ctx.lineTo(-s * 0.75, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(s * 0.45, 0);
        ctx.lineTo(s * 0.75, -s * 0.3);
        ctx.lineTo(s * 0.75, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'paperNote': {
        ctx.fillStyle = '#FFFDF7';
        ctx.fillRect(-s * 0.4, -s * 0.5, s * 0.8, s * 1.0);
        ctx.strokeRect(-s * 0.4, -s * 0.5, s * 0.8, s * 1.0);
        ctx.fillStyle = THEME_COLORS.inkBrown;
        ctx.fillRect(-s * 0.25, -s * 0.25, s * 0.5, 2);
        ctx.fillRect(-s * 0.25, 0, s * 0.5, 2);
        break;
      }

      case 'movieTicket': {
        ctx.fillStyle = '#ED9A55';
        ctx.fillRect(-s * 0.6, -s * 0.35, s * 1.2, s * 0.7);
        ctx.strokeRect(-s * 0.6, -s * 0.35, s * 1.2, s * 0.7);
        break;
      }

      case 'milkCup': {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(-s * 0.35, -s * 0.45, s * 0.7, s * 0.9);
        ctx.strokeRect(-s * 0.35, -s * 0.45, s * 0.7, s * 0.9);
        break;
      }

      case 'sock': {
        ctx.fillStyle = '#A2B09B';
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, -s * 0.5);
        ctx.lineTo(s * 0.2, -s * 0.5);
        ctx.lineTo(s * 0.2, s * 0.1);
        ctx.lineTo(s * 0.5, s * 0.3);
        ctx.lineTo(s * 0.3, s * 0.5);
        ctx.lineTo(-s * 0.2, s * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'inkBottle': {
        ctx.fillStyle = THEME_COLORS.midnight;
        ctx.fillRect(-s * 0.35, -s * 0.3, s * 0.7, s * 0.7);
        ctx.strokeRect(-s * 0.35, -s * 0.3, s * 0.7, s * 0.7);
        break;
      }

      case 'bookmark': {
        ctx.fillStyle = THEME_COLORS.accentRed;
        ctx.fillRect(-s * 0.2, -s * 0.6, s * 0.4, s * 1.2);
        ctx.strokeRect(-s * 0.2, -s * 0.6, s * 0.4, s * 1.2);
        break;
      }

      case 'moonShard': {
        ctx.fillStyle = '#F7E27B';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.45, 0.5, Math.PI * 1.5, false);
        ctx.quadraticCurveTo(0, 0, s * 0.3, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'heart': {
        ctx.fillStyle = THEME_COLORS.accentRed;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo(-s * 0.5, -s * 0.2, -s * 0.5, -s * 0.6, 0, -s * 0.4);
        ctx.bezierCurveTo(s * 0.5, -s * 0.6, s * 0.5, -s * 0.2, 0, s * 0.3);
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
  }

  private renderCalloutBox(ctx: CanvasRenderingContext2D): void {
    if (!this.currentCallout) return;
    const boxX = this.ghostX;
    const boxY = this.stageHeight - 210;

    ctx.save();
    ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
    const textWidth = ctx.measureText(this.currentCallout).width;
    const padX = 14;
    const padY = 8;
    const w = textWidth + padX * 2;
    const h = 28 + padY;

    ctx.fillStyle = '#FFFDF7';
    ctx.beginPath();
    ctx.roundRect(boxX - w / 2, boxY - h / 2, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = THEME_COLORS.inkBrown;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(boxX - 6, boxY + h / 2);
    ctx.lineTo(boxX, boxY + h / 2 + 8);
    ctx.lineTo(boxX + 6, boxY + h / 2);
    ctx.fillStyle = '#FFFDF7';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = THEME_COLORS.inkBrown;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.currentCallout, boxX, boxY);
    ctx.restore();
  }
}
