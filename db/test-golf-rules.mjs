import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const sandbox = createContext({ Date, Math, Number, String, Uint8Array, crypto: globalThis.crypto });
sandbox.globalThis = sandbox;
runInContext(readFileSync(new URL('../golf/market.js', import.meta.url), 'utf8'), sandbox);
const TG = sandbox.ToriiGolf;

const rules = readFileSync(new URL('./rules.golf.betting.json', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-torii-golf',
  database: { host: '127.0.0.1', port: 9000, rules }
});

const future = Date.now() + 3 * 60 * 60 * 1000;
const past = Date.now() - 60 * 1000;
const sheet = (teeTimeMs, status) => ({
  teeTime: new Date(teeTimeMs).toISOString(),
  teeTimeMs,
  lines: [{ status, title: 'Low net in the group' }]
});

async function seed(extra) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref().set(null);
    await db.ref('admins/admin1').set(true);
    await db.ref('users/alice').set({ first: 'Alice', last: 'A', email: 'alice@example.com', createdAt: 1 });
    await db.ref('users/bob').set({ first: 'Bob', last: 'B', email: 'bob@example.com', createdAt: 1 });
    await db.ref('golf_members/colonial/alice').set('ok');
    await db.ref('golf_members/colonial/bob').set('ok');
    await db.ref('golf/colonial/sheets/2026-11-02/groups/g1').set(sheet(future, 'open'));
    await db.ref('golf/colonial/sheets/2026-11-02/groups/glock').set(sheet(past, 'open'));
    await db.ref('golf/colonial/sheets/2026-11-02/groups/gclosed').set(sheet(future, 'closed'));
    if (extra) await extra(db);
  });
}

function alice() { return testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).database(); }
function bob() { return testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).database(); }
function admin() { return testEnv.authenticatedContext('admin1', { email: 'admin@example.com' }).database(); }

const grant = (n) => ({ bal: 100, granted: true, n, createdAt: 1700000000000 });

function betUpdate(uid, name, bal, opts = {}) {
  return TG.buildBetUpdate({
    uid, name, bal,
    club: 'colonial',
    date: '2026-11-02',
    gid: opts.gid || 'g1',
    line: '0',
    side: 'o0',
    label: 'Alice',
    amount: opts.amount == null ? 10 : opts.amount,
    price: 36,
    title: 'Low net in the group',
    bid: opts.bid || 'abcd1234',
    t: Date.now()
  }).updates;
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push('pass ' + name);
    console.log('pass', name);
  } catch (e) {
    results.push('FAIL ' + name + ' ' + (e.message || e));
    console.error('FAIL', name, e.message || e);
  }
}

await check('grant once', async () => {
  await seed();
  await assertSucceeds(alice().ref('golf_accounts/alice').set(grant('Alice A')));
});

await check('double-claim blocked', async () => {
  await seed(async (db) => { await db.ref('golf_accounts/alice').set(grant('Alice A')); });
  await assertFails(alice().ref('golf_accounts/alice').set(grant('Alice A')));
});

await check('inflated grant blocked', async () => {
  await seed();
  await assertFails(alice().ref('golf_accounts/alice').set({ bal: 500, granted: true, n: 'Alice A', createdAt: 1 }));
});

await check('writing another user balance blocked', async () => {
  await seed(async (db) => { await db.ref('golf_accounts/bob').set(grant('Bob B')); });
  await assertFails(alice().ref('golf_accounts/bob').set(grant('Bob B')));
  await assertFails(alice().ref('golf_accounts/bob/bal').set(0));
});

await check('reading another user account blocked', async () => {
  await seed(async (db) => { await db.ref('golf_accounts/bob').set(grant('Bob B')); });
  await assertFails(alice().ref('golf_accounts/bob').get());
});

await check('bet debits balance once', async () => {
  await seed(async (db) => { await db.ref('golf_accounts/alice').set(grant('Alice A')); });
  await assertSucceeds(alice().ref().update(betUpdate('alice', 'Alice A', 100, { amount: 10, bid: 'bet00010' })));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const acct = (await ctx.database().ref('golf_accounts/alice').get()).val();
    if (!acct || acct.bal !== 90) throw new Error('balance ' + JSON.stringify(acct));
  });
});

await check('overspend blocked', async () => {
  await seed(async (db) => { await db.ref('golf_accounts/alice').set(grant('Alice A')); });
  await assertFails(alice().ref().update(betUpdate('alice', 'Alice A', 100, { amount: 101, bid: 'bet00101' })));
  await assertFails(alice().ref().update(betUpdate('alice', 'Alice A', 100, { amount: 150, bid: 'bet00150' })));
});

await check('bet after lock blocked', async () => {
  await seed(async (db) => { await db.ref('golf_accounts/alice').set(grant('Alice A')); });
  await assertFails(alice().ref().update(betUpdate('alice', 'Alice A', 100, { gid: 'glock', bid: 'bet0lock' })));
  await assertFails(alice().ref().update(betUpdate('alice', 'Alice A', 100, { gid: 'gclosed', bid: 'bet0shut' })));
});

await check('non-admin settle blocked', async () => {
  await seed(async (db) => {
    await db.ref('golf_accounts/alice').set(grant('Alice A'));
    await db.ref('golf_bets/colonial/2026-11-02/g1/bet0seed').set({ id: 'bet0seed', line: '0', side: 'o0', uid: 'alice', a: 10, px: 36, t: Date.now(), st: 'open' });
  });
  await assertFails(alice().ref('golf_bets/colonial/2026-11-02/g1/bet0seed/st').set('settled'));
  await assertFails(alice().ref('golf_accounts/alice/bal').set(1000));
  await assertSucceeds(admin().ref('golf_bets/colonial/2026-11-02/g1/bet0seed/st').set('settled'));
});

await check('members can read the day sheet of bets', async () => {
  await seed(async (db) => {
    await db.ref('golf_bets/colonial/2026-11-02/g1/bet0bob1').set({ id: 'bet0bob1', line: '0', side: 'o0', uid: 'bob', a: 10, px: 40, t: Date.now(), st: 'open' });
  });
  await assertSucceeds(alice().ref('golf_bets/colonial/2026-11-02').get());
  await assertFails(testEnv.unauthenticatedContext().database().ref('golf_bets/colonial/2026-11-02').get());
  const stranger = testEnv.authenticatedContext('stranger', { email: 's@example.com' }).database();
  await assertFails(stranger.ref('golf_bets/colonial/2026-11-02').get());
  await assertFails(alice().ref('golf_bets/colonial/2026-11-02/g1/bet0bob1/st').set('won'));
});

function anonDb() {
  return testEnv.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).database();
}

await check('anon name and colonial unlock', async () => {
  await seed(async (db) => { await db.ref('golf_keys/colonial/test-pass').set(true); });
  const a = anonDb();
  const profile = { first: 'Ada', last: 'Chen', email: '', createdAt: 1700000000000 };
  await assertFails(a.ref('users/anon1').set({ ...profile, email: 'ada@evil.com' }));
  await assertSucceeds(a.ref('users/anon1').set(profile));
  await assertFails(a.ref('users/bob').set(profile));
  await assertFails(a.ref('golf_members/colonial/anon1').set('wrong-pass'));
  await assertSucceeds(a.ref('golf_members/colonial/anon1').set('test-pass'));
  await assertFails(a.ref('golf_members/colonial/bob').set('test-pass'));
  await assertFails(a.ref('golf_accounts/anon1').set({ bal: 1000, granted: true, n: 'Ada Chen', createdAt: 1 }));
  await assertFails(a.ref('golf_accounts/anon1/bal').set(500));
  await assertFails(a.ref('golf_accounts/alice/bal').set(0));
});

await check('email account cannot use a blank email', async () => {
  const cara = testEnv.authenticatedContext('cara', { email: 'cara@example.com', firebase: { sign_in_provider: 'password' } }).database();
  await assertFails(cara.ref('users/cara').set({ first: 'Cara', last: 'C', email: '', createdAt: 1 }));
  await assertSucceeds(cara.ref('users/cara').set({ first: 'Cara', last: 'C', email: 'cara@example.com', createdAt: 1 }));
});

await check('activity hides private fields', async () => {
  await seed(async (db) => { await db.ref('golf_accounts/alice').set(grant('Alice A')); });
  const updates = betUpdate('alice', 'Alice A', 100, { amount: 5, bid: 'bet00005' });
  updates['golf_activity/colonial/2026-11-02/g1/bet00005'].uid = 'alice';
  await assertFails(alice().ref().update(updates));
});

await testEnv.cleanup();
const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(results.join('\n'));
if (failed.length) process.exit(1);
console.log('ALL RULE TESTS PASSED');
