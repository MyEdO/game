import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { emojisIn } from '../../scripts/guards/lib/emojiAffordance.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou anti-emoji (LOT 4) : les AFFORDANCES de l'UI passent par le registre d'icônes
 * (`src/ui/icons/` + `<Icon id>` / `<IconG id>`), plus jamais par un emoji dans le code ou la
 * donnée — et un emoji de LOG/journal/prose se retire tout autant (texte affiché à l'utilisateur).
 * Couverture EXHAUSTIVE par défaut : ce test de BUILD balaie TOUT `src/` (walk récursif, .ts/.tsx/
 * .json) ; il n'y a PAS de liste opt-in de dossiers (tout nouveau dossier naît couvert). Seules des
 * EXCLUSIONS explicites et justifiées existent (ci-dessous), chacune par NATURE, jamais par état de
 * migration.
 * Mécanique de détection (plages Unicode, glyphes tolérés `✓ ☰ …`, `emojisIn`) :
 * `scripts/guards/lib/emojiAffordance.mjs` (module .mjs pur, partagé avec le hook pre-commit).
 */

const SRC = 'src';

/** Exclusions par NATURE (jamais par état de migration) :
 *  - `*.test.*` : les tests portent les emojis de leurs composants non migrés et sont réécrits AVEC
 *    leur composant (ils ne rendent rien à l'utilisateur) ;
 *  - `_registry.generated.ts` : fichiers ÉMIS par scripts/gen-registry.mjs (en-tête « généré ») ;
 *  - `__snapshots__/` : instantanés Vitest générés, non édités à la main. */
const EXCLUDED = (rel: string): boolean =>
  estFichierVitest(rel) ||
  rel.endsWith('_registry.generated.ts') ||
  rel.includes('__snapshots__/');

describe('garde-fou anti-emoji (affordances → registre d’icônes)', () => {
  it('aucun emoji dans TOUT src/ (.ts/.tsx/.json), hors exclusions par nature', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus([SRC], { exts: ['.ts', '.tsx', '.json'], tests: true })) {
      if (EXCLUDED(rel)) continue;
      const hits = emojisIn(text);
      if (hits.length) offenders.push(`${rel} → ${hits.join(' ')}`);
    }
    expect(offenders, 'Emoji détecté — affordance : <Icon id> (src/ui/icons/) ; log/prose/donnée : texte nu').toEqual([]);
  });
});
