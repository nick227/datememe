import type { ReleaseManifest } from './publish'

export function renderPage(release: ReleaseManifest | null, downloads: number): string {
  const body = release ? published(release, downloads) : empty()
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Datememe Beta</title>
<style>
  body { margin: 0; min-height: 100vh; background: #f7ead1; color: #000; font: 18px/1.45 system-ui, sans-serif; }
  main { max-width: 28rem; margin: 0 auto; padding: 3rem 1.25rem 4rem; }
  .mark { margin: 0; font-weight: 800; font-size: 2rem; letter-spacing: -0.04em; }
  .mark span { color: #0022ff; }
  h1 { font-size: 1.05rem; font-weight: 650; margin: 0.35rem 0 1.5rem; }
  .meta { margin: 0 0 1.5rem; }
  .meta p { margin: 0.15rem 0; white-space: nowrap; }
  a.button { display: inline-block; background: #0022ff; color: #fff; text-decoration: none; font-weight: 700; padding: 0.85rem 1.25rem; border-radius: 999px; white-space: nowrap; }
  .count { margin: 0.85rem 0 0; color: #595959; }
  .notes { white-space: pre-wrap; background: #fff; border-radius: 12px; padding: 0.9rem 1rem; margin: 1.5rem 0 0; }
</style>
</head>
<body>
<main>
<p class="mark"><span>date</span>meme</p>
<h1>Beta</h1>
${body}
</main>
</body>
</html>
`
}

function published(release: ReleaseManifest, downloads: number): string {
  const notes = release.notes
    ? `<pre class="notes">${escapeHtml(release.notes)}</pre>`
    : ''
  return `<div class="meta">
<p>Version ${escapeHtml(release.version)}</p>
<p>Build ${release.build}</p>
<p>${escapeHtml(formatBuiltAt(release.builtAt))}</p>
<p>${escapeHtml(formatBytes(release.sizeBytes))}</p>
</div>
<a class="button" href="/download">Download APK</a>
<p class="count">${downloadLabel(downloads)}</p>
${notes}`
}

function empty(): string {
  return '<p>No APK published yet.</p>'
}

function downloadLabel(count: number): string {
  return count === 1 ? '1 download' : `${count} downloads`
}

function formatBuiltAt(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  const month = Number(match[2])
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const label = names[month - 1]
  if (!label || !match[1] || !match[3]) return iso
  return `${label} ${Number(match[3])}, ${match[1]}`
}

function formatBytes(size: number): string {
  const mb = size / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = size / 1024
  if (kb >= 1) return `${kb.toFixed(1)} KB`
  return `${size} B`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
