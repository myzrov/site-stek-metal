import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('D:/AI/ZEROCODER/projects/bostek-new-site-2026-10-27');
const RAW = path.join(ROOT, 'raw');
const ASSETS = path.join(ROOT, 'assets');
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const BASE = 'http://www.bostek.ru';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const bad = (utf8.match(/\uFFFD/g) || []).length;
  if (bad > 5) {
    try {
      return new TextDecoder('windows-1251').decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

async function fetchHtml(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9' } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return decode(buf);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(700);
    }
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function absUrl(src) {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return 'http:' + src;
  if (src.startsWith('/')) return BASE + src;
  return BASE + '/' + src;
}

function fileSafe(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

async function downloadImage(url, destDir, index = 0) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: BASE + '/' } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 300) return null;
    let name = fileSafe(path.basename(new URL(url).pathname)) || `image-${index}.jpg`;
    if (!/\.(jpe?g|png|gif|webp|avif)$/i.test(name)) name += '.jpg';
    let file = path.join(destDir, name);
    let n = 1;
    while (fs.existsSync(file)) {
      file = path.join(destDir, `${path.parse(name).name}-${n}${path.extname(name)}`);
      n++;
    }
    fs.writeFileSync(file, buf);
    return path.relative(ROOT, file).replace(/\\/g, '/');
  } catch {
    return null;
  }
}

function parseListing(html) {
  const products = [];
  const re = /<a[^>]+href="([^"]*content\/view\/(\d+)\/[^"]*)"[^>]*class="contentpagetitle"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p id="ssilka"[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const descHtml = m[4];
    const img = (descHtml.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || '';
    products.push({
      id: Number(m[2]),
      detailUrl: absUrl(m[1]),
      title: stripTags(m[3]).replace(/\s+/g, ' ').trim(),
      shortDescription: stripTags(descHtml).replace(/\s+/g, ' ').trim(),
      thumbUrl: absUrl(img)
    });
  }
  return products;
}

function parseCategories(html) {
  const cats = [];
  const re = /href="([^"]*blogcategory\/(\d+)\/(\d+)\/)"[^>]*class="sublevel"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    cats.push({ id: Number(m[2]), itemId: Number(m[3]), url: absUrl(m[1]), name: stripTags(m[4]).trim() });
  }
  return cats;
}

function parseDetail(html, id) {
  const title =
    (html.match(/<td class="contentheading"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] ||
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] ||
    '';
  const start = html.search(/<td[^>]+colspan="2"[^>]*>/i);
  const end = html.indexOf('<span class="article_seperator"', start);
  let body = start >= 0 ? html.slice(start, end > start ? end : undefined) : '';
  body = body.replace(/^<td[^>]*>/i, '').replace(/<\/td>\s*$/i, '');

  const images = [];
  const imgRe = /<img[^>]+src="([^"]+)"/gi;
  let m;
  while ((m = imgRe.exec(body))) {
    const u = absUrl(m[1]);
    if (/\/images\/stories\//i.test(u) && !images.includes(u)) images.push(u);
  }

  const specs = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  while ((m = trRe.exec(body))) {
    const cells = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c;
    while ((c = tdRe.exec(m[1]))) {
      const txt = stripTags(c[1]).replace(/\s+/g, ' ').trim();
      if (txt) cells.push(txt);
    }
    if (cells.length >= 2 && cells.length <= 8) specs.push(cells);
  }

  const text = stripTags(body);
  const description = text.split(/Технические характеристики/i)[0].trim();

  return {
    id,
    title: stripTags(title).replace(/\s+/g, ' ').trim(),
    description,
    fullText: text,
    specifications: specs,
    images
  };
}

async function main() {
  const listingBase = `${BASE}/content/blogsection/1/8/`;
  const all = new Map();
  const categoryList = new Map();

  // 1. Listing pages (10 pages x 4 products)
  for (let p = 0; p < 10; p++) {
    const url = p === 0 ? listingBase : `${listingBase}4/${p * 4}/`;
    const html = await fetchHtml(url);
    fs.writeFileSync(path.join(RAW, `listing-${p + 1}.html`), html, 'utf8');
    const products = parseListing(html);
    for (const prod of products) all.set(prod.id, { ...all.get(prod.id), ...prod });
    if (p === 0) {
      for (const cat of parseCategories(html)) categoryList.set(cat.id, cat);
    }
    console.log(`listing ${p + 1}: ${products.length} products; total ${all.size}`);
    await sleep(250);
  }

  // 2. Categories and product -> category mapping
  const categories = [...categoryList.values()];
  for (const cat of categories) {
    cat.products = [];
    try {
      const html = await fetchHtml(cat.url);
      fs.writeFileSync(path.join(RAW, `category-${cat.id}.html`), html, 'utf8');
      const re = /<a[^>]+href="[^"]*content\/view\/(\d+)\/[^"]*"[^>]*class="contentpagetitle"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = re.exec(html))) {
        const id = Number(m[1]);
        if (!cat.products.includes(id)) cat.products.push(id);
      }
      console.log(`category ${cat.id} ${cat.name}: ${cat.products.length}`);
    } catch (e) {
      console.log(`category ${cat.id} failed: ${e.message}`);
    }
    await sleep(150);
  }

  // 3. Detail pages + images
  const products = [];
  for (const baseProd of [...all.values()].sort((a, b) => a.id - b.id)) {
    try {
      const html = await fetchHtml(baseProd.detailUrl);
      fs.writeFileSync(path.join(RAW, `product-${baseProd.id}.html`), html, 'utf8');
      const detail = parseDetail(html, baseProd.id);
      const cats = categories.filter((c) => c.products.includes(baseProd.id)).map((c) => c.name);
      const dir = path.join(ASSETS, 'products', String(baseProd.id));
      fs.mkdirSync(dir, { recursive: true });

      const images = [];
      for (let i = 0; i < detail.images.length; i++) {
        const local = await downloadImage(detail.images[i], dir, i);
        if (local) images.push({ source: detail.images[i], local });
        await sleep(80);
      }
      if (!images.length && baseProd.thumbUrl) {
        const local = await downloadImage(baseProd.thumbUrl, dir, 0);
        if (local) images.push({ source: baseProd.thumbUrl, local });
      }

      products.push({
        ...baseProd,
        categories: cats,
        description: detail.description,
        fullText: detail.fullText,
        specifications: detail.specifications,
        images
      });
      console.log(`product ${baseProd.id}: ${baseProd.title} | ${images.length} images | ${cats.join(', ')}`);
    } catch (e) {
      console.log(`product ${baseProd.id} failed: ${e.message}`);
    }
    await sleep(150);
  }

  // 4. Pages: about, contacts, delivery, price
  const pages = {
    about: `${BASE}/content/view/1/3/`,
    price: `${BASE}/content/view/2/4/`,
    delivery: `${BASE}/content/view/3/6/`,
    contacts: `${BASE}/component/option,com_contact/task,view/contact_id,1/Itemid,5/`,
    home: `${BASE}/`
  };
  const pageText = {};
  for (const [key, url] of Object.entries(pages)) {
    try {
      const html = await fetchHtml(url);
      fs.writeFileSync(path.join(RAW, `page-${key}.html`), html, 'utf8');
      const start = html.search(/<td[^>]+colspan="2"[^>]*>/i);
      const end = html.indexOf('<span class="article_seperator"', start);
      const body = start >= 0 ? html.slice(start, end > start ? end : undefined) : html;
      pageText[key] = stripTags(body);
    } catch (e) {
      pageText[key] = `ERROR: ${e.message}`;
    }
  }

  const data = {
    source: BASE,
    scrapedAt: new Date().toISOString(),
    company: {
      name: 'НПП «Стек»',
      city: 'Саратов',
      phone: '(8452) 48-40-29, 63-35-22',
      email: 'office@bostek.ru',
      email2: 'bostek@mail.ru'
    },
    categories: categories.map((c) => ({ id: c.id, name: c.name, productIds: c.products })),
    products,
    pages: pageText
  };
  fs.writeFileSync(path.join(DATA, 'products.json'), JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nDONE: ${products.length} products, ${categories.length} categories`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
