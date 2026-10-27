import { CandyType } from '../types';
import { THEME_COLORS, CANDIES } from '../config/constants';
import { AudioDirector } from '../systems/audio';

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

  // Ghost rail position
  public ghostX: number = 150;
  public ghostWidth: number = 90;
  public stageWidth: number = 360;
  public stageHeight: number = 600;

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

    // Update positions and check collisions
    const ghostCatchY = this.stageHeight - 110;
    const ghostCatchBox = {
      left: this.ghostX - this.ghostWidth * 0.55,
      right: this.ghostX + this.ghostWidth * 0.55,
      top: ghostCatchY - 30,
      bottom: ghostCatchY + 40,
    };

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * dt;
      if (!this.reduceMotion) {
        item.rotation += item.rotSpeed * dt;
      }

      // Check collision with ghost
      if (
        !item.caught &&
        item.y >= ghostCatchBox.top &&
        item.y <= ghostCatchBox.bottom &&
        item.x >= ghostCatchBox.left &&
        item.x <= ghostCatchBox.right
      ) {
        item.caught = true;
        this.handleCatch(item);
        this.items.splice(i, 1);
        continue;
      }

      // Check floor miss
      if (item.y > this.stageHeight + 30) {
        if (!item.caught) {
          this.consecutiveCatches = 0;
        }
        this.items.splice(i, 1);
      }
    }

    // Check wave transition
    if (this.waveTimeRemaining <= 0) {
      if (this.wave < 3) {
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
    const x = 30 + Math.random() * (this.stageWidth - 60);
    const speed = (110 + this.wave * 20 + Math.random() * 30);
    const rotSpeed = this.reduceMotion ? 0 : (Math.random() - 0.5) * 2.5;

    let type: FallingItem['type'] = 'candy';
    let candyType: CandyType = 'pumpkin';

    if (this.wave === 1) {
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

    if (item.type === 'candy') {
      this.caughtCandyCount++;
      if (item.candyType) {
        const meta = CANDIES[item.candyType];
        this.routeScoresEarned[meta.primaryRoute] += 1;
      }
      if (this.consecutiveCatches === 5) {
        this.showCallout('我可能天生适合农业。', 1.8);
      }
    } else if (item.type === 'paperNote') {
      this.showCallout('不许饿着故事里的鬼。', 2.0);
      this.routeScoresEarned.poet += 2;
    } else if (item.type === 'movieTicket') {
      this.showCallout('主角竟然是我？', 2.0);
      this.routeScoresEarned.movie += 2;
    } else if (item.type === 'milkCup') {
      this.showCallout('这杯里只有哲学。', 2.0);
      this.routeScoresEarned.milktea += 2;
    } else if (item.type === 'sock') {
      this.showCallout('命运为什么有味道？', 2.2);
      if (this.onEasterEggTriggered) {
        this.onEasterEggTriggered('EGG07');
      }
    } else if (item.type === 'inkBottle') {
      this.showCallout('我的思想漏出来了。', 2.0);
      this.routeScoresEarned.poet += 2;
    } else if (item.type === 'bookmark') {
      this.showCallout('书签……卡在身体里了。', 2.0);
      if (this.onGentleActTriggered) {
        this.onGentleActTriggered('pickedBookmark');
      }
      if (this.onEasterEggTriggered) {
        this.onEasterEggTriggered('EGG08');
      }
    } else if (item.type === 'moonShard') {
      this.showCallout('月亮原来这么轻。', 2.0);
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
