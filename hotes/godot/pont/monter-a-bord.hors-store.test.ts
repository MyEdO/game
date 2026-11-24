/**
 * « MONTER À BORD » PAR LE PONT (#4576, #4471) : dans La Diligence, l'action authorée sur la diligence posée
 * (`diligence-cour-diligence`, une coque terrestre que l'exploration ne nomme pas) s'offre au groupe à sa portée parmi
 * les boutons de `exploration.gestes`, et s'y joue jusqu'au départ (`edo-ch1-depart`). Une coque terrestre en
 * embuscade ne se sert pas parmi `corps.coques` en exploration (`coquesEnVue`), non cachée elle s'y sert.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { drainer, enFocus, modelesCommites, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import type { Bouton, Element } from '../../../src/hote/elements';
import type { Pont, VueDuPont } from './pont';
import { stockageEnMemoire } from '../../../src/lib/stockage.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import { buildScene } from '../../../src/noyau/mapSpec';
import { contenuDuJeuDeRole } from '../../../src/scenes/campaign';
import { campagneDeTest } from '../../../src/scenes/fixtures/campagneDeTest.testkit';
import { paquetDuJeu } from '../../../src/noyau/index';

const COMMITES = await modelesCommites();
let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });
const MONTER = { type: 'jouerAction', args: ['diligence-cour-diligence', 'monter-a-bord'] };
const offreDeMonter = (vue: VueDuPont): Bouton | undefined =>
  vue.zones['exploration.gestes'].find((b) => JSON.stringify(b.jeu) === JSON.stringify({ suite: [MONTER] }));

describe('« Monter à bord » s’offre et se joue par le pont dans La Diligence (#4576)', () => {
  it('le groupe à portée de la diligence voit le bouton, le presse, et part (`edo-ch1-depart`)', () => {
    const stockage = stockageEnMemoire();
    const { pont, appel } = table(stockage, null, contenuDuJeuDeRole);
    ouvert = pont;
    let s = suiteDe(appel('ouvrir', { graine: 7 }));
    const recruter = s.vue.zones['groupe.pretires'][0].elements.find((x): x is Bouton => x.type === 'bouton')!;
    appel('jouer', recruter.jeu);
    s = drainer(appel, appel('lancer', { lancer: 'la-diligence' })).suite;
    while (s.vue.projection.fenetre) s = drainer(appel, appel('jouer', (enFocus(s.vue) as Bouton).jeu)).suite;
    expect(s.vue.projection.scene?.id).toBe('la-diligence');
    expect(offreDeMonter(s.vue), 'hors de portée, rien à offrir').toBeUndefined();

    s = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 24, y: 28 }] })).suite;
    expect(s.vue.projection.exploration!.groupe).toEqual([24, 28]);
    const offre = offreDeMonter(s.vue);
    expect(offre, s.vue.zones['exploration.gestes'].map((b) => b.libelle).join(' | ')).toBeDefined();
    expect(offre!.refus).toBeNull();

    drainer(appel, appel('jouer', offre!.jeu));
    expect(appel('sauvegarder', { sauvegarder: 1 }).ok).toBe(true);
    expect([...stockage.contenu.values()].some((v) => v.includes('"edo-ch1-depart":true')), 'la sauvegarde porte le flag du départ').toBe(true);
  });
});

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
