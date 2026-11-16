// Diario: qué ha ocurrido y cómo se ha vivido. Entradas libres, sin formulario, ordenadas de la más
// reciente a la más antigua, con búsqueda, filtros y enlaces opcionales a proyectos y eventos.

import { esc, icon, multiline, plural, toast } from '../ui.js';
import { getState, addJournal, toggleJournalStar } from '../store.js';
import { journal, journalOf, categories, categoryOf, categoryPath, inCategory, projectOf, eventOf, fold } from '../query.js';
import { emptyState, categoryChip, tagChips } from '../components.js';
import { openJournalForm } from '../forms.js';
import { todayKey, toKey, monthOf, fmtLong, fmtMonth, fmtDayMonth, fmtTime, cap } from '../dates.js';

export const NO_FILTER = { text: '', category: '', project: '', month: '', starred: false };

const isLong = (j) => j.text.length > 700 || j.text.split('\n').length > 10;

// Una entrada. En la lista, las largas se recortan y se abren en su propia página.
function entryCard(j, { full = false } = {}) {
  const project = projectOf(j.projectId);
  const event = eventOf(j.eventId);
  const clamp = !full && isLong(j);
  const day = cap(fmtLong(j.date));
  // La hora solo acompaña a lo escrito el mismo día que cuenta.
  const time = toKey(new Date(j.createdAt)) === j.date ? fmtTime(j.createdAt) : '';
  const meta = [
    categoryChip(j.categoryId),
    project ? `<a class="chip" href="#/proyectos/${project.id}">${icon('folder')}${esc(project.title)}</a>` : '',
    event ? `<button class="chip" data-act="open-event" data-id="${event.id}">${icon('calendar')}${esc(event.title)}</button>` : '',
    tagChips(j.tags),
  ].join('');
  return `
    <article class="card journal-entry ${j.starred ? 'starred' : ''}">
      <header class="journal-head">
        <a class="ev-day" href="#/diario/${j.id}" style="--c:var(--c-${j.starred ? 'amber' : 'indigo'})" aria-label="${esc(day)}">
          <b>${Number(j.date.slice(8))}</b><small>${esc(fmtDayMonth(j.date).split(' ')[1] || '')}</small>
        </a>
        <div class="journal-titles">
          <h2>${esc(j.title || day)}</h2>
          ${j.title || time ? `<p class="muted small">${esc([j.title ? day : '', time].filter(Boolean).join(' · '))}</p>` : ''}
        </div>
        <button class="icon-btn sm star ${j.starred ? 'on' : ''}" data-star="${j.id}" aria-pressed="${j.starred}" aria-label="Momento importante" title="Momento importante">${icon('star')}</button>
        <button class="icon-btn sm" data-act="open-journal" data-id="${j.id}" aria-label="Editar entrada">${icon('edit')}</button>
      </header>
      <div class="journal-text ${clamp ? 'clamp' : ''}">${multiline(j.text.trim())}</div>
      ${clamp ? `<a class="more-link" href="#/diario/${j.id}">Seguir leyendo</a>` : ''}
      ${meta.trim() ? `<p class="task-meta">${meta}</p>` : ''}
    </article>`;
}

function applyFilter(list, f) {
  const words = fold(f.text).split(/\s+/).filter(Boolean);
  return list.filter((j) => inCategory(j.categoryId, f.category)
    && (!f.project || j.projectId === f.project)
    && (!f.month || monthOf(j.date) === f.month)
    && (!f.starred || j.starred)
    && (!words.length || words.every((w) => fold(`${j.title}\n${j.text}\n${j.tags.join(' ')}`).includes(w))));
}

function filtersBar(all, f) {
  const select = (key, label, pairs) => (pairs.length ? `
    <label class="filter">
      <span class="sr-only">${label}</span>
      <select data-jfilter="${key}" data-fk="jfilter-${key}" class="${f[key] ? 'on' : ''}">
        <option value="">${label}</option>
        ${pairs.map(([v, text]) => `<option value="${esc(v)}"${f[key] === v ? ' selected' : ''}>${esc(text)}</option>`).join('')}
      </select>
    </label>` : '');
  const months = [...new Set(all.map((j) => monthOf(j.date)))];
  // Una categoría principal se ofrece si se usa ella o alguna de sus subcategorías.
  const usedCats = new Set(all.flatMap((j) => [j.categoryId, categoryOf(j.categoryId)?.parentId]).filter(Boolean));
  const usedProjects = new Set(all.map((j) => j.projectId));
  const active = f.text || f.category || f.project || f.month || f.starred;
  return `
    <div class="filters journal-filters">
      <label class="filter-search">
        ${icon('search')}
        <input type="search" data-jsearch data-fk="journal-search" value="${esc(f.text)}" autocomplete="off" placeholder="Buscar en el diario" aria-label="Buscar en el diario">
      </label>
      ${months.length > 1 ? select('month', 'Cualquier fecha', months.map((m) => [m, fmtMonth(m)])) : ''}
      ${select('category', 'Categoría', categories().filter((c) => usedCats.has(c.id)).map((c) => [c.id, categoryPath(c.id)]))}
      ${select('project', 'Proyecto', getState().projects.filter((p) => usedProjects.has(p.id)).map((p) => [p.id, p.title]))}
      ${all.some((j) => j.starred) ? `<button class="btn btn-sm toggle ${f.starred ? 'on' : ''}" data-jstar aria-pressed="${f.starred}">${icon('star')}<span>Importantes</span></button>` : ''}
      ${active ? `<button class="btn btn-ghost btn-sm" data-jclear>${icon('x')}<span>Quitar filtros</span></button>` : ''}
    </div>`;
}

// ---------- Lista ----------
function listView(ctx) {
  const all = journal();
  const f = ctx.journalFilter;
  const list = applyFilter(all, f);
  const today = todayKey();
  const groups = new Map();
  for (const j of list) {
    const m = monthOf(j.date);
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(j);
  }
  return `
    <header class="page-head">
      <div>
        <h1>Diario</h1>
        <p class="sub">${all.length ? esc(plural(all.length, 'entrada', 'entradas')) : 'Lo que ha ocurrido y cómo lo has vivido.'}</p>
      </div>
      <button class="btn btn-primary" data-act="new-journal">${icon('plus')}<span>Nueva entrada</span></button>
    </header>

    <form class="card composer" data-compose>
      <textarea name="text" rows="3" data-fk="journal-draft" aria-label="Entrada de hoy" placeholder="Escribe con libertad lo que ha pasado hoy, lo que piensas o lo que quieres recordar">${esc(ctx.journalDraft)}</textarea>
      <div class="composer-foot">
        <span class="muted small">${esc(cap(fmtLong(today)))}</span>
        <span class="spacer"></span>
        <button type="button" class="btn btn-sm btn-ghost" data-compose-more>Más opciones</button>
        <button class="btn btn-primary btn-sm">Guardar entrada</button>
      </div>
    </form>

    ${all.length ? filtersBar(all, f) : ''}
    ${!all.length ? emptyState('book', 'Tu diario empieza aquí', 'Cada entrada queda guardada con su día para que puedas volver a ella.') : ''}
    ${all.length && !list.length ? emptyState('search', 'Ninguna entrada con esos filtros') : ''}
    <div class="journal">
      ${[...groups].map(([m, entries]) => `
        <section class="group">
          <p class="group-title">${esc(fmtMonth(m))} <span class="count">${entries.length}</span></p>
          <div class="journal-list">${entries.map((j) => entryCard(j)).join('')}</div>
        </section>`).join('')}
    </div>`;
}

// ---------- Una entrada ----------
function entryView(j) {
  const all = journal();
  const i = all.findIndex((x) => x.id === j.id);
  const newer = all[i - 1];
  const older = all[i + 1];
  return `
    <a class="back-link" href="#/diario">${icon('arrow-left')}<span>Diario</span></a>
    <div class="journal-single">
      ${entryCard(j, { full: true })}
      <nav class="journal-nav" aria-label="Otras entradas">
        ${older ? `<a class="btn btn-ghost" href="#/diario/${older.id}">${icon('arrow-left')}<span>Anterior</span></a>` : '<span></span>'}
        ${newer ? `<a class="btn btn-ghost" href="#/diario/${newer.id}"><span>Siguiente</span>${icon('arrow-right')}</a>` : ''}
      </nav>
    </div>`;
}

// ---------- Vista ----------
export function render(ctx) {
  if (!ctx.param) return listView(ctx);
  const entry = journalOf(ctx.param);
  if (!entry) {
    return `
      <a class="back-link" href="#/diario">${icon('arrow-left')}<span>Diario</span></a>
      ${emptyState('book', 'Esta entrada ya no existe')}`;
  }
  return entryView(entry);
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-star]').forEach((b) => b.addEventListener('click', () => toggleJournalStar(b.dataset.star)));

  const form = root.querySelector('[data-compose]');
  if (!form) return;
  const text = form.elements.text;
  // El borrador se conserva al cambiar de apartado.
  text.addEventListener('input', () => { ctx.journalDraft = text.value; });
  const clear = () => { ctx.journalDraft = ''; text.value = ''; };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!text.value.trim()) { text.focus(); return; }
    const value = text.value;
    clear();
    addJournal({ date: todayKey(), text: value });
    toast('Entrada guardada en el diario');
  });
  // Ctrl + Intro guarda sin soltar el teclado.
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  root.querySelector('[data-compose-more]').addEventListener('click', () => {
    openJournalForm({ defaults: { text: text.value }, onSaved: () => { clear(); ctx.rerender(); } });
  });

  const setFilter = (patch) => ctx.set('journalFilter', { ...ctx.journalFilter, ...patch });
  root.querySelector('[data-jsearch]')?.addEventListener('input', (e) => setFilter({ text: e.target.value }));
  root.querySelectorAll('[data-jfilter]').forEach((el) => el.addEventListener('change', () => setFilter({ [el.dataset.jfilter]: el.value })));
  root.querySelector('[data-jstar]')?.addEventListener('click', () => setFilter({ starred: !ctx.journalFilter.starred }));
  root.querySelector('[data-jclear]')?.addEventListener('click', () => ctx.set('journalFilter', { ...NO_FILTER }));
}
