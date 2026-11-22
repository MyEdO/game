import { describe, it, expect, vi } from 'vitest';
import { API } from 'typescript/unstable/sync';
import { readFileSync } from 'node:fs';
import { computeOwnerSystems, scanAllPrimitives, scanGenericDomainImport } from '../../scripts/guards/lib/genericDomainImport.mjs';

// #329

/** Le manifeste réel des primitives génériques est mesuré avec les fermetures d’import des systèmes. */
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

  it('FAIL-CLOSED : une primitive fictive important un module single-système est DÉTECTÉE', () => {
    const ownerSystems = new Map<string, string[]>([['src/noyau/shipManeuver.ts', ['combat-naval']]]);
    const contenu = "import { rollCrewRole } from '../noyau/shipManeuver';\n";
    const found = scanGenericDomainImport('src/lib/FakePrimitive.ts', contenu, ownerSystems);
    expect(found).toEqual([{ target: 'src/noyau/shipManeuver.ts', systemId: 'combat-naval' }]);
  });

  const stockage = 'src/lib/stockage.ts';
  const objet = 'src/lib/objet.mjs';
  const primitivesDeLaSonde = [{ id: 'stockage', fichier: stockage }];

  it('un propriétaire unique HÉRITÉ de la primitive (seul son système la pose) n’est PAS domanial', () => {
    const systemes = [{ id: 'banc', modules: ['src/lib/stockage.testkit.ts'] }];
    expect(computeOwnerSystems(systemes).get(objet)).toEqual(['banc']);
    expect(scanAllPrimitives(primitivesDeLaSonde, systemes)).toEqual([]);
  });

  it('FAIL-CLOSED : un système qui atteint la cible SANS la primitive la rend domaniale', () => {
    const systemes = [{ id: 'objets', modules: [objet] }];
    expect(scanAllPrimitives(primitivesDeLaSonde, systemes)).toEqual([
      { primitiveId: 'stockage', fichier: stockage, target: objet, systemId: 'objets' },
    ]);
  });

  it('FAIL-CLOSED : un module partagé par 2 systèmes (infra transverse) n’est PAS signalé', () => {
    const ownerSystems = new Map<string, string[]>([['src/engine/psychology.ts', ['combat', 'psychologie']]]);
    const contenu = "import type { TypeAcquis } from '../../engine/psychology';\n";
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
      { id: 'premier', fichier: 'src/lib/BatchA.ts' },
      { id: 'second', fichier: 'src/lib/BatchB.ts' },
      { id: 'alias', fichier: 'src/lib/../lib/BatchA.ts' },
      { id: 'dernier', fichier: 'src/lib/BatchA.ts' },
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
        return fichier.endsWith('BatchB.ts') ? "import './ordre.mjs';" : "import './coupeAuMot.mjs';";
      });
      expect(lectures).toEqual(['src/lib/BatchA.ts', 'src/lib/BatchB.ts', 'src/lib/../lib/BatchA.ts', 'src/lib/BatchA.ts', 'src/lib/ordre.mjs']);
      expect(findings).toEqual([
        { primitiveId: 'premier', fichier: 'src/lib/BatchA.ts', target: 'src/lib/coupeAuMot.mjs', systemId: 'coupe' },
        { primitiveId: 'alias', fichier: 'src/lib/../lib/BatchA.ts', target: 'src/lib/coupeAuMot.mjs', systemId: 'coupe' },
        { primitiveId: 'dernier', fichier: 'src/lib/BatchA.ts', target: 'src/lib/coupeAuMot.mjs', systemId: 'coupe' },
      ]);
      expect(fermetures).toHaveBeenCalledTimes(2);
    } finally { fermetures.mockRestore(); }
  });

  it('deux lectures différentes d’un même chemin sont refusées avant le batch des primitives', () => {
    const primitives = [{ id: 'a', fichier: 'src/lib/BatchA.ts' }, { id: 'alias', fichier: 'src/lib/../lib/BatchA.ts' }];
    const lectures: string[] = [];
    expect(() => scanAllPrimitives(primitives, [], (fichier) => {
      lectures.push(fichier);
      return fichier === primitives[0].fichier ? 'export const a = 1;' : 'export const a = 2;';
    })).toThrow(/scanAllPrimitives : textes différents pour le même chemin/);
    expect(lectures).toEqual(primitives.map((p) => p.fichier));
  });
});
