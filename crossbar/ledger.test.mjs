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
const t0 = Date.parse('2026-11-07T21:00:00.000Z');

let s = X.blank();
acct(s, 'alice', 'Ada');
acct(s, 'bob', 'Bea');
acct(s, 'cara', 'Cam');
s = X.submit(s, { id: 'yesorder001', uid: 'alice', mid: 'ml', side: 'yes', px: 40, shares: 10, t: t0 }).state;
let open = X.ledger(s);
eq('reserved is the whole offer', open.players.find((p) => p.uid === 'alice').reserved, 400);
eq('open offer is not a bet', open.bets.length, 0);
eq('one open offer', open.offers.length, 1);
eq('stack still the grant', open.players.every((p) => p.stack === X.GRANT), true);

s = X.submit(s, { id: 'noorder0001', uid: 'bob', mid: 'ml', side: 'no', px: 70, shares: 4, t: t0 + 1000 }).state;
let part = X.ledger(s);
let ada = part.players.find((p) => p.uid === 'alice');
let bea = part.players.find((p) => p.uid === 'bob');
eq('partial reserved remainder', ada.reserved, 6 * 40);
eq('partial escrow is matched price', ada.escrow, 4 * 40);
eq('taker cost is 60 not the 70 limit', bea.escrow, 4 * 60);
eq('price improvement not double counted', bea.available, X.GRANT - 4 * 60);
eq('improvement noted on the bet', part.bets[0].no.improved, 4 * 10);
eq('pending win is not in the stack', ada.stack === X.GRANT && bea.stack === X.GRANT, true);
eq('settled blank while pending', ada.settledKnown, false);
eq('possible payout is separate', part.bets[0].yes.possible, 400);

s = X.submit(s, { id: 'noorder0002', uid: 'cara', mid: 'ml', side: 'no', px: 60, shares: 6, t: t0 + 2000 }).state;
let both = X.ledger(s);
eq('two fills', both.bets.length, 2);
eq('alice escrow is both fills once', both.players.find((p) => p.uid === 'alice').escrow, 10 * 40);
eq('no reserved after the rest fills', both.players.find((p) => p.uid === 'alice').reserved, 0);
eq('stacks conserved while pending', both.players.reduce((n, p) => n + p.stack, 0), 3 * X.GRANT);

let won = X.settle(s, { oak: 28, fw: 10 }).state;
let again = X.settle(won, { oak: 0, fw: 0 });
eq('second settle rejected', !!again.error, true);
let after = X.ledger(won);
let wAda = after.players.find((p) => p.uid === 'alice');
let wBea = after.players.find((p) => p.uid === 'bob');
eq('winner collect is 1 token per share', wAda.collect, 1000);
eq('winner profit is the other stakes', wAda.settled, 600);
eq('loser profit is the stake lost', wBea.settled, -240);
eq('loser collects nothing', wBea.collect, 0);
eq('pending escrow cleared once settled', wAda.escrow, 0);
eq('stacks still conserved', after.players.reduce((n, p) => n + p.stack, 0), 3 * X.GRANT);

let paid = X.claimAll(won, 'alice');
paid = X.claimAll(paid.state, 'bob');
paid = X.claimAll(paid.state, 'cara');
let once = X.ledger(paid.state);
let twice = X.claim(paid.state, both.bets[0].id, 'yes', 'alice');
eq('repeat claim does not pay again', twice.idempotent === true || !!twice.error, true);
eq('ledger unchanged by a repeat claim', X.ledger(twice.state), once);
eq('claimed win is in available not collect', once.players.find((p) => p.uid === 'alice').collect, 0);
eq('claimed stacks conserved', once.players.reduce((n, p) => n + p.stack, 0), 3 * X.GRANT);

let tie = X.blank();
acct(tie, 'alice', 'Ada');
acct(tie, 'bob', 'Bea');
tie = X.submit(tie, { id: 'tilyes00001', uid: 'alice', mid: 'ml', side: 'yes', px: 81, shares: 2, t: t0 }).state;
tie = X.submit(tie, { id: 'tieno000001', uid: 'bob', mid: 'ml', side: 'no', px: 19, shares: 2, t: t0 + 1 }).state;
tie = X.settle(tie, { oak: 21, fw: 21 }).state;
let tieBook = X.ledger(tie);
eq('tie call is void', tieBook.bets[0].call, 'void');
eq('tie refunds the yes stake', tieBook.bets[0].yes.payout, 162);
eq('tie profit is zero', tieBook.players.every((p) => p.settled === 0), true);

let wiped = X.blank();
acct(wiped, 'alice', 'Ada');
wiped = X.submit(wiped, { id: 'openyes0001', uid: 'alice', mid: 'tot', side: 'yes', px: 50, shares: 3, t: t0 }).state;
wiped = X.settle(wiped, null).state;
let voidBook = X.ledger(wiped);
eq('void returns the open offer', voidBook.players[0].available, X.GRANT);
eq('void has no matched bet', voidBook.bets.length, 0);
eq('void has no open offer', voidBook.offers.length, 0);

let prop = X.blank();
acct(prop, 'alice', 'Ada');
acct(prop, 'bob', 'Bea');
prop = X.submit(prop, { id: 'tdyes000001', uid: 'alice', mid: 'p_stadler_td', side: 'yes', px: 40, shares: 2, t: t0 }).state;
prop = X.submit(prop, { id: 'tdno0000001', uid: 'bob', mid: 'p_stadler_td', side: 'no', px: 60, shares: 2, t: t0 + 1 }).state;
prop = X.settle(prop, { oak: 36, fw: 21, finalAt: t0 }).state;
let propBook = X.ledger(prop);
eq('score does not settle the prop', propBook.bets[0].call, null);
eq('prop stake stays escrow', propBook.players.find((p) => p.uid === 'alice').escrow, 80);

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('ledger ok');
