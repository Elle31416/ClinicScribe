class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions;
    this.ratio = config.inputSampleRate / config.targetSampleRate;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    const length = Math.floor(input.length / this.ratio);
    const pcm16 = new Int16Array(length);

    for (let i = 0; i < length; i++) {
      const sample = input[Math.floor(i * this.ratio)] ?? 0;
      pcm16[i] = Math.max(
        -32768,
        Math.min(32767, Math.round(sample * 32767)),
      );
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);