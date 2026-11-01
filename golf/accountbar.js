/* Read-only token bar. Listens to the signed-in user's golf_accounts and golf_mybets. */
(function (G) {
  var bar, auth, db, hold = false, acctRef, betsRef;

  function summarize(acct, my) {
    var bal = acct && isFinite(+acct.bal) ? Math.floor(+acct.bal) : 0;
    var wagered = 0, open = 0;
    if (my) Object.keys(my).forEach(function (id) {
      var b = my[id];
      if (!b || String(b.st || '') !== 'open') return;
      open += 1;
      wagered += Math.floor(+b.a || 0);
    });
    return { signedIn: true, bal: bal, wagered: wagered, open: open };
  }

  function render(s) {
    if (!bar) bar = document.getElementById('acctbar');
    if (!bar) return;
    if (!s || !s.signedIn) {
      bar.className = 'acctbar out';
      bar.innerHTML = '<a href="#gate">Enter your name to get 100 free tokens</a>';
      return;
    }
    var n = s.open === 1 ? '1 open bet' : s.open + ' open bets';
    var q = new URLSearchParams(location.search);
    var day = q.get('date') || '';
    var href = 'settle.html' + (day ? '?date=' + encodeURIComponent(day) : '');
    bar.className = 'acctbar in';
    bar.innerHTML = '<div class="abrow"><div class="ab"><span class="lbl">Balance</span><span class="num">' + s.bal + '</span></div><div class="ab"><span class="lbl">Wagered</span><span class="num">' + s.wagered + '</span></div><p class="openbets">' + n + '</p></div><a class="settlelink" href="' + href + '">Today\'s settle-up</a>';
  }

  function unsub() {
    if (acctRef) { acctRef.off(); acctRef = null; }
    if (betsRef) { betsRef.off(); betsRef = null; }
  }

  function watch(uid) {
    unsub();
    var acct = null, my = null, gotA = false, gotB = false;
    function paint() {
      if (hold || !gotA || !gotB) return;
      render(summarize(acct, my));
    }
    acctRef = db.ref('golf_accounts/' + uid);
    betsRef = db.ref('golf_mybets/' + uid);
    acctRef.on('value', function (snap) { acct = snap.val(); gotA = true; paint(); }, function () { gotA = true; acct = null; paint(); });
    betsRef.on('value', function (snap) { my = snap.val() || {}; gotB = true; paint(); }, function () { gotB = true; my = {}; paint(); });
  }

  function mount(opts) {
    auth = opts.auth;
    db = opts.db;
    bar = document.getElementById('acctbar');
    auth.onAuthStateChanged(function (u) {
      if (hold) return;
      if (!u) { unsub(); render({ signedIn: false }); return; }
      watch(u.uid);
    });
  }

  function preview(state) {
    hold = true;
    unsub();
    render(state && state.signedIn ? state : { signedIn: false });
  }

  G.mount = mount;
  G.preview = preview;
  G.summarize = summarize;
})(window.ToriiAccountBar = window.ToriiAccountBar || {});
