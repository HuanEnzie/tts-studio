// Filename template engine. Variables: {date} {datetime} {project} {index}
// {slug} {voice}. {index} is zero-padded to 3 digits.

export function slugify(text: string, maxLen = 40): string {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (Vietnamese -> ascii-ish)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, maxLen).replace(/-+$/g, '') || 'audio'
}

export interface FilenameVars {
  date: string // YYYY-MM-DD
  datetime: string // YYYY-MM-DD_HHmmss
  project: string
  index: number
  voice: string
  text: string // source text, used to derive {slug}
}

function sanitizeSegment(s: string): string {
  // strip characters illegal in Windows filenames
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/\.+$/, '')
}

export function buildFilename(template: string, vars: FilenameVars): string {
  const map: Record<string, string> = {
    date: vars.date.replace(/-/g, ''),
    'date-': vars.date,
    datetime: vars.datetime,
    project: sanitizeSegment(vars.project) || 'project',
    index: String(vars.index).padStart(3, '0'),
    slug: slugify(vars.text),
    voice: vars.voice
  }
  const name = template.replace(/\{(\w[\w-]*)\}/g, (_, k: string) =>
    k in map ? map[k] : `{${k}}`
  )
  return sanitizeSegment(name) || `audio-${map.index}`
}

/** `[OutputRoot]/{YYYY-MM-DD}_{ProjectName}` */
export function projectFolderName(date: string, projectName: string): string {
  return `${date}_${sanitizeSegment(projectName) || 'project'}`
}
