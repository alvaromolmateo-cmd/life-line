// Fechas: claves de día 'AAAA-MM-DD' en hora local, semanas de lunes a domingo y formatos en español.

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toKey(new Date());
export const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const isKey = (key) => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && toKey(parseKey(key)) === key;
export const isTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export const addDays = (key, n) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
export const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 864e5);

export const weekStart = (key) => addDays(key, -((parseKey(key).getDay() + 6) % 7));
export const weekDays = (key) => {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const monthOf = (key) => key.slice(0, 7);
export const currentMonth = () => monthOf(todayKey());
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

// Último día del mes.
export const monthEnd = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return toKey(new Date(y, m, 0));
};

// Semanas completas, de lunes a domingo, que cubren el mes.
export const monthWeeks = (ym) => {
  const weeks = [];
  let start = weekStart(`${ym}-01`);
  do {
    weeks.push(weekDays(start));
    start = addDays(start, 7);
  } while (monthOf(start) === ym);
  return weeks;
};

// Número de semana ISO.
export const isoWeek = (key) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
};

// ---------- Formatos ----------
const F = (opts) => new Intl.DateTimeFormat('es-ES', opts);
const fLong = F({ weekday: 'long', day: 'numeric', month: 'long' });
const fLongYear = F({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fShort = F({ weekday: 'short', day: 'numeric', month: 'short' });
const fShortYear = F({ day: 'numeric', month: 'short', year: 'numeric' });
const fDayMonth = F({ day: 'numeric', month: 'short' });
const fMonth = F({ month: 'long', year: 'numeric' });
const fWeekday = F({ weekday: 'short' });
const fTime = F({ hour: '2-digit', minute: '2-digit' });

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sameYear = (key) => key.slice(0, 4) === todayKey().slice(0, 4);

// «lunes, 16 de noviembre»
export const fmtLong = (key) => (sameYear(key) ? fLong : fLongYear).format(parseKey(key));
// «lun, 16 nov»
export const fmtShort = (key) => (sameYear(key) ? fShort : fShortYear).format(parseKey(key));
// «16 nov»
export const fmtDayMonth = (key) => fDayMonth.format(parseKey(key));
// «Noviembre de 2026»
export const fmtMonth = (ym) => cap(fMonth.format(parseKey(`${ym}-01`)));
// «lun»
export const fmtWeekday = (key) => fWeekday.format(parseKey(key)).replace('.', '');

// «Hoy», «Mañana», «Ayer» o la fecha corta.
export const fmtRelative = (key) => {
  const diff = diffDays(key, todayKey());
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return cap(fmtShort(key));
};

// «16 – 22 nov 2026»
export const fmtWeekRange = (key) => {
  const days = weekDays(key);
  const a = parseKey(days[0]);
  const b = parseKey(days[6]);
  const year = b.getFullYear();
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${fDayMonth.format(b)} ${year}`;
  return `${fDayMonth.format(a)} – ${fDayMonth.format(b)} ${year}`;
};

export const fmtTimeRange = (start, end) => {
  if (!start) return 'Todo el día';
  return end ? `${start} – ${end}` : start;
};

// «14:32»
export const fmtTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fTime.format(d);
};

// «ene», «feb»…
const fMonthShort = F({ month: 'short' });
export const fmtMonthShort = (ym) => fMonthShort.format(parseKey(`${ym}-01`)).replace('.', '');

// Momento de un registro del historial: «Hoy, 14:32», «Ayer, 09:10», «12 nov, 18:00».
export const fmtMoment = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const key = toKey(d);
  const diff = diffDays(key, todayKey());
  const day = diff === 0 ? 'Hoy' : diff === -1 ? 'Ayer' : (sameYear(key) ? fDayMonth : fShortYear).format(d);
  return `${day}, ${fTime.format(d)}`;
};
