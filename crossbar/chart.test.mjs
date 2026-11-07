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
  has(mid + ' wait', html, 'No matched price yet');
  lacks(mid + ' no line yet', html, '<path ');
  lacks(mid + ' no invented point', html, '<circle ');
  lacks(mid + ' no estimate', html, 'pregame');
});
has('yes label', X.chartHtml('ml', {}), 'Oakridge');
has('no label', X.chartHtml('ml', {}), 'Country Day');
has('over label', X.chartHtml('p_homan_rush', {}), 'Over 58.5');
has('under label', X.chartHtml('p_stadler_tck', {}), 'Under 4.5');
lacks('empty is not a fake 50', X.chartHtml('ml', {}), '50%');

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
has('one yes point', one, 'data-side="yes"');
has('one no complement', one, 'data-side="no"');
has('one legend 40', one, '>40%</b>');
has('one legend 60', one, '>60%</b>');
has('one point', one, '<circle ');
has('one time', one, 'Nov 7, 3:00 PM');
lacks('one no line', one, '<path ');
has('one is the engine price', one, Object.values(s.fills)[0].yesPay === 40 ? '40%' : 'WRONG PRICE');
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
has('second price', two, '>55%</b>');
var strokePaths = (two.match(/fill="none"/g) || []).length;
if (strokePaths !== 2) { fail++; console.error('FAIL two lines', strokePaths); }
else console.log('pass two lines');
const yesYs = [...two.matchAll(/data-side="yes" d="([^"]+)"/g)].map(function (m) { return m[1]; });
if (yesYs.length < 1 || yesYs[0].indexOf('L') < 0) { fail++; console.error('FAIL price line', yesYs); }
else console.log('pass price history is a line');
const flatFills = {
  a: { id: 'a', mid: 'ml', yesPay: 50, t: t1 },
  b: { id: 'b', mid: 'ml', yesPay: 50, t: t2 }
};
const flat = X.chartHtml('ml', flatFills);
const flatYes = (flat.match(/data-side="yes" d="M[^"]+"/g) || [])[0] || '';
const flatNo = (flat.match(/data-side="no" d="M[^"]+"/g) || [])[0] || '';
const ys = function (d) { return (d.match(/ [\d.]+/g) || []).filter(function (_, i) { return i % 2 === 1; }).join(); };
if (!flatYes || ys(flatYes) !== ys(flatNo)) { fail++; console.error('FAIL coincident', flatYes, flatNo); }
else console.log('pass 50-50 lines share the same points');
has('both read 50', flat, '>50%</b>');
lacks('no payout multiple', flat, 'x<');
has('blue still drawn', flat, 'stroke="#173d79"');
has('green still drawn', flat, 'stroke="#1f9d55"');
has('dash distinguishes the blue line', flat, 'stroke-dasharray="5 4"');
const fw = X.chartHtml('f21', { z: { id: 'z', mid: 'f21', yesPay: 30, t: t1 } });
has('yes point stays green with the button', fw, 'fill="#1f9d55"');
has('country day readout', fw, '21 or more');
lacks('no kalshi sample', fw, '58%');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('chart ok');
