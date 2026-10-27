import { SaveState, GhostFormId } from '../types';
import { FORMS_META } from '../config/constants';
import { PersistenceSystem } from '../systems/persistence';

export type HandbookTab = 'forms' | 'wrappers' | 'events' | 'poems';

export class HandbookView {
  public currentTab: HandbookTab = 'forms';
  private persistence: PersistenceSystem;

  constructor(persistence: PersistenceSystem) {
    this.persistence = persistence;
  }

  private get state(): SaveState {
    return this.persistence.getState();
  }

  public setTab(tab: HandbookTab): void {
    this.currentTab = tab;
  }

  public render(
    container: HTMLElement,
    onReplayForm?: (formId: GhostFormId) => void,
    onClose?: () => void,
    onResetProgress?: () => void
  ): void {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'handbook-modal clean-handbook';

    const state = this.state;
    const coreForms: GhostFormId[] = ['pumpkin', 'milktea', 'poet', 'movie', 'sleepwalk'];
    if (state.unlockedForms.includes('heart')) {
      coreForms.push('heart');
    }
    const unlockedCoreCount = coreForms.filter((f) => state.unlockedForms.includes(f)).length;

    // Header
    const header = document.createElement('div');
    header.className = 'handbook-header';
    header.innerHTML = `
      <div class="handbook-title">《幽灵饲养便笺》</div>
      <div class="handbook-summary-row">
        <span class="handbook-badge">👻 见过的夜色：${unlockedCoreCount} / 5</span>
        <span class="handbook-badge">🍬 已收录糖纸：${state.collectibles.length} / 12</span>
      </div>
    `;
    wrapper.appendChild(header);

    // Body content: Clean single list
    const content = document.createElement('div');
    content.className = 'handbook-content clean-content';

    const quotes: Record<GhostFormId, string> = {
      default: '一只掉进书里的小幽灵，喜欢甜食与发呆。',
      pumpkin: '秋天大概是一封允许所有人变沉的信。我们甚至不必急着成熟，变圆就很好。',
      milktea: '温柔大概就是：在急着下结论的深夜，允许你留一个长长的省略号。',
      poet: '写诗毫无用处。但正因如此，它才配得上今晚干净的月色。',
      movie: '生活如果是一部未剪辑的长镜头，那些看似枯燥的留白，才是我们真正活着的证据。',
      sleepwalk: '原来梦也要下班。明早天亮之前，请允许我们在云朵的边缘多赖两秒。',
      heart: '今夜宜喂鬼。也宜对自己稍微好一点。',
    };

    const formsList = document.createElement('div');
    formsList.className = 'clean-forms-list';

    coreForms.forEach((fId) => {
      const isUnlocked = state.unlockedForms.includes(fId);
      const meta = FORMS_META[fId] || { name: fId, icon: '👻', title: '', desc: '' };
      const card = document.createElement('div');
      card.className = `clean-form-item ${isUnlocked ? 'unlocked' : 'locked'}`;

      if (isUnlocked) {
        card.innerHTML = `
          <div class="clean-form-icon">${meta.icon}</div>
          <div class="clean-form-body">
            <div class="clean-form-title">${meta.name} <span class="clean-form-tag">已收录</span></div>
            <div class="clean-form-quote">“${quotes[fId] || meta.desc}”</div>
          </div>
          ${onReplayForm && fId !== 'default' && fId !== 'heart' ? `<button class="clean-replay-btn" data-form="${fId}" title="重温此形态">重温 ↺</button>` : ''}
        `;
        const replayBtn = card.querySelector('.clean-replay-btn');
        if (replayBtn) {
          replayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onReplayForm) onReplayForm(fId);
          });
        }
      } else {
        card.innerHTML = `
          <div class="clean-form-icon lock-icon">❓</div>
          <div class="clean-form-body">
            <div class="clean-form-title locked-title">尚未见过的夜色</div>
            <div class="clean-form-quote locked-quote">在选糖托盘里投喂对应糖果后收录。</div>
          </div>
        `;
      }
      formsList.appendChild(card);
    });

    content.appendChild(formsList);
    wrapper.appendChild(content);

    // Footer with Close and Reset
    const footer = document.createElement('div');
    footer.className = 'handbook-footer clean-footer';
    footer.innerHTML = `
      <button class="paper-btn close-handbook-btn">合上手册 📖</button>
      <button class="clean-reset-link" id="handbookResetBtn" title="清空全部游戏进度">↺ 一键重置进度</button>
    `;
    wrapper.appendChild(footer);

    container.appendChild(wrapper);

    footer.querySelector('.close-handbook-btn')?.addEventListener('click', () => {
      if (onClose) onClose();
    });

    footer.querySelector('#handbookResetBtn')?.addEventListener('click', () => {
      if (onResetProgress) {
        onResetProgress();
      }
    });
  }
}
