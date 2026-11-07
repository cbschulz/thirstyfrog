import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';

const sandbox = createContext({ Math, JSON, Number, String, Object });
sandbox.globalThis = sandbox;
runInContext(readFileSync(new URL('./engine.js', import.meta.url), 'utf8'), sandbox);
const X = sandbox.Crossbar;

let fail = 0;
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { fail++; console.error('FAIL', name, a, '!=', b); }
  else console.log('pass', name);
}

const before = X.CUTOFF - 60 * 60 * 1000;
function acct(state, uid, name) {
  state.accounts[uid] = { bal: X.GRANT, n: name, tag: uid.slice(0, 4) };
}
let s = X.blank();
acct(s, 'alice', 'Ada');
acct(s, 'bob', 'Bea');
acct(s, 'cam', 'Cam');

let r = X.submit(s, { id: 'yesorder001', uid: 'alice', mid: 'ml', side: 'yes', px: 40, shares: 10, t: before });
eq('rest', r.error || r.state.orders.yesorder001.rem, 10);
s = r.state;
eq('alice locked', s.accounts.alice.bal, 9600);

r = X.submit(s, { id: 'noorder0001', uid: 'bob', mid: 'ml', side: 'no', px: 70, shares: 4, t: before + 1000 });
eq('partial fills', r.state.fills[Object.keys(r.state.fills)[0]].shares, 4);
s = r.state;
eq('alice rem', s.orders.yesorder001.rem, 6);
eq('bob net debit 60c x4', s.accounts.bob.bal, 10000 - 60 * 4);
eq('alice no improvement', s.accounts.alice.bal, 9600);
eq('conserve partial', X.conservation(s).ok, true);

r = X.submit(s, { id: 'selfno00001', uid: 'alice', mid: 'ml', side: 'no', px: 70, shares: 6, t: before + 2000 });
eq('self rejected', r.error && r.self, true);
eq('self no change', r.state.accounts.alice.bal, s.accounts.alice.bal);

r = X.submit(s, { id: 'poororder01', uid: 'cam', mid: 'spd', side: 'yes', px: 50, shares: 300, t: before + 2000 });
eq('overspend', !!r.error, true);

r = X.submit(s, { id: 'lateorder01', uid: 'cam', mid: 'ml', side: 'yes', px: 40, shares: 1, t: X.CUTOFF });
eq('cutoff', !!r.error, true);

r = X.cancel(s, 'yesorder001', 'alice', before);
eq('cancel refund', r.state.accounts.alice.bal, 9600 + 6 * 40);
eq('conserve cancel', X.conservation(r.state).ok, true);
s = r.state;

r = X.submit(s, { id: 'y2order0001', uid: 'alice', mid: 'spd', side: 'yes', px: 49, shares: 5, t: before });
s = r.state;
r = X.submit(s, { id: 'n2order0001', uid: 'bob', mid: 'spd', side: 'no', px: 51, shares: 5, t: before + 5 });
s = r.state;
eq('spread matched', Object.keys(s.fills).length, 2);

const settled = X.settle(s, { oak: 36, fw: 21 });
eq('settle ok', settled.error || settled.state.status, 'settled');
eq('ml yes', X.outcome('ml', { oak: 36, fw: 21 }, false), 'yes');
eq('spd no by 15', X.outcome('spd', { oak: 36, fw: 21 }, false), 'no');
eq('tot over', X.outcome('tot', { oak: 36, fw: 21 }, false), 'yes');
eq('o35 yes', X.outcome('o35', { oak: 36, fw: 21 }, false), 'yes');
eq('f21 yes', X.outcome('f21', { oak: 36, fw: 21 }, false), 'yes');
eq('cover needs 16', X.outcome('spd', { oak: 36, fw: 20 }, false), 'yes');
eq('total 56 under', X.outcome('tot', { oak: 36, fw: 20 }, false), 'no');
eq('tie ml void', X.outcome('ml', { oak: 28, fw: 28 }, false), 'void');
eq('35 includes 35', X.outcome('o35', { oak: 35, fw: 10 }, false), 'yes');
eq('21 includes 21', X.outcome('f21', { oak: 10, fw: 21 }, false), 'yes');
eq('34 is no', X.outcome('o35', { oak: 34, fw: 30 }, false), 'no');

s = settled.state;
const again = X.settle(s, { oak: 0, fw: 0 });
eq('repeat settle', !!again.error, true);
let c = X.claimAll(s, 'alice');
c = X.claimAll(c.state, 'bob');
c = X.claimAll(c.state, 'cam');
eq('conserve after pay', X.conservation(c.state).ok, true);
const twice = X.claim(c.state, Object.keys(c.state.fills)[0], 'yes', 'alice');
eq('repeat claim', twice.idempotent === true || !!twice.error, true);

let v = X.blank();
acct(v, 'alice', 'Ada');
acct(v, 'bob', 'Bea');
v = X.submit(v, { id: 'mlyes000001', uid: 'alice', mid: 'ml', side: 'yes', px: 81, shares: 2, t: before }).state;
v = X.submit(v, { id: 'mlno0000001', uid: 'bob', mid: 'ml', side: 'no', px: 19, shares: 2, t: before + 1 }).state;
v = X.settle(v, { oak: 21, fw: 21 }).state;
const fid = Object.keys(v.fills)[0];
const ay = X.claim(v, fid, 'yes', 'alice');
const bn = X.claim(ay.state, fid, 'no', 'bob');
eq('tie refunds both', ay.amt === 81 * 2 && bn.amt === 19 * 2, true);
eq('conserve tie', X.conservation(bn.state).ok, true);

let z = X.blank();
acct(z, 'alice', 'Ada');
z = X.submit(z, { id: 'openyes0001', uid: 'alice', mid: 'tot', side: 'yes', px: 50, shares: 3, t: before }).state;
z = X.settle(z, null).state;
eq('void refunds unmatched', z.accounts.alice.bal, 10000);
eq('void status', z.status, 'void');

eq('props on the board', Object.keys(X.PROPS).sort().join(','), 'p_bluntzer_tck,p_homan_rush,p_homan_td,p_stadler_rec,p_stadler_tck,p_stadler_td');
let p = X.blank();
acct(p, 'alice', 'Ada');
acct(p, 'bob', 'Bea');
p = X.submit(p, { id: 'tdyes0000001', uid: 'alice', mid: 'p_stadler_td', side: 'yes', px: 40, shares: 2, t: before }).state;
p = X.submit(p, { id: 'tdno00000001', uid: 'bob', mid: 'p_stadler_td', side: 'no', px: 70, shares: 2, t: before + 3 }).state;
const tdFill = Object.keys(p.fills).filter(function (k) { return p.fills[k].mid === 'p_stadler_td'; })[0];
p = X.settle(p, { oak: 36, fw: 21, finalAt: before }).state;
eq('score does not settle prop', X.payoutFor(p.fills[tdFill], 'yes', p), null);
p.now = p.finalAt + X.PROP_WAIT + 1;
eq('deadline voids missing', X.payoutFor(p.fills[tdFill], 'yes', p), 40 * 2);
p.now = p.finalAt + 1000;
p.results.p_stadler_td = { kind: 'stat', played: true, stat: 0 };
eq('played zero is under', X.payoutFor(p.fills[tdFill], 'yes', p), 0);
eq('played zero pays no', X.payoutFor(p.fills[tdFill], 'no', p), 100 * 2);
p.results.p_stadler_td = { kind: 'stat', played: true, stat: 1 };
eq('one scoring td clears 0.5', X.payoutFor(p.fills[tdFill], 'yes', p), 100 * 2);
p.results.p_stadler_td = { kind: 'void', played: false };
eq('dnp voids', X.payoutFor(p.fills[tdFill], 'yes', p), 40 * 2);
eq('yards 30 over 29.5', X.propCall(X.PROPS.p_stadler_rec, { played: true, stat: 30 }, p), 'yes');
eq('yards 29 under', X.propCall(X.PROPS.p_stadler_rec, { played: true, stat: 29 }, p), 'no');
eq('stadler 5 tackles over 4.5', X.propCall(X.PROPS.p_stadler_tck, { played: true, stat: 5 }, p), 'yes');
eq('stadler 4 tackles under', X.propCall(X.PROPS.p_stadler_tck, { played: true, stat: 4 }, p), 'no');
eq('bluntzer 10 over 9.5', X.propCall(X.PROPS.p_bluntzer_tck, { played: true, stat: 10 }, p), 'yes');
eq('bluntzer 9 under', X.propCall(X.PROPS.p_bluntzer_tck, { played: true, stat: 9 }, p), 'no');
eq('blank is not zero', X.propCall(X.PROPS.p_stadler_rec, null, { status: 'settled', finalAt: 10, now: 11 }), null);
eq('no ref price', X.PROPS.p_stadler_td.refYes, undefined);
eq('homan 59 rush over', X.propCall(X.PROPS.p_homan_rush, { played: true, stat: 59 }, p), 'yes');
eq('homan 58 rush under', X.propCall(X.PROPS.p_homan_rush, { played: true, stat: 58 }, p), 'no');
eq('homan one score over 0.5', X.propCall(X.PROPS.p_homan_td, { played: true, stat: 1 }, p), 'yes');
eq('homan zero scores under', X.propCall(X.PROPS.p_homan_td, { played: true, stat: 0 }, p), 'no');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('engine ok');
