// Gemini TTS REST client. Returns raw PCM (24kHz/16-bit/mono) decoded from the
// inlineData base64. See electron/core/wav.ts to wrap it for playback.
import { ProxyAgent } from 'undici'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export class TtsError extends Error {
  constructor(
    message: string,
    public status: number,
    public retriable: boolean,
    public quotaHit: boolean,
    /** set when the request IP region is blocked by Google (FAILED_PRECONDITION) */
    public geoBlocked = false,
    /** set when the project itself is banned (403 PERMISSION_DENIED) */
    public forbidden = false
  ) {
    super(message)
    this.name = 'TtsError'
  }
}

// cache one dispatcher per proxy url so we don't rebuild it on every request
const proxyAgents = new Map<string, ProxyAgent>()
function dispatcherFor(proxyUrl?: string): ProxyAgent | undefined {
  const url = (proxyUrl ?? '').trim()
  if (!url) return undefined
  let agent = proxyAgents.get(url)
  if (!agent) {
    agent = new ProxyAgent(url)
    proxyAgents.set(url, agent)
  }
  return agent
}

interface SynthOpts {
  text: string
  voice: string
  model: string
  apiKey: string
  proxyUrl?: string
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
      signal: opts.signal,
      // undici accepts a dispatcher to route through a proxy (not in TS types)
      dispatcher: dispatcherFor(opts.proxyUrl)
    } as RequestInit)
  } catch (e) {
    // network failure — worth retrying with another key / later
    throw new TtsError(`Lỗi mạng: ${(e as Error).message}`, 0, true, false)
  }

  const json = (await res.json().catch(() => ({}))) as GeminiResponse

  if (!res.ok) {
    const rawMsg = json.error?.message ?? res.statusText
    const status = json.error?.status
    const quotaHit = res.status === 429 || status === 'RESOURCE_EXHAUSTED'
    // Google returns 400 FAILED_PRECONDITION for unsupported user location
    const geoBlocked =
      /location is not supported/i.test(rawMsg) || status === 'FAILED_PRECONDITION'
    const forbidden = res.status === 403 || status === 'PERMISSION_DENIED'
    const retriable = (quotaHit || res.status >= 500 || res.status === 0) && !geoBlocked
    const msg = geoBlocked
      ? 'Vị trí mạng hiện tại không được Google hỗ trợ cho TTS. Hãy bật VPN vùng được hỗ trợ (vd US) hoặc đặt Proxy trong Cài đặt.'
      : forbidden
        ? `Project của key bị từ chối truy cập (403). ${rawMsg}`
        : rawMsg
    throw new TtsError(msg, res.status, retriable, quotaHit, geoBlocked, forbidden)
  }

  const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
    ?.data
  if (!b64) {
    throw new TtsError('Phản hồi không có dữ liệu audio', res.status, false, false)
  }
  return Buffer.from(b64, 'base64')
}

/** Lightweight validity check for a key: returns true if the key authenticates. */
export async function validateKey(apiKey: string, proxyUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'GET',
      dispatcher: dispatcherFor(proxyUrl)
    } as RequestInit)
    return res.ok
  } catch {
    return false
  }
}
