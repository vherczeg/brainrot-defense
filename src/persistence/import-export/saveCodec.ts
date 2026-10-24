import { fail, ok, type PlayerProfile, type Result } from '../../game/domain/types';
import { createEnvelope, validateEnvelope, type SaveEnvelope } from '../schemas/saveSchema';

export function checksumOf(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function serializeEnvelope(profile: PlayerProfile): string {
  return JSON.stringify(createEnvelope(profile), null, 2);
}

export function parseSaveEnvelope(text: string): Result<SaveEnvelope> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return fail('invalid-import', 'empty');
  }
  if (text.length > 2_000_000) {
    return fail('invalid-import', 'too-large');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('invalid-import', 'json');
  }
  return validateEnvelope(parsed);
}

export function parseProfileFromImport(text: string): Result<PlayerProfile> {
  const envelope = parseSaveEnvelope(text);
  if (!envelope.ok) return envelope;
  return ok(envelope.value.profile);
}
