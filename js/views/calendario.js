// Calendario y agenda: cuándo ocurren las cosas. Vistas de mes, semana y día, con los eventos,
// las tareas con fecha límite y una anotación libre por día.

import { esc, icon } from '../ui.js';
import { getState, setDayNote, setSetting, EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from '../store.js';
import { dayIndex, eventsOn, tasksOn, isOpen, journalOn, journalHeading } from '../query.js';
import { taskRow, eventRow } from '../components.js';
import {
  todayKey, addDays, addMonths, monthOf, monthWeeks, weekDays, isoWeek, diffDays,
  fmtLong, fmtMonth, fmtWeekRange, fmtWeekday, cap,
} from '../dates.js';

const MODES = [['month', 'Mes'], ['week', 'Semana'], ['day', 'Día']];
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const eventChip = (e, tag = 'span') => `
  <${tag} class="cal-chip"${tag === 'button' ? ` data-act="open-event" data-id="${e.id}"` : ''} style="--c:var(--c-${EVENT_TYPE_COLOR[e.type]})" title="${esc(EVENT_TYPE_LABEL[e.type])}">
    ${e.start ? `<b>${e.start}</b>` : ''}<span>${esc(e.title)}</span>
  </${tag}>`;

const taskChip = (t, tag = 'span') => `
  <${tag} class="cal-chip task ${isOpen(t) ? '' : 'done'}"${tag === 'button' ? ` data-act="open-task" data-id="${t.id}"` : ''} style="--c:var(--c-blue)" title="Tarea">
    ${icon(isOpen(t) ? 'check-square' : 'check')}<span>${esc(t.title)}</span>
  </${tag}>`;

// ---------- Mes ----------
function monthView(ctx, index) {
  const { day } = ctx.cal;
  const ym = monthOf(day);
  const today = todayKey();
  const notes = getState().dayNotes;
  const cells = monthWeeks(ym).flat().map((key) => {
    const slot = index.get(key) || { events: [], tasks: [] };
    const items = [...slot.events.map((e) => ({ e })), ...slot.tasks.map((t) => ({ t }))];
    const shown = items.slice(0, 3);
    const cls = [monthOf(key) !== ym ? 'out' : '', key === today ? 'today' : '', key === day ? 'selected' : ''].join(' ');
    const count = items.length ? `, ${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}` : '';
    return `
      <button class="cal-cell ${cls}" data-day="${key}" aria-label="${esc(fmtLong(key))}${count}" aria-pressed="${key === day}">
        <span class="cal-num">${Number(key.slice(8))}${notes[key] ? '<i class="cal-note" title="Con anotación"></i>' : ''}</span>
        <span class="cal-chips">
          ${shown.map((it) => (it.e ? eventChip(it.e) : taskChip(it.t))).join('')}
          ${items.length > shown.length ? `<span class="cal-more">${items.length - shown.length} más</span>` : ''}
        </span>
        <span class="cal-dots">
          ${items.slice(0, 4).map((it) => `<i style="--c:var(--c-${it.e ? EVENT_TYPE_COLOR[it.e.type] : 'blue'})"${it.t && !isOpen(it.t) ? ' class="off"' : ''}></i>`).join('')}
        </span>
      </button>`;
  }).join('');

  return `
    <div class="cal-layout">
      <section class="card cal-month">
        <div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="legend">
          <span><i class="dot" style="--c:var(--c-indigo)"></i>Evento</span>
          <span><i class="dot" style="--c:var(--c-teal)"></i>Cita</span>
          <span><i class="dot" style="--c:var(--c-coral)"></i>Examen</span>
          <span><i class="dot" style="--c:var(--c-amber)"></i>Entrega</span>
          <span><i class="dot" style="--c:var(--c-pink)"></i>Fecha importante</span>
          <span><i class="dot" style="--c:var(--c-blue)"></i>Tarea</span>
        </div>
      </section>
      ${dayPanel(day)}
    </div>`;
}

// ---------- Semana ----------
function weekView(ctx, index) {
  const { day } = ctx.cal;
  const today = todayKey();
  const cols = weekDays(day).map((key) => {
    const slot = index.get(key) || { events: [], tasks: [] };
    const cls = [key === today ? 'today' : '', key === day ? 'selected' : ''].join(' ');
    const empty = !slot.events.length && !slot.tasks.length;
    return `
      <div class="cal-col ${cls}" data-day="${key}">
        <button class="cal-col-head" data-day="${key}" aria-label="${esc(fmtLong(key))}" aria-pressed="${key === day}">
          <small>${esc(fmtWeekday(key))}</small><b>${Number(key.slice(8))}</b>
        </button>
        <div class="cal-col-items">
          ${slot.events.map((e) => eventChip(e, 'button')).join('')}
          ${slot.tasks.map((t) => taskChip(t, 'button')).join('')}
          ${empty ? '<span class="cal-col-empty">–</span>' : ''}
        </div>
      </div>`;
  }).join('');
  return `
    <section class="card cal-week">${cols}</section>
    ${dayPanel(day)}`;
}

// ---------- Día ----------
// Detalle de un día: lo comparten las tres vistas.
function dayPanel(key) {
  const events = eventsOn(key);
  const tasks = tasksOn(key);
  const note = getState().dayNotes[key] || '';
  const entries = journalOn(key);
  const diff = diffDays(key, todayKey());
  const rel = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : diff === -1 ? 'Ayer' : '';
  return `
    <section class="card day-panel">
      <header class="card-head">
        <h2 class="card-title"><span>${esc(cap(fmtLong(key)))}</span>${rel ? `<span class="badge badge-active">${rel}</span>` : ''}</h2>
        <div class="card-actions">
          <button class="btn btn-sm" data-act="new-task" data-date="${key}">${icon('plus')}<span>Tarea</span></button>
          <button class="btn btn-sm btn-primary" data-act="new-event" data-date="${key}">${icon('plus')}<span>Evento</span></button>
        </div>
      </header>
      ${events.length ? `<p class="group-title">Eventos</p><div class="list">${events.map((e) => eventRow(e)).join('')}</div>` : ''}
      ${tasks.length ? `<p class="group-title">Tareas con fecha este día</p><div class="list">${tasks.map((t) => taskRow(t, { due: false })).join('')}</div>` : ''}
      ${!events.length && !tasks.length ? '<p class="day-empty">Día libre de eventos y tareas.</p>' : ''}
      ${entries.length ? `
        <p class="group-title">Diario</p>
        <div class="list">
          ${entries.map((j) => `
            <a class="act act-link" href="#/diario/${j.id}">
              <span class="act-icon">${icon(j.starred ? 'star' : 'book')}</span>
              <span class="act-body"><span class="act-title">${esc(journalHeading(j))}</span></span>
            </a>`).join('')}
        </div>` : ''}
      <button class="btn btn-sm btn-ghost day-journal" data-act="new-journal" data-date="${key}">${icon('book')}<span>Escribir en el diario</span></button>
      <label class="field day-note">
        <span class="field-label">Anotación del día</span>
        <textarea rows="3" data-day-note="${key}" data-fk="day-note-${key}" placeholder="Algo que quieras recordar de este día">${esc(note)}</textarea>
      </label>
    </section>`;
}

// ---------- Vista ----------
export function render(ctx) {
  const { mode, day } = ctx.cal;
  const index = dayIndex();
  const title = mode === 'month' ? fmtMonth(monthOf(day)) : mode === 'week' ? fmtWeekRange(day) : cap(fmtLong(day));
  const sub = mode === 'week' ? `Semana ${isoWeek(day)}` : '';
  const unit = { month: 'Mes', week: 'Semana', day: 'Día' }[mode].toLowerCase();
  return `
    <header class="page-head cal-head">
      <div class="cal-nav">
        <button class="icon-btn" data-step="-1" aria-label="${cap(unit)} anterior">${icon('chevron-left')}</button>
        <button class="icon-btn" data-step="1" aria-label="${cap(unit)} siguiente">${icon('chevron-right')}</button>
        <div class="cal-titles">
          <h1>${esc(title)}</h1>
          ${sub ? `<p class="eyebrow">${esc(sub)}</p>` : ''}
        </div>
      </div>
      <div class="cal-tools">
        <button class="btn" data-today${day === todayKey() ? ' disabled' : ''}>Hoy</button>
        <div class="seg" role="group" aria-label="Vista">
          ${MODES.map(([m, label]) => `<button data-mode="${m}" class="${m === mode ? 'active' : ''}" aria-pressed="${m === mode}">${label}</button>`).join('')}
        </div>
      </div>
    </header>
    ${mode === 'month' ? monthView(ctx, index) : mode === 'week' ? weekView(ctx, index) : `<div class="cal-day">${dayPanel(day)}</div>`}`;
}

export function mount(root, ctx) {
  const go = (patch) => ctx.set('cal', { ...ctx.cal, ...patch });

  root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.step);
    const { mode, day } = ctx.cal;
    if (mode === 'day') return go({ day: addDays(day, n) });
    if (mode === 'week') return go({ day: addDays(day, 7 * n) });
    // Al cambiar de mes se selecciona hoy si cae en él; si no, el día 1.
    const ym = addMonths(monthOf(day), n);
    return go({ day: ym === monthOf(todayKey()) ? todayKey() : `${ym}-01` });
  }));

  root.querySelector('[data-today]')?.addEventListener('click', () => go({ day: todayKey() }));

  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    setSetting('calendarMode', b.dataset.mode, { silent: true });
    go({ mode: b.dataset.mode });
  }));

  root.querySelectorAll('button[data-day]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.day !== ctx.cal.day) go({ day: b.dataset.day });
  }));

  // La anotación se guarda mientras se escribe, sin repintar la pantalla.
  root.querySelectorAll('[data-day-note]').forEach((el) => el.addEventListener('input', () => {
    setDayNote(el.dataset.dayNote, el.value, { silent: true });
  }));
}
