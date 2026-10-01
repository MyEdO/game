/**
 * FRONTIÈRE `src/state` ↛ `src/gameIso` — garde STRUCTURELLE (#1715).
 *
 * CLAUDE.md règle 3 : « Le moteur de règles (`src/engine`) reste pur et testé. Le store, l'UI et le
 * rendu en dépendent, jamais l'inverse. » Le rendu (`src/gameIso`) se sert du store ; le store ne se
 * sert JAMAIS du rendu. L'en-tête de `state/sceneEdit.ts` porte la même consigne en prose (« NE JAMAIS
 * importer `../ui/` ni `../gameIso/` ici ») — la prose ne refuse rien, ce test refuse.
 *
 * L'occasion mesurée : la dérivation des toitures avait besoin de la couverture du TYPE de bâtiment
 * (`buildings.json › roofMaterial`), dont la façade vivait dans `gameIso/catalog/buildings` ; c'est la
 * FAÇADE qui a déménagé (`state/buildings.ts`, patron `state/terrain/index.ts` #1690), le store n'a pas
 * traversé la frontière pour aller la chercher.
 *
 * MÉCANIQUE réutilisée, jamais un 2ᵉ parseur d'imports : `specificateursDe` + `resolveImport`
 * (`scripts/guards/lib/importGraph.mjs`, partagés avec `genericDomainImport` et le graphe des
 * systèmes). Sont vus les imports statiques, de type, dynamiques (`import('…')`), à effet de bord et
 * `require`.
 *
 * PÉRIMÈTRE : les sources de PRODUCTION de `src/state/**`. Les `*.test.ts(x)` sont hors scan — un test
 * de state compose légitimement un builder ou un écran pour mesurer un bout-en-bout (26 imports de
 * cette forme mesurés le 2026-09-09). La direction `src/state` → `src/ui` est une AUTRE frontière,
 * hors périmètre de cette garde : elle porte 3 sites de production le 2026-09-09
 * (`combatManeuvers.ts`, `revealStep.ts` → `ui/icons` ; `roster.ts` → `ui/creator/draft`).
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolveImport, specificateursDe } from '../../scripts/guards/lib/importGraph.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { detenteur } from '../detenteur.testkit';

const SRC = fileURLToPath(new URL('../', import.meta.url)).split('\\').join('/');
const STATE = `${SRC}state`;
const RENDU = `${SRC}gameIso/`;

/** Sources de PRODUCTION de `src/state`, récursivement, avec leur texte : marche et lecture viennent
 *  de la primitive de corpus (`readCorpus`, `*.test.*` hors corpus). Le chemin est rendu absolu à
 *  séparateur `/` — la forme que `resolveImport` compare à `RENDU`. */
function sourcesDeState(): { chemin: string; texte: string }[] {
  return readCorpus(['src/state']).map(({ abs, text }) => ({ chemin: abs.split('\\').join('/'), texte: text }));
}

/** Les imports d'un module qui atteignent `src/gameIso`, en `spécificateur → cible relative à src/`.
 *  PUR : le texte est un paramètre, si bien que le cas planté ci-dessous n'a besoin d'aucun fichier. */
export function importsDuRendu(fichierAbs: string, texte: string): { spec: string; cible: string }[] {
  const out: { spec: string; cible: string }[] = [];
  for (const { spec } of specificateursDe(fichierAbs, texte)) {
    const cible = resolveImport(fichierAbs, spec);
    if (cible && cible.startsWith(RENDU)) out.push({ spec, cible: cible.slice(SRC.length) });
  }
  return out;
}

describe('frontière state → gameIso (CLAUDE.md règle 3)', () => {
  const fichiers = detenteur(() => sourcesDeState());

  it('le scan voit bien les sources de production de src/state (preuve de câblage)', () => {
    expect(fichiers().length).toBeGreaterThan(50);
    expect(fichiers().some((f) => f.chemin.endsWith('/state/sceneEdit.ts'))).toBe(true);
    expect(fichiers().some((f) => estFichierVitest(f.chemin))).toBe(false);
  });

  it('cas planté : un import du rendu est VU, un import de state ne l’est pas (preuve TDD)', () => {
    const faux = `${STATE}/sonde-plantee.ts`;
    expect(importsDuRendu(faux, "import { buildRoofs } from '../gameIso/builders/roofs';")).toEqual([
      { spec: '../gameIso/builders/roofs', cible: 'gameIso/builders/roofs.ts' },
    ]);
    expect(importsDuRendu(faux, "const m = await import('../gameIso/builders/roofs');")).toHaveLength(1);
    expect(importsDuRendu(faux, "import { roofHidden } from './buildings';")).toEqual([]);
    expect(importsDuRendu(faux, "import { materials } from '../data';")).toEqual([]);
  });

  it('aucune source de production de src/state n’importe src/gameIso', () => {
    const fautes: string[] = [];
    for (const f of fichiers())
      for (const { spec, cible } of importsDuRendu(f.chemin, f.texte))
        fautes.push(`${f.chemin.slice(SRC.length)} → ${cible}  (« ${spec} »)`);
    expect(
      fautes,
      'Le store importe le RENDU : le rendu dépend du store, jamais l’inverse (CLAUDE.md règle 3). ' +
        'Une donnée dont le store a besoin se lit par une façade qui vit dans `src/state` (patron ' +
        '`state/terrain/index.ts`, `state/buildings.ts`), jamais par un aller-retour dans `src/gameIso`.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });
});
