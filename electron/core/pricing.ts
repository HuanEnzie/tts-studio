import type { BatchEstimate } from './types'

// USD cost from token counts. Audio output ($/1M) dominates.
export function costUsd(
  inputTokens: number,
  outputTokens: number,
  priceInputPerM: number,
  priceAudioPerM: number
): number {
  return (inputTokens / 1e6) * priceInputPerM + (outputTokens / 1e6) * priceAudioPerM
}

// Calibrated from a live call: ~0.26 input tok/char, ~2.15 audio tok/char.
// Rounded up slightly so estimates are not under the real bill.
export function estimateTokens(text: string): { input: number; output: number } {
  const chars = text.trim().length
  return {
    input: Math.max(1, Math.ceil(chars * 0.3)),
    output: Math.ceil(chars * 2.2)
  }
}

export function estimateBatch(
  texts: string[],
  priceInputPerM: number,
  priceAudioPerM: number
): BatchEstimate {
  let input = 0
  let output = 0
  for (const t of texts) {
    const e = estimateTokens(t)
    input += e.input
    output += e.output
  }
  return {
    requests: texts.length,
    inputTokens: input,
    outputTokens: output,
    costUsd: costUsd(input, output, priceInputPerM, priceAudioPerM)
  }
}
