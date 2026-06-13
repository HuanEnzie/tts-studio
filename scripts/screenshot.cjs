// Throwaway harness: loads the built renderer with a stub preload and captures
// PNGs of each route (including the project detail view).
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const outDir = path.join(__dirname, '..', 'shots')

async function shoot() {
  fs.mkdirSync(outDir, { recursive: true })
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    backgroundColor: '#0E0E11',
    webPreferences: {
      offscreen: true,
      preload: path.join(__dirname, 'shot-preload.cjs')
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'out', 'renderer', 'index.html'))

  const steps = [
    ['projects', `window.__setRoute('projects')`],
    ['project', `window.__openProject('p1')`],
    ['quick', `window.__setRoute('quick')`],
    ['keys', `window.__setRoute('keys')`],
    ['settings', `window.__setRoute('settings')`]
  ]

  for (const [name, js] of steps) {
    await win.webContents.executeJavaScript(js).catch(() => {})
    await new Promise((r) => setTimeout(r, 800))
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(outDir, `${name}.png`), img.toPNG())
    console.log('captured', name)
  }
  app.quit()
}

app.whenReady().then(shoot)
