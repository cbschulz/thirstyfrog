const CUTOFF = 1794096000000;
const admin = "(auth != null && root.child('admins').child(auth.uid).val() === true)";
const boardOpen = "root.child('xbar_event').child('status').val() != 'closed' && root.child('xbar_event').child('status').val() != 'settled' && root.child('xbar_event').child('status').val() != 'void'";
const before = "now < " + CUTOFF;
const clock = "now >= " + CUTOFF;
const midRe = "newData.val().matches(/^(ml|spd|tot|o35|f21|p_stadler_td|p_stadler_rec|p_stadler_tck|p_bluntzer_tck|p_homan_rush|p_homan_td)$/)";

function acct() {
  const R = "newData.parent().parent()";
  const m = "newData.child('m').val()";
  const k = "newData.child('k').val()";
  const f = "newData.child('f').val()";
  const newOrder = R + ".child('xbar_orders').child(" + m + ").child(" + k + ")";
  const oldOrder = "root.child('xbar_orders').child(" + m + ").child(" + k + ")";
  const newFill = R + ".child('xbar_fills').child(" + f + ")";
  const oldFill = "root.child('xbar_fills').child(" + f + ")";
  const sameId = "newData.child('n').val() == data.child('n').val() && newData.child('tag').val() == data.child('tag').val() && newData.child('createdAt').val() == data.child('createdAt').val() && newData.child('granted').val() == true";
  const create = "!data.exists() && auth.uid == $uid && newData.child('bal').val() == 10000 && !newData.child('k').exists() && !newData.child('m').exists() && !newData.child('f').exists() && auth.uid.beginsWith(newData.child('tag').val())";
  const place = "data.exists() && auth.uid == $uid && " + sameId + " && newData.child('f').val() == '' && !" + oldOrder + ".exists() && " + newOrder + ".child('uid').val() == $uid && " + newOrder + ".child('rem').val() == " + newOrder + ".child('shares').val() && " + newOrder + ".child('st').val() == 'open' && " + newOrder + ".child('fid').val() == '' && newData.child('bal').val() == data.child('bal').val() - " + newOrder + ".child('shares').val() * " + newOrder + ".child('px').val() && " + before + " && " + boardOpen;
  const take = "data.exists() && auth.uid == $uid && " + sameId + " && newData.child('f').exists() && !" + oldOrder + ".exists() && !" + oldFill + ".exists() && " + newOrder + ".child('uid').val() == $uid && " + newFill + ".child('shares').val() == " + newOrder + ".child('shares').val() - " + newOrder + ".child('rem').val() && (" + newFill + ".child('yesOid').val() == " + k + " || " + newFill + ".child('noOid').val() == " + k + ") && (" + newFill + ".child('yesUid').val() == $uid || " + newFill + ".child('noUid').val() == $uid) && newData.child('bal').val() == data.child('bal').val() - (" + newOrder + ".child('shares').val() * " + newOrder + ".child('px').val()) + ((" + newOrder + ".child('px').val() - (" + newFill + ".child('yesUid').val() == $uid ? " + newFill + ".child('yesPay').val() : " + newFill + ".child('noPay').val())) * " + newFill + ".child('shares').val()) && " + before + " && " + boardOpen;
  const fillRefund = "data.exists() && " + sameId + " && newData.child('f').exists() && " + oldOrder + ".exists() && !" + oldFill + ".exists() && " + oldOrder + ".child('uid').val() == $uid && (" + newFill + ".child('yesUid').val() == $uid || " + newFill + ".child('noUid').val() == $uid) && (auth.uid == " + newFill + ".child('yesUid').val() || auth.uid == " + newFill + ".child('noUid').val()) && newData.child('bal').val() == data.child('bal').val() + ((" + oldOrder + ".child('px').val() - (" + newFill + ".child('yesUid').val() == $uid ? " + newFill + ".child('yesPay').val() : " + newFill + ".child('noPay').val())) * " + newFill + ".child('shares').val()) && " + before + " && " + boardOpen;
  const cancel = "data.exists() && " + sameId + " && newData.child('f').val() == '' && " + oldOrder + ".exists() && " + oldOrder + ".child('uid').val() == $uid && " + oldOrder + ".child('st').val() == 'open' && " + newOrder + ".child('rem').val() == 0 && " + newOrder + ".child('st').val() == 'canceled' && " + newOrder + ".child('px').val() == " + oldOrder + ".child('px').val() && newData.child('bal').val() == data.child('bal').val() + " + oldOrder + ".child('rem').val() * " + oldOrder + ".child('px').val() && (auth.uid == $uid || " + clock + " || !(" + boardOpen + "))";
  const oak = "root.child('xbar_event').child('oak').val()";
  const fw = "root.child('xbar_event').child('fw').val()";
  const status = "root.child('xbar_event').child('status').val()";
  const isYes = oldFill + ".child('yesUid').val() == $uid";
  const pay = "(" + isYes + " ? " + oldFill + ".child('yesPay').val() : " + oldFill + ".child('noPay').val())";
  const shares = oldFill + ".child('shares').val()";
  const mid = oldFill + ".child('mid').val()";
  const isProp = "(" + mid + " == 'p_stadler_td' || " + mid + " == 'p_stadler_rec' || " + mid + " == 'p_stadler_tck' || " + mid + " == 'p_bluntzer_tck' || " + mid + " == 'p_homan_rush' || " + mid + " == 'p_homan_td')";
  const res = "root.child('xbar_results').child(" + mid + ")";
  const late = "(root.child('xbar_event').child('finalAt').isNumber() && now > root.child('xbar_event').child('finalAt').val() + 259200000)";
  const propVoid = "(" + res + ".child('kind').val() == 'void' || " + res + ".child('played').val() == false || " + res + ".child('conflict').val() == true || (" + late + " && " + res + ".child('kind').val() != 'stat'))";
  const propStat = "(" + res + ".child('kind').val() == 'stat' && " + res + ".child('played').val() == true && " + res + ".child('conflict').val() != true && " + res + ".child('stat').isNumber() && " + res + ".child('stat').val() % 1 == 0 && " + res + ".child('stat').val() >= 0)";
  const lineT = "((" + mid + " == 'p_stadler_td' || " + mid + " == 'p_homan_td') ? 5 : (" + mid + " == 'p_stadler_rec') ? 295 : (" + mid + " == 'p_homan_rush') ? 585 : (" + mid + " == 'p_stadler_tck') ? 45 : 95)";
  const propYes = "(" + propStat + " && " + res + ".child('stat').val() * 10 > " + lineT + ")";
  const teamYes = "((" + mid + " == 'ml' && " + oak + " > " + fw + ") || (" + mid + " == 'spd' && " + oak + " - " + fw + " >= 16) || (" + mid + " == 'tot' && " + oak + " + " + fw + " >= 57) || (" + mid + " == 'o35' && " + oak + " >= 35) || (" + mid + " == 'f21' && " + fw + " >= 21))";
  const yesWins = "(" + isProp + " ? (" + propYes + ") : (" + teamYes + "))";
  const marketVoid = "(" + status + " == 'void' || root.child('xbar_void').child(" + mid + ").child('void').val() == true || (" + isProp + " && (" + propVoid + ")) || (!(" + isProp + ") && " + status + " == 'settled' && " + mid + " == 'ml' && " + oak + " == " + fw + "))";
  const payout = "(" + marketVoid + " ? (" + pay + ") * (" + shares + ") : ((" + yesWins + ") == (" + isYes + ") ? (" + shares + ") * 100 : 0))";
  const propReady = "(!(" + isProp + ") || (" + propVoid + ") || (" + propStat + "))";
  const claim = "data.exists() && auth.uid == $uid && " + sameId + " && newData.child('f').val() != '' && " + oldFill + ".exists() && (" + status + " == 'settled' || " + status + " == 'void') && " + propReady + " && (" + oldFill + ".child('yesUid').val() == $uid || " + oldFill + ".child('noUid').val() == $uid) && newData.child('bal').val() == data.child('bal').val() + " + payout;
  return admin + " || (" + create + ") || (" + place + ") || (" + take + ") || (" + fillRefund + ") || (" + cancel + ") || (" + claim + ")";
}

const orderSame = "newData.child('uid').val() == data.child('uid').val() && newData.child('px').val() == data.child('px').val() && newData.child('side').val() == data.child('side').val() && newData.child('shares').val() == data.child('shares').val() && newData.child('t').val() == data.child('t').val() && newData.child('mid').val() == data.child('mid').val() && newData.child('id').val() == data.child('id').val() && newData.child('fid').val() == data.child('fid').val()";

function orderWrite() {
  const R = "newData.parent().parent().parent()";
  const fill = R + ".child('xbar_fills').child(newData.child('lf').val())";
  const oldFill = "root.child('xbar_fills').child(newData.child('lf').val())";
  const create = "!data.exists() && auth.uid == newData.child('uid').val() && newData.child('id').val() == $oid && newData.child('mid').val() == $mid && ((newData.child('rem').val() > 0 && newData.child('st').val() == 'open') || (newData.child('rem').val() == 0 && newData.child('st').val() == 'filled')) && (newData.child('side').val() == 'yes' || newData.child('side').val() == 'no') && newData.child('px').val() >= 1 && newData.child('px').val() <= 99 && newData.child('px').val() % 1 == 0 && newData.child('shares').val() >= 1 && newData.child('shares').val() <= 5000 && newData.child('shares').val() % 1 == 0 && newData.child('rem').val() >= 0 && newData.child('rem').val() <= newData.child('shares').val() && newData.child('t').val() <= now + 5000 && newData.child('t').val() >= now - 120000 && " + before + " && " + boardOpen + " && ((newData.child('rem').val() == newData.child('shares').val() && newData.child('fid').val() == '' && newData.child('lf').val() == '') || (newData.child('lf').val() != '' && newData.child('fid').val() == newData.child('lf').val() && !" + oldFill + ".exists() && " + fill + ".child('shares').val() == newData.child('shares').val() - newData.child('rem').val() && (" + fill + ".child('yesOid').val() == $oid || " + fill + ".child('noOid').val() == $oid)))";
  const cancel = "data.exists() && " + orderSame + " && newData.child('lf').val() == data.child('lf').val() && data.child('st').val() == 'open' && newData.child('rem').val() == 0 && newData.child('st').val() == 'canceled' && (auth.uid == data.child('uid').val() || " + clock + " || !(" + boardOpen + "))";
  const fillUp = "data.exists() && " + orderSame + " && data.child('st').val() == 'open' && newData.child('lf').val() != '' && !" + oldFill + ".exists() && " + fill + ".child('shares').val() == data.child('rem').val() - newData.child('rem').val() && (" + fill + ".child('yesOid').val() == $oid || " + fill + ".child('noOid').val() == $oid) && ((newData.child('rem').val() == 0 && newData.child('st').val() == 'filled') || (newData.child('rem').val() > 0 && newData.child('st').val() == 'open')) && (auth.uid == " + fill + ".child('yesUid').val() || auth.uid == " + fill + ".child('noUid').val()) && " + before + " && " + boardOpen;
  return admin + " || (" + create + ") || (" + cancel + ") || (" + fillUp + ")";
}

function fillWrite() {
  const R = "newData.parent().parent()";
  const yesOld = "root.child('xbar_orders').child(newData.child('mid').val()).child(newData.child('yesOid').val())";
  const noOld = "root.child('xbar_orders').child(newData.child('mid').val()).child(newData.child('noOid').val())";
  const yesNew = R + ".child('xbar_orders').child(newData.child('mid').val()).child(newData.child('yesOid').val())";
  const noNew = R + ".child('xbar_orders').child(newData.child('mid').val()).child(newData.child('noOid').val())";
  const restingYes = "(!" + noOld + ".exists() || (" + yesOld + ".exists() && " + noOld + ".exists() && (" + yesOld + ".child('t').val() < " + noOld + ".child('t').val() || (" + yesOld + ".child('t').val() == " + noOld + ".child('t').val() && newData.child('yesOid').val() < newData.child('noOid').val()))))";
  const price = "(" + restingYes + " ? (newData.child('yesPay').val() == " + yesNew + ".child('px').val() && newData.child('noPay').val() == 100 - " + yesNew + ".child('px').val()) : (newData.child('noPay').val() == " + noNew + ".child('px').val() && newData.child('yesPay').val() == 100 - " + noNew + ".child('px').val()))";
  const create = "!data.exists() && newData.child('id').val() == $fid && newData.child('claimedYes').val() == false && newData.child('claimedNo').val() == false && newData.child('yesUid').val() != newData.child('noUid').val() && newData.child('shares').val() >= 1 && newData.child('yesPay').val() + newData.child('noPay').val() == 100 && newData.child('yesPay').val() >= 1 && newData.child('noPay').val() >= 1 && newData.child('yesPay').val() <= newData.child('yesPx').val() && newData.child('noPay').val() <= newData.child('noPx').val() && newData.child('yesPx').val() == " + yesNew + ".child('px').val() && newData.child('noPx').val() == " + noNew + ".child('px').val() && " + yesNew + ".child('side').val() == 'yes' && " + noNew + ".child('side').val() == 'no' && " + yesNew + ".child('uid').val() == newData.child('yesUid').val() && " + noNew + ".child('uid').val() == newData.child('noUid').val() && " + yesNew + ".child('mid').val() == newData.child('mid').val() && " + noNew + ".child('mid').val() == newData.child('mid').val() && (auth.uid == newData.child('yesUid').val() || auth.uid == newData.child('noUid').val()) && newData.child('t').val() <= now + 5000 && newData.child('t').val() >= now - 120000 && " + before + " && " + boardOpen + " && " + price;
  const same = "newData.child('id').val() == data.child('id').val() && newData.child('mid').val() == data.child('mid').val() && newData.child('shares').val() == data.child('shares').val() && newData.child('yesOid').val() == data.child('yesOid').val() && newData.child('noOid').val() == data.child('noOid').val() && newData.child('yesUid').val() == data.child('yesUid').val() && newData.child('noUid').val() == data.child('noUid').val() && newData.child('yesPay').val() == data.child('yesPay').val() && newData.child('noPay').val() == data.child('noPay').val() && newData.child('yesPx').val() == data.child('yesPx').val() && newData.child('noPx').val() == data.child('noPx').val() && newData.child('t').val() == data.child('t').val()";
  const claimYes = "data.exists() && " + same + " && data.child('claimedYes').val() == false && newData.child('claimedYes').val() == true && newData.child('claimedNo').val() == data.child('claimedNo').val() && auth.uid == data.child('yesUid').val() && (root.child('xbar_event').child('status').val() == 'settled' || root.child('xbar_event').child('status').val() == 'void')";
  const claimNo = "data.exists() && " + same + " && data.child('claimedNo').val() == false && newData.child('claimedNo').val() == true && newData.child('claimedYes').val() == data.child('claimedYes').val() && auth.uid == data.child('noUid').val() && (root.child('xbar_event').child('status').val() == 'settled' || root.child('xbar_event').child('status').val() == 'void')";
  return admin + " || (" + create + ") || (" + claimYes + ") || (" + claimNo + ")";
}

const eventWrite = admin + " && newData.exists() && (!data.exists() || data.child('status').val() == 'open' || data.child('status').val() == 'closed') && (newData.child('status').val() == 'closed' || newData.child('status').val() == 'void' || (newData.child('status').val() == 'settled' && newData.child('oak').isNumber() && newData.child('oak').val() % 1 == 0 && newData.child('oak').val() >= 0 && newData.child('oak').val() <= 200 && newData.child('fw').isNumber() && newData.child('fw').val() % 1 == 0 && newData.child('fw').val() >= 0 && newData.child('fw').val() <= 200 && newData.child('finalAt').isNumber()))";

export const xbarRules = {
  xbar_event: {
    ".read": "auth != null",
    ".write": eventWrite,
    status: { ".validate": "newData.val() == 'open' || newData.val() == 'closed' || newData.val() == 'settled' || newData.val() == 'void'" },
    oak: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 200 && newData.val() % 1 == 0" },
    fw: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 200 && newData.val() % 1 == 0" },
    t: { ".validate": "newData.isNumber()" },
    finalAt: { ".validate": "newData.isNumber()" },
    $other: { ".validate": false }
  },
  xbar_results: {
    ".read": "auth != null",
    $mid: {
      ".write": admin + " && !data.exists() && newData.exists() && root.child('xbar_event').child('status').val() == 'settled' && root.child('xbar_event').child('finalAt').isNumber() && now <= root.child('xbar_event').child('finalAt').val() + 259200000 && ($mid == 'p_stadler_td' || $mid == 'p_stadler_rec' || $mid == 'p_stadler_tck' || $mid == 'p_bluntzer_tck' || $mid == 'p_homan_rush' || $mid == 'p_homan_td') && (newData.child('kind').val() == 'void' || (newData.child('kind').val() == 'stat' && newData.child('played').val() == true && newData.child('conflict').val() != true && newData.child('stat').isNumber() && newData.child('stat').val() % 1 == 0 && newData.child('stat').val() >= 0 && newData.child('stat').val() <= 500))",
      ".validate": "newData.hasChildren(['kind','t'])",
      kind: { ".validate": "newData.val() == 'void' || newData.val() == 'stat'" },
      stat: { ".validate": "newData.isNumber()" },
      played: { ".validate": "newData.isBoolean()" },
      conflict: { ".validate": "newData.isBoolean()" },
      t: { ".validate": "newData.isNumber()" },
      $other: { ".validate": false }
    }
  },
  xbar_void: {
    ".read": "auth != null",
    $mid: {
      ".write": admin + " && !data.exists() && newData.child('void').val() == true",
      ".validate": "newData.hasChildren(['void','t'])",
      "void": { ".validate": "newData.val() == true" },
      t: { ".validate": "newData.isNumber()" },
      $other: { ".validate": false }
    }
  },
  xbar_accounts: {
    ".read": "auth != null",
    $uid: {
      ".read": "auth != null",
      ".write": "auth != null && newData.exists() && (" + acct() + ")",
      ".validate": "newData.hasChildren(['bal','granted','n','tag','createdAt']) && newData.child('bal').isNumber() && newData.child('bal').val() >= 0 && newData.child('bal').val() % 1 == 0 && newData.child('bal').val() <= 1000000 && newData.child('granted').val() === true && newData.child('n').isString() && newData.child('n').val().length >= 1 && newData.child('n').val().length <= 24 && newData.child('tag').isString() && newData.child('tag').val().length == 4 && newData.child('createdAt').isNumber()",
      bal: { ".validate": "newData.isNumber()" },
      granted: { ".validate": "newData.val() === true" },
      n: { ".validate": "newData.isString()" },
      tag: { ".validate": "newData.isString()" },
      createdAt: { ".validate": "newData.isNumber()" },
      k: { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{8,24}$/)" },
      m: { ".validate": midRe },
      f: { ".validate": "newData.isString() && (newData.val() == '' || newData.val().matches(/^[a-z0-9]{8,24}$/))" },
      $other: { ".validate": false }
    }
  },
  xbar_orders: {
    $mid: {
      ".read": "auth != null",
      $oid: {
        ".write": "auth != null && newData.exists() && (" + orderWrite() + ")",
        ".validate": "newData.hasChildren(['id','uid','mid','side','px','shares','rem','t','st','fid','lf']) && newData.child('mid').val() == $mid && newData.child('id').val() == $oid",
        id: { ".validate": "newData.isString()" },
        uid: { ".validate": "newData.isString()" },
        mid: { ".validate": "newData.isString() && newData.val().matches(/^(ml|spd|tot|o35|f21|p_stadler_td|p_stadler_rec|p_stadler_tck|p_bluntzer_tck|p_homan_rush|p_homan_td)$/)" },
        side: { ".validate": "newData.val() == 'yes' || newData.val() == 'no'" },
        px: { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 99" },
        shares: { ".validate": "newData.isNumber()" },
        rem: { ".validate": "newData.isNumber()" },
        t: { ".validate": "newData.isNumber()" },
        st: { ".validate": "newData.val() == 'open' || newData.val() == 'filled' || newData.val() == 'canceled'" },
        fid: { ".validate": "newData.isString()" },
        lf: { ".validate": "newData.isString()" },
        $other: { ".validate": false }
      }
    }
  },
  xbar_fills: {
    ".read": "auth != null",
    $fid: {
      ".write": "auth != null && newData.exists() && (" + fillWrite() + ")",
      ".validate": "newData.hasChildren(['id','mid','shares','yesOid','noOid','yesUid','noUid','yesPay','noPay','yesPx','noPx','t','claimedYes','claimedNo']) && newData.child('id').val() == $fid",
      id: { ".validate": "newData.isString()" },
      mid: { ".validate": "newData.isString() && newData.val().matches(/^(ml|spd|tot|o35|f21|p_stadler_td|p_stadler_rec|p_stadler_tck|p_bluntzer_tck|p_homan_rush|p_homan_td)$/)" },
      shares: { ".validate": "newData.isNumber()" },
      yesOid: { ".validate": "newData.isString()" },
      noOid: { ".validate": "newData.isString()" },
      yesUid: { ".validate": "newData.isString()" },
      noUid: { ".validate": "newData.isString()" },
      yesPay: { ".validate": "newData.isNumber()" },
      noPay: { ".validate": "newData.isNumber()" },
      yesPx: { ".validate": "newData.isNumber()" },
      noPx: { ".validate": "newData.isNumber()" },
      t: { ".validate": "newData.isNumber()" },
      claimedYes: { ".validate": "newData.isBoolean()" },
      claimedNo: { ".validate": "newData.isBoolean()" },
      $other: { ".validate": false }
    }
  }
};
