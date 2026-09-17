(() => {
  'use strict';

  const data = window.PROPOSAL_DATA || {};
  const gallery = Array.isArray(data.gallery) ? data.gallery : [];
  const modes = Array.isArray(data.modes) ? data.modes : [];
  const routes = Array.isArray(data.transitions) ? data.transitions : [];
  const assets = new Map(gallery.map((item) => [String(item.id), item]));
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => motion.matches;
  const setText = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = value || '';
  };

  // The source document stays readable if an enhancement is unavailable.
  const revealNodes = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -24px 0px' });
    revealNodes.forEach((node) => revealObserver.observe(node));
    document.documentElement.classList.add('js');
  } else {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
  }

  const dialog = $('#lightbox');
  const largeImage = $('#lightbox-image');
  const stage = $('#lightbox-stage');
  const imageStatus = $('#image-status');
  let imageIndex = 0;
  let imageRequest = 0;
  let opener = null;
  let scrollStyles = null;
  let zoomed = false;
  let touchStart = null;
  const originalUrls = new Map();

  function originalUrl(source) {
    if (!source.startsWith('data:')) return source;
    if (!originalUrls.has(source)) {
      const comma = source.indexOf(',');
      const mime = source.slice(5, source.indexOf(';'));
      const binary = atob(source.slice(comma + 1));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      originalUrls.set(source, URL.createObjectURL(new Blob([bytes], { type: mime })));
    }
    return originalUrls.get(source);
  }
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    originalUrls.forEach((url) => URL.revokeObjectURL(url));
    originalUrls.clear();
  });

  function setZoom(value, origin) {
    zoomed = Boolean(value);
    stage?.classList.toggle('is-zoomed', zoomed);
    if (largeImage) largeImage.style.transformOrigin = origin || '50% 50%';
    const button = $('#lightbox-zoom');
    if (button) {
      button.setAttribute('aria-pressed', String(zoomed));
      button.setAttribute('aria-label', zoomed ? '缩小图片' : '放大图片');
      button.setAttribute('title', zoomed ? '缩小图片' : '放大图片');
    }
  }

  function showImage(index) {
    if (!gallery.length || !largeImage) return;
    imageIndex = (index + gallery.length) % gallery.length;
    const item = gallery[imageIndex];
    const request = ++imageRequest;
    setZoom(false);
    setText('#lightbox-title', item.title);
    setText('#lightbox-description', item.description);
    setText('#lightbox-index', `${String(imageIndex + 1).padStart(2, '0')} / ${String(gallery.length).padStart(2, '0')}`);
    largeImage.alt = item.title || '设计方案图片';
    stage?.classList.add('is-loading');
    stage?.setAttribute('aria-busy', 'true');
    largeImage.style.opacity = '0';
    if (imageStatus) imageStatus.textContent = '图片加载中…';
    const original = $('#lightbox-open-original');
    if (original) {
      original.href = originalUrl(item.full || item.src);
      original.target = '_blank';
      original.rel = 'noopener';
      original.setAttribute('aria-label', `打开原图：${item.title || '设计方案图片'}`);
    }
    const preload = new Image();
    let retried = false;
    preload.onload = () => {
      if (request !== imageRequest) return;
      largeImage.src = preload.src;
      largeImage.style.opacity = '';
      stage?.classList.remove('is-loading');
      stage?.setAttribute('aria-busy', 'false');
      if (imageStatus) imageStatus.textContent = '';
    };
    preload.onerror = () => {
      if (request !== imageRequest) return;
      if (!retried && item.src && item.full && item.src !== item.full) {
        retried = true;
        preload.src = item.src;
        return;
      }
      stage?.classList.remove('is-loading');
      stage?.setAttribute('aria-busy', 'false');
      if (imageStatus) imageStatus.textContent = '图片暂时无法加载，请点击“原图”查看。';
    };
    preload.src = item.full || item.src;
  }

  function lockScroll() {
    if (scrollStyles) return;
    scrollStyles = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight };
    const width = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (width) {
      const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${padding + width}px`;
    }
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    if (!scrollStyles) return;
    document.body.style.overflow = scrollStyles.overflow;
    document.body.style.paddingRight = scrollStyles.paddingRight;
    scrollStyles = null;
  }

  function openImage(id, trigger) {
    const index = gallery.findIndex((item) => String(item.id) === String(id));
    if (index < 0 || !dialog || !largeImage) return;
    opener = trigger || document.activeElement;
    showImage(index);
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    lockScroll();
    document.documentElement.classList.add('lightbox-open');
    $('#lightbox-close')?.focus({ preventScroll: true });
  }

  function closeImage() {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      afterClose();
    }
  }

  function afterClose() {
    imageRequest += 1;
    unlockScroll();
    setZoom(false);
    document.documentElement.classList.remove('lightbox-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-open-image]');
    if (!trigger || event.defaultPrevented) return;
    event.preventDefault();
    openImage(trigger.dataset.openImage, trigger);
  });
  $('#lightbox-close')?.addEventListener('click', closeImage);
  $('#lightbox-prev')?.addEventListener('click', () => showImage(imageIndex - 1));
  $('#lightbox-next')?.addEventListener('click', () => showImage(imageIndex + 1));
  $('#lightbox-zoom')?.addEventListener('click', () => setZoom(!zoomed));
  dialog?.addEventListener('close', afterClose);
  let backdropPointerDown = false;
  dialog?.addEventListener('pointerdown', (event) => {
    backdropPointerDown = event.target === dialog;
  });
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog && backdropPointerDown) closeImage();
    backdropPointerDown = false;
  });
  dialog?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showImage(imageIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showImage(imageIndex + 1);
    } else if (event.key === 'Escape' && typeof dialog.close !== 'function') {
      event.preventDefault();
      closeImage();
    }
  });
  stage?.addEventListener('pointermove', (event) => {
    if (!zoomed || event.pointerType === 'touch' || !largeImage) return;
    const box = stage.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100));
    largeImage.style.transformOrigin = `${x}% ${y}%`;
  });
  stage?.addEventListener('dblclick', (event) => {
    if (event.target !== largeImage) return;
    const box = stage.getBoundingClientRect();
    setZoom(!zoomed, `${((event.clientX - box.left) / box.width) * 100}% ${((event.clientY - box.top) / box.height) * 100}%`);
  });
  stage?.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1 || zoomed) { touchStart = null; return; }
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  stage?.addEventListener('touchend', (event) => {
    if (!touchStart || zoomed || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.5) showImage(imageIndex + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  stage?.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  function setTabState(buttons, activeIndex) {
    buttons.forEach((button, index) => {
      const selected = index === activeIndex;
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute('tabindex', selected ? '0' : '-1');
      button.classList.toggle('is-active', selected);
    });
  }

  function installTabKeys(buttons, select) {
    buttons.forEach((button, index) => {
      button.addEventListener('keydown', (event) => {
        let target = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[target].focus({ preventScroll: true });
        select(target);
      });
    });
  }

  const modeButtons = $$('[data-mode]');
  const modePanel = $('#mode-panel');
  let modeTimer;
  let selectedMode = -1;
  function updateMode(index) {
    const mode = modes[index];
    if (!mode) return;
    const asset = assets.get(String(mode.assetId));
    setText('#mode-title', mode.title);
    setText('#mode-en', mode.en);
    setText('#mode-description', mode.description);
    setText('#mode-detail', mode.detail);
    setText('#mode-number', `${String(index + 1).padStart(2, '0')} / 03`);
    const image = $('#mode-image');
    if (image && asset) {
      image.src = asset.src || asset.full;
      image.alt = asset.title || mode.title;
    }
    const button = $('#mode-open');
    if (button && asset) {
      button.dataset.openImage = String(mode.assetId);
      button.setAttribute('aria-label', `查看${mode.title}大图`);
    }
    const tab = modeButtons[index];
    if (modePanel && tab?.id) modePanel.setAttribute('aria-labelledby', tab.id);
  }
  function selectMode(index, animate = true) {
    if (!modes[index] || selectedMode === index) return;
    selectedMode = index;
    clearTimeout(modeTimer);
    setTabState(modeButtons, index);
    if (animate && !reducedMotion()) {
      modePanel?.classList.add('is-changing');
      modeTimer = setTimeout(() => {
        updateMode(index);
        requestAnimationFrame(() => modePanel?.classList.remove('is-changing'));
      }, 160);
    } else {
      updateMode(index);
      modePanel?.classList.remove('is-changing');
    }
  }
  modeButtons.forEach((button, index) => button.addEventListener('click', () => selectMode(index)));
  installTabKeys(modeButtons, selectMode);
  if (modes.length) selectMode(0, false);

  const routeButtons = $$('[data-route]');
  const routeSteps = $('#route-steps');
  let selectedRoute = -1;
  function selectRoute(index) {
    const route = routes[index];
    if (!route || !routeSteps || selectedRoute === index) return;
    selectedRoute = index;
    setTabState(routeButtons, index);
    setText('#route-title', route.title);
    const fragment = document.createDocumentFragment();
    (route.steps || []).forEach((step, stepIndex) => {
      const asset = assets.get(String(step.assetId));
      const article = document.createElement('article');
      article.className = 'step';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step-image';
      button.dataset.openImage = String(step.assetId);
      button.setAttribute('aria-label', `查看步骤 ${stepIndex + 1}：${step.title}`);
      if (asset) {
        const image = document.createElement('img');
        image.src = asset.src || asset.full;
        image.alt = asset.title || step.title || '';
        image.loading = 'lazy';
        image.decoding = 'async';
        button.append(image);
      }
      const number = document.createElement('span');
      number.className = 'step-count';
      number.textContent = String(stepIndex + 1).padStart(2, '0');
      const title = document.createElement('h4');
      title.textContent = step.title || '';
      const description = document.createElement('p');
      description.textContent = step.description || '';
      article.append(button, number, title, description);
      fragment.append(article);
    });
    routeSteps.replaceChildren(fragment);
    if (routeButtons[index]?.id) $('#route-panel')?.setAttribute('aria-labelledby', routeButtons[index].id);
    if (!reducedMotion() && typeof routeSteps.animate === 'function') {
      routeSteps.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }
  routeButtons.forEach((button, index) => button.addEventListener('click', () => selectRoute(index)));
  installTabKeys(routeButtons, selectRoute);
  if (routes.length) selectRoute(0);

  const galleryFilters = $$('[data-gallery-filter]');
  const galleryItems = $$('.gallery-item[data-category]');
  galleryFilters.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.galleryFilter;
      galleryFilters.forEach((candidate) => {
        const selected = candidate === button;
        candidate.setAttribute('aria-pressed', String(selected));
        candidate.classList.toggle('is-active', selected);
      });
      galleryItems.forEach((item) => {
        const visible = filter === 'all' || item.dataset.category === filter;
        item.hidden = !visible;
        if (visible) item.classList.add('is-visible');
      });
      queueScrollUpdate();
    });
  });

  const readingProgress = $('#reading-progress');
  const backTop = $('#back-top');
  const navLinks = $$('.nav-links a[href^="#"]');
  const navSections = navLinks.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
  let scrollFrame = 0;
  function updateScroll() {
    scrollFrame = 0;
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const progress = available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0;
    if (readingProgress) readingProgress.style.transform = `scaleX(${progress})`;
    if (backTop) {
      backTop.hidden = window.scrollY <= 900;
      backTop.classList.toggle('is-visible', window.scrollY > 900);
    }
    const cutoff = window.innerHeight * 0.38;
    let active = null;
    navSections.forEach((section) => {
      if (section.getBoundingClientRect().top <= cutoff) active = section.id;
    });
    navLinks.forEach((link) => {
      if (link.hash === `#${active}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function queueScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }
  window.addEventListener('scroll', queueScrollUpdate, { passive: true });
  window.addEventListener('resize', queueScrollUpdate, { passive: true });
  window.addEventListener('load', queueScrollUpdate, { once: true });
  updateScroll();
  backTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' }));

  const fullscreenButtons = $$('#fullscreen, #presentation-toggle');
  fullscreenButtons.forEach((button) => {
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) { button.hidden = true; return; }
    button.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        // Browser policies may disallow fullscreen for a local document.
      }
    });
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreenButtons.forEach((button) => {
      const active = Boolean(document.fullscreenElement);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active ? '退出全屏展示' : '全屏展示');
      button.setAttribute('title', active ? '退出全屏展示' : '全屏展示');
      const label = button.querySelector('[data-fullscreen-label]');
      if (label) label.textContent = active ? '退出全屏' : '全屏展示';
    });
  });

  const cursor = $('#brand-cursor');
  const cursorLabel = cursor?.querySelector('.cursor-label');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let cursorFrame = 0;
  let cursorX = -100;
  let cursorY = -100;
  let targetX = -100;
  let targetY = -100;
  let cursorVisible = false;

  function drawCursor() {
    cursorFrame = 0;
    if (!cursor || !cursorVisible || !finePointer.matches) return;
    const follow = reducedMotion() ? 1 : 0.38;
    cursorX += (targetX - cursorX) * follow;
    cursorY += (targetY - cursorY) * follow;
    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    if (Math.abs(targetX - cursorX) > 0.1 || Math.abs(targetY - cursorY) > 0.1) cursorFrame = requestAnimationFrame(drawCursor);
  }

  function hideCursor() {
    cursorVisible = false;
    cursor?.classList.remove('is-visible', 'is-down');
    document.documentElement.classList.remove('custom-cursor-ready');
    if (cursorFrame) cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
  }

  if (cursor) {
    document.addEventListener('pointermove', (event) => {
      if (!finePointer.matches || event.pointerType === 'touch') { hideCursor(); return; }
      targetX = event.clientX;
      targetY = event.clientY;
      if (!cursorVisible) {
        cursorX = targetX;
        cursorY = targetY;
        cursorVisible = true;
        cursor.classList.add('is-visible');
        document.documentElement.classList.add('custom-cursor-ready');
      }
      const target = event.target.closest?.('a, button, [data-open-image]');
      const imageTarget = event.target.closest?.('[data-open-image]');
      cursor.classList.toggle('is-active', Boolean(target));
      cursor.classList.toggle('is-image', Boolean(imageTarget));
      if (cursorLabel) cursorLabel.textContent = imageTarget ? '查看' : '';
      if (!cursorFrame) cursorFrame = requestAnimationFrame(drawCursor);
    }, { passive: true });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'), { passive: true });
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'), { passive: true });
    document.documentElement.addEventListener('pointerleave', hideCursor);
    window.addEventListener('blur', hideCursor);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hideCursor(); });
    finePointer.addEventListener?.('change', () => { if (!finePointer.matches) hideCursor(); });
  }
})();
