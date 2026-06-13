// Verifies the parts that need a real Electron runtime: ffmpeg MP3 encoding
// and safeStorage key encryption. Mirrors electron/services/audio.ts logic.
const { app, safeStorage } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ffmpegPath = require('ffmpeg-static')

function pcmToWav(pcm) {
  const sampleRate = 24000, bits = 16, ch = 1
  const blockAlign = (ch * bits) / 8
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20)
  header.writeUInt16LE(ch, 22); header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * blockAlign, 28); header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bits, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function pcmToMp3(pcm, out) {
  return new Promise((resolve, reject) => {
    const args = ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-q:a', '2', '-y', out]
    const proc = spawn(ffmpegPath, args)
    let err = ''
    proc.stderr.on('data', (d) => (err += d))
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg ' + code + ': ' + err.slice(-200)))))
    proc.stdin.write(pcm); proc.stdin.end()
  })
}

async function run() {
  const results = []
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-test-'))

  // 1 second of a 440Hz sine @ 24kHz 16-bit mono
  const n = 24000
  const pcm = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / 24000) * 12000), i * 2)
  }

  // WAV
  const wav = pcmToWav(pcm)
  results.push(['WAV header', wav.length === 44 + pcm.length && wav.toString('ascii', 0, 4) === 'RIFF'])

  // MP3 via ffmpeg
  const mp3 = path.join(tmp, 'out.mp3')
  try {
    await pcmToMp3(pcm, mp3)
    const size = fs.statSync(mp3).size
    const head = fs.readFileSync(mp3).slice(0, 3)
    const isMp3 = head[0] === 0x49 /*I*/ || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
    results.push(['MP3 encode (ffmpeg)', size > 500 && isMp3])
    console.log('  mp3 size:', size, 'bytes')
  } catch (e) {
    results.push(['MP3 encode (ffmpeg)', false])
    console.log('  ffmpeg error:', e.message)
  }

  // safeStorage round-trip
  if (safeStorage.isEncryptionAvailable()) {
    const secret = 'AIzaSyTEST-1234567890'
    const enc = safeStorage.encryptString(secret)
    const dec = safeStorage.decryptString(enc)
    results.push(['safeStorage encrypt/decrypt', dec === secret && !enc.toString().includes(secret)])
  } else {
    results.push(['safeStorage available', false])
  }

  fs.rmSync(tmp, { recursive: true, force: true })

  console.log('\nIntegration results:')
  let ok = true
  for (const [name, pass] of results) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? '\nALL PASS' : '\nSOME FAILED')
  app.exit(ok ? 0 : 1)
}

app.whenReady().then(run)
