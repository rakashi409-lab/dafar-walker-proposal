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
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, ready: false };
  const pointers = new Map();
  let gesture = null;
  let touchStart = null;
  const MAX_ZOOM = 6;
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

  function renderView() {
    if (!stage || !largeImage) return;
    const limitX = Math.max(0, (view.width * view.scale - stage.clientWidth) / 2);
    const limitY = Math.max(0, (view.height * view.scale - stage.clientHeight) / 2);
    view.x = Math.max(-limitX, Math.min(limitX, view.x));
    view.y = Math.max(-limitY, Math.min(limitY, view.y));
    zoomed = view.scale > 1.001;
    stage.classList.toggle('is-zoomed', zoomed);
    largeImage.style.transform = `translate(-50%, -50%) translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;
    const percent = Math.round(view.scale * 100);
    setText('#lightbox-fit', `${percent}%`);
    $('#lightbox-fit')?.setAttribute('aria-label', `当前缩放 ${percent}%，点击恢复完整居中显示`);
    if ($('#lightbox-zoom')) $('#lightbox-zoom').disabled = !view.ready || view.scale >= MAX_ZOOM;
    if ($('#lightbox-zoom-out')) $('#lightbox-zoom-out').disabled = !view.ready || !zoomed;
  }

  function fitImage(reset = false) {
    if (!stage || !largeImage || !view.ready || !dialog?.open) return;
    const padding = stage.clientWidth < 600 ? 14 : 26;
    const fit = Math.min(
      Math.max(1, stage.clientWidth - padding * 2) / view.naturalWidth,
      Math.max(1, stage.clientHeight - padding * 2) / view.naturalHeight
    );
    view.width = view.naturalWidth * fit;
    view.height = view.naturalHeight * fit;
    largeImage.style.width = `${view.width}px`;
    largeImage.style.height = `${view.height}px`;
    if (reset) { view.scale = 1; view.x = 0; view.y = 0; }
    renderView();
  }

  function setZoom(scale, clientX, clientY) {
    if (!view.ready || !stage) return;
    const next = Math.max(1, Math.min(MAX_ZOOM, scale));
    const box = stage.getBoundingClientRect();
    const focusX = clientX == null ? 0 : clientX - box.left - box.width / 2;
    const focusY = clientY == null ? 0 : clientY - box.top - box.height / 2;
    const ratio = next / view.scale;
    view.x = focusX - (focusX - view.x) * ratio;
    view.y = focusY - (focusY - view.y) * ratio;
    view.scale = next;
    renderView();
  }

  function clearGesture() {
    for (const id of pointers.keys()) {
      if (stage?.hasPointerCapture(id)) stage.releasePointerCapture(id);
    }
    pointers.clear();
    gesture = null;
    touchStart = null;
    stage?.classList.remove('is-dragging');
  }

  function showImage(index) {
    if (!gallery.length || !largeImage) return;
    imageIndex = (index + gallery.length) % gallery.length;
    const item = gallery[imageIndex];
    const request = ++imageRequest;
    clearGesture();
    view.ready = false;
    view.scale = 1;
    view.x = view.y = 0;
    renderView();
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
    const sources = [...new Set([item.viewer, item.full, item.src].filter(Boolean))];
    let sourceIndex = 0;
    preload.onload = async () => {
      if (request !== imageRequest) return;
      largeImage.src = preload.src;
      if (largeImage.decode) await largeImage.decode().catch(() => {});
      if (request !== imageRequest || !dialog?.open) return;
      view.naturalWidth = preload.naturalWidth;
      view.naturalHeight = preload.naturalHeight;
      view.ready = true;
      fitImage(true);
      largeImage.style.opacity = '';
      stage?.classList.remove('is-loading');
      stage?.setAttribute('aria-busy', 'false');
      if (imageStatus) imageStatus.textContent = '';
    };
    preload.onerror = () => {
      if (request !== imageRequest) return;
      if (++sourceIndex < sources.length) {
        preload.src = sources[sourceIndex];
        return;
      }
      stage?.classList.remove('is-loading');
      stage?.setAttribute('aria-busy', 'false');
      if (imageStatus) imageStatus.textContent = '图片暂时无法加载，请点击“原图”查看。';
    };
    preload.src = sources[0];
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
    clearGesture();
    view.ready = false;
    view.scale = 1;
    view.x = view.y = 0;
    renderView();
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
  $('#lightbox-zoom')?.addEventListener('click', () => setZoom(view.scale * 1.5));
  $('#lightbox-zoom-out')?.addEventListener('click', () => setZoom(view.scale / 1.5));
  $('#lightbox-fit')?.addEventListener('click', () => { clearGesture(); fitImage(true); });
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
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(view.scale * 1.25);
    } else if (event.key === '-') {
      event.preventDefault();
      setZoom(view.scale / 1.25);
    } else if (event.key === '0') {
      event.preventDefault();
      fitImage(true);
    } else if (event.key === 'ArrowLeft') {
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
  stage?.addEventListener('dblclick', (event) => {
    event.preventDefault();
    setZoom(zoomed ? 1 : 2.5, event.clientX, event.clientY);
  });
  stage?.addEventListener('wheel', (event) => {
    if (!view.ready) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
    const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
    setZoom(view.scale * Math.exp(-delta * 0.002), event.clientX, event.clientY);
  }, { passive: false });

  function beginGesture() {
    const points = [...pointers.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      gesture = { type: 'pinch', distance: Math.hypot(b.x - a.x, b.y - a.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      touchStart = null;
    } else if (points.length === 1) {
      gesture = { type: 'pan', x: points[0].x, y: points[0].y };
    } else gesture = null;
    stage?.classList.toggle('is-dragging', Boolean(gesture && zoomed));
  }
  stage?.addEventListener('pointerdown', (event) => {
    if (!view.ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.pointerType === 'mouse' && !zoomed) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);
    if (event.pointerType === 'touch' && !zoomed && pointers.size === 1) {
      touchStart = { x: event.clientX, y: event.clientY };
    }
    beginGesture();
  });
  stage?.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.values()];
    if (gesture.type === 'pinch' && points.length >= 2) {
      const [a, b] = points;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      setZoom(view.scale * distance / Math.max(1, gesture.distance), gesture.x, gesture.y);
      view.x += x - gesture.x;
      view.y += y - gesture.y;
      gesture = { type: 'pinch', distance, x, y };
      renderView();
    } else if (gesture.type === 'pan') {
      if (zoomed) {
        view.x += event.clientX - gesture.x;
        view.y += event.clientY - gesture.y;
        renderView();
      }
      gesture.x = event.clientX;
      gesture.y = event.clientY;
    }
  });
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const swipe = event.type === 'pointerup' && pointers.size === 1 && touchStart && !zoomed ? touchStart : null;
    pointers.delete(event.pointerId);
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    touchStart = null;
    beginGesture();
    if (swipe) {
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.5) showImage(imageIndex + (dx < 0 ? 1 : -1));
    }
  }
  stage?.addEventListener('pointerup', endPointer);
  stage?.addEventListener('pointercancel', endPointer);
  stage?.addEventListener('lostpointercapture', endPointer);
  largeImage?.addEventListener('dragstart', (event) => event.preventDefault());
  window.addEventListener('blur', clearGesture);
  if (stage && 'ResizeObserver' in window) new ResizeObserver(() => fitImage()).observe(stage);
  else window.addEventListener('resize', () => fitImage());

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
