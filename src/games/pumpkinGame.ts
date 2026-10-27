import { AudioDirector } from '../systems/audio';

export type PumpkinFaceType = 'smile' | 'serious' | 'sad';

export class PumpkinMiniGame {
  public step: 'adjustHat' | 'drawFace' | 'complete' = 'adjustHat';
  public hatTilt: number = -0.45; // in radians, start tilted
  public targetTilt: number = 0;
  public successfulAdjustCount: number = 0; // needs 3 adjustments
  public requiredAdjustCount: number = 3;
  public chosenFace: PumpkinFaceType | null = null;
  public ghostComment: string = '我好像成熟了。但我看不见前途。';

  private audio: AudioDirector;
  public onCompleted: ((face: PumpkinFaceType) => void) | null = null;

  constructor(audio: AudioDirector) {
    this.audio = audio;
    this.reset();
  }

  public reset(): void {
    this.step = 'adjustHat';
    this.hatTilt = -0.4;
    this.successfulAdjustCount = 0;
    this.chosenFace = null;
    this.ghostComment = '我好像成熟了。但我看不见前途。';
  }

  // Handle swipe left / right
  public handleSwipe(direction: 'left' | 'right'): void {
    if (this.step !== 'adjustHat') return;

    // If tilted left (negative), needs right swipe; if tilted right (positive), needs left swipe
    const isCorrect = (this.hatTilt < 0 && direction === 'right') || (this.hatTilt > 0 && direction === 'left');

    if (isCorrect) {
      this.successfulAdjustCount++;
      this.audio.playSfx('boop');

      if (this.successfulAdjustCount >= this.requiredAdjustCount) {
        this.hatTilt = 0;
        this.step = 'drawFace';
        this.ghostComment = '请给我刻一张脸。我不挑，但请体面。';
      } else {
        // Switch tilt direction for next adjustment
        this.hatTilt = this.hatTilt < 0 ? 0.35 : -0.35;
        this.ghostComment = `正在扶正……还差 ${this.requiredAdjustCount - this.successfulAdjustCount} 次。`;
      }
    } else {
      // Wrong swipe makes it more tilted
      this.hatTilt = this.hatTilt < 0 ? -0.55 : 0.55;
      this.ghostComment = '知识在增长，视野在缩小。';
      this.audio.playSfx('poke');
    }
  }

  public chooseFace(face: PumpkinFaceType): void {
    if (this.step !== 'drawFace') return;
    this.chosenFace = face;
    this.audio.playSfx('stamp');

    if (face === 'smile') {
      this.ghostComment = '我被迫乐观。';
    } else if (face === 'serious') {
      this.ghostComment = '学术南瓜。';
    } else {
      this.ghostComment = '南瓜文学从此成立。';
    }

    this.step = 'complete';
    if (this.onCompleted) {
      this.onCompleted(face);
    }
  }
}
