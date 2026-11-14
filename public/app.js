const API = 'https://api.fenegosida.org/api/website/v1/Dashboard';
const DAYS = 15;
const $ = (s) => document.querySelector(s);
const num = (n) => Number(n).toLocaleString('en-IN');
const state = { today: [], series: [], metal: 'gold' };

// Nepali keywords inside `rateType`: सुन = gold, चाँदी = silver, तोला = tola
const KEY = { gold: 'सुन', silver: 'चाँदी' };

// Try the API directly; if the browser blocks it (CORS), use the local proxy from server.js.
async function getJSON(path) {
  try {
    const r = await fetch(API + path);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch {
    const r = await fetch('/proxy' + path);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
}

const rows = (d) => (Array.isArray(d) ? d : d?.data ?? d?.result ?? []);
const tolaRow = (list, metal) =>
  list.find((r) => r.rateType?.includes(KEY[metal]) && r.rateType.includes('तोला'));
const tolaRate = (list, metal) => {
  const r = tolaRow(list, metal);
  const v = Number(r?.todayBaseRatePerGram ?? r?.baseRatePerGram ?? r?.rate);
  return Number.isFinite(v) && v > 0 ? v : null;
};

// Nepal calendar date (YYYY-MM-DD) so "today" is right wherever the browser is.
const npDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(d);
const label = (iso, weekday) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(weekday ? { weekday: 'short' } : {}), timeZone: 'UTC',
  });

// The 15 dates before today, oldest first: today-15 ... today-1
function pastDates() {
  const base = new Date(npDate(new Date()) + 'T00:00:00Z');
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - (DAYS - i));
    return d.toISOString().slice(0, 10);
  });
}

// Past days never change, so cache each one in localStorage after the first fetch.
async function fetchDay(date) {
  const key = 'fx:' + date;
  try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  try {
    const list = rows(await getJSON('/datewisehistory?date=' + date));
    const v = { date, gold: tolaRate(list, 'gold'), silver: tolaRate(list, 'silver') };
    if (v.gold != null || v.silver != null) {
      try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
    }
    return v;
  } catch {
    return { date, gold: null, silver: null };
  }
}

const deltaHTML = (d, p) => {
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  const icon = d > 0 ? '▲' : d < 0 ? '▼' : '–';
  return `<span class="delta ${cls}">${icon} ${num(Math.abs(d))} (${Math.abs(p).toFixed(2)}%)</span>`;
};

function renderCards() {
  const title = { gold: 'Gold, hallmarked', silver: 'Silver, pure' };
  $('#cards').innerHTML = ['gold', 'silver'].map((m) => {
    const r = tolaRow(state.today, m);
    if (!r) return `<article class="card" data-metal="${m}"><h3>${title[m]}</h3><p class="sub">No rate published for this metal today.</p></article>`;
    const now = r.todayBaseRatePerGram, prev = r.yestardayBaseRatePerGram;
    return `<article class="card" data-metal="${m}">
      <h3>${title[m]} · per tola</h3>
      <div class="price"><small>Rs</small>${num(now)}</div>
      ${deltaHTML(now - prev, ((now - prev) / prev) * 100)}
      <p class="sub">Previous rate Rs ${num(prev)} on ${label(npDate(new Date(r.yestardayDate)))}</p>
    </article>`;
  }).join('');
}

function renderChart() {
  const m = state.metal, el = $('#chart');
  el.dataset.metal = m;
  const pts = state.series.filter((p) => p[m] != null);
  if (pts.length < 2) { el.innerHTML = '<p class="empty">Not enough published rates yet to draw a trend.</p>'; return; }
  const W = 720, H = 260, L = 64, R = 16, T = 16, B = 30;
  const vals = pts.map((p) => p[m]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || hi * 0.01) * 0.2; lo -= pad; hi += pad;
  const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[m]).toFixed(1)}`).join('');
  const grid = [0, 0.5, 1].map((t) => {
    const v = lo + (hi - lo) * t;
    return `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${num(Math.round(v))}</text>`;
  }).join('');
  const step = Math.ceil(pts.length / 6);
  const xl = pts.map((p, i) => (i % step === 0 || i === pts.length - 1)
    ? `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${label(p.date)}</text>` : '').join('');
  const dots = pts.map((p, i) =>
    `<circle class="dot${i === pts.length - 1 ? ' now' : ''}" cx="${x(i)}" cy="${y(p[m])}" r="4"><title>${label(p.date, true)}: Rs ${num(p[m])}</title></circle>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${m} rate per tola, last ${pts.length} published days">
    ${grid}<path class="area" d="${line}L${x(pts.length - 1)} ${H - B}L${x(0)} ${H - B}Z"/>
    <path class="stroke" d="${line}"/>${dots}${xl}</svg>`;
}

function renderTable() {
  const s = state.series;
  const cell = (i, m) => {
    const v = s[i][m];
    if (v == null) return ['<td class="na">No rate</td>', '<td class="na">–</td>'];
    let j = i - 1; while (j >= 0 && s[j][m] == null) j--;
    const d = j >= 0 ? v - s[j][m] : null;
    return [`<td>Rs ${num(v)}</td>`, `<td>${d == null ? '<span class="na">–</span>' : deltaHTML(d, (d / s[j][m]) * 100)}</td>`];
  };
  $('#rows').innerHTML = s.map((p, i) => {
    const [g, gd] = cell(i, 'gold'), [sv, sd] = cell(i, 'silver');
    return `<tr class="${i === s.length - 1 ? 'today' : ''}"><td>${label(p.date, true)}${i === s.length - 1 ? ' (latest)' : ''}</td>${g}${gd}${sv}${sd}</tr>`;
  }).reverse().join('');
}

async function load() {
  const btn = $('#refresh');
  btn.disabled = true;
  $('#status').textContent = 'Loading rates…';
  $('#cards').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const [today, history] = await Promise.all([getJSON('/today'), Promise.all(pastDates().map(fetchDay))]);
    state.today = rows(today);
    if (!state.today.length) throw new Error('empty');
    // Latest published date comes from the API, which may be earlier than the calendar date.
    const latest = npDate(new Date(state.today[0].todayDate));
    state.series = history
      .filter((h) => h.date !== latest)
      .concat({ date: latest, gold: tolaRate(state.today, 'gold'), silver: tolaRate(state.today, 'silver') })
      .sort((a, b) => a.date.localeCompare(b.date));
    renderCards(); renderChart(); renderTable();
    const found = history.filter((h) => h.gold != null || h.silver != null).length;
    $('#status').textContent = `Latest rates from ${label(latest, true)} · ${found} of ${DAYS} past days had published rates`;
  } catch {
    $('#cards').innerHTML = '';
    $('#status').textContent = 'Could not load rates. Check your connection, or run the app with "npm start" so the proxy can reach the API.';
  } finally {
    btn.disabled = false;
  }
}

document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
  state.metal = b.dataset.metal;
  document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  renderChart();
}));
$('#refresh').addEventListener('click', load);
setInterval(load, 10 * 60 * 1000);
load();
