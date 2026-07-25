const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let failures = 0;
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'docs', 'test'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const htmlFiles = walk(ROOT);
if (htmlFiles.length === 0) { console.error('no html files found'); process.exit(1); }
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (!/<title>.+<\/title>/.test(html)) { console.error(`FAIL ${rel}: missing <title>`); failures++; }
  if (!html.includes('lang="zh-CN"')) { console.error(`FAIL ${rel}: missing lang="zh-CN"`); failures++; }
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (/^(https?:|mailto:|#)/.test(url)) continue;
    const target = path.resolve(path.dirname(file), url.split('#')[0]);
    if (!fs.existsSync(target) && !fs.existsSync(path.join(target, 'index.html'))) {
      console.error(`FAIL ${rel}: broken link -> ${url}`); failures++;
    }
  }
}
console.log(failures ? `${failures} failure(s)` : `all links ok (${htmlFiles.length} pages)`);
process.exit(failures ? 1 : 0);
