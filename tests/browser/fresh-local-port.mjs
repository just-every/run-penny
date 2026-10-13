import assert from 'node:assert/strict'
import { createServer } from 'node:net'

const usedPorts = new Set()

// Probe an OS-selected loopback port without starting an application. The real
// CLI remains responsible for strict binding and any intervening collision.
export async function freshLocalPort() {
  const socket = createServer()
  try {
    await new Promise((resolve, reject) => {
      socket.once('error', reject)
      socket.listen(0, '127.0.0.1', resolve)
    })
    const { port } = socket.address()
    assert.ok(!usedPorts.has(port), 'Fresh clone journeys use distinct local ports')
    usedPorts.add(port)
    return port
  } finally {
    if (socket.listening) await new Promise(resolve => socket.close(resolve))
  }
}
