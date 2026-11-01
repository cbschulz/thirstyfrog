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

const live = S.board({
  groups: {
    g1: { lines: [{ status: 'settled', title: 'Low net', result: 'o0' }, { status: 'open', title: 'Best gross', result: null }] }
  },
  bets: {
    g1: {
      b1: { uid: 'a', line: '0', side: 'o0', a: 10, px: 40, st: 'open' },
      b2: { uid: 'b', line: '0', side: 'o1', a: 25, px: 60, st: 'open' },
      b3: { uid: 'c', line: '1', side: 'over', a: 10, px: 50, st: 'open' }
    }
  },
  activity: {
    g1: {
      b1: { n: 'Ada', label: 'Ada' },
      b2: { n: 'Bea', label: 'Bea' },
      b3: { n: 'Cam', label: 'Over' }
    }
  },
  self: { uid: 'd', name: 'Dee' }
});
const names = live.people.map(p => p.name + ':' + p.cash + '+' + p.openStake + '=' + p.net);
if (names.join(',') !== 'Ada:115+0=15,Cam:90+10=0,Dee:100+0=0,Bea:75+0=-25') throw new Error('board ' + names.join(','));
if (!live.pending || live.payments.length !== 1 || live.payments[0].from !== 'Bea' || live.payments[0].amt !== 15) throw new Error('live pay ' + JSON.stringify(live.payments));
const html = S.sectionsHTML(live, s => s);
if (!html.includes('🥇') || !html.includes('🥈') || !html.includes('🥉') || !html.includes('+ $10 in open bets')) throw new Error('medals');
if (!html.includes('+$15') || !html.includes('-$25') || !html.includes('Bea pays Ada $15')) throw new Error('owes ' + html);
if (!html.includes('Cash on hand, plus open bets at cost (stakes still riding).')) throw new Error('lede');
if (!html.includes('versus the $100 start')) throw new Error('start');
console.log('settle math ok', done.payments, names.join(','));
