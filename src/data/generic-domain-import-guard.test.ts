import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeOwnerSystems, scanAllPrimitives, scanGenericDomainImport } from '../../scripts/guards/lib/genericDomainImport.mjs';
import { directImportsOf } from '../../scripts/guards/lib/importGraph.mjs';

/**
 * Garde-fou « le générique n'importe pas le domanial » (#329 — recensement adversarial, classe (a)
 * « marque de naissance »). Un fichier listé comme PRIMITIVE générique (`src/data/primitives.manifest.json`)
 * ne doit IMPORTER (relatif, direct) AUCUN module appartenant, par closure racine
 * (`src/data/systemes.manifest.json`, même mécanique que `scripts/docs/build-systemes.mjs` —
 * `scripts/guards/lib/importGraph.mjs`), à UN SEUL système. Un module atteint par ≥2 systèmes est
 * de l'infra partagée légitime (pas domanial) ; un module atteint par exactement 1 système, importé
 * DIRECTEMENT par une primitive, est exactement la faute-souche relevée par #329 (ex. `cascade.ts`
 * → `shipManeuver.ts`, `CascadeModal.tsx` → `crewMorale.ts`/`data` naval — RÉSOLUES depuis par le
 * lot en vol sur #328/#329, cf. tableau du ticket). Ce système doit l'atteindre SANS traverser la
 * primitive : un propriétaire HÉRITÉ de la primitive (seul son système la pose) ne rend pas sa
 * dépendance domaniale.
 *
 * BASELINE NOMINATIVE (état RÉEL de l'arbre au 2026-07-11, renvoi #329) : AUCUNE marque (a) ouverte
 * ne correspond au motif « import direct d'un module single-système » à cette date — les items #1,
 * #2, #3, #6, #7, #8 du tableau #329 sont déjà résorbés (lot en vol) ; les items #4/#5 (littéral
 * `worldSide:'ship'`/`shipId` dans `rollSeam.ts`) et l'ajout USER du 2026-07-11 (`peur` calculé
 * inline dans `CascadeModal.tsx`) sont des fautes de TYPE/VOCABULAIRE et d'ARITHMÉTIQUE dupliquée —
 * pas des imports de module domanial — donc HORS PÉRIMÈTRE de cette mécanique précise (traités par
 * les lots 3-4 annoncés sur #329, pas par cette garde). Baseline = `{}` : CLIQUET zéro-tolérance,
 * toute HAUSSE échoue.
 */

/**
 * Baseline gelée : `primitiveId -> nombre de cibles domaniales tolérées` (renvoi #329 par entrée).
 * VIDE, et elle le reste : un ORGANISME de domaine (panneau, plateau) se DÉCLARE au manifeste
 * (`nature: 'organisme'`) et sort du corpus mesuré — il n'entre pas ici en dette chiffrée, qui
 * rendrait le cliquet inerte sans le dire (#1806).
 */
const BASELINES: Record<string, number> = {};

/** `scanAllPrimitives` lit les fichiers via des chemins relatifs à la racine repo (cwd du runner).
 *  Scan de l'arbre RÉEL, donc mémoïsé PARESSEUSEMENT : les deux `it` du cliquet lisent le même
 *  résultat, et rien n'est payé à la collecte des tests. */
let _findings: ReturnType<typeof scanAllPrimitives> | undefined;
function loadFindings() {
  if (!_findings) {
    const primitives = JSON.parse(readFileSync('src/data/primitives.manifest.json', 'utf8'));
    const systemes = JSON.parse(readFileSync('src/data/systemes.manifest.json', 'utf8'));
    _findings = scanAllPrimitives(primitives, systemes);
  }
  return _findings;
}

describe('garde-fou « le générique n’importe pas le domanial » (cliquet, #329)', () => {
  it('aucune primitive de src/data/primitives.manifest.json ne dépasse sa baseline gelée', () => {
    const findings = loadFindings();
    const counts: Record<string, number> = {};
    for (const f of findings) counts[f.primitiveId] = (counts[f.primitiveId] ?? 0) + 1;
    const offenders: string[] = [];
    for (const [primitiveId, n] of Object.entries(counts)) {
      const baseline = BASELINES[primitiveId] ?? 0;
      if (n > baseline) {
        const detail = findings
          .filter((f) => f.primitiveId === primitiveId)
          .map((f) => `${f.fichier} → ${f.target} (système « ${f.systemId} »)`)
          .join(', ');
        offenders.push(`${primitiveId} : ${n} import(s) domanial(aux) (baseline gelée ${baseline}) — ${detail}`);
      }
    }
    expect(
      offenders,
      'Import de domaine dans une primitive GÉNÉRIQUE — router via un registre par kind (patron ' +
        `cascadeAppliers), ou si legit AUGMENTER la baseline avec renvoi #329 :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (primitive assainie) doit être ABAISSÉE', () => {
    const findings = loadFindings();
    const counts: Record<string, number> = {};
    for (const f of findings) counts[f.primitiveId] = (counts[f.primitiveId] ?? 0) + 1;
    const stale: string[] = [];
    for (const [primitiveId, baseline] of Object.entries(BASELINES)) {
      const n = counts[primitiveId] ?? 0;
      if (n < baseline) stale.push(`${primitiveId} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });

  /** BORNE de la déclaration `nature: 'organisme'` : sans elle, n'importe quelle entrée s'auto-
   *  déclarerait organisme pour sortir du corpus mesuré. Un organisme n'existe au manifeste QUE pour le
   *  module CSS qu'il POSSÈDE : il porte donc `css`, et AUCUNE autre entrée du manifeste n'importe son
   *  `fichier` — une primitive que d'autres primitives COMPOSENT est générique, et le reste. Le SENS
   *  compte : c'est d'être importé qui disqualifie, pas d'importer (`InspectPanel` importe `ShipSheet`,
   *  et cela ne lui retire pas sa nature d'organisme). */
  it('un `organisme` possède un module CSS et n’est composé par AUCUNE autre entrée du manifeste', () => {
    const primitives: { id: string; fichier: string; css?: string; nature?: string }[] = JSON.parse(
      readFileSync('src/data/primitives.manifest.json', 'utf8'),
    );
    const organismes = primitives.filter((p) => p.nature === 'organisme');
    expect(organismes.length, 'la déclaration doit rester rare et mesurée').toBeGreaterThan(0);
    const fautes: string[] = [];
    for (const o of organismes) {
      if (!o.css) fautes.push(`${o.id} : « organisme » sans champ css — il n’a alors aucune raison d’être au manifeste`);
      const composeurs = primitives
        .filter((p) => p.fichier !== o.fichier)
        .filter((p) => directImportsOf(p.fichier, readFileSync(p.fichier, 'utf8')).includes(o.fichier))
        .map((p) => p.id);
      if (composeurs.length) {
        fautes.push(`${o.id} : composé par ${composeurs.join(', ')} — une primitive que d'autres composent est GÉNÉRIQUE, elle assainit ses imports au lieu de se déclarer organisme`);
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : une primitive fictive important un module single-système est DÉTECTÉE', () => {
    const ownerSystems = new Map<string, string[]>([['src/state/shipManeuver.ts', ['combat-naval']]]);
    const contenu = "import { rollCrewRole } from '../state/shipManeuver';\n";
    const found = scanGenericDomainImport('src/ui/FakePrimitive.tsx', contenu, ownerSystems);
    expect(found).toEqual([{ target: 'src/state/shipManeuver.ts', systemId: 'combat-naval' }]);
  });

  it('un propriétaire unique HÉRITÉ de la primitive (seul son système la pose) n’est PAS domanial', () => {
    const primitives = [{ id: 'errorBoundary', fichier: 'src/ui/SceneErrorBoundary.tsx' }];
    const systemes = [{ id: 'editeur', modules: ['src/ui/editor/Editor.tsx'] }];
    expect(computeOwnerSystems(systemes).get('src/ui/errorCollector.ts')).toEqual(['editeur']);
    expect(scanAllPrimitives(primitives, systemes)).toEqual([]);
  });

  it('FAIL-CLOSED : un système qui atteint la cible SANS la primitive la rend domaniale', () => {
    const primitives = [{ id: 'errorBoundary', fichier: 'src/ui/SceneErrorBoundary.tsx' }];
    const systemes = [{ id: 'bandeau', modules: ['src/ui/ErrorCollectorBanner.tsx'] }];
    expect(scanAllPrimitives(primitives, systemes)).toEqual([
      { primitiveId: 'errorBoundary', fichier: 'src/ui/SceneErrorBoundary.tsx', target: 'src/ui/errorCollector.ts', systemId: 'bandeau' },
    ]);
  });

  it('FAIL-CLOSED : un module partagé par 2 systèmes (infra transverse) n’est PAS signalé', () => {
    const ownerSystems = new Map<string, string[]>([['src/engine/psychology.ts', ['combat', 'psychologie']]]);
    const contenu = "import type { PsychType } from '../../engine/psychology';\n";
    const found = scanGenericDomainImport('src/state/pendings.ts', contenu, ownerSystems);
    expect(found).toEqual([]);
  });
});
