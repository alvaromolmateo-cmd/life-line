// Registros: qué se ha hecho y cómo ha ido cambiando con el tiempo. Se mira por semanas, meses o años.
// El resumen cuenta lo ocurrido en el periodo, la cronología lo ordena día a día y la actividad
// enseña el historial completo de cambios.

import { esc, icon, plural } from '../ui.js';
import { getState, EVENT_TYPE_LABEL, ENTRY_KIND_LABEL } from '../store.js';
import {
  topCategories, subcategories, inCategory, projectOf, journalHeading, sprintsOn, sprintStats, sprintState, SPRINT_STATE_LABEL, isOpen,
} from '../query.js';
import { emptyState, activityRow, statusBadge, progressBar } from '../components.js';
import {
  todayKey, toKey, addDays, addMonths, monthOf, monthEnd, weekStart, weekDays, isoWeek, diffDays,
  fmtLong, fmtMonth, fmtMonthShort, fmtWeekRange, fmtTime, fmtTimeRange, cap,
} from '../dates.js';

const MODES = [['week', 'Semana'], ['month', 'Mes'], ['year', 'Año']];
const TABS = [['', 'Resumen'], ['cronologia', 'Cronología'], ['actividad', 'Actividad']];
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const LIMIT = 150;

const dayOf = (iso) => toKey(new Date(iso));

// ---------- Periodo ----------
function period({ mode, day }) {
  if (mode === 'week') {
    const from = weekStart(day);
    return { from, to: addDays(from, 6), title: fmtWeekRange(day), sub: `Semana ${isoWeek(day)}`, unit: 'Semana' };
  }
  if (mode === 'year') {
    const y = day.slice(0, 4);
    return { from: `${y}-01-01`, to: `${y}-12-31`, title: y, sub: '', unit: 'Año' };
  }
  const ym = monthOf(day);
  return { from: `${ym}-01`, to: monthEnd(ym), title: fmtMonth(ym), sub: '', unit: 'Mes' };
}

const step = ({ mode, day }, n) => {
  if (mode === 'week') return addDays(day, 7 * n);
  if (mode === 'year') return `${Number(day.slice(0, 4)) + n}-01-01`;
  return `${addMonths(monthOf(day), n)}-01`;
};

// Lo ocurrido en el periodo, sacado de los datos tal como están ahora.
function collect(p) {
  const st = getState();
  const today = todayKey();
  const inRange = (key) => key >= p.from && key <= p.to;
  const done = st.tasks.filter((t) => !isOpen(t) && t.completedAt && inRange(dayOf(t.completedAt)));
  const events = st.events.filter((e) => inRange(e.date) && e.date <= today);
  const entries = st.journal.filter((j) => inRange(j.date));
  const notes = [];
  for (const proj of st.projects) {
    for (const e of proj.entries) if (inRange(dayOf(e.at))) notes.push({ ...e, project: proj });
  }
  const sprints = sprintsOn()
    ? st.sprints.filter((s) => s.start <= p.to && addDays(s.start, 6) >= p.from && s.start <= today).sort((a, b) => b.start.localeCompare(a.start))
    : [];
  return { done, events, entries, notes, sprints };
}

// ---------- Gráfico ----------
// Columnas de un solo tono: una por día o por mes, con el valor al pasar por encima.
function columnChart(points, label) {
  const max = Math.max(...points.map((pt) => pt.value));
  const top = Math.max(max, 2);
  const marked = points.findIndex((pt) => pt.value === max);
  const cols = points.map((pt, i) => {
    const side = i < points.length / 3 ? 'tip-l' : i >= (points.length * 2) / 3 ? 'tip-r' : '';
    const showValue = pt.value > 0 && (points.length <= 12 || i === marked);
    const inner = `
      <span class="chart-track">
        ${showValue ? `<span class="chart-value" style="bottom:${(pt.value / top) * 100}%">${pt.value}</span>` : ''}
        ${pt.value ? `<span class="chart-bar" style="height:${(pt.value / top) * 100}%"></span>` : ''}
      </span>
      <span class="chart-tip ${side}"><b>${esc(pt.tip)}</b>${esc(pt.value ? plural(pt.value, 'tarea hecha', 'tareas hechas') : 'Sin tareas hechas')}</span>`;
    // Enfocable para que el valor se pueda leer también con el teclado y al tocar en el móvil.
    return `<div class="chart-col ${pt.now ? 'now' : ''}" tabindex="0" role="img" aria-label="${esc(pt.tip)} – ${pt.value}">${inner}</div>`;
  }).join('');
  return `
    <figure class="chart" aria-label="${esc(label)}">
      <div class="chart-plot">
        <span class="chart-grid" style="bottom:100%"><i>${top}</i></span>
        <span class="chart-grid" style="bottom:50%">${top % 2 === 0 ? `<i>${top / 2}</i>` : ''}</span>
        <div class="chart-cols">${cols}</div>
      </div>
      <div class="chart-axis">${points.map((pt) => `<span class="${pt.now ? 'now' : ''}">${esc(pt.label)}</span>`).join('')}</div>
    </figure>`;
}

function chartPoints(p, mode, done) {
  const today = todayKey();
  const perDay = new Map();
  for (const t of done) {
    const key = dayOf(t.completedAt);
    perDay.set(key, (perDay.get(key) || 0) + 1);
  }
  if (mode === 'year') {
    const y = p.from.slice(0, 4);
    return Array.from({ length: 12 }, (_, i) => {
      const ym = `${y}-${String(i + 1).padStart(2, '0')}`;
      let value = 0;
      for (const [key, n] of perDay) if (monthOf(key) === ym) value += n;
      return { label: fmtMonthShort(ym), tip: fmtMonth(ym), value, now: ym === monthOf(today) };
    });
  }
  const days = mode === 'week' ? weekDays(p.from) : Array.from({ length: diffDays(p.to, p.from) + 1 }, (_, i) => addDays(p.from, i));
  return days.map((key, i) => {
    const n = Number(key.slice(8));
    const label = mode === 'week' ? `${DOW[i]} ${n}` : (n === 1 || n % 5 === 0 ? String(n) : '');
    return { label, tip: cap(fmtLong(key)), value: perDay.get(key) || 0, now: key === today };
  });
}

// ---------- Resumen ----------
const tile = (n, one, many, ic) => `
  <div class="stat">
    <span class="stat-icon">${icon(ic)}</span>
    <b>${n}</b>
    <span>${n === 1 ? one : many}</span>
  </div>`;

function summaryView(p, mode, data) {
  const { done, events, entries, notes, sprints } = data;
  const progress = notes.filter((n) => n.kind === 'progress');
  if (!done.length && !events.length && !entries.length && !notes.length && !sprints.length) {
    return emptyState('chart', 'Periodo en blanco', 'Lo que hagas, lo que ocurra y lo que escribas irá apareciendo aquí.');
  }

  // Tareas hechas por categoría, de más a menos.
  // Cada categoría principal cuenta también lo de sus subcategorías, que se desglosan debajo.
  const byCat = topCategories()
    .map((c) => ({
      name: c.name,
      color: c.color,
      n: done.filter((t) => inCategory(t.categoryId, c.id)).length,
      subs: subcategories(c.id)
        .map((sc) => ({ name: sc.name, color: sc.color, n: done.filter((t) => t.categoryId === sc.id).length }))
        .filter((sc) => sc.n)
        .sort((a, b) => b.n - a.n),
    }))
    .concat([{ name: 'Sin categoría', color: 'slate', n: done.filter((t) => !t.categoryId).length, subs: [] }])
    .filter((c) => c.n)
    .sort((a, b) => b.n - a.n);
  const catMax = Math.max(1, ...byCat.map((c) => c.n));

  // Proyectos en los que ha habido movimiento.
  const moved = getState().projects
    .map((proj) => ({
      proj,
      done: done.filter((t) => t.projectId === proj.id).length,
      notes: notes.filter((n) => n.project.id === proj.id).length,
    }))
    .filter((m) => m.done || m.notes)
    .sort((a, b) => (b.done + b.notes) - (a.done + a.notes));

  const starred = entries.filter((j) => j.starred).sort((a, b) => b.date.localeCompare(a.date));
  const chartTitle = mode === 'year' ? 'Tareas hechas por mes' : 'Tareas hechas por día';

  return `
    <div class="stats">
      ${tile(done.length, 'Tarea hecha', 'Tareas hechas', 'check')}
      ${tile(events.length, 'Evento', 'Eventos', 'calendar')}
      ${tile(entries.length, 'Entrada del diario', 'Entradas del diario', 'book')}
      ${tile(progress.length, 'Avance en proyectos', 'Avances en proyectos', 'trending')}
      ${sprintsOn() ? tile(sprints.length, 'Sprint', 'Sprints', 'sprint') : ''}
    </div>

    <div class="reg-layout">
      <div class="reg-main">
        <section class="card">
          <header class="card-head">
            <h2 class="card-title">${icon('chart')}<span>${chartTitle}</span></h2>
            <a class="card-link" href="#/registros/cronologia">Ver la cronología${icon('arrow-right')}</a>
          </header>
          ${done.length ? columnChart(chartPoints(p, mode, done), chartTitle) : '<p class="day-empty">Las tareas que completes en este periodo se verán aquí.</p>'}
        </section>

        ${moved.length ? `
          <section class="card">
            <header class="card-head"><h2 class="card-title">${icon('folder')}<span>Proyectos con movimiento</span></h2></header>
            <div class="list">
              ${moved.map((m) => `
                <a class="reg-row" href="#/proyectos/${m.proj.id}">
                  <span class="reg-row-body">
                    <span class="reg-row-title">${esc(m.proj.title)}</span>
                    <small>${esc([m.done ? plural(m.done, 'tarea hecha', 'tareas hechas') : '', m.notes ? plural(m.notes, 'nota o avance', 'notas y avances') : ''].filter(Boolean).join(' · '))}</small>
                  </span>
                  ${statusBadge(m.proj.status)}
                </a>`).join('')}
            </div>
          </section>` : ''}

        ${sprints.length ? `
          <section class="card">
            <header class="card-head"><h2 class="card-title">${icon('sprint')}<span>Sprints</span></h2></header>
            <div class="list">
              ${sprints.map((s) => {
    const stats = sprintStats(s);
    const state = sprintState(s);
    return `
                <a class="reg-row sprint-row" href="#/sprints/${s.start}">
                  <span class="reg-row-body">
                    <span class="reg-row-title">${esc(s.goal.trim() || `Semana ${fmtWeekRange(s.start)}`)}</span>
                    <small>${esc([s.goal.trim() ? fmtWeekRange(s.start) : '', stats.total ? `${stats.done} de ${plural(stats.total, 'tarea hecha', 'tareas hechas')}` : ''].filter(Boolean).join(' · '))}</small>
                    ${stats.total ? progressBar(stats.done, stats.total) : ''}
                  </span>
                  <span class="badge badge-${state}">${SPRINT_STATE_LABEL[state]}</span>
                </a>`;
  }).join('')}
            </div>
          </section>` : ''}
      </div>

      <aside class="reg-side">
        ${byCat.length ? `
          <section class="card">
            <header class="card-head"><h2 class="card-title">${icon('tag')}<span>Tareas hechas por categoría</span></h2></header>
            <div class="hbars">
              ${byCat.map((c) => `
                <div class="hbar">
                  <span class="hbar-label"><i class="dot" style="--c:var(--c-${c.color})"></i>${esc(c.name)}</span>
                  <b>${c.n}</b>
                  <span class="hbar-track"><span style="width:${(c.n / catMax) * 100}%"></span></span>
                </div>
                ${c.subs.map((sc) => `
                  <div class="hbar hbar-sub">
                    <span class="hbar-label"><i class="dot" style="--c:var(--c-${sc.color})"></i>${esc(sc.name)}</span>
                    <b>${sc.n}</b>
                    <span class="hbar-track"><span style="width:${(sc.n / catMax) * 100}%;background:var(--c-${sc.color})"></span></span>
                  </div>`).join('')}`).join('')}
            </div>
          </section>` : ''}

        ${starred.length ? `
          <section class="card">
            <header class="card-head"><h2 class="card-title">${icon('star')}<span>Momentos importantes</span></h2></header>
            <div class="list">
              ${starred.map((j) => `
                <a class="reg-row" href="#/diario/${j.id}">
                  <span class="reg-row-body">
                    <span class="reg-row-title">${esc(journalHeading(j))}</span>
                    <small>${esc(cap(fmtLong(j.date)))}</small>
                  </span>
                </a>`).join('')}
            </div>
          </section>` : ''}
      </aside>
    </div>`;
}

// ---------- Cronología ----------
const KINDS = [['', 'Todo'], ['task', 'Tareas'], ['event', 'Eventos'], ['journal', 'Diario'], ['project', 'Proyectos'], ['sprint', 'Sprints']];

// Lista agrupada por días, del más reciente al más antiguo.
function dayGroups(items, row) {
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.day)) groups.set(it.day, []);
    groups.get(it.day).push(it);
  }
  return [...groups].map(([day, list]) => `
    <section class="group">
      <p class="group-title">${esc(cap(fmtLong(day)))} <span class="count">${list.length}</span></p>
      <div class="card list-card">${list.map(row).join('')}</div>
    </section>`).join('');
}

const capped = (items) => (items.length > LIMIT
  ? `<p class="muted small reg-more">Se muestran los ${LIMIT} más recientes de ${items.length}. Acota el periodo para ver el resto.</p>`
  : '');

function timelineView(p, data, kind) {
  const st = getState();
  const inRange = (key) => key >= p.from && key <= p.to;
  const items = [];
  const add = (k, day, at, title, sub, ic, link, ok = false) => items.push({ kind: k, day, at, title, sub, ic, link, ok });

  for (const t of data.done) {
    add('task', dayOf(t.completedAt), t.completedAt, t.title, ['Tarea hecha', fmtTime(t.completedAt), projectOf(t.projectId)?.title].filter(Boolean).join(' · '), 'check', `data-act="open-task" data-id="${t.id}"`, true);
  }
  for (const e of data.events) {
    add('event', e.date, `${e.date}T${e.start || '00:00'}`, e.title, [EVENT_TYPE_LABEL[e.type], fmtTimeRange(e.start, e.end), e.place].filter(Boolean).join(' · '), 'calendar', `data-act="open-event" data-id="${e.id}"`);
  }
  for (const j of data.entries) {
    add('journal', j.date, `${j.date}T23:59`, journalHeading(j), j.starred ? 'Diario · Momento importante' : 'Diario', j.starred ? 'star' : 'book', `href="#/diario/${j.id}"`);
  }
  for (const n of data.notes) {
    add('project', dayOf(n.at), n.at, n.text.split('\n')[0].slice(0, 140), `${ENTRY_KIND_LABEL[n.kind]} · ${n.project.title}`, { note: 'note', idea: 'bulb', progress: 'trending' }[n.kind], `href="#/proyectos/${n.project.id}"`);
  }
  for (const proj of st.projects) {
    if (inRange(dayOf(proj.createdAt))) add('project', dayOf(proj.createdAt), proj.createdAt, proj.title, 'Proyecto empezado', 'folder', `href="#/proyectos/${proj.id}"`);
    if (proj.completedAt && inRange(dayOf(proj.completedAt))) add('project', dayOf(proj.completedAt), proj.completedAt, proj.title, 'Proyecto terminado', 'folder', `href="#/proyectos/${proj.id}"`, true);
  }
  if (sprintsOn()) {
    for (const s of st.sprints) {
      if (!s.closedAt || !inRange(dayOf(s.closedAt))) continue;
      const stats = sprintStats(s);
      add('sprint', dayOf(s.closedAt), s.closedAt, s.goal.trim() || `Semana ${fmtWeekRange(s.start)}`, ['Sprint cerrado', stats.total ? `${stats.done} de ${plural(stats.total, 'tarea hecha', 'tareas hechas')}` : ''].filter(Boolean).join(' · '), 'sprint', `href="#/sprints/${s.start}"`);
    }
  }

  const kinds = KINDS.filter(([k]) => k !== 'sprint' || sprintsOn());
  const count = (k) => (k ? items.filter((it) => it.kind === k).length : items.length);
  const shown = items
    .filter((it) => !kind || it.kind === kind)
    .sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at));

  const row = (it) => {
    const tag = it.link.startsWith('href') ? 'a' : 'button';
    return `
      <${tag} class="act act-link" ${it.link}>
        <span class="act-icon ${it.ok ? 'ok' : ''}">${icon(it.ic)}</span>
        <span class="act-body"><span class="act-title">${esc(it.title)}</span><small>${esc(it.sub)}</small></span>
      </${tag}>`;
  };

  return `
    <div class="filters">
      ${kinds.map(([k, label]) => `
        <button class="btn btn-sm toggle ${k === kind ? 'on' : ''}" data-reg-kind="${k}" aria-pressed="${k === kind}">
          ${label}${count(k) ? `<span class="count">${count(k)}</span>` : ''}
        </button>`).join('')}
    </div>
    ${shown.length
    ? `${dayGroups(shown.slice(0, LIMIT), row)}${capped(shown)}`
    : emptyState('clock', items.length ? 'Nada de ese tipo en este periodo' : 'Periodo en blanco', items.length ? '' : 'Las tareas que completes, los eventos y lo que escribas quedarán ordenados aquí por días.')}`;
}

// ---------- Actividad ----------
function activityView(p) {
  const items = getState().activity
    .filter((a) => sprintsOn() || a.kind !== 'sprint')
    .map((a) => ({ ...a, day: dayOf(a.at) }))
    .filter((a) => a.day >= p.from && a.day <= p.to)
    .reverse();
  return items.length
    ? `${dayGroups(items.slice(0, LIMIT), activityRow)}${capped(items)}`
    : emptyState('activity', 'Sin actividad en este periodo', 'Cada alta, cada tarea completada y cada cambio de estado deja aquí su apunte.');
}

// ---------- Vista ----------
export function render(ctx) {
  const tab = TABS.some(([t]) => t === ctx.param) ? ctx.param : '';
  const { mode } = ctx.reg;
  const p = period(ctx.reg);
  const today = todayKey();
  const current = today >= p.from && today <= p.to;
  return `
    <header class="page-head cal-head">
      <div class="cal-nav">
        <button class="icon-btn" data-reg-step="-1" aria-label="${p.unit} anterior">${icon('chevron-left')}</button>
        <button class="icon-btn" data-reg-step="1" aria-label="${p.unit} siguiente"${p.to >= today ? ' disabled' : ''}>${icon('chevron-right')}</button>
        <div class="cal-titles">
          <h1>${esc(p.title)}</h1>
          <p class="eyebrow">${esc(['Registros', p.sub].filter(Boolean).join(' · '))}</p>
        </div>
      </div>
      <div class="cal-tools">
        <button class="btn" data-reg-today${current ? ' disabled' : ''}>Hoy</button>
        <div class="seg" role="group" aria-label="Periodo">
          ${MODES.map(([m, label]) => `<button data-reg-mode="${m}" class="${m === mode ? 'active' : ''}" aria-pressed="${m === mode}">${label}</button>`).join('')}
        </div>
      </div>
    </header>
    <nav class="tabs" aria-label="Registros">
      ${TABS.map(([t, label]) => `<a class="tab ${t === tab ? 'active' : ''}" href="#/registros${t ? `/${t}` : ''}"${t === tab ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
    ${tab === 'cronologia' ? timelineView(p, collect(p), ctx.regKind) : tab === 'actividad' ? activityView(p) : summaryView(p, mode, collect(p))}`;
}

export function mount(root, ctx) {
  const go = (patch) => ctx.set('reg', { ...ctx.reg, ...patch });
  root.querySelectorAll('[data-reg-step]').forEach((b) => b.addEventListener('click', () => go({ day: step(ctx.reg, Number(b.dataset.regStep)) })));
  root.querySelector('[data-reg-today]')?.addEventListener('click', () => go({ day: todayKey() }));
  root.querySelectorAll('[data-reg-mode]').forEach((b) => b.addEventListener('click', () => {
    // Al cambiar de periodo se parte de hoy si cae dentro del que se estaba mirando.
    const p = period(ctx.reg);
    const today = todayKey();
    go({ mode: b.dataset.regMode, day: today >= p.from && today <= p.to ? today : p.from });
  }));
  root.querySelectorAll('[data-reg-kind]').forEach((b) => b.addEventListener('click', () => ctx.set('regKind', b.dataset.regKind)));
}
