// Utilidades de interfaz: escape de HTML, iconos, modal, menú desplegable y avisos.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

// Texto con saltos de línea respetados.
export const multiline = (s) => esc(s).replace(/\n/g, '<br>');

// Plural sencillo: plural(3, 'tarea', 'tareas') → «3 tareas».
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Modal ----------
// Solo hay un modal a la vez. Los marcados como `live` se vuelven a pintar cuando cambian los datos;
// los formularios no, para no perder lo que se está escribiendo.
let modal = null;

const panelEl = () => document.querySelector('#modal .modal-panel');

export function openModal(opts) {
  closeMenu();
  modal = opts;
  drawModal();
  const panel = panelEl();
  const first = panel.querySelector('[autofocus]');
  if (first) {
    first.focus();
    if (first.select && first.value) first.select();
  }
}

export function refreshModal() {
  if (modal?.live) drawModal(true);
}

export const isModalOpen = () => !!modal;

export function closeModal() {
  if (!modal) return;
  const active = document.activeElement;
  if (active && document.getElementById('modal').contains(active)) active.blur();
  const onClose = modal.onClose;
  modal = null;
  document.getElementById('modal').innerHTML = '';
  document.body.classList.remove('modal-open');
  onClose?.();
}

function drawModal(keepScroll = false) {
  const host = document.getElementById('modal');
  const prev = keepScroll ? panelEl()?.querySelector('.modal-body')?.scrollTop : 0;
  host.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal-panel ${modal.size || ''}" role="dialog" aria-modal="true">${modal.render()}</div>`;
  document.body.classList.add('modal-open');
  host.querySelector('[data-close]').addEventListener('click', closeModal);
  host.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', closeModal));
  const panel = panelEl();
  modal.mount?.(panel);
  if (prev) {
    const body = panel.querySelector('.modal-body');
    if (body) body.scrollTop = prev;
  }
}

export function modalHeader(title, sub = '') {
  return `
    <div class="modal-head">
      <div class="modal-titles">
        <div class="modal-title">${title}</div>
        ${sub ? `<div class="modal-sub">${sub}</div>` : ''}
      </div>
      <button type="button" class="icon-btn" data-modal-close aria-label="Cerrar">${icon('x')}</button>
    </div>`;
}

export function confirmDialog({ title, message, confirmText = 'Eliminar', danger = true }) {
  return new Promise((resolve) => {
    let done = false;
    openModal({
      size: 'sm',
      render: () => `
        ${modalHeader(esc(title))}
        <div class="modal-body"><p class="muted">${message}</p></div>
        <div class="modal-foot">
          <button class="btn" data-modal-close>Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok autofocus>${esc(confirmText)}</button>
        </div>`,
      mount: (panel) => {
        panel.querySelector('[data-ok]').addEventListener('click', () => {
          done = true;
          closeModal();
          resolve(true);
        });
      },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

// ---------- Menú desplegable ----------
let menuAnchor = null;

export function closeMenu() {
  const host = document.getElementById('menu');
  if (!host || !menuAnchor) return;
  host.innerHTML = '';
  menuAnchor.setAttribute('aria-expanded', 'false');
  menuAnchor = null;
}

// items: [{ label, icon, hint, onClick }]
export function openMenu(anchor, items) {
  if (menuAnchor === anchor) { closeMenu(); return; }
  closeMenu();
  const host = document.getElementById('menu');
  host.innerHTML = `
    <div class="menu" role="menu">
      ${items.map((it, i) => `
        <button class="menu-item" role="menuitem" data-i="${i}">
          ${it.icon ? `<span class="menu-icon" style="--c:var(--c-${it.color || 'indigo'})">${icon(it.icon)}</span>` : ''}
          <span class="menu-text"><span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span>
        </button>`).join('')}
    </div>`;
  const el = host.firstElementChild;
  const r = anchor.getBoundingClientRect();
  const width = Math.min(280, window.innerWidth - 16);
  el.style.width = `${width}px`;
  el.style.left = `${Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))}px`;
  el.style.top = `${r.bottom + 8}px`;
  menuAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const item = items[Number(b.dataset.i)];
    closeMenu();
    item.onClick?.();
  }));
  el.querySelector('[data-i]')?.focus();
}

document.addEventListener('click', (e) => {
  if (!menuAnchor) return;
  if (e.target.closest('#menu') || e.target.closest('[aria-haspopup="menu"]') === menuAnchor) return;
  closeMenu();
}, true);
window.addEventListener('resize', closeMenu);
window.addEventListener('hashchange', closeMenu);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (menuAnchor) closeMenu();
  else if (modal) closeModal();
});

// ---------- Aviso breve ----------
let toastTimer = null;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Descarga un texto como archivo.
export function downloadText(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
