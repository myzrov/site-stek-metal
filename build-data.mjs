import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));

const CATEGORIES = [
  { id: 2, slug: 'sejfy', name: 'Сейфы', icon: 'safe', desc: 'Взломостойкие и встраиваемые сейфы для денег, документов и ценностей.' },
  { id: 3, slug: 'abonentskie', name: 'Шкафы абонентские', icon: 'locker', desc: 'Для операционных залов банков и почтовых отделений.' },
  { id: 4, slug: 'moduli', name: 'Шкафы-модули', icon: 'module', desc: 'Индивидуальные ячейки для сотрудников и личных вещей.' },
  { id: 5, slug: 'metallicheskie', name: 'Шкафы металлические', icon: 'cabinet', desc: 'Офисные, бухгалтерские и архивные шкафы.' },
  { id: 10, slug: 'kartoteki', name: 'Картотеки', icon: 'cardfile', desc: 'Пристенные и вращающиеся картотеки для документов.' },
  { id: 11, slug: 'konteynery', name: 'Контейнеры для денег', icon: 'container', desc: 'Для хранения денежных масс в хранилищах банков.' },
  { id: 12, slug: 'telezhki', name: 'Тележки для денег', icon: 'trolley', desc: 'Перевозка денежных масс в хранилищах и кассовых узлах.' },
  { id: 14, slug: 'stendy', name: 'Стенды демонстрационные', icon: 'stand', desc: 'Информация для клиентов в операционных залах.' },
  { id: 17, slug: 'termoshkafy', name: 'Термошкафы', icon: 'thermal', desc: 'Всепогодные шкафы для приборов учёта и связи.' },
  { id: 13, slug: 'stellazhi', name: 'Стеллажи', icon: 'rack', desc: 'Сборно-разборные архивные стеллажи.' },
  { id: 19, slug: 'kupe', name: 'Шкафы-купе', icon: 'wardrobe', desc: 'Компактное хранение документов в папках.' },
  { id: 7, slug: 'servernye', name: 'Шкафы серверные', icon: 'server', desc: 'Защита серверов и блоков бесперебойного питания.' },
  { id: 6, slug: 'oruzheynye', name: 'Шкафы оружейные', icon: 'weapon', desc: 'Для оружия, боеприпасов и спецсредств.' },
  { id: 15, slug: 'stoyki', name: 'Стойки торговые', icon: 'retail', desc: 'Для товаров, образцов и витрин.' },
  { id: 16, slug: 'yashchiki', name: 'Ящики почтовые', icon: 'mailbox', desc: 'Металлические почтовые ящики для домов и офисов.' },
  { id: 8, slug: 'penaly', name: 'Пеналы пластиковые', icon: 'tray', desc: 'Хранение карт, книжек и документов.' },
  { id: 9, slug: 'tumby', name: 'Тумбы подкатные', icon: 'drawer', desc: 'Мобильное хранение под рабочим столом.' },
  { id: 20, slug: 'drugie', name: 'Другие изделия', icon: 'terminal', desc: 'Платёжные терминалы и специальные корпусные изделия.' }
];

const TITLE_FIX = {
  16: 'Шкафы оружейные ШО 1, ШО 2, ШО 3 и ШО 4',
  25: 'Контейнер для хранения денежных масс К-2',
  28: 'Стеллажи металлические СТ 3, СТ 4 и СТ 5',
  36: 'Контейнер для хранения денежных масс К-6',
  37: 'Тележка для перевозки денежных масс Т-6',
  47: 'Тележка для перевозки денежных масс Т-5'
};

const DESC_FIX = {
  4: 'Сейф 1 класса устойчивости к взлому. Предназначен для хранения денежных средств и ценных бумаг в офисах различных учреждений. Сертификат соответствия — по запросу.',
  13: 'Шкаф металлический ШМ-8 комплектуется пластиковыми пеналами и может использоваться в качестве картотеки последующего контроля или как шкаф для хранения пластиковых карт, магнитных и оптических носителей информации. ШМ-8А комплектуется 30 сдвоенными пеналами СП-1 размером 247×366×85 мм, ШМ-8Б — 20 сдвоенными пеналами СП-2 размером 320×368×112 мм.',
  32: 'Ящики почтовые металлические ПЯ-4, ПЯ-5 и ПЯ-6 предназначены для почтовой корреспонденции в жилых домах и офисах различных учреждений. Возможно изготовление ящиков с различным количеством ячеек. Окрашиваются полимерной порошковой краской в любой цвет по каталогу RAL.',
  37: 'Банковская тележка для перевозки денежных масс Т-6 предназначена для перевозки денежных масс в хранилищах банков. Конструкция обеспечивает большую грузоподъёмность и удобный доступ к содержимому. Предусмотрена возможность замыкания на два замка. Устанавливаются колёса диаметром 150 мм.',
  38: 'Стенд демонстрационный перекидной СД-2 используется для размещения информации, предназначенной для клиентов. Устанавливается на стену или другую вертикальную поверхность. По согласованию с заказчиком стенд комплектуется десятью или двадцатью жёсткими файлами.',
  40: 'Шкаф приборный термоизолированный всепогодный ШПТ-3 предназначен для установки на улице и размещения приборов контроля и учёта, автономно функционирующей радиоэлектронной, телекоммуникационной и другой аппаратуры с защитой от воздействия окружающей среды и несанкционированного доступа. Корпус разъёмный по диагонали, может иметь проходное отверстие в боковых стенках для монтажа на трубопроводе.',
  44: 'Корпус платёжного терминала КТП предназначен для размещения элементов аппаратуры приёма платежей от населения. Собственное металлическое производство и порошковая окраска позволяют адаптировать корпус под задачу заказчика.'
};

const CHIP_FIX = {
  11: ['1500 × 530 × 410', '3 уровня + трейзер'],
  29: ['2 модели', '10 или 20 файлов'],
  32: ['4, 5 или 6 ячеек', 'порошковая окраска'],
  38: ['350 × 700 × 50', '10 или 20 файлов']
};

const COMMON_FIXES = [
  [/оснащёны/g, 'оснащены'],
  [/оличаются/g, 'отличаются'],
  [/Так же/g, 'Также'],
  [/КВ-4 и предназначена/g, 'КВ-4 предназначена'],
  [/выполнены в исполнениях/g, 'выполнены в исполнении'],
  [/комплектуются десятью/g, 'комплектуется десятью'],
  [/СД-2 используются/g, 'СД-2 используется'],
  [/Почтовые ящики быть окрашены/g, 'Почтовые ящики могут быть окрашены'],
  [/разъёмный по диагонали может иметь/g, 'разъёмный по диагонали, может иметь'],
  [/информации предназначенной/g, 'информации, предназначенной'],
  [/стенд комплектуются/g, 'стенд комплектуется'],
  [/ШММ-1Б отличается от ШММ-2А/g, 'ШММ-1Б отличается от ШММ-1А'],
  [/Толщина металла лицевого слоя сейфа – 6мм/g, 'Толщина металла лицевого слоя сейфа — 6 мм'],
  [/  +/g, ' '],
  [/ +\./g, '.'],
  [/\n +/g, '\n']
];

function fixText(text) {
  let out = text;
  for (const [re, to] of COMMON_FIXES) out = out.replace(re, to);
  return out.trim();
}

function shorten(text, max = 118) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const at = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf(','), cut.lastIndexOf(' '));
  return cut.slice(0, at > max * 0.55 ? at : max).replace(/[.,;:\s]+$/, '') + '…';
}

const SIZE_RE = /^(размер|габарит)/i;
const CAPACITY_RES = [
  [/количество ячеек/i, 'ячейка'],
  [/количество ящиков/i, 'ящик'],
  [/количество пеналов/i, 'пенал'],
  [/уровней хранения|количество уровней/i, 'уровень'],
  [/количество дверей/i, 'дверь'],
  [/грузопод[ъе]?ёмность|грузоподъемность/i, 'кг'],
  [/объ[её]м/i, 'л'],
  [/масса/i, 'кг'],
  [/категория взломостойкости/i, 'класс'],
  [/количество папок/i, 'файл']
];

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

function fmtCapacity(value, unit) {
  const v = value.trim();
  const num = parseInt(v.replace(/[^\d]/g, ''), 10);
  if (unit === 'класс') return `${v} класс взломостойкости`;
  if (unit === 'кг' || unit === 'л') return `${v} ${unit}`;
  if (!Number.isFinite(num)) return v;
  const forms = {
    'ячейка': ['ячейка', 'ячейки', 'ячеек'],
    'ящик': ['ящик', 'ящика', 'ящиков'],
    'пенал': ['пенал', 'пенала', 'пеналов'],
    'уровень': ['уровень', 'уровня', 'уровней'],
    'дверь': ['дверь', 'двери', 'дверей'],
    'файл': ['файл', 'файла', 'файлов']
  }[unit];
  if (!forms) return `${v} ${unit}`;
  return `${v} ${plural(num, ...forms)}`;
}

function cleanSize(v) {
  return v.replace(/\s*[хx×]\s*/gi, '×').replace(/×/g, ' × ').replace(/\s+/g, ' ').trim();
}

function buildChips(p) {
  const chips = [];
  const rows = (p.specRows || []).filter((r) => r.length);
  let hasSize = false;
  for (const row of rows) {
    const label = (row[0]?.t || '').trim();
    if (!label || /^(параметр|модель|порядковый номер)$/i.test(label)) continue;
    const values = row.slice(1).map((c) => c.t).filter((v) => v && v !== '???' && v !== '—');
    if (!values.length) continue;
    if (SIZE_RE.test(label)) {
      if (!hasSize && values[0] && !values[0].includes('???')) {
        chips.push(cleanSize(values[0]));
        hasSize = true;
      }
      continue;
    }
    for (const [re, unit] of CAPACITY_RES) {
      if (re.test(label)) {
        chips.push(fmtCapacity(values[0], unit));
        break;
      }
    }
  }
  if (!chips.length) {
    const header = rows[0]?.map((c) => c.t).join(' ') || '';
    if (/габаритные размеры/i.test(header) && rows.length > 1) {
      chips.push(`${rows.length - 1} ${plural(rows.length - 1, 'типоразмер', 'типоразмера', 'типоразмеров')}`);
    }
    if (/-50\s*до\s*\+60/i.test(p.description)) chips.push('−50…+60 °C');
  }
  if (!chips.length && /6\s*мм/.test(p.description)) chips.push('6 мм металл');
  if (!chips.length) chips.push('По проекту');
  return [...new Set(chips)].slice(0, 2);
}

function buildTags(p) {
  const tags = [];
  const d = p.description;
  if (/банк/i.test(d)) tags.push('Для банков');
  if (/почт/i.test(d)) tags.push('Для почты');
  if (/архив|офис/i.test(d)) tags.push('Офис и архив');
  if (/по согласованию|по желанию|изготавлива|нестандарт/i.test(d)) tags.push('Под заказ');
  return [...new Set(tags)].slice(0, 3);
}

const catById = new Map(CATEGORIES.map((c) => [c.id, c]));
const catByName = new Map(CATEGORIES.map((c) => [c.name, c]));

// map old category names to new
const NAME_ALIASES = {
  'Шкафы-модули металлические': 'Шкафы-модули',
  'Шкафы сервера': 'Шкафы серверные',
  'Контейнеры для денежных масс': 'Контейнеры для денег',
  'Тележки для денежных масс': 'Тележки для денег',
  'Термошкафы приборные': 'Термошкафы',
  'Стелажи': 'Стеллажи'
};

const products = raw.products.map((p) => {
  const oldCat = p.categories[0] || 'Другие изделия';
  const cat = catByName.get(NAME_ALIASES[oldCat] || oldCat) || catById.get(20);
  const description = fixText(DESC_FIX[p.id] || p.description);
  const title = TITLE_FIX[p.id] || p.title.replace(/\s+/g, ' ').trim();
  const image = p.images?.[0]?.local || '';
  return {
    id: p.id,
    title,
    category: cat.name,
    categorySlug: cat.slug,
    icon: cat.icon,
    description,
    short: shorten(description),
    image: image || 'assets/placeholder.svg',
    chips: CHIP_FIX[p.id] || buildChips({ ...p, description }),
    tags: buildTags({ ...p, description }),
    specs: (p.specRows || []).map((row) =>
      row.map((c) => ({ t: c.t.replace(/\?\?\?+/g, '—').replace(/\s+/g, ' ').trim(), rs: c.rs, cs: c.cs }))
    )
  };
});

const categoryOrder = new Map(CATEGORIES.map((c, i) => [c.slug, i]));
products.sort((a, b) => {
  const ca = categoryOrder.get(a.categorySlug);
  const cb = categoryOrder.get(b.categorySlug);
  return ca - cb || a.id - b.id;
});

const counts = {};
for (const p of products) counts[p.categorySlug] = (counts[p.categorySlug] || 0) + 1;

const categories = CATEGORIES.map((c) => ({
  ...c,
  count: counts[c.slug] || 0
})).filter((c) => c.count > 0);

const data = {
  updated: '2026-10-27',
  company: {
    name: 'НПП «Стек»',
    city: 'Саратов',
    phone: '+7 (8452) 48-40-29',
    phoneHref: '+78452484029',
    phone2: '+7 (8452) 63-35-22',
    phone2Href: '+78452633522',
    email: 'office@bostek.ru',
    email2: 'bostek@mail.ru',
    address: '410009, г. Саратов, а/я 2894',
    warehouse: 'г. Саратов, проспект 50 лет Октября, 101'
  },
  categories,
  products
};

fs.writeFileSync(
  'data.js',
  `/* Generated from data/products.json — ${data.updated} */\nwindow.STEK_DATA = ${JSON.stringify(data)};\n`,
  'utf8'
);

console.log(`data.js: ${products.length} products, ${categories.length} categories`);
for (const p of products) console.log(p.id, '|', p.category, '|', p.chips.join(' / '), '|', p.image);
