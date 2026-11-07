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

  function ledger(state) {
    var people = {};
    function person(uid) {
      if (!people[uid]) {
        var a = (state.accounts && state.accounts[uid]) || {};
        people[uid] = {
          uid: uid, n: a.n || 'Player', tag: a.tag || '',
          available: a.bal || 0, reserved: 0, escrow: 0, collect: 0,
          settled: 0, settledKnown: false, stack: a.bal || 0
        };
      }
      return people[uid];
    }
    Object.keys(state.accounts || {}).forEach(person);
    var offers = [];
    Object.keys(state.orders || {}).forEach(function (id) {
      var o = state.orders[id];
      if (!o || o.st !== 'open' || !(o.rem > 0)) return;
      var hold = o.rem * o.px;
      var p = person(o.uid);
      p.reserved += hold;
      p.stack += hold;
      offers.push({ id: id, uid: o.uid, mid: o.mid, side: o.side, px: o.px, rem: o.rem, shares: o.shares, hold: hold, t: o.t });
    });
    var bets = [];
    Object.keys(state.fills || {}).forEach(function (id) {
      var f = state.fills[id];
      if (!f) return;
      var call = marketCall(f, state);
      if (call === 'bad') call = null;
      function sideRow(side) {
        var uid = side === 'yes' ? f.yesUid : f.noUid;
        var pay = side === 'yes' ? f.yesPay : f.noPay;
        var limit = side === 'yes' ? f.yesPx : f.noPx;
        var claimed = side === 'yes' ? !!f.claimedYes : !!f.claimedNo;
        var cost = pay * f.shares;
        var improved = (typeof limit === 'number' && limit > pay) ? (limit - pay) * f.shares : 0;
        var p = person(uid);
        var payout = call == null ? null : payoutFor(f, side, state);
        if (!claimed) {
          if (payout == null) { p.escrow += cost; p.stack += cost; }
          else { p.collect += payout; p.stack += payout; }
        }
        if (payout != null) { p.settled += payout - cost; p.settledKnown = true; }
        return { uid: uid, side: side, cost: cost, payout: payout, claimed: claimed, possible: 100 * f.shares, improved: improved };
      }
      bets.push({ id: id, mid: f.mid, shares: f.shares, t: f.t, call: call, yesPay: f.yesPay, noPay: f.noPay, yes: sideRow('yes'), no: sideRow('no') });
    });
    offers.sort(function (a, b) { return a.t - b.t || a.id.localeCompare(b.id); });
    bets.sort(function (a, b) { return b.t - a.t || a.id.localeCompare(b.id); });
    var players = Object.keys(people).map(function (id) { return people[id]; });
    players.sort(function (a, b) { return b.stack - a.stack || a.n.localeCompare(b.n) || a.tag.localeCompare(b.tag); });
    return { players: players, offers: offers, bets: bets };
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
  function chartColors() {
    return { yes: '#1f9d55', no: '#173d79' };
  }
  function chartHtml(mid, fills) {
    var yesName = outcomeName(mid, 'yes');
    var noName = outcomeName(mid, 'no');
    var color = chartColors();
    var pts = [];
    Object.keys(fills || {}).forEach(function (id) {
      var f = fills[id];
      if (!f || f.mid !== mid || typeof f.yesPay !== 'number' || typeof f.t !== 'number') return;
      pts.push(f);
    });
    pts.sort(function (a, b) { return a.t - b.t || String(a.id || '').localeCompare(String(b.id || '')); });
    var plotX = 2, plotY = 12, plotW = 228, plotH = 92, vbH = 120;
    function yOf(p) {
      var c = Math.max(0, Math.min(100, p));
      return plotY + ((100 - c) / 100) * plotH;
    }
    function xOf(t) {
      if (pts.length < 2 || pts[pts.length - 1].t === pts[0].t) return plotX + plotW;
      return plotX + ((t - pts[0].t) / (pts[pts.length - 1].t - pts[0].t)) * plotW;
    }
    function lineD(side) {
      return pts.map(function (f, i) {
        var p = side === 'yes' ? f.yesPay : (100 - f.yesPay);
        return (i ? 'L' : 'M') + xOf(f.t).toFixed(1) + ' ' + yOf(p).toFixed(1);
      }).join(' ');
    }
    function areaD(side) {
      var base = (plotY + plotH).toFixed(1);
      return lineD(side) + ' L' + xOf(pts[pts.length - 1].t).toFixed(1) + ' ' + base + ' L' + xOf(pts[0].t).toFixed(1) + ' ' + base + ' Z';
    }
    var marks = '';
    if (pts.length >= 2) {
      marks += '<path class="wash" data-side="yes" d="' + areaD('yes') + '" fill="' + color.yes + '" opacity="0.14" stroke="none"/>';
      marks += '<path class="wash" data-side="no" d="' + areaD('no') + '" fill="' + color.no + '" opacity="0.12" stroke="none"/>';
      marks += '<path data-side="yes" d="' + lineD('yes') + '" fill="none" stroke="' + color.yes + '" stroke-width="2.5" stroke-linejoin="round"/>';
      marks += '<path data-side="no" d="' + lineD('no') + '" fill="none" stroke="' + color.no + '" stroke-width="2.5" stroke-dasharray="5 4" stroke-linejoin="round"/>';
    }
    var last = pts.length ? pts[pts.length - 1] : null;
    if (last) {
      var x = xOf(last.t).toFixed(1);
      marks += '<circle data-side="no" cx="' + x + '" cy="' + yOf(100 - last.yesPay).toFixed(1) + '" r="5.5" fill="' + color.no + '"/>';
      marks += '<circle data-side="yes" cx="' + x + '" cy="' + yOf(last.yesPay).toFixed(1) + '" r="5.5" fill="' + color.yes + '"/>';
    }
    var wait = pts.length ? '' : '<text x="116" y="58" text-anchor="middle" fill="#5f6368" font-size="12" font-family="Inter,sans-serif">No matched price yet</text>';
    var times = '';
    if (pts.length === 1) times = '<text x="116" y="116" text-anchor="middle" fill="#8d8a83" font-size="10" font-family="Inter,sans-serif">' + xml(ctStamp(pts[0].t)) + '</text>';
    else if (pts.length > 1) {
      times = '<text x="' + plotX + '" y="116" fill="#8d8a83" font-size="10" font-family="Inter,sans-serif">' + xml(ctStamp(pts[0].t)) + '</text>' +
        '<text x="' + (plotX + plotW) + '" y="116" text-anchor="end" fill="#8d8a83" font-size="10" font-family="Inter,sans-serif">' + xml(ctStamp(pts[pts.length - 1].t)) + '</text>';
    }
    var yesPct = last ? Math.round(last.yesPay * 10) / 10 : null;
    var noPct = last ? Math.round((100 - last.yesPay) * 10) / 10 : null;
    function labelTops(a, b) {
      if (Math.abs(a - b) >= 28) return [a, b];
      var mid = (a + b) / 2;
      var hi = Math.max(8, mid - 18);
      var lo = Math.min(80, mid + 18);
      if (a < b) return [hi, lo];
      if (a > b) return [lo, hi];
      return [hi, lo];
    }
    var yesLine = last ? (yOf(last.yesPay) / vbH) * 100 : 22;
    var noLine = last ? (yOf(100 - last.yesPay) / vbH) * 100 : 68;
    var tops = labelTops(yesLine, noLine);
    var yesLabel = tops[0];
    var noLabel = tops[1];
    var read = '<div class="kread" aria-hidden="true">' +
      '<div class="kend" data-side="yes" style="top:' + yesLabel.toFixed(1) + '%;color:' + color.yes + '"><span>' + xml(yesName) + '</span><b>' + (yesPct == null ? '—' : yesPct + '%') + '</b></div>' +
      '<div class="kend" data-side="no" style="top:' + noLabel.toFixed(1) + '%;color:' + color.no + '"><span>' + xml(noName) + '</span><b>' + (noPct == null ? '—' : noPct + '%') + '</b></div></div>';
    var aria = (pts.length ? ('Last matched price ' + yesPct + '% ' + yesName + ', ' + noPct + '% ' + noName + '. ') : 'No matched price yet. ') +
      'Not the price of a new post. Not a count of bets.';
    return '<div class="chart"><div class="kchart"><div class="kplot"><svg viewBox="0 0 232 ' + vbH + '" role="img" aria-label="' + xml(aria) + '">' +
      wait + marks + times + '</svg></div>' + read + '</div></div>';
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
  function ask(mid) {
    var prop = PROPS[mid];
    if (mid === 'ml') return 'Who wins?';
    if (mid === 'spd') return 'Who covers?';
    if (mid === 'tot') return 'Combined score?';
    if (mid === 'o35') return 'Oakridge points?';
    if (mid === 'f21') return 'Country Day points?';
    if (prop && prop.kind === 'scoring_td') return 'Does ' + prop.player + ' score a TD?';
    if (prop) return prop.player + ' · ' + prop.title + '?';
    return 'Pick a side';
  }
  function waitingSentence(mid, side, name) {
  var picked = outcomeName(mid, side);
  var need = outcomeName(mid, side === 'yes' ? 'no' : 'yes');
  return ask(mid) + ' ' + name + ' picked ' + picked + ', waiting for someone to pick ' + need + '.';
}
  function outcomeName(mid, side) {
    var prop = PROPS[mid], m = MARKETS[mid];
    if (prop && prop.kind === 'scoring_td') return side === 'yes' ? 'Scores a TD' : 'No TD';
    if (prop) return (side === 'yes' ? 'Over ' : 'Under ') + prop.line;
    if (m) return side === 'yes' ? m.yes : m.no;
    return side === 'yes' ? 'Yes' : 'No';
  }
  function quoteStake(state, order) {
    var budget = Math.round(Number(order.tokens) * 100);
    if (!Number.isFinite(budget) || budget < 1) return { error: 'Enter how many play tokens to risk.' };
    if (order.side !== 'yes' && order.side !== 'no') return { error: 'Pick a side first.' };
    var best = null;
    Object.keys(state.orders || {}).forEach(function (id) {
      var o = state.orders[id];
      if (!o || o.st !== 'open' || !(o.rem > 0) || o.mid !== order.mid || o.side === order.side) return;
      if (!best || o.px > best.px || (o.px === best.px && (o.t < best.t || (o.t === best.t && o.id < best.id)))) best = o;
    });
    if (best && best.uid === order.uid) return { error: 'You already have the other side posted. Cancel that first.' };
    var px = best ? (100 - best.px) : 50;
    if (!(px >= 1 && px <= 99)) return { error: 'That side cannot be posted.' };
    var shares = Math.floor(budget / px);
    if (shares < 1) return { error: 'That is too small. The smallest post here is ' + tokens(px) + ' play tokens.' };
    var cost = shares * px;
    var acct = state.accounts && state.accounts[order.uid];
    if (!acct) return { error: 'Get your play tokens first.' };
    if (acct.bal < cost) return { error: 'You only have ' + tokens(acct.bal) + ' play tokens available.' };
    var planned = plan(state, { id: order.id || 'quoteid0001', uid: order.uid, mid: order.mid, side: order.side, px: px, shares: shares, t: order.t });
    if (planned.error) return { error: planned.self ? 'You already have the other side posted. Cancel that first.' : planned.error };
    var matched = 0;
    (planned.fills || []).forEach(function (f) { matched += f.shares; });
    return {
      px: px, shares: shares, cost: cost, leftover: budget - cost, payout: shares * 100,
      matched: matched, waiting: planned.order.rem, even: !best,
      matchedRisk: matched * px, waitingRisk: planned.order.rem * px
    };
  }

  G.chartHtml = chartHtml;
  G.ledger = ledger;
  G.ctStamp = ctStamp;
  G.outcomeName = outcomeName;
  G.ask = ask;
  G.waitingSentence = waitingSentence;
  G.quoteStake = quoteStake;
})(typeof window !== 'undefined' ? (window.Crossbar = window.Crossbar || {}) : (globalThis.Crossbar = globalThis.Crossbar || {}));
