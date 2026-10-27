import { AudioDirector } from '../systems/audio';
import { POEM_TEMPLATES, POET_WORD_ROWS, PoemTemplate } from '../config/collectibles';
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

  private composePoem(): void {
    const w1 = this.selectedWords[0]!;
    const w2 = this.selectedWords[1]!;
    const w3 = this.selectedWords[2]!;

    // Find template by first word or second word or fallback
    const tpl: PoemTemplate = POEM_TEMPLATES[w1] || POEM_TEMPLATES[w2] || POEM_TEMPLATES[w3] || {
      key: w1,
      title: `《关于${w1}》`,
      body: [`${w1}在夜里落下一张${w2}。`, `一只鬼路过，决定${w3}。`, '这首诗因此写完了。'],
    };

    this.generatedPoem = {
      title: tpl.title,
      lines: tpl.body,
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
