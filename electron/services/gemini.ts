// Gemini TTS REST client. Returns raw PCM (24kHz/16-bit/mono) decoded from the
// inlineData base64. See electron/core/wav.ts to wrap it for playback.
// NOTE: `undici` is type-only here and lazy-loaded at call time. Importing it at
// module load crashes on Electron's Node runtime (undici needs a newer Node);
// we only ever load it when a proxy is actually configured.
import type { ProxyAgent } from 'undici'

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
let undiciMod: typeof import('undici') | null = null

// Fetch via the global fetch normally; only when a proxy is set do we lazy-load
// undici and route through its ProxyAgent (and its own fetch, to keep versions
// consistent). Returns a Response-compatible object either way.
async function proxyFetch(
  url: string,
  init: RequestInit,
  proxyUrl?: string
): Promise<Response> {
  const u = (proxyUrl ?? '').trim()
  if (!u) return fetch(url, init)
  if (!undiciMod) undiciMod = await import('undici')
  let agent = proxyAgents.get(u)
  if (!agent) {
    agent = new undiciMod.ProxyAgent(u)
    proxyAgents.set(u, agent)
  }
  return undiciMod.fetch(url, { ...init, dispatcher: agent } as never) as unknown as Response
}

interface SynthOpts {
  text: string
  voice: string
  model: string
  apiKey: string
  proxyUrl?: string
  /** abort the request after this many ms (0/undefined = no timeout) */
  timeoutMs?: number
  signal?: AbortSignal
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] }
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    candidatesTokensDetails?: { modality?: string; tokenCount?: number }[]
  }
  error?: { code?: number; message?: string; status?: string }
}

export interface SynthResult {
  pcm: Buffer
  inputTokens: number
  outputTokens: number
}

export async function synthesize(opts: SynthOpts): Promise<SynthResult> {
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

  // Per-request timeout so a stalled call can't hang the whole pipeline.
  const ctrl = new AbortController()
  const timer = opts.timeoutMs && opts.timeoutMs > 0 ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null
  const onUserAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onUserAbort, { once: true })

  let res: Response
  try {
    res = await proxyFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': opts.apiKey
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      },
      opts.proxyUrl
    )
  } catch (e) {
    if (opts.signal?.aborted) throw e // user stopped the batch — let it propagate
    const timedOut = ctrl.signal.aborted
    throw new TtsError(
      timedOut ? `Quá thời gian chờ (${Math.round((opts.timeoutMs ?? 0) / 1000)}s) — bỏ qua, thử key khác.` : `Lỗi mạng: ${(e as Error).message}`,
      0,
      true,
      false
    )
  } finally {
    if (timer) clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onUserAbort)
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
  const u = json.usageMetadata
  const audioDetail = u?.candidatesTokensDetails?.find((d) => d.modality === 'AUDIO')
  return {
    pcm: Buffer.from(b64, 'base64'),
    inputTokens: u?.promptTokenCount ?? 0,
    outputTokens: audioDetail?.tokenCount ?? u?.candidatesTokenCount ?? 0
  }
}

/** Lightweight validity check for a key: returns true if the key authenticates. */
export async function validateKey(apiKey: string, proxyUrl?: string): Promise<boolean> {
  try {
    const res = await proxyFetch(
      `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET' },
      proxyUrl
    )
    return res.ok
  } catch {
    return false
  }
}
