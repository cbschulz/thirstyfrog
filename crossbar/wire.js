/* Firebase update builders. Rules check these shapes. Balances are cents. */
(function (G) {
  var X = typeof Crossbar !== 'undefined' ? Crossbar : G;
  function acctWrite(acct, bal, k, m, f) {
    return { bal: bal, granted: true, n: acct.n, tag: acct.tag, createdAt: acct.createdAt, k: k, m: m, f: f };
  }
  function orderWrite(o, rem, st, fid, lf) {
    return { id: o.id, uid: o.uid, mid: o.mid, side: o.side, px: o.px, shares: o.shares, rem: rem, t: o.t, st: st, fid: fid || '', lf: lf || '' };
  }
  function steps(state, order) {
    var planned = X.plan(state, order);
    if (planned.error) return { error: planned.error, self: planned.self };
    var scratch = JSON.parse(JSON.stringify(state));
    var o = planned.order;
    var acct = scratch.accounts[o.uid];
    if (!planned.fills.length) {
      var bal = acct.bal - o.shares * o.px;
      var up = {};
      up['xbar_accounts/' + o.uid] = acctWrite(acct, bal, o.id, o.mid, '');
      up['xbar_orders/' + o.mid + '/' + o.id] = orderWrite(o, o.shares, 'open', '', '');
      return { steps: [up], planned: planned };
    }
    var out = [];
    var takerBal = acct.bal - o.shares * o.px;
    var takerRem = o.shares;
    var takerFid = planned.fills[0].id;
    planned.fills.forEach(function (f) {
      var takerYes = o.side === 'yes';
      var pay = takerYes ? f.yesPay : f.noPay;
      takerBal += (o.px - pay) * f.shares;
      takerRem -= f.shares;
      var makerId = takerYes ? f.noOid : f.yesOid;
      var maker = scratch.orders[makerId];
      var makerPay = takerYes ? f.noPay : f.yesPay;
      var makerAcct = scratch.accounts[maker.uid];
      var makerBal = makerAcct.bal + (maker.px - makerPay) * f.shares;
      var makerRem = maker.rem - f.shares;
      var up = {};
      up['xbar_accounts/' + o.uid] = acctWrite(acct, takerBal, o.id, o.mid, f.id);
      up['xbar_accounts/' + maker.uid] = acctWrite(makerAcct, makerBal, maker.id, maker.mid, f.id);
      up['xbar_orders/' + o.mid + '/' + o.id] = orderWrite(o, takerRem, takerRem === 0 ? 'filled' : 'open', takerFid, f.id);
      up['xbar_orders/' + maker.mid + '/' + maker.id] = orderWrite(maker, makerRem, makerRem === 0 ? 'filled' : 'open', maker.fid || '', f.id);
      up['xbar_fills/' + f.id] = {
        id: f.id, mid: f.mid, shares: f.shares,
        yesOid: f.yesOid, noOid: f.noOid, yesUid: f.yesUid, noUid: f.noUid,
        yesPay: f.yesPay, noPay: f.noPay, yesPx: f.yesPx, noPx: f.noPx,
        t: f.t, claimedYes: false, claimedNo: false
      };
      out.push(up);
      maker.rem = makerRem;
      makerAcct.bal = makerBal;
    });
    return { steps: out, planned: planned };
  }
  function cancelUpdate(state, oid) {
    var o = state.orders[oid];
    var acct = state.accounts[o.uid];
    var up = {};
    up['xbar_accounts/' + o.uid] = acctWrite(acct, acct.bal + o.rem * o.px, o.id, o.mid, '');
    up['xbar_orders/' + o.mid + '/' + o.id] = orderWrite(o, 0, 'canceled', o.fid || '', o.lf || '');
    return up;
  }
  function claimUpdate(state, fid, side, uid) {
    var f = state.fills[fid];
    var acct = state.accounts[uid];
    var amt = X.payoutFor(f, side, state);
    var fill = Object.assign({}, f);
    if (side === 'yes') fill.claimedYes = true; else fill.claimedNo = true;
    var up = {};
    up['xbar_accounts/' + uid] = acctWrite(acct, acct.bal + amt, f.id, f.mid, f.id);
    up['xbar_fills/' + fid] = fill;
    return up;
  }
  G.steps = steps;
  G.cancelUpdate = cancelUpdate;
  G.claimUpdate = claimUpdate;
  G.acctWrite = acctWrite;
})(typeof window !== 'undefined' ? (window.CrossbarWire = window.CrossbarWire || {}) : (globalThis.CrossbarWire = globalThis.CrossbarWire || {}));
