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

    // Line 1 based on w1 (Row 1: 月亮 / 路灯 / 南瓜 / 旧窗 / 楼梯 / 失眠)
    let line1 = '月亮把自己挂在窗外，假装没有来过。';
    if (w1 === '路灯') {
      line1 = '路灯站得很直，像一个不肯回家的逗号。';
    } else if (w1 === '南瓜') {
      line1 = '南瓜端坐在桌上，像一位不懂文学的先生。';
    } else if (w1 === '旧窗') {
      line1 = '旧窗不肯关上，像一段拒绝完结的句子。';
    } else if (w1 === '楼梯') {
      line1 = '楼梯上有人走过，我是一只不必走路的鬼。';
    } else if (w1 === '失眠') {
      line1 = '我不是睡不着，只是舍不得让今晚先结束。';
    }

    // Line 2 based on w2 (Row 2: 糖纸 / 鞋带 / 晚风 / 书签 / 夜风 / 旧书)
    let line2 = '风吹动了一张旧糖纸，在黑暗中沙沙作响。';
    if (w2 === '鞋带') {
      line2 = '我捡起一根鞋带，以为捡到了生活的线索。';
    } else if (w2 === '晚风' || w2 === '夜风') {
      line2 = '晚风悄悄翻过一页，把刚才的对白吹到下一章。';
    } else if (w2 === '书签') {
      line2 = '书签悄悄站起来，代替风翻了一页。';
    } else if (w2 === '旧书') {
      line2 = '旧书里夹着微弱的甜味，没人敢轻易翻开。';
    }

    // Line 3 based on w3 (Row 3: 打嗝 / 漂流 / 保密 / 发芽)
    let line3 = '我一打嗝，整个夜晚就以为有人在向它提问。';
    if (w3 === '漂流') {
      line3 = '我们都在时间里漂流，好在谁也不必问姓名。';
    } else if (w3 === '保密') {
      line3 = '这件事需要保密。主要是因为太不像一件事。';
    } else if (w3 === '发芽') {
      line3 = '我的饥饿于是发芽。并且长得相当没有文学性。';
    }

    // Literary absurd title
    let title = `《关于${w1}与${w2}》`;
    if (w1 === '月亮' && w3 === '保密') {
      title = '《关于月亮的内部文件》';
    } else if (w1 === '旧窗' && w3 === '发芽') {
      title = '《不重要的植物学》';
    } else if (w1 === '南瓜') {
      title = '《一项不必要的研究》';
    } else if (w1 === '路灯') {
      title = '《夜间逗号观察记录》';
    }

    this.generatedPoem = {
      title,
      lines: [line1, line2, line3],
      materials: [w1, w2, w3],
      timestamp: Date.now(),
    };

    this.step = 'recite';
    this.ghostComment = '我写好了。文学应当负责支付一颗糖。';
    this.audio.playSfx('chime');

    if (this.onCompleted) {
      this.onCompleted(this.generatedPoem);
    }
  }
}
