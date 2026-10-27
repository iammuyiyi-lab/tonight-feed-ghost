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
    ctx.arc(400, 120, 36, 0, Math.PI * 2);
    ctx.fillStyle = '#ED9A55';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(412, 114, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#F4E7CE';
    ctx.fill();

    // 3. Header Texts
    ctx.fillStyle = '#47392F';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillText('万圣节快乐持有证', 400, 210);

    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#7A6B5D';
    ctx.fillText('兹证明：你已成功喂饱一只不怎么专业的鬼。', 400, 260);

    // Horizontal separator
    ctx.strokeStyle = 'rgba(71, 57, 47, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(120, 290);
    ctx.lineTo(680, 290);
    ctx.stroke();

    // 4. Ghost Silhouette / Illustration
    const mainForm = state.mainFormThisRun || 'default';
    const formMeta = FORMS_META[mainForm];

    // Little circular vignette for Ghost
    ctx.beginPath();
    ctx.arc(400, 420, 85, 0, Math.PI * 2);
    ctx.fillStyle = '#E8DAC0';
    ctx.fill();
    ctx.strokeStyle = '#47392F';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Simple Ghost Icon inside vignette
    ctx.font = '72px sans-serif';
    ctx.fillText(formMeta.icon, 400, 445);

    // 5. Dynamic Journey Records
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#B66862';
    ctx.fillText(`今夜称号：【${endingTitle}】`, 400, 560);

    ctx.font = 'italic 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#7A6B5D';
    ctx.fillText(`“${subNote}”`, 400, 595);

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
    ctx.fillText(`它记得你给过它的：${favoriteCandy}`, 400, 650);
    ctx.fillText(`它最荒唐的一次变身：${formMeta.name}`, 400, 690);

    // 6. Ending Blessing
    ctx.font = 'italic 21px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillStyle = '#3F3229';
    ctx.fillText('“愿你拥有许多不必解释的快乐，', 400, 770);
    ctx.fillText('和一点恰到好处的偏爱。”', 400, 805);

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

  public static async triggerSaveOrShare(dataUrl: string): Promise<{ success: boolean; fallbackView: boolean }> {
    try {
      // Check Web Share API with file support
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
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
    } catch (e) {
      console.warn('Share API failed or cancelled:', e);
    }

    // Fallback: Trigger download or display inline image for iOS Safari long-press
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = '万圣节快乐持有证.png';
      a.click();
      return { success: true, fallbackView: true };
    } catch {
      return { success: false, fallbackView: true };
    }
  }
}
