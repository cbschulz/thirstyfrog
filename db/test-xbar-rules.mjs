import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const sandbox = createContext({ Math, JSON, Number, String, Object, Date });
sandbox.globalThis = sandbox;
runInContext(readFileSync(new URL('../crossbar/engine.js', import.meta.url), 'utf8'), sandbox);
runInContext(readFileSync(new URL('../crossbar/wire.js', import.meta.url), 'utf8'), sandbox);
const X = sandbox.Crossbar;
const W = sandbox.CrossbarWire;

const rules = readFileSync(new URL('./rules.golf.betting.json', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-torii-xbar',
  database: { host: '127.0.0.1', port: 9000, rules }
});

const A = 'aliceabcd', B = 'bobbyabcd';
function alice() { return testEnv.authenticatedContext(A).database(); }
function bob() { return testEnv.authenticatedContext(B).database(); }
function admin() { return testEnv.authenticatedContext('admin1').database(); }
function stranger() { return testEnv.authenticatedContext('stranger1').database(); }

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref().set(null);
    await db.ref('admins/admin1').set(true);
  });
}
const grant = (uid, n, tag) => ({ bal: 10000, granted: true, n, tag, createdAt: 1 });

let fail = 0;
async function check(name, fn) {
  try { await fn(); console.log('pass', name); }
  catch (e) { fail++; console.error('FAIL', name, e.message || e); }
}

await check('grant once', async () => {
  await seed();
  await assertSucceeds(alice().ref('xbar_accounts/' + A).set(grant(A, 'Ada', 'alic')));
});
await check('second grant blocked', async () => {
  await seed();
  await assertSucceeds(alice().ref('xbar_accounts/' + A).set(grant(A, 'Ada', 'alic')));
  await assertFails(alice().ref('xbar_accounts/' + A).set(grant(A, 'Ada', 'alic')));
});
await check('inflated grant blocked', async () => {
  await seed();
  await assertFails(alice().ref('xbar_accounts/' + A).set({ bal: 50000, granted: true, n: 'Ada', tag: 'alic', createdAt: 1 }));
});
await check('other wallet blocked', async () => {
  await seed();
  await assertFails(bob().ref('xbar_accounts/' + A).set(grant(A, 'Ada', 'alic')));
});

function book() {
  const s = X.blank();
  s.accounts[A] = { bal: 10000, n: 'Ada', tag: 'alic', createdAt: 1 };
  s.accounts[B] = { bal: 10000, n: 'Bea', tag: 'bobb', createdAt: 1 };
  return s;
}

await check('rest offer and overspend', async () => {
  await seed();
  await alice().ref('xbar_accounts/' + A).set(grant(A, 'Ada', 'alic'));
  const s = book();
  const ok = W.steps(s, { id: 'restyes00001', uid: A, mid: 'p_stadler_td', side: 'yes', px: 40, shares: 5, t: Date.now() });
  await assertSucceeds(alice().ref().update(ok.steps[0]));
  const rich = W.steps(s, { id: 'toobigorder1', uid: A, mid: 'ml', side: 'yes', px: 50, shares: 300, t: Date.now() });
  if (!rich.error) throw new Error('engine should reject overspend');
});

await check('match, no self, prop stays pending', async () => {
  await seed();
  await alice().ref('xbar_accounts/' + A).set(grant(A, 'Ada', 'alic'));
  await bob().ref('xbar_accounts/' + B).set(grant(B, 'Bea', 'bobb'));
  let s = book();
  const tYes = Date.now() - 1000;
  const rest = W.steps(s, { id: 'yesstadler01', uid: A, mid: 'p_stadler_td', side: 'yes', px: 40, shares: 4, t: tYes });
  await assertSucceeds(alice().ref().update(rest.steps[0]));
  s = X.submit(s, { id: 'yesstadler01', uid: A, mid: 'p_stadler_td', side: 'yes', px: 40, shares: 4, t: tYes }).state;
  const self = W.steps(s, { id: 'selfno000001', uid: A, mid: 'p_stadler_td', side: 'no', px: 70, shares: 4, t: Date.now() });
  if (!self.error) throw new Error('self trade should be rejected by the engine');
  const take = W.steps(s, { id: 'nostadler001', uid: B, mid: 'p_stadler_td', side: 'no', px: 70, shares: 4, t: Date.now() });
  if (take.error) throw new Error(take.error);
  await assertSucceeds(bob().ref().update(take.steps[0]));
  await assertFails(stranger().ref('xbar_event').set({ status: 'settled', oak: 20, fw: 10, finalAt: Date.now(), t: Date.now() }));
  await assertSucceeds(admin().ref('xbar_event').set({ status: 'settled', oak: 20, fw: 10, finalAt: Date.now(), t: Date.now() }));
  await assertFails(admin().ref('xbar_event').set({ status: 'settled', oak: 1, fw: 1, finalAt: Date.now(), t: Date.now() }));
  const results = (await alice().ref('xbar_results').once('value')).val();
  if (results) throw new Error('score settled a prop ' + JSON.stringify(results));
  const fills = await alice().ref('xbar_fills').once('value');
  const fid = Object.keys(fills.val() || {})[0];
  if (!fid) throw new Error('no fill');
  const acct = (await alice().ref('xbar_accounts/' + A).once('value')).val();
  const fill = fills.val()[fid];
  const claim = W.claimUpdate({ accounts: { [A]: acct }, fills: { [fid]: fill }, status: 'settled', score: { oak: 20, fw: 10 }, results: {}, finalAt: Date.now(), now: Date.now() }, fid, 'yes', A);
  await assertFails(alice().ref().update(claim));
  await assertSucceeds(admin().ref('xbar_results/p_stadler_td').set({ kind: 'void', t: Date.now() }));
  await assertFails(admin().ref('xbar_results/p_stadler_td').set({ kind: 'stat', played: true, stat: 0, t: Date.now() }));
  const acct2 = (await alice().ref('xbar_accounts/' + A).once('value')).val();
  const claim2 = W.claimUpdate({ accounts: { [A]: acct2 }, fills: { [fid]: fill }, status: 'settled', results: { p_stadler_td: { kind: 'void', void: true } }, finalAt: Date.now(), now: Date.now() }, fid, 'yes', A);
  await assertSucceeds(alice().ref().update(claim2));
});

await check('unknown prop blocked', async () => {
  await seed();
  await alice().ref('xbar_accounts/' + A).set(grant(A, 'Ada', 'alic'));
  const s = book();
  const bad = W.steps(s, { id: 'othertck0001', uid: A, mid: 'p_someone_tck', side: 'yes', px: 40, shares: 1, t: Date.now() });
  if (!bad.error) throw new Error('engine listed an unknown prop');
});

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('xbar rules ok');
await testEnv.cleanup();
