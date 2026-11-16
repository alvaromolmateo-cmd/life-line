// Ajustes: nombre, apariencia, categorías, copia de los datos e instalación.

import { esc, icon, confirmDialog, toast, downloadText, plural } from '../ui.js';
import {
  getState, setSetting, moveCategory, removeCategory, exportJSON, importJSON, resetAll,
  safetyCopies, discardSafetyCopy, storageInfo, hasSaveError, PRIORITY_LABEL,
} from '../store.js';
import { topCategories, subcategories } from '../query.js';
import { openCategoryForm } from '../forms.js';
import { todayKey, fmtMoment } from '../dates.js';

export const APP_VERSION = '1.1.0'; // la misma que VERSION en sw.js

const THEMES = [['auto', 'Como el dispositivo'], ['light', 'Claro'], ['dark', 'Oscuro']];

const section = (title, ic, body, sub = '', anchor = '') => `
  <section class="card settings-card"${anchor ? ` data-anchor="${anchor}"` : ''}>
    <header class="card-head"><h2 class="card-title">${icon(ic)}<span>${title}</span></h2></header>
    ${sub ? `<p class="card-sub">${sub}</p>` : ''}
    ${body}
  </section>`;

// Línea «Etiqueta – Texto» con su icono.
const guideRow = (ic, color, label, text) => `
  <div class="guide-row">
    <span class="menu-icon" style="--c:var(--c-${color})">${icon(ic)}</span>
    <p><b>${label}</b> – ${text}</p>
  </div>`;

// Cada apartado responde a una pregunta y todos trabajan sobre la misma información.
function guideSection() {
  return section('Cómo se organiza LifeLine', 'target', `
    <div class="guide">
      ${guideRow('calendar', 'indigo', 'Calendario', 'Cuándo ocurren las cosas.')}
      ${guideRow('check-square', 'blue', 'Tareas y proyectos', 'Qué hay que hacer y qué quieres conseguir.')}
      ${guideRow('sprint', 'violet', 'Sprints', 'En qué quieres avanzar esta semana.')}
      ${guideRow('book', 'pink', 'Diario', 'Qué ha ocurrido y cómo lo has vivido.')}
      ${guideRow('chart', 'teal', 'Registros', 'Qué has hecho y cómo ha ido cambiando con el tiempo.')}
    </div>
    <p class="guide-example">Un examen es un evento del calendario. Prepararlo es un proyecto con sus tareas. Las que tocan esta semana entran en el sprint. Cómo fue la semana queda en el diario, y todo ello se puede volver a mirar en los registros.</p>`,
  'Cada apartado responde a una pregunta. La información se guarda una sola vez y los apartados la comparten.');
}

// Qué es un sprint aquí, cómo encaja con lo demás y cómo queda la app si no se usan.
function sprintsSection(on) {
  return section('Sprints', 'sprint', `
    <label class="switch switch-row">
      <input type="checkbox" data-use-sprints${on ? ' checked' : ''}>
      <span class="switch-track" aria-hidden="true"></span>
      <span>Usar sprints<small>${on ? 'Tienen su apartado, su bloque en Inicio y su etiqueta en las tareas.' : 'Están guardados y fuera de la vista. Al activarlos vuelven tal como los dejaste.'}</small></span>
    </label>

    <p class="guide-title">Qué es un sprint</p>
    <p class="muted">Una semana con intención. El lunes eliges un objetivo y unas pocas tareas en las que quieres avanzar, durante la semana ves cómo van y al terminar anotas qué has conseguido y cómo ha ido. El sprint contesta a una sola pregunta, en qué quiero avanzar estos días, y deja las demás a los otros apartados.</p>

    <p class="guide-title">Cómo encaja con lo demás</p>
    <div class="guide">
      ${guideRow('check-square', 'blue', 'Tareas y proyectos', 'El sprint elige de ahí lo de esta semana. La tarea sigue siendo la misma, en su lista y en su proyecto, con su fecha y su prioridad. Marcarla como hecha en un sitio la marca en todos.')}
      ${guideRow('calendar', 'indigo', 'Calendario', 'Citas, exámenes y eventos siguen en su día. El sprint recoge aquello en lo que quieres avanzar y el calendario, lo que ocurre a una hora concreta.')}
      ${guideRow('book', 'pink', 'Diario', 'La revisión y la reflexión cierran la semana de trabajo. El diario queda para todo lo demás que quieras contar.')}
      ${guideRow('chart', 'teal', 'Registros', 'Cada sprint cerrado aparece en su periodo con su objetivo y lo que se hizo.')}
    </div>

    <p class="guide-title">Con sprints o sin ellos</p>
    <div class="guide">
      ${guideRow('sprint', 'violet', 'Con sprints', 'Planificas al empezar la semana, sigues el tablero y cierras al terminar. Inicio enseña el sprint en curso y las tareas elegidas llevan la etiqueta Sprint.')}
      ${guideRow('check', 'green', 'Sin sprints', 'Te organizas por fechas, prioridades y proyectos. Tareas, calendario, diario y registros funcionan completos por sí solos.')}
      ${guideRow('clock', 'amber', 'A ratos', 'Una semana sin sprint es una semana normal. Puedes planificar solo las que lo pidan, como la de antes de un examen.')}
    </div>`,
  'Una forma opcional de planificar la semana.', 'sprints');
}

function categoriesSection() {
  const list = topCategories();
  const st = getState();
  const uses = (id) => [st.tasks, st.projects, st.events, st.journal].reduce((n, items) => n + items.filter((x) => x.categoryId === id).length, 0);
  const usage = (n) => (n ? plural(n, 'elemento', 'elementos') : 'Sin usar');
  const actions = (c) => `
    <button class="icon-btn sm" data-cat-edit="${c.id}" aria-label="Editar ${esc(c.name)}">${icon('edit')}</button>
    <button class="icon-btn sm" data-cat-remove="${c.id}" aria-label="Eliminar ${esc(c.name)}">${icon('trash')}</button>`;
  return section('Categorías', 'tag', `
    <div class="list">
      ${list.map((c, i) => {
    const subs = subcategories(c.id);
    return `
        <div class="cat-group">
          <div class="cat-row">
            <i class="dot lg" style="--c:var(--c-${c.color})"></i>
            <span class="cat-name">${esc(c.name)}<small>${esc([usage(uses(c.id)), subs.length ? plural(subs.length, 'subcategoría', 'subcategorías') : ''].filter(Boolean).join(' · '))}</small></span>
            <button class="icon-btn sm" data-cat-move="${c.id}" data-dir="-1" aria-label="Subir"${i === 0 ? ' disabled' : ''}>${icon('arrow-up')}</button>
            <button class="icon-btn sm" data-cat-move="${c.id}" data-dir="1" aria-label="Bajar"${i === list.length - 1 ? ' disabled' : ''}>${icon('arrow-down')}</button>
            <button class="icon-btn sm" data-cat-sub="${c.id}" aria-label="Nueva subcategoría en ${esc(c.name)}" title="Nueva subcategoría">${icon('plus')}</button>
            ${actions(c)}
          </div>
          ${subs.map((sc) => `
            <div class="cat-row cat-sub">
              <i class="dot" style="--c:var(--c-${sc.color})"></i>
              <span class="cat-name">${esc(sc.name)}<small>${esc(`Prioridad ${PRIORITY_LABEL[sc.priority].toLowerCase()} · ${usage(uses(sc.id))}`)}</small></span>
              ${sc.priority === 'high' ? `<span class="chip chip-high">${icon('flag')}Alta</span>` : ''}
              ${actions(sc)}
            </div>`).join('')}
        </div>`;
  }).join('')}
    </div>
    <button class="btn btn-sm" data-cat-new>${icon('plus')}<span>Nueva categoría</span></button>`,
  'Sirven para clasificar tareas, proyectos, eventos y entradas del diario, y para filtrar. Cada categoría puede tener subcategorías, como las asignaturas dentro de Estudios, con su propio color y su prioridad.');
}

function dataSection() {
  const st = getState();
  const { bytes } = storageInfo();
  const { backup, rescues, readOnly } = safetyCopies();
  const kb = (bytes / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const summary = [
    plural(st.tasks.length, 'tarea', 'tareas'),
    plural(st.projects.length, 'proyecto', 'proyectos'),
    plural(st.events.length, 'evento', 'eventos'),
    st.sprints.length ? plural(st.sprints.length, 'sprint', 'sprints') : '',
    st.journal.length ? plural(st.journal.length, 'entrada del diario', 'entradas del diario') : '',
  ].filter(Boolean).join(' · ');
  return section('Tus datos', 'download', `
    <p class="muted">${esc(summary)} · ${kb}&nbsp;KB</p>
    ${hasSaveError() || readOnly ? '<p class="notice danger">Los últimos cambios siguen sin guardarse en este dispositivo. Descarga una copia para conservarlos.</p>' : ''}
    <div class="btn-row">
      <button class="btn" data-export>${icon('download')}<span>Descargar copia</span></button>
      <button class="btn" data-import>${icon('upload')}<span>Restaurar copia</span></button>
      <input type="file" accept="application/json,.json" data-import-file hidden>
    </div>
    ${backup ? `
      <div class="notice">
        <p><b>Copia automática</b> – ${esc(fmtMoment(backup.savedAt))}. Guarda lo que había justo antes del último cambio importante.</p>
        <div class="btn-row">
          <button class="btn btn-sm" data-copy-download="backup">${icon('download')}<span>Descargar</span></button>
          <button class="btn btn-sm btn-ghost" data-copy-discard="backup">Descartar</button>
        </div>
      </div>` : ''}
    ${rescues.length ? `
      <div class="notice danger">
        <p><b>Datos apartados</b> – ${plural(rescues.length, 'copia que no se pudo abrir', 'copias que no se pudieron abrir')}. Siguen guardadas tal cual.</p>
        <div class="btn-row">
          <button class="btn btn-sm" data-copy-download="rescue">${icon('download')}<span>Descargar</span></button>
          <button class="btn btn-sm btn-ghost" data-copy-discard="rescue">Descartar</button>
        </div>
      </div>` : ''}
    <div class="danger-zone">
      <div><b>Empezar de cero</b><small>Borra todo lo guardado en este dispositivo.</small></div>
      <button class="btn btn-danger" data-reset>${icon('trash')}<span>Borrar todo</span></button>
    </div>`,
  'Todo se guarda en este dispositivo. Una copia descargada te permite llevártelo a otro o recuperarlo.');
}

export function render(ctx) {
  const s = getState().settings;
  return `
    <header class="page-head">
      <div>
        <h1>Ajustes</h1>
        <p class="sub">Adapta LifeLine a tu manera de organizarte.</p>
      </div>
    </header>
    <div class="settings">
      ${section('Perfil', 'home', `
        <label class="field">
          <span class="field-label">Tu nombre</span>
          <input data-name value="${esc(s.name)}" autocomplete="off" maxlength="40" placeholder="Para saludarte en Inicio">
        </label>`)}

      ${section('Apariencia', 'sun', `
        <div class="seg wide" role="group" aria-label="Tema">
          ${THEMES.map(([t, label]) => `<button data-theme-set="${t}" class="${s.theme === t ? 'active' : ''}" aria-pressed="${s.theme === t}">${label}</button>`).join('')}
        </div>`)}

      ${guideSection()}
      ${sprintsSection(s.useSprints !== false)}
      ${categoriesSection()}
      ${dataSection()}

      ${section('Instalar', 'phone', ctx.standalone
    ? '<p class="muted">LifeLine está instalada en este dispositivo.</p>'
    : ctx.installPrompt
      ? `<p class="muted">Tenla como una app más, a pantalla completa y disponible sin conexión.</p>
         <button class="btn btn-primary" data-install>${icon('download')}<span>Instalar LifeLine</span></button>`
      : `<p class="muted">En el móvil, abre el menú del navegador y elige «Añadir a pantalla de inicio». En el ordenador, usa el icono de instalar de la barra de direcciones.</p>`)}

      ${section('Acerca de', 'info', `
        <p class="about"><svg class="brand-logo" aria-hidden="true"><use href="#logo"/></svg><span><b>LifeLine</b><small>Organiza. Registra. Avanza.</small></span></p>
        <p class="muted">Versión ${APP_VERSION}</p>`)}
    </div>`;
}

export function mount(root, ctx) {
  // El nombre se guarda mientras se escribe, sin repintar.
  root.querySelector('[data-name]')?.addEventListener('input', (e) => setSetting('name', e.target.value.trim(), { silent: true }));

  root.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
    setSetting('theme', b.dataset.themeSet);
    ctx.applyTheme();
  }));

  root.querySelector('[data-use-sprints]')?.addEventListener('change', (e) => {
    setSetting('useSprints', e.target.checked);
    toast(e.target.checked ? 'Sprints activados' : 'Sprints desactivados');
  });

  root.querySelector('[data-cat-new]')?.addEventListener('click', () => openCategoryForm());
  root.querySelectorAll('[data-cat-sub]').forEach((b) => b.addEventListener('click', () => openCategoryForm({ parentId: b.dataset.catSub })));
  root.querySelectorAll('[data-cat-edit]').forEach((b) => b.addEventListener('click', () => openCategoryForm({ id: b.dataset.catEdit })));
  root.querySelectorAll('[data-cat-move]').forEach((b) => b.addEventListener('click', () => moveCategory(b.dataset.catMove, Number(b.dataset.dir))));
  root.querySelectorAll('[data-cat-remove]').forEach((b) => b.addEventListener('click', async () => {
    const cat = getState().categories.find((c) => c.id === b.dataset.catRemove);
    if (!cat) return;
    const parent = cat.parentId ? getState().categories.find((c) => c.id === cat.parentId) : null;
    const subs = subcategories(cat.id).length;
    const message = parent
      ? `Se eliminará «${esc(cat.name)}». Lo que estuviera clasificado en ella pasa a «${esc(parent.name)}».`
      : subs
        ? `Se eliminará «${esc(cat.name)}» con sus ${plural(subs, 'subcategoría', 'subcategorías')}. Lo que estuviera clasificado en ellas se conserva, sin categoría.`
        : `Se eliminará «${esc(cat.name)}». Lo que estuviera clasificado en ella se conserva, sin categoría.`;
    const ok = await confirmDialog({ title: parent ? 'Eliminar subcategoría' : 'Eliminar categoría', message });
    if (ok) removeCategory(cat.id);
  }));

  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadText(`lifeline-${todayKey()}.json`, exportJSON());
    toast('Copia descargada');
  });

  const file = root.querySelector('[data-import-file]');
  root.querySelector('[data-import]')?.addEventListener('click', () => file.click());
  file?.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    const text = await f.text();
    const ok = await confirmDialog({
      title: 'Restaurar copia',
      message: `Lo que hay ahora se sustituirá por el contenido de «${esc(f.name)}». Antes se guarda una copia automática de lo actual.`,
      confirmText: 'Restaurar',
      danger: false,
    });
    if (!ok) return;
    try {
      importJSON(text);
      ctx.applyTheme();
      toast('Copia restaurada');
    } catch (e) {
      console.warn(e);
      toast('Ese archivo no es una copia de LifeLine', 4000);
    }
  });

  root.querySelectorAll('[data-copy-download]').forEach((b) => b.addEventListener('click', () => {
    const { backup, rescues } = safetyCopies();
    if (b.dataset.copyDownload === 'backup' && backup) downloadText(`lifeline-copia-${todayKey()}.json`, backup.raw);
    if (b.dataset.copyDownload === 'rescue') rescues.forEach((r, i) => downloadText(`lifeline-rescate-${todayKey()}-${i + 1}.json`, r.raw));
  }));
  root.querySelectorAll('[data-copy-discard]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Descartar copia', message: 'Se eliminará esta copia de seguridad. Lo que usas ahora queda igual.', confirmText: 'Descartar' });
    if (ok) { discardSafetyCopy(b.dataset.copyDiscard); ctx.rerender(); }
  }));

  root.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Borrar todo',
      message: 'Se borrarán tus tareas, proyectos, eventos, sprints, diario, notas e historial de este dispositivo. Descarga antes una copia si quieres conservarlos.',
      confirmText: 'Borrar todo',
    });
    if (ok) { resetAll(); ctx.applyTheme(); toast('Datos borrados'); }
  });

  root.querySelector('[data-install]')?.addEventListener('click', () => ctx.install());
}
