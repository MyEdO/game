/**
 * Compression des payloads coop : deflate-raw natif (CompressionStream, zéro dépendance)
 * + base64url. Les snapshots/campagne (~10:1 sur du JSON d'état) voyagent en champ `z` des
 * enveloppes relay — l'enveloppe elle-même reste en clair pour le routage par le DO.
 */
import { depuisBase64, enBase64 } from '../../lib/base64';

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const out = await new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

function toBase64Url(bytes: Uint8Array): string {
  return enBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    return depuisBase64(s.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
}

export async function deflateB64(text: string): Promise<string> {
  const deflated = await pipeThrough(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  return toBase64Url(deflated);
}

/** Base64url collé du réseau → texte, ou null (entrée non fiable). */
export async function inflateB64(b64: string): Promise<string | null> {
  const bytes = fromBase64Url(b64);
  if (!bytes || !bytes.length) return null;
  try {
    const inflated = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(inflated);
  } catch {
    return null;
  }
}
