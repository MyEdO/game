/**
 * LA JOURNÉE DE ROUTE PAR LE PONT (#3534) : le trajet de Weiler à Steinbruck joué comme Godot le joue. La journée de route ne
 * s'arrête qu'aux vrais choix, les jets des héros ; la météo, le bilan de l'Étape et la Rencontre qu'il fait tirer vont
 * au journal. Chaque arrêt se dessine dans la scène du voyage : son paysage, le jour, le moment et la météo, la carte du
 * trajet, ses km, sa frise, et le groupe en cartes, chaque héros son portrait, ses Blessures et son jet.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { departDeLaCarte, drainer, gestesDessines, table } from './pont.testkit';
import type { Bouton, Choix, Element, Entite, Jet, Ligne, Paysage, Plan } from '../../../src/hote/elements';
import { cleDEmplacement } from '../../../src/hote/sauvegardes';
import type { SaveGame } from '../../../src/noyau/index';
import type { Pont, Suite } from './pont';
import { encounterTable } from '../../../src/engine/travelTables';
import { noteEvent } from '../../../src/noyau/evenementDuJour';
import type { TravelRecapDay } from '../../../src/noyau/travelFlow';
import { DEFAULT_VOYAGE_ORDERS } from '../../../src/noyau/voyageCadence';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

/** Une partie du scénario `voyage` partie de Weiler vers Steinbruck : la première vue de la route, et les lignes que le
 *  journal a écrites depuis le départ. */
function enRoute(avecContagion = false) {
  const { pont, appel, stockage } = table();
  ouvert = pont;
  const lignes: Ligne[] = [];
  const jouer = (jeu: Bouton['jeu']): Suite => { const d = drainer(appel, appel('jouer', jeu)); lignes.push(...d.lignes); return d.suite; };
  let s = drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite;
  if (!avecContagion) expect(appel('reglages', { type: 'regle', args: ['maladie-mode', 'off'] }).ok).toBe(true);
  for (let pas = 0; s.vue.projection.fenetre; pas++) {
    expect(pas, 'l’arrivée se vide').toBeLessThan(10);
    s = jouer(gestesDessines(s.vue).find((x): x is Bouton => x.type === 'bouton' && !x.refus)!.jeu);
  }
  s = jouer(s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
  s = jouer(departDeLaCarte(s.vue, 'r-grandroute').valeurs[0].jeu);
  return { suite: s, lignes, jouer, appel, stockage };
}

const corps = (s: Suite) => Object.fromEntries(s.vue.zones['fenetre.corps'].map((e: Element) => [e.id, e]));
const geste = (s: Suite, libelle: string) => gestesDessines(s.vue).find((x): x is Bouton => x.type === 'bouton' && x.libelle === libelle);

describe('la journée de route par le pont', () => {
  it('le départ part sous les ordres par défaut, pressés en route ; le choix servi en route change la cadence', () => {
    const r = enRoute();
    const cadence = (s: Suite) => corps(s)['voyage/cadence'] as Choix;
    const ordres = () => {
      expect(r.appel('sauvegarder', { sauvegarder: 1 }).ok, 'la partie se sauvegarde en route').toBe(true);
      return (JSON.parse(r.stockage.getItem(cleDEmplacement(1))!) as SaveGame).data.travelPlan?.orders;
    };
    expect(ordres(), 'le départ, joué tel que servi, pose les ordres par défaut au plan').toEqual(DEFAULT_VOYAGE_ORDERS);
    expect(cadence(r.suite).valeurs.map((b) => [b.libelle, b.presse]), 'chaque cadence, celle du défaut en premier, celle que le trajet joue pressée').toEqual([
      ['Jour par jour', true], ['Sous vos ordres', false],
    ]);
    const s = r.jouer(cadence(r.suite).valeurs.find((b) => b.id === 'commande')!.jeu);
    expect(ordres(), 'le choix servi en route, joué tel quel, change la cadence du plan').toEqual({ cadence: 'commande' });
    expect(cadence(s).valeurs.filter((b) => b.presse).map((b) => b.id), 'la cadence jouée pressée').toEqual(['commande']);
  });

  it('la journée s’arrête d’abord aux jets des héros, dans la scène du voyage ; la météo est déjà au journal', () => {
    const { suite, lignes } = enRoute();
    expect(suite.vue.disposition, 'la scène du voyage').toBe('voyage');
    const c = corps(suite);
    expect((c['scene/paysage'] as Paysage).paysage, 'le paysage : le ciel du jour, la voie terrestre en plans à la lumière du jour sous sa brume, les marcheurs, le premier plan au jour, la vignette').toEqual(['ciel-jour', 'relief-montagnes-jour', 'brume-haute-jour', 'relief-collines-jour', 'brume-basse-jour', 'relief-lisiere-jour', 'relief-route-jour', 'equipage-pied', 'avant-foret-jour', 'voile-coins']);
    expect((c['scene/ciel'] as Paysage).paysage, 'l’objet du temps : le ciel du moment dans son arche').toEqual(['arche-apresmidi']);
    expect((c['scene/jour'] as Ligne).texte, 'le jour de la semaine, seul').toMatch(/^\p{L}+$/u);
    expect((c['scene/date'] as Ligne).texte, 'la date impériale, puis le jour de route').toMatch(/ CI · 1ᵉʳ jour de route$/);
    expect(c['scene/meteo'], 'le pictogramme de la météo du jour').toMatchObject({ type: 'icone', icone: 'meteo/sec' });
    expect((c['scene/moment'] as Ligne).texte, 'le moment du jour et la météo').toBe('Après-midi · temps sec');
    expect((c['voyage/titre'] as Ligne).texte, 'le titre de la carte : la route de l’arrivée').toBe('La route de Steinbruck');
    expect(c['voyage/reste'], 'un seul chiffre : les km qui restent avant l’arrivée, et leur unité').toMatchObject({ type: 'puce', valeur: '6', libelle: 'km' });
    expect(suite.vue.projection.voyage, 'la projection porte le trajet en données : ses distances exactes et leur unité').toMatchObject({ unite: 'km', km: 30, fait: 24, depart: 'p-village', arrivee: 'p-bourg' });
    expect(suite.vue.projection.temps.date, 'la date impériale en données, par ids').toMatchObject({ year: expect.any(Number), intercalaire: null, mois: { id: expect.any(String) }, semaine: { nom: (c['scene/jour'] as Ligne).texte } });
    const frise = c['voyage/frise'] as Plan;
    expect(frise.points.map((p) => [p.id, p.nom, p.x, p.ton]), 'la frise : le départ nommé, le groupe à son km, l’arrivée nommée').toEqual([['depart', 'Weiler', 0, 'neutre'], ['ici', '', 0.8, 'reussite'], ['arrivee', 'Steinbruck', 1, 'neutre']]);
    expect(frise.traits.map((x) => x.ton), 'la route faite, puis celle qui reste').toEqual(['alerte', 'neutre']);
    const carte = c['voyage/carte'] as Plan;
    const lieu = (id: string) => carte.points.find((p) => p.id === id)!;
    const [de, ici, vers] = [lieu('lieu/p-village'), lieu('ici'), lieu('lieu/p-bourg')];
    expect([ici.x, ici.y], 'le groupe sur sa route, à sa part du trajet').toEqual([de.x + (vers.x - de.x) * 0.8, de.y + (vers.y - de.y) * 0.8]);
    expect(carte.traits.filter((x) => x.ton === 'alerte'), 'la part faite de la route du trajet').toEqual([{ id: 'fait', de: 'lieu/p-village', vers: 'ici', ton: 'alerte' }]);
    expect(carte.points.filter((p) => p.nom).map((p) => [p.id, p.nom]), 'le départ et l’arrivée nommés, seuls').toEqual([['lieu/p-village', 'Weiler'], ['lieu/p-bourg', 'Steinbruck']]);
    const cartes: Entite[] = suite.vue.zones['groupe.heros'];
    expect(cartes.map((h) => h.nom), 'le groupe en cartes, au pied de l’écran').toEqual(['Bjorn (test)', 'Mira (test)', 'Aldric (test)', 'Greta Hartmann']);
    expect(cartes.map((h) => h.ton), 'la carte du héros qui doit lancer, en alerte').toEqual(['alerte', 'neutre', 'neutre', 'neutre']);
    for (const h of cartes) {
      const combattant = h.id.slice('heros/'.length);
      expect(h.elements.slice(0, 3), `${h.nom} : son portrait, sa carrière, puis ses Blessures`).toMatchObject([{ type: 'portrait', combattant }, { type: 'ligne', id: 'carriere', texte: expect.stringMatching(/\S/) }, { type: 'jauge', id: 'blessures' }]);
      expect(h.elements.some((e) => e.id === 'bourse'), `${h.nom} : sa bourse se lit sur sa fiche, pas sur sa carte`).toBe(false);
      expect(suite.vue.corps.combattants, `${h.nom} : son corps, que son portrait montre hors du plateau`).toHaveProperty([combattant]);
      const jets = h.elements.filter((e): e is Jet => e.type === 'jet');
      expect(jets.map((j) => [j.qui, j.resultat]), `${h.nom} : son jet de l’étape, sur sa carte, à lancer`).toEqual([[null, null]]);
    }
    expect(Object.values(c).some((e) => e.type === 'jet'), 'aucun jet de héros dans le corps de la fenêtre').toBe(false);
    expect(lignes.map((l) => l.texte), 'la météo du jour, tirée sans arrêt').toContain('Météo : Temps sec.');
  });

  /** Le trajet en route rechargé avec ses distances remplacées par `plan`. */
  const rechargeEnRoute = (plan: { km: number; kmDone: number; sea?: true; log?: TravelRecapDay[] }): Suite => {
    const r = enRoute();
    expect(r.appel('sauvegarder', { sauvegarder: 1 }).ok).toBe(true);
    const save = JSON.parse(r.stockage.getItem(cleDEmplacement(1))!) as SaveGame;
    r.stockage.setItem(cleDEmplacement(1), JSON.stringify({ ...save, data: { ...save.data, travelPlan: { ...save.data.travelPlan!, ...plan } } }));
    r.appel('quitter');
    return drainer(r.appel, r.appel('charger', { charger: 1, graine: 7 })).suite;
  };

  it('le reste du trajet s’arrondit à l’affichage, sur des distances exactes', () => {
    const s = rechargeEnRoute({ km: 30, kmDone: 24.5 });
    expect(s.vue.projection.voyage, 'la part faite, exacte').toMatchObject({ km: 30, fait: 24.5 });
    expect(corps(s)['voyage/reste'], 'le reste arrondi').toMatchObject({ type: 'puce', valeur: '6', libelle: 'km' });
  });

  it('la frise pose chaque jour clos à sa borne, et le jour de route le suit', () => {
    const s = rechargeEnRoute({ km: 30, kmDone: 24.5, log: [{ kmFrom: 0, kmTo: 12.5, hours: 6, lines: [] }] });
    expect(s.vue.projection.voyage!.journees.map((j) => [j.depuis, j.jusqua]), 'le jour clos en données').toEqual([[0, 12.5]]);
    const frise = corps(s)['voyage/frise'] as Plan;
    expect(frise.points.map((p) => [p.id, p.x]), 'la nuit à la borne du jour clos').toEqual([['depart', 0], ['nuit/0', 12.5 / 30], ['ici', 24.5 / 30], ['arrivee', 1]]);
    expect((corps(s)['scene/date'] as Ligne).texte).toMatch(/ · 2ᵉ jour de route$/);
  });

  it('le reste d’une traversée se dit en milles', () => {
    const s = rechargeEnRoute({ km: 480.4, kmDone: 100.2, sea: true });
    expect(s.vue.projection.voyage, 'l’unité du trajet').toMatchObject({ unite: 'milles' });
    expect(corps(s)['voyage/reste'], 'le reste, en milles').toMatchObject({ type: 'puce', valeur: '380', libelle: 'milles' });
  });

  it('la météo d’Étape est déjà tirée quand vient le premier Test de Contagion en marche', () => {
    const r = enRoute(true);
    expect(corps(r.suite)['scene/meteo']).toMatchObject({ type: 'icone', icone: 'meteo/sec' });
    let s = r.suite;
    for (let pas = 0; !s.vue.zones['fenetre.etape'].some((l) => l.texte === 'Contagion (Vérole Urticante)'); pas++) {
      expect(pas, 'Greta expose les autres marcheurs').toBeLessThan(6);
      s = r.jouer((geste(s, 'Lancer') ?? geste(s, 'Continuer'))!.jeu);
    }
    expect(corps(s)['scene/meteo']).toMatchObject({ type: 'icone', icone: 'meteo/sec' });
  });

  it('les jets lancés et validés, le bilan de l’Étape puis la Rencontre qu’il fait tirer (son nom et son texte verbatim) vont au journal, et la nuit s’ouvre (EDOC 8 l.161, l.182-233)', () => {
    const r = enRoute();
    let s = r.suite;
    for (let pas = 0; s.vue.disposition === 'voyage'; pas++) {
      expect(pas, 'la journée se joue en quelques gestes').toBeLessThan(6);
      s = r.jouer((geste(s, 'Lancer') ?? geste(s, 'Continuer'))!.jeu);
    }
    expect(s.vue.projection.fenetre?.cle, 'la halte de nuit').toBe('repos');
    const textes = r.lignes.map((l) => l.texte);
    const carte = textes.indexOf('Cartographie : 2/4 DR.');
    expect(carte, 'le bilan de l’Étape, au journal').toBeGreaterThanOrEqual(0);
    const utile = encounterTable('positives').find((e) => e.id === 'utile')!;
    const ligne = noteEvent(() => ({ travelPlan: null }) as never, () => {}, { source: { table: 'rencontres-positives', id: utile.id }, title: utile.label, text: utile.desc });
    expect(textes.slice(carte + 1), 'puis la Rencontre tirée, par la ligne de l’événement du jour : son nom et son texte verbatim, sans redire sa catégorie').toContain(ligne);
  });
});
