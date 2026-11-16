// Estado de la aplicación y persistencia en localStorage.
// Capa aislada para poder cambiar el almacenamiento más adelante, por ejemplo por sincronización entre dispositivos.
//
// Cada cosa se guarda una sola vez y se relaciona por identificador: una tarea apunta a su proyecto
// y a su categoría, y el calendario la muestra por su fecha límite. No hay copias de la misma información.

import { uid } from './ui.js';
import { isKey, isTime, weekStart, todayKey, addDays, fmtWeekRange } from './dates.js';

const STORAGE_KEY = 'lifeline:data';
export const DATA_VERSION = 2;

export const TASK_STATUSES = ['pending', 'doing', 'done'];
export const TASK_STATUS_LABEL = { pending: 'Pendiente', doing: 'En curso', done: 'Hecha' };

export const PRIORITIES = ['low', 'normal', 'high'];
export const PRIORITY_LABEL = { low: 'Baja', normal: 'Normal', high: 'Alta' };

export const PROJECT_STATUSES = ['active', 'paused', 'done'];
export const PROJECT_STATUS_LABEL = { active: 'Activo', paused: 'En pausa', done: 'Terminado' };

export const EVENT_TYPES = ['event', 'appointment', 'exam', 'delivery', 'date'];
export const EVENT_TYPE_LABEL = { event: 'Evento', appointment: 'Cita', exam: 'Examen', delivery: 'Entrega', date: 'Fecha importante' };
export const EVENT_TYPE_COLOR = { event: 'indigo', appointment: 'teal', exam: 'coral', delivery: 'amber', date: 'pink' };

export const ENTRY_KINDS = ['note', 'idea', 'progress'];
export const ENTRY_KIND_LABEL = { note: 'Nota', idea: 'Idea', progress: 'Avance' };

export const COLORS = ['indigo', 'blue', 'teal', 'green', 'amber', 'coral', 'pink', 'violet', 'slate'];
export const COLOR_LABEL = {
  indigo: 'Índigo', blue: 'Azul', teal: 'Turquesa', green: 'Verde', amber: 'Ámbar', coral: 'Coral', pink: 'Rosa', violet: 'Violeta', slate: 'Gris',
};

// Bloques de la pantalla de inicio. El orden y cuáles se ven lo decide cada persona.
export const WIDGETS = ['hoy', 'calendario', 'sprint', 'tareas', 'eventos', 'proyectos', 'bandeja', 'actividad'];
export const WIDGET_LABEL = {
  hoy: 'Tu día',
  calendario: 'Calendario',
  sprint: 'Sprint de la semana',
  tareas: 'Tareas pendientes',
  eventos: 'Próximos eventos',
  proyectos: 'Proyectos activos',
  bandeja: 'Bandeja de entrada',
  actividad: 'Actividad reciente',
};

const DEFAULT_CATEGORIES = [
  ['estudios', 'Estudios', 'blue'],
  ['proyectos', 'Proyectos personales', 'indigo'],
  ['organizacion', 'Organización personal', 'teal'],
  ['desarrollo', 'Desarrollo personal', 'violet'],
  ['entrenamiento', 'Entrenamiento', 'coral'],
  ['cotidiana', 'Vida cotidiana', 'amber'],
];

export const DEFAULT_SETTINGS = {
  name: '',
  theme: 'auto',
  calendarMode: 'month',
};

const defaultDashboard = () => WIDGETS.map((id) => ({ id, on: true }));

export function defaultState() {
  return {
    version: DATA_VERSION,
    createdAt: new Date().toISOString(),
    categories: DEFAULT_CATEGORIES.map(([id, name, color], order) => ({ id, name, color, order })),
    inbox: [],
    tasks: [],
    projects: [],
    events: [],
    sprints: [],
    dayNotes: {},
    activity: [],
    settings: { ...DEFAULT_SETTINGS, dashboard: defaultDashboard() },
  };
}

// ---------- Limpieza de valores ----------
// Las mismas funciones dan forma a lo que se crea, a lo que se edita y a lo que se carga o importa.
const now = () => new Date().toISOString();
const str = (v) => (v == null ? '' : String(v));
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const cleanKey = (v) => (isKey(v) ? v : '');
const cleanTime = (v) => (isTime(v) ? v : '');
const cleanIso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '');
const cleanTags = (v) => {
  const list = Array.isArray(v) ? v : str(v).split(',');
  return [...new Set(list.map((t) => str(t).trim().replace(/^#+/, '')).filter(Boolean))];
};

const refsOf = (st) => ({
  cats: new Set(st.categories.map((c) => c.id)),
  projects: new Set(st.projects.map((p) => p.id)),
});

function normCategory(c, i) {
  return {
    ...c,
    id: str(c.id) || uid(),
    name: str(c.name).trim() || 'Categoría',
    color: oneOf(c.color, COLORS, 'indigo'),
    order: Number.isFinite(c.order) ? c.order : i,
  };
}

function normInbox(n) {
  return { ...n, id: str(n.id) || uid(), text: str(n.text).trim(), createdAt: cleanIso(n.createdAt) || now() };
}

function normEntry(e) {
  return {
    ...e,
    id: str(e.id) || uid(),
    kind: oneOf(e.kind, ENTRY_KINDS, 'note'),
    text: str(e.text).trim(),
    at: cleanIso(e.at) || now(),
  };
}

function normProject(p, refs) {
  const status = oneOf(p.status, PROJECT_STATUSES, 'active');
  return {
    ...p,
    id: str(p.id) || uid(),
    title: str(p.title).trim() || 'Proyecto',
    description: str(p.description),
    goal: str(p.goal),
    status,
    priority: oneOf(p.priority, PRIORITIES, 'normal'),
    categoryId: refs.cats.has(p.categoryId) ? p.categoryId : '',
    start: cleanKey(p.start),
    end: cleanKey(p.end),
    tags: cleanTags(p.tags),
    entries: (Array.isArray(p.entries) ? p.entries : []).map(normEntry).filter((e) => e.text),
    createdAt: cleanIso(p.createdAt) || now(),
    completedAt: status === 'done' ? (cleanIso(p.completedAt) || now()) : '',
  };
}

function normTask(t, refs) {
  const status = oneOf(t.status, TASK_STATUSES, 'pending');
  return {
    ...t,
    id: str(t.id) || uid(),
    title: str(t.title).trim() || 'Tarea',
    notes: str(t.notes),
    status,
    priority: oneOf(t.priority, PRIORITIES, 'normal'),
    categoryId: refs.cats.has(t.categoryId) ? t.categoryId : '',
    projectId: refs.projects.has(t.projectId) ? t.projectId : '',
    due: cleanKey(t.due),
    tags: cleanTags(t.tags),
    createdAt: cleanIso(t.createdAt) || now(),
    completedAt: status === 'done' ? (cleanIso(t.completedAt) || now()) : '',
  };
}

function normEvent(e, refs) {
  const start = cleanTime(e.start);
  const end = start ? cleanTime(e.end) : '';
  return {
    ...e,
    id: str(e.id) || uid(),
    title: str(e.title).trim() || 'Evento',
    type: oneOf(e.type, EVENT_TYPES, 'event'),
    date: cleanKey(e.date),
    start,
    end: end && end > start ? end : '',
    place: str(e.place).trim(),
    notes: str(e.notes),
    categoryId: refs.cats.has(e.categoryId) ? e.categoryId : '',
    projectId: refs.projects.has(e.projectId) ? e.projectId : '',
    createdAt: cleanIso(e.createdAt) || now(),
  };
}

// Lo que quedó de cada tarea al cerrar el sprint. Guarda el título tal como era, para que el
// historial se siga entendiendo aunque la tarea cambie o se borre después.
function normResult(r) {
  const done = r.done === true;
  return { ...r, id: str(r.id), title: str(r.title).trim() || 'Tarea', done, completedAt: done ? cleanIso(r.completedAt) : '' };
}

// Un sprint es una semana, de lunes a domingo: `start` es siempre su lunes.
function normSprint(s) {
  const start = cleanKey(s.start);
  const closedAt = cleanIso(s.closedAt);
  return {
    ...s,
    id: str(s.id) || uid(),
    start: start ? weekStart(start) : '',
    goal: str(s.goal),
    taskIds: [...new Set((Array.isArray(s.taskIds) ? s.taskIds : []).map(str).filter(Boolean))],
    review: str(s.review),
    reflection: str(s.reflection),
    result: closedAt ? (Array.isArray(s.result) ? s.result : []).filter(Boolean).map(normResult) : [],
    createdAt: cleanIso(s.createdAt) || now(),
    closedAt,
  };
}

function normDashboard(list) {
  const seen = new Set();
  const out = [];
  for (const w of Array.isArray(list) ? list : []) {
    if (!w || !WIDGETS.includes(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    out.push({ id: w.id, on: w.on !== false });
  }
  // Los bloques que lleguen con versiones nuevas se añaden al final, visibles.
  for (const id of WIDGETS) if (!seen.has(id)) out.push({ id, on: true });
  return out;
}

// Adapta datos guardados o importados a la estructura actual, conservando lo que no conoce.
function migrate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato no válido');
  const from = Number(data.version) || 1;
  const out = { ...defaultState(), ...data };
  out.version = DATA_VERSION;

  out.categories = Array.isArray(data.categories) ? data.categories.filter(Boolean).map(normCategory) : out.categories;
  out.projects = [];
  let refs = refsOf(out);
  out.projects = (Array.isArray(data.projects) ? data.projects : []).filter(Boolean).map((p) => normProject(p, refs));
  refs = refsOf(out);

  out.inbox = (Array.isArray(data.inbox) ? data.inbox : []).filter(Boolean).map(normInbox).filter((n) => n.text);
  out.tasks = (Array.isArray(data.tasks) ? data.tasks : []).filter(Boolean).map((t) => normTask(t, refs));
  out.events = (Array.isArray(data.events) ? data.events : []).filter(Boolean).map((e) => normEvent(e, refs)).filter((e) => e.date);

  out.sprints = (Array.isArray(data.sprints) ? data.sprints : []).filter(Boolean).map(normSprint).filter((s) => s.start);

  const notes = data.dayNotes && typeof data.dayNotes === 'object' ? data.dayNotes : {};
  out.dayNotes = Object.fromEntries(Object.entries(notes).filter(([k, v]) => isKey(k) && str(v).trim()).map(([k, v]) => [k, str(v)]));

  out.activity = (Array.isArray(data.activity) ? data.activity : []).filter((a) => a && cleanIso(a.at));
  out.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  out.settings.name = str(out.settings.name);
  out.settings.theme = oneOf(out.settings.theme, ['auto', 'light', 'dark'], 'auto');
  out.settings.calendarMode = oneOf(out.settings.calendarMode, ['month', 'week', 'day'], 'month');
  // Versión 2 – Llegan los sprints. Su bloque de Inicio se coloca tras el calendario en vez de al final.
  if (from < 2 && Array.isArray(out.settings.dashboard) && !out.settings.dashboard.some((w) => w?.id === 'sprint')) {
    const list = out.settings.dashboard.slice();
    const at = Math.max(list.findIndex((w) => w?.id === 'calendario'), list.findIndex((w) => w?.id === 'hoy'));
    list.splice(at + 1, 0, { id: 'sprint', on: true });
    out.settings.dashboard = list;
  }
  out.settings.dashboard = normDashboard(out.settings.dashboard);
  delete out.exportedAt;
  return out;
}

// ---------- Carga y guardado ----------
// Red de seguridad: lo guardado no se pisa sin dejar copia.
// - Si los datos vienen de otra versión de la app, antes de adaptarlos se guarda una copia tal cual
//   (`:copia`), por si la actualización trajera algún fallo. Importar un archivo también deja copia
//   de lo que había.
// - Si no se pueden leer, se apartan en `:rescate` y la app arranca en blanco; ahí se quedan hasta
//   que se descarguen o se descarten desde Ajustes. Si ni siquiera se pueden apartar, no se guarda
//   nada para no pisarlos.
const BACKUP_KEY = `${STORAGE_KEY}:copia`;
const RESCUE_KEY = `${STORAGE_KEY}:rescate`;
let readOnly = false;
export let rescuedOnLoad = false;

const stamp = (raw, version) => ({ savedAt: now(), version, raw });

function readRescues() {
  try {
    const list = JSON.parse(localStorage.getItem(RESCUE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('No se pudo leer el almacenamiento', e);
    return defaultState();
  }
  if (!raw) return defaultState();

  let version = null;
  try {
    const data = JSON.parse(raw);
    version = Number(data?.version) || 1;
    if (version !== DATA_VERSION) {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(stamp(raw, version)));
      } catch (e) {
        console.warn('No se pudo guardar la copia previa a la actualización', e);
      }
    }
    return migrate(data);
  } catch (e) {
    console.warn('No se pudieron leer los datos guardados; se apartan sin tocarlos', e);
    try {
      const rescues = readRescues();
      // Si ya estaban apartados (se ha recargado sin tocar nada), no se duplican.
      if (!rescues.some((r) => r.raw === raw)) {
        localStorage.setItem(RESCUE_KEY, JSON.stringify([...rescues, stamp(raw, version)]));
      }
      rescuedOnLoad = true;
    } catch {
      readOnly = true;
    }
    return defaultState();
  }
}

// Pide al navegador que no borre estos datos cuando ande justo de espacio (Safari, sobre todo).
try { navigator.storage?.persist?.()?.catch?.(() => {}); } catch { /* sin soporte */ }

// Copias que guarda la red de seguridad, para descargarlas o descartarlas desde Ajustes.
export function safetyCopies() {
  let backup = null;
  try { backup = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); } catch { /* ilegible */ }
  return { backup, rescues: readRescues(), readOnly };
}

export function discardSafetyCopy(kind) {
  try { localStorage.removeItem(kind === 'rescue' ? RESCUE_KEY : BACKUP_KEY); } catch { /* sin acceso */ }
}

let state = load();
const listeners = new Set();
let saveError = false;

function save() {
  if (readOnly) { saveError = true; return; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveError = false;
  } catch (e) {
    saveError = true;
    console.error('No se pudo guardar', e);
  }
}

function emit() {
  for (const fn of listeners) fn(state);
}

export const getState = () => state;
export const hasSaveError = () => saveError;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Aplica una mutación, guarda y notifica (salvo silent).
export function update(mutator, { silent = false } = {}) {
  mutator(state);
  save();
  if (!silent) emit();
}

// ---------- Historial ----------
// Cada cosa relevante que pasa deja un apunte con su momento. Guarda el título tal como era,
// para que el historial se siga entendiendo aunque el elemento se borre después.
function log(st, action, kind, item, extra = {}) {
  st.activity.push({
    id: uid(),
    at: now(),
    action,
    kind,
    refId: item.id,
    title: str(item.title ?? item.text).slice(0, 140),
    projectId: kind === 'project' ? item.id : (item.projectId || ''),
    ...extra,
  });
}

// ---------- Bandeja de entrada ----------
export function addInbox(text) {
  const t = str(text).trim();
  if (!t) return null;
  const item = normInbox({ text: t });
  update((st) => { st.inbox.push(item); });
  return item.id;
}

export function removeInbox(id) {
  update((st) => { st.inbox = st.inbox.filter((n) => n.id !== id); });
}

// ---------- Tareas ----------
export function addTask(data) {
  let id = null;
  update((st) => {
    const task = normTask({ ...data, id: uid(), createdAt: now() }, refsOf(st));
    id = task.id;
    st.tasks.push(task);
    log(st, 'created', 'task', task);
    if (task.status === 'done') log(st, 'completed', 'task', task);
  });
  return id;
}

export function updateTask(id, patch) {
  update((st) => {
    const task = st.tasks.find((t) => t.id === id);
    if (!task) return;
    const wasDone = task.status === 'done';
    const next = normTask({ ...task, ...patch, completedAt: task.completedAt }, refsOf(st));
    if (!wasDone && next.status === 'done') next.completedAt = now();
    Object.assign(task, next);
    if (!wasDone && task.status === 'done') log(st, 'completed', 'task', task);
    if (wasDone && task.status !== 'done') log(st, 'reopened', 'task', task);
  });
}

export function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (task) updateTask(id, { status: task.status === 'done' ? 'pending' : 'done' });
}

export function removeTask(id) {
  update((st) => {
    const task = st.tasks.find((t) => t.id === id);
    if (!task) return;
    st.tasks = st.tasks.filter((t) => t.id !== id);
    // Los sprints cerrados conservan su resumen; de los abiertos sale sin más.
    for (const s of st.sprints) if (!s.closedAt) s.taskIds = s.taskIds.filter((x) => x !== id);
    log(st, 'deleted', 'task', task);
  });
}

// ---------- Proyectos ----------
export function addProject(data) {
  let id = null;
  update((st) => {
    const project = normProject({ ...data, id: uid(), entries: [], createdAt: now() }, refsOf(st));
    id = project.id;
    st.projects.push(project);
    log(st, 'created', 'project', project);
  });
  return id;
}

export function updateProject(id, patch) {
  update((st) => {
    const project = st.projects.find((p) => p.id === id);
    if (!project) return;
    const before = project.status;
    const next = normProject({ ...project, ...patch, completedAt: project.completedAt }, refsOf(st));
    if (before !== 'done' && next.status === 'done') next.completedAt = now();
    Object.assign(project, next);
    if (before !== project.status) log(st, 'status', 'project', project, { to: project.status });
  });
}

// Al borrar un proyecto, sus tareas y eventos se conservan sin proyecto.
export function removeProject(id) {
  update((st) => {
    const project = st.projects.find((p) => p.id === id);
    if (!project) return;
    st.projects = st.projects.filter((p) => p.id !== id);
    for (const t of st.tasks) if (t.projectId === id) t.projectId = '';
    for (const e of st.events) if (e.projectId === id) e.projectId = '';
    log(st, 'deleted', 'project', project);
  });
}

export function addProjectEntry(projectId, { kind, text }) {
  const entry = normEntry({ kind, text });
  if (!entry.text) return;
  update((st) => {
    const project = st.projects.find((p) => p.id === projectId);
    if (!project) return;
    project.entries.push(entry);
    log(st, 'created', 'entry', { id: entry.id, title: entry.text, projectId }, { entryKind: entry.kind });
  });
}

export function removeProjectEntry(projectId, entryId) {
  update((st) => {
    const project = st.projects.find((p) => p.id === projectId);
    if (project) project.entries = project.entries.filter((e) => e.id !== entryId);
  });
}

// ---------- Eventos ----------
export function addEvent(data) {
  let id = null;
  update((st) => {
    const event = normEvent({ ...data, id: uid(), createdAt: now() }, refsOf(st));
    if (!event.date) return;
    id = event.id;
    st.events.push(event);
    log(st, 'created', 'event', event);
  });
  return id;
}

export function updateEvent(id, patch) {
  update((st) => {
    const event = st.events.find((e) => e.id === id);
    if (!event) return;
    const next = normEvent({ ...event, ...patch }, refsOf(st));
    if (next.date) Object.assign(event, next);
  });
}

export function removeEvent(id) {
  update((st) => {
    const event = st.events.find((e) => e.id === id);
    if (!event) return;
    st.events = st.events.filter((e) => e.id !== id);
    log(st, 'deleted', 'event', event);
  });
}

// ---------- Sprints ----------
// Planificación semanal opcional. Un sprint solo guarda los identificadores de sus tareas: la tarea
// sigue siendo una sola, esté en un proyecto, en el calendario o en la semana.
const sprintTitle = (s) => `Semana ${fmtWeekRange(s.start)}`;
const findSprint = (st, id) => st.sprints.find((s) => s.id === id);

// Semana a la que pasan las tareas abiertas al cerrar: la siguiente al sprint o, si ya pasó, la actual.
export function carryWeek(start) {
  const next = addDays(start, 7);
  const current = weekStart(todayKey());
  return next > current ? next : current;
}

// Hay un sprint por semana: si ya existe el de esa semana, se devuelve ese.
export function addSprint({ start, goal = '' }) {
  if (!isKey(start)) return null;
  const week = weekStart(start);
  const existing = state.sprints.find((s) => s.start === week);
  if (existing) return existing.id;
  let id = null;
  update((st) => {
    const sprint = normSprint({ id: uid(), start: week, goal: str(goal).trim(), createdAt: now() });
    id = sprint.id;
    st.sprints.push(sprint);
    log(st, 'created', 'sprint', { id, title: sprintTitle(sprint) });
  });
  return id;
}

// Objetivo, revisión y reflexión.
export function updateSprint(id, patch, opts) {
  update((st) => {
    const sprint = findSprint(st, id);
    if (!sprint) return;
    for (const key of ['goal', 'review', 'reflection']) if (key in patch) sprint[key] = str(patch[key]);
  }, opts);
}

export function addSprintTask(id, taskId) {
  update((st) => {
    const sprint = findSprint(st, id);
    if (!sprint || sprint.closedAt || sprint.taskIds.includes(taskId)) return;
    if (st.tasks.some((t) => t.id === taskId)) sprint.taskIds.push(taskId);
  });
}

export function removeSprintTask(id, taskId) {
  update((st) => {
    const sprint = findSprint(st, id);
    if (sprint && !sprint.closedAt) sprint.taskIds = sprint.taskIds.filter((x) => x !== taskId);
  });
}

// Deja la tarea en un único sprint de los que están por delante, esta semana o las siguientes, o en ninguno.
export function setTaskSprint(taskId, sprintId) {
  const current = weekStart(todayKey());
  update((st) => {
    for (const s of st.sprints) {
      if (s.closedAt || s.start < current) continue;
      const has = s.taskIds.includes(taskId);
      if (s.id === sprintId) {
        if (!has) s.taskIds.push(taskId);
      } else if (has) {
        s.taskIds = s.taskIds.filter((x) => x !== taskId);
      }
    }
  });
}

// Cierra la semana: guarda cómo quedó cada tarea, la revisión y la reflexión. Con `carry`, las tareas
// abiertas pasan al sprint de la semana que toca, que se crea si hace falta. Devuelve esa semana.
export function closeSprint(id, { review = '', reflection = '', carry = false } = {}) {
  let carried = '';
  update((st) => {
    const sprint = findSprint(st, id);
    if (!sprint || sprint.closedAt) return;
    const tasks = sprint.taskIds.map((tid) => st.tasks.find((t) => t.id === tid)).filter(Boolean);
    sprint.taskIds = tasks.map((t) => t.id);
    sprint.result = tasks.map((t) => normResult({ id: t.id, title: t.title, done: t.status === 'done', completedAt: t.completedAt }));
    sprint.review = str(review).trim();
    sprint.reflection = str(reflection).trim();
    sprint.closedAt = now();
    log(st, 'closed', 'sprint', { id: sprint.id, title: sprintTitle(sprint) });

    const open = tasks.filter((t) => t.status !== 'done');
    if (!carry || !open.length) return;
    const week = carryWeek(sprint.start);
    let next = st.sprints.find((s) => s.start === week);
    if (!next) {
      next = normSprint({ id: uid(), start: week, createdAt: now() });
      st.sprints.push(next);
      log(st, 'created', 'sprint', { id: next.id, title: sprintTitle(next) });
    }
    if (next.closedAt) return;
    for (const t of open) if (!next.taskIds.includes(t.id)) next.taskIds.push(t.id);
    carried = week;
  });
  return carried;
}

export function reopenSprint(id) {
  update((st) => {
    const sprint = findSprint(st, id);
    if (!sprint || !sprint.closedAt) return;
    sprint.closedAt = '';
    sprint.result = [];
    sprint.taskIds = sprint.taskIds.filter((tid) => st.tasks.some((t) => t.id === tid));
    log(st, 'reopened', 'sprint', { id: sprint.id, title: sprintTitle(sprint) });
  });
}

// Las tareas del sprint se conservan en su sitio.
export function removeSprint(id) {
  update((st) => {
    const sprint = findSprint(st, id);
    if (!sprint) return;
    st.sprints = st.sprints.filter((s) => s.id !== id);
    log(st, 'deleted', 'sprint', { id: sprint.id, title: sprintTitle(sprint) });
  });
}

// ---------- Anotaciones de día ----------
export function setDayNote(key, text, opts) {
  if (!isKey(key)) return;
  update((st) => {
    if (str(text).trim()) st.dayNotes[key] = str(text);
    else delete st.dayNotes[key];
  }, opts);
}

// ---------- Categorías ----------
export function addCategory({ name, color }) {
  let id = null;
  update((st) => {
    const order = Math.max(-1, ...st.categories.map((c) => c.order)) + 1;
    const cat = normCategory({ id: uid(), name, color, order }, order);
    id = cat.id;
    st.categories.push(cat);
  });
  return id;
}

export function updateCategory(id, patch) {
  update((st) => {
    const cat = st.categories.find((c) => c.id === id);
    if (cat) Object.assign(cat, normCategory({ ...cat, ...patch }, cat.order));
  });
}

export function moveCategory(id, dir) {
  update((st) => {
    const list = st.categories.slice().sort((a, b) => a.order - b.order);
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((c, idx) => { c.order = idx; });
  });
}

// Lo que tuviera la categoría se conserva, sin categoría.
export function removeCategory(id) {
  update((st) => {
    st.categories = st.categories.filter((c) => c.id !== id);
    for (const list of [st.tasks, st.projects, st.events]) {
      for (const item of list) if (item.categoryId === id) item.categoryId = '';
    }
  });
}

// ---------- Ajustes ----------
export function setSetting(field, value, opts) {
  update((st) => { st.settings[field] = value; }, opts);
}

export function toggleWidget(id) {
  update((st) => {
    const w = st.settings.dashboard.find((x) => x.id === id);
    if (w) w.on = !w.on;
  });
}

export function moveWidget(id, dir) {
  update((st) => {
    const list = st.settings.dashboard;
    const i = list.findIndex((w) => w.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  });
}

// ---------- Importar / exportar ----------
export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: now() }, null, 2);
}

export function importJSON(text) {
  const data = migrate(JSON.parse(text));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localStorage.setItem(BACKUP_KEY, JSON.stringify(stamp(raw, state.version)));
  } catch (e) {
    console.warn('No se pudo guardar la copia previa a la importación', e);
  }
  state = data;
  save();
  emit();
}

export function resetAll() {
  state = defaultState();
  save();
  emit();
}

export function storageInfo() {
  let bytes = 0;
  try { bytes = (localStorage.getItem(STORAGE_KEY) || '').length; } catch { /* sin acceso */ }
  return { bytes };
}
