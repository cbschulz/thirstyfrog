# Torii black / champagne-gold theme, all pages (v4)
Built from fresh live copies fetched Oct 21 2026 1:47 PM CT (identical to the 1:15 PM copies, so nothing newer lost).
Changed files (repo-root paths):
- hub/index.html                 theme only (fonts link + 1 <style> block before </head>)
- internetinvite/index.html      theme only (buy buttons stay hidden by its existing CSS)
- ridglea/index.html             theme only
- hub/{chiclets,dwts,elpres,onebite,pickem,pmt}/index.html
    card(): Ridglea-style layout (NN¢ rows + since open, rcChart line chart, "Buy <option> NN¢" buttons,
    same openBet(id,side), hidden when settled/closed; `rule`->`rule rl` so old wrapper chart isn't duplicated);
    jewel-tone option color arrays; theme <style> block.
Theme block: page #0c0c0e, cards #16161a w/ gold-tint 1px border, 14px radius; champagne gold #c9a86a accents;
Playfair Display / Cormorant Garamond headings + option names; ivory prices; gold-gradient primary buttons, dark
gold-outline secondary; popups (.modal/.sheet: buy, sign-in, settle), inputs, quick-amount and settle-pick buttons,
leaderboard/standings rows, X feed, charts, toast, crumb, prize banner all darkened.
NOT touched: CNAME, root index.html, firebase rules, any trade/pricing/payout/auth logic.
