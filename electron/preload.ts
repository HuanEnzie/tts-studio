import { contextBridge, ipcRenderer } from 'electron'

// A thin, typed bridge. Channels are added per feature in later phases
// (projects, keys, tts, queue). For now we expose a generic invoke + app info.
const api = {
  platform: process.platform,
  invoke: <T = unknown>(channel: string, payload?: unknown): Promise<T> =>
    ipcRenderer.invoke(channel, payload),
  on: (channel: string, listener: (...args: unknown[]) => void): (() => void) => {
    const sub = (_e: unknown, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, sub)
    return () => {
      ipcRenderer.removeListener(channel, sub)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
