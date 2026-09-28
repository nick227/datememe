const sharp = require('sharp'); const fs = require('fs')
const review = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
async function thumb(url) {
  for (let a = 0; a < 5; a++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Datememe/1.0 (list cover review; admin)' } })
      const ct = res.headers.get('content-type') || ''
      if (res.ok && ct.startsWith('image/')) return await sharp(Buffer.from(await res.arrayBuffer())).resize(300, 188, { fit: 'cover' }).toBuffer()
      if (res.status === 424 || res.status === 404) break
      await sleep(10000 * (a + 1))
    } catch { await sleep(4000) }
  }
  return null
}
;(async () => {
  const W = 6 * 305, ROW = 30 + 192
  for (let s = 0; s < review.pending.length; s += 3) {
    const group = review.pending.slice(s, s + 3); const comps = []
    for (const [g, e] of group.entries()) {
      const top = g * ROW
      comps.push({ input: Buffer.from(`<svg width="${W}" height="30"><rect width="${W}" height="30" fill="#111"/><text x="8" y="21" font-size="17" fill="#fff" font-family="sans-serif">${esc(`${e.title}  —  brief: ${e.brief}  (${e.slug})`)}</text></svg>`), left: 0, top })
      for (const [i, c] of e.candidates.entries()) {
        const img = await thumb(c.thumbnail)
        const label = Buffer.from(`<svg width="300" height="188"><rect width="30" height="28" fill="#000"/><text x="9" y="21" font-size="19" fill="#fff" font-family="sans-serif">${i + 1}</text><rect y="166" width="300" height="22" fill="rgba(0,0,0,0.55)"/><text x="5" y="182" font-size="12" fill="#fff" font-family="sans-serif">${esc(`${c.license} · ${c.source} · ${(c.title || '').slice(0, 34)}`)}</text></svg>`)
        const base = img ?? await sharp({ create: { width: 300, height: 188, channels: 3, background: '#ccc' } }).png().toBuffer()
        comps.push({ input: await sharp(base).composite([{ input: label }]).png().toBuffer(), left: i * 305, top: top + 32 })
        await sleep(3200)
      }
    }
    await sharp({ create: { width: W, height: group.length * ROW, channels: 3, background: '#fff' } }).composite(comps).jpeg({ quality: 72 }).toFile(`${out}/r2-${String(s / 3 + 1).padStart(2, '0')}.jpg`)
    console.log('sheet', s / 3 + 1)
  }
})()
