(function () {
  var X = window.Crossbar, W = window.CrossbarWire;
  var FB = { apiKey: 'AIzaSyALDF-z2uZONruRz2EXbJAfWKHnW4FS5qA', authDomain: 'thirstyfrog-e2aed.firebaseapp.com', databaseURL: 'https://thirstyfrog-e2aed-default-rtdb.firebaseio.com', projectId: 'thirstyfrog-e2aed', appId: '1:656084503103:web:aca5e6473fd2b920ec868a' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var BASIS = {
    p_stadler_td: '2 receiving touchdowns in 10 games. Over 0.5 means at least one scoring touchdown.',
    p_stadler_rec: '40.1 receiving yards a game, blended with 18 against Oakridge, to 29.5.',
    p_stadler_tck: '47 total tackles in 10 games, 4.7 a game, to the nearest half-point.',
    p_homan_rush: '589 rushing yards in 10 games, 58.9 a game, to the nearest half-point.',
    p_homan_td: '8 rushing and 3 receiving touchdowns in 10 games. Over 0.5 means at least one scoring touchdown.',
    p_bluntzer_tck: '97 total tackles in 10 games, 9.7 a game, to the nearest half-point.'
  };
  var DETAIL = {
    p_stadler_td: 'Scoring touchdowns are rushing, receiving, kick or punt return, or a defensive return. Passing touchdowns, extra points, and two-point conversions do not count. The season card shows 2 receiving touchdowns. A profile total of 3 is not used, because the third score is not verified. This line is an anytime threshold, not a chance.',
    p_stadler_rec: 'Receiving yards are the official receiving-yard count. Over 29.5 means 30 or more. The line weights his season average (401 yards in 10 games) equally with 18 yards on 1 catch against Oakridge on Oct 9, which is 29.05, then rounds to 29.5. That blend is a judgment, not a fitted price.',
    p_stadler_tck: 'Total tackles are solo plus assisted. Each assist counts as one. Overtime counts. Over 4.5 means 5 or more. The 2026–27 defense table lists 10 games, 21 solo, 26 assisted, and 47 total. No opponent or pace adjustment.',
    p_homan_rush: 'Rushing yards are the official rushing-yard count. Over 58.5 means 59 or more. 124 carries and 589 yards in 10 games is 58.9 a game. No opponent adjustment, and no earlier Oakridge rushing line is used.',
    p_homan_td: 'Scoring touchdowns are rushing, receiving, kick or punt return, or a defensive return. Passing touchdowns, extra points, and two-point conversions do not count. The season card shows 8 rushing and 3 receiving touchdowns in 10 games. That count is not an anytime chance. No tackle line is offered.',
    p_bluntzer_tck: 'Total tackles are solo plus assisted. Each assist counts as one. Overtime counts. Over 9.5 means 10 or more. The 2026–27 defense table lists 10 games, 38 solo, 59 assisted, and 97 total. No opponent or pace adjustment.'
  };
  var SOURCES = {
    p_stadler_td: 'https://www.maxpreps.com/tx/fort-worth/fort-worth-country-day-falcons/athletes/william-stadler/football/stats/?careerid=4tigea67b3q00',
    p_stadler_rec: 'https://www.maxpreps.com/tx/fort-worth/fort-worth-country-day-falcons/athletes/william-stadler/football/stats/?careerid=4tigea67b3q00',
    p_stadler_tck: 'https://www.maxpreps.com/tx/fort-worth/fort-worth-country-day-falcons/athletes/william-stadler/football/stats/?careerid=4tigea67b3q00',
    p_homan_rush: 'https://www.maxpreps.com/tx/fort-worth/fort-worth-country-day-falcons/athletes/harrison-homan/football/stats/?careerid=2ukpsvlkthgrb',
    p_homan_td: 'https://www.maxpreps.com/tx/fort-worth/fort-worth-country-day-falcons/athletes/harrison-homan/football/stats/?careerid=2ukpsvlkthgrb',
    p_bluntzer_tck: 'https://www.maxpreps.com/tx/fort-worth/fort-worth-country-day-falcons/athletes/thomas-bluntzer/football/stats/?careerid=v15n941ughscc'
  };
  var SETTLE = 'Settlement uses the coach-entered MaxPreps box score for this player in the Nov 7 game against Oakridge, overtime included. It is not a season total and not a guess from earlier games. The operator has 72 hours after the official final. If the stat is missing, unpublished, or in unresolved conflict, if participation is unconfirmed or he did not play, or if the game is canceled or unfinished, the market is void and every token is refunded. A blank stat is never entered as zero. Posting the final score does not settle a player prop.';
  var state = X.blank();
  var uid = null, mine = null, admin = false, sel = null, note = '', rulesLive = false, busy = false, preview = location.hash === '#preview';
  var root = document.getElementById('app');

  function tok(c) { return X.tokens(c) + (Math.abs(c) === 100 ? '' : ''); }
  function rows(node) {
    var o = {};
    if (!node) return o;
    Object.keys(node).forEach(function (a) {
      Object.keys(node[a] || {}).forEach(function (b) { o[b] = node[a][b]; });
    });
    return o;
  }
  function ingest(orders, fills, accounts, event, results, voids) {
    var next = X.blank();
    next.orders = orders || {};
    next.fills = fills || {};
    next.accounts = accounts || {};
    next.status = (event && event.status) || 'open';
    next.score = event && event.status === 'settled' ? { oak: event.oak, fw: event.fw } : null;
    next.finalAt = (event && event.finalAt) || 0;
    next.now = Date.now();
    next.results = {};
    Object.keys(results || {}).forEach(function (id) {
      var r = results[id];
      next.results[id] = r.kind === 'void' ? { kind: 'void', void: true, played: r.played, conflict: r.conflict } : { kind: 'stat', played: r.played === true, stat: r.stat, conflict: r.conflict === true };
    });
    next.voids = {};
    Object.keys(voids || {}).forEach(function (id) {
      if (voids[id] && voids[id].void === true) next.voids[id] = true;
    });
    state = next;
  }
  function bestOpen(mid, side) {
    var best = null;
    Object.keys(state.orders).forEach(function (id) {
      var o = state.orders[id];
      if (!o || o.mid !== mid || o.side !== side || o.st !== 'open' || o.rem <= 0) return;
      if (!best || o.px > best.px) best = o;
    });
    return best;
  }
  function chart(mid) {
    return X.chartHtml(mid, state.fills);
  }
  function book(mid) {
    var list = Object.keys(state.orders).map(function (id) { return state.orders[id]; }).filter(function (o) { return o && o.mid === mid && o.st === 'open' && o.rem > 0; });
    if (!list.length) return '<p class="empty">No pending offers.</p>';
    return list.sort(function (a, b) { return b.px - a.px; }).map(function (o) {
      var mineBtn = o.uid === uid ? '<button type="button" data-cancel="' + esc(o.id) + '">Cancel</button>' : '';
      return '<div class="offer"><p>' + X.waitingSentence(mid, o.side, whoLabel(o.uid)) + ' ' + X.tokens(o.rem * o.px) + ' play tokens are set aside.</p>' + mineBtn + '</div>';
    }).join('');
  }
  function rulesBox(mid) {
    var prop = X.PROPS[mid], m = X.MARKETS[mid];
    var body = prop
      ? '<p>' + esc(DETAIL[mid]) + '</p><p>' + esc(SETTLE) + '</p><p><a href="' + esc(SOURCES[mid]) + '">MaxPreps season stats</a></p>'
      : '<p>' + esc(m.yes) + ' / ' + esc(m.no) + '. Pregame read ' + m.refYes + '¢ / ' + (100 - m.refYes) + '¢. That read is not a trade and not a live price. The number on the card does not move. A tie voids the outright winner only. Oakridge −15.5 needs a win by 16 or more. Combined 56.5: 57 or more is over. 35 and 21 are included on those yes sides. The house does not take a side. Unmatched tokens come back if you cancel or the board closes.</p>';
    return '<details class="rules"><summary>Rules &amp; sources</summary>' + body + '</details>';
  }
  function card(mid) {
    var prop = X.PROPS[mid], m = X.MARKETS[mid];
    var kicker = prop ? prop.player + ' · #' + prop.num + ' ' + prop.pos : 'Game line';
    var title = prop ? prop.title : m.title;
    var line = prop && prop.kind !== 'scoring_td' ? 'O/U ' + prop.line : '';
    var face = prop ? '<p class="basis">' + esc(BASIS[mid]) + '</p>' : '';
    var open = sel && sel.mid === mid;
    var canOffer = preview || rulesLive;
    var offers = book(mid);
    var pend = offers.indexOf('empty') >= 0 ? '' : offers;
    function sideBtn(side, cls) {
      var picked = open && sel.side === side ? ' pick' : '';
      return '<button type="button" class="' + cls + picked + '" data-bet="' + mid + '" data-side="' + side + '">' + esc(X.outcomeName(mid, side)) + '</button>';
    }
    var buttons = canOffer
      ? '<div class="row">' + sideBtn('yes', 'yes') + sideBtn('no', 'no') + '</div>'
      : '<p class="sub">Posts are closed until this board is open.</p>';
    return '<article class="card" id="' + mid + '"><div class="cat">' + esc(kicker) + '</div><div class="q">' + esc(X.ask(mid)) + '</div>' + (line ? '<p class="basis">' + esc(line) + '</p>' : '') + face + chart(mid) + buttons + pend + rulesBox(mid) + '</article>';
  }
  function profiles() {
    var rows = [
      ['#2 Hayes Casey', 'QB · 10 GP', '2097 pass yds · 24 pass TD · 8 INT · 217 rush yds · 3 rush TD'],
      ['#1 Harrison Homan', 'RB/FS · 10 GP', '124 carries · 589 rush yds · 8 rush TD · 22 catches · 218 rec yds · 3 rec TD'],
      ['#3 Owen Bloemendal', 'WR/CB · 8 GP', '39 catches · 728 rec yds · 10 rec TD'],
      ['#10 William Stadler', 'WR/CB · 10 GP', '29 catches · 401 rec yds · 2 rec TD · 47 total tackles (21 solo, 26 assisted)'],
      ['#28 Thomas Bluntzer', 'OLB/DE · 10 GP', '97 total tackles (38 solo, 59 assisted)']
    ];
    return '<section class="profiles"><h2>Season snapshots</h2><p class="sub">2026–27 stats. Not a ranking.</p><div class="prow">' + rows.map(function (r) {
      return '<article><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span><p>' + esc(r[2]) + '</p></article>';
    }).join('') + '</div></section>';
  }
  function mtitle(mid) {
    var prop = X.PROPS[mid], m = X.MARKETS[mid];
    return prop ? prop.player + ' · ' + prop.title : (m ? m.title : mid);
  }
  function sname(mid, side) { return X.outcomeName(mid, side); }
  function whoLabel(uid) {
    var a = state.accounts[uid];
    if (!a || !a.n) return 'Someone';
    var dup = Object.keys(state.accounts).some(function (id) {
      return id !== uid && state.accounts[id] && state.accounts[id].n === a.n;
    });
    return esc(a.n) + (dup ? ' <span class="tag">' + esc(a.tag) + '</span>' : '');
  }
  function pname(uid) { return whoLabel(uid); }
  function sideStatus(row, label) {
    if (row.payout == null) return 'Pending. ' + X.tokens(row.possible) + ' tokens only if ' + esc(label) + ' wins. Not counted as a win yet.';
    if (row.payout === row.possible) return 'Won ' + X.tokens(row.payout) + ' play tokens from escrow.' + (row.claimed ? ' In the wallet.' : ' Still to collect.');
    if (row.payout === row.cost) return 'Refund ' + X.tokens(row.cost) + ' play tokens.' + (row.claimed ? ' In the wallet.' : ' Still to collect.');
    return 'Gets 0. The stake stays in escrow for the other side.';
  }
  function standings() {
    var book = X.ledger(state);
    var lb = book.players.length ? book.players.map(function (p, i) {
      return '<div class="person"><b>' + (i + 1) + '. ' + whoLabel(p.uid) + '</b>' +
        '<span>Available ' + X.tokens(p.available) + '</span>' +
        '<span>Reserved on open offers ' + X.tokens(p.reserved) + '</span>' +
        '<span>In matched stakes ' + X.tokens(p.escrow) + '</span>' +
        '<span>Settled, not in wallet yet ' + X.tokens(p.collect) + '</span>' +
        '<span>Settled result ' + (p.settledKnown ? X.tokens(p.settled) : '—') + '</span></div>';
    }).join('') : '<div class="person">No one has taken tokens yet.</div>';
    var offers = book.offers.length ? book.offers.map(function (o) {
      return '<div class="bet"><p>' + X.waitingSentence(o.mid, o.side, pname(o.uid)) + '</p><p class="cond">' + X.tokens(o.hold) + ' play tokens are set aside, not matched. Cancel returns them. ' + esc(X.ctStamp(o.t)) + '.</p></div>';
    }).join('') : '<div class="person">No unmatched offers.</div>';
    var bets = book.bets.length ? book.bets.map(function (b) {
      var why = b.call == null
        ? 'Not settled. If ' + esc(sname(b.mid, 'yes')) + ' wins, ' + pname(b.yes.uid) + ' gets ' + X.tokens(b.yes.possible) + ' and ' + pname(b.no.uid) + ' gets 0. It flips if ' + esc(sname(b.mid, 'no')) + ' wins. A void refunds each stake. Nothing is owed yet.'
        : (b.call === 'void'
          ? 'Void. ' + pname(b.yes.uid) + ' is refunded ' + X.tokens(b.yes.cost) + ' and ' + pname(b.no.uid) + ' is refunded ' + X.tokens(b.no.cost) + '.'
          : pname(b.call === 'yes' ? b.yes.uid : b.no.uid) + ' gets ' + X.tokens(b.call === 'yes' ? b.yes.payout : b.no.payout) + ' play tokens from the escrow. ' + pname(b.call === 'yes' ? b.no.uid : b.yes.uid) + ' gets 0.');
      function line(row) {
        var back = row.improved ? ' ' + X.tokens(row.improved) + ' already returned to available because the match was better than the offer.' : '';
        return '<p>' + pname(row.uid) + ' · ' + esc(sname(b.mid, row.side)) + ' · risked ' + X.tokens(row.cost) + back + '</p><p class="cond">' + sideStatus(row, sname(b.mid, row.side)) + '</p>';
      }
      return '<div class="bet"><b>' + esc(mtitle(b.mid)) + ' · ' + esc(X.ctStamp(b.t)) + '</b>' + line(b.yes) + line(b.no) + '<p class="cond">' + why + ' No cash.</p></div>';
    }).join('') : '<div class="person">No matched trades yet. Nothing is owed.</div>';
    return '<section class="stand"><h2>Token leaderboard</h2><p class="sub">Play tokens only. Available is what you can still post. Set aside is waiting for the other side. In a match is already paired. A possible win is not counted yet. If two people use the same name, a small code keeps them apart. No cash is owed.</p><div class="lb">' + lb + '</div><h2>Waiting posts</h2><div class="lb">' + offers + '</div><h2>Matched play</h2><p class="sub">Who took each side. Tokens already set aside pay the winner. Nothing is owed in cash.</p><div class="lb">' + bets + '</div></section>';
  }
  function gate() {
    if (preview) return '';
    if (!rulesLive) return '<p class="toast">Play tokens are not open. Offers stay off until this game’s rules are published on the existing database.</p>';
    if (mine) return '<p class="bal"><b>' + X.tokens(mine.bal) + '</b> play tokens · ' + esc(mine.n) + ' · ' + esc(mine.tag) + '</p>';
    return '<form class="gate" id="gate"><h2>Your name for this game</h2><p>This event only. You get 100 play tokens once on this browser. The same name on another phone is a different stack. Clearing this browser can get another 100. A name is not proof you are the only person using it.</p><label>Display name<input name="n" maxlength="24" autocomplete="nickname" required></label><button class="go" type="submit">Get 100 play tokens</button></form>';
  }
  function paintStats() {
    var bal = document.getElementById('sBal');
    if (!bal) return;
    var book = X.ledger(state);
    var me = null;
    book.players.forEach(function (p) { if (p.uid === uid) me = p; });
    bal.textContent = me ? X.tokens(me.available) : '—';
    var openEl = document.getElementById('sOpen');
    if (openEl) openEl.textContent = me ? X.tokens(me.reserved) : '—';
    var vol = 0;
    Object.keys(state.fills || {}).forEach(function (id) { var f = state.fills[id]; if (f) vol += f.shares * 100; });
    var volEl = document.getElementById('sVol');
    if (volEl) volEl.textContent = X.tokens(vol);
  }
  function draw() {
    var phase = state.status === 'open' && Date.now() < X.CUTOFF ? 'Open until 6:00 p.m. CT' : (state.status === 'settled' ? 'Final posted' : 'Orders closed');
    root.innerHTML = '<p class="phase">' + phase + '</p>' + gate() + (note ? '<p class="toast">' + esc(note) + '</p>' : '') +
      '<h2>The board</h2><p class="sub">Pick a side. Then choose how many play tokens to risk.</p>' +
      ['ml', 'spd', 'tot', 'o35', 'f21'].map(card).join('') +
      '<h2>Player props</h2><p class="sub">Same idea. The name on the button is the side you are posting.</p>' +
      ['p_stadler_td', 'p_stadler_rec', 'p_stadler_tck', 'p_homan_rush', 'p_homan_td', 'p_bluntzer_tck'].map(card).join('') +
      profiles() + standings() +
      (admin ? '<h2>Operator</h2><p class="sub">The final score does not settle a player prop. A missing stat is void, not zero.</p><form class="card" id="score"><label>Oakridge<input name="oak" type="number" min="0" max="200"></label><label>Country Day<input name="fw" type="number" min="0" max="200"></label><button class="btn" type="submit">Post final</button></form><button type="button" class="btn ghost" id="voidgame">Void the game and refund</button>' : '');
    paintStats();
    bind();
    if (sel && document.getElementById('slipM').classList.contains('s')) refreshQuote();
  }
  function bind() {
    root.querySelectorAll('[data-bet]').forEach(function (b) {
      b.onclick = function () {
        if (!mine && !preview) { note = 'Enter your name to use play tokens.'; draw(); return; }
        sel = { mid: b.dataset.bet, side: b.dataset.side };
        note = '';
        document.getElementById('slipQ').textContent = X.ask(sel.mid);
        document.getElementById('slipSide').textContent = 'Posting ' + X.outcomeName(sel.mid, sel.side);
        document.getElementById('slipErr').textContent = '';
        document.getElementById('slipM').classList.add('s');
        refreshQuote();
        draw();
      };
    });
    root.querySelectorAll('[data-cancel]').forEach(function (b) { b.onclick = function () { cancel(b.dataset.cancel); }; });
    var g = document.getElementById('gate');
    if (g) g.onsubmit = function (e) { e.preventDefault(); claimName(new FormData(g).get('n')); };
    var sc = document.getElementById('score');
    if (sc) sc.onsubmit = function (e) { e.preventDefault(); postScore(sc); };
    var vg = document.getElementById('voidgame');
    if (vg) vg.onclick = voidGame;
  }
  function quoteWords(q, label) {
    if (q.error) return q.error;
    var text = 'You risk ' + X.tokens(q.cost) + ' play tokens. If ' + label + ' hits, you get ' + X.tokens(q.payout) + ' play tokens back. That payout is possible, not won yet.';
    if (q.even) text += ' Nobody is on the other side yet, so this waits at an even split until someone takes it.';
    else if (q.matched && q.waiting) text += ' ' + X.tokens(q.matchedRisk) + ' can match someone now. ' + X.tokens(q.waitingRisk) + ' waits for another player at the same terms.';
    else if (q.matched) text += ' This matches someone already waiting on the other side.';
    else text += ' This waits until someone takes the other side.';
    if (q.leftover > 0) text += ' ' + X.tokens(q.leftover) + ' stays in your wallet.';
    return text;
  }
  function refreshQuote() {
    if (!sel) return;
    var amt = document.getElementById('slipAmt');
    var got = X.quoteStake(state, { uid: uid, mid: sel.mid, side: sel.side, tokens: amt.value, t: Date.now() });
    document.getElementById('slipQuote').textContent = quoteWords(got, X.outcomeName(sel.mid, sel.side));
  }
  function closeSlip() {
    sel = null;
    var m = document.getElementById('slipM');
    if (m) m.classList.remove('s');
    draw();
  }
  function place() {
    if (busy || !sel) return;
    var err = document.getElementById('slipErr');
    if (!preview && !rulesLive) { err.textContent = 'Posts are closed.'; return; }
    var t = Date.now();
    var got = X.quoteStake(state, { uid: uid, mid: sel.mid, side: sel.side, tokens: document.getElementById('slipAmt').value, t: t });
    if (got.error) { err.textContent = got.error; return; }
    var order = { id: X.id(), uid: uid, mid: sel.mid, side: sel.side, px: got.px, shares: got.shares, t: t };
    var built = W.steps(state, order);
    if (built.error) { err.textContent = built.error; return; }
    busy = true;
    var btn = document.getElementById('slipGo');
    if (btn) btn.disabled = true;
    if (preview) {
      var applied = X.submit(state, order);
      state = applied.state;
      busy = false;
      if (btn) btn.disabled = false;
      note = applied.fills && applied.fills.length ? 'Posted on this phone only. Some of it is matched.' : 'Posted on this phone only. It waits for another player.';
      closeSlip(); return;
    }
    sendSteps(built.steps, got.matched ? 'Posted. Some of it is matched. The rest waits for another player.' : 'Posted. It waits until someone takes the other side.');
  }
  function cancel(id) {
    if (preview) { var r = X.cancel(state, id, uid, Date.now()); state = r.state; note = r.error || 'Canceled. Tokens returned.'; draw(); return; }
    var up = W.cancelUpdate(state, id);
    sendSteps([up], 'Canceled. Unmatched tokens are back.');
  }
  function sendSteps(steps, ok) {
    var db = firebase.database();
    var i = 0;
    function next(err) {
      if (err) { busy = false; var go = document.getElementById('slipGo'); if (go) go.disabled = false; note = 'The book changed or the post was rejected. Nothing extra was taken.'; draw(); return; }
      if (i >= steps.length) { busy = false; var go = document.getElementById('slipGo'); if (go) go.disabled = false; note = ok; closeSlip(); return; }
      db.ref().update(steps[i++]).then(function () { next(); }).catch(function () { next(true); });
    }
    next();
  }
  function claimName(raw) {
    var name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (name.length < 1) return;
    var tag = uid.slice(0, 4);
    firebase.database().ref('xbar_accounts/' + uid).set({ bal: 10000, granted: true, n: name, tag: tag, createdAt: Date.now() }).then(function () { note = '100 play tokens are on this browser.'; draw(); }).catch(function () { note = 'This browser already has its tokens, or the wallet rules are not live yet.'; draw(); });
  }
  function postScore(form) {
    var oak = Math.floor(+form.oak.value), fw = Math.floor(+form.fw.value);
    firebase.database().ref('xbar_event').set({ status: 'settled', oak: oak, fw: fw, finalAt: Date.now(), t: Date.now() });
  }
  function voidGame() {
    firebase.database().ref('xbar_event').set({ status: 'void', t: Date.now() });
  }
  function listen() {
    var db = firebase.database();
    var bag = { orders: {}, fills: {}, accounts: {}, event: null, results: {}, voids: {} };
    var seen = {};
    function paint() { ingest(rows(bag.orders), bag.fills, bag.accounts, bag.event, bag.results, bag.voids); mine = uid && bag.accounts[uid] || null; draw(); }
    function watchName(id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      db.ref('xbar_accounts/' + id).on('value', function (s) {
        if (s.val()) bag.accounts[id] = s.val();
        else delete bag.accounts[id];
        paint();
      });
    }
    watchName(uid);
    db.ref('xbar_accounts').on('value', function (s) { bag.accounts = s.val() || {}; paint(); }, function () {});
    Object.keys(X.MARKETS).concat(Object.keys(X.PROPS)).forEach(function (mid) {
      db.ref('xbar_orders/' + mid).on('value', function (s) {
        bag.orders[mid] = s.val() || {};
        Object.keys(bag.orders[mid]).forEach(function (oid) {
          var row = bag.orders[mid][oid];
          if (row && row.uid) watchName(row.uid);
        });
        paint();
      });
    });
    db.ref('xbar_fills').on('value', function (s) {
      bag.fills = s.val() || {};
      Object.keys(bag.fills).forEach(function (id) {
        var f = bag.fills[id];
        if (f) { watchName(f.yesUid); watchName(f.noUid); }
      });
      paint();
    });
    db.ref('xbar_void').on('value', function (s) { bag.voids = s.val() || {}; paint(); });
    db.ref('xbar_event').on('value', function (s) { rulesLive = true; bag.event = s.val(); paint(); }, function () { rulesLive = false; draw(); });
    db.ref('xbar_results').on('value', function (s) { bag.results = s.val() || {}; paint(); });
    db.ref('admins/' + uid).once('value').then(function (s) { admin = s.val() === true; draw(); });
  }
  document.querySelectorAll('#slipM [data-amt]').forEach(function (b) {
    b.onclick = function () {
      document.getElementById('slipAmt').value = b.dataset.amt;
      document.querySelectorAll('#slipM [data-amt]').forEach(function (c) { c.classList.toggle('pick', c === b); });
      refreshQuote();
    };
  });
  var slipAmt = document.getElementById('slipAmt');
  if (slipAmt) slipAmt.oninput = refreshQuote;
  var slipGo = document.getElementById('slipGo');
  if (slipGo) slipGo.onclick = place;
  var slipNo = document.getElementById('slipNo');
  if (slipNo) slipNo.onclick = closeSlip;
  if (preview) {
    uid = 'previewuid01';
    state.accounts[uid] = { bal: 10000, n: 'You', tag: 'prev', createdAt: 1 };
    mine = state.accounts[uid];
    note = 'Preview on this phone only. Not the live book, and not a real offer.';
    draw();
    return;
  }
  firebase.initializeApp(FB);
  firebase.auth().signInAnonymously().then(function (cred) {
    uid = cred.user.uid;
    listen();
  }).catch(function () {
    root.innerHTML = '<p class="toast">This game needs anonymous sign-in on the existing Torii Firebase project. Email login was not changed. Anonymous sign-in is not available from this browser yet.</p>';
  });
})();
