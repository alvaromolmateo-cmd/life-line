// Sprints: en qué se quiere avanzar durante una semana. Es una herramienta opcional: se elige un
// objetivo y unas tareas de la lista general o de los proyectos, se sigue cómo van y, al terminar,
// se cierra la semana con una revisión de lo conseguido y una reflexión.

import { esc, icon, openModal, modalHeader, openMenu, confirmDialog, multiline, plural, toast } from '../ui.js';
import {
  getState, addTask, updateTask, addSprint, updateSprint, removeSprint,
  addSprintTask, removeSprintTask, closeSprint, reopenSprint, carryWeek,
} from '../store.js';
import {
  sprints, sprintOf, sprintForWeek, sprintState, sprintTasks, sprintItems, sprintStats,
  SPRINT_STATE_LABEL, thisWeek, weekLabel, openTasks, taskOf, byDue, fold,
} from '../query.js';
import { taskRow, emptyState, progressBar, chip, dueChip, priorityChip } from '../components.js';
import { formModal, field, openTaskForm } from '../forms.js';
import {
  todayKey, toKey, addDays, diffDays, weekDays, isoWeek, isKey, weekStart,
  fmtWeekRange, fmtLong, fmtMoment, cap,
} from '../dates.js';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const stateBadge = (s) => {
  const state = sprintState(s);
  return `<span class="badge badge-${state}">${SPRINT_STATE_LABEL[state]}</span>`;
};

const countLabel = ({ done, total }) => (total ? `${done} de ${plural(total, 'tarea hecha', 'tareas hechas')}` : 'Sin tareas todavía');

// Semana que se está mirando: la de la ruta o, sin ella, la actual.
const weekOf = (param) => (isKey(param) ? weekStart(param) : thisWeek());

// ---------- Piezas ----------
function weekNav(week) {
  const label = weekLabel(week);
  const number = `Semana ${isoWeek(week)}`;
  return `
    <div class="week-nav">
      <a class="icon-btn" href="#/sprints/${addDays(week, -7)}" aria-label="Semana anterior">${icon('chevron-left')}</a>
      <a class="icon-btn" href="#/sprints/${addDays(week, 7)}" aria-label="Semana siguiente">${icon('chevron-right')}</a>
      <div class="week-titles">
        <b>${esc(fmtWeekRange(week))}</b>
        <small>${esc(label === number ? number : `${label} · ${number}`)}</small>
      </div>
      ${week !== thisWeek() ? '<a class="btn btn-sm" href="#/sprints">Esta semana</a>' : ''}
    </div>`;
}

// Los siete días de la semana, con las tareas del sprint que se terminaron cada día.
function weekStrip(s) {
  const today = todayKey();
  const perDay = new Map();
  for (const it of sprintItems(s)) {
    if (!it.done || !it.completedAt) continue;
    const key = toKey(new Date(it.completedAt));
    perDay.set(key, (perDay.get(key) || 0) + 1);
  }
  return `
    <div class="strip">
      ${weekDays(s.start).map((key, i) => {
    const n = perDay.get(key) || 0;
    const cls = [key === today ? 'today' : '', key > today ? 'future' : ''].join(' ');
    return `
        <button class="strip-day ${cls}" data-act="goto-day" data-date="${key}" aria-label="${esc(cap(fmtLong(key)))}${n ? ` – ${plural(n, 'tarea hecha', 'tareas hechas')}` : ''}">
          <small>${DOW[i]}</small>
          <b>${Number(key.slice(8))}</b>
          <i class="strip-mark ${n ? 'on' : ''}">${n ? `${icon('check')}${n > 1 ? n : ''}` : ''}</i>
        </button>`;
  }).join('')}
    </div>`;
}

function progressBlock(s) {
  const stats = sprintStats(s);
  return `
    <div class="sprint-progress">
      <span class="muted">${esc(countLabel(stats))}</span>
      ${stats.total ? progressBar(stats.done, stats.total) : ''}
    </div>`;
}

const moreButton = (attr, label) => `<button class="icon-btn sm" ${attr} aria-haspopup="menu" aria-expanded="false" aria-label="${label}">${icon('more')}</button>`;

// ---------- Semana sin sprint ----------
function planView(week) {
  if (week < thisWeek()) return emptyState('sprint', 'Semana sin sprint', 'Los sprints que hayas hecho están en el historial.');
  const current = week === thisWeek();
  return `
    <section class="card sprint-plan">
      <div class="empty-icon">${icon('sprint')}</div>
      <h2 class="sprint-plan-title">${current ? 'Planifica esta semana' : `Planifica la semana del ${esc(fmtWeekRange(week))}`}</h2>
      <p class="muted">Elige un objetivo y las tareas en las que quieres avanzar. Lo demás sigue en su sitio.</p>
      <form class="sprint-plan-form" data-start-sprint>
        <label class="field">
          <span class="field-label">Objetivo de la semana</span>
          <textarea name="goal" rows="2" data-fk="sprint-new-goal" placeholder="Qué te gustaría conseguir estos días"></textarea>
        </label>
        <button class="btn btn-primary">${icon('sprint')}<span>Empezar sprint</span></button>
      </form>
    </section>`;
}

// ---------- Sprint abierto ----------
function openView(s) {
  const state = sprintState(s);
  const today = todayKey();
  const tasks = sprintTasks(s);
  const pending = tasks.filter((t) => t.status === 'pending').sort(byDue);
  const doing = tasks.filter((t) => t.status === 'doing').sort(byDue);
  const done = tasks.filter((t) => t.status === 'done').sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  const days = diffDays(s.start, today);
  const when = state === 'active' ? `Día ${diffDays(today, s.start) + 1} de 7`
    : state === 'planned' ? `Empieza ${days === 1 ? 'mañana' : `en ${days} días`}`
      : '';
  const newTask = state === 'active' ? 'Nueva tarea para esta semana' : 'Nueva tarea para el sprint';

  const row = (t) => taskRow(t, { sprint: false, status: false, category: false, after: moreButton(`data-task-menu="${t.id}"`, 'Opciones de la tarea') });
  const column = (title, list, hint) => `
    <section class="board-col">
      <p class="group-title">${title} <span class="count">${list.length}</span></p>
      <div class="card list-card">${list.length ? list.map(row).join('') : `<p class="board-empty">${hint}</p>`}</div>
    </section>`;

  return `
    <section class="card sprint-card">
      <div class="sprint-top">
        ${stateBadge(s)}
        ${when ? `<span class="muted small">${esc(when)}</span>` : ''}
        <span class="spacer"></span>
        ${state !== 'planned' ? `<button class="btn btn-sm ${state === 'review' ? 'btn-primary' : ''}" data-close-sprint>${icon('check')}<span>Cerrar sprint</span></button>` : ''}
        ${moreButton('data-sprint-menu', 'Opciones del sprint')}
      </div>
      ${state === 'review' ? '<p class="notice">Esta semana ya pasó. Ciérrala cuando te venga bien para dejar anotado cómo fue.</p>' : ''}
      <label class="field">
        <span class="field-label">Objetivo de la semana</span>
        <textarea rows="2" data-goal data-fk="sprint-goal" placeholder="Qué te gustaría conseguir estos días">${esc(s.goal)}</textarea>
      </label>
      ${progressBlock(s)}
      ${weekStrip(s)}
    </section>

    <div class="sprint-add">
      <form class="capture" data-sprint-task>
        ${icon('plus')}
        <input name="title" data-fk="sprint-task" autocomplete="off" enterkeyhint="done" aria-label="${newTask}" placeholder="${newTask}">
        <button class="btn btn-primary btn-sm">Añadir</button>
      </form>
      <button class="btn" data-pick>${icon('check-square')}<span>Elegir de mis tareas</span></button>
    </div>

    ${tasks.length ? `
      <div class="board">
        ${column('Pendientes', pending, 'Lo que queda por empezar')}
        ${column('En curso', doing, 'Lo que tengas entre manos')}
        ${column('Hechas', done, 'Lo que vayas terminando')}
      </div>`
    : emptyState('check-square', 'Semana por llenar', 'Añade las tareas en las que quieres avanzar. Puedes elegirlas de tu lista general o de tus proyectos, o escribir una nueva.')}`;
}

// ---------- Sprint cerrado ----------
// Se pinta con lo que quedó guardado al cerrarlo; si la tarea sigue existiendo, se puede abrir.
function closedView(s) {
  const done = s.result.filter((r) => r.done);
  const open = s.result.filter((r) => !r.done);
  const item = (r) => `
    <div class="task ${r.done ? 'done' : ''}">
      <span class="check static ${r.done ? 'on' : ''}" aria-hidden="true">${icon('check')}</span>
      ${taskOf(r.id)
    ? `<button class="task-main" data-act="open-task" data-id="${r.id}"><span class="task-title">${esc(r.title)}</span></button>`
    : `<span class="task-main"><span class="task-title">${esc(r.title)}</span></span>`}
    </div>`;
  const text = (title, ic, value, hint) => `
    <section class="card">
      <header class="card-head"><h2 class="card-title">${icon(ic)}<span>${title}</span></h2></header>
      ${value.trim() ? `<p class="sprint-text">${multiline(value.trim())}</p>` : `<p class="day-empty">${hint}</p>`}
    </section>`;

  return `
    <section class="card sprint-card">
      <div class="sprint-top">
        ${stateBadge(s)}
        <span class="muted small">${esc(fmtMoment(s.closedAt))}</span>
        <span class="spacer"></span>
        <button class="btn btn-sm" data-edit-review>${icon('edit')}<span>Editar revisión</span></button>
        ${moreButton('data-sprint-menu', 'Opciones del sprint')}
      </div>
      ${s.goal.trim() ? `<div class="goal">${icon('target')}<div><p class="field-label">Objetivo de la semana</p><p>${multiline(s.goal.trim())}</p></div></div>` : ''}
      ${progressBlock(s)}
      ${weekStrip(s)}
    </section>

    <div class="sprint-layout">
      <div class="sprint-side">
        ${text('Revisión', 'check-square', s.review, 'Qué conseguiste esa semana.')}
        ${text('Reflexión', 'bulb', s.reflection, 'Cómo fue la semana y qué harías distinto.')}
      </div>
      <section class="card">
        <header class="card-head"><h2 class="card-title">${icon('sprint')}<span>Tareas de la semana</span></h2></header>
        ${s.result.length ? '' : '<p class="day-empty">Este sprint se cerró sin tareas.</p>'}
        ${done.length ? `<p class="group-title">Hechas <span class="count">${done.length}</span></p><div class="list">${done.map(item).join('')}</div>` : ''}
        ${open.length ? `<p class="group-title">Quedaron abiertas <span class="count">${open.length}</span></p><div class="list">${open.map(item).join('')}</div>` : ''}
      </section>
    </div>`;
}

// ---------- Historial ----------
function sprintCard(s) {
  const stats = sprintStats(s);
  return `
    <a class="card proj-card" href="#/sprints/${s.start}">
      <span class="proj-card-top">
        <span class="proj-icon" style="--c:var(--c-indigo)">${icon('sprint')}</span>
        ${stateBadge(s)}
      </span>
      <span class="proj-title">${esc(fmtWeekRange(s.start))}</span>
      ${s.goal.trim() ? `<span class="proj-text">${esc(s.goal.trim())}</span>` : ''}
      <span class="proj-progress">
        <span class="proj-count"><span>${esc(countLabel(stats))}</span><span>Semana ${isoWeek(s.start)}</span></span>
        ${progressBar(stats.done, stats.total)}
      </span>
    </a>`;
}

function historyView() {
  const list = sprints();
  return list.length
    ? `<div class="proj-grid">${list.map(sprintCard).join('')}</div>`
    : emptyState('sprint', 'Aún sin sprints', 'Cada semana que planifiques queda guardada aquí, con su objetivo, sus tareas y tu revisión.');
}

// ---------- Elegir tareas ----------
// Lo pendiente, agrupado en la lista general y en cada proyecto. Marcar una tarea la mete en el sprint.
function openPicker(sprintId) {
  let filter = '';
  let last = '';
  openModal({
    live: true,
    render: () => {
      const s = sprintOf(sprintId);
      const chosen = new Set(s ? s.taskIds : []);
      const tasks = s ? openTasks() : [];
      const groups = [['Lista general', tasks.filter((t) => !t.projectId)]];
      for (const p of getState().projects) groups.push([p.title, tasks.filter((t) => t.projectId === p.id)]);
      const row = (t) => `
        <label class="pick" data-text="${esc(fold(t.title))}">
          <input type="checkbox" data-pick-task="${t.id}"${chosen.has(t.id) ? ' checked' : ''}>
          <span class="check" aria-hidden="true">${icon('check')}</span>
          <span class="pick-body">
            <span class="task-title">${esc(t.title)}</span>
            <span class="task-meta">${t.status === 'doing' ? chip('En curso', { cls: 'chip-doing' }) : ''}${dueChip(t)}${priorityChip(t.priority)}</span>
          </span>
        </label>`;
      const count = tasks.filter((t) => chosen.has(t.id)).length;
      return `
        ${modalHeader('Elegir tareas', s ? esc(`Sprint del ${fmtWeekRange(s.start)}`) : '')}
        <div class="modal-body">
          ${tasks.length > 7 ? '<input type="search" data-pick-filter autocomplete="off" placeholder="Filtrar tareas" aria-label="Filtrar tareas">' : ''}
          ${tasks.length ? groups.filter(([, list]) => list.length).map(([title, list]) => `
            <div class="pick-group">
              <p class="group-title">${esc(title)} <span class="count">${list.length}</span></p>
              <div class="list">${list.map(row).join('')}</div>
            </div>`).join('')
    : emptyState('check', 'Todo al día', 'Las tareas pendientes que tengas aparecerán aquí para elegirlas.')}
          <p class="search-hint" data-pick-none hidden>Ninguna tarea coincide.</p>
        </div>
        <div class="modal-foot">
          <span class="muted small">${count ? plural(count, 'elegida', 'elegidas') : ''}</span>
          <span class="spacer"></span>
          <button class="btn btn-primary" data-modal-close>Listo</button>
        </div>`;
    },
    mount: (panel) => {
      const input = panel.querySelector('[data-pick-filter]');
      const apply = () => {
        const words = fold(filter).split(/\s+/).filter(Boolean);
        let shown = 0;
        panel.querySelectorAll('.pick-group').forEach((group) => {
          let any = false;
          group.querySelectorAll('.pick').forEach((el) => {
            const ok = words.every((w) => el.dataset.text.includes(w));
            el.hidden = !ok;
            if (ok) { any = true; shown += 1; }
          });
          group.hidden = !any;
        });
        const none = panel.querySelector('[data-pick-none]');
        if (none) none.hidden = shown > 0 || !words.length;
      };
      if (input) {
        input.value = filter;
        input.addEventListener('input', () => { filter = input.value; apply(); });
        apply();
      }
      panel.querySelectorAll('[data-pick-task]').forEach((el) => el.addEventListener('change', () => {
        last = el.dataset.pickTask;
        if (el.checked) addSprintTask(sprintId, last); else removeSprintTask(sprintId, last);
      }));
      // Al repintarse tras marcar una tarea, el foco vuelve a su casilla.
      if (last) panel.querySelector(`[data-pick-task="${last}"]`)?.focus({ preventScroll: true });
    },
  });
}

// ---------- Cerrar y revisar ----------
const reviewFields = (s) => `
  ${field('Revisión', `<textarea name="review" rows="3" autofocus placeholder="Qué has conseguido esta semana">${esc(s.review)}</textarea>`)}
  ${field('Reflexión', `<textarea name="reflection" rows="3" placeholder="Cómo ha ido la semana y qué harías distinto">${esc(s.reflection)}</textarea>`)}`;

function openCloseForm(sprintId) {
  const s = sprintOf(sprintId);
  if (!s || s.closedAt) return;
  const stats = sprintStats(s);
  const open = stats.total - stats.done;
  const target = carryWeek(s.start);
  formModal({
    title: 'Cerrar sprint',
    sub: esc(fmtWeekRange(s.start)),
    saveText: 'Cerrar sprint',
    body: `
      ${stats.total ? `<p class="muted">Has hecho ${stats.done} de ${plural(stats.total, 'tarea', 'tareas')}.${open ? ' Las que siguen abiertas se quedan en tu lista.' : ''}</p>` : ''}
      ${reviewFields(s)}
      ${open ? `
        <label class="switch">
          <input type="checkbox" name="carry">
          <span class="switch-track" aria-hidden="true"></span>
          <span>Pasar ${open === 1 ? 'la tarea abierta' : `las ${open} tareas abiertas`} al sprint del ${esc(fmtWeekRange(target))}</span>
        </label>` : ''}`,
    onSave: (data) => {
      const carried = closeSprint(s.id, { review: data.review, reflection: data.reflection, carry: data.carry === 'on' });
      toast(carried ? `Sprint cerrado. Las tareas abiertas pasan al del ${fmtWeekRange(carried)}` : 'Sprint cerrado', carried ? 4000 : undefined);
    },
  });
}

function openReviewForm(sprintId) {
  const s = sprintOf(sprintId);
  if (!s) return;
  formModal({
    title: 'Revisión del sprint',
    sub: esc(fmtWeekRange(s.start)),
    body: reviewFields(s),
    onSave: (data) => updateSprint(s.id, { review: data.review.trim(), reflection: data.reflection.trim() }),
  });
}

// ---------- Vista ----------
export function render(ctx) {
  const history = ctx.param === 'historial';
  const week = weekOf(ctx.param);
  const s = sprintForWeek(week);
  const total = getState().sprints.length;
  // Un sprint de una semana ya pasada que sigue sin cerrar se recuerda desde la semana actual.
  const pending = !history && week === thisWeek()
    ? sprints().find((x) => sprintState(x) === 'review')
    : null;

  return `
    <header class="page-head">
      <div>
        <h1>Sprints</h1>
        <p class="sub">Elige en qué quieres avanzar cada semana.</p>
      </div>
    </header>
    <nav class="tabs" aria-label="Sprints">
      <a class="tab ${history ? '' : 'active'}" href="#/sprints"${history ? '' : ' aria-current="page"'}>Semana</a>
      <a class="tab ${history ? 'active' : ''}" href="#/sprints/historial"${history ? ' aria-current="page"' : ''}>Historial${total ? `<span class="count">${total}</span>` : ''}</a>
    </nav>
    ${history ? historyView() : `
      ${weekNav(week)}
      ${pending ? `<a class="notice notice-link" href="#/sprints/${pending.start}"><span>El sprint del ${esc(fmtWeekRange(pending.start))} sigue abierto. Puedes cerrarlo con su revisión.</span>${icon('arrow-right')}</a>` : ''}
      ${!s ? planView(week) : s.closedAt ? closedView(s) : openView(s)}`}`;
}

export function mount(root, ctx) {
  if (ctx.param === 'historial') return;
  const week = weekOf(ctx.param);
  const s = sprintForWeek(week);

  root.querySelector('[data-start-sprint]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = addSprint({ start: week, goal: e.currentTarget.elements.goal.value });
    // Con tareas pendientes, el siguiente paso es elegir cuáles entran en la semana.
    if (id && openTasks().length) openPicker(id);
  });
  // Ctrl + Intro empieza el sprint sin soltar el teclado.
  root.querySelector('[data-start-sprint] textarea')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.target.form.requestSubmit();
    }
  });
  if (!s) return;

  // El objetivo se guarda mientras se escribe, sin repintar la pantalla.
  root.querySelector('[data-goal]')?.addEventListener('input', (e) => updateSprint(s.id, { goal: e.target.value }, { silent: true }));

  root.querySelector('[data-sprint-task]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.currentTarget.elements.title;
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    addSprintTask(s.id, addTask({ title }));
  });

  root.querySelector('[data-pick]')?.addEventListener('click', () => openPicker(s.id));
  root.querySelector('[data-close-sprint]')?.addEventListener('click', () => openCloseForm(s.id));
  root.querySelector('[data-edit-review]')?.addEventListener('click', () => openReviewForm(s.id));

  root.querySelector('[data-sprint-menu]')?.addEventListener('click', (e) => {
    openMenu(e.currentTarget, [
      ...(s.closedAt ? [{
        label: 'Reabrir sprint', hint: 'Vuelve a estar abierto, con sus tareas', icon: 'sprint', color: 'indigo',
        onClick: () => { reopenSprint(s.id); toast('Sprint reabierto'); },
      }] : []),
      {
        label: 'Eliminar sprint', hint: 'Sus tareas siguen en tu lista', icon: 'trash', color: 'coral',
        onClick: async () => {
          const ok = await confirmDialog({
            title: 'Eliminar sprint',
            message: `Se eliminará el sprint del ${esc(fmtWeekRange(s.start))} con su objetivo y su revisión. Sus tareas se conservan.`,
          });
          if (ok) { removeSprint(s.id); toast('Sprint eliminado'); }
        },
      },
    ]);
  });

  root.querySelectorAll('[data-task-menu]').forEach((b) => b.addEventListener('click', () => {
    const task = taskOf(b.dataset.taskMenu);
    if (!task) return;
    openMenu(b, [
      ...(task.status === 'pending' ? [{ label: 'Empezar', hint: 'Pasa a en curso', icon: 'arrow-right', color: 'green', onClick: () => updateTask(task.id, { status: 'doing' }) }] : []),
      ...(task.status === 'doing' ? [{ label: 'Volver a pendientes', hint: 'Lo retomas más adelante', icon: 'arrow-left', color: 'slate', onClick: () => updateTask(task.id, { status: 'pending' }) }] : []),
      { label: 'Abrir tarea', hint: 'Fecha, prioridad, proyecto y notas', icon: 'edit', color: 'blue', onClick: () => openTaskForm({ id: task.id }) },
      { label: 'Quitar del sprint', hint: 'La tarea sigue en tu lista', icon: 'x', color: 'coral', onClick: () => removeSprintTask(s.id, task.id) },
    ]);
  }));
}
