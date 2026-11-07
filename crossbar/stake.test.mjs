import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';

const sandbox = createContext({ Math, JSON, Number, String, Object, Date, Intl });
sandbox.globalThis = sandbox;
runInContext(readFileSync(new URL('./engine.js', import.meta.url), 'utf8'), sandbox);
const X = sandbox.Crossbar;

let fail = 0;
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { fail++; console.error('FAIL', name, a, '!=', b); }
  else console.log('pass', name);
}
function acct(state, uid, name) {
  state.accounts[uid] = { bal: X.GRANT, n: name, tag: uid.slice(0, 4) };
}
const t = Date.parse('2026-11-07T21:00:00.000Z');

eq('winner oak', X.outcomeName('ml', 'yes'), 'Oakridge');
eq('winner fw', X.outcomeName('ml', 'no'), 'Country Day');
eq('spread no is the points', X.outcomeName('spd', 'no'), 'Country Day +15.5');
eq('total over', X.outcomeName('tot', 'yes'), 'Over 56.5');
eq('oak points no', X.outcomeName('o35', 'no'), '34 or fewer');
eq('fw points yes', X.outcomeName('f21', 'yes'), '21 or more');
eq('td yes', X.outcomeName('p_stadler_td', 'yes'), 'Scores a TD');
eq('td no', X.outcomeName('p_homan_td', 'no'), 'No TD');
eq('yards', X.outcomeName('p_stadler_rec', 'yes'), 'Over 29.5');
eq('ask', X.ask('ml'), 'Who wins?');

let s = X.blank();
acct(s, 'alice', 'Ada');
acct(s, 'bob', 'Bea');
const snap = JSON.stringify(s);
let q = X.quoteStake(s, { uid: 'alice', mid: 'ml', side: 'yes', tokens: 5, t: t });
eq('even price', q.px, 50);
eq('even shares from tokens', q.shares, 10);
eq('even risk', q.cost, 500);
eq('even leftover', q.leftover, 0);
eq('even payout', q.payout, 1000);
eq('even waits', q.matched === 0 && q.waiting === 10 && q.even === true, true);
eq('quote does not touch the book', JSON.stringify(s), snap);
eq('second quote is the same', X.quoteStake(s, { uid: 'alice', mid: 'ml', side: 'yes', tokens: 5, t: t }).cost, 500);
eq('too small', !!X.quoteStake(s, { uid: 'alice', mid: 'ml', side: 'yes', tokens: 0.4, t: t }).error, true);
q = X.quoteStake(s, { uid: 'alice', mid: 'ml', side: 'yes', tokens: 1.01, t: t });
eq('round to a cent', q.cost === 100 && q.leftover === 1 && q.cost + q.leftover === 101, true);

s = X.submit(s, { id: 'noorder00001', uid: 'bob', mid: 'ml', side: 'no', px: 60, shares: 2, t: t }).state;
q = X.quoteStake(s, { uid: 'alice', mid: 'ml', side: 'yes', tokens: 5, t: t + 1 });
eq('takes their price', q.px, 40);
eq('risk cap', q.cost, 480);
eq('leftover stays', q.leftover, 20);
eq('partial now', q.matched, 2);
eq('rest waits', q.waiting, 10);
eq('risk splits', q.matchedRisk + q.waitingRisk === q.cost && q.matchedRisk === 80, true);
eq('not even', q.even, false);
const posted = X.submit(s, { id: 'yesorder0001', uid: 'alice', mid: 'ml', side: 'yes', px: q.px, shares: q.shares, t: t + 1 });
eq('post keeps funds nonnegative', posted.state.accounts.alice.bal >= 0 && posted.state.accounts.bob.bal >= 0, true);
eq('actual debit is the quote', posted.state.accounts.alice.bal, X.GRANT - q.cost);
eq('too big after that', !!X.quoteStake(posted.state, { uid: 'alice', mid: 'ml', side: 'yes', tokens: 100, t: t + 2 }).error, true);
eq('conserved', X.conservation(posted.state).ok, true);

let own = X.blank();
acct(own, 'alice', 'Ada');
own = X.submit(own, { id: 'myother00001', uid: 'alice', mid: 'spd', side: 'no', px: 50, shares: 2, t: t }).state;
eq('own other side', !!X.quoteStake(own, { uid: 'alice', mid: 'spd', side: 'yes', tokens: 5, t: t + 1 }).error, true);

let all = X.blank();
acct(all, 'alice', 'Ada');
q = X.quoteStake(all, { uid: 'alice', mid: 'tot', side: 'no', tokens: 100, t: t });
all = X.submit(all, { id: 'allin0000001', uid: 'alice', mid: 'tot', side: 'no', px: q.px, shares: q.shares, t: t }).state;
eq('whole stack posts once', all.accounts.alice.bal, 0);
eq('second post blocked', !!X.quoteStake(all, { uid: 'alice', mid: 'tot', side: 'no', tokens: 1, t: t + 1 }).error, true);

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('stake ok');
