// Inicio: visión general del momento. Cada bloque se puede ocultar o recolocar desde «Personalizar».

import { esc, icon, openModal, modalHeader, plural, toast } from '../ui.js';
import { getState, addInbox, toggleWidget, moveWidget, WIDGET_LABEL } from '../store.js';
import {
  openTasks, eventsOn, tasksOn, upcomingEvents, dayIndex, projectStats, recentActivity,
  isOpen, isOverdue, byDue,
} from '../query.js';
import { taskRow, eventRow, card, cardLink, emptyState, progressBar, categoryChip, activityRow } from '../components.js';
import { todayKey, toKey, fmtLong, fmtMonth, fmtRelative, monthWeeks, monthOf, addMonths, cap } from '../dates.js';

function greeting() {
  const h = new Date().getHours();
  if (h >= 6 && h < 13) return 'Buenos días';
  if (h >= 13 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

// ---------- Bloques ----------
function widgetHoy() {
  const today = todayKey();
  const events = eventsOn(today);
  const due = tasksOn(today).filter(isOpen);
  const late = getState().tasks.filter(isOverdue).sort(byDue);
  const doneToday = getState().tasks.filter((t) => !isOpen(t) && t.completedAt && toKey(new Date(t.completedAt)) === today).length;
  const summary = [
    events.length ? plural(events.length, 'evento', 'eventos') : '',
    due.length ? plural(due.length, 'tarea para hoy', 'tareas para hoy') : '',
    late.length ? plural(late.length, 'atrasada', 'atrasadas') : '',
  ].filter(Boolean).join(' · ');

  const body = !events.length && !due.length && !late.length
    ? emptyState('sparkle', 'Día despejado', doneToday ? `Hoy llevas ${plural(doneToday, 'tarea hecha', 'tareas hechas')}.` : 'Sin compromisos ni tareas con fecha para hoy.')
    : `
      ${summary ? `<p class="card-sub">${esc(summary)}</p>` : ''}
      ${events.length ? `<div class="list">${events.map((e) => eventRow(e)).join('')}</div>` : ''}
      ${due.length ? `<p class="group-title">Para hoy</p><div class="list">${due.map((t) => taskRow(t, { due: false })).join('')}</div>` : ''}
      ${late.length ? `<p class="group-title late">Atrasadas</p><div class="list">${late.slice(0, 5).map((t) => taskRow(t)).join('')}</div>` : ''}
      ${late.length > 5 ? `<a class="more-link" href="#/tareas">Ver las ${late.length} atrasadas</a>` : ''}`;

  return card({
    title: 'Tu día',
    ic: 'sun',
    cls: 'w-hoy',
    action: `
      <div class="card-actions">
        <button class="btn btn-sm" data-act="new-task" data-date="${today}">${icon('plus')}<span>Tarea</span></button>
        <button class="btn btn-sm" data-act="new-event" data-date="${today}">${icon('plus')}<span>Evento</span></button>
      </div>`,
    body,
  });
}

function widgetCalendario(ctx) {
  const ym = ctx.homeMonth;
  const today = todayKey();
  const index = dayIndex();
  const cells = monthWeeks(ym).flat().map((key) => {
    const slot = index.get(key);
    const hasEvent = !!slot?.events.length;
    const hasTask = !!slot?.tasks.some(isOpen);
    const cls = [monthOf(key) !== ym ? 'out' : '', key === today ? 'today' : ''].join(' ');
    return `
      <button class="mini-day ${cls}" data-act="goto-day" data-date="${key}" aria-label="${esc(fmtLong(key))}">
        <span>${Number(key.slice(8))}</span>
        <i class="mini-marks">${hasEvent ? '<b class="m-event"></b>' : ''}${hasTask ? '<b class="m-task"></b>' : ''}</i>
      </button>`;
  }).join('');

  return card({
    title: 'Calendario',
    ic: 'calendar',
    cls: 'w-calendario',
    action: cardLink('#/calendario', 'Abrir'),
    body: `
      <div class="mini-head">
        <button class="icon-btn sm" data-home-month="-1" aria-label="Mes anterior">${icon('chevron-left')}</button>
        <span class="mini-title">${esc(fmtMonth(ym))}</span>
        <button class="icon-btn sm" data-home-month="1" aria-label="Mes siguiente">${icon('chevron-right')}</button>
      </div>
      <div class="mini-grid">
        ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span class="mini-dow">${d}</span>`).join('')}
        ${cells}
      </div>
      <div class="legend"><span><i class="dot" style="--c:var(--c-indigo)"></i>Eventos</span><span><i class="dot" style="--c:var(--c-blue)"></i>Tareas</span></div>`,
  });
}

function widgetTareas() {
  const tasks = openTasks();
  return card({
    title: 'Tareas pendientes',
    ic: 'check-square',
    cls: 'w-tareas',
    action: cardLink('#/tareas', tasks.length > 6 ? `Ver las ${tasks.length}` : 'Ver todas'),
    body: tasks.length
      ? `<div class="list">${tasks.slice(0, 6).map((t) => taskRow(t, { category: false })).join('')}</div>`
      : emptyState('check', 'Todo al día', 'Las tareas que crees aparecerán aquí.'),
  });
}

function widgetEventos() {
  const events = upcomingEvents();
  return card({
    title: 'Próximos eventos',
    ic: 'clock',
    cls: 'w-eventos',
    action: cardLink('#/calendario', 'Ver calendario'),
    body: events.length
      ? `<div class="list">${events.slice(0, 5).map((e) => eventRow(e, { date: true })).join('')}</div>`
      : emptyState('calendar', 'Agenda libre', 'Añade citas, exámenes, entregas o fechas importantes.'),
  });
}

function widgetProyectos() {
  const projects = getState().projects.filter((p) => p.status === 'active');
  const rows = projects.slice(0, 4).map((p) => {
    const s = projectStats(p.id);
    return `
      <a class="proj-mini" href="#/proyectos/${p.id}">
        <span class="proj-mini-top"><span class="proj-mini-title">${esc(p.title)}</span><span class="muted">${s.total ? `${s.done} de ${s.total}` : 'Sin tareas'}</span></span>
        ${progressBar(s.done, s.total)}
        ${s.nextDue || p.categoryId ? `<span class="task-meta">${categoryChip(p.categoryId)}${s.nextDue ? `<span class="chip">${icon('calendar')}${s.nextDue < todayKey() ? 'Atrasada' : 'Siguiente'} – ${esc(fmtRelative(s.nextDue))}</span>` : ''}</span>` : ''}
      </a>`;
  }).join('');
  return card({
    title: 'Proyectos activos',
    ic: 'folder',
    cls: 'w-proyectos',
    action: cardLink('#/proyectos', projects.length > 4 ? `Ver los ${projects.length}` : 'Ver todos'),
    body: projects.length
      ? `<div class="list">${rows}</div>`
      : emptyState('folder', 'Ningún proyecto en marcha', '', `<button class="btn btn-sm" data-act="new-project">${icon('plus')}<span>Nuevo proyecto</span></button>`),
  });
}

function widgetBandeja() {
  const inbox = getState().inbox.slice().reverse();
  return card({
    title: 'Bandeja de entrada',
    ic: 'inbox',
    cls: 'w-bandeja',
    action: cardLink('#/tareas/bandeja', inbox.length > 4 ? `Ver los ${inbox.length}` : 'Abrir'),
    body: inbox.length
      ? `<div class="list">${inbox.slice(0, 4).map((n) => `
          <div class="inbox-item">
            <span class="inbox-text">${esc(n.text)}</span>
            <button class="btn btn-sm" data-act="organize" data-id="${n.id}">Organizar</button>
          </div>`).join('')}</div>`
      : emptyState('inbox', 'Bandeja vacía', 'Lo que apuntes arriba se queda aquí hasta que lo organices.'),
  });
}

function widgetActividad() {
  const items = recentActivity(8);
  return card({
    title: 'Actividad reciente',
    ic: 'activity',
    cls: 'w-actividad',
    body: items.length
      ? `<div class="list">${items.map(activityRow).join('')}</div>`
      : emptyState('activity', 'Aún sin actividad', 'Aquí verás lo último que has ido haciendo.'),
  });
}

const RENDER = {
  hoy: widgetHoy,
  calendario: widgetCalendario,
  tareas: widgetTareas,
  eventos: widgetEventos,
  proyectos: widgetProyectos,
  bandeja: widgetBandeja,
  actividad: widgetActividad,
};

// ---------- Personalizar ----------
function openCustomize() {
  openModal({
    size: 'sm',
    live: true,
    render: () => {
      const list = getState().settings.dashboard;
      return `
        ${modalHeader('Personalizar inicio', 'Elige qué ves al abrir LifeLine y en qué orden.')}
        <div class="modal-body">
          <div class="list">
            ${list.map((w, i) => `
              <div class="widget-row">
                <label class="switch">
                  <input type="checkbox" data-toggle="${w.id}"${w.on ? ' checked' : ''}>
                  <span class="switch-track" aria-hidden="true"></span>
                  <span>${esc(WIDGET_LABEL[w.id])}</span>
                </label>
                <button class="icon-btn sm" data-move="${w.id}" data-dir="-1" aria-label="Subir"${i === 0 ? ' disabled' : ''}>${icon('arrow-up')}</button>
                <button class="icon-btn sm" data-move="${w.id}" data-dir="1" aria-label="Bajar"${i === list.length - 1 ? ' disabled' : ''}>${icon('arrow-down')}</button>
              </div>`).join('')}
          </div>
        </div>
        <div class="modal-foot"><span class="spacer"></span><button class="btn btn-primary" data-modal-close>Listo</button></div>`;
    },
    mount: (panel) => {
      panel.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('change', () => toggleWidget(el.dataset.toggle)));
      panel.querySelectorAll('[data-move]').forEach((el) => el.addEventListener('click', () => moveWidget(el.dataset.move, Number(el.dataset.dir))));
    },
  });
}

// ---------- Vista ----------
export function render(ctx) {
  const st = getState();
  const today = todayKey();
  const name = st.settings.name.trim();
  const widgets = st.settings.dashboard.filter((w) => w.on && RENDER[w.id]).map((w) => RENDER[w.id](ctx)).join('');
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(cap(fmtLong(today)))}</p>
        <h1>${greeting()}${name ? `, ${esc(name)}` : ''}</h1>
      </div>
      <button class="btn btn-ghost head-icon" data-customize aria-label="Personalizar inicio">${icon('sliders')}<span>Personalizar</span></button>
    </header>

    <form class="capture" data-capture>
      ${icon('inbox')}
      <input name="text" data-fk="capture" autocomplete="off" enterkeyhint="done" aria-label="Apunte rápido" placeholder="Apunta una idea o un pendiente y organízalo después">
      <button class="btn btn-primary btn-sm">Apuntar</button>
    </form>

    ${widgets
    ? `<div class="dash">${widgets}</div>`
    : emptyState('sliders', 'Inicio a tu medida', 'Elige qué bloques quieres tener delante.', `<button class="btn btn-sm" data-customize>${icon('sliders')}<span>Personalizar</span></button>`)}`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-customize]').forEach((b) => b.addEventListener('click', openCustomize));

  root.querySelector('[data-capture]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.currentTarget.elements.text;
    const text = input.value;
    if (!text.trim()) return;
    input.value = '';
    addInbox(text);
    toast('Guardado en la bandeja de entrada');
  });

  root.querySelectorAll('[data-home-month]').forEach((b) => b.addEventListener('click', () => {
    ctx.set('homeMonth', addMonths(ctx.homeMonth, Number(b.dataset.homeMonth)));
  }));
}
