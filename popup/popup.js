// Popup script — controls the toggle button and shows recording status

const toggleBtn = document.getElementById('toggleBtn')
const btnIcon = document.getElementById('btnIcon')
const btnLabel = document.getElementById('btnLabel')
const statusEl = document.getElementById('status')

let isRecording = false

// Get initial status
chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
  if (response && response.recording) {
    setRecordingUI(true)
  }
})

toggleBtn.addEventListener('click', async () => {
  toggleBtn.disabled = true
  statusEl.textContent = isRecording ? 'Stopping...' : 'Starting...'
  statusEl.className = 'status'

  try {
    await chrome.runtime.sendMessage({ action: 'toggle' })
    setRecordingUI(!isRecording)
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`
    statusEl.className = 'status'
  } finally {
    toggleBtn.disabled = false
  }
})

// Listen for status changes while popup is open
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'status') {
    setRecordingUI(message.state === 'recording')
  }
})

function setRecordingUI(recording) {
  isRecording = recording

  if (recording) {
    toggleBtn.className = 'toggle-btn stop'
    btnIcon.textContent = '⏹️'
    btnLabel.textContent = 'Stop Listening'
    statusEl.textContent = 'Listening... speak into any text field'
    statusEl.className = 'status recording'
  } else {
    toggleBtn.className = 'toggle-btn start'
    btnIcon.textContent = '🎙️'
    btnLabel.textContent = 'Start Listening'
    statusEl.textContent = 'Click to start dictating into any text field'
    statusEl.className = 'status'
  }
}
