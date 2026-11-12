/**
 * LA JOURNÉE DE ROUTE PAR LE PONT (#3534) : le trajet de Weiler à Steinbruck joué comme Godot le joue. La journée de route ne
 * s'arrête qu'aux vrais choix, les jets des héros ; la météo, le bilan de l'Étape et la Rencontre qu'il fait tirer vont
 * au journal. Chaque arrêt se dessine dans la scène du voyage : l'heure, la météo, les km du trajet, sa frise, et le groupe en
 * cartes, chaque héros son portrait, ses Blessures et son jet.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { departDeLaCarte, drainer, gestesDessines, table } from './pont.testkit';
import type { Bouton, Element, Entite, Jauge, Jet, Ligne, Puce } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

/** Une partie du scénario `voyage` partie de Weiler vers Steinbruck : la première vue de la route, et les lignes que le
 *  journal a écrites depuis le départ. */
function enRoute() {
  const { pont, appel } = table();
  ouvert = pont;
  const lignes: Ligne[] = [];
  const jouer = (jeu: Bouton['jeu']): Suite => { const d = drainer(appel, appel('jouer', jeu)); lignes.push(...d.lignes); return d.suite; };
  let s = drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite;
  for (let pas = 0; s.vue.projection.fenetre; pas++) {
    expect(pas, 'l’arrivée se vide').toBeLessThan(10);
    s = jouer(gestesDessines(s.vue).find((x): x is Bouton => x.type === 'bouton' && !x.refus)!.jeu);
  }
  s = jouer(s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
  s = jouer(departDeLaCarte(s.vue, 'r-grandroute').valeurs[0].jeu);
  return { suite: s, lignes, jouer };
}

const corps = (s: Suite) => Object.fromEntries(s.vue.zones['fenetre.corps'].map((e: Element) => [e.id, e]));
const geste = (s: Suite, libelle: string) => gestesDessines(s.vue).find((x): x is Bouton => x.type === 'bouton' && x.libelle === libelle);

describe('la journée de route par le pont', () => {
  it('la journée s’arrête d’abord aux jets des héros, dans la scène du voyage ; la météo est déjà au journal', () => {
    const { suite, lignes } = enRoute();
    expect(suite.vue.disposition, 'la scène du voyage').toBe('voyage');
    const c = corps(suite);
    expect((c['voyage/heure'] as Ligne).texte, 'l’heure de jeu').toMatch(/ CI · \d\d:\d\d$/);
    expect((c['voyage/route'] as Jauge), 'les km du trajet').toMatchObject({ courant: 24, max: 30 });
    expect(Object.keys(c).filter((id) => id.startsWith('voyage/etape/')), 'la frise : le départ, l’arrivée').toEqual(['voyage/etape/depart', 'voyage/etape/arrivee']);
    expect([(c['voyage/etape/depart'] as Puce).libelle, (c['voyage/etape/arrivee'] as Puce).libelle]).toEqual(['Weiler', 'Steinbruck']);
    const cartes: Entite[] = suite.vue.zones['groupe.heros'];
    expect(cartes.map((h) => h.nom), 'le groupe en cartes, au pied de l’écran').toEqual(['Bjorn (test)', 'Mira (test)', 'Aldric (test)', 'Greta Hartmann']);
    for (const h of cartes) {
      const combattant = h.id.slice('heros/'.length);
      expect(h.elements.slice(0, 2), `${h.nom} : son portrait, puis ses Blessures`).toMatchObject([{ type: 'portrait', combattant }, { type: 'jauge', id: 'blessures' }]);
      expect(suite.vue.corps.combattants, `${h.nom} : son corps, que son portrait montre hors du plateau`).toHaveProperty([combattant]);
      const jets = h.elements.filter((e): e is Jet => e.type === 'jet');
      expect(jets.map((j) => [j.qui, j.resultat]), `${h.nom} : son jet de l’étape, sur sa carte, à lancer`).toEqual([[null, null]]);
    }
    expect(Object.values(c).some((e) => e.type === 'jet'), 'aucun jet de héros dans le corps de la fenêtre').toBe(false);
    expect(lignes.map((l) => l.texte), 'la météo du jour, tirée sans arrêt').toContain('Météo : Temps sec.');
    expect(c['voyage/meteo'], 'la météo du jour dans la scène').toMatchObject({ texte: 'Temps sec' });
  });

  it('les jets lancés et validés, le bilan de l’Étape puis la Rencontre qu’il fait tirer vont au journal, et la nuit s’ouvre (EDOC 8 l.161, l.182-233)', () => {
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
    expect(textes.slice(carte + 1).some((x) => /^Voilà qui est utile ! : /.test(x)), 'puis l’entrée tirée de la Rencontre, sans redire sa catégorie').toBe(true);
  });
});
