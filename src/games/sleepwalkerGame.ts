import { AudioDirector } from '../systems/audio';

export type DreamShape = 'door' | 'boat' | 'window';

export class SleepwalkerMiniGame {
  public chosenShape: DreamShape = 'window';
  public starsPlaced: number = 0;
  public totalStars: number = 4;
  public isCompleted: boolean = false;
  public ghostComment: string = '我没有睡。我只是暂时离开逻辑。';
  public windowWaitTimer: number = 0;
  public seagullAppeared: boolean = false;

  private audio: AudioDirector;
  public onCompleted: ((shape: DreamShape) => void) | null = null;
  public onEasterEggTriggered: ((eggId: string) => void) | null = null;

  constructor(audio: AudioDirector) {
    this.audio = audio;
    this.reset();
  }

  public reset(): void {
    this.chosenShape = 'window';
    this.starsPlaced = 0;
    this.isCompleted = false;
    this.windowWaitTimer = 0;
    this.seagullAppeared = false;
    this.ghostComment = '我没有睡。我只是暂时离开逻辑。';
  }

  public selectShape(shape: DreamShape): void {
    this.chosenShape = shape;
    this.starsPlaced = 0;
    this.windowWaitTimer = 0;
  }

  public placeStar(): void {
    if (this.isCompleted) return;
    this.starsPlaced++;
    this.audio.playSfx('twinkle');

    if (this.starsPlaced >= this.totalStars) {
      this.isCompleted = true;
      if (this.chosenShape === 'door') {
        this.ghostComment = '看来梦也喜欢套娃。';
      } else if (this.chosenShape === 'boat') {
        this.ghostComment = '海在哪里？算了。';
      } else {
        this.ghostComment = '有人在夜里把甜味挂起来了。';
      }

      if (this.onCompleted) {
        this.onCompleted(this.chosenShape);
      }
    }
  }

  public autoComplete(): void {
    this.starsPlaced = this.totalStars;
    this.placeStar();
  }

  public update(dt: number): void {
    if (this.chosenShape === 'window' && this.isCompleted && !this.seagullAppeared) {
      this.windowWaitTimer += dt;
      if (this.windowWaitTimer >= 3.0) {
        this.seagullAppeared = true;
        this.ghostComment = '梦居然有小偷。';
        this.audio.playSfx('boop');
        if (this.onEasterEggTriggered) {
          this.onEasterEggTriggered('EGG09');
        }
      }
    }
  }
}
