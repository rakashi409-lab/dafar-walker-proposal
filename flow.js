(() => {
  'use strict';
  const data = window.PROPOSAL_DATA;
  if (!data?.transitions?.length) return;
  const assets = new Map(data.gallery.map((asset) => [asset.id, asset]));
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const panel = $('#route-panel');
  const stage = $('#flow-stage');
  const image = $('#flow-image');
  const outgoing = $('#flow-outgoing');
  const imageButton = $('#flow-image-button');
  const progress = $('#flow-progress');
  const tabs = $$('[data-route]');
  const DURATION = 3800;
  let routeIndex = 0;
  let stateIndex = 0;
  let playing = false;
  let chain = false;
  let transition = null;
  let frame = 0;
  let token = 0;
  let visible = false;
  let autoPreviewed = false;
  let pendingEdge = null;
  const text = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
  const route = () => data.transitions[routeIndex];
  const source = (state) => assets.get(state.assetId).src;

  function preload(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  function updateControls() {
    const done = !transition && stateIndex === route().states.length - 1;
    text('#flow-play-icon', playing ? 'Ⅱ' : done ? '↻' : '▶');
    text('#flow-play-label', playing ? '暂停演示' : done ? '重新播放' : transition ? '继续演示' : '播放转换过程');
    $('#flow-play').setAttribute('aria-label', playing ? '暂停转换演示' : done ? '重新播放转换过程' : '播放转换过程');
    $('#flow-play').setAttribute('aria-pressed', String(playing));
    $('#flow-prev').disabled = stateIndex === 0 && !transition;
    $('#flow-next').disabled = done;
    panel.classList.toggle('is-playing', playing);
    $('#flow-motion').style.animationPlayState = playing ? 'running' : 'paused';
  }

  function markPath(activeEdge = -1) {
    $$('.flow-node-button').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === stateIndex));
      button.closest('.flow-node').classList.toggle('is-current', index === stateIndex);
      button.closest('.flow-node').classList.toggle('is-past', index < stateIndex);
    });
    $$('.flow-connector').forEach((connector, index) => {
      connector.classList.toggle('is-active', index === activeEdge);
      connector.classList.toggle('is-past', index < stateIndex);
    });
  }

  function caption(index) {
    const r = route();
    const state = r.states[index];
    const tag = index === 0 ? '起始形态' : index === r.states.length - 1 ? '最终形态' : '中间状态';
    text('#flow-state-caption', `${tag} · ${state.title}`);
    text('#flow-state-index', `${String(index + 1).padStart(2, '0')} / ${String(r.states.length).padStart(2, '0')}`);
    imageButton.dataset.openImage = state.assetId;
    imageButton.setAttribute('aria-label', `放大查看流程形态：${state.title}`);
    image.alt = state.title;
  }

  function cancelTransition() {
    pendingEdge = null;
    token += 1;
    cancelAnimationFrame(frame);
    frame = 0;
    playing = false;
    transition = null;
    stage.removeAttribute('data-motion');
    panel.classList.remove('is-transitioning');
    image.style.opacity = '1';
    image.style.transform = '';
    outgoing.style.opacity = '0';
    outgoing.style.transform = '';
  }

  function showState(index, announce = true) {
    cancelTransition();
    stateIndex = Math.max(0, Math.min(route().states.length - 1, index));
    const state = route().states[stateIndex];
    image.src = source(state);
    outgoing.src = image.src;
    caption(stateIndex);
    text('#flow-operation-kicker', stateIndex === 0 ? 'START / 起始形态' : stateIndex === route().states.length - 1 ? 'COMPLETE / 转换完成' : `STATE ${String(stateIndex + 1).padStart(2, '0')} / 中间状态`);
    text('#flow-operation-title', state.title);
    text('#flow-operation-text', state.description);
    progress.style.transform = `scaleX(${stateIndex === route().states.length - 1 ? 1 : 0})`;
    markPath();
    updateControls();
    if (announce) text('#flow-announcement', `${route().title}，${state.title}`);
  }

  function pause() {
    token += 1;
    playing = false;
    cancelAnimationFrame(frame);
    frame = 0;
    if (transition) transition.last = 0;
    updateControls();
  }

  function paintTransition(p) {
    if (!transition) return;
    const blend = reduced.matches ? (p >= .5 ? 1 : 0) : Math.max(0, Math.min(1, (p - .28) / .38));
    const eased = blend * blend * (3 - 2 * blend);
    outgoing.style.opacity = String(1 - eased);
    image.style.opacity = String(eased);
    // The original design states dissolve into each other; motion arrows explain the operation.
    image.style.transform = `translateX(${(1 - eased) * 22}px)`;
    outgoing.style.transform = `translateX(${-eased * 22}px)`;
    progress.style.transform = `scaleX(${p})`;
    panel.style.setProperty('--flow-progress', p);
    if (p >= .47 && !transition.captionUpdated) {
      transition.captionUpdated = true;
      caption(transition.edge + 1);
    }
  }

  function tick(time) {
    frame = 0;
    if (!playing || !transition) return;
    if (transition.last) transition.elapsed += time - transition.last;
    transition.last = time;
    const p = Math.min(1, transition.elapsed / DURATION);
    paintTransition(p);
    if (p < 1) { frame = requestAnimationFrame(tick); return; }
    const destination = transition.edge + 1;
    const continuePlaying = chain && destination < route().states.length - 1;
    showState(destination);
    if (continuePlaying) beginEdge(destination, true);
  }

  async function beginEdge(edge, continuous) {
    if (edge < 0 || edge >= route().steps.length) return;
    showState(edge, false);
    chain = continuous;
    const currentToken = ++token;
    const r = route();
    const nextState = r.states[edge + 1];
    const nextSource = source(nextState);
    const ready = await preload(nextSource);
    if (currentToken !== token) return;
    if (!ready) { text('#flow-announcement', '图片暂时未加载，请稍后重试。'); return; }
    const step = r.steps[edge];
    outgoing.src = source(r.states[edge]);
    outgoing.style.opacity = '1';
    image.src = nextSource;
    image.style.opacity = '0';
    transition = { edge, elapsed: 0, last: 0, captionUpdated: false };
    text('#flow-operation-kicker', `STEP ${String(edge + 1).padStart(2, '0')} / ${String(r.steps.length).padStart(2, '0')}`);
    text('#flow-operation-title', step.title);
    text('#flow-operation-text', step.description);
    text('#flow-announcement', `第 ${edge + 1} 步，${step.description}`);
    stage.dataset.motion = step.motion;
    panel.classList.add('is-transitioning');
    markPath(edge);
    playing = true;
    updateControls();
    frame = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) { pause(); return; }
    chain = true;
    if (transition) {
      playing = true;
      transition.last = 0;
      updateControls();
      frame = requestAnimationFrame(tick);
    } else {
      if (stateIndex === route().states.length - 1) showState(0, false);
      beginEdge(stateIndex, true);
    }
  }

  function buildPath() {
    const r = route();
    const board = $('#route-steps');
    board.dataset.states = String(r.states.length);
    board.style.setProperty('--state-count', r.states.length);
    const fragment = document.createDocumentFragment();
    r.states.forEach((state, index) => {
      const node = document.createElement('article');
      node.className = 'flow-node';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'flow-node-button';
      button.dataset.flowState = String(index);
      button.setAttribute('aria-label', `查看第 ${index + 1} 个形态：${state.title}`);
      const img = document.createElement('img');
      img.src = source(state);
      img.alt = state.title;
      img.decoding = 'async';
      const label = document.createElement('span');
      label.className = 'flow-node-caption';
      const number = document.createElement('small');
      number.textContent = index === 0 ? 'START / 起始' : index === r.states.length - 1 ? 'END / 完成' : `0${index + 1} / 中间状态`;
      const title = document.createElement('strong');
      title.textContent = state.title;
      label.append(number, title);
      button.append(img, label);
      button.addEventListener('click', () => { autoPreviewed = true; showState(index); revealPlayer(); });
      node.append(button);
      fragment.append(node);
      if (index >= r.steps.length) return;
      const step = r.steps[index];
      const edge = document.createElement('button');
      edge.type = 'button';
      edge.className = 'flow-connector';
      edge.dataset.flowEdge = String(index);
      edge.setAttribute('aria-label', `演示第 ${index + 1} 步：${step.description}`);
      const count = document.createElement('small');
      count.textContent = `0${index + 1}`;
      const arrow = document.createElement('span');
      arrow.className = 'flow-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      const arrowFill = document.createElement('i');
      arrow.append(arrowFill);
      const description = document.createElement('span');
      description.className = 'flow-edge-description';
      description.textContent = step.description;
      edge.append(count, arrow, description);
      edge.addEventListener('click', () => {
        autoPreviewed = true;
        showState(index, false);
        revealPlayer();
        if (visible) beginEdge(index, false);
        else pendingEdge = index;
      });
      fragment.append(edge);
    });
    board.replaceChildren(fragment);
  }

  function revealPlayer() {
    const player = $('.flow-player');
    const bounds = player.getBoundingClientRect();
    const header = $('.header').getBoundingClientRect().bottom;
    if (bounds.top < header || bounds.bottom > innerHeight) {
      player.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    }
  }

  function selectRoute(index, auto = true) {
    if (!data.transitions[index]) return;
    routeIndex = index;
    tabs.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[index].id);
    text('#route-title', route().title);
    text('#flow-route-count', `${route().states.length} 个形态 / ${route().steps.length} 次转换`);
    buildPath();
    showState(0, false);
    route().states.forEach((state) => preload(source(state)));
    if (!reduced.matches && panel.animate) {
      panel.animate([{ opacity: .35, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    if (auto && visible && !reduced.matches) beginEdge(0, true);
  }
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => selectRoute(index));
    button.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus({ preventScroll: true });
      selectRoute(next);
    });
  });
  $('#flow-play').addEventListener('click', play);
  $('#flow-prev').addEventListener('click', () => showState(transition ? transition.edge : Math.max(0, stateIndex - 1)));
  $('#flow-next').addEventListener('click', () => {
    if (transition) showState(transition.edge + 1);
    else beginEdge(stateIndex, false);
  });
  imageButton.addEventListener('click', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('click', (event) => { if (event.target.closest?.('[data-open-image]')) pause(); });
  reduced.addEventListener?.('change', () => { if (reduced.matches) showState(stateIndex); });
  selectRoute(0, false);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .45;
      if (!visible) { pause(); return; }
      if (pendingEdge !== null) {
        const edge = pendingEdge;
        pendingEdge = null;
        beginEdge(edge, false);
        return;
      }
      if (!autoPreviewed && !reduced.matches) {
        autoPreviewed = true;
        beginEdge(0, true);
      }
    }, { threshold: .45 }).observe($('.flow-player'));
  }
})();
