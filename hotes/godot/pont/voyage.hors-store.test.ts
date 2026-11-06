/**
 * LE VOYAGE PAR LE PONT (#3328) : « Voyage & temps long » joué comme Godot le joue. La carte du monde s'ouvre depuis
 * l'exploration ; chaque trajet nomme sa destination, sa longueur et ses modes de voyage avec leurs jours de route
 * (`carteEnVue`) ; un mode part, les journées et les haltes passent, et le récit dit l'issue du trajet (`recitEnVue`). À
 * l'arrivée, l'écran du lieu tient la main (`lieuEnVue`) : ses services et ses trajets ; « Explorer » entre dans sa scène.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Bouton, Choix, Element, Entite, Ligne } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

/** Le pont de la partie en cours, fermé après chaque cas : une partie par processus. */
let ouvert: Pont | null = null;
afterEach(() => { ouvert?.fermer(); ouvert = null; });

/** Une partie neuve du scénario `voyage`, son entrée passée. */
function partie() {
  const { pont, appel } = table();
  ouvert = pont;
  /** Joue le geste que l'Entrée jouerait, ou le premier bouton ouvert, tant qu'une fenêtre autre que `jusqua` tient la
   *  main. */
  const avancer = (suite: Suite, jusqua?: string): Suite => {
    for (let pas = 0; suite.vue.projection.fenetre && suite.vue.projection.fenetre.cle !== jusqua; pas++) {
      expect(pas, 'les fenêtres se vident').toBeLessThan(80);
      const g = suite.vue.zones['fenetre.gestes'];
      const b = g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.find((x): x is Bouton => x.type === 'bouton' && !x.refus)!;
      ({ suite } = drainer(appel, appel('jouer', b.jeu)));
    }
    return suite;
  };
  const jouer = (b: Bouton, jusqua?: string): Suite => avancer(drainer(appel, appel('jouer', b.jeu)).suite, jusqua);
  return { jouer, suite: avancer(drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite) };
}

const parId = (elements: readonly Element[]) => Object.fromEntries(elements.map((e) => [e.id, e]));
const carte = (suite: Suite): Bouton => suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!;
/** Le mode `mode` du trajet `route` de la carte ouverte. */
const mode = (suite: Suite, route: string, m: string): Bouton =>
  ((parId(suite.vue.zones['fenetre.corps'])[`carte/${route}`] as Entite).elements.find((e): e is Choix => e.id === 'modes')!).valeurs.find((b) => b.id === m)!;

describe('le voyage par le pont', () => {
  it('la carte du monde : chaque trajet, sa destination, sa longueur et ses modes avec leurs jours de route', () => {
    const p = partie();
    expect(carte(p.suite), 'la carte s’ouvre depuis l’exploration').toMatchObject({ refus: null });
    const suite = p.jouer(carte(p.suite), 'carteDuMonde');
    const corps = parId(suite.vue.zones['fenetre.corps']);
    expect((corps['carte/ici'] as Ligne).texte, 'le lieu du groupe').toBe('Depuis Weiler');
    const trajet = (route: string) => {
      const e = corps[`carte/${route}`] as Entite;
      return [e.nom, ...e.elements.map((x) => (x.type === 'puce' ? x.libelle : (x as Choix).valeurs.map((b) => [b.libelle, b.refus])))];
    };
    expect(trajet('r-piste'), 'la piste, à pied').toEqual(['Federholz', '24 km', [['À pied · 1 j', null]]]);
    expect(trajet('r-grandroute'), 'la grand-route, à pied ou en diligence').toEqual(['Steinbruck', '30 km', [['À pied · 2 j', null], ['Diligence · 1 j', null]]]);
    expect(Object.keys(corps).filter((id) => id.startsWith('carte/r-')), 'la longue route ne part pas de Weiler').toEqual(['carte/r-piste', 'carte/r-grandroute']);
  });

  it('arriver : le récit dit l’arrivée, la route faite et la durée du voyage', () => {
    const p = partie();
    let suite = p.jouer(carte(p.suite), 'carteDuMonde');
    suite = p.jouer(mode(suite, 'r-grandroute', 'pied'), 'recitDeVoyage');
    const corps = parId(suite.vue.zones['fenetre.corps']);
    expect(corps['recit/issue'], 'l’arrivée, au ton d’une réussite').toMatchObject({ texte: 'Arrivée à Steinbruck', ton: 'reussite' });
    expect((corps['recit/route'] as Ligne).texte, 'la route faite').toBe('Parti de Weiler pour Steinbruck · 30 km, à pied');
    expect((corps['recit/duree'] as Ligne).texte, 'la durée du voyage').toMatch(/^Voyage de .+\.$/);
    expect(Object.keys(corps).some((id) => id.startsWith('recit/jour/')), 'l’arrivée ne redit pas les journées').toBe(false);
  });

  it('arriver au lieu : son écran tient la main, ses services et ses trajets ; « Explorer » entre dans sa scène, d’où il se rouvre', () => {
    const p = partie();
    let suite = p.jouer(carte(p.suite), 'carteDuMonde');
    suite = p.jouer(mode(suite, 'r-grandroute', 'pied'), 'ecranDuLieu');
    expect(suite.vue.zones['fenetre.titre'].map((l) => l.texte), 'le lieu en titre').toEqual(['Steinbruck']);
    expect(suite.vue.projection.scene?.id, 'le groupe n’est pas entré dans la scène du lieu').toBe('test-voyage-village');
    const corps = parId(suite.vue.zones['fenetre.corps']);
    const gestes = (id: string) => (corps[id] as Entite).elements.map((b) => [(b as Bouton).libelle, ((b as Bouton).jeu as { type: string }).type]);
    expect(gestes('service/auberge'), 'l’auberge : dormir, recueillir des informations').toEqual([['Dormir', 'openRest'], ['Recueillir des informations', 'gatherInnInfo']]);
    expect(gestes('service/forgeron'), 'le forgeron : son échoppe').toEqual([['Entrer', 'openPlaceMerchant']]);
    expect((corps['carte/r-grandroute'] as Entite).nom, 'le trajet qui en part').toBe('Weiler');

    const explorer = suite.vue.zones['fenetre.gestes'].find((b): b is Bouton => b.type === 'bouton' && b.libelle === 'Explorer')!;
    suite = p.jouer(explorer);
    expect(suite.vue.projection.scene?.id, 'Explorer entre dans la scène du lieu').toBe('test-voyage-bourg');
    const leLieu = suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Le lieu')!;
    expect(p.jouer(leLieu, 'ecranDuLieu').vue.projection.fenetre?.cle, 'le lieu se rouvre depuis sa scène').toBe('ecranDuLieu');
  });

  it('une embuscade en chemin : le récit l’annonce, chaque journée et ce qui s’y est passé, puis il faut faire face', () => {
    const p = partie();
    let suite = p.jouer(carte(p.suite), 'carteDuMonde');
    suite = p.jouer(mode(suite, 'r-piste', 'pied'), 'recitDeVoyage');
    const corps = parId(suite.vue.zones['fenetre.corps']);
    expect(corps['recit/issue'], 'l’embuscade, au ton d’un échec').toMatchObject({ texte: 'Embuscade en chemin !', ton: 'echec' });
    expect((corps['recit/route'] as Ligne).texte, 'la route, et ce qu’il en reste').toMatch(/^Parti de Weiler pour Federholz · 24 km, à pied · /);
    const jour = corps['recit/jour/0'] as Entite;
    expect(jour.nom, 'la première journée').toMatch(/^Jour 1 — \d+ km en \d+ h de route$/);
    expect((corps['recit/suite'] as Ligne).texte, 'ce qui permet de repartir').toBe('Impossible de poursuivre : il faut faire face. Le voyage pourra reprendre ensuite depuis la carte.');
  });
});
