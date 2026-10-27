export interface PointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  isDown: boolean;
  isDragging: boolean;
  heldDuration: number;
}

export class InputRouter {
  public pointer: PointerState = {
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    isDown: false,
    isDragging: false,
    heldDuration: 0,
  };

  private targetElement: HTMLElement;
  private longPressTimer: number | null = null;
  private longPressTriggered: boolean = false;
  private dragThreshold: number = 10;

  // Callbacks
  public onTap: ((x: number, y: number) => void) | null = null;
  public onLongPress: ((x: number, y: number) => void) | null = null;
  public onDragStart: ((x: number, y: number) => void) | null = null;
  public onDragMove: ((x: number, y: number, dx: number, dy: number) => void) | null = null;
  public onDragEnd: ((x: number, y: number) => void) | null = null;
  public onPointerMove: ((x: number, y: number) => void) | null = null;

  constructor(target: HTMLElement) {
    this.targetElement = target;
    this.bindEvents();
  }

  private bindEvents(): void {
    const el = this.targetElement;

    el.addEventListener('pointerdown', this.handlePointerDown.bind(this), { passive: false });
    window.addEventListener('pointermove', this.handlePointerMove.bind(this), { passive: false });
    window.addEventListener('pointerup', this.handlePointerUp.bind(this), { passive: false });
    window.addEventListener('pointercancel', this.handlePointerUp.bind(this), { passive: false });
  }

  private getCanvasCoords(e: PointerEvent): { x: number; y: number } {
    const rect = this.targetElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private handlePointerDown(e: PointerEvent): void {
    const coords = this.getCanvasCoords(e);
    this.pointer.isDown = true;
    this.pointer.isDragging = false;
    this.pointer.x = coords.x;
    this.pointer.y = coords.y;
    this.pointer.startX = coords.x;
    this.pointer.startY = coords.y;
    this.pointer.heldDuration = 0;
    this.longPressTriggered = false;

    // Start 600ms long press timer
    if (this.longPressTimer !== null) clearTimeout(this.longPressTimer);
    this.longPressTimer = window.setTimeout(() => {
      if (this.pointer.isDown && !this.pointer.isDragging) {
        this.longPressTriggered = true;
        if (this.onLongPress) {
          this.onLongPress(this.pointer.x, this.pointer.y);
        }
      }
    }, 600);
  }

  private handlePointerMove(e: PointerEvent): void {
    const coords = this.getCanvasCoords(e);
    this.pointer.x = coords.x;
    this.pointer.y = coords.y;

    if (this.onPointerMove) {
      this.onPointerMove(coords.x, coords.y);
    }

    if (!this.pointer.isDown) return;

    const dx = coords.x - this.pointer.startX;
    const dy = coords.y - this.pointer.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!this.pointer.isDragging && dist > this.dragThreshold) {
      this.pointer.isDragging = true;
      if (this.longPressTimer !== null) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      if (this.onDragStart) {
        this.onDragStart(coords.x, coords.y);
      }
    }

    if (this.pointer.isDragging) {
      if (this.onDragMove) {
        this.onDragMove(coords.x, coords.y, dx, dy);
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.pointer.isDown) return;
    this.pointer.isDown = false;

    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    const coords = this.getCanvasCoords(e);

    if (this.pointer.isDragging) {
      this.pointer.isDragging = false;
      if (this.onDragEnd) {
        this.onDragEnd(coords.x, coords.y);
      }
    } else if (!this.longPressTriggered) {
      // Tap confirmation on pointer up
      if (this.onTap) {
        this.onTap(coords.x, coords.y);
      }
    }
  }

  public update(dt: number): void {
    if (this.pointer.isDown) {
      this.pointer.heldDuration += dt;
    }
  }
}
