class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const config = options.processorOptions ?? {};
    const inputSampleRate = config.inputSampleRate ?? sampleRate;
    const targetSampleRate = config.targetSampleRate ?? 24_000;

    if (!(targetSampleRate > 0) || inputSampleRate < targetSampleRate) {
      throw new RangeError("Invalid PCM sample-rate configuration");
    }

    this.ratio = inputSampleRate / targetSampleRate;
    this.sampleBuffer = new Float32Array(0);
    this.sourceOffset = 0;
  }

  writePcm(samples, pcm16, startIndex = 0) {
    for (let i = 0; i < samples.length; i += 1) {
      pcm16[startIndex + i] = Math.max(
        -32768,
        Math.min(32767, Math.round(samples[i] * 32767)),
      );
    }
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    // The preferred AudioContext is already 24 kHz. Avoid buffering and
    // interpolation entirely on that fast path.
    if (this.ratio === 1) {
      const pcm16 = new Int16Array(input.length);
      this.writePcm(input, pcm16);
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      return true;
    }

    const merged = new Float32Array(this.sampleBuffer.length + input.length);
    merged.set(this.sampleBuffer);
    merged.set(input, this.sampleBuffer.length);

    let outputCount = 0;
    while (
      this.sourceOffset + outputCount * this.ratio < merged.length - 1
    ) {
      outputCount += 1;
    }

    if (outputCount > 0) {
      const pcm16 = new Int16Array(outputCount);

      for (let i = 0; i < outputCount; i += 1) {
        const sourcePosition = this.sourceOffset + i * this.ratio;
        const firstIndex = Math.floor(sourcePosition);
        const fraction = sourcePosition - firstIndex;
        const first = merged[firstIndex];
        const second = merged[firstIndex + 1] ?? first;
        const resampled = first + (second - first) * fraction;

        pcm16[i] = Math.max(
          -32768,
          Math.min(32767, Math.round(resampled * 32767)),
        );
      }

      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      this.sourceOffset += outputCount * this.ratio;
    }

    const consumed = Math.floor(this.sourceOffset);
    this.sampleBuffer = merged.slice(consumed);
    this.sourceOffset -= consumed;

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
