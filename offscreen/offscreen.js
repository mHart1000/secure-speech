// Offscreen document — runs Vosk recognition and audio capture
// This needs a DOM context because AudioWorklet and Vosk WASM cannot run in a service worker.

import * as Vosk from 'vosk-browser'

// ── State ──────────────────────────────────────────────────────────────────────

let model = null
let recognizer = null
let audioContext = null
let sourceNode = null
let workletNode = null
let silenceGainNode = null
let mediaStream = null
let workletReady = false
let inactivityTimer = null
let isRecording = false

const SAMPLE_RATE = 16000
const INACTIVITY_TIMEOUT = 15000 // 15 seconds of silence → auto-stop

// ── Message handler ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'start') {
    start()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ error: err.message }))
    return true // keep channel open for async response
  }

  if (message.action === 'stop') {
    stop()
    sendResponse({ ok: true })
    return
  }
})

// ── Model / worklet setup ──────────────────────────────────────────────────────

async function ensureModel() {
  if (model) return
  // Model bundled with the extension under models/
  const modelUrl = chrome.runtime.getURL('models/vosk-model-small-en-us-0.15.tar.gz')
  emit('status', { state: 'downloading_model' })
  model = await Vosk.createModel(modelUrl)
}

async function ensureWorklet() {
  if (workletReady) return
  if (!audioContext) throw new Error('AudioContext not initialized')
  const workletUrl = chrome.runtime.getURL('worklet/vosk-audio-worklet.js')
  await audioContext.audioWorklet.addModule(workletUrl)
  workletReady = true
}

function setupRecognizer() {
  if (!model) throw new Error('Vosk model not loaded')

  recognizer = new model.KaldiRecognizer(SAMPLE_RATE)

  recognizer.on('partialresult', (message) => {
    const partial = message && message.result && message.result.partial
    if (partial) {
      emit('partial', { text: partial })
      resetInactivityTimer()
    }
  })

  recognizer.on('result', (message) => {
    const text = message && message.result && message.result.text
    if (text) {
      emit('result', { text })
      resetInactivityTimer()
    }
  })
}

// ── Start / stop ───────────────────────────────────────────────────────────────

async function start() {
  if (isRecording) return

  // Check for microphone support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Microphone access not available.')
  }

  await ensureModel()
  setupRecognizer()

  emit('status', { state: 'requesting_mic' })
  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate: SAMPLE_RATE
    }
  })

  emit('status', { state: 'starting_audio' })
  audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
  sourceNode = audioContext.createMediaStreamSource(mediaStream)

  await ensureWorklet()

  workletNode = new AudioWorkletNode(audioContext, 'vosk-audio-worklet', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1
  })

  workletNode.port.onmessage = (event) => {
    if (!recognizer) return

    const chunk = event.data
    if (!chunk || !chunk.length) return

    try {
      const audioBuffer = audioContext.createBuffer(1, chunk.length, audioContext.sampleRate)
      audioBuffer.copyToChannel(chunk, 0)
      recognizer.acceptWaveform(audioBuffer)
    } catch (e) {
      emit('error', { message: e.message })
      stop()
    }
  }

  // Connect through a silent gain node so audio doesn't play out loud
  silenceGainNode = audioContext.createGain()
  silenceGainNode.gain.value = 0
  sourceNode.connect(workletNode)
  workletNode.connect(silenceGainNode)
  silenceGainNode.connect(audioContext.destination)

  isRecording = true
  resetInactivityTimer()
  playBeep('start')
  emit('status', { state: 'recording' })
}

function stop() {
  const wasRecording = isRecording
  isRecording = false

  try { if (workletNode) { workletNode.port.onmessage = null; workletNode.disconnect() } } catch { /* ignore */ }
  try { if (sourceNode) sourceNode.disconnect() } catch { /* ignore */ }
  try { if (silenceGainNode) silenceGainNode.disconnect() } catch { /* ignore */ }
  try { if (audioContext) audioContext.close() } catch { /* ignore */ }
  try { if (mediaStream) mediaStream.getTracks().forEach(t => t.stop()) } catch { /* ignore */ }

  workletNode = null
  silenceGainNode = null
  sourceNode = null
  audioContext = null
  mediaStream = null
  recognizer = null
  workletReady = false

  if (inactivityTimer) {
    clearTimeout(inactivityTimer)
    inactivityTimer = null
  }

  if (wasRecording) {
    playBeep('stop')
  }
  emit('status', { state: 'stopped' })
}

// ── Inactivity timer ───────────────────────────────────────────────────────────

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(() => {
    if (isRecording) {
      stop()
    }
  }, INACTIVITY_TIMEOUT)
}

// ── Audio feedback beep ────────────────────────────────────────────────────────
// Ported directly from VoskSpeechToText.vue

function playBeep(mode = 'start') {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const now = audioCtx.currentTime

    const osc1 = audioCtx.createOscillator()
    const osc2 = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 6

    osc1.connect(gainNode)
    osc2.connect(gainNode)
    gainNode.connect(filter)
    filter.connect(audioCtx.destination)

    osc1.type = 'triangle'
    osc2.type = 'triangle'
    osc2.detune.value = 18

    if (mode === 'start') {
      // Powering on: rising pitch, opening filter
      osc1.frequency.setValueAtTime(100, now)
      osc1.frequency.linearRampToValueAtTime(150, now + 0.08)
      osc2.frequency.setValueAtTime(130, now)
      osc2.frequency.linearRampToValueAtTime(200, now + 0.08)
      filter.frequency.setValueAtTime(250, now)
      filter.frequency.linearRampToValueAtTime(1050, now + 0.08)
    } else {
      // Powering off: falling pitch, closing filter
      osc1.frequency.setValueAtTime(150, now)
      osc1.frequency.linearRampToValueAtTime(90, now + 0.2)
      osc2.frequency.setValueAtTime(200, now)
      osc2.frequency.linearRampToValueAtTime(130, now + 0.2)
      filter.frequency.setValueAtTime(1050, now)
      filter.frequency.linearRampToValueAtTime(190, now + 0.2)
    }

    // Envelope
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.19, now + 0.04)
    gainNode.gain.linearRampToValueAtTime(0.11, now + 0.16)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + (mode === 'start' ? 0.22 : 0.28))

    const duration = mode === 'start' ? 0.22 : 0.28
    osc1.start(now)
    osc1.stop(now + duration)
    osc2.start(now)
    osc2.stop(now + duration)

    setTimeout(() => audioCtx.close(), duration * 1000 + 100)
  } catch (e) {
    console.warn('Could not play beep:', e)
  }
}

// ── Messaging helper ───────────────────────────────────────────────────────────

function emit(type, data = {}) {
  chrome.runtime.sendMessage({ type, ...data })
}
