/**
 * UNE COQUE TERRESTRE PAR LE PONT (#4576, #4471) : une coque terrestre en embuscade ne se sert pas parmi `corps.coques`
 * en exploration (`coquesEnVue`), non cachée elle s'y sert.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { drainer, enFocus, modelesCommites, servirLesModeles, table, vueDe } from './pont.testkit';
import type { Bouton, Element } from '../../../src/hote/elements';
import type { Pont } from './pont';
import { buildScene } from '../../../src/noyau/mapSpec';
import { campagneDeTest } from '../../../src/scenes/fixtures/contenuDuCommun';
import { paquetDuJeu } from '../../../src/noyau/index';

const COMMITES = await modelesCommites();
let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

const servi = paquetDuJeu(campagneDeTest);

/** La partie d'essai d'un pré où une diligence attend dans la rencontre `emb`, cachée selon `hidden`. */
function essaiDuPre(hidden: boolean) {
  const { pont, appel } = table();
  ouvert = pont;
  const scene = buildScene({
    id: 'pre-a-la-diligence', label: 'Pré', size: [24, 8], terrain: 'herbe', ambientLight: 'jour', heroStart: [1, 4], entities: [],
    encounters: [{ id: 'emb', hidden, enemies: [{ vehicule: { id: 'diligence' }, pos: { x: 18, y: 3 }, facing: 'O', label: 'Diligence' }, { creature: { id: 'humain' }, pos: { x: 20, y: 4 }, label: 'Brigand' }] }],
  } as never);
  const editer = (gestes: unknown) => {
    const r = appel('editer', gestes);
    expect(r.ok, JSON.stringify(r).slice(0, 400)).toBe(true);
    return r as unknown as { vue: { zones: Record<string, Element[]> } };
  };
  const e = editer({ ouvrir: servi.id, projet: JSON.stringify({ ...servi, worldMap: undefined, scenes: [scene] }) });
  const tester = Object.values(e.vue.zones).flat().find((x): x is Bouton => x.type === 'bouton' && x.id === 'tester')!;
  editer(tester.jeu);
  let s = drainer(appel, appel('demarrer', { essai: true, graine: 7 })).suite;
  servirLesModeles(appel, COMMITES);
  while (s.vue.projection.fenetre) s = drainer(appel, appel('jouer', (enFocus(s.vue) as Bouton).jeu)).suite;
  return vueDe(appel('vue'));
}

describe('une coque terrestre en embuscade ne se sert pas au monde en exploration (`corpsDe`, `coquesEnVue`)', () => {
  it('cachée : absente de `corps.coques`', () => {
    const vue = essaiDuPre(true);
    expect(vue.projection.exploration).not.toBeNull();
    expect(Object.keys(vue.corps.coques)).toEqual([]);
  });
  it('non cachée : servie parmi `corps.coques`', () => {
    const vue = essaiDuPre(false);
    expect(vue.projection.exploration).not.toBeNull();
    expect(Object.values(vue.corps.coques).map((c) => c.corps.element)).toEqual(['vehicule--diligence']);
  });
});
