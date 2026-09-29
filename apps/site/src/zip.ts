import { inflateRawSync } from 'node:zlib'

const STORED = 0
const DEFLATED = 8

export type ApkArchive = {
  manifestXml: Buffer
  builtAt: string
}

export function readApkArchive(apk: Buffer): ApkArchive {
  const eocd = findEocd(apk)
  const count = apk.readUInt16LE(eocd + 8)
  if (count === 0xffff) throw new Error('zip64 apk is not supported')
  let cursor = apk.readUInt32LE(eocd + 16)
  let manifestXml: Buffer | undefined
  let builtAt = ''
  for (let i = 0; i < count; i++) {
    if (apk.readUInt32LE(cursor) !== 0x02014b50) throw new Error('apk central directory is invalid')
    const entry = readCentral(apk, cursor)
    if (entry.modifiedAt > builtAt) builtAt = entry.modifiedAt
    if (entry.name === 'AndroidManifest.xml') manifestXml = entry.data
    cursor = entry.next
  }
  if (!manifestXml) throw new Error('apk is missing AndroidManifest.xml')
  if (!builtAt) throw new Error('apk has no timestamps')
  return { manifestXml, builtAt }
}

function findEocd(apk: Buffer): number {
  const min = Math.max(0, apk.length - 22 - 65535)
  for (let i = apk.length - 22; i >= min; i--) {
    if (apk.readUInt32LE(i) === 0x06054b50) return i
  }
  throw new Error('apk is not a zip')
}

type Central = {
  name: string
  data: Buffer
  modifiedAt: string
  next: number
}

function readCentral(apk: Buffer, cursor: number): Central {
  const method = apk.readUInt16LE(cursor + 10)
  const modifiedAt = dosToIso(apk.readUInt16LE(cursor + 14), apk.readUInt16LE(cursor + 12))
  const compressedSize = apk.readUInt32LE(cursor + 20)
  const nameLength = apk.readUInt16LE(cursor + 28)
  const extraLength = apk.readUInt16LE(cursor + 30)
  const commentLength = apk.readUInt16LE(cursor + 32)
  const localOffset = apk.readUInt32LE(cursor + 42)
  const name = apk.toString('utf8', cursor + 46, cursor + 46 + nameLength)
  return {
    name,
    data: name === 'AndroidManifest.xml' ? readLocal(apk, localOffset, method, compressedSize) : Buffer.alloc(0),
    modifiedAt,
    next: cursor + 46 + nameLength + extraLength + commentLength,
  }
}

function readLocal(apk: Buffer, localOffset: number, method: number, compressedSize: number): Buffer {
  const nameLength = apk.readUInt16LE(localOffset + 26)
  const extraLength = apk.readUInt16LE(localOffset + 28)
  const start = localOffset + 30 + nameLength + extraLength
  const compressed = apk.subarray(start, start + compressedSize)
  if (method === STORED) return Buffer.from(compressed)
  if (method === DEFLATED) return inflateRawSync(compressed)
  throw new Error(`unsupported apk compression ${method}`)
}

function dosToIso(date: number, time: number): string {
  const day = date & 0x1f
  const month = (date >> 5) & 0x0f
  const year = ((date >> 9) & 0x7f) + 1980
  const seconds = (time & 0x1f) * 2
  const minutes = (time >> 5) & 0x3f
  const hours = (time >> 11) & 0x1f
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}Z`
}

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

export function crc32(buffer: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
