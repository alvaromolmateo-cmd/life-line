// Consultas sobre el estado: listas ordenadas, índices por día, progreso de proyectos y buscador global.
// Solo leen; los cambios pasan siempre por las acciones de store.js.

import { getState, EVENT_TYPE_LABEL, ENTRY_KIND_LABEL, PROJECT_STATUS_LABEL } from './store.js';
import { todayKey, fmtRelative, fmtLong, fmtWeekRange, weekStart, diffDays, isoWeek, cap } from './dates.js';

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };
// Las prioridades de más a menos: los grupos dentro de los que se ordena arrastrando.
export const PRIORITY_RANKING = ['high', 'normal', 'low'];

// Primero lo que vence antes; sin fecha, al final. A igualdad, la prioridad y luego la antigüedad.
export const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999')
  || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  || a.createdAt.localeCompare(b.createdAt);

// Orden manual: la prioridad manda siempre (alta, normal, baja) y, dentro de cada una, el orden que se
// le haya dado a cada tarea arrastrándola. `sort` es estable, así que ordenar por prioridad una lista que
// ya está en su orden manual, como las tareas de un sprint, conserva ese orden dentro de cada prioridad.
export const byPriority = (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
export const byManual = (a, b) => byPriority(a, b) || a.order - b.order || a.createdAt.localeCompare(b.createdAt);

// Los eventos de todo el día van antes que los que tienen hora.
export const byTime = (a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title);

export const categoryOf = (id) => (id ? getState().categories.find((c) => c.id === id) || null : null);

// ---------- Categorías y subcategorías ----------
// Las principales van en el orden que elige cada persona; sus subcategorías, por prioridad y nombre.
export const topCategories = () => getState().categories.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
export const subcategories = (id) => getState().categories
  .filter((c) => c.parentId === id)
  .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.name.localeCompare(b.name, 'es'));
// Todas, cada principal seguida de sus subcategorías.
export const categories = () => topCategories().flatMap((c) => [c, ...subcategories(c.id)]);
// «Estudios › Redes» para una subcategoría; el nombre sin más para una principal.
export const categoryPath = (id) => {
  const c = categoryOf(id);
  if (!c) return '';
  const parent = c.parentId ? categoryOf(c.parentId) : null;
  return parent ? `${parent.name} › ${c.name}` : c.name;
};
// Filtrar por una categoría principal incluye sus subcategorías.
export const inCategory = (itemCat, filterId) => !filterId || itemCat === filterId || categoryOf(itemCat)?.parentId === filterId;
export const projectOf = (id) => (id ? getState().projects.find((p) => p.id === id) || null : null);
export const taskOf = (id) => getState().tasks.find((t) => t.id === id) || null;
export const eventOf = (id) => getState().events.find((e) => e.id === id) || null;

export const isOpen = (t) => t.status !== 'done';
export const isOverdue = (t) => isOpen(t) && t.due && t.due < todayKey();

export const openTasks = () => getState().tasks.filter(isOpen).sort(byDue);
export const doneTasks = () => getState().tasks.filter((t) => !isOpen(t)).sort((a, b) => b.completedAt.localeCompare(a.completedAt));

// Tareas con fecha en ese día: primero las abiertas.
export const tasksOn = (key) => getState().tasks.filter((t) => t.due === key)
  .sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || byDue(a, b));

export const eventsOn = (key) => getState().events.filter((e) => e.date === key).sort(byTime);

export const upcomingEvents = (from = todayKey()) => getState().events.filter((e) => e.date >= from).sort(byTime);

// Entregas: un evento con su tarea, que es la que se marca. Su fecha es la fecha límite de la tarea:
// pasado ese día sin hacerla, la tarea queda atrasada y la entrega, sin entregar.
export const isDelivery = (e) => e.type === 'delivery';
export const deliveryTask = (e) => (isDelivery(e) && e.taskId ? taskOf(e.taskId) : null);
export const taskDelivery = (t) => getState().events.find((e) => e.taskId === t.id) || null;
export const isDelivered = (e) => !!deliveryTask(e) && !isOpen(deliveryTask(e));
export const isLateDelivery = (e) => isDelivery(e) && !isDelivered(e) && e.date < todayKey();
// «Entregada», «Sin entregar» si ya venció, o nada.
export const deliveryState = (e) => (!isDelivery(e) ? '' : isDelivered(e) ? 'Entregada' : isLateDelivery(e) ? 'Sin entregar' : '');

// Índice por día para pintar calendarios: clave → { events: [...], tasks: [...] }.
export function dayIndex() {
  const map = new Map();
  const slot = (key) => {
    if (!map.has(key)) map.set(key, { events: [], tasks: [] });
    return map.get(key);
  };
  // La tarea de una entrega no se pinta aparte: en la cuadrícula ya está su evento.
  const linked = new Set(getState().events.map((e) => e.taskId).filter(Boolean));
  for (const e of getState().events) slot(e.date).events.push(e);
  for (const t of getState().tasks) if (t.due && !linked.has(t.id)) slot(t.due).tasks.push(t);
  for (const s of map.values()) {
    s.events.sort(byTime);
    s.tasks.sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || byDue(a, b));
  }
  return map;
}

export function projectStats(id) {
  const tasks = getState().tasks.filter((t) => t.projectId === id);
  const open = tasks.filter(isOpen).sort(byDue);
  return {
    total: tasks.length,
    done: tasks.length - open.length,
    open,
    nextDue: open.find((t) => t.due)?.due || '',
  };
}

export const projectTasks = (id) => getState().tasks.filter((t) => t.projectId === id);
export const projectEvents = (id) => getState().events.filter((e) => e.projectId === id).sort(byTime);
export const projectActivity = (id) => getState().activity.filter((a) => a.projectId === id).slice().reverse();
export const recentActivity = (limit = 8) => getState().activity.slice(-limit).reverse();

// ---------- Diario ----------
// De la más reciente a la más antigua; dentro del mismo día, la última escrita primero.
export const journal = () => getState().journal.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
export const journalOf = (id) => getState().journal.find((j) => j.id === id) || null;
export const journalOn = (key) => journal().filter((j) => j.date === key);
export const projectJournal = (id) => journal().filter((j) => j.projectId === id);
// Título de una entrada: el suyo o su primera línea.
export const journalHeading = (j) => j.title || j.text.trim().split('\n')[0].slice(0, 90);

// ---------- Sprints ----------
// Son opcionales: con el ajuste apagado no aparecen en el menú, en Inicio ni en las fichas.
export const sprintsOn = () => getState().settings.useSprints !== false;
export const thisWeek = () => weekStart(todayKey());
export const sprints = () => getState().sprints.slice().sort((a, b) => b.start.localeCompare(a.start));
export const sprintOf = (id) => getState().sprints.find((s) => s.id === id) || null;
export const sprintForWeek = (start) => getState().sprints.find((s) => s.start === start) || null;

// El estado sale de las fechas: planificado si la semana no ha llegado, en curso durante la semana,
// por revisar cuando ya pasó y cerrado tras la revisión.
export const SPRINT_STATE_LABEL = { planned: 'Planificado', active: 'En curso', review: 'Por revisar', closed: 'Cerrado' };
export function sprintState(s) {
  if (s.closedAt) return 'closed';
  const week = thisWeek();
  return s.start > week ? 'planned' : s.start === week ? 'active' : 'review';
}

// En el orden del sprint, por prioridad y, dentro de cada una, como se hayan colocado en el tablero.
export const sprintTasks = (s) => s.taskIds.map(taskOf).filter(Boolean).sort(byPriority);

// Cómo va cada tarea del sprint. Uno cerrado responde con lo que quedó guardado al cerrarlo.
export function sprintItems(s) {
  if (s.closedAt) return s.result;
  return sprintTasks(s).map((t) => ({ id: t.id, title: t.title, done: !isOpen(t), completedAt: t.completedAt }));
}

export function sprintStats(s) {
  const items = sprintItems(s);
  return { total: items.length, done: items.filter((i) => i.done).length };
}

// El sprint de esta semana, si existe y sigue abierto.
export function currentSprint() {
  const s = sprintForWeek(thisWeek());
  return s && !s.closedAt ? s : null;
}

// Sprints a los que todavía se les pueden asignar tareas desde la ficha de una tarea.
export const upcomingSprints = () => getState().sprints
  .filter((s) => !s.closedAt && s.start >= thisWeek())
  .sort((a, b) => a.start.localeCompare(b.start));
export const taskSprint = (taskId) => upcomingSprints().find((s) => s.taskIds.includes(taskId)) || null;

// «Esta semana», «Semana que viene», «Semana pasada» o «Semana 47».
export function weekLabel(start) {
  const diff = diffDays(start, thisWeek());
  if (diff === 0) return 'Esta semana';
  if (diff === 7) return 'Semana que viene';
  if (diff === -7) return 'Semana pasada';
  return `Semana ${isoWeek(start)}`;
}

// Frase corta para un apunte del historial.
export function activityLabel(a) {
  const labels = {
    task: { created: 'Tarea creada', completed: 'Tarea completada', reopened: 'Tarea reabierta', deleted: 'Tarea eliminada' },
    project: { created: 'Proyecto creado', deleted: 'Proyecto eliminado' },
    event: { created: 'Evento añadido', completed: 'Entrega completada', reopened: 'Entrega reabierta', deleted: 'Evento eliminado' },
    journal: { created: 'Entrada del diario', deleted: 'Entrada del diario eliminada' },
    sprint: { created: 'Sprint empezado', closed: 'Sprint cerrado', reopened: 'Sprint reabierto', deleted: 'Sprint eliminado' },
  };
  if (a.kind === 'project' && a.action === 'status') {
    return { active: 'Proyecto reactivado', paused: 'Proyecto en pausa', done: 'Proyecto terminado' }[a.to] || 'Proyecto actualizado';
  }
  if (a.kind === 'entry') {
    return { note: 'Nota añadida', idea: 'Idea apuntada', progress: 'Avance registrado' }[a.entryKind] || 'Nota añadida';
  }
  return labels[a.kind]?.[a.action] || 'Actividad';
}

export function activityIcon(a) {
  if (a.kind === 'entry') return { note: 'note', idea: 'bulb', progress: 'trending' }[a.entryKind] || 'note';
  if (a.kind === 'project') return 'folder';
  if (a.kind === 'event') return a.action === 'completed' ? 'check' : 'calendar';
  if (a.kind === 'sprint') return 'sprint';
  if (a.kind === 'journal') return 'book';
  return a.action === 'completed' ? 'check' : 'check-square';
}

// ---------- Buscador global ----------
// Minúsculas y sin tildes, para que «examen» encuentre «Exámenes».
export const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Devuelve grupos { label, items: [{ kind, id, title, sub, icon, ... }] } con lo que coincide con el texto.
export function search(text, limit = 8) {
  const words = fold(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const st = getState();
  const hit = (...fields) => {
    const hay = fold(fields.flat().join(' \n '));
    return words.every((w) => hay.includes(w));
  };
  const catName = (id) => categoryPath(id);
  const projName = (id) => projectOf(id)?.title || '';

  const tasks = st.tasks
    .filter((t) => hit(t.title, t.notes, t.tags, catName(t.categoryId), projName(t.projectId)))
    .sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || byDue(a, b))
    .map((t) => ({
      kind: 'task', id: t.id, title: t.title, icon: isOpen(t) ? 'check-square' : 'check', done: !isOpen(t),
      sub: [isOpen(t) ? '' : 'Hecha', t.due ? fmtRelative(t.due) : '', projName(t.projectId)].filter(Boolean).join(' · '),
    }));

  const projects = st.projects
    .filter((p) => hit(p.title, p.description, p.goal, p.tags, catName(p.categoryId)))
    .map((p) => ({ kind: 'project', id: p.id, title: p.title, icon: 'folder', sub: PROJECT_STATUS_LABEL[p.status] }));

  const events = st.events
    .filter((e) => hit(e.title, e.place, e.notes, EVENT_TYPE_LABEL[e.type], catName(e.categoryId), projName(e.projectId)))
    .sort((a, b) => byTime(b, a))
    .map((e) => ({
      kind: 'event', id: e.id, title: e.title, icon: 'calendar',
      sub: [EVENT_TYPE_LABEL[e.type], deliveryState(e), fmtRelative(e.date), e.start].filter(Boolean).join(' · '),
    }));

  const journalHits = journal()
    .filter((j) => hit(j.title, j.text, j.tags, catName(j.categoryId), projName(j.projectId)))
    .map((j) => ({
      kind: 'journal', id: j.id, icon: 'book', title: journalHeading(j),
      sub: [cap(fmtLong(j.date)), projName(j.projectId)].filter(Boolean).join(' · '),
    }));

  const sprintHits = (sprintsOn() ? st.sprints : [])
    .filter((s) => hit('sprint', s.goal, s.review, s.reflection, fmtWeekRange(s.start), s.result.map((r) => r.title)))
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((s) => ({
      kind: 'sprint', id: s.start, icon: 'sprint',
      title: s.goal.trim() || `Sprint del ${fmtWeekRange(s.start)}`,
      sub: [s.goal.trim() ? fmtWeekRange(s.start) : '', SPRINT_STATE_LABEL[sprintState(s)]].filter(Boolean).join(' · '),
    }));

  const entries = [];
  for (const p of st.projects) {
    for (const e of p.entries) {
      if (hit(e.text)) entries.push({ kind: 'entry', id: p.id, title: e.text, icon: 'note', sub: `${ENTRY_KIND_LABEL[e.kind]} · ${p.title}`, at: e.at });
    }
  }
  entries.sort((a, b) => b.at.localeCompare(a.at));

  const notes = Object.entries(st.dayNotes)
    .filter(([, v]) => hit(v))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, v]) => ({ kind: 'day', id: key, title: v, icon: 'note', sub: `Anotación · ${cap(fmtLong(key))}` }));

  const inbox = st.inbox
    .filter((n) => hit(n.text))
    .map((n) => ({ kind: 'inbox', id: n.id, title: n.text, icon: 'inbox', sub: 'Bandeja de entrada' }));

  return [
    { label: 'Tareas', items: tasks },
    { label: 'Proyectos', items: projects },
    { label: 'Eventos', items: events },
    { label: 'Sprints', items: sprintHits },
    { label: 'Diario', items: journalHits },
    { label: 'Notas de proyectos', items: entries },
    { label: 'Anotaciones del calendario', items: notes },
    { label: 'Bandeja de entrada', items: inbox },
  ].filter((g) => g.items.length).map((g) => ({ ...g, total: g.items.length, items: g.items.slice(0, limit) }));
}
