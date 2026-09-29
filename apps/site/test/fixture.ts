import { deflateRawSync } from 'node:zlib'
import { crc32 } from '../src/zip'

const VERSION_CODE = 0x0101021b
const VERSION_NAME = 0x0101021c

export const SAMPLE_DATE = (46 << 9) | (9 << 5) | 28
export const SAMPLE_TIME = (22 << 11) | (30 << 5)

export function binaryManifest(version: string, build: number, utf8 = false): Buffer {
  const pool = utf8 ? utf8Pool(['manifest', version]) : utf16Pool(['manifest', version])
  const inner = Buffer.concat([pool, manifestElement(build)])
  const xml = Buffer.alloc(8 + inner.length)
  xml.writeUInt16LE(0x0003, 0)
  xml.writeUInt16LE(8, 2)
  xml.writeUInt32LE(xml.length, 4)
  inner.copy(xml, 8)
  return xml
}

export function apkBuffer(manifest: Buffer, date: number, time: number, deflated = false): Buffer {
  const payload = deflated ? deflateRawSync(manifest) : manifest
  const name = Buffer.from('AndroidManifest.xml')
  const crc = crc32(manifest)
  const local = Buffer.alloc(30)
  writeCommon(local, 0x04034b50, payload.length, manifest.length, deflated ? 8 : 0, date, time, crc, name.length, 8)
  const localFull = Buffer.concat([local, name, payload])
  const central = Buffer.alloc(46)
  writeCommon(central, 0x02014b50, payload.length, manifest.length, deflated ? 8 : 0, date, time, crc, name.length, 10)
  central.writeUInt32LE(0, 42)
  const centralFull = Buffer.concat([central, name])
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(centralFull.length, 12)
  eocd.writeUInt32LE(localFull.length, 16)
  return Buffer.concat([localFull, centralFull, eocd])
}

function writeCommon(
  header: Buffer,
  signature: number,
  compressed: number,
  uncompressed: number,
  method: number,
  date: number,
  time: number,
  crc: number,
  nameLength: number,
  methodAt: number,
): void {
  header.writeUInt32LE(signature, 0)
  header.writeUInt16LE(20, 4)
  if (methodAt === 10) header.writeUInt16LE(20, 6)
  header.writeUInt16LE(method, methodAt)
  header.writeUInt16LE(time, methodAt + 2)
  header.writeUInt16LE(date, methodAt + 4)
  header.writeUInt32LE(crc, methodAt + 6)
  header.writeUInt32LE(compressed, methodAt + 10)
  header.writeUInt32LE(uncompressed, methodAt + 14)
  header.writeUInt16LE(nameLength, methodAt + 18)
}

function utf16Pool(strings: string[]): Buffer {
  return stringPool(strings, 0, (value) => {
    const chars = Buffer.from(value, 'utf16le')
    const out = Buffer.alloc(2 + chars.length + 2)
    out.writeUInt16LE(value.length, 0)
    chars.copy(out, 2)
    return out
  })
}

function utf8Pool(strings: string[]): Buffer {
  return stringPool(strings, 0x100, (value) => {
    const bytes = Buffer.from(value, 'utf8')
    return Buffer.concat([Buffer.from([value.length, bytes.length]), bytes, Buffer.from([0])])
  })
}

function stringPool(strings: string[], flags: number, encode: (value: string) => Buffer): Buffer {
  const encoded = strings.map(encode)
  const offsets = Buffer.alloc(strings.length * 4)
  let cursor = 0
  encoded.forEach((entry, index) => {
    offsets.writeUInt32LE(cursor, index * 4)
    cursor += entry.length
  })
  const data = Buffer.concat(encoded)
  const headerSize = 28
  const stringsStart = headerSize + offsets.length
  const pool = Buffer.alloc(stringsStart + data.length)
  pool.writeUInt16LE(0x0001, 0)
  pool.writeUInt16LE(headerSize, 2)
  pool.writeUInt32LE(pool.length, 4)
  pool.writeUInt32LE(strings.length, 8)
  pool.writeUInt32LE(flags, 16)
  pool.writeUInt32LE(stringsStart, 20)
  offsets.copy(pool, headerSize)
  data.copy(pool, stringsStart)
  return pool
}

function manifestElement(build: number): Buffer {
  const element = Buffer.alloc(76)
  element.writeUInt16LE(0x0102, 0)
  element.writeUInt16LE(16, 2)
  element.writeUInt32LE(element.length, 4)
  element.writeUInt32LE(0xffffffff, 12)
  element.writeUInt32LE(0xffffffff, 16)
  element.writeUInt16LE(20, 24)
  element.writeUInt16LE(20, 26)
  element.writeUInt16LE(2, 28)
  writeAttr(element, 36, VERSION_CODE, 0xffffffff, 0x10, build)
  writeAttr(element, 56, VERSION_NAME, 1, 0x03, 1)
  return element
}

function writeAttr(buffer: Buffer, at: number, name: number, raw: number, dataType: number, data: number): void {
  buffer.writeUInt32LE(0xffffffff, at)
  buffer.writeUInt32LE(name, at + 4)
  buffer.writeUInt32LE(raw, at + 8)
  buffer.writeUInt16LE(8, at + 12)
  buffer.writeUInt8(dataType, at + 15)
  buffer.writeUInt32LE(data, at + 16)
}
