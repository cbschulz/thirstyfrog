import { readFileSync, writeFileSync } from 'fs';

const src = JSON.parse(readFileSync(new URL('../../home/ubuntu/.cursor/projects/workspace/uploads/rules.golf_5041.json', import.meta.url)));
const rules = src.rules;
const before = JSON.stringify(rules);

const admin = "(auth != null && root.child('admins').child(auth.uid).val() === true)";
const up = (n) => '.parent()'.repeat(n);

rules.golf_accounts = {
  "$uid": {
    ".read": "auth != null && (auth.uid === $uid || " + admin + ")",
    ".write": "auth != null && newData.exists() && (" + admin + " || (auth.uid === $uid && (!data.exists() && newData.child('bal').val() === 100 && newData.child('granted').val() === true && !newData.child('lk').exists() && !newData.child('lc').exists() && !newData.child('ld').exists() && !newData.child('lg').exists() || data.exists() && data.child('granted').val() === true && newData.child('granted').val() === true && newData.child('n').val() === data.child('n').val() && newData.child('createdAt').val() === data.child('createdAt').val() && newData.child('lk').isString() && newData.child('lc').val() === 'colonial' && newData.child('ld').isString() && newData.child('lg').isString() && newData.child('bal').isNumber() && newData.child('bal').val() >= 0 && newData.child('bal').val() === data.child('bal').val() - newData" + up(2) + ".child('golf_bets').child(newData.child('lc').val()).child(newData.child('ld').val()).child(newData.child('lg').val()).child(newData.child('lk').val()).child('a').val() && newData" + up(2) + ".child('golf_bets').child(newData.child('lc').val()).child(newData.child('ld').val()).child(newData.child('lg').val()).child(newData.child('lk').val()).child('uid').val() === $uid && newData" + up(2) + ".child('golf_bets').child(newData.child('lc').val()).child(newData.child('ld').val()).child(newData.child('lg').val()).child(newData.child('lk').val()).child('a').val() > 0 && newData" + up(2) + ".child('golf_bets').child(newData.child('lc').val()).child(newData.child('ld').val()).child(newData.child('lg').val()).child(newData.child('lk').val()).child('a').val() <= data.child('bal').val() && !root.child('golf_bets').child(newData.child('lc').val()).child(newData.child('ld').val()).child(newData.child('lg').val()).child(newData.child('lk').val()).exists())))",
    ".validate": "newData.hasChildren(['bal','granted','n','createdAt'])",
    "bal": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() % 1 === 0 && newData.val() <= 100000" },
    "granted": { ".validate": "newData.val() === true" },
    "n": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40" },
    "createdAt": { ".validate": "newData.isNumber()" },
    "lc": { ".validate": "newData.isString() && newData.val() === 'colonial'" },
    "ld": { ".validate": "newData.isString() && newData.val().matches(/^\\d{4}-\\d{2}-\\d{2}$/)" },
    "lg": { ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z0-9_]{1,40}$/)" },
    "lk": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{8,24}$/)" },
    "$other": { ".validate": false }
  }
};

const betOk = [
  "!data.exists()",
  "newData.child('uid').val() === auth.uid",
  "newData.child('st').val() === 'open'",
  "newData.child('id').val() === $bid",
  "newData.child('a').isNumber() && newData.child('a').val() > 0 && newData.child('a').val() % 1 === 0",
  "newData.child('px').isNumber() && newData.child('px').val() >= 1 && newData.child('px').val() <= 99 && newData.child('px').val() % 1 === 0",
  "newData.child('line').isString() && newData.child('line').val().matches(/^[0-3]$/)",
  "newData.child('side').isString() && newData.child('side').val().matches(/^[a-z0-9]{1,8}$/)",
  "newData.child('t').isNumber() && newData.child('t').val() <= now + 5000 && newData.child('t').val() >= now - 120000",
  "root.child('golf_members').child($club).child(auth.uid).exists()",
  "root.child('golf').child($club).child('sheets').child($date).child('groups').child($gid).child('lines').child(newData.child('line').val()).child('status').val() === 'open'",
  "root.child('golf').child($club).child('sheets').child($date).child('groups').child($gid).child('teeTimeMs').isNumber()",
  "root.child('golf').child($club).child('sheets').child($date).child('groups').child($gid).child('teeTimeMs').val() > now",
  "newData" + up(5) + ".child('golf_accounts').child(auth.uid).child('lk').val() === $bid",
  "newData" + up(5) + ".child('golf_accounts').child(auth.uid).child('lc').val() === $club",
  "newData" + up(5) + ".child('golf_accounts').child(auth.uid).child('ld').val() === $date",
  "newData" + up(5) + ".child('golf_accounts').child(auth.uid).child('lg').val() === $gid",
  "newData" + up(5) + ".child('golf_accounts').child(auth.uid).child('bal').val() === root.child('golf_accounts').child(auth.uid).child('bal').val() - newData.child('a').val()"
].join(" && ");

rules.golf_bets = {
  "$club": {
    "$date": {
      "$gid": {
        "$bid": {
          ".read": "auth != null && (data.child('uid').val() === auth.uid || " + admin + ")",
          ".write": admin + " || (auth != null && " + betOk + ")",
          ".validate": "newData.hasChildren(['id','line','side','uid','a','px','t','st']) && $bid.matches(/^[a-z0-9]{8,24}$/)",
          "id": { ".validate": "newData.val() === $bid" },
          "line": { ".validate": "newData.isString() && newData.val().matches(/^[0-3]$/)" },
          "side": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{1,8}$/)" },
          "uid": { ".validate": "newData.isString()" },
          "a": { ".validate": "newData.isNumber() && newData.val() > 0 && newData.val() <= 100 && newData.val() % 1 === 0" },
          "px": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 99 && newData.val() % 1 === 0" },
          "t": { ".validate": "newData.isNumber()" },
          "st": { ".validate": "newData.isString() && newData.val().matches(/^(open|settled|won|lost)$/)" },
          "$other": { ".validate": false }
        }
      }
    }
  }
};

rules.golf_mybets = {
  "$uid": {
    ".read": "auth != null && (auth.uid === $uid || " + admin + ")",
    "$bid": {
      ".write": admin + " || (auth != null && auth.uid === $uid && !data.exists() && newData.child('st').val() === 'open' && newData.child('a').val() === newData" + up(3) + ".child('golf_bets').child(newData.child('club').val()).child(newData.child('date').val()).child(newData.child('gid').val()).child($bid).child('a').val() && newData" + up(3) + ".child('golf_bets').child(newData.child('club').val()).child(newData.child('date').val()).child(newData.child('gid').val()).child($bid).child('uid').val() === $uid)",
      ".validate": "newData.hasChildren(['club','date','gid','line','side','a','px','t','st','title','label'])",
      "club": { ".validate": "newData.val() === 'colonial'" },
      "date": { ".validate": "newData.isString() && newData.val().matches(/^\\d{4}-\\d{2}-\\d{2}$/)" },
      "gid": { ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z0-9_]{1,40}$/)" },
      "line": { ".validate": "newData.isString() && newData.val().matches(/^[0-3]$/)" },
      "side": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{1,8}$/)" },
      "a": { ".validate": "newData.isNumber() && newData.val() > 0 && newData.val() <= 100 && newData.val() % 1 === 0" },
      "px": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 99" },
      "t": { ".validate": "newData.isNumber()" },
      "st": { ".validate": "newData.isString() && newData.val().matches(/^(open|settled|won|lost)$/)" },
      "title": { ".validate": "newData.isString() && newData.val().length <= 80" },
      "label": { ".validate": "newData.isString() && newData.val().length <= 80" },
      "$other": { ".validate": false }
    }
  }
};

const memberRead = "auth != null && (root.child('golf_members').child($club).child(auth.uid).exists() || " + admin + ")";
rules.golf_bets.$club[".read"] = memberRead;

rules.golf_activity = {
  "$club": {
    "$date": {
      "$gid": {
        ".read": memberRead,
        "$bid": {
          ".write": admin + " || (auth != null && !data.exists() && root.child('golf_members').child($club).child(auth.uid).exists() && newData.child('n').val() === root.child('golf_accounts').child(newData" + up(5) + ".child('golf_bets').child($club).child($date).child($gid).child($bid).child('uid').val()).child('n').val() && newData.child('a').val() === newData" + up(5) + ".child('golf_bets').child($club).child($date).child($gid).child($bid).child('a').val() && newData" + up(5) + ".child('golf_bets').child($club).child($date).child($gid).child($bid).child('uid').val() === auth.uid)",
          ".validate": "newData.hasChildren(['n','line','side','a','t','title','label'])",
          "n": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40" },
          "line": { ".validate": "newData.isString() && newData.val().matches(/^[0-3]$/)" },
          "side": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{1,8}$/)" },
          "a": { ".validate": "newData.isNumber() && newData.val() > 0 && newData.val() <= 100" },
          "t": { ".validate": "newData.isNumber()" },
          "title": { ".validate": "newData.isString() && newData.val().length <= 80" },
          "label": { ".validate": "newData.isString() && newData.val().length <= 80" },
          "$other": { ".validate": false }
        }
      }
    }
  }
};

rules.golf_prices = {
  "$club": {
    "$date": {
      "$gid": {
        "$line": {
          ".read": memberRead,
          "open": {
            "$side": {
              ".write": admin + " || (auth != null && !data.exists() && root.child('golf_members').child($club).child(auth.uid).exists() && newData.child('src').val() === 'open' && newData.child('side').val() === $side && newData.child('c').isNumber() && newData.child('c').val() >= 1 && newData.child('c').val() <= 99)",
              ".validate": "newData.hasChildren(['c','t','src','side'])",
              "c": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 99" },
              "t": { ".validate": "newData.isNumber()" },
              "src": { ".validate": "newData.val() === 'open'" },
              "side": { ".validate": "newData.isString() && newData.val() === $side" },
              "$other": { ".validate": false }
            }
          },
          "trades": {
            "$bid": {
              ".write": admin + " || (auth != null && !data.exists() && root.child('golf_members').child($club).child(auth.uid).exists() && newData.child('src').val() === 'trade' && newData.child('c').val() === newData" + up(7) + ".child('golf_bets').child($club).child($date).child($gid).child($bid).child('px').val() && newData.child('side').val() === newData" + up(7) + ".child('golf_bets').child($club).child($date).child($gid).child($bid).child('side').val() && newData" + up(7) + ".child('golf_bets').child($club).child($date).child($gid).child($bid).child('uid').val() === auth.uid && newData" + up(7) + ".child('golf_bets').child($club).child($date).child($gid).child($bid).child('line').val() === $line)",
              ".validate": "newData.hasChildren(['c','t','src','side']) && $bid.matches(/^[a-z0-9]{8,24}$/)",
              "c": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 99" },
              "t": { ".validate": "newData.isNumber()" },
              "src": { ".validate": "newData.val() === 'trade'" },
              "side": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{1,8}$/)" },
              "$other": { ".validate": false }
            }
          }
        }
      }
    }
  }
};

const original = JSON.parse(before);
for (const key of Object.keys(original)) {
  if (JSON.stringify(rules[key]) !== JSON.stringify(original[key])) {
    console.error('existing rule changed:', key);
    process.exit(1);
  }
}
for (const added of ['golf_accounts', 'golf_bets', 'golf_mybets', 'golf_activity', 'golf_prices']) {
  if (!rules[added]) {
    console.error('missing', added);
    process.exit(1);
  }
}
writeFileSync(new URL('./rules.golf.betting.json', import.meta.url), JSON.stringify({ rules }, null, 1) + '\n');
console.log('wrote rules', Object.keys(rules).length);
