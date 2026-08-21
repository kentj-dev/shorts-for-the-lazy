(() => {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({ enabled: true, badgeEnabled: true, delaySeconds: 0 });
  const END_THRESHOLD_SECONDS = 0.16;
  const END_MONITOR_WINDOW_SECONDS = 1;
  const FALLBACK_INTERVAL_MS = 500;
  const IDLE_FALLBACK_INTERVAL_MS = 2000;
  const ACTIVE_VIDEO_CHANGE_DEBOUNCE_MS = 80;
  const NAVIGATION_VERIFY_MS = 900;
  const RELEVANT_MUTATION_SELECTOR =
    'video, ytd-shorts, ytd-reel-video-renderer, .navigation-container, #navigation-button-down';

  let settings = { ...DEFAULT_SETTINGS };
  let watchedVideo = null;
  let watchedShortKey = '';
  let hasTriggeredForCurrentShort = false;
  let pendingAdvanceTimer = null;
  let rescanTimer = null;
  let endMonitorFrame = null;
  let lastBadgeText = null;
  let extensionContextValid = true;
  let observer = null;
  let fallbackTimer = null;
  let statusHost = null;
  let statusButton = null;

  function isShortsPage() {
    return location.pathname.startsWith('/shorts/');
  }

  function updateBadge(video = watchedVideo) {
    let text = '';
    if (settings.enabled && settings.badgeEnabled && isShortsPage() && video && Number.isFinite(video.duration)) {
      const remainingSeconds = Math.max(0, Math.ceil(video.duration - video.currentTime));
      text = remainingSeconds > 999 ? '999+' : String(remainingSeconds);
    }
    if (text === lastBadgeText || !extensionContextValid) return;
    lastBadgeText = text;
    try {
      if (!chrome.runtime?.id) {
        deactivateStaleInstance();
        return;
      }
      const messageResult = chrome.runtime.sendMessage({ type: 'SET_BADGE', text });
      messageResult?.catch?.(() => {
        if (!chrome.runtime?.id) deactivateStaleInstance();
      });
    } catch {
      deactivateStaleInstance();
    }
  }

  function deactivateStaleInstance() {
    if (!extensionContextValid) return;
    extensionContextValid = false;
    settings.enabled = false;
    updateInjectedStatus();
    cancelPendingAdvance({ rearm: true });
    stopEndMonitor();
    unwatchVideo();
    observer?.disconnect();
    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    clearTimeout(rescanTimer);
    removeEventListener('scroll', scheduleRefresh);
    removeEventListener('resize', scheduleRefresh);
    removeEventListener('yt-navigate-finish', scheduleRefresh);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  function handleBadgeProgress() {
    updateBadge(watchedVideo);
  }

  function isElementVisible(element) {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    return visibleWidth * visibleHeight > rect.width * rect.height * 0.2;
  }

  function scoreVideo(video) {
    if (!isElementVisible(video)) return -Infinity;

    const rect = video.getBoundingClientRect();
    const viewportCenterX = innerWidth / 2;
    const viewportCenterY = innerHeight / 2;
    const videoCenterX = rect.left + rect.width / 2;
    const videoCenterY = rect.top + rect.height / 2;
    const centerDistance = Math.hypot(
      (videoCenterX - viewportCenterX) / Math.max(innerWidth, 1),
      (videoCenterY - viewportCenterY) / Math.max(innerHeight, 1),
    );
    const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const visibleRatio = (visibleWidth * visibleHeight) / Math.max(rect.width * rect.height, 1);

    let score = visibleRatio * 100 - centerDistance * 45;
    if (!video.paused && !video.ended) score += 55;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) score += 8;
    if (video.closest('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]')) score += 100;
    return score;
  }

  function findActiveVideo() {
    if (!isShortsPage()) return null;
    const candidates = [...document.querySelectorAll('video')];
    let bestVideo = null;
    let bestScore = -Infinity;
    for (const video of candidates) {
      const score = scoreVideo(video);
      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    }
    return bestScore > 10 ? bestVideo : null;
  }

  function getShortKey(video) {
    const renderer = video?.closest('ytd-reel-video-renderer');
    const link = renderer?.querySelector('a[href^="/shorts/"]');
    const idFromLink = link?.getAttribute('href')?.split(/[?#]/)[0];
    return idFromLink || location.pathname;
  }

  function removeInjectedStatus() {
    statusHost?.remove();
    statusHost = null;
    statusButton = null;
  }

  function updateInjectedStatus() {
    if (!statusButton) return;
    const state = !extensionContextValid ? 'refresh' : settings.enabled ? 'active' : 'paused';
    statusButton.dataset.state = state;
    statusButton.setAttribute('aria-pressed', String(settings.enabled));
    const description = state === 'refresh'
      ? 'Refresh this tab to reconnect the extension'
      : state === 'active'
        ? 'Pause auto-scroll'
        : 'Resume auto-scroll';
    statusButton.setAttribute('aria-label', description);
    statusButton.removeAttribute('title');
    const label = statusButton.querySelector('.label');
    if (label) label.textContent = state === 'refresh' ? 'Refresh' : state === 'active' ? 'Auto Scroll' : 'Paused';
    const tooltip = statusButton.querySelector('.tooltip');
    if (tooltip) tooltip.textContent = description;
  }

  function createInjectedStatus() {
    let downUrl;
    let pauseUrl;
    let refreshUrl;
    try {
      downUrl = chrome.runtime.getURL('images/down.svg');
      pauseUrl = chrome.runtime.getURL('images/pause.svg');
      refreshUrl = chrome.runtime.getURL('images/refresh.svg');
    } catch {
      deactivateStaleInstance();
      return null;
    }

    const host = document.createElement('div');
    host.id = 'shorts-for-lazy-status-host';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { position: relative; z-index: 20; display: block; width: 56px; height: 56px; overflow: visible; font-family: Roboto, Arial, sans-serif; pointer-events: auto !important; }
        button { position: relative; z-index: 1; display: grid; width: 56px; height: 56px; margin: 0; padding: 0; place-items: center; border: 0; color: white; background: transparent; cursor: pointer; pointer-events: auto !important; touch-action: manipulation; }
        .circle { display: grid; width: 56px; height: 56px; place-items: center; border-radius: 50%; background: rgba(255,255,255,.1); transition: background .15s, transform .15s; }
        button:hover .circle { background: rgba(255,255,255,.2); }
        button:active .circle { transform: scale(.94); }
        img { display: none; width: 24px; height: 24px; filter: brightness(0) invert(1); }
        button[data-state="active"] .down, button[data-state="paused"] .pause, button[data-state="refresh"] .refresh { display: block; }
        .label { display: none; }
        .tooltip { position: absolute; z-index: 10; top: 10px; right: 66px; width: max-content; max-width: 180px; padding: 8px 10px; border-radius: 4px; color: white; background: rgba(80,80,80,.96); font-size: 12px; font-weight: 500; line-height: 16px; pointer-events: none; opacity: 0; transform: translateX(4px); transition: opacity .12s, transform .12s; }
        button:hover .tooltip, button:focus-visible .tooltip { opacity: 1; transform: translateX(0); }
      </style>
      <button type="button" data-state="active">
        <span class="circle">
          <img class="down" src="${downUrl}" alt="">
          <img class="pause" src="${pauseUrl}" alt="">
          <img class="refresh" src="${refreshUrl}" alt="">
        </span>
        <span class="label">Auto Scroll</span>
        <span class="tooltip" role="tooltip">Pause auto-scroll</span>
      </button>`;

    const button = shadow.querySelector('button');
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!extensionContextValid) {
        location.reload();
        return;
      }
      const nextEnabled = !settings.enabled;
      settings.enabled = nextEnabled;
      updateInjectedStatus();
      try {
        await chrome.storage.sync.set({ enabled: nextEnabled });
      } catch {
        deactivateStaleInstance();
      }
    });
    statusButton = button;
    return host;
  }

  function ensureInjectedStatus() {
    if (!isShortsPage()) {
      removeInjectedStatus();
      return;
    }
    if (!extensionContextValid) return;
    const navigationContainer = document.querySelector('ytd-shorts .navigation-container');
    const downButton = navigationContainer?.querySelector('#navigation-button-down');
    if (!navigationContainer || !downButton) return;

    if (!statusHost) statusHost = createInjectedStatus();
    if (!statusHost) return;
    if (statusHost.parentElement !== navigationContainer || statusHost.nextElementSibling !== downButton) {
      navigationContainer.insertBefore(statusHost, downButton);
    }
    updateInjectedStatus();
  }

  function cancelPendingAdvance({ rearm = false } = {}) {
    if (pendingAdvanceTimer !== null) {
      clearTimeout(pendingAdvanceTimer);
      pendingAdvanceTimer = null;
      if (rearm) hasTriggeredForCurrentShort = false;
    }
  }

  function stopEndMonitor() {
    if (endMonitorFrame !== null) {
      cancelAnimationFrame(endMonitorFrame);
      endMonitorFrame = null;
    }
  }

  function monitorVideoEnd() {
    endMonitorFrame = null;
    const video = watchedVideo;
    if (!settings.enabled || !isShortsPage() || !video || video.paused || hasTriggeredForCurrentShort) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const remaining = video.duration - video.currentTime;
    if (remaining >= 0 && remaining <= END_THRESHOLD_SECONDS) {
      scheduleAdvance();
      return;
    }
    if (remaining > END_THRESHOLD_SECONDS && remaining <= END_MONITOR_WINDOW_SECONDS) {
      endMonitorFrame = requestAnimationFrame(monitorVideoEnd);
    }
  }

  function unwatchVideo() {
    stopEndMonitor();
    if (watchedVideo) {
      watchedVideo.removeEventListener('timeupdate', handleVideoProgress);
      watchedVideo.removeEventListener('durationchange', handleVideoProgress);
      watchedVideo.removeEventListener('playing', handleVideoProgress);
      watchedVideo.removeEventListener('timeupdate', handleBadgeProgress);
      watchedVideo.removeEventListener('durationchange', handleBadgeProgress);
    }
    watchedVideo = null;
    updateBadge(null);
  }

  function watchVideo(video) {
    const nextKey = video ? getShortKey(video) : '';
    const videoChanged = video !== watchedVideo;
    const shortChanged = nextKey !== watchedShortKey;
    if (!videoChanged && !shortChanged) return;

    cancelPendingAdvance();
    unwatchVideo();
    watchedVideo = video;
    watchedShortKey = nextKey;
    hasTriggeredForCurrentShort = false;

    if (video) {
      video.addEventListener('timeupdate', handleVideoProgress, { passive: true });
      video.addEventListener('durationchange', handleVideoProgress, { passive: true });
      video.addEventListener('playing', handleVideoProgress, { passive: true });
      video.addEventListener('timeupdate', handleBadgeProgress, { passive: true });
      video.addEventListener('durationchange', handleBadgeProgress, { passive: true });
      updateBadge(video);
      handleVideoProgress();
    }
  }

  function refreshActiveVideo() {
    if (!isShortsPage()) {
      cancelPendingAdvance();
      unwatchVideo();
      watchedShortKey = '';
      hasTriggeredForCurrentShort = false;
      removeInjectedStatus();
      return;
    }
    watchVideo(findActiveVideo());
    ensureInjectedStatus();
  }

  function scheduleRefresh() {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(refreshActiveVideo, ACTIVE_VIDEO_CHANGE_DEBOUNCE_MS);
  }

  function mutationAffectsShorts(records) {
    if (watchedVideo && !watchedVideo.isConnected) return true;
    for (const record of records) {
      if ([...record.removedNodes].includes(statusHost)) return true;
      for (const node of [...record.addedNodes, ...record.removedNodes]) {
        if (node.nodeType !== Node.ELEMENT_NODE || node === statusHost) continue;
        if (node.matches(RELEVANT_MUTATION_SELECTOR) || node.querySelector(RELEVANT_MUTATION_SELECTOR)) return true;
      }
    }
    return false;
  }

  function handleMutations(records) {
    if (mutationAffectsShorts(records)) scheduleRefresh();
  }

  function scheduleFallbackCheck() {
    if (!extensionContextValid) return;
    const activeInterval = isShortsPage() && !document.hidden
      ? FALLBACK_INTERVAL_MS
      : IDLE_FALLBACK_INTERVAL_MS;
    fallbackTimer = setTimeout(() => {
      refreshActiveVideo();
      handleVideoProgress();
      scheduleFallbackCheck();
    }, activeInterval);
  }

  function handleVisibilityChange() {
    if (document.hidden) stopEndMonitor();
    else {
      refreshActiveVideo();
      handleVideoProgress();
    }
  }

  function handleVideoProgress() {
    const video = watchedVideo;
    if (!settings.enabled || !isShortsPage() || !video || video.paused || hasTriggeredForCurrentShort) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const remaining = video.duration - video.currentTime;
    updateBadge(video);
    if (remaining < 0 || remaining > END_MONITOR_WINDOW_SECONDS) return;
    if (remaining > END_THRESHOLD_SECONDS) {
      if (endMonitorFrame === null) endMonitorFrame = requestAnimationFrame(monitorVideoEnd);
      return;
    }

    scheduleAdvance();
  }

  function scheduleAdvance() {
    const video = watchedVideo;
    if (!video || video.paused || hasTriggeredForCurrentShort) return;
    stopEndMonitor();
    hasTriggeredForCurrentShort = true;
    const scheduledVideo = video;
    const scheduledKey = watchedShortKey;
    pendingAdvanceTimer = setTimeout(
      () => {
        pendingAdvanceTimer = null;
        if (!settings.enabled || !isShortsPage()) return;
        if (watchedVideo !== scheduledVideo || watchedShortKey !== scheduledKey) return;
        if (scheduledVideo.paused) {
          hasTriggeredForCurrentShort = false;
          return;
        }
        goToNextShort(scheduledVideo, scheduledKey);
      },
      Math.round(settings.delaySeconds * 1000),
    );
  }

  function findNextButton() {
    const selectors = [
      'ytd-shorts #navigation-button-down button',
      'ytd-shorts #navigation-button-down',
      'ytd-reel-video-renderer[is-active] #navigation-button-down button',
      '#navigation-button-down button',
      "button[aria-label='Next video']",
      "button[aria-label='Next']",
    ];
    for (const selector of selectors) {
      const button = [...document.querySelectorAll(selector)].find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        const overlapsViewport = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        return (
          candidate.isConnected &&
          overlapsViewport &&
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          !candidate.disabled
        );
      });
      if (button) return button;
    }
    return null;
  }

  function findScrollableAncestor(element) {
    for (let current = element?.parentElement; current && current !== document.body; current = current.parentElement) {
      const overflowY = getComputedStyle(current).overflowY;
      if (/(auto|scroll)/.test(overflowY) && current.scrollHeight > current.clientHeight + 10) return current;
    }
    return null;
  }

  function scrollToNextShort(video) {
    const renderer = video?.closest('ytd-reel-video-renderer');
    let nextRenderer = renderer?.nextElementSibling;
    while (nextRenderer && nextRenderer.tagName !== 'YTD-REEL-VIDEO-RENDERER') {
      nextRenderer = nextRenderer.nextElementSibling;
    }
    if (nextRenderer) {
      nextRenderer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const scrollContainer = findScrollableAncestor(renderer || video);
    const distance = scrollContainer
      ? scrollContainer.clientHeight
      : Math.max(document.documentElement.clientHeight, innerHeight);
    if (scrollContainer) scrollContainer.scrollBy({ top: distance, behavior: 'smooth' });
    else window.scrollBy({ top: distance, behavior: 'smooth' });
  }

  function goToNextShort(sourceVideo, sourceKey) {
    const nextButton = findNextButton();
    if (nextButton) {
      nextButton.click();
      setTimeout(() => {
        refreshActiveVideo();
        if (watchedVideo === sourceVideo && watchedShortKey === sourceKey) scrollToNextShort(sourceVideo);
      }, NAVIGATION_VERIFY_MS);
      return;
    }
    scrollToNextShort(sourceVideo);
  }

  async function loadSettings() {
    try {
      const saved = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      settings.enabled = saved.enabled !== false;
      settings.badgeEnabled = saved.badgeEnabled !== false;
      settings.delaySeconds = Math.min(5, Math.max(0, Number(saved.delaySeconds) || 0));
    } catch (error) {
      console.warn('Shorts Auto Scroll: could not load settings', error);
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
    if (changes.badgeEnabled) settings.badgeEnabled = changes.badgeEnabled.newValue !== false;
    if (changes.delaySeconds) {
      settings.delaySeconds = Math.min(5, Math.max(0, Number(changes.delaySeconds.newValue) || 0));
      cancelPendingAdvance({ rearm: true });
    }
    if (!settings.enabled) {
      cancelPendingAdvance({ rearm: true });
      stopEndMonitor();
      updateBadge();
    } else {
      updateBadge();
      handleVideoProgress();
    }
    if (changes.badgeEnabled) updateBadge();
    if (changes.enabled) updateInjectedStatus();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_STATUS') {
      sendResponse({
        onShortsPage: isShortsPage(),
        videoDetected: Boolean(watchedVideo),
        enabled: settings.enabled,
      });
    }
  });

  observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('scroll', scheduleRefresh, { passive: true });
  addEventListener('resize', scheduleRefresh, { passive: true });
  addEventListener('yt-navigate-finish', scheduleRefresh);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  loadSettings().finally(() => {
    refreshActiveVideo();
    scheduleFallbackCheck();
  });
})();
