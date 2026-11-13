import { describe, expect, it } from 'vitest';
import { deflateB64, inflateB64 } from './compression';

describe('compress (deflate-raw + base64url)', () => {
  it('round-trip : texte → compressé → texte identique', async () => {
    const text = JSON.stringify({ party: Array.from({ length: 50 }, (_, i) => ({ id: `h${i}`, pv: 12 })) });
    expect(await inflateB64(await deflateB64(text))).toBe(text);
  });

  it('compresse réellement du JSON répétitif', async () => {
    const text = JSON.stringify(Array.from({ length: 200 }, () => ({ kind: 'snapshot', gameTime: 123456 })));
    expect((await deflateB64(text)).length).toBeLessThan(text.length / 5);
  });

  it('entrée corrompue → null, jamais d’exception', async () => {
    expect(await inflateB64('%%%pas-du-base64%%%')).toBeNull();
    expect(await inflateB64('AAAA')).toBeNull(); // base64 valide, deflate invalide
  });
});
