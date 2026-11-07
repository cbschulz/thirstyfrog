/* Oakridge vs Fort Worth Country Day. Play tokens only. 1 token = 100 cents. */
(function (G) {
  var GRANT = 10000;
  var CUTOFF = 1794096000000; // 2026-11-08T00:00:00.000Z = 6:00 p.m. America/Chicago
  var MARKETS = {
    ml: { id: 'ml', title: 'Outright winner', yes: 'Oakridge', no: 'Country Day', refYes: 81 },
    spd: { id: 'spd', title: 'Oakridge −15.5', yes: 'Oakridge −15.5', no: 'Country Day +15.5', refYes: 49 },
    tot: { id: 'tot', title: 'Combined total 56.5', yes: 'Over 56.5', no: 'Under 56.5', refYes: 50 },
    o35: { id: 'o35', title: 'Oakridge 35 or more', yes: '35 or more', no: '34 or fewer', refYes: 54 },
    f21: { id: 'f21', title: 'Country Day 21 or more', yes: '21 or more', no: '20 or fewer', refYes: 51 }
  };
  var PROPS = {
    p_stadler_td: { id: 'p_stadler_td', player: 'William Stadler', num: '10', pos: 'WR/CB', title: 'Scoring touchdowns', line: 0.5, kind: 'scoring_td' },
    p_stadler_rec: { id: 'p_stadler_rec', player: 'William Stadler', num: '10', pos: 'WR/CB', title: 'Receiving yards', line: 29.5, kind: 'rec_yds' },
    p_stadler_tck: { id: 'p_stadler_tck', player: 'William Stadler', num: '10', pos: 'WR/CB', title: 'Total tackles', line: 4.5, kind: 'tackles_total' },
    p_bluntzer_tck: { id: 'p_bluntzer_tck', player: 'Thomas Bluntzer', num: '28', pos: 'OLB/DE', title: 'Total tackles', line: 9.5, kind: 'tackles_total' },
    p_homan_rush: { id: 'p_homan_rush', player: 'Harrison Homan', num: '1', pos: 'RB/FS', title: 'Rushing yards', line: 58.5, kind: 'rush_yds' },
    p_homan_td: { id: 'p_homan_td', player: 'Harrison Homan', num: '1', pos: 'RB/FS', title: 'Scoring touchdowns', line: 0.5, kind: 'scoring_td' }
  };
  var PROP_WAIT = 72 * 60 * 60 * 1000;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function blank() { return { accounts: {}, orders: {}, fills: {}, status: 'open', score: null, results: {}, voids: {}, finalAt: 0, now: 0 }; }
  function tokens(cents) {
    var n = Math.round(Number(cents)) / 100;
    var neg = n < 0;
    var abs = Math.abs(n);
    var s = (Math.round(abs * 100) % 100 === 0) ? String(Math.round(abs)) : abs.toFixed(2);
    return (neg ? '-' : '') + s;
  }
  function id() {
    var a = '';
    for (var i = 0; i < 12; i++) a += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)];
    return a;
  }

  function marketListed(state, mid) {
    return !!(MARKETS[mid] || PROPS[mid]);
  }
  function deadlinePassed(state) {
    return !!(state.finalAt && state.now > state.finalAt + PROP_WAIT);
  }
  function propCall(prop, result, state) {
    if (!prop) return 'bad';
    if (state && state.status === 'void') return 'void';
    if (state && state.voids && state.voids[prop.id]) return 'void';
    if (!result) return state && deadlinePassed(state) ? 'void' : null;
    if (result.void || result.kind === 'void' || result.conflict || result.played === false) return 'void';
    if (result.played !== true || result.stat == null) return state && deadlinePassed(state) ? 'void' : null;
    if (!Number.isInteger(result.stat) || result.stat < 0) return 'void';
    return result.stat > prop.line ? 'yes' : 'no';
  }
  function outcome(mid, score, voided) {
    if (voided || !score) return 'void';
    var o = score.oak, f = score.fw;
    if (!Number.isInteger(o) || !Number.isInteger(f) || o < 0 || f < 0 || o > 200 || f > 200) return 'bad';
    if (mid === 'ml') return o === f ? 'void' : (o > f ? 'yes' : 'no');
    if (mid === 'spd') return (o - f >= 16) ? 'yes' : 'no';
    if (mid === 'tot') return (o + f >= 57) ? 'yes' : 'no';
    if (mid === 'o35') return o >= 35 ? 'yes' : 'no';
    if (mid === 'f21') return f >= 21 ? 'yes' : 'no';
    return 'bad';
  }

  function locked(order) { return order.rem * order.px; }

  function conservation(state) {
    var sum = 0, n = 0;
    Object.keys(state.accounts).forEach(function (u) { n++; sum += state.accounts[u].bal; });
    Object.keys(state.orders).forEach(function (id) {
      var o = state.orders[id];
      if (o.st === 'open') sum += o.rem * o.px;
    });
    Object.keys(state.fills).forEach(function (id) {
      var f = state.fills[id];
      if (!f.claimedYes) sum += f.yesPay * f.shares;
      if (!f.claimedNo) sum += f.noPay * f.shares;
    });
    return { sum: sum, expected: n * GRANT, ok: sum === n * GRANT };
  }

  function bestOpposing(state, order, ignore) {
    var best = null;
    Object.keys(state.orders).forEach(function (id) {
      var o = state.orders[id];
      if (!o || o.st !== 'open' || o.rem <= 0 || o.mid !== order.mid || o.side === order.side) return;
      if (ignore && ignore[id]) return;
      if (!best || o.px > best.px || (o.px === best.px && (o.t < best.t || (o.t === best.t && o.id < best.id)))) best = o;
    });
    return best;
  }

  function priceOf(resting, incoming) {
    if (resting.side === 'yes') return { yesPay: resting.px, noPay: 100 - resting.px };
    return { noPay: resting.px, yesPay: 100 - resting.px };
  }

  function plan(state, order) {
    if (!marketListed(state, order.mid)) return { error: 'That market is not on the board.' };
    if (order.side !== 'yes' && order.side !== 'no') return { error: 'Pick YES or NO.' };
    var px = Math.floor(Number(order.px)), shares = Math.floor(Number(order.shares));
    if (!(px >= 1 && px <= 99)) return { error: 'Price has to be between 1¢ and 99¢.' };
    if (!(shares >= 1)) return { error: 'At least one share.' };
    var acct = state.accounts[order.uid];
    if (!acct) return { error: 'Get your play tokens first.' };
    if (state.status !== 'open') return { error: 'The board is closed.' };
    if (!(order.t < CUTOFF)) return { error: 'Past the 6:00 p.m. cutoff.' };
    var cost = shares * px;
    if (acct.bal < cost) return { error: 'That costs more than you have.' };
    var scratch = clone(state);
    var incoming = { id: order.id, uid: order.uid, mid: order.mid, side: order.side, px: px, shares: shares, rem: shares, t: order.t, st: 'open' };
    var fills = [];
    var seen = {};
    while (incoming.rem > 0) {
      var best = bestOpposing(scratch, incoming, seen);
      if (!best || best.px + incoming.px < 100) break;
      if (best.uid === incoming.uid) {
        return { error: 'That would trade against your own offer. Cancel it first.', self: true };
      }
      var n = Math.min(incoming.rem, best.rem);
      var resting = best.t < incoming.t || (best.t === incoming.t && best.id < incoming.id) ? best : incoming;
      var pxr = priceOf(resting, resting === best ? incoming : best);
      if (pxr.yesPay + pxr.noPay !== 100) return { error: 'Price broke.' };
      var yesLimit = incoming.side === 'yes' ? incoming.px : best.px;
      var noLimit = incoming.side === 'no' ? incoming.px : best.px;
      if (pxr.yesPay > yesLimit || pxr.noPay > noLimit) return { error: 'Price is worse than the limit.' };
      fills.push({
        id: order.fillId || id(),
        mid: order.mid,
        shares: n,
        yesOid: incoming.side === 'yes' ? incoming.id : best.id,
        noOid: incoming.side === 'no' ? incoming.id : best.id,
        yesUid: incoming.side === 'yes' ? incoming.uid : best.uid,
        noUid: incoming.side === 'no' ? incoming.uid : best.uid,
        yesPay: pxr.yesPay,
        noPay: pxr.noPay,
        yesPx: yesLimit,
        noPx: noLimit,
        t: order.t,
        claimedYes: false,
        claimedNo: false,
        taker: incoming.uid
      });
      incoming.rem -= n;
      scratch.orders[best.id].rem -= n;
      if (scratch.orders[best.id].rem === 0) scratch.orders[best.id].st = 'filled';
      seen[best.id] = true;
    }
    return { fills: fills, order: incoming, cost: cost, rest: incoming.rem };
  }

  function applyPlan(state, planned) {
    if (planned.error) return { error: planned.error, state: state };
    var next = clone(state);
    var o = planned.order;
    var acct = next.accounts[o.uid];
    acct.bal -= o.shares * o.px;
    next.orders[o.id] = { id: o.id, uid: o.uid, mid: o.mid, side: o.side, px: o.px, shares: o.shares, rem: o.shares, t: o.t, st: 'open' };
    planned.fills.forEach(function (f) { applyFill(next, f); });
    if (next.orders[o.id].rem === 0) next.orders[o.id].st = 'filled';
    return { state: next, fills: planned.fills };
  }

  function applyFill(state, f) {
    var yes = state.orders[f.yesOid], no = state.orders[f.noOid];
    yes.rem -= f.shares;
    no.rem -= f.shares;
    if (yes.rem === 0) yes.st = 'filled';
    if (no.rem === 0) no.st = 'filled';
    state.accounts[f.yesUid].bal += (f.yesPx - f.yesPay) * f.shares;
    state.accounts[f.noUid].bal += (f.noPx - f.noPay) * f.shares;
    state.fills[f.id] = f;
  }

  function submit(state, order) {
    var planned = plan(state, order);
    if (planned.error) return { error: planned.error, self: planned.self, state: state };
    return applyPlan(state, planned);
  }

  function cancel(state, oid, uid, now) {
    var o = state.orders[oid];
    if (!o || o.st !== 'open' || o.rem <= 0) return { error: 'Nothing open to cancel.', state: state };
    if (o.uid !== uid) return { error: 'That offer is not yours.', state: state };
    var next = clone(state);
    var refund = next.orders[oid].rem * next.orders[oid].px;
    next.accounts[uid].bal += refund;
    next.orders[oid].rem = 0;
    next.orders[oid].st = 'canceled';
    next.orders[oid].canceledAt = now || 0;
    return { state: next, refund: refund };
  }

  function sweep(state, now) {
    var next = clone(state);
    var n = 0;
    if (now < CUTOFF && next.status === 'open') return { state: state, n: 0 };
    Object.keys(next.orders).forEach(function (id) {
      var o = next.orders[id];
      if (o.st !== 'open' || o.rem <= 0) return;
      next.accounts[o.uid].bal += o.rem * o.px;
      o.rem = 0;
      o.st = 'canceled';
      n++;
    });
    return { state: next, n: n };
  }

  function settle(state, score) {
    if (state.status === 'settled' || state.status === 'void') return { error: 'Already settled.', state: state };
    var next = clone(state);
    if (!score) {
      next.status = 'void';
      next.score = null;
    } else {
      if (outcome('ml', score, false) === 'bad') return { error: 'Score has to be a whole number for each team.', state: state };
      next.status = 'settled';
      next.score = { oak: score.oak, fw: score.fw };
      next.finalAt = score.finalAt || next.finalAt || 0;
      next.results = next.results || {};
    }
    return { state: sweep(next, CUTOFF).state };
  }

  function marketCall(fill, state) {
    if (state.status === 'void' || (state.voids && state.voids[fill.mid])) return 'void';
    if (PROPS[fill.mid]) return propCall(PROPS[fill.mid], state.results && state.results[fill.mid], state);
    if (state.status !== 'settled') return null;
    return outcome(fill.mid, state.score, false);
  }
  function payoutFor(fill, side, state) {
    var result = marketCall(fill, state);
    if (result == null || result === 'bad') return null;
    var pay = side === 'yes' ? fill.yesPay : fill.noPay;
    if (result === 'void') return pay * fill.shares;
    if (result === side) return 100 * fill.shares;
    return 0;
  }

  function claim(state, fid, side, uid) {
    var f = state.fills[fid];
    if (!f) return { error: 'No such trade.', state: state };
    if (marketCall(f, state) == null) return { error: 'Not settled yet.', state: state };
    var owner = side === 'yes' ? f.yesUid : f.noUid;
    if (owner !== uid) return { error: 'That side is not yours.', state: state };
    var flag = side === 'yes' ? 'claimedYes' : 'claimedNo';
    if (f[flag]) return { error: 'Already paid.', state: state, idempotent: true };
    var amt = payoutFor(f, side, state);
    if (amt == null) return { error: 'Bad result.', state: state };
    var next = clone(state);
    next.accounts[uid].bal += amt;
    next.fills[fid][flag] = true;
    return { state: next, amt: amt };
  }

  function xml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ctStamp(ms) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(ms));
  }
  function chartHtml(mid, fills) {
    var prop = PROPS[mid], m = MARKETS[mid];
    var yes = prop ? ('Over ' + prop.line) : (m ? m.yes : 'Yes');
    var no = prop ? ('Under ' + prop.line) : (m ? m.no : 'No');
    var pts = [];
    Object.keys(fills || {}).forEach(function (id) {
      var f = fills[id];
      if (!f || f.mid !== mid || typeof f.yesPay !== 'number' || typeof f.t !== 'number') return;
      pts.push(f);
    });
    pts.sort(function (a, b) { return a.t - b.t || String(a.id).localeCompare(String(b.id)); });
    var plotX = 32, plotY = 14, plotW = 276, plotH = 78;
    function yOf(p) {
      var c = Math.max(0, Math.min(100, p));
      return plotY + ((100 - c) / 100) * plotH;
    }
    function xOf(t) {
      if (pts.length < 2 || pts[pts.length - 1].t === pts[0].t) return plotX + plotW / 2;
      return plotX + ((t - pts[0].t) / (pts[pts.length - 1].t - pts[0].t)) * plotW;
    }
    var grid = [100, 50, 0].map(function (p) {
      var y = yOf(p);
      return '<line x1="' + plotX + '" x2="' + (plotX + plotW) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#3c4338" stroke-width="1"/>' +
        '<text x="2" y="' + (y + 4).toFixed(1) + '" fill="#c9c2b4" font-size="11" font-family="Outfit,sans-serif">' + p + '</text>';
    }).join('');
    var marks = '';
    if (pts.length >= 2) {
      marks += '<path d="' + pts.map(function (f, i) {
        return (i ? 'L' : 'M') + xOf(f.t).toFixed(1) + ' ' + yOf(f.yesPay).toFixed(1);
      }).join(' ') + '" fill="none" stroke="#e4c98a" stroke-width="2" stroke-linejoin="round"/>';
    }
    pts.forEach(function (f) {
      marks += '<circle cx="' + xOf(f.t).toFixed(1) + '" cy="' + yOf(f.yesPay).toFixed(1) + '" r="3.5" fill="#e4c98a"/>';
    });
    var wait = pts.length ? '' : '<text x="170" y="58" text-anchor="middle" fill="#c9c2b4" font-size="12" font-family="Outfit,sans-serif">Waiting for first matched trade</text>';
    var times = '';
    if (pts.length === 1) {
      times = '<text x="170" y="118" text-anchor="middle" fill="#c9c2b4" font-size="11" font-family="Outfit,sans-serif">' + xml(ctStamp(pts[0].t)) + '</text>';
    } else if (pts.length > 1) {
      times = '<text x="' + plotX + '" y="118" fill="#c9c2b4" font-size="11" font-family="Outfit,sans-serif">' + xml(ctStamp(pts[0].t)) + '</text>' +
        '<text x="' + (plotX + plotW) + '" y="118" text-anchor="end" fill="#c9c2b4" font-size="11" font-family="Outfit,sans-serif">' + xml(ctStamp(pts[pts.length - 1].t)) + '</text>';
    } else {
      times = '<text x="170" y="118" text-anchor="middle" fill="#c9c2b4" font-size="11" font-family="Outfit,sans-serif">Central time</text>';
    }
    var aria = (pts.length ? (pts.length + ' matched trade' + (pts.length === 1 ? '' : 's') + '. ') : 'Waiting for first matched trade. ') +
      yes + ' price in cents, from 0 to 100. ' + no + ' is 100 cents minus that.';
    var cap = xml(yes) + ' ¢. ' + xml(no) + ' is 100¢ minus this. Central time.';
    return '<div class="chart"><svg viewBox="0 0 320 128" role="img" aria-label="' + xml(aria) + '">' +
      grid + wait + marks + times + '</svg><p>' + cap + '</p></div>';
  }

  function claimAll(state, uid) {
    var next = state, paid = 0;
    Object.keys(state.fills).forEach(function (id) {
      ['yes', 'no'].forEach(function (side) {
        var r = claim(next, id, side, uid);
        if (!r.error) { next = r.state; paid += r.amt; }
      });
    });
    return { state: next, paid: paid };
  }

  G.GRANT = GRANT;
  G.CUTOFF = CUTOFF;
  G.MARKETS = MARKETS;
  G.PROPS = PROPS;
  G.PROP_WAIT = PROP_WAIT;
  G.blank = blank;
  G.tokens = tokens;
  G.id = id;
  G.outcome = outcome;
  G.propCall = propCall;
  G.marketListed = marketListed;
  G.plan = plan;
  G.submit = submit;
  G.cancel = cancel;
  G.sweep = sweep;
  G.settle = settle;
  G.claim = claim;
  G.claimAll = claimAll;
  G.payoutFor = payoutFor;
  G.conservation = conservation;
  G.locked = locked;
  G.chartHtml = chartHtml;
})(typeof window !== 'undefined' ? (window.Crossbar = window.Crossbar || {}) : (globalThis.Crossbar = globalThis.Crossbar || {}));
