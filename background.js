// Background service worker
// Coordinates between the offscreen document (audio/recognition) and content scripts (text insertion)

let isRecording = false

// Relay messages between offscreen document and active tab content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle toggle request from popup
  if (message.action === 'toggle') {
    handleToggle().then(() => sendResponse({ ok: true, recording: !isRecording }))
      .catch(err => sendResponse({ error: err.message }))
    return true // async response
  }

  // Handle status query from popup
  if (message.action === 'getStatus') {
    sendResponse({ recording: isRecording })
    return
  }

  // Forward recognized text from offscreen doc to active tab's content script
  if (message.type === 'result' || message.type === 'partial') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message)
      }
    })
    return
  }

  // Handle status updates from offscreen doc
  if (message.type === 'status') {
    isRecording = message.state === 'recording'
    updateBadge()
    return
  }
})

// Also support toggling via the action button click (when no popup)
// chrome.action.onClicked.addListener(() => handleToggle())

async function handleToggle() {
  if (isRecording) {
    await sendToOffscreen({ action: 'stop' })
  } else {
    await ensureOffscreenDocument()
    await sendToOffscreen({ action: 'start' })
  }
}

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  })
  if (existingContexts.length > 0) return

  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Microphone capture for local speech-to-text recognition'
  })
}

function sendToOffscreen(message) {
  return chrome.runtime.sendMessage(message)
}

function updateBadge() {
  chrome.action.setBadgeText({ text: isRecording ? 'REC' : '' })
  chrome.action.setBadgeBackgroundColor({ color: isRecording ? '#ff4444' : '#000000' })
}
