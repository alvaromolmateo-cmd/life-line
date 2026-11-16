// Piezas de interfaz que comparten varias vistas: filas de tarea y de evento, etiquetas, tarjetas.
// Las acciones se declaran con `data-act` y las atiende app.js de forma global.

import { esc, icon } from './ui.js';
import { EVENT_TYPE_LABEL, EVENT_TYPE_COLOR, PRIORITY_LABEL, PROJECT_STATUS_LABEL } from './store.js';
import { categoryOf, projectOf, isOpen, isOverdue, activityLabel, activityIcon, taskSprint, thisWeek, sprintsOn } from './query.js';
import { fmtRelative, fmtTimeRange, fmtDayMonth, fmtWeekday, fmtMoment, todayKey, cap } from './dates.js';

export const chip = (text, { color = '', ic = '', cls = '' } = {}) => `
  <span class="chip ${color ? 'chip-c' : ''} ${cls}"${color ? ` style="--c:var(--c-${color})"` : ''}>${ic ? icon(ic) : ''}${esc(text)}</span>`;

export const categoryChip = (id) => {
  const c = categoryOf(id);
  if (!c) return '';
  // Una subcategoría enseña su nombre y su color; la ruta completa queda en el texto de ayuda.
  const parent = c.parentId ? categoryOf(c.parentId) : null;
  return `<span class="chip chip-cat" style="--c:var(--c-${c.color})"${parent ? ` title="${esc(`${parent.name} › ${c.name}`)}"` : ''}><i class="dot"></i>${esc(c.name)}</span>`;
};

export const projectChip = (id) => {
  const p = projectOf(id);
  return p ? chip(p.title, { ic: 'folder' }) : '';
};

export const tagChips = (tags) => (tags || []).map((t) => `<span class="chip chip-tag">#${esc(t)}</span>`).join('');

export const dueChip = (t) => {
  if (!t.due) return '';
  const cls = isOverdue(t) ? 'chip-late' : t.due === todayKey() && isOpen(t) ? 'chip-today' : '';
  return chip(fmtRelative(t.due), { ic: 'calendar', cls });
};

export const priorityChip = (priority) => {
  if (priority === 'high') return chip(`Prioridad ${PRIORITY_LABEL.high.toLowerCase()}`, { ic: 'flag', cls: 'chip-high' });
  if (priority === 'low') return chip(`Prioridad ${PRIORITY_LABEL.low.toLowerCase()}`, { cls: 'chip-low' });
  return '';
};

export const statusBadge = (status) => `<span class="badge badge-${status}">${esc(PROJECT_STATUS_LABEL[status])}</span>`;

// Marca las tareas elegidas para el sprint de esta semana o de una de las siguientes.
export const sprintChip = (t) => {
  const s = sprintsOn() ? taskSprint(t.id) : null;
  if (!s) return '';
  return chip(s.start === thisWeek() ? 'Sprint' : `Sprint del ${fmtDayMonth(s.start)}`, { ic: 'sprint', cls: 'chip-sprint' });
};

// Fila de tarea: casilla para completarla y el resto abre su ficha. `after` es HTML para el final de la fila.
export function taskRow(t, { project = true, due = true, category = true, sprint = true, status = true, after = '' } = {}) {
  const done = !isOpen(t);
  const meta = [
    status && t.status === 'doing' ? chip('En curso', { cls: 'chip-doing' }) : '',
    due ? dueChip(t) : '',
    sprint ? sprintChip(t) : '',
    project ? projectChip(t.projectId) : '',
    category ? categoryChip(t.categoryId) : '',
    priorityChip(t.priority),
    tagChips(t.tags),
  ].join('');
  return `
    <div class="task ${done ? 'done' : ''}">
      <button class="check ${done ? 'on' : ''}" data-act="toggle-task" data-id="${t.id}" aria-pressed="${done}" aria-label="${done ? 'Marcar como pendiente' : 'Marcar como hecha'}">${icon('check')}</button>
      <button class="task-main" data-act="open-task" data-id="${t.id}">
        <span class="task-title">${esc(t.title)}</span>
        ${meta.trim() ? `<span class="task-meta">${meta}</span>` : ''}
      </button>
      ${after}
    </div>`;
}

// Fila de evento. Con `date` muestra el día además de la hora.
export function eventRow(e, { date = false, project = true } = {}) {
  const color = EVENT_TYPE_COLOR[e.type];
  const meta = [
    e.type !== 'event' ? chip(EVENT_TYPE_LABEL[e.type], { color }) : '',
    e.place ? chip(e.place, { ic: 'pin' }) : '',
    project ? projectChip(e.projectId) : '',
    categoryChip(e.categoryId),
  ].join('');
  const when = date
    ? `<span class="ev-day"><b>${Number(e.date.slice(8))}</b><small>${esc(fmtDayMonth(e.date).split(' ')[1] || '')}</small></span>`
    : '';
  const sub = date
    ? `${cap(e.date === todayKey() ? 'hoy' : fmtWeekday(e.date))} · ${fmtTimeRange(e.start, e.end)}`
    : fmtTimeRange(e.start, e.end);
  return `
    <button class="ev" data-act="open-event" data-id="${e.id}" style="--c:var(--c-${color})">
      ${when || '<i class="ev-bar"></i>'}
      <span class="ev-body">
        <span class="ev-title">${esc(e.title)}</span>
        <span class="ev-sub">${esc(sub)}</span>
        ${meta.trim() ? `<span class="task-meta">${meta}</span>` : ''}
      </span>
    </button>`;
}

export const progressBar = (done, total) => `
  <div class="progress" role="img" aria-label="${done} de ${total} tareas hechas"><div class="progress-fill" style="width:${total ? Math.round((done / total) * 100) : 0}%"></div></div>`;

export const emptyState = (ic, title, text = '', action = '') => `
  <div class="empty">
    <div class="empty-icon">${icon(ic)}</div>
    <p class="empty-title">${esc(title)}</p>
    ${text ? `<p class="empty-text">${esc(text)}</p>` : ''}
    ${action}
  </div>`;

// Tarjeta con cabecera. `action` es HTML para la esquina (un enlace o un botón).
export const card = ({ title, ic, body, action = '', cls = '' }) => `
  <section class="card ${cls}">
    <header class="card-head">
      <h2 class="card-title">${ic ? icon(ic) : ''}<span>${esc(title)}</span></h2>
      ${action}
    </header>
    ${body}
  </section>`;

export const cardLink = (href, text) => `<a class="card-link" href="${href}">${esc(text)}${icon('arrow-right')}</a>`;

// Apunte del historial: qué pasó, con qué y cuándo.
export const activityRow = (a) => `
  <div class="act">
    <span class="act-icon ${a.action === 'completed' ? 'ok' : ''}">${icon(activityIcon(a))}</span>
    <span class="act-body"><span class="act-title">${esc(a.title)}</span><small>${esc(activityLabel(a))} · ${esc(fmtMoment(a.at))}</small></span>
  </div>`;
