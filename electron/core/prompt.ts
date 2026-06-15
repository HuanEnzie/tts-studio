// Compose the final text sent to Gemini TTS. The chosen prebuilt voice fixes
// the speaker identity; the instruction + per-row style steer tone/accent/pace.
// Keeping the SAME instruction + voice across rows is what makes a batch sound
// consistent, so this is the single place that builds the directive prefix.

export function buildSpokenPrompt(opts: {
  instruction?: string
  style?: string
  text: string
}): string {
  const directives = [opts.instruction, opts.style]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
  const text = opts.text.trim()
  if (directives.length === 0) return text
  // join multiple directives with a period, then ": " before the spoken text
  return `${directives.join('. ')}: ${text}`
}
