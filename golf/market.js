/* Play-money market helpers for Torii Golf. Prices are cents derived from American odds. */
(function (G) {
  function centsFromAmerican(odds) {
    const n = Number(String(odds == null ? '' : odds).trim().replace(/^\+/, ''));
    if (!Number.isFinite(n) || n === 0) return null;
    const imp = n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
    return Math.max(1, Math.min(99, Math.round(imp * 100)));
  }
  function marketSides(line) {
    const kind = String(line.kind || '').toLowerCase();
    const named = Array.isArray(line.outcomes) && line.outcomes.length;
    if (!named && (kind === 'ou' || line.over != null || line.under != null)) {
      const n = line.line == null ? '' : line.line;
      return [
        { id: 'over', label: 'Over ' + n, odds: line.over, cents: centsFromAmerican(line.over) },
        { id: 'under', label: 'Under ' + n, odds: line.under, cents: centsFromAmerican(line.under) }
      ].filter(function (s) { return s.cents; });
    }
    return (line.outcomes || []).map(function (o, i) {
      const odds = o.odds != null ? o.odds : o.price;
      return { id: 'o' + i, label: o.name || o.player || ('Option ' + (i + 1)), odds: odds, cents: centsFromAmerican(odds) };
    }).filter(function (s) { return s.cents; });
  }
  function payoutFor(amount, cents) {
    const a = Math.floor(Number(amount));
    const p = Math.floor(Number(cents));
    if (!(a > 0) || p < 1 || p > 99) return 0;
    return Math.floor(a * 100 / p);
  }
  function newBetId() {
    const bytes = new Uint8Array(10);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] % 36).toString(36);
    return s.slice(0, 12);
  }
  function lineOpen(group, line, now) {
    const clock = now == null ? Date.now() : now;
    const tee = Date.parse(group.teeTime || '');
    const teeMs = Number(group.teeTimeMs);
    const past = (Number.isFinite(teeMs) && clock >= teeMs) || (Number.isFinite(tee) && clock >= tee);
    return String(line.status || 'open').toLowerCase() === 'open' && !past;
  }
  function buildBetUpdate(o) {
    const bid = o.bid || newBetId();
    const t = o.t || Date.now();
    const line = String(o.line);
    const amount = Math.floor(Number(o.amount));
    const price = Math.floor(Number(o.price));
    const updates = {};
    updates['golf_accounts/' + o.uid + '/bal'] = o.bal - amount;
    updates['golf_accounts/' + o.uid + '/lk'] = bid;
    updates['golf_accounts/' + o.uid + '/lc'] = o.club;
    updates['golf_accounts/' + o.uid + '/ld'] = o.date;
    updates['golf_accounts/' + o.uid + '/lg'] = o.gid;
    updates['golf_bets/' + o.club + '/' + o.date + '/' + o.gid + '/' + bid] = {
      id: bid, line: line, side: o.side, uid: o.uid, a: amount, px: price, t: t, st: 'open'
    };
    updates['golf_mybets/' + o.uid + '/' + bid] = {
      club: o.club, date: o.date, gid: o.gid, line: line, side: o.side, a: amount, px: price, t: t, st: 'open', title: o.title || '', label: o.label || o.side
    };
    updates['golf_activity/' + o.club + '/' + o.date + '/' + o.gid + '/' + bid] = {
      n: o.name, line: line, side: o.side, a: amount, t: t, title: o.title || '', label: o.label || o.side
    };
    updates['golf_prices/' + o.club + '/' + o.date + '/' + o.gid + '/' + line + '/trades/' + bid] = {
      c: price, t: t, src: 'trade', side: o.side
    };
    return { bid: bid, updates: updates };
  }
  function sparkline(points, tone) {
    const w = 320, h = 78, pad = 6;
    const toneName = tone === 'no' || tone === 'gold' || tone === 'teal' ? tone : 'yes';
    const color = toneName === 'no' ? '#8d3b45' : toneName === 'gold' ? '#a68545' : toneName === 'teal' ? '#1d5c62' : '#1f6b45';
    const pts = (points || []).filter(function (p) { return p && Number.isFinite(+p.c); });
    if (!pts.length) return '';
    if (pts.length === 1) pts.push({ t: pts[0].t + 1, c: pts[0].c });
    const minT = pts[0].t, maxT = pts[pts.length - 1].t;
    let minC = 100, maxC = 0;
    pts.forEach(function (p) { minC = Math.min(minC, p.c); maxC = Math.max(maxC, p.c); });
    if (minC === maxC) { minC = Math.max(0, minC - 8); maxC = Math.min(100, maxC + 8); }
    const x = function (t) { return pad + (w - pad * 2) * ((t - minT) / ((maxT - minT) || 1)); };
    const y = function (c) { return pad + (h - pad * 2) * (1 - (c - minC) / ((maxC - minC) || 1)); };
    let d = '', area = '';
    pts.forEach(function (p, i) {
      const cmd = (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.c).toFixed(1);
      d += cmd;
      area += cmd;
    });
    area += 'L' + x(pts[pts.length - 1].t).toFixed(1) + ' ' + (h - pad) + 'L' + x(pts[0].t).toFixed(1) + ' ' + (h - pad) + 'Z';
    const gid = 'sg' + Math.random().toString(36).slice(2, 8);
    return '<svg class="spark spark-' + toneName + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Price history"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity="0.38"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs><path class="area" fill="url(#' + gid + ')" d="' + area + '"/><path class="line" stroke="' + color + '" d="' + d + '"/></svg>';
  }
  G.centsFromAmerican = centsFromAmerican;
  G.marketSides = marketSides;
  G.payoutFor = payoutFor;
  G.newBetId = newBetId;
  G.lineOpen = lineOpen;
  G.buildBetUpdate = buildBetUpdate;
  G.sparkline = sparkline;
})(typeof window !== 'undefined' ? (window.ToriiGolf = window.ToriiGolf || {}) : (globalThis.ToriiGolf = globalThis.ToriiGolf || {}));
