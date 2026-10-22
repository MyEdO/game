import { describe, it, expect, vi } from 'vitest';
import { API } from 'typescript/unstable/sync';
import { readFileSync } from 'node:fs';
import { computeOwnerSystems, scanAllPrimitives, scanGenericDomainImport } from '../../scripts/guards/lib/genericDomainImport.mjs';
import { directImportsOf } from '../../scripts/guards/lib/importGraph.mjs';
import { analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';

// #329

/** `scanAllPrimitives` lit les fichiers via des chemins relatifs à la racine repo (cwd du runner), sur
 *  l'arbre RÉEL. ABSOLUE : un ORGANISME de domaine (panneau, plateau) se DÉCLARE au manifeste
 *  (`nature: 'organisme'`) et sort du corpus mesuré, jamais en dette chiffrée (#1806). */
function loadFindings() {
  const primitives = JSON.parse(readFileSync('src/data/primitives.manifest.json', 'utf8'));
  const systemes = JSON.parse(readFileSync('src/data/systemes.manifest.json', 'utf8'));
  return scanAllPrimitives(primitives, systemes);
}

describe('garde-fou « le générique n’importe pas le domanial » (#329)', () => {
  it('aucune primitive de src/data/primitives.manifest.json n’importe un module de domaine', { timeout: 75_000 }, () => {
    const offenders = loadFindings().map((f) => `${f.primitiveId} : ${f.fichier} → ${f.target} (système « ${f.systemId} »)`);
    expect(
      offenders,
      `Import de domaine dans une primitive GÉNÉRIQUE — corriger ses imports ou vérifier sa nature au manifeste :\n${offenders.join('\n')}`,
    ).toEqual([]);
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
    const imports = new Map<string, string[]>();
    const fichiers = [...new Set(primitives.map((p) => p.fichier))].map((rel) => ({ rel, text: readFileSync(rel, 'utf8') }));
    for (const { fichier, sourceFile, diagnostics } of analyserCorpus(fichiers))
      imports.set(fichier.rel, directImportsOf(fichier.rel, sourceFile!, { diagnostics }));
    for (const o of organismes) {
      if (!o.css) fautes.push(`${o.id} : « organisme » sans champ css — il n’a alors aucune raison d’être au manifeste`);
      const composeurs = primitives
        .filter((p) => p.fichier !== o.fichier)
        .filter((p) => imports.get(p.fichier)!.includes(o.fichier))
        .map((p) => p.id);
      if (composeurs.length) {
        fautes.push(`${o.id} : composé par ${composeurs.join(', ')} — une primitive que d'autres composent est GÉNÉRIQUE, elle assainit ses imports au lieu de se déclarer organisme`);
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : une primitive fictive important un module single-système est DÉTECTÉE', () => {
    const ownerSystems = new Map<string, string[]>([['src/noyau/shipManeuver.ts', ['combat-naval']]]);
    const contenu = "import { rollCrewRole } from '../noyau/shipManeuver';\n";
    const found = scanGenericDomainImport('src/ui/FakePrimitive.tsx', contenu, ownerSystems);
    expect(found).toEqual([{ target: 'src/noyau/shipManeuver.ts', systemId: 'combat-naval' }]);
  });

  it('un propriétaire unique HÉRITÉ de la primitive (seul son système la pose) n’est PAS domanial', { timeout: 75_000 }, () => {
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
    const found = scanGenericDomainImport('src/noyau/pendings.ts', contenu, ownerSystems);
    expect(found).toEqual([]);
  });

  it('le cache amorcé par l’union garde les propriétaires de chaque clôture individuelle', () => {
    const close = API.prototype.close;
    const fermetures = vi.spyOn(API.prototype, 'close').mockImplementation(function (this: API) { return close.call(this); });
    try {
      const owners = computeOwnerSystems([
        { id: 'coupe', modules: ['src/lib/coupeAuMot.mjs'] },
        { id: 'commun', modules: ['src/lib/coupeAuMot.mjs', 'src/lib/ordre.mjs'] },
      ]);
      expect([...owners]).toEqual([
        ['src/lib/coupeAuMot.mjs', ['coupe', 'commun']],
        ['src/lib/ordre.mjs', ['commun']],
      ]);
      expect(fermetures).toHaveBeenCalledTimes(1);
    } finally { fermetures.mockRestore(); }
  });

  it('le batch des primitives conserve lectures, findings et chemins répétés dans leur ordre ; une cible qui est elle-même une primitive n’est pas domaniale', () => {
    const primitives = [
      { id: 'premier', fichier: 'src/ui/BatchA.tsx' },
      { id: 'second', fichier: 'src/ui/BatchB.tsx' },
      { id: 'organisme', fichier: 'src/ui/Ignore.tsx', nature: 'organisme' },
      { id: 'alias', fichier: 'src/ui/../ui/BatchA.tsx' },
      { id: 'dernier', fichier: 'src/ui/BatchA.tsx' },
      { id: 'composee', fichier: 'src/lib/ordre.mjs' },
    ];
    const systemes = [
      { id: 'coupe', modules: ['src/lib/coupeAuMot.mjs'] },
      { id: 'ordre', modules: ['src/lib/ordre.mjs'] },
    ];
    const lectures: string[] = [];
    const close = API.prototype.close;
    const fermetures = vi.spyOn(API.prototype, 'close').mockImplementation(function (this: API) { return close.call(this); });
    try {
      const findings = scanAllPrimitives(primitives, systemes, (fichier) => {
        lectures.push(fichier);
        if (fichier.endsWith('ordre.mjs')) return 'export const ordre = 1;';
        return fichier.endsWith('BatchB.tsx') ? "import '../lib/ordre.mjs';" : "import '../lib/coupeAuMot.mjs';";
      });
      expect(lectures).toEqual(['src/ui/BatchA.tsx', 'src/ui/BatchB.tsx', 'src/ui/../ui/BatchA.tsx', 'src/ui/BatchA.tsx', 'src/lib/ordre.mjs']);
      expect(findings).toEqual([
        { primitiveId: 'premier', fichier: 'src/ui/BatchA.tsx', target: 'src/lib/coupeAuMot.mjs', systemId: 'coupe' },
        { primitiveId: 'alias', fichier: 'src/ui/../ui/BatchA.tsx', target: 'src/lib/coupeAuMot.mjs', systemId: 'coupe' },
        { primitiveId: 'dernier', fichier: 'src/ui/BatchA.tsx', target: 'src/lib/coupeAuMot.mjs', systemId: 'coupe' },
      ]);
      expect(fermetures).toHaveBeenCalledTimes(2);
    } finally { fermetures.mockRestore(); }
  });

  it('deux lectures différentes d’un même chemin sont refusées avant le batch des primitives', () => {
    const primitives = [{ id: 'a', fichier: 'src/ui/BatchA.tsx' }, { id: 'alias', fichier: 'src/ui/../ui/BatchA.tsx' }];
    const lectures: string[] = [];
    expect(() => scanAllPrimitives(primitives, [], (fichier) => {
      lectures.push(fichier);
      return fichier === primitives[0].fichier ? 'export const a = 1;' : 'export const a = 2;';
    })).toThrow(/scanAllPrimitives : textes différents pour le même chemin/);
    expect(lectures).toEqual(primitives.map((p) => p.fichier));
  });
});
