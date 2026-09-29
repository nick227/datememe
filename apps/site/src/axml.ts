const STRING_POOL = 0x0001
const XML_FILE = 0x0003
const START_ELEMENT = 0x0102
const UTF8_FLAG = 0x100
const TYPE_STRING = 0x03
const TYPE_INT_DEC = 0x10
const TYPE_INT_HEX = 0x11
const VERSION_CODE = 0x0101021b
const VERSION_NAME = 0x0101021c

export type ApkIdentity = {
  version: string
  build: number
}

export function readManifestIdentity(xml: Buffer): ApkIdentity {
  const strings = readChunks(xml)
  if (!strings.version || strings.build === undefined) {
    throw new Error('AndroidManifest is missing versionName or versionCode')
  }
  return { version: strings.version, build: strings.build }
}

type Found = { version?: string; build?: number }

function readChunks(xml: Buffer): Found {
  if (xml.length < 8) throw new Error('AndroidManifest is too small')
  const fileType = xml.readUInt16LE(0)
  let offset = fileType === XML_FILE ? xml.readUInt16LE(2) : 0
  const strings: string[] = []
  const found: Found = {}
  while (offset + 8 <= xml.length) {
    const type = xml.readUInt16LE(offset)
    const headerSize = xml.readUInt16LE(offset + 2)
    const size = xml.readUInt32LE(offset + 4)
    if (size < 8 || offset + size > xml.length) throw new Error('bad AndroidManifest chunk')
    if (type === STRING_POOL) strings.push(...readStringPool(xml, offset))
    if (type === START_ELEMENT) readElement(xml, offset, headerSize, strings, found)
    offset += size
  }
  return found
}

function readStringPool(xml: Buffer, offset: number): string[] {
  const headerSize = xml.readUInt16LE(offset + 2)
  const stringCount = xml.readUInt32LE(offset + 8)
  const flags = xml.readUInt32LE(offset + 16)
  const stringsStart = offset + xml.readUInt32LE(offset + 20)
  const utf8 = (flags & UTF8_FLAG) !== 0
  const strings: string[] = []
  for (let i = 0; i < stringCount; i++) {
    const start = stringsStart + xml.readUInt32LE(offset + headerSize + i * 4)
    strings.push(utf8 ? readUtf8(xml, start) : readUtf16(xml, start))
  }
  return strings
}

function readUtf16(xml: Buffer, start: number): string {
  let pos = start
  let chars = xml.readUInt16LE(pos)
  pos += 2
  if ((chars & 0x8000) !== 0) {
    chars = ((chars & 0x7fff) << 16) | xml.readUInt16LE(pos)
    pos += 2
  }
  return xml.toString('utf16le', pos, pos + chars * 2)
}

function readUtf8(xml: Buffer, start: number): string {
  const chars = readUtf8Len(xml, start)
  const bytes = readUtf8Len(xml, chars.pos)
  return xml.toString('utf8', bytes.pos, bytes.pos + bytes.len)
}

function readUtf8Len(xml: Buffer, pos: number): { len: number; pos: number } {
  const first = xml.readUInt8(pos)
  if ((first & 0x80) === 0) return { len: first, pos: pos + 1 }
  return { len: ((first & 0x7f) << 8) | xml.readUInt8(pos + 1), pos: pos + 2 }
}

function readElement(xml: Buffer, offset: number, headerSize: number, strings: string[], found: Found): void {
  const ext = offset + headerSize
  const name = strings[xml.readUInt32LE(ext + 4)]
  if (name !== 'manifest') return
  const attributeStart = xml.readUInt16LE(ext + 8)
  const attributeSize = xml.readUInt16LE(ext + 10)
  const attributeCount = xml.readUInt16LE(ext + 12)
  if (attributeSize < 20) throw new Error('bad AndroidManifest attributes')
  for (let i = 0; i < attributeCount; i++) {
    readAttribute(xml, ext + attributeStart + i * attributeSize, strings, found)
  }
}

function readAttribute(xml: Buffer, at: number, strings: string[], found: Found): void {
  const key = attributeKey(xml.readUInt32LE(at + 4), strings)
  if (!key) return
  const dataType = xml.readUInt8(at + 15)
  const data = xml.readUInt32LE(at + 16)
  if (key === 'versionName' && dataType === TYPE_STRING) {
    const value = strings[data]?.trim()
    if (value) found.version = value
  }
  if (key === 'versionCode') found.build = readBuild(dataType, data, strings)
}

function attributeKey(name: number, strings: string[]): 'versionCode' | 'versionName' | undefined {
  if (name === VERSION_CODE) return 'versionCode'
  if (name === VERSION_NAME) return 'versionName'
  const label = strings[name]
  if (label === 'versionCode' || label === 'versionName') return label
  return undefined
}

function readBuild(dataType: number, data: number, strings: string[]): number | undefined {
  if (dataType === TYPE_INT_DEC || dataType === TYPE_INT_HEX) return data
  if (dataType !== TYPE_STRING) return undefined
  const parsed = Number(strings[data])
  if (!Number.isInteger(parsed)) return undefined
  return parsed
}
