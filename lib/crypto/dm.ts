/**
 * COSSA — End-to-End Encryption for Direct Messages
 *
 * Algorithm: ECDH P-256 key agreement → AES-GCM-256 symmetric encryption
 *
 * Flow:
 *  1. Each user has an ECDH key pair.
 *     - Public key  → stored in profiles.public_key (base64 raw export)
 *     - Private key → stored in localStorage (JWK, never leaves the device)
 *  2. For a given conversation (me ↔ them), a shared AES key is derived:
 *       sharedKey = ECDH(myPrivate, theirPublic)
 *     Both sides derive the identical key because of the ECDH property.
 *  3. Each message is encrypted with AES-GCM using a fresh random 96-bit IV.
 *     Ciphertext is stored in the messages.content field as JSON:
 *       {"e2e":1,"iv":"<base64>","ct":"<base64>"}
 *  4. Messages without that structure are treated as legacy plaintext.
 */

const PRIV_KEY_PREFIX = 'cossa_ec_priv_'

// ─── Key Generation ──────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,            // extractable so we can export/store
    ['deriveBits'],  // only used for key agreement
  ) as Promise<CryptoKeyPair>
}

// ─── Public Key: base64 raw export ───────────────────────────────────────────

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return b64encode(new Uint8Array(raw))
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const raw = b64decode(b64)
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],  // no usages — only used inside deriveBits
  )
}

// ─── Private Key: localStorage (JWK) ─────────────────────────────────────────

export async function savePrivateKey(userId: string, key: CryptoKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  localStorage.setItem(PRIV_KEY_PREFIX + userId, JSON.stringify(jwk))
}

export async function loadPrivateKey(userId: string): Promise<CryptoKey | null> {
  const raw = localStorage.getItem(PRIV_KEY_PREFIX + userId)
  if (!raw) return null
  try {
    const jwk = JSON.parse(raw)
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )
  } catch {
    return null
  }
}

// ─── Shared Key Derivation ────────────────────────────────────────────────────

async function deriveSharedAESKey(
  myPrivate: CryptoKey,
  theirPublic: CryptoKey,
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    256,
  )
  return crypto.subtle.importKey(
    'raw',
    bits,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

export async function encryptMessage(
  myPrivate: CryptoKey,
  theirPublic: CryptoKey,
  plaintext: string,
): Promise<string> {
  const aesKey = await deriveSharedAESKey(myPrivate, theirPublic)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(plaintext),
  )
  return JSON.stringify({
    e2e: 1,
    iv: b64encode(iv),
    ct: b64encode(new Uint8Array(ct)),
  })
}

export async function decryptMessage(
  myPrivate: CryptoKey,
  theirPublic: CryptoKey,
  cipherJSON: string,
): Promise<string> {
  const { iv: ivB64, ct: ctB64 } = JSON.parse(cipherJSON)
  const iv = b64decode(ivB64)
  const ct = b64decode(ctB64)
  const aesKey = await deriveSharedAESKey(myPrivate, theirPublic)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct)
  return new TextDecoder().decode(plain)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isEncrypted(content: string): boolean {
  if (!content.startsWith('{')) return false
  try {
    const obj = JSON.parse(content)
    return obj.e2e === 1
  } catch {
    return false
  }
}

/**
 * Ensures the current user has an ECDH key pair.
 * - If a private key exists in localStorage: load it.
 * - Otherwise: generate a new pair, save the private key,
 *   and return the public key (base64) so the caller can persist it.
 *
 * Also imports the other user's public key if provided.
 */
export async function ensureKeyPair(
  userId: string,
  theirPublicKeyB64: string | null,
): Promise<{
  myPrivate: CryptoKey
  theirPublic: CryptoKey | null
  newPublicKeyB64: string | null  // non-null only when a new pair was generated
}> {
  let myPrivate = await loadPrivateKey(userId)
  let newPublicKeyB64: string | null = null

  if (!myPrivate) {
    const pair = await generateKeyPair()
    await savePrivateKey(userId, pair.privateKey)
    newPublicKeyB64 = await exportPublicKey(pair.publicKey)
    myPrivate = pair.privateKey
  }

  let theirPublic: CryptoKey | null = null
  if (theirPublicKeyB64) {
    try {
      theirPublic = await importPublicKey(theirPublicKeyB64)
    } catch {
      theirPublic = null
    }
  }

  return { myPrivate, theirPublic, newPublicKeyB64 }
}

// ─── Base64 utils ─────────────────────────────────────────────────────────────
// b64decode returns Uint8Array<ArrayBuffer> (not SharedArrayBuffer) so Web
// Crypto API overloads that require BufferSource accept it without issues.

function b64encode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
}

function b64decode(b64: string): Uint8Array<ArrayBuffer> {
  const chars = atob(b64)
  const buf = new Uint8Array(chars.length)  // backed by a concrete ArrayBuffer
  for (let i = 0; i < chars.length; i++) buf[i] = chars.charCodeAt(i)
  return buf as Uint8Array<ArrayBuffer>
}
