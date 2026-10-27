import { SceneId, GhostFormId } from '../types';
import { PersistenceSystem } from '../systems/persistence';

export class QADevView {
  private persistence: PersistenceSystem;
  private onJumpScene: (scene: SceneId) => void;
  private isVisible: boolean = false;
  private container: HTMLElement | null = null;

  constructor(persistence: PersistenceSystem, onJumpScene: (scene: SceneId) => void) {
    this.persistence = persistence;
    this.onJumpScene = onJumpScene;
  }

  public init(): void {
    // Hidden QA toggle button in bottom corner
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'qa-toggle-btn';
    toggleBtn.innerText = '⚙️ QA';
    toggleBtn.title = '测试与场景直达面板';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.className = 'qa-panel hidden';
    document.body.appendChild(panel);
    this.container = panel;

    toggleBtn.addEventListener('click', () => {
      this.isVisible = !this.isVisible;
      panel.classList.toggle('hidden', !this.isVisible);
      if (this.isVisible) this.render();
    });
  }

  public render(): void {
    if (!this.container) return;
    const state = this.persistence.getState();

    const scenes: SceneId[] = [
      'S00', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S08', 'S09',
      'S10', 'S11', 'S12', 'S13', 'S14',
      'S15_A', 'S16_B', 'S17_C', 'S18_D', 'S19_E',
      'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S30'
    ];

    this.container.innerHTML = `
      <div class="qa-header">
        <strong>QA 场景与状态调试面板</strong>
        <button class="qa-close-btn">×</button>
      </div>
      <div class="qa-section">
        <label>场景直达：</label>
        <select class="qa-scene-select">
          ${scenes.map((s) => `<option value="${s}" ${s === state.scene ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="qa-btn jump-btn">跳转</button>
      </div>
      <div class="qa-section">
        <label>快速解锁：</label>
        <div class="qa-btn-row">
          <button class="qa-btn unlock-all-forms-btn">解锁全形态</button>
          <button class="qa-btn unlock-all-wrappers-btn">全糖纸 (12/12)</button>
          <button class="qa-btn unlock-gentle-btn">满足心动条件 (S30)</button>
        </div>
      </div>
      <div class="qa-section">
        <label>彩蛋快速触发：</label>
        <div class="qa-btn-row">
          <button class="qa-btn trigger-egg-btn" data-egg="EGG01">EGG01(戳头书)</button>
          <button class="qa-btn trigger-egg-btn" data-egg="EGG02">EGG02(月亮糖)</button>
          <button class="qa-btn trigger-egg-btn" data-egg="EGG07">EGG07(袜子)</button>
          <button class="qa-btn trigger-egg-btn" data-egg="EGG10">EGG10(零预算)</button>
          <button class="qa-btn trigger-egg-btn" data-egg="EGG13">EGG13(心动)</button>
        </div>
      </div>
      <div class="qa-section">
        <label>当前状态速览：</label>
        <pre class="qa-pre">${JSON.stringify({
          scene: state.scene,
          totalCandy: state.totalCandy,
          routes: state.routeScore,
          mainForm: state.mainFormThisRun,
          unlockedForms: state.unlockedForms,
          gentleActs: state.gentleActs,
        }, null, 2)}</pre>
      </div>
      <div class="qa-section">
        <button class="qa-btn qa-danger-btn reset-data-btn">清空数据重置</button>
      </div>
    `;

    this.container.querySelector('.qa-close-btn')?.addEventListener('click', () => {
      this.isVisible = false;
      this.container?.classList.add('hidden');
    });

    this.container.querySelector('.jump-btn')?.addEventListener('click', () => {
      const select = this.container!.querySelector('.qa-scene-select') as HTMLSelectElement;
      this.onJumpScene(select.value as SceneId);
      this.isVisible = false;
      this.container?.classList.add('hidden');
    });

    this.container.querySelector('.unlock-all-forms-btn')?.addEventListener('click', () => {
      const all: GhostFormId[] = ['default', 'pumpkin', 'milktea', 'poet', 'movie', 'sleepwalk', 'heart'];
      all.forEach((f) => this.persistence.unlockForm(f));
      this.render();
    });

    this.container.querySelector('.unlock-all-wrappers-btn')?.addEventListener('click', () => {
      for (let i = 1; i <= 12; i++) {
        const id = i < 10 ? `0${i}` : `${i}`;
        this.persistence.unlockWrapper(id);
      }
      this.render();
    });

    this.container.querySelector('.unlock-gentle-btn')?.addEventListener('click', () => {
      this.persistence.recordGentleAct('noTeasingCount');
      this.persistence.recordGentleAct('noTeasingCount');
      this.persistence.recordGentleAct('returnedMoonCandy');
      this.persistence.getState().feedCounts.heart = 1;
      this.persistence.discoverEasterEgg('EGG13');
      this.persistence.unlockForm('heart');
      this.persistence.save();
      this.render();
    });

    this.container.querySelectorAll('.trigger-egg-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const eggId = (e.currentTarget as HTMLElement).dataset.egg!;
        this.persistence.discoverEasterEgg(eggId);
        this.render();
      });
    });

    this.container.querySelector('.reset-data-btn')?.addEventListener('click', () => {
      localStorage.clear();
      window.location.reload();
    });
  }
}
