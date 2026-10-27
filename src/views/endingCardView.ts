import { THEME_COLORS, FORMS_META, CANDIES } from '../config/constants';
import { SaveState } from '../types';

export class EndingCardRenderer {
  public static renderCardToDataUrl(state: SaveState, endingTitle: string, subNote: string): string {
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

    // 2. Moon Pattern at top
    ctx.beginPath();
    ctx.arc(400, 115, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#ED9A55';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(412, 109, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#F4E7CE';
    ctx.fill();

    // 3. Header Texts
    ctx.fillStyle = '#47392F';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillText('万圣节快乐持有证', 400, 205);

    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#7A6B5D';
    ctx.fillText('兹证明：你已成功喂饱一只不怎么专业的鬼。', 400, 250);

    // Horizontal separator
    ctx.strokeStyle = 'rgba(71, 57, 47, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(120, 280);
    ctx.lineTo(680, 280);
    ctx.stroke();

    // 4. Ghost Vector Drawing (No system emoji, pure retro vector drawing)
    const mainForm = state.mainFormThisRun || 'default';
    const formMeta = FORMS_META[mainForm];

    // Little circular vignette for Ghost
    ctx.beginPath();
    ctx.arc(400, 410, 85, 0, Math.PI * 2);
    ctx.fillStyle = '#E8DAC0';
    ctx.fill();
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw vector ghost inside vignette
    this.drawCardGhost(ctx, 400, 430, mainForm);

    // 5. Dynamic Journey Records
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#B66862';
    ctx.fillText(`今夜称号：【${endingTitle}】`, 400, 555);

    ctx.font = 'italic 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#7A6B5D';
    ctx.fillText(`“${subNote}”`, 400, 590);

    // Favorite Candy calculation
    let favoriteCandy = '南瓜糖';
    let maxFeed = 0;
    (Object.keys(state.feedCounts) as Array<keyof typeof state.feedCounts>).forEach((c) => {
      if (state.feedCounts[c] > maxFeed) {
        maxFeed = state.feedCounts[c];
        favoriteCandy = CANDIES[c]?.name || '糖果';
      }
    });

    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#47392F';
    ctx.fillText(`它记得你给过它的：${favoriteCandy}`, 400, 645);
    ctx.fillText(`它最荒唐的一次变身：${formMeta.name}`, 400, 685);

    // 6. Ending Blessing
    ctx.font = 'italic 21px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillStyle = '#3F3229';
    ctx.fillText('“愿你拥有许多不必解释的快乐，', 400, 765);
    ctx.fillText('和一点恰到好处的偏爱。”', 400, 800);

    // 7. Footer Seal & Validity
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#9C8E80';
    ctx.fillText('有效期：直到月亮忘记升起的那天。', 400, 875);
    ctx.fillText('2026 · HALLOWEEN · GHOST ½', 400, 905);

    // Red Ink Stamp in right bottom
    ctx.save();
    ctx.translate(620, 850);
    ctx.rotate(-0.15);
    ctx.strokeStyle = '#B66862';
    ctx.lineWidth = 3;
    ctx.strokeRect(-45, -25, 90, 50);
    ctx.fillStyle = '#B66862';
    ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('核验通过', 0, -4);
    ctx.font = '12px monospace';
    ctx.fillText('GHOST-½', 0, 14);
    ctx.restore();

    return canvas.toDataURL('image/png');
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
