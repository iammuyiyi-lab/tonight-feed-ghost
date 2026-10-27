import { AudioDirector } from '../systems/audio';

export type PunctuationType = 'period' | 'exclamation' | 'question';

export class MilkTeaMiniGame {
  public step: 'shakeCup' | 'arrangePunctuation' | 'complete' = 'shakeCup';
  public shakeCount: number = 0;
  public requiredShakes: number = 3;
  public cupOffsetX: number = 0;
  public targetPunctuation: PunctuationType = 'period';
  public pearlCount: number = 5;
  public placedPearls: number = 0;
  public ghostComment: string = '我现在是一种流体文学。珍珠是沉默的标点。';

  private audio: AudioDirector;
  public onCompleted: ((punct: PunctuationType) => void) | null = null;

  constructor(audio: AudioDirector) {
    this.audio = audio;
    this.reset();
  }

  public reset(): void {
    this.step = 'shakeCup';
    this.shakeCount = 0;
    this.cupOffsetX = 0;
    this.targetPunctuation = 'period';
    this.placedPearls = 0;
    this.ghostComment = '我现在是一种流体文学。珍珠是沉默的标点。';
  }

  public registerShake(dx: number): void {
    if (this.step !== 'shakeCup') return;
    this.cupOffsetX = dx * 0.5;

    if (Math.abs(dx) > 40) {
      this.shakeCount++;
      this.audio.playSfx('boop');

      if (this.shakeCount >= this.requiredShakes) {
        this.step = 'arrangePunctuation';
        this.ghostComment = '晃匀了。请用珍珠排一个标点符号。';
      } else {
        this.ghostComment = `正在摇晃（${this.shakeCount}/${this.requiredShakes}）……咕嘟咕嘟。`;
      }
    }
  }

  public selectPunctuation(type: PunctuationType): void {
    this.targetPunctuation = type;
  }

  public placePearl(): void {
    if (this.step !== 'arrangePunctuation') return;
    this.placedPearls++;
    this.audio.playSfx('boop');

    if (this.placedPearls >= this.pearlCount) {
      this.finishPunctuation();
    }
  }

  public autoArrangePunctuation(type: PunctuationType): void {
    if (this.step !== 'arrangePunctuation') return;
    this.targetPunctuation = type;
    this.placedPearls = this.pearlCount;
    this.finishPunctuation();
  }

  private finishPunctuation(): void {
    this.step = 'complete';
    this.audio.playSfx('stamp');

    if (this.targetPunctuation === 'period') {
      this.ghostComment = '这句人生写完了。';
    } else if (this.targetPunctuation === 'exclamation') {
      this.ghostComment = '现在我很有精神！';
    } else {
      this.ghostComment = '为什么奶茶里没有茶的答案？';
    }

    if (this.onCompleted) {
      this.onCompleted(this.targetPunctuation);
    }
  }
}
