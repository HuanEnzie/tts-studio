// Gemini TTS REST client. Returns raw PCM (24kHz/16-bit/mono) decoded from the
// inlineData base64. See electron/core/wav.ts to wrap it for playback.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export class TtsError extends Error {
  constructor(
    message: string,
    public status: number,
    public retriable: boolean,
    public quotaHit: boolean
  ) {
    super(message)
    this.name = 'TtsError'
  }
}

interface SynthOpts {
  text: string
  voice: string
  model: string
  apiKey: string
  signal?: AbortSignal
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] }
  }[]
  error?: { code?: number; message?: string; status?: string }
}

export async function synthesize(opts: SynthOpts): Promise<Buffer> {
  const url = `${ENDPOINT}/${opts.model}:generateContent`
  const body = {
    contents: [{ parts: [{ text: opts.text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice } }
      }
    }
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': opts.apiKey
      },
      body: JSON.stringify(body),
      signal: opts.signal
    })
  } catch (e) {
    // network failure — worth retrying with another key / later
    throw new TtsError(`Lỗi mạng: ${(e as Error).message}`, 0, true, false)
  }

  const json = (await res.json().catch(() => ({}))) as GeminiResponse

  if (!res.ok) {
    const msg = json.error?.message ?? res.statusText
    const quotaHit = res.status === 429 || json.error?.status === 'RESOURCE_EXHAUSTED'
    const retriable = quotaHit || res.status >= 500 || res.status === 0
    throw new TtsError(msg, res.status, retriable, quotaHit)
  }

  const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
    ?.data
  if (!b64) {
    throw new TtsError('Phản hồi không có dữ liệu audio', res.status, false, false)
  }
  return Buffer.from(b64, 'base64')
}

/** Lightweight validity check for a key: returns true if the key authenticates. */
export async function validateKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'GET'
    })
    return res.ok
  } catch {
    return false
  }
}
