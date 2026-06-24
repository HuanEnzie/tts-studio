// Stable content hash for the audio cache: identical inputs -> same key, so we
// can reuse a prior clip instead of paying to regenerate it. FNV-1a (no deps).

export interface CacheInput {
  model: string
  voice: string
  context: string
  scene: string
  style: string
  text: string
  temperature: number
  seed: number
}

export function contentHash(o: CacheInput): string {
  const s = [o.model, o.voice, o.context, o.scene, o.style, String(o.temperature), String(o.seed), o.text].join('')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // include length to further reduce accidental collisions
  return (h >>> 0).toString(16).padStart(8, '0') + '-' + s.length.toString(16)
}
