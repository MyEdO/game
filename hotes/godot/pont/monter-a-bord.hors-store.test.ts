/**
 * L'ACTION AUTHORÉE D'UNE COQUE TERRESTRE PAR LE PONT (#4576, #4471) : sur une coque posée, que l'exploration ne nomme
 * pas, l'action de l'auteur s'offre au groupe à sa portée parmi les boutons de `exploration.gestes`, et s'y joue.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { drainer, enFocus, table } from './pont.testkit';
import type { Bouton } from '../../../src/hote/elements';
import type { Pont, VueDuPont } from './pont';
import { stockageEnMemoire } from '../../../src/lib/stockage.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import { buildScene } from '../../../src/noyau/mapSpec';
import { flowFromEffects } from '../../../src/noyau/monde/flow';
import { tousLesHerosDeScenario } from '../../../src/scenes/test-scenarios/_heros';
import type { TestScenario } from '../../../src/scenes/test-scenarios/_shared';
import { contenu } from '../../../src/scenes/fixtures/contenuDuCommun';

/** Une diligence posée, cap au nord, qui porte l'action « Monter à bord » ; le groupe entre hors de sa portée. */
const MONTER_A_BORD: TestScenario = {
  id: 'monter-a-bord',
  order: 0,
  category: 'rendu',
  icon: 'scenario/galerie',
  title: 'Monter à bord',
  tests: 'L’action authorée d’une coque terrestre s’offre au groupe à sa portée.',
  partyNote: 'Approchez la diligence.',
  construire: (idNeuf) => ({
    party: tousLesHerosDeScenario(idNeuf),
    scene: buildScene({
      id: 'monter-a-bord',
      label: 'Cour',
      size: [12, 10],
      terrain: 'herbe',
      ambientLight: 'jour',
      heroStart: [1, 1],
      entities: [{
        id: 'diligence', kind: 'personnage', vehicule: { id: 'diligence' }, pos: { x: 6, y: 6 }, facing: 'N', label: 'La diligence',
        usable: { actions: [{ id: 'monter-a-bord', label: 'Monter à bord', unique: true, flow: flowFromEffects([{ type: 'setFlag', flag: 'a-bord' }]) }] },
      }],
    }),
  }),
};

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });
const MONTER = { type: 'jouerAction', args: ['diligence', 'monter-a-bord'] };
const offreDeMonter = (vue: VueDuPont): Bouton | undefined =>
  vue.zones['exploration.gestes'].find((b) => JSON.stringify(b.jeu) === JSON.stringify({ suite: [MONTER] }));

describe('l’action authorée d’une coque terrestre s’offre et se joue par le pont (#4576)', () => {
  it('le groupe à portée de la coque voit le bouton, le presse, et l’action se joue', () => {
    const stockage = stockageEnMemoire();
    const { pont, appel } = table(stockage, null, { ...contenu, scenarios: [MONTER_A_BORD] });
    ouvert = pont;
    let s = drainer(appel, appel('demarrer', { scenario: 'monter-a-bord', graine: 7 })).suite;
    while (s.vue.projection.fenetre) s = drainer(appel, appel('jouer', (enFocus(s.vue) as Bouton).jeu)).suite;
    expect(offreDeMonter(s.vue), 'hors de portée, rien à offrir').toBeUndefined();

    s = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 6, y: 5 }] })).suite;
    expect(s.vue.projection.exploration!.groupe).toEqual([6, 5]);
    const offre = offreDeMonter(s.vue);
    expect(offre, s.vue.zones['exploration.gestes'].map((b) => b.libelle).join(' | ')).toBeDefined();
    expect(offre!.refus).toBeNull();

    s = drainer(appel, appel('jouer', offre!.jeu)).suite;
    expect(offreDeMonter(s.vue), 'l’action unique jouée ne s’offre plus').toBeUndefined();
    expect(appel('sauvegarder', { sauvegarder: 1 }).ok).toBe(true);
    expect([...stockage.contenu.values()].some((v) => v.includes('"a-bord":true')), 'son effet est posé').toBe(true);
  });
});
