import { AudioDirector } from '../systems/audio';

export class MovieMiniGame {
  public currentTake: number = 1; // 1, 2, 3
  public take1Done: boolean = false;
  public take2Done: boolean = false;
  public take3Done: boolean = false;
  public posterTitle: string = '《糖与空白》';
  public titleClickCount: number = 0;
  public isCompleted: boolean = false;
  public ghostComment: string = '这一镜情绪很准。虽然目前没有摄影机。';

  private audio: AudioDirector;
  public onCompleted: ((posterTitle: string) => void) | null = null;
  public onEasterEggTriggered: ((eggId: string) => void) | null = null;

  constructor(audio: AudioDirector) {
    this.audio = audio;
    this.reset();
  }

  public reset(): void {
    this.currentTake = 1;
    this.take1Done = false;
    this.take2Done = false;
    this.take3Done = false;
    this.posterTitle = '《糖与空白》';
    this.titleClickCount = 0;
    this.isCompleted = false;
    this.ghostComment = '这一镜情绪很准。虽然目前没有摄影机。';
  }

  public finishTake1(): void {
    if (this.currentTake !== 1) return;
    this.take1Done = true;
    this.currentTake = 2;
    this.ghostComment = '我在等待象征。';
    this.audio.playSfx('clapper');
  }

  public finishTake2(): void {
    if (this.currentTake !== 2) return;
    this.take2Done = true;
    this.currentTake = 3;
    this.ghostComment = '象征先把我绊倒了。';
    this.audio.playSfx('clapper');
  }

  public finishTake3(): void {
    if (this.currentTake !== 3) return;
    this.take3Done = true;
    this.isCompleted = true;
    this.ghostComment = '完美，片酬就是这颗糖。';
    this.audio.playSfx('clapper');

    if (this.onCompleted) {
      this.onCompleted(this.posterTitle);
    }
  }

  public clickPosterTitle(): void {
    this.titleClickCount++;
    this.audio.playSfx('boop');

    if (this.titleClickCount >= 3) {
      this.posterTitle = '《一只幽灵的预算是零》';
      if (this.onEasterEggTriggered) {
        this.onEasterEggTriggered('EGG10');
      }
    }
  }
}
