import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanArmurePortee } from '../../scripts/guards/lib/armurePortee.mjs';

/**
 * Garde-fou « armure portée résolue au noyau » (#2948, lot L1e) — ABSOLU : ni stock, ni baseline.
 * L'armure de statbloc déclarée portée (`armurePortee`) et la synthèse de ses pièces (`synthArmour`) se
 * résolvent dans `src/noyau/equipementDessine.ts` et nulle part ailleurs : aucun appel `synthArmour(`, aucune
 * lecture `.armurePortee` dans le CODE de production de `src/`, `scripts/` et `hotes/` (TypeScript, modules
 * Node, GDScript). Une clé littérale (`{ armurePortee: true }`) écrit, elle ne lit pas.
 *
 * FOYERS, exclus par NOM de fichier :
 *  — `src/noyau/equipementDessine.ts`, la résolution ;
 *  — `src/ui/editor/codex/CodexEdit.tsx`, l'éditeur du champ d'auteur (`AppearanceField`) : il affiche et
 *    ÉCRIT la valeur authorée, il ne résout aucun dessin (lecteur recensé par `src/data/field-consumers.test.ts`).
 * Hors corpus : les instruments Vitest, qui posent ou lisent la PRÉMISSE d'un record sans rien dessiner.
 */

const SCAN_DIRS = ['src', 'scripts', 'hotes'];
const EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.gd'];
const FOYERS = new Set(['src/noyau/equipementDessine.ts', 'src/ui/editor/codex/CodexEdit.tsx']);

const corpus = () => readCorpus(SCAN_DIRS, { exts: EXTS }).filter((f) => !FOYERS.has(f.rel));

describe('garde-fou « armure portée » — résolue au seul noyau (ABSOLU, #2948)', () => {
  it('aucun `synthArmour(` ni lecture `.armurePortee` hors de `src/noyau/equipementDessine.ts`', () => {
    const offenders = corpus().flatMap(({ rel, text }) => scanArmurePortee(rel, text).map((x) => `${rel}:${x.line} — ${x.detail}`));
    expect(
      offenders,
      'Armure portée résolue hors du noyau — appeler `equipementDessine` / `equipementDEntite` ' +
        `(src/noyau/equipementDessine.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('le corpus scanné couvre chaque racine et chaque langage de la règle, et chaque FOYER exclu existe', () => {
    const lu = readCorpus(SCAN_DIRS, { exts: EXTS });
    const fichiers = corpus();
    for (const racine of SCAN_DIRS) expect(fichiers.some((f) => f.rel.startsWith(`${racine}/`)), racine).toBe(true);
    for (const ext of EXTS) expect(fichiers.some((f) => f.rel.endsWith(ext)), ext).toBe(true);
    for (const foyer of FOYERS) expect(lu.some((f) => f.rel === foyer), foyer).toBe(true);
  });

  it.each([
    ['appel', 'const a = synthArmour(c.armour, true);'],
    ['lecture', 'if (cd.armurePortee) x();'],
    ['lecture optionnelle', 'const p = ov?.armurePortee ?? rec?.appearance?.armurePortee;'],
  ])('MORD : %s', (_nom, code) => {
    expect(scanArmurePortee('x.ts', code).length).toBeGreaterThan(0);
  });

  it('MORD en GDScript', () => {
    expect(scanArmurePortee('x.gd', 'if apparence.armurePortee:\n\tpass')).toHaveLength(1);
  });

  it.each([
    ['clé littérale', 'const o = { armurePortee: true };'],
    ['commentaire', '// lit `c.armurePortee` puis synthArmour(pa)'],
    ['chaîne', "const s = 'ov.armurePortee synthArmour(x)';"],
    ['commentaire GDScript', '# apparence.armurePortee'],
  ])('ne mord PAS : %s', (_nom, code) => {
    expect(scanArmurePortee(_nom.includes('GDScript') ? 'x.gd' : 'x.ts', code)).toEqual([]);
  });
});
