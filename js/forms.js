// Formularios en modal para crear y editar tareas, eventos, proyectos y categorías,
// el menú «Añadir» y el paso de organizar lo apuntado en la bandeja de entrada.

import { esc, icon, openModal, closeModal, modalHeader, confirmDialog, openMenu, toast } from './ui.js';
import {
  getState, addTask, updateTask, removeTask, addEvent, updateEvent, removeEvent,
  addProject, updateProject, removeProject, addProjectEntry, addInbox, removeInbox,
  addCategory, updateCategory,
  TASK_STATUSES, TASK_STATUS_LABEL, PRIORITIES, PRIORITY_LABEL, PROJECT_STATUSES, PROJECT_STATUS_LABEL,
  EVENT_TYPES, EVENT_TYPE_LABEL, ENTRY_KINDS, ENTRY_KIND_LABEL, COLORS, COLOR_LABEL,
} from './store.js';
import { categories, taskOf, eventOf, projectOf, categoryOf } from './query.js';
import { todayKey } from './dates.js';

// ---------- Campos ----------
const field = (label, control, cls = '') => `<label class="field ${cls}"><span class="field-label">${label}</span>${control}</label>`;

const options = (pairs, value) => pairs.map(([v, text]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(text)}</option>`).join('');

const selectField = (label, name, pairs, value) => field(label, `<select name="${name}">${options(pairs, value)}</select>`);

const categoryField = (value) => selectField('Categoría', 'categoryId', [['', 'Sin categoría'], ...categories().map((c) => [c.id, c.name])], value);

// Proyectos en marcha, más el que ya tuviera el elemento aunque esté terminado.
const projectField = (value) => {
  const list = getState().projects.filter((p) => p.status !== 'done' || p.id === value);
  return selectField('Proyecto', 'projectId', [['', 'Sin proyecto'], ...list.map((p) => [p.id, p.title])], value);
};

const readForm = (form) => Object.fromEntries(new FormData(form).entries());

function formModal({ title, sub = '', body, saveText = 'Guardar', onSave, onDelete, size = '' }) {
  openModal({
    size,
    render: () => `
      <form class="modal-form" novalidate>
        ${modalHeader(esc(title), sub)}
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          ${onDelete ? `<button type="button" class="btn btn-ghost btn-danger-text" data-delete>${icon('trash')}<span>Eliminar</span></button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn" data-modal-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${esc(saveText)}</button>
        </div>
      </form>`,
    mount: (panel) => {
      const form = panel.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const required = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
        if (required) {
          required.classList.add('invalid');
          required.focus();
          return;
        }
        if (onSave(readForm(form)) !== false) closeModal();
      });
      form.addEventListener('input', (e) => e.target.classList?.remove('invalid'));
      panel.querySelector('[data-delete]')?.addEventListener('click', onDelete);
    },
  });
}

// ---------- Tarea ----------
// `defaults` rellena una tarea nueva; `onSaved` avisa cuando se ha guardado.
export function openTaskForm({ id = null, defaults = {}, onSaved } = {}) {
  const task = id ? taskOf(id) : null;
  if (id && !task) return;
  const v = { title: '', notes: '', status: 'pending', priority: 'normal', due: '', categoryId: '', projectId: '', tags: [], ...defaults, ...(task || {}) };
  formModal({
    title: task ? 'Tarea' : 'Nueva tarea',
    saveText: task ? 'Guardar' : 'Crear tarea',
    body: `
      ${field('Título', `<input name="title" value="${esc(v.title)}" required autofocus autocomplete="off" placeholder="Qué hay que hacer">`)}
      ${field('Notas', `<textarea name="notes" rows="3" placeholder="Detalles, enlaces, pasos…">${esc(v.notes)}</textarea>`)}
      <div class="row2">
        ${selectField('Estado', 'status', TASK_STATUSES.map((s) => [s, TASK_STATUS_LABEL[s]]), v.status)}
        ${selectField('Prioridad', 'priority', PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]]), v.priority)}
      </div>
      <div class="row2">
        ${field('Fecha límite', `<input type="date" name="due" value="${esc(v.due)}">`)}
        ${categoryField(v.categoryId)}
      </div>
      ${projectField(v.projectId)}
      ${field('Etiquetas', `<input name="tags" value="${esc(v.tags.join(', '))}" autocomplete="off" placeholder="Separadas por comas">`)}`,
    onSave: (data) => {
      if (task) updateTask(task.id, data);
      else addTask(data);
      onSaved?.();
      if (!task) toast('Tarea creada');
    },
    onDelete: task ? async () => {
      const ok = await confirmDialog({ title: 'Eliminar tarea', message: `Se eliminará «${esc(task.title)}».` });
      if (ok) { removeTask(task.id); toast('Tarea eliminada'); } else openTaskForm({ id });
    } : null,
  });
}

// ---------- Evento ----------
export function openEventForm({ id = null, defaults = {}, onSaved } = {}) {
  const event = id ? eventOf(id) : null;
  if (id && !event) return;
  const v = { title: '', type: 'event', date: todayKey(), start: '', end: '', place: '', notes: '', categoryId: '', projectId: '', ...defaults, ...(event || {}) };
  formModal({
    title: event ? 'Evento' : 'Nuevo evento',
    saveText: event ? 'Guardar' : 'Crear evento',
    body: `
      ${field('Título', `<input name="title" value="${esc(v.title)}" required autofocus autocomplete="off" placeholder="Qué ocurre">`)}
      <div class="row2">
        ${selectField('Tipo', 'type', EVENT_TYPES.map((t) => [t, EVENT_TYPE_LABEL[t]]), v.type)}
        ${field('Fecha', `<input type="date" name="date" value="${esc(v.date)}" required>`)}
      </div>
      <div class="row2">
        ${field('Empieza', `<input type="time" name="start" value="${esc(v.start)}">`)}
        ${field('Termina', `<input type="time" name="end" value="${esc(v.end)}">`)}
      </div>
      <p class="field-hint">Sin hora de inicio, el evento ocupa todo el día.</p>
      ${field('Lugar', `<input name="place" value="${esc(v.place)}" autocomplete="off">`)}
      ${field('Notas', `<textarea name="notes" rows="3">${esc(v.notes)}</textarea>`)}
      <div class="row2">
        ${categoryField(v.categoryId)}
        ${projectField(v.projectId)}
      </div>`,
    onSave: (data) => {
      if (event) updateEvent(event.id, data);
      else addEvent(data);
      onSaved?.();
      if (!event) toast('Evento creado');
    },
    onDelete: event ? async () => {
      const ok = await confirmDialog({ title: 'Eliminar evento', message: `Se eliminará «${esc(event.title)}».` });
      if (ok) { removeEvent(event.id); toast('Evento eliminado'); } else openEventForm({ id });
    } : null,
  });
}

// ---------- Proyecto ----------
export function openProjectForm({ id = null, defaults = {}, onSaved } = {}) {
  const project = id ? projectOf(id) : null;
  if (id && !project) return;
  const v = { title: '', description: '', goal: '', status: 'active', priority: 'normal', start: todayKey(), end: '', categoryId: '', tags: [], ...defaults, ...(project || {}) };
  formModal({
    title: project ? 'Proyecto' : 'Nuevo proyecto',
    saveText: project ? 'Guardar' : 'Crear proyecto',
    body: `
      ${field('Título', `<input name="title" value="${esc(v.title)}" required autofocus autocomplete="off" placeholder="Nombre del proyecto">`)}
      ${field('Descripción', `<textarea name="description" rows="3" placeholder="De qué va">${esc(v.description)}</textarea>`)}
      ${field('Objetivo', `<textarea name="goal" rows="2" placeholder="Qué quieres conseguir">${esc(v.goal)}</textarea>`)}
      <div class="row2">
        ${selectField('Estado', 'status', PROJECT_STATUSES.map((s) => [s, PROJECT_STATUS_LABEL[s]]), v.status)}
        ${selectField('Prioridad', 'priority', PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]]), v.priority)}
      </div>
      <div class="row2">
        ${field('Inicio', `<input type="date" name="start" value="${esc(v.start)}">`)}
        ${field('Fin previsto', `<input type="date" name="end" value="${esc(v.end)}">`)}
      </div>
      ${categoryField(v.categoryId)}
      ${field('Etiquetas', `<input name="tags" value="${esc(v.tags.join(', '))}" autocomplete="off" placeholder="Separadas por comas">`)}`,
    onSave: (data) => {
      if (project) {
        updateProject(project.id, data);
        onSaved?.(project.id);
      } else {
        const newId = addProject(data);
        onSaved?.(newId);
        toast('Proyecto creado');
        location.hash = `#/proyectos/${newId}`;
      }
    },
    onDelete: project ? async () => {
      const ok = await confirmDialog({
        title: 'Eliminar proyecto',
        message: `Se eliminará «${esc(project.title)}» con sus notas. Sus tareas y eventos se conservan sin proyecto.`,
      });
      if (ok) {
        removeProject(project.id);
        toast('Proyecto eliminado');
        if (location.hash.startsWith(`#/proyectos/${project.id}`)) location.hash = '#/proyectos';
      } else openProjectForm({ id });
    } : null,
  });
}

// ---------- Categoría ----------
export function openCategoryForm({ id = null } = {}) {
  const cat = id ? categoryOf(id) : null;
  const v = { name: '', color: 'indigo', ...(cat || {}) };
  formModal({
    size: 'sm',
    title: cat ? 'Categoría' : 'Nueva categoría',
    body: `
      ${field('Nombre', `<input name="name" value="${esc(v.name)}" required autofocus autocomplete="off">`)}
      <div class="field">
        <span class="field-label">Color</span>
        <div class="swatches">
          ${COLORS.map((c) => `
            <label class="swatch" style="--c:var(--c-${c})" title="${COLOR_LABEL[c]}">
              <input type="radio" name="color" value="${c}"${c === v.color ? ' checked' : ''}>
              <span aria-hidden="true"></span><span class="sr-only">${COLOR_LABEL[c]}</span>
            </label>`).join('')}
        </div>
      </div>`,
    onSave: (data) => {
      if (cat) updateCategory(cat.id, data);
      else addCategory(data);
    },
  });
}

// ---------- Apunte rápido ----------
export function openCaptureForm() {
  formModal({
    size: 'sm',
    title: 'Apunte rápido',
    sub: 'Va a la bandeja de entrada para organizarlo después.',
    saveText: 'Guardar',
    body: field('Apunte', '<textarea name="text" rows="3" required autofocus placeholder="Una idea, un pendiente, algo que no quieres olvidar"></textarea>'),
    onSave: (data) => {
      addInbox(data.text);
      toast('Guardado en la bandeja de entrada');
    },
  });
}

// ---------- Organizar un apunte de la bandeja ----------
// El apunte se convierte en lo que corresponda y sale de la bandeja al guardarlo.
export function openOrganize(id) {
  const note = getState().inbox.find((n) => n.id === id);
  if (!note) return;
  const done = () => removeInbox(id);
  const projects = getState().projects.filter((p) => p.status !== 'done');
  const choices = [
    { key: 'task', ic: 'check-square', color: 'blue', label: 'Tarea', hint: 'Algo que hay que hacer' },
    { key: 'event', ic: 'calendar', color: 'indigo', label: 'Evento', hint: 'Algo que ocurre un día concreto' },
    { key: 'project', ic: 'folder', color: 'violet', label: 'Proyecto', hint: 'Algo más amplio, con varias tareas' },
    ...(projects.length ? [{ key: 'entry', ic: 'note', color: 'teal', label: 'Nota de un proyecto', hint: 'Una idea o un apunte para un proyecto' }] : []),
  ];
  openModal({
    size: 'sm',
    render: () => `
      ${modalHeader('Organizar apunte')}
      <div class="modal-body">
        <blockquote class="quote">${esc(note.text)}</blockquote>
        <p class="field-label">Convertir en</p>
        <div class="choice-list">
          ${choices.map((c) => `
            <button class="choice" data-choice="${c.key}">
              <span class="menu-icon" style="--c:var(--c-${c.color})">${icon(c.ic)}</span>
              <span class="menu-text"><span>${c.label}</span><small>${c.hint}</small></span>
              ${icon('chevron-right')}
            </button>`).join('')}
        </div>
      </div>`,
    mount: (panel) => {
      panel.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => {
        const kind = b.dataset.choice;
        // Un apunte largo pasa a ser el título en su primera línea y el resto, las notas.
        const [first, ...rest] = note.text.split('\n');
        const title = first.trim();
        const extra = rest.join('\n').trim();
        if (kind === 'task') openTaskForm({ defaults: { title, notes: extra }, onSaved: done });
        if (kind === 'event') openEventForm({ defaults: { title, notes: extra }, onSaved: done });
        if (kind === 'project') openProjectForm({ defaults: { title, description: extra }, onSaved: done });
        if (kind === 'entry') openEntryForm({ text: note.text, onSaved: done });
      }));
    },
  });
}

// Nota, idea o avance para un proyecto, eligiendo el proyecto.
function openEntryForm({ text = '', onSaved } = {}) {
  const projects = getState().projects.filter((p) => p.status !== 'done');
  formModal({
    size: 'sm',
    title: 'Nota de un proyecto',
    body: `
      ${selectField('Proyecto', 'projectId', projects.map((p) => [p.id, p.title]), projects[0]?.id)}
      ${selectField('Tipo', 'kind', ENTRY_KINDS.map((k) => [k, ENTRY_KIND_LABEL[k]]), 'note')}
      ${field('Texto', `<textarea name="text" rows="4" required autofocus>${esc(text)}</textarea>`)}`,
    onSave: (data) => {
      addProjectEntry(data.projectId, data);
      onSaved?.();
      toast('Nota guardada en el proyecto');
    },
  });
}

// ---------- Menú «Añadir» ----------
export function openQuickAdd(anchor, defaults = {}) {
  openMenu(anchor, [
    { label: 'Tarea', hint: 'Algo que hay que hacer', icon: 'check-square', color: 'blue', onClick: () => openTaskForm({ defaults }) },
    { label: 'Evento', hint: 'Cita, examen, entrega o fecha importante', icon: 'calendar', color: 'indigo', onClick: () => openEventForm({ defaults }) },
    { label: 'Proyecto', hint: 'Un objetivo con varias tareas', icon: 'folder', color: 'violet', onClick: () => openProjectForm({}) },
    { label: 'Apunte rápido', hint: 'A la bandeja, para organizarlo después', icon: 'inbox', color: 'teal', onClick: () => openCaptureForm() },
  ]);
}
