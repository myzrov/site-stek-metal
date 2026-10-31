/* =========================================================
   НПП «Стек» — 2026
   Catalog, product modal, request drawer, forms
   ========================================================= */
(() => {
  'use strict';

  const DATA = window.STEK_DATA;
  if (!DATA || !Array.isArray(DATA.products)) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PAGE_SIZE = 12;
  const STORAGE_KEY = 'stek-request-v1';
  const COMPANY = DATA.company || {};
  const PRODUCTS = DATA.products;
  const CATEGORIES = DATA.categories;
  const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
  const CAT_ORDER = new Map(CATEGORIES.map((c, i) => [c.slug, i]));

  const state = {
    category: 'all',
    query: '',
    sort: 'popular',
    visible: PAGE_SIZE
  };

  const els = {
    header: $('#header'),
    progress: $('#scrollProgress'),
    chips: $('#categoryChips'),
    grid: $('#productGrid'),
    search: $('#catalogSearch'),
    searchClear: $('#searchClear'),
    sort: $('#catalogSort'),
    reset: $('#catalogReset'),
    count: $('#catalogCount'),
    moreWrap: $('#catalogMoreWrap'),
    more: $('#catalogMore'),
    moreCount: $('#catalogMoreCount'),
    empty: $('#catalogEmpty'),
    totalModels: $('#totalModels'),

    burger: $('#burger'),
    menu: $('#mobileMenu'),
    menuClose: $('#menuClose'),

    modal: $('#productModal'),
    modalPanel: $('.modal__panel', $('#productModal')),
    modalStage: $('#modalStage'),
    modalCategory: $('#modalCategory'),
    modalTitle: $('#modalTitle'),
    modalTags: $('#modalTags'),
    modalDesc: $('#modalDesc'),
    modalChips: $('#modalChips'),
    modalSpecs: $('#modalSpecs'),
    modalSpecCount: $('#modalSpecCount'),
    modalAdd: $('#modalAdd'),

    drawer: $('#requestDrawer'),
    drawerPanel: $('.drawer__panel', $('#requestDrawer')),
    drawerItems: $('#drawerItems'),
    drawerEmpty: $('#drawerEmpty'),
    cartOpen: $('#cartOpen'),
    cartCount: $('#cartCount'),
    mobileCartCount: $('#mobileCartCount'),

    requestForm: $('#requestForm'),
    requestError: $('#requestError'),
    requestSuccess: $('#requestSuccess'),
    contactForm: $('#contactForm'),
    contactError: $('#contactError'),
    contactSuccess: $('#contactSuccess'),

    toast: $('#toast'),
    toastText: $('#toastText'),
    toastAction: $('#toastAction')
  };

  let cart = loadCart();
  let currentProductId = null;
  let lastDraft = null;
  let toastTimer = null;
  let lastFocused = null;

  /* ---------- Helpers ---------- */
  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));

  function plural(n, one, few, many) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
  }

  function norm(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .trim();
  }

  function edge(x, max, min) {
    return Math.max(min, Math.min(max, x));
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      /* storage can be unavailable on file:// in some browsers */
    }
  }

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .map((item) => ({ id: Number(item.id), qty: edge(Number(item.qty) || 1, 99, 1) }))
        .filter((item) => BY_ID.has(item.id));
    } catch (error) {
      return [];
    }
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  /* ---------- Filtering ---------- */
  function filteredProducts() {
    const tokens = norm(state.query).split(' ').filter(Boolean);
    let list = PRODUCTS.filter((product) => {
      if (state.category !== 'all' && product.categorySlug !== state.category) return false;
      if (!tokens.length) return true;
      const haystack = norm([
        product.title,
        product.category,
        product.description,
        (product.chips || []).join(' '),
        (product.tags || []).join(' ')
      ].join(' '));
      return tokens.every((token) => haystack.includes(token));
    });

    if (state.sort === 'name') {
      list = list.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } else if (state.sort === 'category') {
      list = list.slice().sort((a, b) => {
        const byCat = (CAT_ORDER.get(a.categorySlug) ?? 99) - (CAT_ORDER.get(b.categorySlug) ?? 99);
        return byCat || a.id - b.id;
      });
    }

    return list;
  }

  /* ---------- Category chips ---------- */
  function renderChips() {
    const all = `
      <button class="chip${state.category === 'all' ? ' is-active' : ''}" type="button" data-category="all" aria-pressed="${state.category === 'all'}">
        <span class="chip__label">Все модели</span>
        <span class="chip__count">${PRODUCTS.length}</span>
      </button>`;

    const rest = CATEGORIES.map((cat) => {
      const active = state.category === cat.slug;
      return `
        <button class="chip${active ? ' is-active' : ''}" type="button" data-category="${esc(cat.slug)}" aria-pressed="${active}" title="${esc(cat.desc)}">
          <svg class="icon"><use href="#i-${esc(cat.icon)}"/></svg>
          <span class="chip__label">${esc(cat.name)}</span>
          <span class="chip__count">${cat.count}</span>
        </button>`;
    }).join('');

    els.chips.innerHTML = all + rest;
  }

  function syncChips() {
    $$('.chip', els.chips).forEach((chip) => {
      const active = chip.dataset.category === state.category;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  /* ---------- Product cards ---------- */
  function cardHTML(product, index) {
    const chips = (product.chips || [])
      .slice(0, 2)
      .map((chip) => `<span class="mini-chip">${esc(chip)}</span>`)
      .join('');

    return `
      <article class="product-card" data-id="${product.id}" style="--d:${Math.min(index * 55, 480)}ms">
        <div class="product-card__frame">
          <div class="product-card__top">
            <span class="product-card__cat">
              <span class="product-card__cat-icon"><svg class="icon"><use href="#i-${esc(product.icon)}"/></svg></span>
              ${esc(product.category)}
            </span>
            <button class="product-card__quick" type="button" data-add="${product.id}" aria-label="Добавить «${esc(product.title)}» в заявку">
              <svg class="icon"><use href="#i-plus"/></svg>
            </button>
          </div>
          <button class="product-card__stage" type="button" data-open="${product.id}" aria-label="Подробнее: ${esc(product.title)}">
            <span class="product-card__halo" aria-hidden="true"></span>
            <img src="${esc(product.image)}" alt="${esc(product.title)}" loading="lazy" decoding="async">
            <span class="product-card__gloss" aria-hidden="true"></span>
            <span class="product-card__zoom"><svg class="icon"><use href="#i-eye"/></svg>Смотреть</span>
          </button>
          <div class="product-card__body">
            <h3 class="product-card__title">${esc(product.title)}</h3>
            <p class="product-card__desc">${esc(product.short)}</p>
            <div class="product-card__chips">${chips}</div>
          </div>
          <div class="product-card__foot">
            <span class="product-card__price">Цена по запросу</span>
            <button class="product-card__more" type="button" data-open="${product.id}">
              Подробнее
              <svg class="icon"><use href="#i-arrow"/></svg>
            </button>
          </div>
        </div>
      </article>`;
  }

  function renderProducts(append = false) {
    const list = filteredProducts();
    const start = append ? els.grid.children.length : 0;
    const slice = list.slice(start, state.visible);

    if (append) {
      els.grid.insertAdjacentHTML('beforeend', slice.map((p, i) => cardHTML(p, i)).join(''));
    } else {
      els.grid.innerHTML = slice.map((p, i) => cardHTML(p, i)).join('');
    }

    const shown = els.grid.children.length;
    const total = list.length;

    els.count.textContent = total
      ? `Показано ${shown} из ${total}`
      : `Ничего не найдено · всего ${PRODUCTS.length}`;

    els.empty.hidden = total > 0;

    const remaining = total - shown;
    els.moreWrap.hidden = remaining <= 0;
    els.moreCount.textContent = String(Math.min(PAGE_SIZE, Math.max(remaining, 0)));

    syncQuickButtons();
  }

  function resetAndRender() {
    state.visible = PAGE_SIZE;
    renderProducts(false);
  }

  function setCategory(slug, scroll = false) {
    state.category = slug;
    state.visible = PAGE_SIZE;
    syncChips();
    renderProducts(false);
    if (scroll) {
      window.setTimeout(() => {
        const target = $('#catalog');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  function resetCatalog() {
    state.category = 'all';
    state.query = '';
    state.sort = 'popular';
    state.visible = PAGE_SIZE;
    els.search.value = '';
    els.searchClear.hidden = true;
    els.sort.value = 'popular';
    syncChips();
    renderProducts(false);
  }

  /* ---------- Quick add state ---------- */
  function syncQuickButtons() {
    $$('[data-add]', els.grid).forEach((button) => {
      const id = Number(button.dataset.add);
      const inCart = cart.some((item) => item.id === id);
      button.classList.toggle('is-added', inCart);
      const use = $('use', button);
      if (use) use.setAttribute('href', inCart ? '#i-check' : '#i-plus');
      button.setAttribute('aria-label', inCart
        ? `Добавить ещё «${BY_ID.get(id)?.title || ''}» в заявку`
        : `Добавить «${BY_ID.get(id)?.title || ''}» в заявку`);
    });
  }

  /* ---------- Specs ---------- */
  function specTableHTML(product) {
    const rows = product.specs || [];
    if (!rows.length) {
      return `
        <div class="spec-note">
          <svg class="icon"><use href="#i-layers"/></svg>
          <span>Характеристики этой позиции согласовываем под проект: размеры, комплектацию, замки и покрытие. Пришлите задачу — подготовим решение.</span>
        </div>`;
    }

    const firstRow = rows[0] || [];
    const isHeaded = firstRow.some((c) => norm(c.t) === 'параметр') && firstRow.some((c) => norm(c.t) === 'модель');

    const body = rows.map((row, index) => {
      const headClass = isHeaded && index < 2 ? ' class="is-head"' : '';
      const cells = row.map((cell) => {
        const rs = Number(cell.rs) > 1 ? ` rowspan="${Number(cell.rs)}"` : '';
        const cs = Number(cell.cs) > 1 ? ` colspan="${Number(cell.cs)}"` : '';
        return `<td${rs}${cs}>${esc(cell.t)}</td>`;
      }).join('');
      return `<tr${headClass}>${cells}</tr>`;
    }).join('');

    return `<table class="spec-table"><tbody>${body}</tbody></table>`;
  }

  function specCount(product) {
    const rows = product.specs || [];
    if (!rows.length) return 'по проекту';
    const firstRow = rows[0] || [];
    const isHeaded = firstRow.some((c) => norm(c.t) === 'параметр') && firstRow.some((c) => norm(c.t) === 'модель');
    const count = Math.max(rows.length - (isHeaded ? 2 : 0), 0);
    return `${count} ${plural(count, 'параметр', 'параметра', 'параметров')}`;
  }

  function descriptionHTML(text) {
    const source = String(text || '').trim();
    if (!source) return '<p>Описание уточним по запросу — расскажите о задаче, и мы подберём подходящую модель.</p>';
    return source
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${esc(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  /* ---------- Product modal ---------- */
  function openProduct(id) {
    const product = BY_ID.get(id);
    if (!product) return;

    currentProductId = id;
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    els.modalCategory.innerHTML = `<svg class="icon"><use href="#i-${esc(product.icon)}"/></svg>${esc(product.category)}`;
    els.modalTitle.textContent = product.title;
    els.modalTags.innerHTML = ((product.tags && product.tags.length) ? product.tags : ['Собственное производство'])
      .map((tag) => `<span class="tag">${esc(tag)}</span>`)
      .join('');
    els.modalDesc.innerHTML = descriptionHTML(product.description);
    els.modalChips.innerHTML = (product.chips || [])
      .map((chip) => `<span class="mini-chip mini-chip--lg">${esc(chip)}</span>`)
      .join('');
    els.modalSpecs.innerHTML = specTableHTML(product);
    els.modalSpecCount.textContent = specCount(product);
    els.modalStage.innerHTML = `<img src="${esc(product.image)}" alt="${esc(product.title)}" decoding="async">`;

    openLayer(els.modal);
    window.requestAnimationFrame(() => els.modalPanel.focus({ preventScroll: true }));
  }

  function closeProduct(restoreFocus = true) {
    if (!els.modal.classList.contains('is-open')) return;
    closeLayer(els.modal);
    currentProductId = null;
    if (restoreFocus && lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  /* ---------- Cart ---------- */
  function renderCart() {
    const total = cartTotal();

    [els.cartCount, els.mobileCartCount].forEach((badge) => {
      if (badge) badge.textContent = String(total);
    });

    els.drawerItems.innerHTML = cart.map((item) => {
      const product = BY_ID.get(item.id);
      if (!product) return '';
      return `
        <div class="drawer-item" data-id="${product.id}">
          <div class="drawer-item__thumb">
            <img src="${esc(product.image)}" alt="${esc(product.title)}" loading="lazy" decoding="async">
          </div>
          <div class="drawer-item__main">
            <span class="drawer-item__cat">${esc(product.category)}</span>
            <strong>${esc(product.title)}</strong>
            <div class="qty">
              <button type="button" data-qty="-1" aria-label="Уменьшить количество" ${item.qty <= 1 ? 'disabled' : ''}>
                <svg class="icon"><use href="#i-minus"/></svg>
              </button>
              <span aria-label="Количество">${item.qty}</span>
              <button type="button" data-qty="1" aria-label="Увеличить количество">
                <svg class="icon"><use href="#i-plus"/></svg>
              </button>
            </div>
          </div>
          <button class="drawer-item__remove" type="button" data-remove="${product.id}" aria-label="Удалить «${esc(product.title)}» из заявки">
            <svg class="icon"><use href="#i-trash"/></svg>
          </button>
        </div>`;
    }).join('');

    els.drawerEmpty.hidden = cart.length > 0;
    syncQuickButtons();
    saveCart();
  }

  function bumpBadge() {
    [els.cartCount, els.mobileCartCount].forEach((badge) => {
      if (!badge) return;
      badge.classList.remove('is-bump');
      void badge.offsetWidth;
      badge.classList.add('is-bump');
    });
  }

  function addToCart(id, openAfter = false) {
    const product = BY_ID.get(Number(id));
    if (!product) return;

    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty = Math.min(99, existing.qty + 1);
    } else {
      cart.push({ id: product.id, qty: 1 });
    }

    renderCart();
    bumpBadge();

    if (openAfter) {
      closeProduct(false);
      openDrawer();
      return;
    }

    showToast(
      existing ? `Количество увеличено: «${product.title}»` : `«${product.title}» — в заявке`,
      'Открыть',
      openDrawer
    );
  }

  /* ---------- Drawer ---------- */
  function openDrawer() {
    if (els.drawer.classList.contains('is-open')) return;
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    renderCart();
    openLayer(els.drawer);
    window.requestAnimationFrame(() => els.drawerPanel.focus({ preventScroll: true }));
  }

  function closeDrawer(restoreFocus = true) {
    if (!els.drawer.classList.contains('is-open')) return;
    closeLayer(els.drawer);
    if (els.requestSuccess) els.requestSuccess.hidden = true;
    if (els.requestError) els.requestError.hidden = true;
    if (restoreFocus && lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  /* ---------- Toast ---------- */
  function showToast(text, actionLabel, action) {
    if (!els.toast) return;
    els.toastText.textContent = text;

    if (actionLabel && typeof action === 'function') {
      els.toastAction.hidden = false;
      els.toastAction.textContent = actionLabel;
      els.toastAction.onclick = () => {
        hideToast();
        action();
      };
    } else {
      els.toastAction.hidden = true;
      els.toastAction.onclick = null;
    }

    els.toast.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, 4600);
  }

  function hideToast() {
    if (!els.toast) return;
    els.toast.classList.remove('is-show');
  }

  /* ---------- Layers / scroll lock ---------- */
  function syncLock() {
    const locked = [els.modal, els.drawer, els.menu].some((layer) => layer && layer.classList.contains('is-open'));
    document.documentElement.classList.toggle('no-scroll', locked);
    document.body.classList.toggle('no-scroll', locked);
  }

  function openLayer(layer) {
    layer.classList.add('is-open');
    layer.setAttribute('aria-hidden', 'false');
    syncLock();
  }

  function closeLayer(layer) {
    layer.classList.remove('is-open');
    layer.setAttribute('aria-hidden', 'true');
    syncLock();
  }

  function activeLayer() {
    if (els.modal.classList.contains('is-open')) return els.modal;
    if (els.drawer.classList.contains('is-open')) return els.drawer;
    if (els.menu.classList.contains('is-open')) return els.menu;
    return null;
  }

  /* ---------- Forms ---------- */
  function validateForm(form, errorBox) {
    $$('.field', form).forEach((field) => field.classList.remove('has-error'));

    const name = form.elements.namedItem('name');
    const phone = form.elements.namedItem('phone');
    const email = form.elements.namedItem('email');
    const messages = [];
    let firstInvalid = null;

    const mark = (input, message) => {
      if (!input) return;
      const field = input.closest('.field');
      if (field) field.classList.add('has-error');
      if (!firstInvalid) firstInvalid = input;
      messages.push(message);
    };

    if (!name || name.value.trim().length < 2) {
      mark(name, 'Укажите имя — как к вам обращаться.');
    }

    if (!phone || phone.value.replace(/\D/g, '').length < 10) {
      mark(phone, 'Укажите телефон — не менее 10 цифр.');
    }

    if (email) {
      const value = email.value.trim();
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        mark(email, 'Проверьте формат e-mail.');
      }
    }

    if (messages.length) {
      if (errorBox) {
        errorBox.textContent = messages[0];
        errorBox.hidden = false;
      }
      if (firstInvalid) firstInvalid.focus({ preventScroll: false });
      return false;
    }

    if (errorBox) {
      errorBox.textContent = '';
      errorBox.hidden = true;
    }
    return true;
  }

  function buildDraft(form) {
    const data = new FormData(form);
    const get = (name) => String(data.get(name) || '').trim();

    const name = get('name');
    const phone = get('phone');
    const company = get('company');
    const email = get('email');
    const comment = get('comment');

    const lines = [
      'Заявка с сайта НПП «Стек»',
      '',
      `Имя: ${name}`,
      `Телефон: ${phone}`
    ];

    if (company) lines.push(`Компания: ${company}`);
    if (email) lines.push(`E-mail: ${email}`);

    if (cart.length) {
      lines.push('', 'Оборудование:');
      cart.forEach((item, index) => {
        const product = BY_ID.get(item.id);
        if (!product) return;
        lines.push(`${index + 1}. ${product.title} — ${item.qty} ${plural(item.qty, 'шт.', 'шт.', 'шт.')} (${product.category})`);
      });
    }

    if (comment) lines.push('', `Комментарий: ${comment}`);
    lines.push('', `Дата: ${new Date().toLocaleString('ru-RU')}`);

    const subject = `Заявка на расчёт с сайта — ${name}${company ? `, ${company}` : ''}`;
    const body = lines.join('\r\n');

    return {
      subject,
      body,
      mailto: `mailto:${COMPANY.email || 'office@bostek.ru'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    };
  }

  function openMail(draft) {
    if (!draft) return;
    lastDraft = draft;
    try {
      window.location.href = draft.mailto;
    } catch (error) {
      /* mail client may be unavailable — success message covers the fallback */
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Текст заявки скопирован');
      return;
    } catch (error) {
      /* fall through */
    }

    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      showToast('Текст заявки скопирован');
    } catch (error) {
      showToast('Не удалось скопировать — выделите текст письма вручную');
    }
  }

  function completeForm(form, errorBox, successBox) {
    if (!validateForm(form, errorBox)) return;
    const draft = buildDraft(form);
    openMail(draft);
    if (successBox) successBox.hidden = false;
    showToast('Заявка сформирована — проверьте почтовый клиент');
  }

  /* ---------- Global interactions ---------- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.addEventListener('click', (event) => {
    const target = event.target;

    const closeProductBtn = target.closest('[data-close-product]');
    if (closeProductBtn) {
      closeProduct();
      return;
    }

    const closeRequestBtn = target.closest('[data-close-request]');
    if (closeRequestBtn) {
      closeDrawer();
      return;
    }

    const resetContact = target.closest('[data-reset-contact]');
    if (resetContact) {
      if (els.contactForm) {
        els.contactForm.reset();
        $$('.field', els.contactForm).forEach((field) => field.classList.remove('has-error'));
      }
      if (els.contactSuccess) els.contactSuccess.hidden = true;
      if (els.contactError) els.contactError.hidden = true;
      return;
    }

    const resetAll = target.closest('[data-reset-all]');
    if (resetAll) {
      resetCatalog();
      return;
    }

    const openBtn = target.closest('[data-open]');
    if (openBtn) {
      event.preventDefault();
      openProduct(Number(openBtn.dataset.open));
      return;
    }

    const addBtn = target.closest('[data-add]');
    if (addBtn) {
      event.preventDefault();
      addToCart(Number(addBtn.dataset.add));
      return;
    }

    const filterBtn = target.closest('[data-filter]');
    if (filterBtn) {
      event.preventDefault();
      setCategory(filterBtn.dataset.filter, true);
      return;
    }

    const categoryBtn = target.closest('[data-category]');
    if (categoryBtn) {
      setCategory(categoryBtn.dataset.category, false);
      return;
    }

    const requestBtn = target.closest('[data-open-request]');
    if (requestBtn) {
      event.preventDefault();
      openDrawer(requestBtn);
      return;
    }

    const removeBtn = target.closest('[data-remove]');
    if (removeBtn) {
      const id = Number(removeBtn.dataset.remove);
      cart = cart.filter((item) => item.id !== id);
      renderCart();
      showToast('Позиция удалена из заявки');
      return;
    }

    const qtyBtn = target.closest('[data-qty]');
    if (qtyBtn) {
      const row = qtyBtn.closest('.drawer-item');
      if (!row) return;
      const id = Number(row.dataset.id);
      const delta = Number(qtyBtn.dataset.qty);
      const item = cart.find((entry) => entry.id === id);
      if (!item) return;
      item.qty = edge(item.qty + delta, 99, 1);
      renderCart();
      return;
    }

    const faqQuestion = target.closest('.faq-item__q');
    if (faqQuestion) {
      const item = faqQuestion.closest('.faq-item');
      const isOpen = item.classList.toggle('is-open');
      faqQuestion.setAttribute('aria-expanded', String(isOpen));
    }
  });

  /* ---------- Catalog controls ---------- */
  if (els.search) {
    let searchTimer = null;

    els.search.addEventListener('input', () => {
      const value = els.search.value;
      if (els.searchClear) els.searchClear.hidden = !value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.query = value;
        state.visible = PAGE_SIZE;
        renderProducts(false);
      }, 110);
    });

    els.search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        els.search.value = '';
        state.query = '';
        state.visible = PAGE_SIZE;
        if (els.searchClear) els.searchClear.hidden = true;
        renderProducts(false);
      }
    });
  }

  if (els.searchClear) {
    els.searchClear.addEventListener('click', () => {
      els.search.value = '';
      state.query = '';
      state.visible = PAGE_SIZE;
      els.searchClear.hidden = true;
      renderProducts(false);
      els.search.focus();
    });
  }

  if (els.sort) {
    els.sort.addEventListener('change', () => {
      state.sort = els.sort.value;
      state.visible = PAGE_SIZE;
      renderProducts(false);
    });
  }

  if (els.reset) {
    els.reset.addEventListener('click', resetCatalog);
  }

  if (els.more) {
    els.more.addEventListener('click', () => {
      state.visible += PAGE_SIZE;
      renderProducts(true);
    });
  }

  /* ---------- Mobile menu ---------- */
  function openMenu() {
    els.menu.classList.add('is-open');
    els.menu.setAttribute('aria-hidden', 'false');
    els.burger.classList.add('is-open');
    els.burger.setAttribute('aria-expanded', 'true');
    syncLock();
    window.requestAnimationFrame(() => els.menuClose.focus({ preventScroll: true }));
  }

  function closeMenu(restoreFocus = true) {
    if (!els.menu.classList.contains('is-open')) return;
    els.menu.classList.remove('is-open');
    els.menu.setAttribute('aria-hidden', 'true');
    els.burger.classList.remove('is-open');
    els.burger.setAttribute('aria-expanded', 'false');
    syncLock();
    if (restoreFocus) els.burger.focus({ preventScroll: true });
  }

  if (els.burger) {
    els.burger.addEventListener('click', () => {
      if (els.menu.classList.contains('is-open')) closeMenu();
      else openMenu();
    });
  }

  if (els.menuClose) {
    els.menuClose.addEventListener('click', () => closeMenu());
  }

  $$('a[href^="#"]', els.menu).forEach((link) => {
    link.addEventListener('click', () => closeMenu(false));
  });

  /* ---------- Drawer & modal triggers ---------- */
  if (els.cartOpen) {
    els.cartOpen.addEventListener('click', () => openDrawer(els.cartOpen));
  }

  if (els.modalAdd) {
    els.modalAdd.addEventListener('click', () => {
      if (currentProductId) addToCart(currentProductId, true);
    });
  }

  /* ---------- Forms ---------- */
  if (els.contactForm) {
    els.contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      completeForm(els.contactForm, els.contactError, els.contactSuccess);
    });
  }

  if (els.requestForm) {
    els.requestForm.addEventListener('submit', (event) => {
      event.preventDefault();
      completeForm(els.requestForm, els.requestError, els.requestSuccess);
    });
  }

  const copyRequest = $('#copyRequest');
  if (copyRequest) {
    copyRequest.addEventListener('click', () => {
      if (lastDraft) copyText(lastDraft.body);
      else showToast('Сначала сформируйте заявку');
    });
  }

  const openMailAgain = $('#openMailAgain');
  if (openMailAgain) {
    openMailAgain.addEventListener('click', () => {
      if (lastDraft) openMail(lastDraft);
    });
  }

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (els.menu.classList.contains('is-open')) {
        closeMenu();
        return;
      }
      if (els.drawer.classList.contains('is-open')) {
        closeDrawer();
        return;
      }
      if (els.modal.classList.contains('is-open')) {
        closeProduct();
        return;
      }
    }

    if (event.key !== 'Tab') return;
    const layer = activeLayer();
    if (!layer) return;
    const container = layer === els.modal ? els.modalPanel : layer === els.drawer ? els.drawerPanel : els.menu;
    trapFocus(event, container);
  });

  function trapFocus(event, container) {
    if (!container) return;
    const focusable = $$(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (!focusable.length) {
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  /* ---------- Scroll UI ---------- */
  let scrollTick = false;

  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    if (els.header) els.header.classList.toggle('is-scrolled', y > 12);

    if (els.progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? edge(y / max, 1, 0) : 0;
      els.progress.style.transform = `scaleX(${ratio})`;
    }
  }

  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = true;
    window.requestAnimationFrame(() => {
      onScroll();
      scrollTick = false;
    });
  }, { passive: true });

  onScroll();

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    const items = $$('.reveal');
    if (!items.length) return;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-in'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    items.forEach((item) => observer.observe(item));
  }

  initReveal();

  /* ---------- Counters ---------- */
  function runCounter(el) {
    const target = Number(el.dataset.count) || 0;
    if (reducedMotion) {
      el.textContent = String(target);
      return;
    }
    const duration = 1500;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  }

  const counters = $$('[data-count]');
  if (counters.length) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      counters.forEach((el) => { el.textContent = String(el.dataset.count || 0); });
    } else {
      let started = false;
      const counterObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || started) return;
        started = true;
        counters.forEach(runCounter);
        counterObserver.disconnect();
      }, { threshold: 0.2 });
      const stats = $('.hero__stats');
      if (stats) counterObserver.observe(stats);
    }
  }

  /* ---------- Pointer effects ---------- */
  if (canHover && !reducedMotion) {
    const hero = $('.hero');
    const spot = $('#heroSpot');
    if (hero && spot) {
      hero.addEventListener('pointermove', (event) => {
        const rect = hero.getBoundingClientRect();
        spot.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        spot.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      }, { passive: true });
    }

    const heroVisual = $('#heroTilt');
    const heroCard = heroVisual ? $('.hero-card', heroVisual) : null;
    if (heroVisual && heroCard) {
      heroVisual.addEventListener('pointermove', (event) => {
        const rect = heroVisual.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        heroCard.style.transform = `rotateX(${(0.5 - py) * 9}deg) rotateY(${(px - 0.5) * 11}deg)`;
        heroCard.style.setProperty('--hx', `${px * 100}%`);
        heroCard.style.setProperty('--hy', `${py * 100}%`);
      }, { passive: true });

      heroVisual.addEventListener('pointerleave', () => {
        heroCard.style.transform = '';
        heroCard.style.setProperty('--hx', '50%');
        heroCard.style.setProperty('--hy', '0%');
      });
    }

    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        card.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * 4.5}deg) rotateY(${(px - 0.5) * 5.5}deg) translateY(-4px)`;
      }, { passive: true });

      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ---------- Image fallback ---------- */
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (image.dataset.failed) return;
    image.dataset.failed = '1';
    image.src = 'assets/placeholder.svg';
  }, true);

  /* ---------- Init ---------- */
  if (els.totalModels) els.totalModels.textContent = String(PRODUCTS.length);
  renderChips();
  renderProducts(false);
  renderCart();

  window.__STEK_READY = true;
  document.documentElement.classList.add('js');
  document.documentElement.classList.add('is-ready');

  if (window.location.hash === '#catalog') {
    window.requestAnimationFrame(() => {
      const target = $('#catalog');
      if (target) target.scrollIntoView({ block: 'start' });
    });
  }
})();
