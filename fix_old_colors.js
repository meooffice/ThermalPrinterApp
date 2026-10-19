// Run from project root:  node fix_old_colors.js
// Replaces the 4 old indigo colors in 6 files. Exact-text replace, UTF-8, line endings untouched.
const fs = require('fs');
const jobs = [
  ['screens/CatalogScreen.js',  [["saveBtnOff:   { backgroundColor: '#a5b4fc' }", "saveBtnOff:   { backgroundColor: '#9DB89F' }"]]],
  ['screens/SchoolScreen.js',   [["saveBtnOff:   { backgroundColor: '#a5b4fc' }", "saveBtnOff:   { backgroundColor: '#9DB89F' }"]]],
  ['screens/ScanScreen.js',     [["scanBtnDisabled: { backgroundColor: '#a5b4fc' }", "scanBtnDisabled: { backgroundColor: '#9DB89F' }"]]],
  ['screens/ReceiptScreen.js',  [["checkItemActive:    { backgroundColor: '#fafafe' }", "checkItemActive:    { backgroundColor: '#F6FAF3' }"],
                                 ["printBtnDisabled: { backgroundColor: '#a5b4fc' }", "printBtnDisabled: { backgroundColor: '#9DB89F' }"]]],
  ['screens/SettingsScreen.js',  [['<Section icon="🏢" bg="#EEF2FF"', '<Section icon="🏢" bg="#E4F3EC"'],
                                  ['{ backgroundColor: "#EEF2FF" }', '{ backgroundColor: "#E4F3EC" }'],
                                  ['saveBtnDisabled: { backgroundColor: "#a5b4fc" }', 'saveBtnDisabled: { backgroundColor: "#9DB89F" }']]],
];
let bad = 0;
for (const [file, pairs] of jobs) {
  if (!fs.existsSync(file)) { console.log('MISSING  ', file); bad++; continue; }
  let t = fs.readFileSync(file, 'utf8');
  let changed = 0;
  for (const [a, b] of pairs) {
    const n = t.split(a).length - 1;
    if (n !== 1) { console.log('SKIP (found ' + n + 'x):', file, '->', a); bad++; continue; }
    t = t.replace(a, () => b); changed++;
  }
  if (changed) fs.writeFileSync(file, t, 'utf8');
  console.log('OK', file, changed + ' change(s)');
}
console.log(bad ? 'Some items need a manual look (see above).' : 'All done.');