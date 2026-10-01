// Frame-polled input matching Unity's Input.GetKey / GetKeyDown / GetMouseButtonDown, so the ported
// AfterlifeGame.HandleInput reads the same way. Keys use KeyboardEvent.code (physical keys, like KeyCode).
const TEXT_ENTRY = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const BLOCK_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'Tab']);

export class Input {
  constructor(canvas, onFirstGesture) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressed = new Set();
    this.mouseDown = new Set();
    this.mouseHeld = new Set();
    this.mouse = { x: -1, y: -1 };
    this.overCanvas = false;
    this.wheel = 0;
    this.drag = { x: 0, y: 0 };
    this.leftDragDist = 0;
    this.leftDragged = false;
    this.leftClicked = false;
    this.leftDownPos = { x: -1, y: -1 };
    this.rightDragDist = 0;
    this.rightClicked = false;
    const typing = e => TEXT_ENTRY.has(e.target?.tagName);

    window.addEventListener('keydown', e => {
      onFirstGesture();
      if (typing(e)) return;
      if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', e => { this.held.delete(e.code); });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.mouseHeld.clear();
      this.leftDragged = false;
    });
    window.addEventListener('pointermove', e => {
      const dx = e.clientX - this.mouse.x, dy = e.clientY - this.mouse.y;
      if (this.mouseHeld.has(0)) {
        this.leftDragDist += Math.hypot(dx, dy);
        if (this.leftDragDist > 4) {
          if (!this.leftDragged) {
            this.leftDragged = true;
            this.drag.x += (e.clientX - this.leftDownPos.x);
            this.drag.y += (e.clientY - this.leftDownPos.y);
          } else {
            this.drag.x += dx;
            this.drag.y += dy;
          }
        }
      } else if (this.mouseHeld.has(1)) {
        this.drag.x += dx;
        this.drag.y += dy;
      } else if (this.mouseHeld.has(2)) {
        this.rightDragDist += Math.hypot(dx, dy);
        if (this.rightDragDist > 4) {
          this.drag.x += dx;
          this.drag.y += dy;
        }
      }
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.overCanvas = e.target === canvas;
    });
    window.addEventListener('pointerdown', e => {
      onFirstGesture();
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.overCanvas = e.target === canvas;
      if (e.button === 0) {
        this.leftDragDist = 0;
        this.leftDragged = false;
        this.leftClicked = false;
        this.leftDownPos = { x: e.clientX, y: e.clientY };
      }
      if (e.button === 2) this.rightDragDist = 0;
      // Right click cancels anywhere, as in Unity; left and middle only count over the world.
      if (e.button === 2 || e.target === canvas) { this.mouseDown.add(e.button); this.mouseHeld.add(e.button); }
      if (e.button === 1 || e.button === 2) e.preventDefault();
    });
    window.addEventListener('pointerup', e => {
      if (e.button === 0) {
        if (this.mouseHeld.has(0) && this.leftDragDist <= 4) this.leftClicked = true;
        this.leftDragged = false;
      }
      if (e.button === 2 && this.rightDragDist <= 4) this.rightClicked = true;
      this.mouseHeld.delete(e.button);
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.overCanvas = true;
      // One wheel notch is 0.1 on Unity's Mouse ScrollWheel axis.
      const lines = e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * 20 : e.deltaY / 33;
      this.wheel -= lines / 30;
    }, { passive: false });
  }

  getKey(...codes) { return codes.some(c => this.held.has(c)); }
  getKeyDown(...codes) { return codes.some(c => this.pressed.has(c)); }
  getMouseButtonDown(button) { return this.mouseDown.has(button); }
  getMouseButton(button) { return this.mouseHeld.has(button); }
  getLeftClick() { return this.leftClicked; }
  getRightClick() { return this.rightClicked; }
  isLeftDragging() { return this.mouseHeld.has(0) && this.leftDragged; }
  isDragging() { return (this.mouseHeld.has(0) && this.leftDragged) || this.mouseHeld.has(1) || (this.mouseHeld.has(2) && this.rightDragDist > 4); }

  endFrame() {
    this.pressed.clear();
    this.mouseDown.clear();
    this.leftClicked = false;
    this.rightClicked = false;
    this.wheel = 0;
    this.drag.x = this.drag.y = 0;
  }
}
