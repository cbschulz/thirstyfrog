import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';

const sandbox = createContext({ Math, JSON, Number, String, Object, Date, Intl });
sandbox.globalThis = sandbox;
runInContext(readFileSync(new URL('./engine.js', import.meta.url), 'utf8'), sandbox);
const X = sandbox.Crossbar;

let fail = 0;
function has(name, html, needle) {
  if (!html.includes(needle)) { fail++; console.error('FAIL', name, 'missing', needle); }
  else console.log('pass', name);
}
function lacks(name, html, needle) {
  if (html.includes(needle)) { fail++; console.error('FAIL', name, 'unexpected', needle); }
  else console.log('pass', name);
}

const ids = Object.keys(X.MARKETS).concat(Object.keys(X.PROPS));
ids.forEach(function (mid) {
  const html = X.chartHtml(mid, {});
  has(mid + ' frame', html, 'class="chart"');
  has(mid + ' wait', html, 'Waiting for first matched trade');
  has(mid + ' axis 0', html, '>0<');
  has(mid + ' axis 100', html, '>100<');
  lacks(mid + ' no line yet', html, '<path ');
  lacks(mid + ' no invented point', html, '<circle ');
  lacks(mid + ' no estimate', html, 'pregame');
});
has('yes label', X.chartHtml('ml', {}), 'Oakridge ¢');
has('no label', X.chartHtml('ml', {}), 'Country Day is 100¢');
has('over label', X.chartHtml('p_homan_rush', {}), 'Over 58.5 ¢');
has('under label', X.chartHtml('p_stadler_tck', {}), 'Under 4.5 is 100¢');

function acct(state, uid) {
  state.accounts[uid] = { bal: X.GRANT, n: uid, tag: uid.slice(0, 4) };
}
let s = X.blank();
acct(s, 'alice');
acct(s, 'bob');
acct(s, 'cara');
const t1 = Date.parse('2026-11-07T21:00:00.000Z');
const t2 = Date.parse('2026-11-07T21:30:00.000Z');
let r = X.submit(s, { id: 'yesorder001', uid: 'alice', mid: 'ml', side: 'yes', px: 40, shares: 2, t: t1, fillId: 'fill00000001' });
s = r.state;
r = X.submit(s, { id: 'noorder0001', uid: 'bob', mid: 'ml', side: 'no', px: 70, shares: 2, t: t1 + 1000, fillId: 'fill00000001' });
if (r.error) { console.error('match1', r.error); process.exit(1); }
s = r.state;
const one = X.chartHtml('ml', s.fills);
has('one price', one, 'cy="60.8"');
has('one point', one, '<circle ');
has('one time', one, 'Nov 7, 3:00 PM');
lacks('one no line', one, '<path ');
has('one is the engine price', one, Object.values(s.fills)[0].yesPay === 40 ? 'cy="60.8"' : 'WRONG PRICE');
lacks('other market stays empty', X.chartHtml('spd', s.fills), '<circle ');

r = X.submit(s, { id: 'yesorder002', uid: 'alice', mid: 'ml', side: 'yes', px: 55, shares: 1, t: t2, fillId: 'fill00000002' });
s = r.state;
r = X.submit(s, { id: 'noorder0002', uid: 'cara', mid: 'ml', side: 'no', px: 50, shares: 1, t: t2 + 1000, fillId: 'fill00000002' });
if (r.error) { console.error('match2', r.error); process.exit(1); }
s = r.state;
const two = X.chartHtml('ml', s.fills);
has('line', two, '<path ');
has('first time', two, 'Nov 7, 3:00 PM');
has('second time', two, 'Nov 7, 3:30 PM');
has('second price', two, 'cy="49.1"');
const ys = [...two.matchAll(/cy="([0-9.]+)"/g)].map((m) => Number(m[1]));
if (ys.length !== 2 || ys[0] <= ys[1]) { fail++; console.error('FAIL price order', ys); }
else console.log('pass higher price is higher on the chart');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('chart ok');
