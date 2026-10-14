// DOM overlay: weather picker, menu, speech bubble and first-run hint.
import { LABELS, type WeatherName } from '../weather/presets';
import type { TimeMode } from '../weather/TimeOfDay';

export interface UIHandlers {
  onWeather(name: WeatherName): void;
  onCycle(): void;
  onAuto(on: boolean): void;
  onSound(on: boolean): void;
  onCard(id: string): void;
  onTime(mode: TimeMode): void;
}

export class UI {
  private bubbleTimer = 0;
  private hintDone = false;
  private $ = (id: string) => document.getElementById(id) as HTMLElement;
  private weatherPop = this.$('weatherPop');
  private menuPop = this.$('menuPop');
  private btnWeather = this.$('btnWeather');
  private btnMenu = this.$('btnMenu');
  private bubble = this.$('bubble');
  private hint = this.$('hint');
  private label = this.$('weatherLabel');
  private autoCycle = this.$('autoCycle') as HTMLInputElement;

  constructor(h: UIHandlers) {
    const btnCycle = this.$('btnCycle');
    this.btnWeather.addEventListener('click', () => this.toggle(this.weatherPop, this.btnWeather));
    this.btnMenu.addEventListener('click', () => this.toggle(this.menuPop, this.btnMenu));
    btnCycle.addEventListener('click', () => {
      btnCycle.classList.remove('spin');
      void btnCycle.offsetWidth;
      btnCycle.classList.add('spin');
      h.onCycle();
    });
    this.weatherPop.querySelectorAll<HTMLElement>('[data-weather]').forEach((b) => {
      b.addEventListener('click', () => h.onWeather(b.dataset.weather as WeatherName));
    });
    this.autoCycle.addEventListener('change', () => h.onAuto(this.autoCycle.checked));
    this.weatherPop.querySelectorAll<HTMLElement>('[data-time-mode]').forEach((b) => {
      b.addEventListener('click', () => h.onTime(b.dataset.timeMode as TimeMode));
    });
    const sound = this.$('soundToggle') as HTMLInputElement;
    sound.addEventListener('change', () => h.onSound(sound.checked));
    document.querySelectorAll<HTMLAnchorElement>('.card, .menu-pop a').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle(this.menuPop, this.btnMenu, false);
        h.onCard((a.getAttribute('href') ?? '#').slice(1));
      });
    });
    document.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest?.('.pop, .icon-btn, .menu-btn')) this.closeAll();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeAll(); });
  }

  private closeAll() {
    this.toggle(this.weatherPop, this.btnWeather, false);
    this.toggle(this.menuPop, this.btnMenu, false);
  }

  private toggle(pop: HTMLElement, btn: HTMLElement, force?: boolean) {
    const open = force ?? pop.hidden;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      const [other, otherBtn] = pop === this.weatherPop ? [this.menuPop, this.btnMenu] : [this.weatherPop, this.btnWeather];
      other.hidden = true;
      otherBtn.setAttribute('aria-expanded', 'false');
      pop.querySelector<HTMLElement>('button, a, input')?.focus({ preventScroll: true });
    }
  }

  setWeather(name: WeatherName) {
    this.label.textContent = LABELS[name];
    this.weatherPop.querySelectorAll<HTMLElement>('[data-weather]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.weather === name));
    });
  }

  say(text: string, dur = 1.8) {
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
    this.bubbleTimer = dur;
  }

  update(dt: number, bubblePos: [number, number], hintPos: [number, number]) {
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) this.bubble.classList.remove('show');
    }
    const s = this.bubble.classList.contains('show') ? 1 : 0.9;
    this.bubble.style.transform = `translate(${bubblePos[0].toFixed(1)}px, ${bubblePos[1].toFixed(1)}px) translate(-50%, -100%) scale(${s})`;
    if (!this.hintDone) this.hint.style.transform = `translate(${hintPos[0].toFixed(1)}px, ${hintPos[1].toFixed(1)}px) translate(-50%, 0)`;
  }

  dismissHint() {
    if (this.hintDone) return;
    this.hintDone = true;
    this.hint.classList.add('gone');
  }

  setAuto(v: boolean) { this.autoCycle.checked = v; }

  setTimeMode(mode: TimeMode) {
    this.weatherPop.querySelectorAll<HTMLElement>('[data-time-mode]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.timeMode === mode));
    });
  }
}
