import { SaveState, GhostFormId } from '../types';
import { FORMS_META } from '../config/constants';
import { CANDY_WRAPPERS, EASTER_EGGS_DEF } from '../config/collectibles';
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

  public render(container: HTMLElement, onReplayForm?: (formId: GhostFormId) => void, onClose?: () => void): void {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'handbook-modal';

    const state = this.state;

    // Header with tabs
    const header = document.createElement('div');
    header.className = 'handbook-header';
    header.innerHTML = `
      <div class="handbook-title">《幽灵饲养手册》</div>
      <div class="handbook-tabs">
        <button class="handbook-tab-btn ${this.currentTab === 'forms' ? 'active' : ''}" data-tab="forms">形态 (${state.unlockedForms.length}/7)</button>
        <button class="handbook-tab-btn ${this.currentTab === 'wrappers' ? 'active' : ''}" data-tab="wrappers">糖纸 (${state.collectibles.length}/12)</button>
        <button class="handbook-tab-btn ${this.currentTab === 'events' ? 'active' : ''}" data-tab="events">怪事 (${state.easterEggs.length}/15)</button>
        <button class="handbook-tab-btn ${this.currentTab === 'poems' ? 'active' : ''}" data-tab="poems">怪诗 (${state.savedPoems.length})</button>
      </div>
    `;
    wrapper.appendChild(header);

    // Tab content container
    const content = document.createElement('div');
    content.className = 'handbook-content';

    switch (this.currentTab) {
      case 'forms':
        this.renderFormsTab(content, onReplayForm);
        break;
      case 'wrappers':
        this.renderWrappersTab(content);
        break;
      case 'events':
        this.renderEventsTab(content);
        break;
      case 'poems':
        this.renderPoemsTab(content);
        break;
    }

    wrapper.appendChild(content);

    // Footer with Close bookmark
    const footer = document.createElement('div');
    footer.className = 'handbook-footer';
    footer.innerHTML = `<button class="paper-btn close-handbook-btn">合上手册</button>`;
    wrapper.appendChild(footer);

    container.appendChild(wrapper);

    // Bind tab clicks
    header.querySelectorAll('.handbook-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.dataset.tab as HandbookTab;
        this.setTab(tab);
        this.render(container, onReplayForm, onClose);
      });
    });

    footer.querySelector('.close-handbook-btn')?.addEventListener('click', () => {
      if (onClose) onClose();
    });
  }

  private renderFormsTab(container: HTMLElement, onReplayForm?: (formId: GhostFormId) => void): void {
    const allForms: GhostFormId[] = ['default', 'pumpkin', 'milktea', 'poet', 'movie', 'sleepwalk', 'heart'];
    const list = document.createElement('div');
    list.className = 'handbook-cards-grid';
    const state = this.state;

    allForms.forEach((fId) => {
      const isUnlocked = state.unlockedForms.includes(fId);
      const meta = FORMS_META[fId];
      const card = document.createElement('div');
      card.className = `handbook-form-card ${isUnlocked ? 'unlocked' : 'locked'}`;

      if (isUnlocked) {
        card.innerHTML = `
          <div class="card-icon">${meta.icon}</div>
          <div class="card-title">${meta.name}</div>
          <div class="card-subtitle">${meta.title}</div>
          <div class="card-desc">${meta.desc}</div>
          ${fId !== 'default' && fId !== 'heart' ? `<button class="card-replay-btn" data-form="${fId}">重玩此形态</button>` : ''}
        `;
        const replayBtn = card.querySelector('.card-replay-btn');
        if (replayBtn) {
          replayBtn.addEventListener('click', () => {
            if (onReplayForm) onReplayForm(fId);
          });
        }
      } else {
        card.innerHTML = `
          <div class="card-icon">❓</div>
          <div class="card-title">尚未见过</div>
          <div class="card-desc">这一页暂时不肯说话。</div>
        `;
      }
      list.appendChild(card);
    });

    container.appendChild(list);
  }

  private renderWrappersTab(container: HTMLElement): void {
    const list = document.createElement('div');
    list.className = 'handbook-wrappers-grid';
    const state = this.state;

    CANDY_WRAPPERS.forEach((w) => {
      const isCollected = state.collectibles.includes(w.id);
      const item = document.createElement('div');
      item.className = `handbook-wrapper-item ${isCollected ? 'unlocked' : 'locked'}`;

      if (isCollected) {
        item.innerHTML = `
          <div class="wrapper-header">#${w.id}｜${w.title}</div>
          <div class="wrapper-text">“${w.text}”</div>
          <div class="wrapper-source">来源：${w.source}</div>
        `;
      } else {
        item.innerHTML = `
          <div class="wrapper-header">#${w.id}｜未收录</div>
          <div class="wrapper-text">留待夜晚的风把它吹开。</div>
        `;
      }
      list.appendChild(item);
    });

    container.appendChild(list);
  }

  private renderEventsTab(container: HTMLElement): void {
    const list = document.createElement('div');
    list.className = 'handbook-events-list';
    const state = this.state;

    EASTER_EGGS_DEF.forEach((egg) => {
      const isFound = state.easterEggs.includes(egg.id);
      const row = document.createElement('div');
      row.className = `handbook-event-row ${isFound ? 'found' : 'hidden'}`;

      if (isFound) {
        row.innerHTML = `
          <div class="event-id">${egg.id}</div>
          <div class="event-info">
            <div class="event-name">${egg.name}</div>
            <div class="event-desc">${egg.desc}</div>
          </div>
          <div class="event-badge">已归档</div>
        `;
      } else {
        row.innerHTML = `
          <div class="event-id">${egg.id}</div>
          <div class="event-info">
            <div class="event-name">隐藏怪事</div>
            <div class="event-desc">也许在某个不经意的小动作里。</div>
          </div>
          <div class="event-badge unread">未记录</div>
        `;
      }
      list.appendChild(row);
    });

    container.appendChild(list);
  }

  private renderPoemsTab(container: HTMLElement): void {
    const list = document.createElement('div');
    list.className = 'handbook-poems-list';
    const state = this.state;

    if (state.savedPoems.length === 0) {
      list.innerHTML = `
        <div class="empty-poetry">
          <div class="empty-feather">✒️</div>
          <div class="empty-text">这里暂时只有墨水的味道。</div>
          <div class="empty-sub">走过诗人路线后，半糖写下的短诗会抄录在这里。</div>
        </div>
      `;
    } else {
      state.savedPoems.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'saved-poem-card';
        card.innerHTML = `
          <div class="poem-title">${p.title}</div>
          <div class="poem-materials">材料：${p.materials.join(' · ')}</div>
          <div class="poem-lines">
            ${p.lines.map((l) => `<p>${l}</p>`).join('')}
          </div>
          <div class="poem-date">${new Date(p.timestamp).toLocaleDateString()}</div>
        `;
        list.appendChild(card);
      });
    }

    container.appendChild(list);
  }
}
