/**
 * LE VOYAGE PAR LE PONT (#3328) : « Voyage & temps long » joué comme Godot le joue. La carte du monde s'ouvre depuis
 * l'exploration ; son plan pose chaque lieu, et sous chaque destination le départ de son trajet, sa longueur et ses
 * modes de voyage avec leurs jours de route (`carteEnVue`) ; un mode part, les journées et les haltes passent, et le récit dit l'issue du trajet (`recitEnVue`). À
 * l'arrivée, l'écran du lieu tient la main (`lieuEnVue`) : ses services et ses trajets ; « Explorer » entre dans sa scène.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { departDeLaCarte, drainer, suiteDe, table, gestesDessines } from './pont.testkit';
import { AUTO_SLOT, cleDEmplacement } from '../../../src/hote/sauvegardes';
import type { SaveGame } from '../../../src/noyau/index';
import type { Bouton, Choix, Element, Entite, Ligne, Plan } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

/** Le pont de la partie en cours, fermé après chaque cas : une partie par processus. */
let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

/** Une partie neuve du scénario `voyage`, son entrée passée. */
function partie() {
  const { pont, appel, stockage } = table();
  ouvert = pont;
  /** Joue le geste que l'Entrée jouerait, ou le premier bouton ouvert, tant qu'une fenêtre autre que `jusqua` tient la
   *  main. */
  const avancer = (suite: Suite, jusqua?: string): Suite => {
    for (let pas = 0; suite.vue.projection.fenetre && suite.vue.projection.fenetre.cle !== jusqua; pas++) {
      expect(pas, 'les fenêtres se vident').toBeLessThan(80);
      const g = gestesDessines(suite.vue);
      const b = g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.find((x): x is Bouton => x.type === 'bouton' && !x.refus)!;
      ({ suite } = drainer(appel, appel('jouer', b.jeu)));
    }
    return suite;
  };
  const jouer = (b: Bouton, jusqua?: string): Suite => avancer(drainer(appel, appel('jouer', b.jeu)).suite, jusqua);
  return { jouer, appel, stockage, suite: avancer(drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite) };
}

const parId = (elements: readonly Element[]) => Object.fromEntries(elements.map((e) => [e.id, e]));
const carte = (suite: Suite): Bouton => suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!;
/** Le mode `mode` du trajet `route` de la carte ouverte. */
const mode = (suite: Suite, route: string, m: string): Bouton => departDeLaCarte(suite.vue, route, 'jourParJour').valeurs.find((b) => b.id === m)!;

describe('le voyage par le pont', () => {
  it('la carte du monde : chaque lieu au plan, et sous chaque destination son trajet, sa longueur et ses modes avec leurs jours de route', () => {
    const p = partie();
    expect(carte(p.suite), 'la carte s’ouvre depuis l’exploration').toMatchObject({ refus: null });
    const suite = p.jouer(carte(p.suite), 'carteDuMonde');
    const corps = parId(suite.vue.zones['fenetre.corps']);
    expect(Object.keys(corps), 'le plan seul : aucun trajet en liste à côté').toEqual(['carte/plan']);
    const plan = corps['carte/plan'] as Plan;
    const departs = plan.points.map((pt) => [pt.nom, pt.ton, pt.elements.map((x) => [(x as Choix).libelle, (x as Choix).valeurs.map((b) => [b.libelle, b.refus])])]);
    const [ordres, jourParJour] = ['Sous vos ordres', 'Jour par jour'];
    expect(departs, 'chaque lieu au plan, celui du groupe distingué, sous chaque destination son départ par cadence, celle des ordres en premier ; la longue route ne part pas de Weiler').toEqual([
      ['Weiler', 'alerte', []],
      ['Federholz', 'neutre', [[`24 km · ${ordres}`, [['À pied · 1 j', null]]], [`24 km · ${jourParJour}`, [['À pied · 1 j', null]]]]],
      ['Steinbruck', 'neutre', [[`30 km · ${ordres}`, [['À pied · 2 j', null], ['Diligence · 1 j', null]]], [`30 km · ${jourParJour}`, [['À pied · 2 j', null], ['Diligence · 1 j', null]]]]],
      ['Altdorf', 'neutre', []],
    ]);
    expect(departDeLaCarte(suite.vue, 'r-grandroute', 'jourParJour').valeurs.map((b) => b.jeu), 'chaque mode part sous la cadence de son choix').toEqual([
      { type: 'partirEnVoyage', args: ['r-grandroute', 'pied', { cadence: 'jourParJour' }] },
      { type: 'partirEnVoyage', args: ['r-grandroute', 'diligence', { cadence: 'jourParJour' }] },
    ]);
    expect(plan.points.every((pt) => pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1), 'chaque lieu dans le cadre du plan').toBe(true);
    expect(plan.traits.map((tr) => [tr.id, tr.ton]), 'chaque route, celles qui partent d’ici distinguées').toEqual([['r-piste', 'reussite'], ['r-grandroute', 'reussite'], ['r-longue', 'neutre']]);
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
    expect((corps['lieu/description'] as Ligne).texte, 'la description du lieu').toMatch(/^Un bourg de pierre grise au carrefour des routes/);
    const plan = corps['lieu/plan'] as Plan;
    expect(plan.points.filter((pt) => pt.ton === 'alerte').map((pt) => pt.nom), 'le plan de la carte vu d’ici, le lieu du groupe en alerte').toEqual(['Steinbruck']);
    expect(plan.points.flatMap((pt) => pt.elements), 'rien sous les lieux de ce plan : on part depuis les trajets').toEqual([]);
    expect(((corps['lieu/carte'] as Bouton).jeu as { type: string }).type, 'la carte s’ouvre d’ici').toBe('ouvrirLaCarte');
    const habits = (id: string) => (corps[id] as Entite).elements.filter((e) => e.type !== 'bouton').map((e) => (e.type === 'fond' ? e.fond : e.type));
    const gestes = (id: string) => (corps[id] as Entite).elements.filter((e): e is Bouton => e.type === 'bouton').map((b) => [b.libelle, (b.jeu as { type: string }).type]);
    expect(habits('service/auberge'), 'l’auberge : son fond, son icône, le boniment de son hôte').toEqual(['taverne-commune', 'icone', 'ligne']);
    expect(gestes('service/auberge'), 'l’auberge : dormir, recueillir des informations').toEqual([['Dormir', 'ouvrirLeRepos'], ['Recueillir des informations', 'recueillirLesRumeurs']]);
    expect(habits('service/forgeron'), 'le forgeron : son fond et son icône, sans boniment').toEqual(['forge', 'icone']);
    expect([(corps['lieu/services'] as Ligne).texte, (corps['lieu/trajets'] as Ligne).texte], 'chaque rubrique sous son titre').toEqual(['Ce qu’on peut faire ici', 'Partir']);
    expect(gestes('service/forgeron'), 'le forgeron : son échoppe').toEqual([['Entrer', 'ouvrirLaBoutique']]);
    const retour = corps['trajet/r-grandroute'] as Entite;
    expect([retour.nom, retour.elements.map((x) => (x as Choix).libelle)], 'le trajet qui en part, le même départ que sur la carte').toEqual(['Weiler', ['30 km · Sous vos ordres', '30 km · Jour par jour']]);

    const explorer = suite.vue.zones['fenetre.gestes'].find((b): b is Bouton => b.type === 'bouton' && b.libelle === 'Explorer')!;
    suite = p.jouer(explorer);
    expect(suite.vue.projection.scene?.id, 'Explorer entre dans la scène du lieu').toBe('test-voyage-bourg');
    const leLieu = suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Le lieu')!;
    expect(p.jouer(leLieu, 'ecranDuLieu').vue.projection.fenetre?.cle, 'le lieu se rouvre depuis sa scène').toBe('ecranDuLieu');
  });

  it('entrer dans la scène du lieu pose le point de reprise d’une campagne à l’emplacement automatique, jamais celui d’un scénario de test', () => {
    const p = partie();
    /** Le voyage jusqu'au bourg, puis « Explorer » : la suite, le groupe entré dans la scène du lieu. */
    const explorer = (depart: Suite): Suite => {
      let suite = p.jouer(carte(depart), 'carteDuMonde');
      suite = p.jouer(mode(suite, 'r-grandroute', 'pied'), 'ecranDuLieu');
      return p.jouer(suite.vue.zones['fenetre.gestes'].find((b): b is Bouton => b.type === 'bouton' && b.libelle === 'Explorer')!);
    };
    expect(p.appel('sauvegarder', { sauvegarder: 1 }).ok, 'le scénario de test s’écrit à la main').toBe(true);
    explorer(p.suite);
    expect(p.stockage.getItem(cleDEmplacement(AUTO_SLOT)), 'un scénario de test ne garde aucun point de reprise').toBeNull();

    // La sauvegarde du scénario, posée en campagne : l'identité d'un document de projet.
    const save = JSON.parse(p.stockage.getItem(cleDEmplacement(1))!) as SaveGame;
    p.stockage.setItem(cleDEmplacement(1), JSON.stringify({ ...save, data: { ...save.data, campaignDoc: { ...save.data.campaignDoc, projet: { id: 'campagne-de-test' } } } }));
    p.appel('quitter');
    const arrivee = explorer(suiteDe(p.appel('charger', { charger: 1, graine: 7 })));
    const garde = JSON.parse(p.stockage.getItem(cleDEmplacement(AUTO_SLOT)) ?? 'null') as SaveGame | null;
    expect(garde?.data.scene?.id, 'le point de reprise est la scène où le groupe vient d’entrer').toBe(arrivee.vue.projection.scene!.id);
    expect(garde?.data.scene?.id).not.toBe(save.data.scene?.id);
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
