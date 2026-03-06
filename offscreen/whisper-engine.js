function createNoopCallbacks() {
  return {
    onPartial: () => {},
    onResult: () => {},
    onError: () => {},
    onStatus: () => {}
  }
}

function normalizeCallbacks(callbacks = {}) {
  const noops = createNoopCallbacks()
  return {
    onPartial: callbacks.onPartial || noops.onPartial,
    onResult: callbacks.onResult || noops.onResult,
    onError: callbacks.onError || noops.onError,
    onStatus: callbacks.onStatus || noops.onStatus
  }
}

export class WhisperSpeechEngine {
  constructor({ sampleRate, modelUrl, callbacks }) {
    this.sampleRate = sampleRate
    this.modelUrl = modelUrl
    this.callbacks = normalizeCallbacks(callbacks)
  }

  async init() {
    this.callbacks.onStatus('initializing_engine')
    throw new Error('Whisper engine is not implemented yet')
  }

  acceptChunk(_audioContext, _chunk) {
    throw new Error('Whisper engine is not implemented yet')
  }

  dispose() {}
}
