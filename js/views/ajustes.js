// Ajustes: nombre, apariencia, categorías, copia de los datos e instalación.

import { esc, icon, confirmDialog, toast, downloadText, plural } from '../ui.js';
import {
  getState, setSetting, moveCategory, removeCategory, exportJSON, importJSON, resetAll,
  safetyCopies, discardSafetyCopy, storageInfo, hasSaveError,
} from '../store.js';
import { categories } from '../query.js';
import { openCategoryForm } from '../forms.js';
import { todayKey, fmtMoment } from '../dates.js';

export const APP_VERSION = '0.1.0'; // la misma que VERSION en sw.js

const THEMES = [['auto', 'Como el dispositivo'], ['light', 'Claro'], ['dark', 'Oscuro']];

const section = (title, ic, body, sub = '') => `
  <section class="card settings-card">
    <header class="card-head"><h2 class="card-title">${icon(ic)}<span>${title}</span></h2></header>
    ${sub ? `<p class="card-sub">${sub}</p>` : ''}
    ${body}
  </section>`;

function categoriesSection() {
  const list = categories();
  const st = getState();
  const uses = (id) => st.tasks.filter((t) => t.categoryId === id).length
    + st.projects.filter((p) => p.categoryId === id).length
    + st.events.filter((e) => e.categoryId === id).length;
  return section('Categorías', 'tag', `
    <div class="list">
      ${list.map((c, i) => `
        <div class="cat-row">
          <i class="dot lg" style="--c:var(--c-${c.color})"></i>
          <span class="cat-name">${esc(c.name)}<small>${uses(c.id) ? plural(uses(c.id), 'elemento', 'elementos') : 'Sin usar'}</small></span>
          <button class="icon-btn sm" data-cat-move="${c.id}" data-dir="-1" aria-label="Subir"${i === 0 ? ' disabled' : ''}>${icon('arrow-up')}</button>
          <button class="icon-btn sm" data-cat-move="${c.id}" data-dir="1" aria-label="Bajar"${i === list.length - 1 ? ' disabled' : ''}>${icon('arrow-down')}</button>
          <button class="icon-btn sm" data-cat-edit="${c.id}" aria-label="Editar ${esc(c.name)}">${icon('edit')}</button>
          <button class="icon-btn sm" data-cat-remove="${c.id}" aria-label="Eliminar ${esc(c.name)}">${icon('trash')}</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-sm" data-cat-new>${icon('plus')}<span>Nueva categoría</span></button>`,
  'Sirven para clasificar tareas, proyectos y eventos, y para filtrar.');
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
  ].join(' · ');
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

  root.querySelector('[data-cat-new]')?.addEventListener('click', () => openCategoryForm());
  root.querySelectorAll('[data-cat-edit]').forEach((b) => b.addEventListener('click', () => openCategoryForm({ id: b.dataset.catEdit })));
  root.querySelectorAll('[data-cat-move]').forEach((b) => b.addEventListener('click', () => moveCategory(b.dataset.catMove, Number(b.dataset.dir))));
  root.querySelectorAll('[data-cat-remove]').forEach((b) => b.addEventListener('click', async () => {
    const cat = getState().categories.find((c) => c.id === b.dataset.catRemove);
    if (!cat) return;
    const ok = await confirmDialog({
      title: 'Eliminar categoría',
      message: `Se eliminará «${esc(cat.name)}». Lo que estuviera clasificado en ella se conserva, sin categoría.`,
    });
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
      message: 'Se borrarán tus tareas, proyectos, eventos, notas e historial de este dispositivo. Descarga antes una copia si quieres conservarlos.',
      confirmText: 'Borrar todo',
    });
    if (ok) { resetAll(); ctx.applyTheme(); toast('Datos borrados'); }
  });

  root.querySelector('[data-install]')?.addEventListener('click', () => ctx.install());
}
