// Gemini TTS returns headerless PCM (24kHz, 16-bit, mono). Wrap it in a
// canonical 44-byte WAV header so browsers / players can read it directly.

export interface PcmFormat {
  sampleRate: number
  bitsPerSample: number
  channels: number
}

export const GEMINI_PCM: PcmFormat = { sampleRate: 24000, bitsPerSample: 16, channels: 1 }

export function pcmToWav(pcm: Buffer, fmt: PcmFormat = GEMINI_PCM): Buffer {
  const { sampleRate, bitsPerSample, channels } = fmt
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // PCM fmt chunk size
  header.writeUInt16LE(1, 20) // audio format = PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcm])
}
