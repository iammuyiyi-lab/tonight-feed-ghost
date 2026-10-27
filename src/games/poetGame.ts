import { AudioDirector } from '../systems/audio';
import { PoemRecord } from '../types';

export class PoetMiniGame {
  public selectedWords: [string | null, string | null, string | null] = [null, null, null];
  public step: 'selectWords' | 'recite' | 'complete' = 'selectWords';
  public generatedPoem: PoemRecord | null = null;
  public ghostComment: string = '我决定写作。毕竟吃饱之后不能总躺着。';

  private audio: AudioDirector;
  public onCompleted: ((poem: PoemRecord) => void) | null = null;

  constructor(audio: AudioDirector) {
    this.audio = audio;
    this.reset();
  }

  public reset(): void {
    this.selectedWords = [null, null, null];
    this.step = 'selectWords';
    this.generatedPoem = null;
    this.ghostComment = '我决定写作。毕竟吃饱之后不能总躺着。';
  }

  public pickWord(rowIndex: number, word: string): void {
    if (this.step !== 'selectWords') return;
    this.selectedWords[rowIndex] = word;
    this.audio.playSfx('boop');

    if (this.selectedWords[0] && this.selectedWords[1] && this.selectedWords[2]) {
      this.composePoem();
    }
  }

  public composePoem(): void {
    const w1 = this.selectedWords[0] || '月亮';
    const w2 = this.selectedWords[1] || '糖纸';
    const w3 = this.selectedWords[2] || '打嗝';

    // Line 1 based on w1 (Row 1: 月亮 / 楼梯 / 南瓜 / 失眠)
    let line1 = '月亮在夜空里不说话。';
    if (w1 === '楼梯') {
      line1 = '楼梯上有人走过，我是一只不必走路的鬼。';
    } else if (w1 === '南瓜') {
      line1 = '南瓜端坐在桌上，像一位不懂文学的先生。';
    } else if (w1 === '失眠') {
      line1 = '我不是睡不着，只是舍不得让今晚先结束。';
    }

    // Line 2 based on w2 (Row 2: 糖纸 / 鞋带 / 夜风 / 旧书)
    let line2 = '风吹动了一张旧糖纸，在黑暗中沙沙作响。';
    if (w2 === '鞋带') {
      line2 = '鞋带松了，虽然我并没有脚，但生活显然存在问题。';
    } else if (w2 === '夜风') {
      line2 = '夜风悄悄翻过一页，把刚才的对白吹到下一章。';
    } else if (w2 === '旧书') {
      line2 = '旧书里夹着微弱的甜味，没人敢轻易翻开。';
    }

    // Line 3 based on w3 (Row 3: 打嗝 / 漂流 / 保密 / 发芽)
    let line3 = '我一打嗝，整个夜晚就以为有人在向它提问。';
    if (w3 === '漂流') {
      line3 = '我们都在时间里漂流，好在谁也不必问姓名。';
    } else if (w3 === '保密') {
      line3 = '我把心事藏进不存在的袖子里，替你保密。';
    } else if (w3 === '发芽') {
      line3 = '一颗糖埋进夜色，第二天长成了想吃第二颗的我。';
    }

    this.generatedPoem = {
      title: `《关于${w1}与${w2}》`,
      lines: [line1, line2, line3],
      materials: [w1, w2, w3],
      timestamp: Date.now(),
    };

    this.step = 'recite';
    this.ghostComment = '我写完了。文学现在应该给我一颗糖。';
    this.audio.playSfx('chime');

    if (this.onCompleted) {
      this.onCompleted(this.generatedPoem);
    }
  }
}
