/** Les arêtes dessinées sur les scènes des campagnes du jeu de rôle (`areteDessinee`, `src/noyau/monde/aretes.ts`). */
import { describe, it, expect } from 'vitest';
import { aretesDeLaScene, natureDOuverture, type AreteDessinee } from '../../../src/noyau/monde/aretes';
import { paquetDuJeu } from '../../../src/noyau/index';
import type { Scene } from '../../../src/noyau/monde/scene';
import { edgeKey } from '../../../src/noyau/monde/facades';
import { campagnes } from '../campagnes';

describe('areteDessinee — les ouvertures des campagnes livrées (#4471)', () => {
  /** Les ouvertures de `scene` : pour chacune, sa largeur, sa famille et ses positions dans l'ordre de son sens, la
   *  suite d'arêtes d'une nature d'ouverture (`natureDOuverture`) qui part d'une `seule` ou d'une `gauche` et avance
   *  d'un `sens` jusqu'à sa `droite`. */
  const ouvertures = (scene: Scene) => {
    const segs = new Map((scene.walls ?? []).map((seg) => [edgeKey(seg), seg]));
    const aretes = aretesDeLaScene(scene).filter((a) => natureDOuverture(scene, segs.get(a.cle)!));
    const lieu = (a: AreteDessinee, d = 0) =>
      `${a.cases[0].z}|${a.milieu.x + d * a.sens.x},${a.milieu.y + d * a.sens.y}|${a.sens.x},${a.sens.y}`;
    const parLieu = new Map(aretes.map((a) => [lieu(a), a]));
    return aretes.filter((a) => a.position === 'seule' || a.position === 'gauche').map((premiere) => {
      const suite = [premiere];
      let a = premiere;
      while (a.position !== 'seule' && a.position !== 'droite') {
        const suivante = parLieu.get(lieu(a, 1));
        if (!suivante) break;
        suite.push(suivante);
        a = suivante;
      }
      return { largeur: suite.length, famille: premiere.famille, positions: suite.map((a) => a.position), suite };
    });
  };
  const livrees = campagnes.flatMap((c) => paquetDuJeu(c).scenes.map((scene) => ({ c, scene })));
  const mesurees = livrees.flatMap(({ c, scene }) =>
    ouvertures(scene).map((o) => ({ ...o, ou: `${c.id}/${scene.id}` })));
  it('chaque ouverture va de -X à +X le long de son sens commun', () => {
    for (const { positions, suite, ou } of mesurees) {
      const attendues = positions.length === 1 ? ['seule']
        : ['gauche', ...Array<string>(positions.length - 2).fill('milieu'), 'droite'];
      expect(positions, ou).toEqual(attendues);
      for (const a of suite) expect(a.sens, ou).toEqual(suite[0].sens);
    }
  });
});
