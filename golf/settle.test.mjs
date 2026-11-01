import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';
const sandbox = createContext({});
sandbox.globalThis = sandbox;
runInContext(readFileSync(new URL('./settle.js', import.meta.url), 'utf8'), sandbox);
const S = sandbox.ToriiSettle;

const pending = S.summarize({
  groups: { g1: { lines: [{ status: 'open', title: 'Low net', result: null }] } },
  bets: { g1: { b1: { uid: 'a', line: '0', side: 'o0', a: 10, px: 40, st: 'open' } } },
  activity: { g1: { b1: { n: 'Ada', title: 'Low net', label: 'Ada', a: 10 } } }
});
if (!pending.pending || pending.payments.length || pending.people[0].open[0].label !== 'Ada') throw new Error('pending ' + JSON.stringify(pending));

const done = S.summarize({
  groups: {
    g1: { lines: [{ status: 'settled', title: 'Low net', result: 'o0' }] }
  },
  bets: {
    g1: {
      b1: { uid: 'a', line: '0', side: 'o0', a: 10, px: 40, st: 'open' },
      b2: { uid: 'b', line: '0', side: 'o1', a: 25, px: 60, st: 'open' }
    }
  },
  activity: {
    g1: {
      b1: { n: 'Ada', title: 'Low net', label: 'Ada' },
      b2: { n: 'Bea', title: 'Low net', label: 'Bea' }
    }
  }
});
if (done.pending) throw new Error('should be settled');
const ada = done.people.find(p => p.name === 'Ada');
const bea = done.people.find(p => p.name === 'Bea');
if (ada.net !== 15 || bea.net !== -25) throw new Error('nets ' + JSON.stringify(done.people));
if (done.payments.length !== 1 || done.payments[0].from !== 'Bea' || done.payments[0].to !== 'Ada' || done.payments[0].amt !== 15) throw new Error('pay ' + JSON.stringify(done.payments));
console.log('settle math ok', done.payments);
