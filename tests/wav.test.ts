import { describe, it, expect } from 'vitest'
import { pcmToWav, GEMINI_PCM } from '../electron/core/wav'

describe('pcmToWav', () => {
  const pcm = Buffer.alloc(2400 * 2) // 0.1s of silence @ 24kHz 16-bit mono

  it('prepends a 44-byte RIFF/WAVE header', () => {
    const wav = pcmToWav(pcm)
    expect(wav.length).toBe(44 + pcm.length)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.toString('ascii', 36, 40)).toBe('data')
  })

  it('writes the correct format fields', () => {
    const wav = pcmToWav(pcm)
    expect(wav.readUInt16LE(20)).toBe(1) // PCM
    expect(wav.readUInt16LE(22)).toBe(GEMINI_PCM.channels)
    expect(wav.readUInt32LE(24)).toBe(GEMINI_PCM.sampleRate)
    expect(wav.readUInt16LE(34)).toBe(GEMINI_PCM.bitsPerSample)
    expect(wav.readUInt32LE(40)).toBe(pcm.length)
  })
})
