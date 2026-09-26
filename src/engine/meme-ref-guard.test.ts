import { describe, it, expect } from 'vitest';
import { scanMemeRef } from '../../scripts/guards/lib/memeRef.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { memeRef, refKey } from './careerSlots';

/**
 * Garde « même référence » (#1473) : aucun code de `src/` hors tests ne recode l'égalité (id, spec) par
 * `(… spec ?? '') ===` ni par `….id === … && ….spec ===` ; il lit `memeRef` (`careerSlots.ts`). Baseline ZÉRO,
 * aucune liste de sites tolérés.
 */
const GARDE = {
  question: 'Quel site de `src/` recode l’identité (id, spec) d’une référence au lieu de lire `memeRef` ? Réponse attendue : aucun.',
  primitive: '`scanMemeRef` (`scripts/guards/lib/memeRef.mjs`) sur la vue CODE SEUL du corpus `readCorpus([\'src\'])`.',
  perimetre: '`src/**/*.ts(x)` hors instruments Vitest : un test peut écrire le motif pour le prouver.',
  angleMort: [
    'Une comparaison qui normalise autrement (`s.spec || \'\'`, `String(s.spec)`) échappe au motif.',
    'Une conjonction écrite sur plusieurs lignes, ou dont les membres sont inversés (`….spec === … && ….id ===`), échappe au motif.',
  ],
  ticket: '#1473',
} as const;

describe('garde « même référence » — un seul prédicat (#1473)', () => {
  it(GARDE.question, () => {
    const sites = readCorpus(['src']).flatMap(({ rel, text }) => scanMemeRef(text).map((f) => `${rel}:${f.line} ${f.detail}`));
    expect(sites, `lire memeRef (src/engine/careerSlots.ts) :\n${sites.join('\n')}`).toEqual([]);
  });

  it('memeRef est l’égalité des refKey : spec absente et spec vide sont la même référence', () => {
    expect(memeRef({ id: 'metier', spec: 'forgeron' }, { id: 'metier', spec: 'forgeron' })).toBe(true);
    expect(memeRef({ id: 'metier', spec: 'forgeron' }, { id: 'metier', spec: 'imprimerie' })).toBe(false);
    expect(memeRef({ id: 'metier' }, { id: 'metier', spec: '' })).toBe(true);
    expect(memeRef({ id: 'metier' }, { id: 'savoir' })).toBe(false);
    expect(refKey('metier', '')).toBe(refKey('metier'));
  });
});
