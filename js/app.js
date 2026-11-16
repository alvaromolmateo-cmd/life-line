// Arranque: enrutado por hash, render de vistas, acciones globales, tema, service worker e instalación.

import { getState, subscribe, rescuedOnLoad, toggleTask, toggleEventDone, setSetting } from './store.js';
import { refreshModal, isModalOpen, toast, openMenu } from './ui.js';
import { currentMonth, todayKey, monthOf } from './dates.js';
import { openTaskForm, openEventForm, openProjectForm, openJournalForm, openOrganize, openQuickAdd } from './forms.js';
import { sprintsOn } from './query.js';
import { openSearch } from './search.js';
import * as inicio from './views/inicio.js';
import * as calendario from './views/calendario.js';
import * as tareas from './views/tareas.js';
import * as proyectos from './views/proyectos.js';
import * as sprints from './views/sprints.js';
import * as diario from './views/diario.js';
import * as registros from './views/registros.js';
import * as ajustes from './views/ajustes.js';

const views = { inicio, calendario, tareas, proyectos, sprints, diario, registros, ajustes };
const titles = {
  inicio: 'Inicio', calendario: 'Calendario', tareas: 'Tareas', proyectos: 'Proyectos',
  sprints: 'Sprints', diario: 'Diario', registros: 'Registros', ajustes: 'Ajustes',
};

// Estado de pantalla: lo que se está mirando, que no forma parte de los datos guardados.
const ctx = {
  param: '',
  homeMonth: currentMonth(),
  cal: { mode: getState().settings.calendarMode, day: todayKey() },
  taskFilter: { category: '', project: '', priority: '' },
  projectFilter: 'active',
  entryKind: 'note',
  showDone: false,
  journalFilter: { ...diario.NO_FILTER },
  journalDraft: '',
  reg: { mode: 'month', day: todayKey() },
  regKind: '',
  installPrompt: null,
  get standalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  },
  set(key, value) { ctx[key] = value; render(); },
  rerender: () => render(),
  applyTheme,
  async install() {
    if (!ctx.installPrompt) return;
    ctx.installPrompt.prompt();
    const { outcome } = await ctx.installPrompt.userChoice;
    if (outcome === 'accepted') ctx.installPrompt = null;
    render();
  },
};

function currentRoute() {
  const [name = '', param = ''] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  return views[name] ? { name, param: decodeURIComponent(param) } : { name: 'inicio', param: '' };
}

let lastPath = null;
let lastDay = todayKey();

function render() {
  const { name, param } = currentRoute();
  const view = views[name];
  const root = document.getElementById('view');
  ctx.param = param;

  // Conserva el foco y lo escrito en los campos marcados con data-fk, que se repintan con la vista.
  const active = document.activeElement;
  const focus = active?.dataset?.fk && root.contains(active)
    ? { fk: active.dataset.fk, value: active.value, start: active.selectionStart, end: active.selectionEnd, text: active.tagName !== 'SELECT' }
    : null;

  root.innerHTML = view.render(ctx);
  view.mount(root, ctx);

  if (focus) {
    const el = root.querySelector(`[data-fk="${focus.fk}"]`);
    if (el) {
      if (focus.text) el.value = focus.value;
      el.focus({ preventScroll: true });
      if (focus.text) { try { el.setSelectionRange(focus.start, focus.end); } catch { /* campo sin selección */ } }
    }
  }

  document.querySelectorAll('[data-nav]').forEach((a) => {
    // «Más», en la barra del móvil, reúne varios apartados.
    const on = a.dataset.nav.split(' ').includes(name);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = name === 'inicio' ? 'LifeLine' : `${titles[name]} · LifeLine`;
  refreshShell();

  const path = `${name}/${param}`;
  if (path !== lastPath) {
    window.scrollTo(0, 0);
    // Una ruta puede apuntar a una sección concreta de la vista, como #/ajustes/sprints.
    if (param) root.querySelector(`[data-anchor="${CSS.escape(param)}"]`)?.scrollIntoView({ block: 'start' });
    lastPath = path;
  }
}

function refreshShell() {
  const count = getState().inbox.length;
  document.querySelectorAll('[data-inbox-count]').forEach((el) => {
    el.hidden = !count;
    el.textContent = count;
    el.setAttribute('aria-label', `${count} en la bandeja de entrada`);
  });
  document.querySelectorAll('[data-install-shell]').forEach((el) => { el.hidden = !ctx.installPrompt || ctx.standalone; });
  document.querySelectorAll('[data-module="sprints"]').forEach((el) => { el.hidden = !sprintsOn(); });
}

const isDark = () => {
  const t = getState().settings.theme;
  return t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

function applyTheme() {
  const t = getState().settings.theme;
  const html = document.documentElement;
  if (t === 'auto') html.removeAttribute('data-theme'); else html.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark() ? '#101019' : '#f4f4fb');
}

// Lleva el calendario a un día concreto.
function goToDay(key) {
  ctx.cal = { ...ctx.cal, day: key };
  ctx.homeMonth = monthOf(key);
  if (currentRoute().name === 'calendario') render(); else location.hash = '#/calendario';
}

// ---------- Acciones globales ----------
// Cualquier elemento con data-act, esté en una vista, en la barra superior o en un modal.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id, date, project } = el.dataset;
  switch (act) {
    case 'toggle-task': toggleTask(id); break;
    case 'open-task': openTaskForm({ id }); break;
    case 'new-task': openTaskForm({ defaults: { due: date || '', projectId: project || '' } }); break;
    case 'open-event': openEventForm({ id }); break;
    case 'toggle-event': toggleEventDone(id); break;
    case 'new-event': openEventForm({ defaults: { ...(date ? { date } : {}), projectId: project || '' } }); break;
    case 'new-project': openProjectForm(); break;
    case 'edit-project': openProjectForm({ id }); break;
    case 'organize': openOrganize(id); break;
    case 'goto-day': goToDay(date); break;
    case 'search': openSearch({ goToDay }); break;
    case 'quick-add': openQuickAdd(el, currentRoute().name === 'calendario' ? { date: ctx.cal.day, due: ctx.cal.day } : {}); break;
    case 'new-journal': openJournalForm({ defaults: { ...(date ? { date } : {}), projectId: project || '' } }); break;
    case 'open-journal': openJournalForm({ id }); break;
    case 'more':
      openMenu(el, [
        ...(sprintsOn() ? [{ label: 'Sprints', hint: 'Planificación semanal', icon: 'sprint', color: 'indigo', onClick: () => { location.hash = '#/sprints'; } }] : []),
        { label: 'Diario', hint: 'Reflexiones y recuerdos', icon: 'book', color: 'pink', onClick: () => { location.hash = '#/diario'; } },
        { label: 'Registros', hint: 'Historial y evolución', icon: 'chart', color: 'teal', onClick: () => { location.hash = '#/registros'; } },
        { label: 'Ajustes', hint: 'Preferencias y copia de tus datos', icon: 'settings', color: 'slate', onClick: () => { location.hash = '#/ajustes'; } },
      ]);
      break;
    case 'toggle-theme':
      setSetting('theme', isDark() ? 'light' : 'dark');
      applyTheme();
      break;
    default:
  }
});

// Ctrl K o «/» abren el buscador.
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const combo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
  if (combo || (e.key === '/' && !typing && !isModalOpen())) {
    e.preventDefault();
    openSearch({ goToDay });
  }
});

window.addEventListener('hashchange', render);
subscribe(() => { render(); refreshModal(); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// Si la app queda abierta y cambia el día, vuelve a pintar para que «hoy» sea el día correcto.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayKey() !== lastDay) {
    if (ctx.cal.day === lastDay) ctx.cal = { ...ctx.cal, day: todayKey() };
    if (ctx.reg.day === lastDay) ctx.reg = { ...ctx.reg, day: todayKey() };
    lastDay = todayKey();
    ctx.homeMonth = currentMonth();
    if (!isModalOpen()) render();
  }
});

// Instalación como app
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ctx.installPrompt = e;
  refreshShell();
  if (currentRoute().name === 'ajustes') render();
});
window.addEventListener('appinstalled', () => {
  ctx.installPrompt = null;
  toast('LifeLine instalada');
  render();
});
document.querySelectorAll('[data-install-shell]').forEach((b) => b.addEventListener('click', () => ctx.install()));

// Service worker (solo funciona en https o localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker no registrado:', err));
  });
}

applyTheme();
render();

if (rescuedOnLoad) toast('No se pudieron abrir tus datos guardados. Están apartados en Ajustes, sin borrar.', 8000);
