import { describe, expect, it } from 'vitest';
import { hash32, hash32AuMillieme } from './hash';

describe('hash32AuMillieme (#3948)', () => {
  const base = [0.5, -1.25, 3, 0.001, 42.125];

  it('déterministe, entier non signé de 32 bits', () => {
    const h = hash32AuMillieme(base);
    expect(hash32AuMillieme([...base])).toBe(h);
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
  });

  it('sensible à chaque valeur, au millième près', () => {
    const empreintes = new Set(base.map((_, i) => hash32AuMillieme(base.map((v, j) => (j === i ? Math.round((v + 0.001) * 1000) / 1000 : v)))));
    expect(empreintes.size).toBe(base.length);
    expect(empreintes.has(hash32AuMillieme(base))).toBe(false);
  });

  it('sensible à l’ordre et à la longueur', () => {
    expect(hash32AuMillieme([...base].reverse())).not.toBe(hash32AuMillieme(base));
    expect(hash32AuMillieme([...base, 0])).not.toBe(hash32AuMillieme(base));
    expect(hash32AuMillieme([0])).not.toBe(hash32AuMillieme([]));
    expect(hash32AuMillieme([3], hash32AuMillieme([1, 2])), 'deux tableaux chaînés ne se confondent pas à leur frontière').not.toBe(hash32AuMillieme([2, 3], hash32AuMillieme([1])));
  });

  it('poursuit l’empreinte de départ : un autre départ, une autre empreinte', () => {
    expect(hash32AuMillieme(base, hash32('a'))).not.toBe(hash32AuMillieme(base, hash32('b')));
    expect(hash32AuMillieme(base, hash32('a'))).not.toBe(hash32AuMillieme(base));
  });

  it('hache des octets comme des nombres', () => {
    expect(hash32AuMillieme(Uint8Array.from([0, 255, 0]))).toBe(hash32AuMillieme([0, 255, 0]));
    expect(hash32AuMillieme(Uint8Array.from([0, 255, 0]))).not.toBe(hash32AuMillieme(Uint8Array.from([0, 0, 255])));
  });
});
