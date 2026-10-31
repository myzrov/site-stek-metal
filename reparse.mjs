import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));

const entities = {
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  ndash: '–', mdash: '—', hellip: '…', nbsp: ' ', amp: '&', quot: '"',
  apos: "'", lt: '<', gt: '>', copy: '©', reg: '®', trade: '™', times: '×',
  deg: '°', plusmn: '±', sup2: '²', sup3: '³', frac12: '½', euro: '€', rub: '₽',
  ordm: 'º', ordf: 'ª', sect: '§', para: '¶', middot: '·', bull: '•',
  thinsp: ' ', ensp: ' ', emsp: ' ', shy: ''
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => entities[name.toLowerCase()] ?? m);
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/t[dh]>/gi, ' | ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getBody(html, id) {
  const ch = html.indexOf('contentheading');
  let start = html.indexOf('<td valign="top" colspan="2">', ch);
  if (start < 0) start = html.indexOf('<td valign="top" colspan="2">');
  let end = html.indexOf('<span class="article_seperator"', start);
  if (end < 0) end = html.indexOf('</td>', start);
  let body = html.slice(start, end);
  return body.replace(/^<td[^>]*>/i, '').replace(/<\/td>\s*$/i, '');
}

function parseTableRows(tableHtml) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(tableHtml))) {
    const cells = [];
    const tdRe = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
    let td;
    while ((td = tdRe.exec(tr[1]))) {
      const attrs = td[1];
      const rowspan = Math.min(20, Number((attrs.match(/rowspan="(\d+)"/i) || [])[1] || 1));
      const colspan = Math.min(10, Number((attrs.match(/colspan="(\d+)"/i) || [])[1] || 1));
      const text = stripTags(td[2]).replace(/\n+/g, ' ').trim();
      if (!text && rowspan === 1 && colspan === 1) continue;
      cells.push({ t: text, rs: rowspan, cs: colspan });
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseSpecs(body) {
  const tableMatch = body.match(/<table[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];
  return parseTableRows(tableMatch[0]);
}

for (const p of data.products) {
  const file = path.join(ROOT, 'raw', `product-${p.id}.html`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const body = getBody(html, p.id);
  const title = (html.match(/<td class="contentheading"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || p.title;
  p.title = stripTags(title).replace(/\s+/g, ' ').trim();

  const cut = body.search(/<h[34][^>]*>\s*Технические характеристики|<table/i);
  const descHtml = cut > 0 ? body.slice(0, cut) : body;
  p.description = stripTags(descHtml).replace(/\s*\|\s*$/gm, '').trim();
  p.fullText = stripTags(body).replace(/\s*\|\s*$/gm, '').trim();
  p.specRows = parseSpecs(body);
  delete p.specTable;

  if (!p.shortDescription) p.shortDescription = p.description.slice(0, 160);
}

// clean page texts
for (const key of Object.keys(data.pages)) {
  const file = path.join(ROOT, 'raw', `page-${key}.html`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  data.pages[key] = stripTags(getBody(html)).replace(/\s*\|\s*$/gm, '').trim();
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2), 'utf8');
console.log('Reparsed', data.products.length, 'products');

for (const p of data.products) {
  console.log(`${p.id} | ${p.title}`);
  console.log(`   desc: ${p.description.slice(0, 140).replace(/\n/g, ' ')}`);
  console.log(`   spec rows: ${p.specRows.length}`);
}
