import { Blob } from '@google/genai';

/**
 * Decodes a base64 string into a Uint8Array.
 * Optimized for robustness.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array into a base64 string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Float32Array PCM audio data (from Web Audio API) to a proprietary 
 * JSON Blob format expected by the Gemini Live API.
 * Converts Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767).
 */
export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to prevent distortion
    const s = Math.max(-1, Math.min(1, data[i]));
    // Convert to 16-bit PCM
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8 = new Uint8Array(int16.buffer);
  return {
    data: encode(uint8),
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Decodes raw PCM bytes (Int16, little-endian) from Gemini into an AudioBuffer.
 * Handles buffer alignment and conversion from Int16 to Float32.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Create Int16Array view on the buffer
  // We use data.buffer directly. If the Uint8Array is a view on a larger buffer,
  // we must take offset into account.
  // slice() ensures we have a clean ArrayBuffer starting at 0 for the Int16Array
  const bufferCopy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const dataInt16 = new Int16Array(bufferCopy);
  
  const frameCount = dataInt16.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Interleaved data: [L, R, L, R...] if stereo. 
      // Gemini usually sends mono, so this loop works for mono (stride=1) too.
      // Convert Int16 to Float32
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return audioBuffer;
}