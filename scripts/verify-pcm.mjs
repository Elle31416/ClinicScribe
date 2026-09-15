import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workletUrl = new URL("../public/pcm-processor.js", import.meta.url);
const workletCode = fs.readFileSync(workletUrl, "utf8");

let PCMProcessor;

class AudioWorkletProcessor {
  constructor() {
    this.port = { postMessage() {} };
  }
}

vm.runInNewContext(workletCode, {
  AudioWorkletProcessor,
  registerProcessor: (_name, processor) => {
    PCMProcessor = processor;
  },
  Float32Array,
  Int16Array,
  Math,
});

function createProcessor(inputSampleRate) {
  return new PCMProcessor({
    processorOptions: {
      inputSampleRate,
      targetSampleRate: 24_000,
    },
  });
}

test("24 kHz input uses the pass-through PCM fast path", () => {
  const processor = createProcessor(24_000);
  const messages = [];
  processor.port.postMessage = (buffer) => messages.push(buffer);

  processor.process([[new Float32Array(128).fill(1)]]);

  assert.equal(messages.length, 1);
  const pcm = new Int16Array(messages[0]);
  assert.equal(pcm.length, 128);
  assert.equal(pcm[0], 32767);
});

test("48 kHz input produces 24 kHz PCM and clamps overflow", () => {
  const processor = createProcessor(48_000);
  const messages = [];
  processor.port.postMessage = (buffer) => messages.push(buffer);

  processor.process([[new Float32Array(128).fill(2)]]);

  assert.equal(messages.length, 1);
  const pcm = new Int16Array(messages[0]);
  assert.equal(pcm.length, 64);
  assert.equal(pcm[0], 32767);
});

test("fallback resampling stays aligned for common input rates", () => {
  for (const inputSampleRate of [24_000, 32_000, 44_100, 48_000]) {
    const processor = createProcessor(inputSampleRate);
    let samples = 0;
    processor.port.postMessage = (buffer) => {
      samples += new Int16Array(buffer).length;
    };

    const inputFrames = 128_000;
    for (let frame = 0; frame < inputFrames; frame += 128) {
      const input = Float32Array.from(
        { length: 128 },
        (_, index) => Math.sin((frame + index) / 8),
      );
      processor.process([[input]]);
    }

    const expected = Math.floor(
      (inputFrames * 24_000) / inputSampleRate,
    );

    assert.ok(
      Math.abs(samples - expected) <= 1,
      `${inputSampleRate} Hz drift was ${samples - expected}`,
    );
    assert.ok(processor.sampleBuffer.length < 4);
  }
});
