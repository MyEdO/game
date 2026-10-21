/**
 * CE QU'UN HÔTE EXTERNE IMPORTE NE CHARGE AUCUN HÔTE (#2817 D9, #2898, épique #2882) : la fermeture d'exécution de
 * chaque entrée de `ENTREES_FERMEES` (la surface `src/noyau/index.ts`, les scénarios de test qu'un hôte lance, l'entrée
 * de l'hôte texte) n'atteint ni `state`, `ui`, `gameIso`, `web`, `net`, `audio`, ni `react`. La mesure vit dans
 * `scripts/guards/lib/fermetureDuNoyau.mjs`, qui dit pourquoi la table `COUCHES` ne l'implique pas.
 */
import { beforeAll, describe, it, expect } from 'vitest';
import { mesure as mesurer, paquetDe, ENTREES_FERMEES } from '../../scripts/guards/lib/fermetureDuNoyau.mjs';
import { SURFACE_DU_NOYAU } from '../../scripts/guards/lib/couches.mjs';
import { detenteur } from '../detenteur.testkit';

/** Les témoins d'une lecture vivante, par entrée : sans eux, une lecture cassée rendrait la garde verte en ne
 *  lisant plus rien. */
const TEMOINS: Record<(typeof ENTREES_FERMEES)[number], readonly string[]> = {
  [SURFACE_DU_NOYAU]: ['src/noyau/partie.ts', 'src/engine/combat.ts'],
  'src/scenes/test-scenarios/index.ts': ['src/scenes/test-scenarios/_shared.ts', 'src/scenes/campaign.ts', 'src/noyau/worldMap.ts'],
  'src/hoteTexte/cli.ts': ['src/hoteTexte/partieTexte.ts', 'src/hoteTexte/vue.ts', SURFACE_DU_NOYAU, 'src/scenes/test-scenarios/index.ts'],
};

describe.each(ENTREES_FERMEES)('%s : sa fermeture d’exécution ne charge aucun hôte', (depart) => {
  const mesure = detenteur(() => mesurer({ depart }));
  beforeAll(() => { mesure(); }, 120_000);

  it('aucun module d’une zone d’hôte, aucun paquet d’hôte', () => {
    expect(mesure().modules, 'la fermeture ne part plus de son entrée').toEqual(expect.arrayContaining([depart, ...TEMOINS[depart]]));
    expect(mesure().paquets, 'les paquets de la fermeture ne se lisent plus').toContain('zod');
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
