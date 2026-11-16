// Buscador global: encuentra tareas, proyectos, eventos, notas y apuntes sin recordar dónde se guardaron.

import { esc, icon, openModal, closeModal } from './ui.js';
import { search } from './query.js';
import { openTaskForm, openEventForm, openOrganize } from './forms.js';

// Abre el elemento elegido en su sitio. `goToDay` lleva el calendario a un día.
function openResult(item, goToDay) {
  closeModal();
  if (item.kind === 'task') openTaskForm({ id: item.id });
  else if (item.kind === 'event') openEventForm({ id: item.id });
  else if (item.kind === 'project' || item.kind === 'entry') location.hash = `#/proyectos/${item.id}`;
  else if (item.kind === 'journal') location.hash = `#/diario/${item.id}`;
  else if (item.kind === 'sprint') location.hash = `#/sprints/${item.id}`;
  else if (item.kind === 'day') goToDay(item.id);
  else if (item.kind === 'inbox') openOrganize(item.id);
}

export function openSearch({ goToDay }) {
  let flat = [];
  let active = 0;

  const resultsHtml = (text) => {
    const groups = search(text);
    flat = groups.flatMap((g) => g.items);
    if (!text.trim()) return '<p class="search-hint">Escribe para buscar en tus tareas, proyectos, eventos, diario, notas y apuntes.</p>';
    if (!flat.length) return `<p class="search-hint">Nada coincide con «${esc(text.trim())}».</p>`;
    let i = 0;
    return groups.map((g) => `
      <div class="search-group">
        <p class="group-title">${esc(g.label)}${g.total > g.items.length ? ` <span class="muted">– ${g.items.length} de ${g.total}</span>` : ''}</p>
        ${g.items.map((it) => {
          const idx = i;
          i += 1;
          return `
            <button class="search-item ${idx === active ? 'active' : ''} ${it.done ? 'done' : ''}" data-idx="${idx}">
              <span class="search-icon">${icon(it.icon)}</span>
              <span class="menu-text"><span class="search-title">${esc(it.title)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
            </button>`;
        }).join('')}
      </div>`).join('');
  };

  openModal({
    size: 'search',
    render: () => `
      <div class="search-box">
        ${icon('search')}
        <input type="search" autofocus autocomplete="off" spellcheck="false" placeholder="Buscar en LifeLine…" aria-label="Buscar en LifeLine">
        <button type="button" class="icon-btn" data-modal-close aria-label="Cerrar">${icon('x')}</button>
      </div>
      <div class="modal-body search-results">${resultsHtml('')}</div>`,
    mount: (panel) => {
      const input = panel.querySelector('input');
      const results = panel.querySelector('.search-results');
      const paint = () => { results.innerHTML = resultsHtml(input.value); };
      const mark = () => {
        results.querySelectorAll('.search-item').forEach((el) => el.classList.toggle('active', Number(el.dataset.idx) === active));
        results.querySelector('.search-item.active')?.scrollIntoView({ block: 'nearest' });
      };
      input.addEventListener('input', () => { active = 0; paint(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!flat.length) return;
          active = (active + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length;
          mark();
        } else if (e.key === 'Enter' && flat[active]) {
          e.preventDefault();
          openResult(flat[active], goToDay);
        }
      });
      results.addEventListener('click', (e) => {
        const el = e.target.closest('.search-item');
        if (el) openResult(flat[Number(el.dataset.idx)], goToDay);
      });
    },
  });
}
