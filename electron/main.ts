import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'

const isDev = !app.isPackaged

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: '#0E0E11',
    titleBarStyle: 'hiddenInset',
    title: 'TTS Studio',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // smoke harness: capture the real app (real IPC + store) then exit
  if (process.env['SMOKE']) {
    win.webContents.on('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 1500))
      const img = await win.webContents.capturePage()
      const { writeFileSync } = await import('fs')
      writeFileSync(join(process.cwd(), 'shots', 'smoke.png'), img.toPNG())
      app.exit(0)
    })
  }

  // open external links in the OS browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Dev-only end-to-end check: run the REAL engine (store -> key select -> Gemini
// -> MP3) with a key from env, against an isolated TTS_DATA_DIR. Guarded by env.
async function runSelfTest(): Promise<void> {
  const { writeFileSync, statSync } = await import('fs')
  try {
    const { store } = await import('./services/store')
    const { encrypt } = await import('./services/crypto')
    const { synthOne } = await import('./services/engine')
    const { writeAudio } = await import('./services/audio')
    store().mutate((d) =>
      d.keys.push({
        id: 'selftest',
        label: 'selftest',
        account: '',
        enc: encrypt((process.env['SELFTEST_KEY'] as string).trim()),
        active: true,
        tier: 'free',
        banned: false,
        createdAt: 0
      })
    )
    const r = await synthOne(
      'Giọng nam miền Bắc, truyền cảm: Xin chào, đây là bản kiểm tra tạo giọng.',
      'Charon'
    )
    const out = join(process.cwd(), 'shots', 'selftest.mp3')
    await writeAudio(r.pcm, out, 'mp3')
    console.log('SELFTEST OK bytes=' + statSync(out).size)
    app.exit(0)
  } catch (e) {
    console.log('SELFTEST FAIL: ' + (e as Error).message)
    app.exit(1)
  }
}

app.whenReady().then(async () => {
  if (process.env['SELFTEST_KEY']) {
    await runSelfTest()
    return
  }
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
