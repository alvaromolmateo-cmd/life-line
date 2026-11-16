// Tareas: lo pendiente agrupado por fecha, la bandeja de entrada y el historial de lo ya hecho.

import { esc, icon, confirmDialog, plural, toast, multiline } from '../ui.js';
import { getState, addTask, addInbox, removeInbox, PRIORITIES, PRIORITY_LABEL } from '../store.js';
import { openTasks, doneTasks, categories, categoryOf, categoryPath, inCategory, isOverdue } from '../query.js';
import { taskRow, emptyState } from '../components.js';
import { todayKey, addDays, toKey, fmtMonth, fmtMoment, monthOf, weekStart } from '../dates.js';

const TABS = [['pendientes', 'Pendientes'], ['bandeja', 'Bandeja de entrada'], ['hechas', 'Hechas']];

const group = (title, tasks, cls = '') => (tasks.length ? `
  <section class="group">
    <p class="group-title ${cls}">${esc(title)} <span class="count">${tasks.length}</span></p>
    <div class="card list-card">${tasks.map((t) => taskRow(t)).join('')}</div>
  </section>` : '');

function applyFilter(tasks, f) {
  return tasks.filter((t) => inCategory(t.categoryId, f.category)
    && (!f.project || t.projectId === f.project)
    && (!f.priority || t.priority === f.priority));
}

function filtersBar(f) {
  const st = getState();
  const select = (key, label, pairs) => `
    <label class="filter">
      <span class="sr-only">${label}</span>
      <select data-filter="${key}" data-fk="filter-${key}" class="${f[key] ? 'on' : ''}">
        <option value="">${label}</option>
        ${pairs.map(([v, text]) => `<option value="${esc(v)}"${f[key] === v ? ' selected' : ''}>${esc(text)}</option>`).join('')}
      </select>
    </label>`;
  const active = f.category || f.project || f.priority;
  return `
    <div class="filters">
      ${select('category', 'Categoría', categories().map((c) => [c.id, categoryPath(c.id)]))}
      ${st.projects.length ? select('project', 'Proyecto', st.projects.map((p) => [p.id, p.title])) : ''}
      ${select('priority', 'Prioridad', PRIORITIES.slice().reverse().map((p) => [p, PRIORITY_LABEL[p]]))}
      ${active ? `<button class="btn btn-ghost btn-sm" data-clear-filters>${icon('x')}<span>Quitar filtros</span></button>` : ''}
    </div>`;
}

// ---------- Pendientes ----------
function pendingView(ctx) {
  const f = ctx.taskFilter;
  const all = openTasks();
  const tasks = applyFilter(all, f);
  const today = todayKey();
  const soon = addDays(today, 7);
  const late = tasks.filter(isOverdue);
  const forToday = tasks.filter((t) => t.due === today);
  const week = tasks.filter((t) => t.due > today && t.due <= soon);
  const later = tasks.filter((t) => t.due > soon);
  const undated = tasks.filter((t) => !t.due);

  const empty = !all.length
    ? emptyState('check-square', 'Nada pendiente', 'Escribe arriba tu primera tarea y pulsa Intro.')
    : emptyState('search', 'Ninguna tarea con esos filtros');

  return `
    <form class="capture" data-quick-task>
      ${icon('plus')}
      <input name="title" data-fk="quick-task" autocomplete="off" enterkeyhint="done" aria-label="Nueva tarea" placeholder="Nueva tarea">
      <button class="btn btn-primary btn-sm">Añadir</button>
    </form>
    ${all.length ? filtersBar(f) : ''}
    ${tasks.length ? `
      ${group('Atrasadas', late, 'late')}
      ${group('Hoy', forToday)}
      ${group('Próximos 7 días', week)}
      ${group('Más adelante', later)}
      ${group('Sin fecha', undated)}` : empty}`;
}

// ---------- Bandeja de entrada ----------
function inboxView() {
  const inbox = getState().inbox.slice().reverse();
  return `
    <form class="capture" data-capture>
      ${icon('inbox')}
      <input name="text" data-fk="capture" autocomplete="off" enterkeyhint="done" aria-label="Apunte rápido" placeholder="Apunta una idea o un pendiente y organízalo después">
      <button class="btn btn-primary btn-sm">Apuntar</button>
    </form>
    ${inbox.length ? `
      <div class="card list-card">
        ${inbox.map((n) => `
          <div class="inbox-item">
            <span class="inbox-text">${multiline(n.text)}<small>${esc(fmtMoment(n.createdAt))}</small></span>
            <button class="btn btn-sm btn-primary" data-act="organize" data-id="${n.id}">Organizar</button>
            <button class="icon-btn sm" data-remove-inbox="${n.id}" aria-label="Eliminar apunte">${icon('trash')}</button>
          </div>`).join('')}
      </div>`
    : emptyState('inbox', 'Bandeja vacía', 'Apunta aquí cualquier cosa sin decidir todavía dónde va. Después la conviertes en tarea, evento, proyecto o nota.')}`;
}

// ---------- Hechas ----------
function doneView(ctx) {
  const all = doneTasks();
  const tasks = applyFilter(all, ctx.taskFilter);
  if (!all.length) return emptyState('check', 'Aún sin tareas hechas', 'Lo que vayas completando queda guardado aquí, con su fecha.');

  const today = todayKey();
  const yesterday = addDays(today, -1);
  const monday = weekStart(today);
  const groups = new Map();
  for (const t of tasks) {
    const key = toKey(new Date(t.completedAt));
    const label = key === today ? 'Hoy' : key === yesterday ? 'Ayer' : key >= monday ? 'Esta semana' : fmtMonth(monthOf(key));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(t);
  }
  return `
    ${filtersBar(ctx.taskFilter)}
    ${tasks.length
    ? [...groups].map(([label, list]) => group(label, list)).join('')
    : emptyState('search', 'Ninguna tarea con esos filtros')}`;
}

// ---------- Vista ----------
export function render(ctx) {
  const tab = TABS.some(([t]) => t === ctx.param) ? ctx.param : 'pendientes';
  const st = getState();
  const counts = { pendientes: openTasks().length, bandeja: st.inbox.length, hechas: null };
  const late = st.tasks.filter(isOverdue).length;
  const sub = [
    plural(counts.pendientes, 'tarea pendiente', 'tareas pendientes'),
    late ? plural(late, 'atrasada', 'atrasadas') : '',
  ].filter(Boolean).join(' · ');
  return `
    <header class="page-head">
      <div>
        <h1>Tareas</h1>
        <p class="sub">${esc(sub)}</p>
      </div>
      <button class="btn btn-primary" data-act="new-task">${icon('plus')}<span>Nueva tarea</span></button>
    </header>
    <nav class="tabs" aria-label="Listas de tareas">
      ${TABS.map(([t, label]) => `
        <a class="tab ${t === tab ? 'active' : ''}" href="#/tareas${t === 'pendientes' ? '' : `/${t}`}"${t === tab ? ' aria-current="page"' : ''}>
          ${esc(label)}${counts[t] ? `<span class="count">${counts[t]}</span>` : ''}
        </a>`).join('')}
    </nav>
    ${tab === 'pendientes' ? pendingView(ctx) : tab === 'bandeja' ? inboxView() : doneView(ctx)}`;
}

export function mount(root, ctx) {
  // Una tarea nueva nace con los filtros de categoría y proyecto que estén puestos.
  root.querySelector('[data-quick-task]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.currentTarget.elements.title;
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    const f = ctx.taskFilter;
    addTask({ title, categoryId: f.category, projectId: f.project, priority: f.priority || (categoryOf(f.category)?.parentId ? categoryOf(f.category).priority : 'normal') });
  });

  root.querySelector('[data-capture]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.currentTarget.elements.text;
    const text = input.value;
    if (!text.trim()) return;
    input.value = '';
    addInbox(text);
  });

  root.querySelectorAll('[data-filter]').forEach((el) => el.addEventListener('change', () => {
    ctx.set('taskFilter', { ...ctx.taskFilter, [el.dataset.filter]: el.value });
  }));
  root.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    ctx.set('taskFilter', { category: '', project: '', priority: '' });
  });

  root.querySelectorAll('[data-remove-inbox]').forEach((b) => b.addEventListener('click', async () => {
    const note = getState().inbox.find((n) => n.id === b.dataset.removeInbox);
    if (!note) return;
    const ok = await confirmDialog({ title: 'Eliminar apunte', message: `Se eliminará «${esc(note.text.slice(0, 120))}».` });
    if (ok) { removeInbox(note.id); toast('Apunte eliminado'); }
  }));
}
