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
  var uid = null, mine = null, admin = false, sel = null, note = '', rulesLive = false, preview = location.hash === '#preview';
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
  function ingest(orders, fills, accounts, event, results) {
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
  function trades(mid) {
    return Object.keys(state.fills).map(function (id) { return state.fills[id]; }).filter(function (f) { return f.mid === mid; }).sort(function (a, b) { return a.t - b.t; });
  }
  function chart(mid) {
    var pts = trades(mid);
    if (!pts.length) return '<p class="wait">Waiting for first match</p>';
    var ref = X.MARKETS[mid] ? X.MARKETS[mid].refYes : null;
    var d = '';
    pts.forEach(function (f, i) {
      var x = pts.length === 1 ? 50 : (i / (pts.length - 1)) * 100;
      var y = 100 - f.yesPay;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    var refY = ref == null ? '' : '<line x1="0" x2="100" y1="' + (100 - ref) + '" y2="' + (100 - ref) + '" stroke="#8d8a83" stroke-dasharray="2 2" stroke-width="0.6"/>';
    var note = ref == null ? 'Matched prices only.' : 'Gold is matched trades. The dotted line is the pregame read, not a trade.';
    return '<div class="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Matched prices">' + refY + '<path d="' + d + '" fill="none" stroke="#e4c98a" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg><p>' + pts.length + ' match' + (pts.length === 1 ? '' : 'es') + '. ' + note + '</p></div>';
  }
  function book(mid) {
    var list = Object.keys(state.orders).map(function (id) { return state.orders[id]; }).filter(function (o) { return o && o.mid === mid && o.st === 'open' && o.rem > 0; });
    if (!list.length) return '<p class="empty">No pending offers.</p>';
    return list.sort(function (a, b) { return b.px - a.px; }).map(function (o) {
      var who = (state.accounts[o.uid] && state.accounts[o.uid].n) || 'Player';
      var tag = (state.accounts[o.uid] && state.accounts[o.uid].tag) || '';
      var mineBtn = o.uid === uid ? '<button type="button" data-cancel="' + esc(o.id) + '">Cancel</button>' : '';
      return '<div class="offer"><span>' + (o.side === 'yes' ? 'YES' : 'NO') + ' ' + o.px + '¢ · ' + o.rem + ' ' + esc(who) + ' · ' + esc(tag) + '</span>' + mineBtn + '</div>';
    }).join('');
  }
  function rulesBox(mid) {
    var prop = X.PROPS[mid], m = X.MARKETS[mid];
    var body = prop
      ? '<p>' + esc(DETAIL[mid]) + '</p><p>' + esc(SETTLE) + '</p><p><a href="' + esc(SOURCES[mid]) + '">MaxPreps season stats</a></p>'
      : '<p>' + esc(m.yes) + ' / ' + esc(m.no) + '. Pregame read ' + m.refYes + '¢ / ' + (100 - m.refYes) + '¢. That read is not a trade and not a live price. The number on the card does not move. A tie voids the outright winner only. Oakridge −15.5 needs a win by 16 or more. Combined 56.5: 57 or more is over. 35 and 21 are included on those yes sides. The house does not take a side. Unmatched tokens come back if you cancel or the board closes.</p>';
    return '<details class="rules"><summary>Rules &amp; sources</summary>' + body + '</details>';
  }
  function slip(mid, side) {
    var prop = X.PROPS[mid];
    var label = side === 'yes' ? (prop ? 'Over ' + prop.line : X.MARKETS[mid].yes) : (prop ? 'Under ' + prop.line : X.MARKETS[mid].no);
    return '<form class="slip" data-mid="' + mid + '" data-side="' + side + '"><p class="slip-k">' + esc(label) + '</p><label>Shares<input name="shares" type="number" min="1" step="1" value="5" inputmode="numeric"></label><div class="chips"><button type="button" data-sh="1">1</button><button type="button" data-sh="5">5</button><button type="button" data-sh="10">10</button></div><label>Price, cents<input name="px" type="number" min="1" max="99" step="1" value="" placeholder="1–99" inputmode="numeric"></label><p class="quote"></p>' + rulesBox(mid) + '<p class="err"></p><button class="go" type="submit">Place offer</button><button class="ghost" type="button" data-close>Not now</button></form>';
  }
  function card(mid) {
    var prop = X.PROPS[mid], m = X.MARKETS[mid];
    var kicker = prop ? prop.player + ' · #' + prop.num + ' ' + prop.pos : 'Game line';
    var title = prop ? prop.title : m.title;
    var line = prop ? 'O/U ' + prop.line : '';
    var yes = bestOpen(mid, 'yes'), no = bestOpen(mid, 'no');
    var yesTxt = yes ? yes.px + '¢' : 'No offer';
    var noTxt = no ? no.px + '¢' : 'No offer';
    var face = prop ? '<p class="basis">' + esc(BASIS[mid]) + '</p>' : '<p class="basis">' + esc(m.yes) + ' / ' + esc(m.no) + '</p><p class="est">Pregame read ' + m.refYes + '¢ / ' + (100 - m.refYes) + '¢</p>';
    var open = sel && sel.mid === mid;
    var canOffer = preview || rulesLive;
    var extra = open && canOffer ? slip(mid, sel.side) + chart(mid) : '';
    var offers = book(mid);
    var pend = offers.indexOf('empty') >= 0 ? '' : '<div class="offers">' + offers + '</div>';
    var controls = canOffer
      ? '<div class="sides"><button type="button" data-bet="' + mid + '" data-side="yes"><b>' + (prop ? 'Over' : 'Yes') + '</b><small>' + yesTxt + '</small></button><button type="button" data-bet="' + mid + '" data-side="no"><b>' + (prop ? 'Under' : 'No') + '</b><small>' + noTxt + '</small></button></div>' + extra + pend
      : '<p class="wait">Offers are closed until the token rules are published.</p>';
    return '<article class="mkt' + (prop ? ' prop' : '') + (open ? ' on' : '') + '" id="' + mid + '"><p class="kicker">' + esc(kicker) + '</p><h2>' + esc(title) + '</h2>' + (line ? '<p class="oline">' + esc(line) + '</p>' : '') + face + rulesBox(mid) + controls + '</article>';
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
  function standings() {
    var people = Object.keys(state.accounts).map(function (id) { return state.accounts[id]; }).sort(function (a, b) { return b.bal - a.bal || a.n.localeCompare(b.n); });
    var lb = people.length ? people.map(function (p, i) {
      var mark = ['🥇', '🥈', '🥉'][i] || ((i + 1) + '.');
      return '<div><span>' + mark + ' <b>' + esc(p.n) + '</b> · ' + esc(p.tag) + '</span><span>' + X.tokens(p.bal) + '</span></div>';
    }).join('') : '<div>No one has taken tokens yet.</div>';
    var act = Object.keys(state.fills).map(function (id) { return state.fills[id]; }).sort(function (a, b) { return b.t - a.t; }).slice(0, 12);
    var feed = act.length ? act.map(function (f) {
      var a = state.accounts[f.yesUid], b = state.accounts[f.noUid];
      return '<div>' + esc(a ? a.n : 'Yes') + ' ' + f.yesPay + '¢ vs ' + esc(b ? b.n : 'No') + ' ' + f.noPay + '¢ · ' + f.shares + ' shares</div>';
    }).join('') : '<div>No trades yet.</div>';
    return '<section class="stand"><h2>Token leaderboard</h2><p class="sub">Play-token balance only. Duplicate names stay distinct by the short id. No cash is owed.</p><div class="lb">' + lb + '</div><h2>Matched trades</h2><div class="lb">' + feed + '</div></section>';
  }
  function gate() {
    if (preview) return '';
    if (!rulesLive) return '<p class="toast">Play tokens are not open. Offers stay off until this game’s rules are published on the existing database.</p>';
    if (mine) return '<p class="bal"><b>' + X.tokens(mine.bal) + '</b> play tokens · ' + esc(mine.n) + ' · ' + esc(mine.tag) + '</p>';
    return '<form class="gate" id="gate"><h2>Your name for this game</h2><p>This event only. You get 100 play tokens once on this browser. The same name on another phone is a different stack. Clearing this browser can get another 100. A name is not proof you are the only person using it.</p><label>Display name<input name="n" maxlength="24" autocomplete="nickname" required></label><button class="go" type="submit">Get 100 play tokens</button></form>';
  }
  function draw() {
    var typing = document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    if (typing) return;
    var phase = state.status === 'open' && Date.now() < X.CUTOFF ? 'Orders open until 6:00 p.m. CT' : (state.status === 'settled' ? 'Final posted' : 'Orders closed');
    root.innerHTML = '<p class="phase">' + phase + '</p>' + gate() + (note ? '<p class="toast">' + esc(note) + '</p>' : '') +
      '<section><h2>The game</h2>' + ['ml', 'spd', 'tot', 'o35', 'f21'].map(card).join('') + '</section>' +
      profiles() + '<section><h2>Player props</h2><p class="sub">You set the price.</p>' + ['p_stadler_td', 'p_stadler_rec', 'p_stadler_tck', 'p_homan_rush', 'p_homan_td', 'p_bluntzer_tck'].map(card).join('') + '</section>' +
      standings() + (admin ? '<section class="ops"><h2>Operator</h2><p class="sub">Final score does not settle player props. A missing box-score stat is Void, not zero.</p><form id="score"><label>Oakridge<input name="oak" type="number" min="0" max="200"></label><label>Country Day<input name="fw" type="number" min="0" max="200"></label><button class="go" type="submit">Post final</button></form><button type="button" id="voidgame">Void the game and refund</button></section>' : '');
    bind();
  }
  function bind() {
    root.querySelectorAll('[data-bet]').forEach(function (b) {
      b.onclick = function () {
        if (!mine && !preview) { note = 'Enter your name to use play tokens.'; draw(); return; }
        sel = { mid: b.dataset.bet, side: b.dataset.side };
        note = '';
        draw();
        var form = root.querySelector('.slip');
        if (form) form.scrollIntoView({ block: 'nearest' });
      };
    });
    root.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { sel = null; draw(); }; });
    root.querySelectorAll('[data-sh]').forEach(function (b) {
      b.onclick = function () { var i = b.closest('form').shares; i.value = b.dataset.sh; quote(b.closest('form')); };
    });
    root.querySelectorAll('.slip').forEach(function (f) {
      f.oninput = function () { quote(f); };
      f.onsubmit = function (e) { e.preventDefault(); place(f); };
      quote(f);
    });
    root.querySelectorAll('[data-cancel]').forEach(function (b) { b.onclick = function () { cancel(b.dataset.cancel); }; });
    var g = document.getElementById('gate');
    if (g) g.onsubmit = function (e) { e.preventDefault(); claimName(new FormData(g).get('n')); };
    var sc = document.getElementById('score');
    if (sc) sc.onsubmit = function (e) { e.preventDefault(); postScore(sc); };
    var vg = document.getElementById('voidgame');
    if (vg) vg.onclick = voidGame;
  }
  function quote(f) {
    var shares = Math.floor(+f.shares.value || 0), px = Math.floor(+f.px.value || 0);
    var q = f.querySelector('.quote');
    if (!(shares >= 1 && px >= 1 && px <= 99)) { q.textContent = 'Enter a whole number of shares and a price from 1¢ to 99¢.'; return; }
    q.textContent = 'You escrow ' + X.tokens(shares * px) + ' tokens. If matched and you win, each share pays 1 token from the other side. If the price improves, the difference comes back.';
  }
  function place(f) {
    var shares = Math.floor(+f.shares.value || 0), px = Math.floor(+f.px.value || 0);
    var order = { id: X.id(), uid: uid, mid: f.dataset.mid, side: f.dataset.side, px: px, shares: shares, t: Date.now() };
    var built = W.steps(state, order);
    if (!preview && !rulesLive) { f.querySelector('.err').textContent = 'Offers are closed.'; return; }
    if (built.error) { f.querySelector('.err').textContent = built.error; return; }
    if (preview) {
      var applied = X.submit(state, order);
      state = applied.state;
      note = applied.fills && applied.fills.length ? 'Matched on this phone only.' : 'Offer posted on this phone only.';
      sel = null; draw(); return;
    }
    sendSteps(built.steps, built.planned.fills.length ? 'Offer matched or posted.' : 'Offer posted. It sits until someone takes the other side.');
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
      if (err) { note = 'The book changed or the offer was rejected. Nothing extra was taken.'; draw(); return; }
      if (i >= steps.length) { note = ok; sel = null; draw(); return; }
      db.ref().update(steps[i++]).then(function () { next(); }).catch(function () { next(true); });
    }
    next();
  }
  function claimName(raw) {
    var name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (name.length < 1) return;
    var tag = uid.slice(0, 4);
    firebase.database().ref('xbar_accounts/' + uid).set({ bal: 10000, granted: true, n: name, tag: tag, createdAt: Date.now() }).then(function () { note = '100 play tokens are on this browser.'; }).catch(function () { note = 'This browser already has its tokens, or the wallet rules are not live yet.'; draw(); });
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
    var bag = { orders: {}, fills: {}, accounts: {}, event: null, results: {} };
    function paint() { ingest(rows(bag.orders), bag.fills, bag.accounts, bag.event, bag.results); mine = uid && bag.accounts[uid] || null; draw(); }
    function closed() { rulesLive = false; draw(); }
    db.ref('xbar_orders').on('value', function (s) { bag.orders = s.val() || {}; paint(); }, closed);
    db.ref('xbar_fills').on('value', function (s) { bag.fills = s.val() || {}; paint(); }, closed);
    db.ref('xbar_accounts').on('value', function (s) { bag.accounts = s.val() || {}; paint(); }, closed);
    db.ref('xbar_event').on('value', function (s) { rulesLive = true; bag.event = s.val(); paint(); }, closed);
    db.ref('xbar_results').on('value', function (s) { bag.results = s.val() || {}; paint(); }, closed);
    db.ref('admins/' + uid).once('value').then(function (s) { admin = s.val() === true; draw(); });
  }
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
