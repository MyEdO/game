/**
 * CE QU'UN HÔTE EXTERNE IMPORTE NE CHARGE AUCUN HÔTE (#2817 D9, #2898, #2928, épique #2882) : la fermeture d'exécution
 * de chaque entrée de `ENTREES_FERMEES` (la surface `src/noyau/index.ts`, les scénarios de test qu'un hôte lance, les
 * modules du module commun des hôtes, l'entrée de l'hôte texte, les modules des hôtes externes dont le pont de Godot)
 * n'atteint ni `state`, `ui`, `gameIso`, `web`, `net`, `audio`, ni `react`, `zustand` ou `three`. La mesure vit dans
 * `scripts/guards/lib/fermetureDuNoyau.mjs`, qui dit pourquoi la table `COUCHES` ne l'implique pas.
 */
import { beforeAll, describe, it, expect } from 'vitest';
import { mesure as mesurer, paquetDe, ENTREES_FERMEES } from '../../scripts/guards/lib/fermetureDuNoyau.mjs';
import { SURFACE_DU_NOYAU } from '../../scripts/guards/lib/couches.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { detenteur } from '../detenteur.testkit';

/** Les témoins d'une lecture vivante, par entrée qui importe : sans eux, une lecture cassée rendrait la garde verte en
 *  ne lisant plus rien. Les entrées du commun des hôtes se lisent dans l'arbre, sans ligne ici : l'entrée de l'hôte
 *  texte, qui les importe, témoigne de leur lecture. */
const TEMOINS: Readonly<Partial<Record<string, readonly string[]>>> = {
  [SURFACE_DU_NOYAU]: ['src/noyau/partie.ts', 'src/engine/combat.ts'],
  'src/scenes/test-scenarios/index.ts': ['src/scenes/test-scenarios/_shared.ts', 'src/scenes/campaign.ts', 'src/noyau/worldMap.ts'],
  'src/hoteTexte/serveur.ts': ['src/hoteTexte/partieTexte.ts', 'src/hoteTexte/vue.ts', 'src/hoteTexte/outils.ts', 'src/hote/partie.ts', 'src/hote/geste.ts', 'src/hote/projection.ts', SURFACE_DU_NOYAU, 'src/scenes/test-scenarios/index.ts'],
  'hotes/godot/pont/entree.ts': ['hotes/godot/pont/pont.ts', 'src/hote/partie.ts', 'src/hote/geste.ts', 'src/hote/projection.ts', SURFACE_DU_NOYAU, 'src/scenes/test-scenarios/index.ts'],
};

it('les entrées : la surface, les scénarios, chaque module du commun des hôtes et des hôtes externes lu dans l’arbre, l’entrée de l’hôte texte', () => {
  expect(ENTREES_FERMEES).toEqual(expect.arrayContaining(Object.keys(TEMOINS)));
  expect(ENTREES_FERMEES.filter((e) => e.startsWith('src/hote/')), 'le commun des hôtes ne se lit plus').toEqual(expect.arrayContaining(['src/hote/formes.ts', 'src/hote/geste.ts', 'src/hote/partie.ts', 'src/hote/projection.ts']));
  expect(ENTREES_FERMEES.filter((e) => e.startsWith('hotes/')), 'les hôtes externes ne se lisent plus').toEqual(expect.arrayContaining(['hotes/godot/pont/entree.ts', 'hotes/godot/pont/pont.ts']));
  expect(ENTREES_FERMEES.filter((e) => e.endsWith('.testkit.ts')), 'ni kit de test').toEqual([]);
  expect(ENTREES_FERMEES.filter((e) => estFichierVitest(e) || e.endsWith('.generated.ts')), 'ni suite ni module généré ignoré').toEqual([]);
});

it('les paquets de la fermeture se lisent (témoin : `zod`, depuis la surface)', () => {
  expect(mesurer({ depart: SURFACE_DU_NOYAU }).paquets).toContain('zod');
}, 120_000);

describe.each(ENTREES_FERMEES)('%s : sa fermeture d’exécution ne charge aucun hôte', (depart) => {
  const mesure = detenteur(() => mesurer({ depart }));
  beforeAll(() => { mesure(); }, 120_000);

  it('aucun module d’une zone d’hôte, aucun paquet d’hôte', () => {
    expect(mesure().modules, 'la fermeture ne part plus de son entrée').toEqual(expect.arrayContaining([depart, ...(TEMOINS[depart] ?? [])]));
    const fautes = mesure().fautes.map((f) => f.chaine.join(' → '));
    expect(fautes, `${depart} charge un hôte — couper l'arc fautif :\n  ${fautes.join('\n  ')}`).toEqual([]);
  });
});

describe('surface du noyau : la mesure, sur fixtures', () => {
  const RACINE = '/depot-de-fixture';
  const arbre = (fichiers: Record<string, string>) => ({
    existe: (abs: string) => abs.slice(RACINE.length + 1) in fichiers,
    lire: (abss: string[]) => new Map(abss.map((abs) => [abs, fichiers[abs.slice(RACINE.length + 1)] ?? null] as const)),
    fichiers: Object.keys(fichiers).map((rel) => `${RACINE}/${rel}`),
  });

  it('nomme la chaîne d’un module d’hôte atteint en valeur, par un glob ou un import dynamique ; ignore un arc de type', () => {
    const r = mesurer({
      racine: RACINE,
      arbre: arbre({
        'src/noyau/index.ts': "export { a } from './a';\nimport type { T } from '../ui/t';\nconst m = import.meta.glob('../scenes/*.ts');\nvoid import('./d');",
        'src/noyau/a.ts': "import { x } from '../data/x';\nexport const a = x;",
        'src/data/x.ts': "import { s } from '../state/s';\nexport const x = s;",
        'src/state/s.ts': 'export const s = 1;',
        'src/ui/t.ts': 'export type T = number;',
        'src/scenes/g.ts': "import '../gameIso/rendu';",
        'src/gameIso/rendu.ts': 'export {};',
        'src/noyau/d.ts': "import 'react';",
      }),
    });
    expect(r.fautes.map((f) => f.chaine.join(' → ')).sort()).toEqual([
      'src/noyau/index.ts → src/noyau/a.ts → src/data/x.ts → src/state/s.ts',
      'src/noyau/index.ts → src/noyau/d.ts → react',
      'src/noyau/index.ts → src/scenes/g.ts → src/gameIso/rendu.ts',
    ]);
    expect(r.modules).not.toContain('src/ui/t.ts');
  });

  it('le nom de paquet d’un spécificateur nu, jamais d’un chemin ni d’un alias', () => {
    expect(['react', 'react/jsx-runtime', '@scope/nom/x', './a', '../b', '@/c', 'node:fs'].map(paquetDe))
      .toEqual(['react', 'react', '@scope/nom', null, null, null, null]);
  });
});
