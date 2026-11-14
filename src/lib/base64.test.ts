/**
 * `enBase64` et `depuisBase64` (#3948) : les vecteurs de la RFC 4648 (section 10), un aller-retour au-delà d'un bloc de
 * `String.fromCharCode`, et un texte refusé.
 */
import { describe, expect, it } from 'vitest';
import { depuisBase64, enBase64 } from './base64';

const octetsDe = (texte: string) => new TextEncoder().encode(texte);

describe('base64', () => {
  it('rend les vecteurs de la RFC 4648, et les relit', () => {
    const vecteurs: [string, string][] = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg=='], ['fooba', 'Zm9vYmE='], ['foobar', 'Zm9vYmFy']];
    for (const [clair, code] of vecteurs) {
      expect(enBase64(octetsDe(clair))).toBe(code);
      expect(new TextDecoder().decode(depuisBase64(code))).toBe(clair);
    }
  });

  it('fait l’aller-retour de chaque valeur d’octet sur plusieurs blocs', () => {
    const octets = Uint8Array.from({ length: 3 * 0x8000 + 7 }, (_, i) => (i * 37) % 256);
    expect(depuisBase64(enBase64(octets))).toEqual(octets);
  });

  it('refuse un texte qui n’est pas du base64', () => {
    expect(() => depuisBase64('pas du base64 !')).toThrow();
  });
});
