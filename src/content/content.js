import { isVideoId } from "@/shared/history";
import { parseSettings, skipRange, SYNC_SETTING_KEYS } from "@/shared/settings";

(() => {
    "use strict";

    /*
     * Timings below are in real (wall-clock) seconds. At a playback speed
     * other than 1x, a Short's remaining time and length are divided by its
     * rate, so a 30-second Short at 2x counts down from 15.
     */
    const END_THRESHOLD_SECONDS = 0.16;
    const END_MONITOR_WINDOW_SECONDS = 1;
    const FALLBACK_INTERVAL_MS = 500;
    const IDLE_FALLBACK_INTERVAL_MS = 2000;
    const ACTIVE_VIDEO_CHANGE_DEBOUNCE_MS = 80;
    const NAVIGATION_VERIFY_MS = 900;
    /*
     * A Short counts as watched once this share of its length has actually
     * played, so swiping past one doesn't count, and a 60-second Short asks
     * for more than a 10-second one. Keep in step with the Lazyboard's
     * anti-cheat (min_seconds_per_short).
     */
    const WATCHED_FRACTION = 0.5;
    const MIN_WATCHED_SECONDS = 1;
    /** Used only while a Short's length is still unknown. */
    const UNKNOWN_LENGTH_WATCHED_SECONDS = 10;
    const WATCH_TIME_FLUSH_SECONDS = 5;
    const MAX_PLAYBACK_SAMPLE_SECONDS = 2;
    /**
     * YouTube sets its own rate while a Short loads, so the chosen speed is
     * re-applied for this long. After that it is left alone, and a speed
     * picked in YouTube's own menu stands for the rest of that Short.
     */
    const SPEED_SETTLE_SECONDS = 1;
    const RELEVANT_MUTATION_SELECTOR =
        "video, ytd-shorts, ytd-reel-video-renderer, .navigation-container, #navigation-button-down";
    /* YouTube renames these often; the first that matches wins. */
    const TITLE_SELECTORS = [
        "yt-shorts-video-title-view-model h2",
        ".ytShortsVideoTitleViewModelShortsVideoTitle",
        "ytd-reel-player-header-renderer h2",
        "#video-title",
    ];
    const CHANNEL_SELECTORS = [
        "yt-reel-channel-bar-view-model a",
        ".ytReelChannelBarViewModelChannelName a",
        "ytd-channel-name a",
        "#channel-name a",
    ];

    let settings = parseSettings({});
    /** Raw sync values, so one changed key can be re-parsed with the rest. */
    let storedSettings = {};
    let watchedVideo = null;
    let watchedShortKey = "";
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
    let statusCountdown = null;
    let currentShortWatchSeconds = 0;
    let countedCurrentShort = false;
    let pendingWatchSeconds = 0;
    let lastPlaybackSample = null;
    let playbackWasActive = false;
    /** Times the current Short has reached its end, for the loop count. */
    let completedPlays = 0;
    /** Set at the end of a play, cleared once the Short loops back. */
    let endReachedThisPass = false;
    /** False while a reused video element still reports the last Short's length. */
    let metadataFresh = false;
    let skipCheckedForCurrentShort = false;
    /** Shorts skipped for their length; scrolling back to one plays it. */
    const skippedShortKeys = new Set();
    /** Elements given a non-default speed, so going back to 1x can undo it. */
    const speedChangedVideos = new WeakSet();
    /** The Short paused because its tab was hidden, to resume on return. */
    let pausedWhileHidden = null;
    let pausedWhileHiddenKey = "";
    /*
     * A session runs from page load, or from auto-scroll being turned back
     * on, until a session limit ends it.
     */
    let sessionShorts = 0;
    let sessionWatchSeconds = 0;
    let sessionLimitReached = false;

    function isShortsPage() {
        return location.pathname.startsWith("/shorts/");
    }

    function playbackRateOf(video) {
        const rate = video?.playbackRate;
        return Number.isFinite(rate) && rate > 0 ? rate : 1;
    }

    /** Real seconds left at the current speed. */
    function remainingSeconds(video) {
        return (video.duration - video.currentTime) / playbackRateOf(video);
    }

    /** Real seconds one play takes at the current speed. */
    function effectiveLength(video) {
        return video.duration / playbackRateOf(video);
    }

    function updateBadge(video = watchedVideo) {
        let text = "";
        if (
            settings.enabled &&
            settings.badgeEnabled &&
            isShortsPage() &&
            video &&
            Number.isFinite(video.duration)
        ) {
            const remaining = Math.max(0, Math.ceil(remainingSeconds(video)));
            text = remaining > 999 ? "999+" : String(remaining);
        }
        updateInjectedCountdown(video);
        if (text === lastBadgeText || !extensionContextValid) return;
        lastBadgeText = text;
        try {
            if (!chrome.runtime?.id) {
                deactivateStaleInstance();
                return;
            }
            const messageResult = chrome.runtime.sendMessage({
                type: "SET_BADGE",
                text,
            });
            messageResult?.catch?.(() => {
                if (!chrome.runtime?.id) deactivateStaleInstance();
            });
        } catch {
            deactivateStaleInstance();
        }
    }

    function updateInjectedCountdown(video = watchedVideo) {
        if (!statusCountdown) return;
        const shouldShow =
            extensionContextValid &&
            settings.enabled &&
            isShortsPage() &&
            video &&
            Number.isFinite(video.duration) &&
            video.duration > 0;
        statusCountdown.textContent = shouldShow
            ? String(Math.max(0, Math.ceil(remainingSeconds(video))))
            : "";
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
        removeEventListener("scroll", scheduleRefresh);
        removeEventListener("resize", scheduleRefresh);
        removeEventListener("yt-navigate-finish", scheduleRefresh);
        removeEventListener("keydown", handleShortcut, true);
        document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange,
        );
    }

    function handleBadgeProgress() {
        updateBadge(watchedVideo);
    }

    function sendToWorker(message) {
        if (!extensionContextValid) return;
        try {
            const result = chrome.runtime.sendMessage(message);
            result?.catch?.(() => {
                if (!chrome.runtime?.id) deactivateStaleInstance();
            });
        } catch {
            deactivateStaleInstance();
        }
    }

    function sendStats(delta) {
        sendToWorker({ type: "ADD_DAILY_STATS", delta });
    }

    function shortIdOf(key) {
        const id = /\/shorts\/([^/?#]+)/.exec(key)?.[1];
        return isVideoId(id) ? id : "";
    }

    function firstText(root, selectors) {
        for (const selector of selectors) {
            const text = root?.querySelector(selector)?.textContent?.trim();
            if (text) return text;
        }
        return "";
    }

    /** Title and channel as the page shows them; either may come back empty. */
    function readShortDetails(video, key) {
        const renderer =
            video?.closest("ytd-reel-video-renderer") ||
            document.querySelector("ytd-reel-video-renderer[is-active]");
        let title = firstText(renderer, TITLE_SELECTORS);
        // The tab title follows the URL, so it is only trusted once they agree.
        if (!title && location.pathname === key) {
            title = document.title.replace(/\s*-\s*YouTube$/, "").trim();
            if (title === "YouTube") title = "";
        }
        return { title, channel: firstText(renderer, CHANNEL_SELECTORS) };
    }

    function recordRecentShort(video) {
        if (!settings.historyEnabled) return;
        const id = shortIdOf(watchedShortKey);
        if (!id) return;
        sendToWorker({
            type: "ADD_RECENT_SHORT",
            short: {
                id,
                ...readShortDetails(video, watchedShortKey),
                lengthSeconds: Number.isFinite(video.duration)
                    ? video.duration
                    : 0,
            },
        });
    }

    function flushWatchTime() {
        if (pendingWatchSeconds <= 0) return;
        const watchSeconds = pendingWatchSeconds;
        pendingWatchSeconds = 0;
        sendStats({ watchSeconds });
    }

    function isVideoActivelyPlaying(video) {
        return Boolean(
            video &&
            !video.paused &&
            !video.ended &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            !document.hidden &&
            isShortsPage() &&
            video === watchedVideo,
        );
    }

    /**
     * Real seconds of playback after which `video` counts as watched. Half
     * of a sped-up Short takes less real time, but never under
     * MIN_WATCHED_SECONDS, which keeps the Lazyboard's anti-cheat satisfied.
     */
    function watchedThreshold(video) {
        const duration = video?.duration;
        if (!Number.isFinite(duration) || duration <= 0)
            return UNKNOWN_LENGTH_WATCHED_SECONDS;
        return Math.max(
            MIN_WATCHED_SECONDS,
            effectiveLength(video) * WATCHED_FRACTION,
        );
    }

    function samplePlaybackTime() {
        const now = performance.now();
        if (playbackWasActive && lastPlaybackSample !== null) {
            const elapsed = Math.min(
                MAX_PLAYBACK_SAMPLE_SECONDS,
                Math.max(0, (now - lastPlaybackSample) / 1000),
            );
            pendingWatchSeconds += elapsed;
            currentShortWatchSeconds += elapsed;
            sessionWatchSeconds += elapsed;
        }

        lastPlaybackSample = now;
        playbackWasActive = isVideoActivelyPlaying(watchedVideo);

        if (
            !countedCurrentShort &&
            watchedVideo &&
            currentShortWatchSeconds >= watchedThreshold(watchedVideo)
        ) {
            countedCurrentShort = true;
            sessionShorts += 1;
            sendStats({ shortsWatched: 1 });
            recordRecentShort(watchedVideo);
        }
        if (pendingWatchSeconds >= WATCH_TIME_FLUSH_SECONDS) flushWatchTime();
    }

    function isElementVisible(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 100) return false;
        const style = getComputedStyle(element);
        if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
        ) {
            return false;
        }
        const visibleWidth = Math.max(
            0,
            Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
        );
        const visibleHeight = Math.max(
            0,
            Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
        );
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
        const visibleWidth = Math.max(
            0,
            Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
        );
        const visibleHeight = Math.max(
            0,
            Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
        );
        const visibleRatio =
            (visibleWidth * visibleHeight) /
            Math.max(rect.width * rect.height, 1);

        let score = visibleRatio * 100 - centerDistance * 45;
        if (!video.paused && !video.ended) score += 55;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) score += 8;
        if (
            video.closest(
                "ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]",
            )
        )
            score += 100;
        return score;
    }

    function findActiveVideo() {
        if (!isShortsPage()) return null;
        const candidates = [...document.querySelectorAll("video")];
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
        const renderer = video?.closest("ytd-reel-video-renderer");
        const link = renderer?.querySelector('a[href^="/shorts/"]');
        const idFromLink = link?.getAttribute("href")?.split(/[?#]/)[0];
        return idFromLink || location.pathname;
    }

    function removeInjectedStatus() {
        statusHost?.remove();
        statusHost = null;
        statusButton = null;
        statusCountdown = null;
    }

    function updateInjectedStatus() {
        if (!statusButton) return;
        const state = !extensionContextValid
            ? "refresh"
            : settings.enabled
              ? "active"
              : "paused";
        statusButton.dataset.state = state;
        statusButton.setAttribute("aria-pressed", String(settings.enabled));
        const description =
            state === "refresh"
                ? "Refresh this tab to reconnect the extension"
                : state === "active"
                  ? "Pause auto-scroll"
                  : sessionLimitReached
                    ? "Session limit reached. Resume auto-scroll"
                    : "Resume auto-scroll";
        statusButton.setAttribute("aria-label", description);
        statusButton.removeAttribute("title");
        const label = statusButton.querySelector(".label");
        if (label)
            label.textContent =
                state === "refresh"
                    ? "Refresh"
                    : state === "active"
                      ? "Auto Scroll"
                      : "Paused";
        const tooltip = statusButton.querySelector(".tooltip");
        if (tooltip) tooltip.textContent = description;
    }

    function createInjectedStatus() {
        let downUrl;
        let pauseUrl;
        let refreshUrl;
        try {
            downUrl = chrome.runtime.getURL("images/down.svg");
            pauseUrl = chrome.runtime.getURL("images/pause.svg");
            refreshUrl = chrome.runtime.getURL("images/refresh.svg");
        } catch {
            deactivateStaleInstance();
            return null;
        }

        const host = document.createElement("div");
        host.id = "shorts-for-lazy-status-host";
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `
      <style>
        :host { position: relative; z-index: 20; display: block; width: 56px; height: 56px; overflow: visible; font-family: Roboto, Arial, sans-serif; pointer-events: auto !important; }
        button { position: relative; z-index: 1; display: grid; width: 56px; height: 56px; margin: 0; padding: 0; place-items: center; border: 0; color: white; background: transparent; cursor: pointer; pointer-events: auto !important; touch-action: manipulation; }
        .circle { position: relative; display: grid; width: 56px; height: 56px; place-items: center; border-radius: 50%; background: rgba(255,255,255,.1); transition: background .15s, transform .15s; }
        button:hover .circle { background: rgba(255,255,255,.2); }
        button:active .circle { transform: scale(.94); }
        img { display: none; width: 24px; height: 24px; filter: brightness(0) invert(1); }
        button[data-state="active"] .down, button[data-state="paused"] .pause, button[data-state="refresh"] .refresh { display: block; }
        button[data-state="active"] .down { transform: translateY(-6px); }
        .countdown { position: absolute; top: 35px; left: 50%; min-width: 24px; color: white; font-size: 11px; font-weight: 600; line-height: 12px; text-align: center; transform: translateX(-50%); }
        button:not([data-state="active"]) .countdown, .countdown:empty { display: none; }
        .label { display: none; }
        .tooltip { position: absolute; z-index: 10; top: 10px; right: 66px; width: max-content; max-width: 180px; padding: 8px 10px; border-radius: 4px; color: white; background: rgba(80,80,80,.96); font-size: 12px; font-weight: 500; line-height: 16px; pointer-events: none; opacity: 0; transform: translateX(4px); transition: opacity .12s, transform .12s; }
        button:hover .tooltip, button:focus-visible .tooltip { opacity: 1; transform: translateX(0); }
      </style>
      <button type="button" data-state="active">
        <span class="circle">
          <img class="down" src="${downUrl}" alt="">
          <img class="pause" src="${pauseUrl}" alt="">
          <img class="refresh" src="${refreshUrl}" alt="">
          <span class="countdown" aria-hidden="true"></span>
        </span>
        <span class="label">Auto Scroll</span>
        <span class="tooltip" role="tooltip">Pause auto-scroll</span>
      </button>`;

        const button = shadow.querySelector("button");
        button.addEventListener("pointerdown", (event) =>
            event.stopPropagation(),
        );
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!extensionContextValid) {
                location.reload();
                return;
            }
            const nextEnabled = !settings.enabled;
            settings.enabled = nextEnabled;
            if (nextEnabled) startSession();
            updateInjectedStatus();
            try {
                await chrome.storage.sync.set({ enabled: nextEnabled });
            } catch {
                deactivateStaleInstance();
            }
        });
        statusButton = button;
        statusCountdown = shadow.querySelector(".countdown");
        updateInjectedCountdown();
        return host;
    }

    function ensureInjectedStatus() {
        if (!isShortsPage()) {
            removeInjectedStatus();
            return;
        }
        if (!extensionContextValid) return;
        const navigationContainer = document.querySelector(
            "ytd-shorts .navigation-container",
        );
        const downButton = navigationContainer?.querySelector(
            "#navigation-button-down",
        );
        if (!navigationContainer || !downButton) return;

        if (!statusHost) statusHost = createInjectedStatus();
        if (!statusHost) return;
        if (
            statusHost.parentElement !== navigationContainer ||
            statusHost.nextElementSibling !== downButton
        ) {
            navigationContainer.insertBefore(statusHost, downButton);
        }
        updateInjectedStatus();
        updateInjectedCountdown();
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
        if (
            !settings.enabled ||
            !isShortsPage() ||
            !video ||
            video.paused ||
            hasTriggeredForCurrentShort
        )
            return;
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;

        const remaining = remainingSeconds(video);
        if (remaining >= 0 && remaining <= END_THRESHOLD_SECONDS) {
            handleReachedEnd();
            return;
        }
        if (
            remaining > END_THRESHOLD_SECONDS &&
            remaining <= END_MONITOR_WINDOW_SECONDS
        ) {
            endMonitorFrame = requestAnimationFrame(monitorVideoEnd);
        }
    }

    function unwatchVideo() {
        samplePlaybackTime();
        flushWatchTime();
        stopEndMonitor();
        if (watchedVideo) {
            watchedVideo.removeEventListener("timeupdate", handleVideoProgress);
            watchedVideo.removeEventListener(
                "durationchange",
                handleNewMetadata,
            );
            watchedVideo.removeEventListener(
                "loadedmetadata",
                handleNewMetadata,
            );
            watchedVideo.removeEventListener("playing", handleVideoProgress);
            watchedVideo.removeEventListener("timeupdate", handleBadgeProgress);
            watchedVideo.removeEventListener(
                "durationchange",
                handleBadgeProgress,
            );
            watchedVideo.removeEventListener("pause", samplePlaybackTime);
            watchedVideo.removeEventListener("waiting", samplePlaybackTime);
            watchedVideo.removeEventListener("seeking", samplePlaybackTime);
            watchedVideo.removeEventListener("ended", samplePlaybackTime);
        }
        watchedVideo = null;
        lastPlaybackSample = null;
        playbackWasActive = false;
        updateBadge(null);
    }

    function watchVideo(video) {
        const nextKey = video ? getShortKey(video) : "";
        const videoChanged = video !== watchedVideo;
        const shortChanged = nextKey !== watchedShortKey;
        if (!videoChanged && !shortChanged) return;

        // YouTube can move one video element from Short to Short. Until it
        // loads the new one, its duration is still the last Short's.
        const previousDuration = watchedVideo?.duration;
        cancelPendingAdvance();
        unwatchVideo();
        watchedVideo = video;
        watchedShortKey = nextKey;
        hasTriggeredForCurrentShort = false;
        currentShortWatchSeconds = 0;
        countedCurrentShort = false;
        completedPlays = 0;
        endReachedThisPass = false;
        skipCheckedForCurrentShort = false;
        metadataFresh = videoChanged || video?.duration !== previousDuration;

        if (video) {
            applyPlaybackSpeed(video);
            video.addEventListener("timeupdate", handleVideoProgress, {
                passive: true,
            });
            video.addEventListener("durationchange", handleNewMetadata, {
                passive: true,
            });
            video.addEventListener("loadedmetadata", handleNewMetadata, {
                passive: true,
            });
            video.addEventListener("playing", handleVideoProgress, {
                passive: true,
            });
            video.addEventListener("timeupdate", handleBadgeProgress, {
                passive: true,
            });
            video.addEventListener("durationchange", handleBadgeProgress, {
                passive: true,
            });
            video.addEventListener("pause", samplePlaybackTime, {
                passive: true,
            });
            video.addEventListener("waiting", samplePlaybackTime, {
                passive: true,
            });
            video.addEventListener("seeking", samplePlaybackTime, {
                passive: true,
            });
            video.addEventListener("ended", samplePlaybackTime, {
                passive: true,
            });
            updateBadge(video);
            samplePlaybackTime();
            handleVideoProgress();
        }
    }

    function refreshActiveVideo() {
        if (!isShortsPage()) {
            cancelPendingAdvance();
            unwatchVideo();
            watchedShortKey = "";
            hasTriggeredForCurrentShort = false;
            removeInjectedStatus();
            return;
        }
        watchVideo(findActiveVideo());
        ensureInjectedStatus();
    }

    function scheduleRefresh() {
        clearTimeout(rescanTimer);
        rescanTimer = setTimeout(
            refreshActiveVideo,
            ACTIVE_VIDEO_CHANGE_DEBOUNCE_MS,
        );
    }

    function mutationAffectsShorts(records) {
        if (watchedVideo && !watchedVideo.isConnected) return true;
        for (const record of records) {
            if ([...record.removedNodes].includes(statusHost)) return true;
            for (const node of [...record.addedNodes, ...record.removedNodes]) {
                if (node.nodeType !== Node.ELEMENT_NODE || node === statusHost)
                    continue;
                if (
                    node.matches(RELEVANT_MUTATION_SELECTOR) ||
                    node.querySelector(RELEVANT_MUTATION_SELECTOR)
                )
                    return true;
            }
        }
        return false;
    }

    function handleMutations(records) {
        if (mutationAffectsShorts(records)) scheduleRefresh();
    }

    function scheduleFallbackCheck() {
        if (!extensionContextValid) return;
        const activeInterval =
            isShortsPage() && !document.hidden
                ? FALLBACK_INTERVAL_MS
                : IDLE_FALLBACK_INTERVAL_MS;
        fallbackTimer = setTimeout(() => {
            refreshActiveVideo();
            handleVideoProgress();
            scheduleFallbackCheck();
        }, activeInterval);
    }

    /** Pauses a playing Short when its tab is hidden, if the setting is on. */
    function pauseWhileHidden() {
        const video = watchedVideo;
        if (!settings.pauseWhenHidden || !isShortsPage() || !video) return;
        if (video.paused) return;
        pausedWhileHidden = video;
        pausedWhileHiddenKey = watchedShortKey;
        video.pause();
    }

    /**
     * Resumes only what pauseWhileHidden paused, and only if it is still the
     * same Short: one the person paused themselves stays paused.
     */
    function resumeAfterHidden() {
        const video = pausedWhileHidden;
        const key = pausedWhileHiddenKey;
        pausedWhileHidden = null;
        pausedWhileHiddenKey = "";
        if (!video?.isConnected || !video.paused || !isShortsPage()) return;
        if (video !== watchedVideo || getShortKey(video) !== key) return;
        video.play()?.catch?.(() => {});
    }

    function handleVisibilityChange() {
        samplePlaybackTime();
        if (document.hidden) {
            flushWatchTime();
            stopEndMonitor();
            pauseWhileHidden();
        } else {
            resumeAfterHidden();
            refreshActiveVideo();
            handleVideoProgress();
        }
    }

    /**
     * Sets the chosen speed on `video`. Speed 1 only undoes a speed this
     * extension set, so YouTube's own speed choice is otherwise untouched.
     */
    function applyPlaybackSpeed(video, { evenAfterStart = false } = {}) {
        if (!video) return;
        const speed = settings.playbackSpeed;
        if (speed === 1) {
            if (!speedChangedVideos.has(video)) return;
            speedChangedVideos.delete(video);
            video.defaultPlaybackRate = 1;
            video.playbackRate = 1;
            return;
        }
        if (!evenAfterStart && currentShortWatchSeconds > SPEED_SETTLE_SECONDS)
            return;
        speedChangedVideos.add(video);
        // The default rate carries over when the element loads another Short.
        if (video.defaultPlaybackRate !== speed)
            video.defaultPlaybackRate = speed;
        if (video.playbackRate !== speed) video.playbackRate = speed;
    }

    function handleNewMetadata() {
        metadataFresh = true;
        handleVideoProgress();
    }

    /**
     * Moves past a Short whose length at the current speed is outside the
     * skip range. Checked once per Short, after its own length is known.
     */
    function skipIfOutOfRange(video) {
        if (skipCheckedForCurrentShort || !metadataFresh) return false;
        const range = skipRange(settings);
        if (!range) return false;
        skipCheckedForCurrentShort = true;
        if (skippedShortKeys.has(watchedShortKey)) return false;
        const length = effectiveLength(video);
        if (
            !(range.min && length < range.min) &&
            !(range.max && length > range.max)
        )
            return false;
        skippedShortKeys.add(watchedShortKey);
        stopEndMonitor();
        hasTriggeredForCurrentShort = true;
        goToNextShort(video, watchedShortKey, { skipped: true });
        return true;
    }

    function handleVideoProgress() {
        const video = watchedVideo;
        samplePlaybackTime();
        if (!video) return;
        applyPlaybackSpeed(video);
        if (
            !settings.enabled ||
            !isShortsPage() ||
            video.paused ||
            hasTriggeredForCurrentShort
        )
            return;
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        if (skipIfOutOfRange(video)) return;

        const remaining = remainingSeconds(video);
        updateBadge(video);
        // Back near the start: the Short looped, so its next end is a new play.
        if (
            remaining > END_MONITOR_WINDOW_SECONDS ||
            video.currentTime < video.duration / 2
        )
            endReachedThisPass = false;
        if (remaining < 0 || remaining > END_MONITOR_WINDOW_SECONDS) return;
        if (remaining > END_THRESHOLD_SECONDS) {
            if (endMonitorFrame === null)
                endMonitorFrame = requestAnimationFrame(monitorVideoEnd);
            return;
        }

        handleReachedEnd();
    }

    function sessionIsOver() {
        return (
            (settings.sessionShorts > 0 &&
                sessionShorts >= settings.sessionShorts) ||
            (settings.sessionMinutes > 0 &&
                sessionWatchSeconds >= settings.sessionMinutes * 60)
        );
    }

    function startSession() {
        sessionShorts = 0;
        sessionWatchSeconds = 0;
        sessionLimitReached = false;
    }

    /** Stops on the Short that used up the session, so it doesn't loop on. */
    function endSession(video) {
        hasTriggeredForCurrentShort = true;
        sessionLimitReached = true;
        settings.enabled = false;
        video.pause();
        updateBadge();
        updateInjectedStatus();
        try {
            void chrome.storage.sync.set({ enabled: false }).catch(() => {});
        } catch {
            deactivateStaleInstance();
        }
    }

    /**
     * The Short is at its end. Each end counts as one play; YouTube loops the
     * Short until it has played loopCount times, and then the session limit
     * either ends things here or auto-scroll moves on.
     */
    function handleReachedEnd() {
        const video = watchedVideo;
        if (!video || video.paused || hasTriggeredForCurrentShort) return;
        if (endReachedThisPass) return;
        stopEndMonitor();
        endReachedThisPass = true;
        completedPlays += 1;
        if (completedPlays < settings.loopCount) return;
        if (sessionIsOver()) {
            endSession(video);
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
                if (
                    watchedVideo !== scheduledVideo ||
                    watchedShortKey !== scheduledKey
                )
                    return;
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
            "ytd-shorts #navigation-button-down button",
            "ytd-shorts #navigation-button-down",
            "ytd-reel-video-renderer[is-active] #navigation-button-down button",
            "#navigation-button-down button",
            "button[aria-label='Next video']",
            "button[aria-label='Next']",
        ];
        for (const selector of selectors) {
            const button = [...document.querySelectorAll(selector)].find(
                (candidate) => {
                    const rect = candidate.getBoundingClientRect();
                    const style = getComputedStyle(candidate);
                    const overlapsViewport =
                        rect.bottom > 0 &&
                        rect.top < innerHeight &&
                        rect.right > 0 &&
                        rect.left < innerWidth;
                    return (
                        candidate.isConnected &&
                        overlapsViewport &&
                        rect.width > 0 &&
                        rect.height > 0 &&
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        !candidate.disabled
                    );
                },
            );
            if (button) return button;
        }
        return null;
    }

    function findScrollableAncestor(element) {
        for (
            let current = element?.parentElement;
            current && current !== document.body;
            current = current.parentElement
        ) {
            const overflowY = getComputedStyle(current).overflowY;
            if (
                /(auto|scroll)/.test(overflowY) &&
                current.scrollHeight > current.clientHeight + 10
            )
                return current;
        }
        return null;
    }

    function scrollToNextShort(video) {
        const renderer = video?.closest("ytd-reel-video-renderer");
        let nextRenderer = renderer?.nextElementSibling;
        while (
            nextRenderer &&
            nextRenderer.tagName !== "YTD-REEL-VIDEO-RENDERER"
        ) {
            nextRenderer = nextRenderer.nextElementSibling;
        }
        if (nextRenderer) {
            nextRenderer.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
            return;
        }

        const scrollContainer = findScrollableAncestor(renderer || video);
        const distance = scrollContainer
            ? scrollContainer.clientHeight
            : Math.max(document.documentElement.clientHeight, innerHeight);
        if (scrollContainer)
            scrollContainer.scrollBy({ top: distance, behavior: "smooth" });
        else window.scrollBy({ top: distance, behavior: "smooth" });
    }

    /** A skip isn't an auto-scroll: the Short was never watched to its end. */
    function goToNextShort(sourceVideo, sourceKey, { skipped = false } = {}) {
        if (!skipped) sendStats({ autoScrolled: 1 });
        const nextButton = findNextButton();
        if (nextButton) {
            nextButton.click();
            setTimeout(() => {
                refreshActiveVideo();
                if (
                    watchedVideo === sourceVideo &&
                    watchedShortKey === sourceKey
                )
                    scrollToNextShort(sourceVideo);
            }, NAVIGATION_VERIFY_MS);
            return;
        }
        scrollToNextShort(sourceVideo);
    }

    function isEditableTarget(event) {
        const target = event.composedPath()[0];
        if (!(target instanceof Element)) return false;
        return (
            target.isContentEditable ||
            Boolean(
                target.closest(
                    'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
                ),
            )
        );
    }

    /**
     * Matches on the physical key (event.code), so the shortcut survives keyboard
     * layouts and macOS Option turning letters into symbols. The toggle itself
     * goes through the service worker, which also handles Chrome's own command
     * and drops a second toggle from the same press.
     */
    function handleShortcut(event) {
        const shortcut = settings.shortcut;
        if (!shortcut || event.repeat || !extensionContextValid) return;
        if (
            event.code !== shortcut.code ||
            event.ctrlKey !== shortcut.ctrlKey ||
            event.altKey !== shortcut.altKey ||
            event.shiftKey !== shortcut.shiftKey ||
            event.metaKey !== shortcut.metaKey
        ) {
            return;
        }
        if (isEditableTarget(event)) return;
        event.preventDefault();
        event.stopPropagation();
        try {
            void chrome.runtime
                .sendMessage({ type: "TOGGLE_AUTO_SCROLL" })
                .catch(() => {});
        } catch {
            deactivateStaleInstance();
        }
    }

    async function loadSettings() {
        try {
            storedSettings = await chrome.storage.sync.get([
                ...SYNC_SETTING_KEYS,
            ]);
            settings = parseSettings(storedSettings);
        } catch (error) {
            console.warn("Shorts Auto Scroll: could not load settings", error);
        }
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync" || !extensionContextValid) return;
        const previous = settings;
        for (const key of SYNC_SETTING_KEYS) {
            if (!(key in changes)) continue;
            if (changes[key].newValue === undefined) delete storedSettings[key];
            else storedSettings[key] = changes[key].newValue;
        }
        settings = parseSettings(storedSettings);

        // Turning auto-scroll back on, anywhere, starts a new session.
        if (
            changes.enabled?.oldValue === false &&
            changes.enabled.newValue !== false
        )
            startSession();
        if (settings.playbackSpeed !== previous.playbackSpeed)
            applyPlaybackSpeed(watchedVideo, { evenAfterStart: true });
        if (
            settings.skipShorterThan !== previous.skipShorterThan ||
            settings.skipLongerThan !== previous.skipLongerThan
        )
            skipCheckedForCurrentShort = false;
        if (!settings.pauseWhenHidden) pausedWhileHidden = null;
        if (changes.delaySeconds) cancelPendingAdvance({ rearm: true });
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
        if (message?.type === "GET_STATUS") {
            sendResponse({
                onShortsPage: isShortsPage(),
                videoDetected: Boolean(watchedVideo),
                enabled: settings.enabled,
                sessionShorts,
                sessionWatchSeconds: Math.floor(sessionWatchSeconds),
                sessionLimitReached,
            });
        }
    });

    observer = new MutationObserver(handleMutations);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
    addEventListener("scroll", scheduleRefresh, { passive: true });
    addEventListener("resize", scheduleRefresh, { passive: true });
    addEventListener("yt-navigate-finish", scheduleRefresh);
    // Capture phase, so YouTube's own key handlers never see a matched shortcut.
    addEventListener("keydown", handleShortcut, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    loadSettings().finally(() => {
        refreshActiveVideo();
        scheduleFallbackCheck();
    });
})();
