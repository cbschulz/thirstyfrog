/* Name-only entry. Anonymous Auth keeps the session on this device. */
(function (G) {
  var held = Promise.resolve();
  function hold() { return held; }
  function nameHTML() {
    return '<p class="kicker">Members</p><h2>Your name</h2><p class="muted">Enter your name once on this device. The first visit grants 100 Torii tokens, play money with no cash value.</p><label>Your name<input id="nm" maxlength="40" placeholder="Your name" autocomplete="name"></label><button type="button" id="nmgo">Enter</button><p class="muted"><a href="#" id="emailgo">Sign in with email</a></p><p id="m" class="err"></p>';
  }
  function emailHTML() {
    return '<p class="kicker">Members</p><h2>Sign in with email</h2><p class="muted">For an existing Torii account.</p><label>Email<input id="em" type="email" placeholder="Email" autocomplete="email"></label><label>Password<input id="pw" type="password" placeholder="Password" autocomplete="current-password"></label><button type="button" id="emgo">Sign in</button><p class="muted"><a href="#" id="namego">Use your name instead</a></p><p id="m" class="err"></p>';
  }
  function fail(text) { var m = document.getElementById('m'); if (m) m.textContent = text; }
  function showName(gate, auth) {
    gate.style.display = '';
    gate.innerHTML = nameHTML();
    var go = function () { enterName(auth); };
    document.getElementById('nmgo').onclick = go;
    document.getElementById('nm').onkeydown = function (ev) { if (ev.key === 'Enter') go(); };
    document.getElementById('emailgo').onclick = function (ev) { ev.preventDefault(); showEmail(gate, auth); };
  }
  function showEmail(gate, auth) {
    gate.style.display = '';
    gate.innerHTML = emailHTML();
    var go = function () { enterEmail(auth); };
    document.getElementById('emgo').onclick = go;
    document.getElementById('pw').onkeydown = function (ev) { if (ev.key === 'Enter') go(); };
    document.getElementById('namego').onclick = function (ev) { ev.preventDefault(); showName(gate, auth); };
  }
  async function enterName(auth) {
    var raw = (document.getElementById('nm').value || '').trim().replace(/\s+/g, ' ');
    if (!raw) { fail('Enter your name.'); return; }
    var name = raw.slice(0, 40);
    var release;
    held = new Promise(function (r) { release = r; });
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      var cred = await auth.signInAnonymously();
      await cred.user.updateProfile({ displayName: name });
      try {
        localStorage.setItem('torii_golf_name', name);
        localStorage.setItem('torii_golf_uid', cred.user.uid);
      } catch (e) {}
    } catch (x) {
      var code = x && x.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        fail('Anonymous sign-in is off. In the Firebase console open Authentication, then Sign-in method, and enable Anonymous. Database rules are unchanged.');
      } else {
        fail('Could not start a session on this device. Try again, or sign in with email.');
      }
    } finally { release(); }
  }
  async function enterEmail(auth) {
    var em = (document.getElementById('em').value || '').trim();
    var pw = document.getElementById('pw').value || '';
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await auth.signInWithEmailAndPassword(em, pw);
    } catch (x) {
      fail('Sign-in failed. Check your email and password.');
    }
  }
  function savedName(user) {
    var n = user && user.displayName || '';
    try {
      var saved = localStorage.getItem('torii_golf_name') || '';
      var uid = localStorage.getItem('torii_golf_uid') || '';
      if (!n && saved && user && uid === user.uid) n = saved;
    } catch (e) {}
    return String(n || '').trim().slice(0, 40);
  }
  G.hold = hold;
  G.showName = showName;
  G.showEmail = showEmail;
  G.savedName = savedName;
})(typeof window !== 'undefined' ? (window.ToriiEnter = window.ToriiEnter || {}) : (globalThis.ToriiEnter = globalThis.ToriiEnter || {}));
