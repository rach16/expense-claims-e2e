import { hash, verify } from '@node-rs/argon2'

// argon2id defaults from the library follow OWASP guidance
export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password)
}
