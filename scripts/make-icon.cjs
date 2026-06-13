// Renders the app icon (gradient rounded square + audio waveform) with Electron,
// then writes build/icon.png (512) and build/icon.ico (256, PNG-embedded).
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const buildDir = path.join(__dirname, '..', 'build')

const bars = [
  { h: 28, o: 0.9 }, { h: 52, o: 1 }, { h: 90, o: 1 }, { h: 60, o: 1 },
  { h: 110, o: 1 }, { h: 74, o: 1 }, { h: 40, o: 0.9 }
]
const barsHtml = bars
  .map(
    (b, i) =>
      `<rect x="${156 + i * 34}" y="${256 - b.h / 2}" width="18" height="${b.h}" rx="9" fill="white" opacity="${b.o}"/>`
  )
  .join('')

const svg = `
<svg width="100%" height="100%" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7C5CFF"/>
      <stop offset="100%" stop-color="#00D4FF"/>
    </linearGradient>
  </defs>
  <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#g)"/>
  ${barsHtml}
</svg>`

const html = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden}
  svg{display:block}
</style></head><body>${svg}</body></html>`

function pngToIco(png256) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // count
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0) // width 256 -> 0
  entry.writeUInt8(0, 1) // height 256 -> 0
  entry.writeUInt8(0, 2) // colors
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bpp
  entry.writeUInt32LE(png256.length, 8)
  entry.writeUInt32LE(22, 12) // offset
  return Buffer.concat([header, entry, png256])
}

async function run() {
  fs.mkdirSync(buildDir, { recursive: true })
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    useContentSize: true,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 400))
  const img = await win.webContents.capturePage()

  const big = img.resize({ width: 512, height: 512, quality: 'best' })
  fs.writeFileSync(path.join(buildDir, 'icon.png'), big.toPNG())
  const small = img.resize({ width: 256, height: 256, quality: 'best' })
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), pngToIco(small.toPNG()))
  console.log('wrote build/icon.png (512) and build/icon.ico (256)')
  app.exit(0)
}

app.whenReady().then(run)
