/**
 * COSSA — End-to-End Encryption for Direct Messages
 *
 * Security model:
 *  1. ECDH (P-256) for shared AES-GCM content encryption.
 *  2. ECDSA (P-256) signatures over ciphertext metadata for sender authenticity.
 *  3. Private keys persisted in IndexedDB (legacy localStorage values are migrated).
 *  4. Cloud key backup wrapped with PBKDF2(passphrase, random salt), never userId.
 */

const LEGACY_PRIV_KEY_PREFIX = 'cossa_ec_priv_'
const SESSION_WRAP_SECRET_PREFIX = 'cossa_wrap_secret_'
const PBKDF2_ITERATIONS = 210_000
const PBKDF2_SALT_BYTES = 16

const KEY_DB_NAME = 'cossa-crypto-keys'
const KEY_STORE = 'keys'
const ECDH_DB_KEY = (userId: string) => `ecdh:${userId}`
const ECDSA_DB_KEY = (userId: string) => `ecdsa:${userId}`

type CloudWrappedBlobV1 = { v: 1; iv: string; ct: string }
type CloudWrappedBlobV2 = { v: 2; iv: string; ct: string; salt: string; iter: number }
type E2EPayloadV2 = {
  e2e: 1
  iv: string
  ct: string
  sig?: string
  signer?: string
  alg?: 'ECDSA_P256_SHA256'
}

// ─── Key generation ───────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  ) as Promise<CryptoKeyPair>
}

export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  ) as Promise<CryptoKeyPair>
}

// ─── Public key export / import ──────────────────────────────────────────────

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
    [],
  )
}

export async function exportSigningPublicKey(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key)
  return b64encode(new Uint8Array(spki))
}

export async function importSigningPublicKey(b64: string): Promise<CryptoKey> {
  const spki = b64decode(b64)
  return crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
}

async function exportPublicKeyFromPrivateKey(privateKey: CryptoKey): Promise<string> {
  const privateJwk = await crypto.subtle.exportKey('jwk', privateKey)
  const publicJwk: JsonWebKey = {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
    ext: true,
    key_ops: [],
  }
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  )
  return exportPublicKey(publicKey)
}

async function exportSigningPublicKeyFromPrivateKey(privateKey: CryptoKey): Promise<string> {
  const privateJwk = await crypto.subtle.exportKey('jwk', privateKey)
  const publicJwk: JsonWebKey = {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
    ext: true,
    key_ops: ['verify'],
  }
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  )
  return exportSigningPublicKey(publicKey)
}

async function exportPrivateKeyJwkString(privateKey: CryptoKey): Promise<string> {
  const privateJwk = await crypto.subtle.exportKey('jwk', privateKey)
  return JSON.stringify(privateJwk)
}

async function importPrivateKeyJwkString(privateJwkRaw: string): Promise<CryptoKey> {
  const privateJwk = JSON.parse(privateJwkRaw) as JsonWebKey
  return crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
}

async function importSigningPrivateKeyJwkString(privateJwkRaw: string): Promise<CryptoKey> {
  const privateJwk = JSON.parse(privateJwkRaw) as JsonWebKey
  return crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign'],
  )
}

// ─── IndexedDB key persistence ───────────────────────────────────────────────

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openKeyDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly')
    const store = tx.objectStore(KEY_STORE)
    const req = store.get(key)
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
  })
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openKeyDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).put(value, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ─── Private key persistence (IndexedDB with localStorage migration) ─────────

export async function savePrivateKey(userId: string, key: CryptoKey): Promise<void> {
  const jwkRaw = await exportPrivateKeyJwkString(key)
  await idbSet(ECDH_DB_KEY(userId), jwkRaw)
}

export async function saveSigningPrivateKey(userId: string, key: CryptoKey): Promise<void> {
  const privateJwk = await crypto.subtle.exportKey('jwk', key)
  await idbSet(ECDSA_DB_KEY(userId), JSON.stringify(privateJwk))
}

export async function loadPrivateKey(userId: string): Promise<CryptoKey | null> {
  const stored = await idbGet(ECDH_DB_KEY(userId))
  if (stored) {
    try {
      return await importPrivateKeyJwkString(stored)
    } catch {
      return null
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_PRIV_KEY_PREFIX + userId)
  if (!legacyRaw) return null
  try {
    const key = await importPrivateKeyJwkString(legacyRaw)
    await idbSet(ECDH_DB_KEY(userId), legacyRaw)
    localStorage.removeItem(LEGACY_PRIV_KEY_PREFIX + userId)
    return key
  } catch {
    return null
  }
}

export async function loadSigningPrivateKey(userId: string): Promise<CryptoKey | null> {
  const stored = await idbGet(ECDSA_DB_KEY(userId))
  if (!stored) return null
  try {
    return await importSigningPrivateKeyJwkString(stored)
  } catch {
    return null
  }
}

// ─── Cloud wrapping (passphrase-derived key) ─────────────────────────────────

async function deriveCloudWrapKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(secret)
  const keyMaterial = await crypto.subtle.importKey('raw', secretBytes, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: toArrayBufferUint8(salt),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function resolveCloudBackupSecret(userId: string): string | null {
  if (typeof window === 'undefined') return null
  const cacheKey = `${SESSION_WRAP_SECRET_PREFIX}${userId}`
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) return cached
  return null
}

async function encryptPrivateKeyForCloud(privateKey: CryptoKey, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrapKey = await deriveCloudWrapKey(secret, salt, PBKDF2_ITERATIONS)
  const raw = await exportPrivateKeyJwkString(privateKey)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrapKey,
    new TextEncoder().encode(raw),
  )
  const blob: CloudWrappedBlobV2 = {
    v: 2,
    iv: b64encode(iv),
    ct: b64encode(new Uint8Array(ct)),
    salt: b64encode(salt),
    iter: PBKDF2_ITERATIONS,
  }
  return JSON.stringify(blob)
}

async function decryptPrivateKeyFromCloud(encryptedBlob: string, secret: string): Promise<CryptoKey> {
  const parsed = JSON.parse(encryptedBlob) as CloudWrappedBlobV2 | CloudWrappedBlobV1
  if (parsed.v !== 2) {
    throw new Error('Unsupported cloud key backup format. Please rotate E2EE keys.')
  }
  const iv = b64decode(parsed.iv)
  const ct = b64decode(parsed.ct)
  const salt = b64decode(parsed.salt)
  const wrapKey = await deriveCloudWrapKey(secret, salt, parsed.iter)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrapKey, ct)
  const jwkRaw = new TextDecoder().decode(plain)
  return importPrivateKeyJwkString(jwkRaw)
}

// ─── Shared key derivation ────────────────────────────────────────────────────

async function deriveSharedAESKey(myPrivate: CryptoKey, theirPublic: CryptoKey): Promise<CryptoKey> {
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

function signingPayload(iv: string, ct: string, senderId?: string, receiverId?: string): string {
  return `${iv}.${ct}.${senderId ?? ''}.${receiverId ?? ''}`
}

// ─── Encrypt / decrypt ───────────────────────────────────────────────────────

export async function encryptMessage(
  myPrivate: CryptoKey,
  theirPublic: CryptoKey,
  plaintext: string,
  options?: {
    signingPrivateKey?: CryptoKey | null
    senderId?: string
    receiverId?: string
  },
): Promise<string> {
  const aesKey = await deriveSharedAESKey(myPrivate, theirPublic)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(plaintext),
  )

  const ivB64 = b64encode(iv)
  const ctB64 = b64encode(new Uint8Array(ct))
  const payload: E2EPayloadV2 = {
    e2e: 1,
    iv: ivB64,
    ct: ctB64,
  }

  if (options?.signingPrivateKey) {
    const rawSig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      options.signingPrivateKey,
      new TextEncoder().encode(signingPayload(ivB64, ctB64, options.senderId, options.receiverId)),
    )
    payload.sig = b64encode(new Uint8Array(rawSig))
    payload.signer = options.senderId
    payload.alg = 'ECDSA_P256_SHA256'
  }

  return JSON.stringify(payload)
}

export async function decryptMessage(
  myPrivate: CryptoKey,
  theirPublic: CryptoKey,
  cipherJSON: string,
  options?: {
    verifyWithPublicKey?: CryptoKey | null
    expectedSenderId?: string
    expectedReceiverId?: string
  },
): Promise<string> {
  try {
    if (!myPrivate || !theirPublic) {
      throw new Error('Missing encryption keys')
    }

    const parsed = JSON.parse(cipherJSON) as E2EPayloadV2 | { e2e: 1; iv: string; ct: string }
    if (!parsed.iv || !parsed.ct) {
      throw new Error('Invalid encrypted message format')
    }

    if ('sig' in parsed && parsed.sig) {
      if (!options?.verifyWithPublicKey) {
        throw new Error('Missing signing public key for signature verification')
      }
      if (options.expectedSenderId && parsed.signer && options.expectedSenderId !== parsed.signer) {
        throw new Error('Signature signer mismatch')
      }
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        options.verifyWithPublicKey,
        b64decode(parsed.sig),
        new TextEncoder().encode(
          signingPayload(parsed.iv, parsed.ct, options.expectedSenderId, options.expectedReceiverId),
        ),
      )
      if (!ok) {
        throw new Error('Invalid message signature')
      }
    }

    const iv = b64decode(parsed.iv)
    const ct = b64decode(parsed.ct)
    const aesKey = await deriveSharedAESKey(myPrivate, theirPublic)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct)
    return new TextDecoder().decode(plain)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw error
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isEncrypted(content: string): boolean {
  if (!content.startsWith('{')) return false
  try {
    const obj = JSON.parse(content) as { e2e?: number }
    return obj.e2e === 1 || obj.e2e === 2
  } catch {
    return false
  }
}

export async function ensureKeyPair(
  userId: string,
  theirPublicKeyB64: string | null,
  theirSigningPublicKeyB64: string | null,
  myPublicKeyB64: string | null = null,
  mySigningPublicKeyB64: string | null = null,
  myEncryptedPrivateKeyBlob: string | null = null,
  cloudBackupSecret: string | null = null,
): Promise<{
  myPrivate: CryptoKey
  mySigningPrivate: CryptoKey
  theirPublic: CryptoKey | null
  theirSigningPublic: CryptoKey | null
  newPublicKeyB64: string | null
  newSigningPublicKeyB64: string | null
  newEncryptedPrivateKeyBlob: string | null
}> {
  let myPrivate = await loadPrivateKey(userId)
  let mySigningPrivate = await loadSigningPrivateKey(userId)
  let newPublicKeyB64: string | null = null
  let newSigningPublicKeyB64: string | null = null
  let newEncryptedPrivateKeyBlob: string | null = null

  if (myPrivate && myPublicKeyB64) {
    try {
      const derivedPublicB64 = await exportPublicKeyFromPrivateKey(myPrivate)
      if (derivedPublicB64 !== myPublicKeyB64) {
        console.warn('Local ECDH private key mismatch detected; regenerating')
        myPrivate = null
      }
    } catch (error) {
      console.warn('Failed to validate local ECDH key pair, regenerating:', error)
      myPrivate = null
    }
  }

  if (mySigningPrivate && mySigningPublicKeyB64) {
    try {
      const derivedSigningPublicB64 = await exportSigningPublicKeyFromPrivateKey(mySigningPrivate)
      if (derivedSigningPublicB64 !== mySigningPublicKeyB64) {
        console.warn('Local signing private key mismatch detected; regenerating')
        mySigningPrivate = null
      }
    } catch (error) {
      console.warn('Failed to validate local signing key pair, regenerating:', error)
      mySigningPrivate = null
    }
  }

  if (!myPrivate && myEncryptedPrivateKeyBlob && cloudBackupSecret) {
    try {
      myPrivate = await decryptPrivateKeyFromCloud(myEncryptedPrivateKeyBlob, cloudBackupSecret)
      await savePrivateKey(userId, myPrivate)
    } catch (error) {
      console.warn('Failed to restore private key from cloud backup:', error)
      myPrivate = null
    }
  }

  if (!myPrivate) {
    const pair = await generateKeyPair()
    await savePrivateKey(userId, pair.privateKey)
    newPublicKeyB64 = await exportPublicKey(pair.publicKey)
    myPrivate = pair.privateKey
  }

  if (!mySigningPrivate) {
    const signingPair = await generateSigningKeyPair()
    await saveSigningPrivateKey(userId, signingPair.privateKey)
    newSigningPublicKeyB64 = await exportSigningPublicKey(signingPair.publicKey)
    mySigningPrivate = signingPair.privateKey
  }

  if (cloudBackupSecret && (!myEncryptedPrivateKeyBlob || newPublicKeyB64)) {
    newEncryptedPrivateKeyBlob = await encryptPrivateKeyForCloud(myPrivate, cloudBackupSecret)
  }

  let theirPublic: CryptoKey | null = null
  if (theirPublicKeyB64) {
    try {
      theirPublic = await importPublicKey(theirPublicKeyB64)
    } catch (error) {
      console.warn('Failed to import peer ECDH public key:', error)
      theirPublic = null
    }
  }

  let theirSigningPublic: CryptoKey | null = null
  if (theirSigningPublicKeyB64) {
    try {
      theirSigningPublic = await importSigningPublicKey(theirSigningPublicKeyB64)
    } catch (error) {
      console.warn('Failed to import peer signing public key:', error)
      theirSigningPublic = null
    }
  }

  return {
    myPrivate,
    mySigningPrivate,
    theirPublic,
    theirSigningPublic,
    newPublicKeyB64,
    newSigningPublicKeyB64,
    newEncryptedPrivateKeyBlob,
  }
}

// ─── Base64 utils ─────────────────────────────────────────────────────────────

function b64encode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
}

function b64decode(b64: string): Uint8Array<ArrayBuffer> {
  const chars = atob(b64)
  const buf = new Uint8Array(chars.length)
  for (let i = 0; i < chars.length; i++) buf[i] = chars.charCodeAt(i)
  return buf as Uint8Array<ArrayBuffer>
}

function toArrayBufferUint8(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(input.length)
  copy.set(input)
  return copy as Uint8Array<ArrayBuffer>
}
