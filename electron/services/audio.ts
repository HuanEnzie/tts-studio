import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import ffmpegPath from 'ffmpeg-static'
import { pcmToWav, GEMINI_PCM } from '../core/wav'

// PCM -> WAV is pure (no deps). PCM -> MP3 shells out to the bundled ffmpeg
// binary, reading raw s16le from stdin.

export function pcmToWavBuffer(pcm: Buffer): Buffer {
  return pcmToWav(pcm)
}

export async function pcmToMp3File(pcm: Buffer, outPath: string): Promise<void> {
  let bin = ffmpegPath as unknown as string
  if (!bin) throw new Error('Không tìm thấy ffmpeg')
  // In a packaged app the binary is unpacked out of app.asar
  if (bin.includes('app.asar') && !bin.includes('app.asar.unpacked')) {
    bin = bin.replace('app.asar', 'app.asar.unpacked')
  }

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-f', 's16le',
      '-ar', String(GEMINI_PCM.sampleRate),
      '-ac', String(GEMINI_PCM.channels),
      '-i', 'pipe:0',
      '-codec:a', 'libmp3lame',
      '-q:a', '2',
      '-y',
      outPath
    ]
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', (d) => (stderr += d.toString()))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg thoát mã ${code}: ${stderr.slice(-300)}`))
    })
    proc.stdin.write(pcm)
    proc.stdin.end()
  })
}

export function pcmToWavFile(pcm: Buffer, outPath: string): void {
  writeFileSync(outPath, pcmToWavBuffer(pcm))
}

export async function writeAudio(
  pcm: Buffer,
  outPath: string,
  format: 'mp3' | 'wav'
): Promise<void> {
  if (format === 'wav') pcmToWavFile(pcm, outPath)
  else await pcmToMp3File(pcm, outPath)
}
