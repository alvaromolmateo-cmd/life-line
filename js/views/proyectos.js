// Proyectos: qué se quiere conseguir. La lista resume cada proyecto y la ficha reúne su objetivo,
// sus tareas, sus notas, ideas y avances, sus eventos y su historial.

import { esc, icon, confirmDialog, multiline, plural } from '../ui.js';
import {
  getState, addTask, updateProject, addProjectEntry, removeProjectEntry, reorderProjectTasks,
  PROJECT_STATUSES, PROJECT_STATUS_LABEL, PRIORITY_LABEL, ENTRY_KINDS, ENTRY_KIND_LABEL,
} from '../store.js';
import {
  projectOf, projectStats, projectTasks, projectEvents, projectActivity, projectJournal, journalHeading,
  byManual, isOpen, isLateDelivery, PRIORITY_RANKING,
} from '../query.js';
import { taskRow, eventRow, emptyState, progressBar, categoryChip, tagChips, statusBadge, priorityChip, activityRow } from '../components.js';
import { sortable } from '../drag.js';
import { fmtRelative, fmtShort, fmtMoment, todayKey, cap } from '../dates.js';

const FILTERS = [['active', 'Activos'], ['paused', 'En pausa'], ['done', 'Terminados'], ['all', 'Todos']];
const ENTRY_ICON = { note: 'note', idea: 'bulb', progress: 'trending' };
const ENTRY_COLOR = { note: 'slate', idea: 'amber', progress: 'green' };
const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

// ---------- Lista ----------
function projectCard(p) {
  const s = projectStats(p.id);
  const text = p.goal.trim() || p.description.trim();
  return `
    <a class="card proj-card" href="#/proyectos/${p.id}">
      <span class="proj-card-top">
        <span class="proj-icon" style="--c:var(--c-${getState().categories.find((c) => c.id === p.categoryId)?.color || 'indigo'})">${icon('folder')}</span>
        ${statusBadge(p.status)}
      </span>
      <span class="proj-title">${esc(p.title)}</span>
      ${text ? `<span class="proj-text">${esc(text)}</span>` : ''}
      <span class="proj-progress">
        <span class="proj-count"><span>${s.total ? `${s.done} de ${plural(s.total, 'tarea', 'tareas')}` : 'Sin tareas todavía'}</span>${s.nextDue ? `<span>${s.nextDue < todayKey() ? 'Atrasada' : 'Siguiente'} – ${esc(fmtRelative(s.nextDue))}</span>` : ''}</span>
        ${progressBar(s.done, s.total)}
      </span>
      <span class="task-meta">${categoryChip(p.categoryId)}${priorityChip(p.priority)}${tagChips(p.tags)}</span>
    </a>`;
}

function listView(ctx) {
  const all = getState().projects;
  const filter = ctx.projectFilter;
  const list = all
    .filter((p) => filter === 'all' || p.status === filter)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.createdAt.localeCompare(a.createdAt));
  const count = (f) => (f === 'all' ? all.length : all.filter((p) => p.status === f).length);
  return `
    <header class="page-head">
      <div>
        <h1>Proyectos</h1>
        <p class="sub">Objetivos que necesitan varias tareas y algo de seguimiento.</p>
      </div>
      <button class="btn btn-primary" data-act="new-project">${icon('plus')}<span>Nuevo proyecto</span></button>
    </header>
    ${all.length ? `
      <nav class="tabs" aria-label="Estado de los proyectos">
        ${FILTERS.map(([f, label]) => `
          <button class="tab ${f === filter ? 'active' : ''}" data-project-filter="${f}" aria-pressed="${f === filter}">
            ${label}${count(f) ? `<span class="count">${count(f)}</span>` : ''}
          </button>`).join('')}
      </nav>
      ${list.length
    ? `<div class="proj-grid">${list.map(projectCard).join('')}</div>`
    : emptyState('folder', `Ningún proyecto ${{ active: 'activo', paused: 'en pausa', done: 'terminado' }[filter] || ''}`.trim())}`
    : emptyState('folder', 'Tu primer proyecto', 'Preparar un examen, desarrollar una app, reformar una habitación. Reúne aquí sus tareas, sus notas y sus avances.',
      `<button class="btn btn-primary" data-act="new-project">${icon('plus')}<span>Nuevo proyecto</span></button>`)}`;
}

// ---------- Ficha ----------
function detailView(p, ctx) {
  const s = projectStats(p.id);
  const tasks = projectTasks(p.id);
  // Por prioridad y, dentro de cada una, en el orden en que se hayan colocado arrastrándolas.
  const open = tasks.filter(isOpen).sort(byManual);
  const done = tasks.filter((t) => !isOpen(t)).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const events = projectEvents(p.id);
  // Una entrega vencida sin entregar sigue pendiente: va arriba, no con los pasados.
  const upcoming = events.filter((e) => e.date >= todayKey() || isLateDelivery(e));
  const past = events.filter((e) => e.date < todayKey() && !isLateDelivery(e)).reverse();
  const entries = p.entries.slice().sort((a, b) => b.at.localeCompare(a.at));
  const activity = projectActivity(p.id);
  const diary = projectJournal(p.id);
  const kind = ctx.entryKind;
  const showDone = ctx.showDone;

  const dates = [
    p.start ? ['Inicio', cap(fmtShort(p.start))] : null,
    p.end ? ['Fin previsto', cap(fmtShort(p.end))] : null,
    p.completedAt ? ['Terminado', fmtMoment(p.completedAt)] : null,
    ['Prioridad', PRIORITY_LABEL[p.priority]],
  ].filter(Boolean);

  return `
    <a class="back-link" href="#/proyectos">${icon('arrow-left')}<span>Proyectos</span></a>
    <header class="page-head proj-head">
      <div>
        <h1>${esc(p.title)}</h1>
        <p class="task-meta">${statusBadge(p.status)}${categoryChip(p.categoryId)}${tagChips(p.tags)}</p>
      </div>
      <button class="btn head-icon" data-act="edit-project" data-id="${p.id}" aria-label="Editar proyecto">${icon('edit')}<span>Editar</span></button>
    </header>

    <div class="proj-layout">
      <div class="proj-main">
        ${p.description.trim() || p.goal.trim() ? `
          <section class="card">
            ${p.description.trim() ? `<p class="proj-desc">${multiline(p.description.trim())}</p>` : ''}
            ${p.goal.trim() ? `<div class="goal">${icon('target')}<div><p class="field-label">Objetivo</p><p>${multiline(p.goal.trim())}</p></div></div>` : ''}
          </section>` : ''}

        <section class="card">
          <header class="card-head">
            <h2 class="card-title">${icon('check-square')}<span>Tareas</span></h2>
            <span class="muted">${s.total ? `${s.done} de ${s.total} hechas` : ''}</span>
          </header>
          ${s.total ? progressBar(s.done, s.total) : ''}
          <form class="capture inline" data-project-task>
            ${icon('plus')}
            <input name="title" data-fk="project-task" autocomplete="off" enterkeyhint="done" aria-label="Nueva tarea del proyecto" placeholder="Nueva tarea del proyecto">
            <button class="btn btn-sm btn-primary">Añadir</button>
          </form>
          ${open.length ? `<div class="list" data-sort-list="project">${open.map((t) => taskRow(t, { project: false, sortable: true })).join('')}</div>` : ''}
          ${!tasks.length ? '<p class="day-empty">Divide el proyecto en pasos pequeños y ve tachándolos.</p>' : ''}
          ${done.length ? `
            <button class="disclosure" data-toggle-done aria-expanded="${showDone}">${icon(showDone ? 'arrow-up' : 'arrow-down')}<span>${plural(done.length, 'hecha', 'hechas')}</span></button>
            ${showDone ? `<div class="list">${done.map((t) => taskRow(t, { project: false })).join('')}</div>` : ''}` : ''}
        </section>

        <section class="card">
          <header class="card-head">
            <h2 class="card-title">${icon('note')}<span>Notas, ideas y avances</span></h2>
          </header>
          <form class="entry-form" data-entry-form>
            <div class="seg" role="group" aria-label="Tipo">
              ${ENTRY_KINDS.map((k) => `<button type="button" data-entry-kind="${k}" class="${k === kind ? 'active' : ''}" aria-pressed="${k === kind}">${ENTRY_KIND_LABEL[k]}</button>`).join('')}
            </div>
            <textarea name="text" rows="2" data-fk="entry-text" aria-label="${ENTRY_KIND_LABEL[kind]}" placeholder="${{ note: 'Algo que conviene tener a mano', idea: 'Una idea para más adelante', progress: 'Qué has avanzado' }[kind]}"></textarea>
            <button class="btn btn-sm btn-primary">Guardar</button>
          </form>
          ${entries.length ? `
            <div class="list entries">
              ${entries.map((e) => `
                <article class="entry" style="--c:var(--c-${ENTRY_COLOR[e.kind]})">
                  <span class="entry-icon">${icon(ENTRY_ICON[e.kind])}</span>
                  <div class="entry-body">
                    <p class="entry-meta"><b>${ENTRY_KIND_LABEL[e.kind]}</b> · ${esc(fmtMoment(e.at))}</p>
                    <p>${multiline(e.text)}</p>
                  </div>
                  <button class="icon-btn sm" data-remove-entry="${e.id}" aria-label="Eliminar">${icon('trash')}</button>
                </article>`).join('')}
            </div>` : ''}
        </section>
      </div>

      <aside class="proj-side">
        <section class="card">
          <label class="field">
            <span class="field-label">Estado</span>
            <select data-project-status data-fk="project-status">
              ${PROJECT_STATUSES.map((st) => `<option value="${st}"${st === p.status ? ' selected' : ''}>${PROJECT_STATUS_LABEL[st]}</option>`).join('')}
            </select>
          </label>
          <dl class="meta-list">
            ${dates.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}
          </dl>
        </section>

        <section class="card">
          <header class="card-head">
            <h2 class="card-title">${icon('calendar')}<span>Eventos</span></h2>
            <button class="btn btn-sm" data-act="new-event" data-project="${p.id}">${icon('plus')}<span>Evento</span></button>
          </header>
          ${upcoming.length ? `<div class="list">${upcoming.map((e) => eventRow(e, { date: true, project: false })).join('')}</div>` : '<p class="day-empty">Exámenes, entregas o citas ligadas a este proyecto.</p>'}
          ${past.length ? `<p class="group-title">Pasados</p><div class="list faded">${past.slice(0, 5).map((e) => eventRow(e, { date: true, project: false })).join('')}</div>` : ''}
        </section>

        <section class="card">
          <header class="card-head">
            <h2 class="card-title">${icon('book')}<span>Diario</span></h2>
            <button class="btn btn-sm" data-act="new-journal" data-project="${p.id}">${icon('plus')}<span>Entrada</span></button>
          </header>
          ${diary.length ? `
            <div class="list">
              ${diary.slice(0, 6).map((j) => `
                <a class="act act-link" href="#/diario/${j.id}">
                  <span class="act-icon">${icon(j.starred ? 'star' : 'book')}</span>
                  <span class="act-body"><span class="act-title">${esc(journalHeading(j))}</span><small>${esc(cap(fmtShort(j.date)))}</small></span>
                </a>`).join('')}
            </div>
            ${diary.length > 6 ? `<p class="muted small">Y ${diary.length - 6} entradas anteriores.</p>` : ''}`
    : '<p class="day-empty">Lo que escribas en el diario sobre este proyecto.</p>'}
        </section>

        <section class="card">
          <header class="card-head"><h2 class="card-title">${icon('activity')}<span>Historial</span></h2></header>
          <div class="list">${activity.slice(0, 12).map(activityRow).join('')}</div>
          ${activity.length > 12 ? `<p class="muted small">Y ${activity.length - 12} apuntes anteriores.</p>` : ''}
        </section>
      </aside>
    </div>`;
}

// ---------- Vista ----------
export function render(ctx) {
  if (!ctx.param) return listView(ctx);
  const project = projectOf(ctx.param);
  if (!project) {
    return `
      <a class="back-link" href="#/proyectos">${icon('arrow-left')}<span>Proyectos</span></a>
      ${emptyState('folder', 'Este proyecto ya no existe')}`;
  }
  return detailView(project, ctx);
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-project-filter]').forEach((b) => b.addEventListener('click', () => ctx.set('projectFilter', b.dataset.projectFilter)));

  const id = ctx.param;
  if (!id) return;

  root.querySelector('[data-project-task]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.currentTarget.elements.title;
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    addTask({ title, projectId: id, categoryId: projectOf(id)?.categoryId || '' });
  });

  const list = root.querySelector('[data-sort-list="project"]');
  if (list) sortable(list, { groups: PRIORITY_RANKING, onDrop: ({ ids }) => reorderProjectTasks(id, ids) });

  root.querySelector('[data-toggle-done]')?.addEventListener('click', () => ctx.set('showDone', !ctx.showDone));

  root.querySelector('[data-project-status]')?.addEventListener('change', (e) => updateProject(id, { status: e.target.value }));

  const form = root.querySelector('[data-entry-form]');
  root.querySelectorAll('[data-entry-kind]').forEach((b) => b.addEventListener('click', () => {
    // Cambia el tipo conservando lo que ya se haya escrito.
    const draft = form.elements.text.value;
    ctx.set('entryKind', b.dataset.entryKind);
    const text = document.querySelector('[data-entry-form] textarea');
    text.value = draft;
    text.focus();
  }));
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = form.elements.text.value;
    if (!text.trim()) return;
    form.elements.text.value = '';
    addProjectEntry(id, { kind: ctx.entryKind, text });
  });
  // Ctrl + Intro guarda sin soltar el teclado.
  form?.elements.text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  root.querySelectorAll('[data-remove-entry]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Eliminar nota', message: 'Se eliminará esta nota del proyecto.' });
    if (ok) removeProjectEntry(id, b.dataset.removeEntry);
  }));
}
