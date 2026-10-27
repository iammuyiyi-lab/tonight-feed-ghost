import { GhostAction, GhostExpression, GhostFormId, CatchBounds, CandyType } from '../types';
import { THEME_COLORS } from '../config/constants';

export class GhostActor {
  public form: GhostFormId = 'default';
  public action: GhostAction = 'idle';
  public expression: GhostExpression = 'calm';

  // Physical coordinates & dynamics
  public x: number = 0;
  public y: number = 0;
  public baseScale: number = 1.0;
  public scaleX: number = 1.0;
  public scaleY: number = 1.0;
  public targetScaleX: number = 1.0;
  public targetScaleY: number = 1.0;
  public rotation: number = 0; // radians
  public targetRotation: number = 0;
  public reduceMotion: boolean = false;

  // Eye look target (normalized -1 to 1)
  public lookX: number = 0;
  public lookY: number = 0;
  public targetLookX: number = 0;
  public targetLookY: number = 0;

  // Props and animation states
  public noteFrontText: string = '不给糖就捣蛋。';
  public noteBackText: string = '求求了。';
  public isNoteFlipped: boolean = false;
  public isHoldingNote: boolean = false;

  public mouthOpen: number = 0; // 0 (closed) to 1 (wide)
  public targetMouthOpen: number = 0;

  public blushAlpha: number = 0;
  public tummyInflation: number = 0; // 0 to 0.35

  // V2 Specialized Visual FX & Chapter 3 states
  public activeCandyFX: CandyType | null = null;
  public candyFXTimer: number = 0;
  public ghostAlpha: number = 1.0;
  public floatOffsetY: number = 0;
  public targetFloatOffsetY: number = 0;
  public hatTilt: number = 0;
  public headTiltBack: number = 0;
  public showQuestionPearls: boolean = false;

  // Internal time accumulators
  private animTime: number = 0;
  private actionTimer: number = 0;
  private pokeCountRecent: number = 0;
  private lastPokeTime: number = 0;

  // Debug outline toggle for QA validation
  public static showDebugBounds: boolean = false;

  // Canvas dimensions
  private width: number = 300;
  private height: number = 340;

  constructor() {
    this.reset();
  }

  // P0-01: Expose exact bounding box and mouth coordinate in screen space
  public getCatchBounds(centerX: number, centerY: number, scaleMultiplier: number = 1.0): CatchBounds {
    const sX = Math.abs(this.scaleX) * this.baseScale * scaleMultiplier;
    const sY = Math.abs(this.scaleY) * this.baseScale * scaleMultiplier;

    const eyeOffsetX = this.lookX * 6;
    const mouthX = centerX + (eyeOffsetX * 0.4) * sX;
    const mouthY = centerY - 14 * sY;

    const halfWidth = 55 * sX;
    const top = centerY - 102 * sY;
    const bottom = centerY + 102 * sY;

    return {
      left: centerX - halfWidth,
      right: centerX + halfWidth,
      top,
      bottom,
      centerX,
      centerY,
      mouthX,
      mouthY,
      radius: halfWidth,
    };
  }

  public reset(): void {
    this.action = 'idle';
    this.expression = 'calm';
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.targetScaleX = 1.0;
    this.targetScaleY = 1.0;
    this.rotation = 0;
    this.targetRotation = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.targetLookX = 0;
    this.targetLookY = 0;
    this.isHoldingNote = false;
    this.tummyInflation = 0;
    this.blushAlpha = 0;
    this.activeCandyFX = null;
    this.candyFXTimer = 0;
    this.ghostAlpha = 1.0;
    this.floatOffsetY = 0;
    this.targetFloatOffsetY = 0;
    this.hatTilt = 0;
    this.headTiltBack = 0;
    this.showQuestionPearls = false;
  }

  public playCandyFeedback(candy: CandyType, duration: number = 2.5): void {
    this.activeCandyFX = candy;
    this.candyFXTimer = duration;

    switch (candy) {
      case 'pumpkin':
        this.tummyInflation = 0.28;
        this.targetScaleX = 1.15;
        this.targetScaleY = 0.95;
        this.targetLookY = -0.9;
        this.targetLookX = 0;
        this.expression = 'alert';
        break;
      case 'milk':
        this.ghostAlpha = 0.72;
        this.targetLookY = 0.85;
        this.targetLookX = 0;
        this.expression = 'soft';
        break;
      case 'star':
        this.targetLookX = 0.5;
        this.targetLookY = -0.4;
        this.expression = 'smug';
        break;
      case 'blackSugar':
        this.targetScaleX = 0.96;
        this.targetScaleY = 1.04;
        this.expression = 'complain';
        break;
      case 'cloud':
        this.targetFloatOffsetY = -22;
        this.expression = 'sleepy';
        break;
      default:
        this.expression = 'joy';
        break;
    }
  }

  public setAction(action: GhostAction, duration: number = 0): void {
    this.action = action;
    this.actionTimer = duration;

    switch (action) {
      case 'idle':
        this.targetScaleX = 1.0;
        this.targetScaleY = 1.0;
        this.targetRotation = 0;
        this.targetMouthOpen = 0;
        break;
      case 'anticipate':
        this.targetScaleX = 1.08;
        this.targetScaleY = 0.95;
        this.targetMouthOpen = 0.85;
        this.expression = 'hungry';
        break;
      case 'eat':
        this.scaleX = 1.25;
        this.scaleY = 0.8;
        this.targetScaleX = 1.0;
        this.targetScaleY = 1.0;
        this.targetMouthOpen = 1.0;
        this.expression = 'joy';
        break;
      case 'chew':
        this.targetScaleX = 1.05;
        this.targetScaleY = 0.96;
        this.targetMouthOpen = 0.2;
        this.expression = 'calm';
        break;
      case 'burp':
        this.scaleX = 1.3;
        this.scaleY = 0.75;
        this.targetScaleX = 1.0;
        this.targetScaleY = 1.0;
        this.targetMouthOpen = 0.9;
        this.expression = 'awkward';
        break;
      case 'bounce':
        this.scaleX = 0.85;
        this.scaleY = 1.25;
        this.targetScaleX = 1.0;
        this.targetScaleY = 1.0;
        this.expression = 'joy';
        break;
      case 'tumble':
        this.targetRotation = (Math.random() - 0.5) * 0.5;
        this.scaleX = 1.15;
        this.scaleY = 0.9;
        this.expression = 'dizzy';
        break;
      case 'inflate':
        this.targetScaleX = 1.18;
        this.targetScaleY = 1.18;
        this.targetMouthOpen = 0.3;
        this.expression = 'surprised';
        break;
      case 'deflate':
        this.scaleX = 0.82;
        this.scaleY = 0.82;
        this.targetScaleX = 1.0;
        this.targetScaleY = 1.0;
        this.expression = 'awkward';
        break;
      case 'sleep':
        this.targetScaleX = 1.02;
        this.targetScaleY = 0.95;
        this.targetMouthOpen = 0;
        this.expression = 'sleepy';
        break;
      case 'angry':
        this.targetScaleX = 1.1;
        this.targetScaleY = 0.95;
        this.targetRotation = 0.05;
        this.expression = 'complain';
        break;
      case 'shy':
        this.targetScaleX = 0.94;
        this.targetScaleY = 1.04;
        this.targetRotation = -0.06;
        this.targetLookX = -0.6;
        this.targetLookY = 0.3;
        this.expression = 'soft';
        this.blushAlpha = 0.8;
        break;
      case 'hold-note':
        this.isHoldingNote = true;
        this.expression = 'alert';
        break;
    }
  }

  public setLookAt(targetX: number, targetY: number, centerX: number, centerY: number): void {
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) {
      this.targetLookX = 0;
      this.targetLookY = 0;
    } else {
      const maxDist = 200;
      this.targetLookX = Math.max(-1, Math.min(1, dx / maxDist));
      this.targetLookY = Math.max(-1, Math.min(1, dy / maxDist));
    }
  }

  public poke(): { pokeCount5In5s: boolean } {
    const now = Date.now();
    if (now - this.lastPokeTime < 5000) {
      this.pokeCountRecent++;
    } else {
      this.pokeCountRecent = 1;
    }
    this.lastPokeTime = now;

    // Physical squash
    this.scaleX = 1.22;
    this.scaleY = 0.84;
    this.targetScaleX = 1.0;
    this.targetScaleY = 1.0;

    if (this.pokeCountRecent >= 5) {
      this.setAction('angry', 1.5);
      return { pokeCount5In5s: true };
    } else if (this.pokeCountRecent >= 2) {
      this.expression = 'complain';
    } else {
      this.expression = 'alert';
    }

    return { pokeCount5In5s: false };
  }

  public update(dt: number): void {
    this.animTime += dt;

    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        if (this.action !== 'hold-note' && this.action !== 'sleep') {
          this.setAction('idle');
        }
      }
    }

    // Spring interpolation for physics
    const spring = (this.reduceMotion ? 14.0 : 8.0) * dt;
    this.scaleX += (this.targetScaleX - this.scaleX) * Math.min(1, spring);
    this.scaleY += (this.targetScaleY - this.scaleY) * Math.min(1, spring);
    this.rotation += ((this.reduceMotion ? 0 : this.targetRotation) - this.rotation) * Math.min(1, spring);
    this.lookX += (this.targetLookX - this.lookX) * Math.min(1, 10 * dt);
    this.lookY += (this.targetLookY - this.lookY) * Math.min(1, 10 * dt);
    this.mouthOpen += (this.targetMouthOpen - this.mouthOpen) * Math.min(1, 12 * dt);
    this.floatOffsetY += (this.targetFloatOffsetY - this.floatOffsetY) * Math.min(1, 6 * dt);

    // Active Candy Feedback timer & animations
    if (this.candyFXTimer > 0) {
      this.candyFXTimer -= dt;
      if (this.activeCandyFX === 'pumpkin') {
        this.rotation = Math.sin(this.animTime * 12) * 0.08;
      } else if (this.activeCandyFX === 'cloud') {
        if (this.candyFXTimer < 1.0) {
          this.expression = 'surprised';
        }
      }
      if (this.candyFXTimer <= 0) {
        this.activeCandyFX = null;
        this.targetFloatOffsetY = 0;
        this.ghostAlpha = 1.0;
        this.tummyInflation = 0;
        if (this.action === 'idle') {
          this.expression = 'calm';
        }
      }
    }

    // Subtle breathing cycle when idle
    if (this.action === 'idle') {
      const breath = this.reduceMotion ? 0 : Math.sin(this.animTime * 2.2);
      this.scaleY = 1.0 + breath * 0.025;
      this.scaleX = 1.0 - breath * 0.015;
    } else if (this.action === 'chew') {
      const chewCycle = Math.sin(this.animTime * (this.reduceMotion ? 6 : 12));
      this.mouthOpen = 0.2 + chewCycle * 0.15;
      this.scaleY = 0.98 + (this.reduceMotion ? 0 : chewCycle * 0.03);
    }
  }

  public render(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, scaleMultiplier: number = 1.0): void {
    ctx.save();
    ctx.translate(centerX, centerY + this.floatOffsetY);
    ctx.rotate(this.rotation + this.headTiltBack);

    const s = this.baseScale * scaleMultiplier;
    ctx.scale(this.scaleX * s, this.scaleY * s);
    ctx.globalAlpha = this.ghostAlpha;

    // Draw Drop Shadow on Aged Paper
    this.renderShadow(ctx);

    // Draw Main Ghost Body (Soft Cloth)
    this.renderBody(ctx);

    // Draw Face (Eyes, Mouth, Blush)
    this.renderFace(ctx);

    // Draw Form Props (Pumpkin / Milk Tea / Poet / Movie / Sleepwalker / Heart)
    this.renderProps(ctx);

    // Draw Note Card if holding
    if (this.isHoldingNote) {
      this.renderNoteCard(ctx);
    }

    ctx.restore();

    // QA Debug Bounds (only active when enabled)
    if (GhostActor.showDebugBounds) {
      const bounds = this.getCatchBounds(centerX, centerY, scaleMultiplier);
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
  }

  private renderShadow(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 115, 60 * this.scaleX, 16 * this.scaleY, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(71, 57, 47, 0.12)';
    ctx.fill();
    ctx.restore();
  }

  private renderBody(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Wavy bottom hem simulation
    const t = this.animTime * 3.5;
    const wave1 = Math.sin(t) * 4;
    const wave2 = Math.sin(t + 1.2) * 5;
    const wave3 = Math.sin(t + 2.4) * 4;

    ctx.beginPath();
    // Ghost dome head
    ctx.moveTo(-55, 30);
    ctx.bezierCurveTo(-58, -60, -45, -100, 0, -102);
    ctx.bezierCurveTo(45, -100, 58, -60, 55, 30);

    // Tummy expansion when fed / inflating
    const tummyW = 60 + this.tummyInflation * 40;
    ctx.bezierCurveTo(tummyW, 65, 52, 95, 45, 100 + wave1);

    // Bottom wavy hems (3 ruffles)
    ctx.quadraticCurveTo(25, 88 + wave2, 0, 102 + wave3);
    ctx.quadraticCurveTo(-25, 88 + wave1, -45, 100 + wave2);

    // Back to left side with cute tapered tail
    ctx.bezierCurveTo(-tummyW, 70, -56, 45, -55, 30);
    ctx.closePath();

    // Fill with warm white soft cloth texture
    ctx.fillStyle = THEME_COLORS.ghostBody;
    ctx.fill();

    // Soft vintage watercolor inner shadow / gradient
    const grad = ctx.createLinearGradient(0, -90, 0, 100);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.7, 'rgba(255, 253, 247, 0.3)');
    grad.addColorStop(1, 'rgba(216, 203, 182, 0.38)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Hand-drawn sketchy ink outline
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = THEME_COLORS.inkBrown;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
  }

  private renderFace(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const eyeOffsetX = this.lookX * 6;
    const eyeOffsetY = this.lookY * 4;

    const leftEyeX = -20 + eyeOffsetX;
    const rightEyeX = 20 + eyeOffsetX;
    const eyeY = -35 + eyeOffsetY;

    // Draw Eyes according to expression
    ctx.fillStyle = THEME_COLORS.inkBrown;
    ctx.strokeStyle = THEME_COLORS.inkBrown;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (this.expression === 'sleepy' || this.action === 'sleep') {
      // Sleeping curved lines
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, 6, 0.1, Math.PI - 0.1, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY, 6, 0.1, Math.PI - 0.1, false);
      ctx.stroke();
    } else if (this.expression === 'joy') {
      // Happy arcs
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY + 2, 7, Math.PI + 0.2, -0.2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY + 2, 7, Math.PI + 0.2, -0.2, false);
      ctx.stroke();
    } else if (this.expression === 'dizzy') {
      // Dizzy swirls / crosses
      this.drawCross(ctx, leftEyeX, eyeY, 6);
      this.drawCross(ctx, rightEyeX, eyeY, 6);
    } else if (this.expression === 'complain') {
      // Slanted annoyed eyes
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 6, eyeY - 2);
      ctx.lineTo(leftEyeX + 6, eyeY + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 6, eyeY + 2);
      ctx.lineTo(rightEyeX + 6, eyeY - 2);
      ctx.stroke();
    } else {
      // Normal beady eyes with cute white glint
      this.drawBeadyEye(ctx, leftEyeX, eyeY, 5.5);
      this.drawBeadyEye(ctx, rightEyeX, eyeY, 5.5);
    }

    // Draw Mouth
    const mouthY = -14;
    if (this.mouthOpen > 0.1) {
      // Open mouth (feeding / anticipation / burp)
      ctx.beginPath();
      const mw = 8 + this.mouthOpen * 14;
      const mh = 5 + this.mouthOpen * 18;
      ctx.ellipse(eyeOffsetX * 0.4, mouthY + mh * 0.4, mw * 0.5, mh * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = THEME_COLORS.inkBrown;
      ctx.fill();

      // Cute tongue
      if (this.mouthOpen > 0.4) {
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(eyeOffsetX * 0.4, mouthY + mh * 0.7, mw * 0.35, mh * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#E27D79';
        ctx.fill();
        ctx.restore();
      }
    } else if (this.expression === 'joy' || this.expression === 'smug') {
      // Gentle smile arc
      ctx.beginPath();
      ctx.arc(eyeOffsetX * 0.3, mouthY - 2, 8, 0.2, Math.PI - 0.2, false);
      ctx.stroke();
    } else if (this.expression === 'awkward' || this.expression === 'guilty') {
      // Small awkward squiggle
      ctx.beginPath();
      ctx.moveTo(-6, mouthY);
      ctx.lineTo(-2, mouthY + 2);
      ctx.lineTo(2, mouthY - 1);
      ctx.lineTo(6, mouthY + 1);
      ctx.stroke();
    } else {
      // Tiny ink dot or dash
      ctx.beginPath();
      ctx.arc(0, mouthY, 2, 0, Math.PI * 2);
      ctx.fillStyle = THEME_COLORS.inkBrown;
      ctx.fill();
    }

    // Blush (soft brick-red / pink watercolor dots)
    const effectiveBlush = this.form === 'heart' ? 0.75 : (this.action === 'shy' ? this.blushAlpha : 0);
    if (effectiveBlush > 0) {
      ctx.fillStyle = `rgba(182, 104, 98, ${effectiveBlush})`;
      ctx.beginPath();
      ctx.ellipse(-30, -22, 9, 5, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(30, -22, 9, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawBeadyEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = THEME_COLORS.inkBrown;
    ctx.fill();

    // White eye reflection glint
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }

  private drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();
  }

  private renderProps(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    switch (this.form) {
      case 'pumpkin': {
        // Pumpkin shell helmet on head
        ctx.translate(0, -96);
        ctx.rotate(this.hatTilt !== 0 ? this.hatTilt : -0.08);

        // Stem
        ctx.fillStyle = '#6E8A5E';
        ctx.fillRect(-4, -28, 8, 14);

        // Shell
        ctx.beginPath();
        ctx.ellipse(0, 0, 52, 32, 0, 0, Math.PI * 2);
        ctx.fillStyle = THEME_COLORS.pumpkin;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.stroke();

        // Carved Eye holes
        ctx.fillStyle = THEME_COLORS.inkBrown;
        ctx.beginPath();
        ctx.moveTo(-22, -4);
        ctx.lineTo(-12, -4);
        ctx.lineTo(-17, 6);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(12, -4);
        ctx.lineTo(22, -4);
        ctx.lineTo(17, 6);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'milktea': {
        // Bubble tea transparent cup wrapping body
        ctx.translate(0, 30);
        ctx.strokeStyle = 'rgba(71, 57, 47, 0.4)';
        ctx.lineWidth = 2.5;

        // Cup rim & body
        ctx.strokeRect(-58, -90, 116, 120);

        // Big thick straw
        ctx.fillStyle = '#ED9A55';
        ctx.save();
        ctx.rotate(0.35);
        ctx.fillRect(-8, -160, 16, 160);
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.strokeRect(-8, -160, 16, 160);
        ctx.restore();

        // Bobas at bottom or arranged as '?'
        ctx.fillStyle = '#47392F';
        if (this.showQuestionPearls) {
          const qPoints = [
            [-12, -26], [4, -32], [16, -20], [8, -8], [0, 4], [0, 20]
          ];
          qPoints.forEach(([bx, by]) => {
            ctx.beginPath();
            ctx.arc(bx, by, 7, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          [-36, -18, 0, 18, 36].forEach((bx) => {
            ctx.beginPath();
            ctx.arc(bx, 20, 8, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        break;
      }

      case 'poet': {
        // Beret hat tilted on head
        ctx.translate(-15, -95);
        ctx.rotate(-0.25);
        ctx.beginPath();
        ctx.ellipse(0, 0, 44, 18, 0, 0, Math.PI * 2);
        ctx.fillStyle = THEME_COLORS.midnight;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.stroke();

        // Quill Pen in hand
        ctx.restore();
        ctx.save();
        ctx.translate(45, 10);
        ctx.rotate(0.5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(15, -35, 8, -60);
        ctx.quadraticCurveTo(-5, -35, 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }

      case 'movie': {
        // Film scarf around neck
        ctx.translate(0, 25);
        ctx.fillStyle = '#333333';
        ctx.fillRect(-50, -4, 100, 14);
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 2;
        ctx.strokeRect(-50, -4, 100, 14);

        // Sprocket holes
        ctx.fillStyle = '#FFFFFF';
        for (let fx = -42; fx <= 42; fx += 14) {
          ctx.fillRect(fx, -1, 6, 8);
        }

        // Mini clapperboard in hand
        ctx.translate(40, -10);
        ctx.rotate(0.2);
        ctx.fillStyle = '#222222';
        ctx.fillRect(-20, -15, 40, 28);
        ctx.strokeRect(-20, -15, 40, 28);
        // diagonal stripes
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-16, -15, 8, 8);
        ctx.fillRect(4, -15, 8, 8);
        break;
      }

      case 'sleepwalk': {
        // Striped nightcap drooping down
        ctx.translate(0, -96);
        ctx.beginPath();
        ctx.moveTo(-35, 10);
        ctx.quadraticCurveTo(-50, -45, -75, -25);
        ctx.quadraticCurveTo(-20, -35, 35, 10);
        ctx.closePath();
        ctx.fillStyle = THEME_COLORS.mistPurple;
        ctx.fill();
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Pompom at tip
        ctx.beginPath();
        ctx.arc(-75, -25, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'heart': {
        // Floating little origami red heart bookmark
        ctx.translate(48, -70);
        const floatY = Math.sin(this.animTime * 3) * 6;
        ctx.translate(0, floatY);
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.bezierCurveTo(-12, -8, -16, -20, 0, -22);
        ctx.bezierCurveTo(16, -20, 12, -8, 0, 6);
        ctx.fillStyle = THEME_COLORS.accentRed;
        ctx.fill();
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
    }

    if (this.activeCandyFX) {
      this.renderCandyFeedbackProps(ctx);
    }

    ctx.restore();
  }

  private renderCandyFeedbackProps(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    switch (this.activeCandyFX) {
      case 'pumpkin': {
        // Little green pumpkin leaf sprouting briefly on head
        ctx.translate(0, -104);
        ctx.fillStyle = '#6E8A5E';
        ctx.beginPath();
        ctx.ellipse(4, -8, 12, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(0, -6, 4, -8);
        ctx.stroke();
        break;
      }
      case 'milk': {
        // Two boba pearls inside tummy
        ctx.fillStyle = '#47392F';
        ctx.beginPath();
        ctx.arc(-8, 30, 6, 0, Math.PI * 2);
        ctx.fill();
        const sinkY = 32 + (2.5 - Math.max(0, this.candyFXTimer)) * 6;
        ctx.beginPath();
        ctx.arc(10, sinkY, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'star': {
        // Ink droplet / glow dot on head
        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.arc(0, -104, 5, 0, Math.PI * 2);
        ctx.fill();
        // Floating blank paper sheet beside ghost
        ctx.translate(55, -15);
        ctx.rotate(0.15);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-18, -25, 36, 50);
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-18, -25, 36, 50);
        break;
      }
      case 'blackSugar': {
        // Mini clapperboard in hand
        ctx.translate(40, -10);
        ctx.rotate(0.2);
        ctx.fillStyle = '#222222';
        ctx.fillRect(-18, -14, 36, 26);
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-18, -14, 36, 26);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-14, -14, 6, 6);
        ctx.fillRect(4, -14, 6, 6);
        break;
      }
      case 'cloud': {
        // Nightcap on head
        ctx.translate(0, -96);
        ctx.beginPath();
        ctx.moveTo(-35, 10);
        ctx.quadraticCurveTo(-50, -45, -75, -25);
        ctx.quadraticCurveTo(-20, -35, 35, 10);
        ctx.closePath();
        ctx.fillStyle = THEME_COLORS.mistPurple;
        ctx.fill();
        ctx.strokeStyle = THEME_COLORS.inkBrown;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.translate(-50, -40);
        ctx.fillStyle = '#F4CA64';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  private renderNoteCard(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(0, 20);

    // Cardboard paper sign
    ctx.fillStyle = '#F4DFC0';
    ctx.fillRect(-70, -35, 140, 70);
    ctx.strokeStyle = THEME_COLORS.inkBrown;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-70, -35, 140, 70);

    // Tape / staple at top
    ctx.fillStyle = 'rgba(180, 160, 130, 0.7)';
    ctx.fillRect(-15, -42, 30, 14);

    // Handwritten text on cardboard
    ctx.fillStyle = THEME_COLORS.inkBrown;
    ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.isNoteFlipped ? this.noteBackText : this.noteFrontText, 0, 0);

    ctx.restore();
  }
}
