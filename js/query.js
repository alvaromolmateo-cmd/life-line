// Consultas sobre el estado: listas ordenadas, índices por día, progreso de proyectos y buscador global.
// Solo leen; los cambios pasan siempre por las acciones de store.js.

import { getState, EVENT_TYPE_LABEL, ENTRY_KIND_LABEL, PROJECT_STATUS_LABEL } from './store.js';
import { todayKey, fmtRelative, fmtLong, cap } from './dates.js';

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

// Primero lo que vence antes; sin fecha, al final. A igualdad, la prioridad y luego la antigüedad.
export const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999')
  || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  || a.createdAt.localeCompare(b.createdAt);

// Los eventos de todo el día van antes que los que tienen hora.
export const byTime = (a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title);

export const categories = () => getState().categories.slice().sort((a, b) => a.order - b.order);
export const categoryOf = (id) => (id ? getState().categories.find((c) => c.id === id) || null : null);
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

// Índice por día para pintar calendarios: clave → { events: [...], tasks: [...] }.
export function dayIndex() {
  const map = new Map();
  const slot = (key) => {
    if (!map.has(key)) map.set(key, { events: [], tasks: [] });
    return map.get(key);
  };
  for (const e of getState().events) slot(e.date).events.push(e);
  for (const t of getState().tasks) if (t.due) slot(t.due).tasks.push(t);
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

// Frase corta para un apunte del historial.
export function activityLabel(a) {
  const labels = {
    task: { created: 'Tarea creada', completed: 'Tarea completada', reopened: 'Tarea reabierta', deleted: 'Tarea eliminada' },
    project: { created: 'Proyecto creado', deleted: 'Proyecto eliminado' },
    event: { created: 'Evento añadido', deleted: 'Evento eliminado' },
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
  if (a.kind === 'event') return 'calendar';
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
  const catName = (id) => categoryOf(id)?.name || '';
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
      sub: [EVENT_TYPE_LABEL[e.type], fmtRelative(e.date), e.start].filter(Boolean).join(' · '),
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
    { label: 'Notas de proyectos', items: entries },
    { label: 'Anotaciones del calendario', items: notes },
    { label: 'Bandeja de entrada', items: inbox },
  ].filter((g) => g.items.length).map((g) => ({ ...g, total: g.items.length, items: g.items.slice(0, limit) }));
}
