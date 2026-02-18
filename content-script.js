// Content script — injected into every page
// Receives recognized text from the background/offscreen pipeline and inserts it
// into whatever element is currently focused.

// ── Message listener ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'result') {
    insertTextAtCursor(message.text)
    hidePartialPreview()
  } else if (message.type === 'partial') {
    showPartialPreview(message.text)
  } else if (message.type === 'status') {
    if (message.state === 'recording') {
      showRecordingIndicator()
    } else if (message.state === 'stopped') {
      hideRecordingIndicator()
      hidePartialPreview()
    }
  }
})

// ── Text insertion ─────────────────────────────────────────────────────────────

function insertTextAtCursor(text) {
  const el = document.activeElement
  if (!el) return

  // Handle contentEditable elements (rich text editors, Gmail, Notion, etc.)
  if (el.isContentEditable) {
    insertIntoContentEditable(text)
    return
  }

  // Handle standard input/textarea elements
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    insertIntoInputField(el, text)
    return
  }

  // Check if there's a contentEditable element inside the active element
  const editableChild = el.querySelector('[contenteditable="true"]')
  if (editableChild) {
    editableChild.focus()
    insertIntoContentEditable(text)
    return
  }

  // Last resort: try to find any focused editable element in the shadow DOM
  const shadowEditable = findEditableInShadow(el)
  if (shadowEditable) {
    shadowEditable.focus()
    if (shadowEditable.isContentEditable) {
      insertIntoContentEditable(text)
    } else {
      insertIntoInputField(shadowEditable, text)
    }
  }
}

function insertIntoContentEditable(text) {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return

  const range = selection.getRangeAt(0)
  range.deleteContents()

  // Add leading space if needed
  const container = range.startContainer
  const offset = range.startOffset
  let insert = text
  if (container.textContent && offset > 0) {
    const charBefore = container.textContent[offset - 1]
    if (charBefore && charBefore !== ' ' && !insert.startsWith(' ')) {
      insert = ' ' + insert
    }
  }

  const textNode = document.createTextNode(insert)
  range.insertNode(textNode)

  // Move cursor to end of inserted text
  range.setStartAfter(textNode)
  range.setEndAfter(textNode)
  selection.removeAllRanges()
  selection.addRange(range)

  // Trigger input event for frameworks
  const editableEl = findClosestEditable(container)
  if (editableEl) {
    editableEl.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function insertIntoInputField(el, text) {
  const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length
  const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)

  let insert = text
  const needsLeadingSpace = before && !before.endsWith(' ') && !insert.startsWith(' ')
  const needsTrailingSpace = after && !after.startsWith(' ') && !insert.endsWith(' ')
  if (needsLeadingSpace) insert = ' ' + insert
  if (needsTrailingSpace) insert = insert + ' '

  // Use execCommand for better undo support, fall back to direct value set
  el.focus()
  el.setSelectionRange(start, end)

  const inserted = document.execCommand('insertText', false, insert)
  if (!inserted) {
    // Fallback: set value directly
    el.value = before + insert + after
    const cursorPos = start + insert.length
    el.setSelectionRange(cursorPos, cursorPos)
  }

  // Trigger input events for reactive frameworks (React, Vue, Angular, etc.)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))

  // React-specific: trigger the native input event setter
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, el.value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

// ── Helper: find editable elements ─────────────────────────────────────────────

function findClosestEditable(node) {
  let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (current) {
    if (current.isContentEditable) return current
    current = current.parentElement
  }
  return null
}

function findEditableInShadow(el) {
  if (el.shadowRoot) {
    const editable = el.shadowRoot.querySelector(
      'input, textarea, [contenteditable="true"]'
    )
    if (editable) return editable
  }
  return null
}

// ── Partial preview overlay ────────────────────────────────────────────────────

let previewOverlay = null

function showPartialPreview(text) {
  if (!text) {
    hidePartialPreview()
    return
  }

  if (!previewOverlay) {
    previewOverlay = document.createElement('div')
    previewOverlay.id = 'vosk-stt-partial-preview'
    previewOverlay.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483647;
      max-width: 350px;
      word-wrap: break-word;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: opacity 0.15s ease;
    `
    document.body.appendChild(previewOverlay)
  }

  previewOverlay.textContent = text
  previewOverlay.style.opacity = '1'
}

function hidePartialPreview() {
  if (previewOverlay) {
    previewOverlay.style.opacity = '0'
    setTimeout(() => {
      previewOverlay?.remove()
      previewOverlay = null
    }, 150)
  }
}

// ── Recording indicator ────────────────────────────────────────────────────────

let recordingIndicator = null

function showRecordingIndicator() {
  if (recordingIndicator) return

  recordingIndicator = document.createElement('div')
  recordingIndicator.id = 'vosk-stt-recording-indicator'
  recordingIndicator.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(220, 40, 40, 0.9);
      color: #fff;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    ">
      <span style="
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #fff;
        animation: vosk-pulse 1.2s infinite ease-in-out;
      "></span>
      Listening...
    </div>
    <style>
      @keyframes vosk-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
    </style>
  `
  document.body.appendChild(recordingIndicator)
}

function hideRecordingIndicator() {
  if (recordingIndicator) {
    recordingIndicator.remove()
    recordingIndicator = null
  }
}
