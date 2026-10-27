import { THEME_COLORS, FORMS_META, CANDIES } from '../config/constants';
import { SaveState } from '../types';

export class EndingCardRenderer {
  public static renderCardToDataUrl(state: SaveState, endingTitle?: string, subNote?: string, chosenQuote?: string): string {
    const canvas = document.createElement('canvas');
    // High-resolution Retina card: 800 x 1000 (4:5)
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d')!;

    // 1. Aged Vintage Paper Background
    ctx.fillStyle = '#F4E7CE';
    ctx.fillRect(0, 0, 800, 1000);

    // Subtle paper edge border
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, 740, 940);

    ctx.strokeStyle = 'rgba(71, 57, 47, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(38, 38, 724, 924);

    // Corner decorative flourishes
    [
      [42, 42],
      [758, 42],
      [42, 958],
      [758, 958],
    ].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#47392F';
      ctx.fill();
    });

    // 2. Top Header Timestamp
    ctx.fillStyle = '#7A6B5D';
    ctx.textAlign = 'center';
    ctx.font = '600 16px "Courier New", monospace, serif';
    ctx.fillText('MIDNIGHT / 31 OCT 2026', 400, 95);

    // Crescent Moon Pattern at top
    ctx.beginPath();
    ctx.arc(400, 140, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#ED9A55';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(408, 136, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#F4E7CE';
    ctx.fill();

    // 3. Main Title & Certificate Subtitle
    ctx.fillStyle = '#47392F';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillText('《万圣节快乐持有证》', 400, 220);

    ctx.font = '19px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#7A6B5D';
    ctx.fillText('兹证明：你在一个普通的夜晚，认真喂饱了一只不太称职的鬼。', 400, 265);

    // Horizontal separator
    ctx.strokeStyle = 'rgba(71, 57, 47, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(120, 295);
    ctx.lineTo(680, 295);
    ctx.stroke();

    // 4. Ghost Vector Drawing inside circular vignette
    const mainForm = state.mainFormThisRun || 'default';

    ctx.beginPath();
    ctx.arc(400, 425, 90, 0, Math.PI * 2);
    ctx.fillStyle = '#E8DAC0';
    ctx.fill();
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw vector ghost holding the final golden candy
    this.drawCardGhost(ctx, 400, 440, mainForm);
    this.drawLastGoldenCandy(ctx, 400, 475);

    // 5. Chosen Literary Quote from P04
    const displayQuote = chosenQuote || state.chosenQuote || subNote || '有些夜晚并不特别。有人替它多留了一颗糖。';
    ctx.textAlign = 'center';
    ctx.font = 'italic 23px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillStyle = '#B66862';
    ctx.fillText(`“${displayQuote}”`, 400, 580);

    // Horizontal sub separator
    ctx.strokeStyle = 'rgba(71, 57, 47, 0.18)';
    ctx.beginPath();
    ctx.moveTo(220, 620);
    ctx.lineTo(580, 620);
    ctx.stroke();

    // Ending Blessing
    ctx.font = 'italic 20px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillStyle = '#3F3229';
    ctx.fillText('愿你也有一点毫无理由的开心，', 400, 680);
    ctx.fillText('和一点恰到好处的偏爱。', 400, 715);

    if (endingTitle && endingTitle !== '半糖的饲养员') {
      ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#7A6B5D';
      ctx.fillText(`【${endingTitle}】`, 400, 765);
    }

    // 6. Footer Seal & Validity
    ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#9C8E80';
    ctx.fillText('有效期：直到月亮忘记路。', 400, 865);
    ctx.font = '13px monospace';
    ctx.fillText('2026 · HALLOWEEN · GHOST ½', 400, 895);

    // Red Ink Stamp in right bottom
    ctx.save();
    ctx.translate(620, 840);
    ctx.rotate(-0.12);
    ctx.strokeStyle = '#B66862';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-48, -26, 96, 52);
    ctx.fillStyle = '#B66862';
    ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('半糖 · 签收', 0, -3);
    ctx.font = '12px monospace';
    ctx.fillText('31 OCT 2026', 0, 16);
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  // Draw the extra golden candy held by the ghost
  private static drawLastGoldenCandy(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Golden glow
    ctx.fillStyle = 'rgba(237, 154, 85, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // Golden candy body
    ctx.fillStyle = '#F2C94C';
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Little wrapper wings
    ctx.fillStyle = '#FFFDF7';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-17, -5);
    ctx.lineTo(-17, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(17, -5);
    ctx.lineTo(17, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Pure vector drawing for Half-Candy inside card vignette
  private static drawCardGhost(ctx: CanvasRenderingContext2D, cx: number, cy: number, form: string): void {
    ctx.save();
    ctx.translate(cx, cy);
    const scale = 0.55;
    ctx.scale(scale, scale);

    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(0, 100, 55, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(71, 57, 47, 0.15)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.moveTo(-50, 20);
    ctx.bezierCurveTo(-55, -50, -42, -90, 0, -92);
    ctx.bezierCurveTo(42, -90, 55, -50, 50, 20);
    ctx.bezierCurveTo(55, 60, 48, 85, 40, 90);
    ctx.quadraticCurveTo(20, 80, 0, 92);
    ctx.quadraticCurveTo(-20, 80, -40, 90);
    ctx.bezierCurveTo(-48, 85, -55, 60, -50, 20);
    ctx.closePath();
    ctx.fillStyle = '#FFFDF7';
    ctx.fill();
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Beady eyes
    [-18, 18].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, -30, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#47392F';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex - 2, -32, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    });

    // Mouth
    ctx.beginPath();
    ctx.arc(0, -12, 6, 0.2, Math.PI - 0.2, false);
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Form specific accessory
    if (form === 'pumpkin') {
      ctx.fillStyle = '#ED9A55';
      ctx.beginPath();
      ctx.ellipse(0, -90, 46, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (form === 'milktea') {
      ctx.strokeStyle = '#ED9A55';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(15, -120);
      ctx.lineTo(0, -40);
      ctx.stroke();
    } else if (form === 'poet') {
      ctx.fillStyle = '#1F2942';
      ctx.beginPath();
      ctx.ellipse(-10, -90, 40, 16, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (form === 'movie') {
      ctx.fillStyle = '#333333';
      ctx.fillRect(-35, 15, 70, 14);
    } else if (form === 'sleepwalk') {
      ctx.fillStyle = '#A5A0C8';
      ctx.beginPath();
      ctx.moveTo(-30, 10);
      ctx.quadraticCurveTo(-45, -40, -65, -20);
      ctx.quadraticCurveTo(-15, -30, 30, 10);
      ctx.fill();
      ctx.stroke();
    } else if (form === 'heart') {
      ctx.fillStyle = '#B66862';
      ctx.beginPath();
      ctx.arc(-26, -20, 6, 0, Math.PI * 2);
      ctx.arc(26, -20, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  public static async triggerSaveOrShare(dataUrl: string): Promise<{ success: boolean; fallbackView: boolean }> {
    try {
      if (navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], '万圣节快乐持有证.png', { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '万圣节快乐持有证',
            text: '这是今夜留给你的万圣节纪念卡。',
          });
          return { success: true, fallbackView: false };
        }
      }
    } catch {
      // User cancelled share or share failed
    }

    // Fallback: Trigger download & return fallbackView: true for Safari long-press preview
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = '万圣节快乐持有证.png';
      a.click();
    } catch {
      // Ignored
    }

    return { success: true, fallbackView: true };
  }
}
