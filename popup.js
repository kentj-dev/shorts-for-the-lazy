"use strict";

const DEFAULTS = { enabled: true, badgeEnabled: true, delaySeconds: 0 };
const enabledInput = document.querySelector("#enabled");
const badgeEnabledInput = document.querySelector("#badge-enabled");
const delayInput = document.querySelector("#delay");
const delayOutput = document.querySelector("#delay-output");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector("#status-dot");

function clampDelay(value) {
  return Math.round(Math.min(5, Math.max(0, Number(value) || 0)) * 10) / 10;
}

function setDelay(value) {
  const delay = clampDelay(value);
  delayInput.value = String(delay);
  delayOutput.textContent = delay.toFixed(1);
  return delay;
}

function setStatus(text, active) {
  statusText.textContent = text;
  statusText.className = active ? "" : "inactive";
  statusDot.className = active ? "active" : "inactive";
}

async function updateStatus() {
  if (!enabledInput.checked) {
    setStatus("Disabled", false);
    return;
  }
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    setStatus("Unavailable", false);
    return;
  }
  if (!tab?.url?.startsWith("https://www.youtube.com/shorts/")) {
    setStatus("Open a YouTube Short", false);
    return;
  }
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Status request timed out")), 1200))
    ]);
    const active = Boolean(response?.videoDetected);
    setStatus(active ? "Active" : "Waiting for video", active);
  } catch {
    setStatus("Refresh the YouTube tab", false);
  }
}

async function saveEnabled() {
  await chrome.storage.sync.set({ enabled: enabledInput.checked });
  updateStatus();
}

async function saveBadgeEnabled() {
  await chrome.storage.sync.set({ badgeEnabled: badgeEnabledInput.checked });
}

async function saveDelay(value = delayInput.value) {
  const delaySeconds = setDelay(value);
  await chrome.storage.sync.set({ delaySeconds });
}

async function initialize() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULTS);
    enabledInput.checked = settings.enabled !== false;
    badgeEnabledInput.checked = settings.badgeEnabled !== false;
    setDelay(settings.delaySeconds);
  } catch {
    enabledInput.checked = DEFAULTS.enabled;
    badgeEnabledInput.checked = DEFAULTS.badgeEnabled;
    setDelay(DEFAULTS.delaySeconds);
  }

  document.body.classList.add("settings-ready");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add("transitions-ready"));
  });

  await updateStatus();
}

enabledInput.addEventListener("change", saveEnabled);
badgeEnabledInput.addEventListener("change", saveBadgeEnabled);
delayInput.addEventListener("input", () => setDelay(delayInput.value));
delayInput.addEventListener("change", () => saveDelay());
document.querySelector("#decrease").addEventListener("click", () => saveDelay(Number(delayInput.value) - 0.1));
document.querySelector("#increase").addEventListener("click", () => saveDelay(Number(delayInput.value) + 0.1));
document.querySelector("#shortcuts").addEventListener("click", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (changes.enabled) {
    enabledInput.checked = changes.enabled.newValue !== false;
    updateStatus();
  }
  if (changes.badgeEnabled) badgeEnabledInput.checked = changes.badgeEnabled.newValue !== false;
});
initialize();
