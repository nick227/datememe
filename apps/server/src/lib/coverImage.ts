import sharp from 'sharp'

// Deterministic image checks for list covers — no model involved. Used when
// proposing candidates (on thumbnails), when importing a cover, and to score
// covers already in the catalog.

export type ImageMetrics = {
  width: number
  height: number
  /** Edge energy (Laplacian std-dev on a 512px greyscale); below ~12 reads as soft or blurry, ~60 is typical. */
  sharpness: number
  /** Mean luminance 0–1; below ~0.12 is a dark card. */
  luminance: number
  /** Mean colour saturation 0–1; below ~0.06 is effectively black & white. */
  saturation: number
  /** 64-bit difference hash (hex): near-duplicates differ in few bits. */
  dhash: string
  /** Share of (partly) transparent pixels — cut-outs and clip art, not photos. */
  transparency: number
}

export async function measureImage(raw: Buffer): Promise<ImageMetrics> {
  const meta = await sharp(raw).metadata()
  let transparency = 0
  if (meta.hasAlpha) {
    const { data, info } = await sharp(raw).resize(64, 64, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let seeThrough = 0
    for (let i = info.channels - 1; i < data.length; i += info.channels) if (data[i]! < 250) seeThrough++
    transparency = Math.round((seeThrough / (64 * 64)) * 1000) / 1000
  }
  // Measure what a viewer sees: transparent areas render on the card background.
  const input = meta.hasAlpha ? await sharp(raw).flatten({ background: '#ffffff' }).toBuffer() : raw
  const grey = sharp(input).rotate().greyscale()
  const edges = await grey.clone().resize(512, 512, { fit: 'inside' })
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] }).stats()
  const light = await grey.clone().resize(256, 256, { fit: 'inside' }).stats()
  const { data } = await sharp(input).rotate().resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let saturation = 0
  for (let i = 0; i < data.length; i += 3) {
    const max = Math.max(data[i]!, data[i + 1]!, data[i + 2]!), min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
    saturation += max ? (max - min) / max : 0
  }
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    sharpness: Math.round((edges.channels[0]?.stdev ?? 0) * 10) / 10,
    luminance: Math.round(((light.channels[0]?.mean ?? 0) / 255) * 1000) / 1000,
    saturation: Math.round((saturation / (data.length / 3)) * 1000) / 1000,
    dhash: await dhash(input),
    transparency,
  }
}

async function dhash(input: Buffer) {
  const { data } = await sharp(input).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  let bits = ''
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) bits += data[row * 9 + col]! > data[row * 9 + col + 1]! ? '1' : '0'
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0')
}

/** Differing bits between two dhashes; ≤ 8 of 64 is the same picture (re-encoded, resized, lightly cropped). */
export function hashDistance(a: string, b: string) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`), n = 0
  while (x) { n += Number(x & 1n); x >>= 1n }
  return n
}
export const NEAR_DUPLICATE = 8

/** Portrait card crop (3:4) around the most salient region, as WebP. */
export async function cardVariant(input: Buffer, width = 900) {
  const height = Math.round((width * 4) / 3)
  const { data, info } = await sharp(input).rotate()
    .resize(width, height, { fit: 'cover', position: sharp.strategy.attention, withoutEnlargement: false })
    .webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
  return { buffer: data, width: info.width, height: info.height }
}

/** Hard rejects and 0–100 technical quality from metrics (relevance is scored elsewhere). */
export function technicalQuality(m: ImageMetrics) {
  const issues: string[] = []
  if (m.luminance < 0.12) issues.push('too dark')
  if (m.saturation < 0.06) issues.push('black & white')
  if (m.sharpness < 12) issues.push('blurry')
  if (m.transparency > 0.05) issues.push('transparent background (cut-out or clip art)')
  const aspect = m.width / Math.max(1, m.height)
  if (aspect > 2.6 || aspect < 0.5) issues.push('extreme aspect ratio')
  const resolution = Math.min(1, Math.min(m.width, m.height) / 900)
  const score = Math.round(
    40 * resolution +
    25 * Math.min(1, m.sharpness / 35) +
    20 * Math.min(1, Math.max(0, (m.luminance - 0.1) / 0.3)) +
    15 * Math.min(1, m.saturation / 0.25),
  )
  return { score, issues }
}
