import { safeStorage } from 'electron'

// Encrypt API keys at rest using the OS keychain (DPAPI on Windows, Keychain
// on macOS, libsecret on Linux). Falls back to base64 only if the platform
// has no secure backend, so the app still works (with a clear caveat).

export function encrypt(raw: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return 'v1:' + safeStorage.encryptString(raw).toString('base64')
  }
  return 'b64:' + Buffer.from(raw, 'utf-8').toString('base64')
}

export function decrypt(stored: string): string {
  if (stored.startsWith('v1:')) {
    const buf = Buffer.from(stored.slice(3), 'base64')
    return safeStorage.decryptString(buf)
  }
  if (stored.startsWith('b64:')) {
    return Buffer.from(stored.slice(4), 'base64').toString('utf-8')
  }
  // legacy / unknown — assume raw
  return stored
}

/** Mask a key for display: keep first 4 + last 4. */
export function maskKey(raw: string): string {
  if (raw.length <= 10) return '••••'
  return `${raw.slice(0, 4)}••••${raw.slice(-4)}`
}
