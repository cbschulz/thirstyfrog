/* End-of-day settle-up. Client-side only: no payout writes. */
(function (G) {
  function profit(amount, cents, won) {
    var a = Math.floor(Number(amount));
    var p = Math.floor(Number(cents));
    if (!(a > 0)) return 0;
    if (!won) return -a;
    if (p < 1 || p > 99) return 0;
    return Math.floor(a * 100 / p) - a;
  }
  function sideWins(line, sideId, sideLabel) {
    var r = line && line.result;
    if (r == null || r === '') return null;
    var bits = [];
    if (typeof r === 'string' || typeof r === 'number') bits.push(r);
    else if (typeof r === 'object') bits.push(r.side, r.id, r.outcome, r.label, r.name, r.player);
    var want = bits.filter(function (x) { return x != null && x !== ''; }).map(function (x) { return String(x).trim().toLowerCase(); });
    if (!want.length) return null;
    var id = String(sideId || '').toLowerCase();
    var label = String(sideLabel || '').toLowerCase();
    var hit = false;
    want.forEach(function (w) { if (w === id || (label && w === label)) hit = true; });
    return hit;
  }
  function linesOf(g) {
    var raw = g && g.lines;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.keys(raw).sort().map(function (k) { return raw[k]; });
    return [];
  }
  function payments(people) {
    var debt = people.filter(function (p) { return p.net < 0; }).map(function (p) { return { name: p.name, left: -p.net }; });
    var cred = people.filter(function (p) { return p.net > 0; }).map(function (p) { return { name: p.name, left: p.net }; });
    debt.sort(function (a, b) { return b.left - a.left || a.name.localeCompare(b.name); });
    cred.sort(function (a, b) { return b.left - a.left || a.name.localeCompare(b.name); });
    var out = [], i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      var pay = Math.min(debt[i].left, cred[j].left);
      if (pay > 0) out.push({ from: debt[i].name, to: cred[j].name, amt: pay });
      debt[i].left -= pay;
      cred[j].left -= pay;
      if (debt[i].left === 0) i++;
      if (cred[j].left === 0) j++;
    }
    return out;
  }
  function summarize(raw) {
    var groups = raw && raw.groups || {};
    var people = {};
    var pending = false;
    Object.keys(groups).forEach(function (gid) {
      var g = groups[gid] || {};
      var lines = linesOf(g);
      var bets = (raw.bets && raw.bets[gid]) || {};
      var act = (raw.activity && raw.activity[gid]) || {};
      Object.keys(bets).forEach(function (bid) {
        var b = bets[bid];
        if (!b) return;
        var uid = b.uid || bid;
        var info = act[bid] || {};
        var name = info.n || b.n || 'Member';
        if (!people[uid]) people[uid] = { uid: uid, name: name, net: 0, open: [] };
        if (name && name !== 'Member') people[uid].name = name;
        var line = lines[Number(b.line)] || {};
        var title = info.title || line.title || 'Market';
        var label = info.label || b.label || b.side || '';
        var stake = Math.floor(+b.a || 0);
        var status = String(line.status || '').toLowerCase();
        var won = b.st === 'won' ? true : b.st === 'lost' ? false : null;
        if (won === null && status === 'settled') won = sideWins(line, b.side, label);
        if (won === null) {
          pending = true;
          people[uid].open.push({ title: title, label: label, a: stake });
          return;
        }
        people[uid].net += profit(b.a, b.px, won);
      });
    });
    var list = Object.keys(people).map(function (k) { return people[k]; });
    list.sort(function (a, b) { return b.net - a.net || a.name.localeCompare(b.name); });
    var open = list.some(function (p) { return p.open.length; });
    return { pending: pending || open, people: list, payments: (pending || open) ? [] : payments(list) };
  }
  G.profit = profit;
  G.sideWins = sideWins;
  G.payments = payments;
  G.summarize = summarize;
})(typeof window !== 'undefined' ? (window.ToriiSettle = window.ToriiSettle || {}) : (globalThis.ToriiSettle = globalThis.ToriiSettle || {}));
