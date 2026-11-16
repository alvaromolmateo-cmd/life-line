// Ordenar arrastrando. Con ratón se pulsa una fila y se arrastra; en una pantalla táctil se mantiene
// pulsada un momento y se arrastra, para que deslizar el dedo siga moviendo la página. Cerca del borde
// de la pantalla la página se desplaza sola. Escape deshace el arrastre y Alt + ↑ / ↓ mueve con el teclado.
//
// Marcado:
//   [data-sort-list="clave"]  Lista donde se puede soltar. Sus hijos [data-sort-id] son las filas.
//   [data-sort-group]         En cada fila, su grupo (la prioridad). Una fila solo se coloca entre las de
//                             su grupo y los grupos siguen el orden de `groups`: lo que se arrastra nunca
//                             se cuela por encima de algo más prioritario.
//   [data-sort-zone]          Opcional, alrededor de una lista: estar sobre ella cuenta como estar sobre
//                             la lista. En el tablero del sprint es la columna entera, con su título.
//   [data-sort-empty]         Opcional, dentro de una lista: el texto de lista vacía.
//
// sortable(container, { groups, onDrop }) conecta las listas de `container` (o `container` si es una).
// Al soltar, si algo ha cambiado, llama a onDrop({ id, from, to, ids }): la fila, la clave de la lista
// de origen y la de destino, y las filas de la de destino en su nuevo orden.

const HOLD_MS = 350; // pulsación larga en pantallas táctiles
const SLOP_TOUCH = 10; // lo que puede moverse el dedo antes de que cuente como desplazar la página
const SLOP_MOUSE = 5; // lo que hay que mover el ratón para empezar a arrastrar
const EDGE = 64; // franja junto a las barras fijas en la que la página se desplaza sola
const IGNORE = 'input, textarea, select, a[href], .check, .icon-btn, [data-no-drag]';

let drag = null; // arrastre en curso o a punto de empezar
let swallowUntil = 0; // el clic que llega tras soltar no abre la tarea
let swallowNext = false; // tras cancelar con Escape, hasta que se suelte

const rows = (list) => [...list.children].filter((el) => el.matches('[data-sort-id]'));
const idsOf = (list) => rows(list).map((el) => el.dataset.sortId);
const nextRow = (el) => {
  let n = el.nextElementSibling;
  while (n && !n.matches('[data-sort-id]')) n = n.nextElementSibling;
  return n;
};
const listsOf = (container) => (container.matches('[data-sort-list]') ? [container] : [...container.querySelectorAll('[data-sort-list]')]);

// La fila que se puede empezar a arrastrar desde ese punto, si la hay.
function rowAt(target, container) {
  const item = target.closest?.('[data-sort-id]');
  if (!item || !container.contains(item) || !item.parentElement?.matches('[data-sort-list]')) return null;
  const skip = target.closest(IGNORE);
  return skip && item.contains(skip) ? null : item;
}

export function sortable(container, opts) {
  const begin = (item, kind, x, y) => {
    drag = { item, container, opts, kind, startX: x, startY: y, x, y, active: false, timer: 0, raf: 0 };
  };
  // Si la vista se repintó a mitad de un arrastre, aquel ya no llegará a terminar: se descarta.
  const stale = () => {
    if (drag && !(drag.item.isConnected && drag.container.isConnected)) cleanup(drag);
  };

  container.addEventListener('pointerdown', (e) => {
    stale();
    if (drag || e.pointerType === 'touch' || e.button !== 0) return;
    const item = rowAt(e.target, container);
    if (item) begin(item, 'mouse', e.clientX, e.clientY);
  });

  container.addEventListener('touchstart', (e) => {
    stale();
    if (drag) {
      // Un segundo dedo es un gesto de zoom, no un arrastre.
      if (drag.kind === 'touch' && e.touches.length > 1) cancel();
      return;
    }
    if (e.touches.length !== 1) return;
    const item = rowAt(e.target, container);
    if (!item) return;
    const t = e.touches[0];
    begin(item, 'touch', t.clientX, t.clientY);
    drag.touchId = t.identifier;
    drag.timer = setTimeout(start, HOLD_MS);
  }, { passive: true });

  // El dedo sigue en la fila que tocó, que no sale de `container`: aquí llegan todos sus movimientos.
  // No pasivo para poder frenar el desplazamiento de la página una vez empezado el arrastre.
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: false });
  container.addEventListener('touchcancel', onTouchCancel);

  // La pulsación larga abre en Android el menú contextual; aquí empieza el arrastre.
  container.addEventListener('contextmenu', (e) => {
    if (drag?.kind === 'touch' && drag.container === container) e.preventDefault();
  });

  container.addEventListener('keydown', (e) => moveWithKeys(e, container, opts));
}

// ---------- Arrastre ----------
function start() {
  const d = drag;
  if (!d || d.active) return;
  clearTimeout(d.timer);
  if (!d.item.isConnected) { drag = null; return; }
  d.active = true;
  d.lists = listsOf(d.container);
  d.origin = { list: d.item.parentElement, next: d.item.nextSibling };
  d.from = d.origin.list.dataset.sortList;
  d.before = idsOf(d.origin.list);
  d.group = d.item.dataset.sortGroup;

  // La fila se queda en la lista como hueco y una copia sigue al puntero.
  const r = d.item.getBoundingClientRect();
  d.offsetX = d.x - r.left + 10;
  d.offsetY = d.y - r.top;
  const ghost = d.item.cloneNode(true);
  ghost.removeAttribute('data-sort-id');
  ghost.classList.add('drag-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${r.width + 20}px`;
  document.body.appendChild(ghost);
  d.ghost = ghost;
  moveGhost(d);

  d.item.classList.add('sort-placeholder');
  for (const list of d.lists) {
    for (const el of rows(list)) el.classList.toggle('sort-off', el.dataset.sortGroup !== d.group);
  }
  d.container.classList.add('sorting');
  document.body.classList.add('is-sorting');
  window.getSelection()?.removeAllRanges();
  if (d.kind === 'touch') navigator.vibrate?.(12);

  // Barras fijas (la superior y, en el móvil, la de abajo): el desplazamiento automático empieza junto a ellas.
  const bar = (sel) => {
    const el = document.querySelector(sel);
    return el && getComputedStyle(el).position !== 'static' && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect() : null;
  };
  d.top = Math.max(0, bar('.topbar')?.bottom || 0);
  d.bottom = bar('.tabbar')?.top || window.innerHeight;
  d.raf = requestAnimationFrame(tick);
}

function moveGhost(d) {
  d.ghost.style.transform = `translate3d(${Math.round(d.x - d.offsetX)}px, ${Math.round(d.y - d.offsetY)}px, 0)`;
}

function move(x, y) {
  const d = drag;
  d.x = x;
  d.y = y;
  if (!d.active) {
    if (d.kind !== 'mouse' || Math.hypot(x - d.startX, y - d.startY) < SLOP_MOUSE) return;
    start();
    if (!drag) return;
  }
  if (!d.moved && Math.hypot(x - d.startX, y - d.startY) > 8) d.moved = true;
  moveGhost(d);
  place(d);
}

// Coloca el hueco donde iría la fila si se soltara ahora, siempre dentro de su grupo.
function place(d) {
  const under = document.elementFromPoint(d.x, d.y);
  const zone = under?.closest('[data-sort-zone], [data-sort-list]');
  let list = zone && (zone.matches('[data-sort-list]') ? zone : zone.querySelector('[data-sort-list]'));
  // Fuera de cualquier lista, sigue en la que está y solo cuenta la altura.
  if (!list || !d.lists.includes(list)) list = d.item.parentElement;

  const { groups = [] } = d.opts;
  const rank = (el) => groups.indexOf(el.dataset.sortGroup);
  const others = rows(list).filter((el) => el !== d.item);
  const same = others.filter((el) => el.dataset.sortGroup === d.group);
  let before;
  if (same.length) {
    before = same.find((el) => {
      const r = el.getBoundingClientRect();
      return d.y < r.top + r.height / 2;
    });
    if (!before) before = others[others.indexOf(same[same.length - 1]) + 1] || null;
  } else {
    // Sin filas de su grupo, va donde le toca: tras las más prioritarias y antes que las demás.
    before = others.find((el) => rank(el) > rank(d.item)) || null;
  }
  if (d.item.parentElement === list && nextRow(d.item) === before) return;
  list.insertBefore(d.item, before || list.querySelector(':scope > [data-sort-empty]'));
  showEmpty(d.lists);
}

function showEmpty(lists) {
  for (const list of lists) list.querySelector(':scope > [data-sort-empty]')?.toggleAttribute('hidden', rows(list).length > 0);
}

// Cerca de las barras fijas, la página se desplaza sola; más rápido cuanto más cerca del borde.
function tick() {
  const d = drag;
  if (!d?.active) return;
  if (d.moved) {
    const upTo = d.top + EDGE;
    const downFrom = d.bottom - EDGE;
    const speed = (depth) => Math.min(22, Math.ceil(depth / 3));
    const dy = d.y < upTo ? -speed(upTo - d.y) : d.y > downFrom ? speed(d.y - downFrom) : 0;
    if (dy) {
      const was = window.scrollY;
      window.scrollBy(0, dy);
      if (window.scrollY !== was) place(d);
    }
  }
  d.raf = requestAnimationFrame(tick);
}

function cleanup(d) {
  clearTimeout(d.timer);
  cancelAnimationFrame(d.raf);
  d.ghost?.remove();
  d.item.classList.remove('sort-placeholder');
  d.container.classList.remove('sorting');
  for (const el of d.container.querySelectorAll('.sort-off')) el.classList.remove('sort-off');
  document.body.classList.remove('is-sorting');
  drag = null;
}

function finish() {
  const d = drag;
  if (!d.active) { cleanup(d); return; }
  swallowUntil = Date.now() + 400;
  const list = d.item.parentElement;
  cleanup(d);
  if (!d.item.isConnected || !list?.dataset.sortList) return;
  const to = list.dataset.sortList;
  const ids = idsOf(list);
  if (to === d.from && ids.join('\n') === d.before.join('\n')) return;
  d.opts.onDrop({ id: d.item.dataset.sortId, from: d.from, to, ids });
}

// Deja la fila donde estaba.
function cancel() {
  const d = drag;
  if (!d) return;
  if (d.active) {
    if (d.origin.list.isConnected) d.origin.list.insertBefore(d.item, d.origin.next);
    showEmpty(d.lists);
    swallowNext = true;
  }
  cleanup(d);
}

const touchOf = (e) => [...e.changedTouches].find((t) => t.identifier === drag?.touchId);

document.addEventListener('pointermove', (e) => {
  if (drag?.kind === 'mouse' && e.pointerType !== 'touch') move(e.clientX, e.clientY);
});
document.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch' && swallowNext) { swallowNext = false; swallowUntil = Date.now() + 400; }
  if (drag?.kind === 'mouse') finish();
});
document.addEventListener('pointercancel', (e) => {
  if (drag?.kind === 'mouse' && e.pointerType !== 'touch') cancel();
});

function onTouchMove(e) {
  if (drag?.kind !== 'touch') return;
  const t = touchOf(e);
  if (!t) return;
  if (!drag.active) {
    drag.x = t.clientX;
    drag.y = t.clientY;
    // Se ha movido antes de tiempo: está desplazando la página, no arrastrando.
    if (Math.hypot(t.clientX - drag.startX, t.clientY - drag.startY) > SLOP_TOUCH) cleanup(drag);
    return;
  }
  // Si la página ya había empezado a desplazarse, no se puede parar: mejor no arrastrar.
  if (!e.cancelable) { cancel(); return; }
  e.preventDefault();
  move(t.clientX, t.clientY);
}

function onTouchEnd(e) {
  if (swallowNext && !e.touches.length) { swallowNext = false; swallowUntil = Date.now() + 400; }
  if (drag?.kind !== 'touch' || !touchOf(e)) return;
  // Sin esto, soltar tras una pulsación larga abriría la tarea.
  if (drag.active && e.cancelable) e.preventDefault();
  finish();
}

function onTouchCancel(e) {
  if (drag?.kind === 'touch' && touchOf(e)) cancel();
}

window.addEventListener('click', (e) => {
  if (Date.now() > swallowUntil) return;
  swallowUntil = 0;
  e.preventDefault();
  e.stopPropagation();
}, true);

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !drag?.active) return;
  e.preventDefault();
  e.stopPropagation();
  cancel();
}, true);

window.addEventListener('blur', () => { if (drag) cancel(); });

// ---------- Teclado ----------
// Alt + ↑ / ↓ sobre una fila la sube o la baja un puesto entre las de su grupo. El foco se queda en ella.
function moveWithKeys(e, container, opts) {
  if (drag || !e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  const item = e.target.closest('[data-sort-id]');
  const list = item?.parentElement;
  if (!item || !container.contains(item) || !list?.matches('[data-sort-list]')) return;
  e.preventDefault();
  const same = rows(list).filter((el) => el.dataset.sortGroup === item.dataset.sortGroup);
  const i = same.indexOf(item);
  const j = i + (e.key === 'ArrowUp' ? -1 : 1);
  if (j < 0 || j >= same.length) return;
  const focusAt = [...item.querySelectorAll('*')].indexOf(e.target);
  list.insertBefore(item, j < i ? same[j] : same[j].nextSibling);
  const id = item.dataset.sortId;
  const key = list.dataset.sortList;
  opts.onDrop({ id, from: key, to: key, ids: idsOf(list) });
  // La vista se ha vuelto a pintar: el foco vuelve al mismo sitio de la misma fila.
  const again = document.querySelector(`[data-sort-list="${CSS.escape(key)}"] > [data-sort-id="${CSS.escape(id)}"]`);
  const target = focusAt >= 0 ? again?.querySelectorAll('*')[focusAt] : again;
  target?.focus?.();
}
