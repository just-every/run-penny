const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeTime(time: number): string {
  let value = Math.floor(time)
  let encoded = ''
  for (let index = 0; index < 10; index += 1) {
    encoded = alphabet[value % 32] + encoded
    value = Math.floor(value / 32)
  }
  return encoded
}

export function createUlid(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let value = 0n
  for (const byte of bytes) value = (value << 8n) | BigInt(byte)
  let randomness = ''
  for (let index = 0; index < 16; index += 1) {
    randomness = alphabet[Number(value & 31n)] + randomness
    value >>= 5n
  }
  return `${encodeTime(now)}${randomness}`
}
