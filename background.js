'use strict';

async function setBadgeForTab(tabId, text) {
  const updates = [
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#18191B' }),
    chrome.action.setBadgeText({ tabId, text }),
  ];
  if (typeof chrome.action.setBadgeTextColor === 'function') {
    updates.push(chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' }));
  }
  await Promise.allSettled(updates);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'SET_BADGE' || !sender.tab?.id) return;

  const tabId = sender.tab.id;
  const text = typeof message.text === 'string' ? message.text.slice(0, 4) : '';
  void setBadgeForTab(tabId, text);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-auto-scroll') return;
  try {
    const { enabled = true } = await chrome.storage.sync.get({ enabled: true });
    await chrome.storage.sync.set({ enabled: !enabled });
  } catch {
    // The extension may be reloading while the command is handled.
  }
});
