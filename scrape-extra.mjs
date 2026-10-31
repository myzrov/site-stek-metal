import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data', 'products.json');
const BASE = 'http://www.bostek.ru';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

function decode(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  return (utf8.match(/\uFFFD/g) || []).length > 5 ? new TextDecoder('windows-1251').decode(buf) : utf8;
}
const stripTags = (s) =>
  s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/\s+/g, ' ').trim();

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const existing = new Set(data.products.map((p) => p.id));

for (const [id, category] of [[43, 'Шкафы-купе'], [44, 'Другие изделия']]) {
  if (existing.has(id)) continue;
  const url = `${BASE}/content/view/${id}/8/`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: BASE + '/' } });
  if (!res.ok) {
    console.log('FAIL', id, res.status);
    continue;
  }
  const html = decode(Buffer.from(await res.arrayBuffer()));
  fs.writeFileSync(path.join(ROOT, 'raw', `product-${id}.html`), html, 'utf8');
  const title = stripTags((html.match(/<td class="contentheading"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
  const ch = html.indexOf('contentheading');
  const start = html.indexOf('<td valign="top" colspan="2">', ch);
  const end = html.indexOf('<span class="article_seperator"', start);
  const body = html.slice(start, end);
  const descHtml = body.split(/<h[34][^>]*>\s*Технические характеристики/i)[0].split(/<table/i)[0];
  const description = stripTags(descHtml);
  const img = (body.match(/<img[^>]+src="([^"]*images\/stories[^"]*)"/i) || [])[1] || '';
  const images = [];
  if (img) {
    const imgUrl = img.startsWith('http') ? img : BASE + (img.startsWith('/') ? '' : '/') + img;
    const ir = await fetch(imgUrl, { headers: { 'User-Agent': UA, Referer: BASE + '/' } });
    if (ir.ok) {
      const buf = Buffer.from(await ir.arrayBuffer());
      const dir = path.join(ROOT, 'assets', 'products', String(id));
      fs.mkdirSync(dir, { recursive: true });
      const name = path.basename(new URL(imgUrl).pathname);
      fs.writeFileSync(path.join(dir, name), buf);
      images.push({ source: imgUrl, local: `assets/products/${id}/${name}` });
    }
  }
  data.products.push({
    id,
    detailUrl: url,
    title,
    shortDescription: description,
    thumbUrl: images[0]?.source || '',
    categories: [category],
    description,
    fullText: description,
    specifications: [],
    images
  });
  console.log('ADDED', id, title, images.length, 'images');
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2), 'utf8');
