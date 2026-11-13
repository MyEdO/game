/**
 * L'ÉCHOPPE PAR LE PONT (#3534) : le forgeron de Steinbruck joué comme Godot le joue. L'étal par famille, chaque article
 * à son prix, le panier et son total, la bourse, chaque possession des héros à vendre et le lot (`marchandEnVue`) ; un
 * choix que le corps porte ne se redessine pas en réglage.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { departDeLaCarte, drainer, table, gestesDessines } from './pont.testkit';
import type { Bouton, Element, Entite, Puce } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

/** Une partie du scénario `voyage` arrivée à Steinbruck, l'échoppe du forgeron ouverte. */
function echoppe() {
  const { pont, appel } = table();
  ouvert = pont;
  const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
  let s = drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite;
  const avancer = (jusqua?: string) => {
    for (let pas = 0; s.vue.projection.fenetre && s.vue.projection.fenetre.cle !== jusqua; pas++) {
      expect(pas, 'les fenêtres se vident').toBeLessThan(80);
      const g = gestesDessines(s.vue);
      s = jouer((g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.find((x): x is Bouton => x.type === 'bouton' && !x.refus)!).jeu);
    }
  };
  avancer();
  s = jouer(s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
  s = jouer(departDeLaCarte(s.vue, 'r-grandroute', 'jourParJour').valeurs[0].jeu);
  avancer('ecranDuLieu');
  s = jouer(((s.vue.zones['fenetre.corps'].find((e) => e.id === 'service/forgeron') as Entite).elements.find((e): e is Bouton => e.type === 'bouton')!).jeu);
  return { suite: s, jouer };
}

const corps = (s: Suite) => Object.fromEntries(s.vue.zones['fenetre.corps'].map((e: Element) => [e.id, e]));
const boutons = (e: Element) => (e as Entite).elements as Bouton[];

describe('l’échoppe par le pont', () => {
  it('l’étal par famille et ses prix, la bourse, le panier vide qui ne se paie pas, les possessions à vendre', () => {
    const { suite } = echoppe();
    expect(suite.vue.disposition, 'l’échoppe a son écran').toBe('marchand');
    const c = corps(suite);
    expect((c['bourse'] as Puce).valeur, 'la bourse du groupe').toMatch(/\d/);
    const familles = Object.keys(c).filter((id) => id.startsWith('etal/'));
    expect(familles.length, 'l’étal rangé par famille').toBeGreaterThan(1);
    expect(boutons(c[familles[0]]).every((b) => / · /.test(b.libelle)), 'chaque article dit son prix').toBe(true);
    expect(boutons(c['panier']).map((b) => [b.libelle, b.refus]), 'le panier vide ne se paie pas').toEqual([['Payer 0 sc', 'Le panier est vide.']]);
    expect(Object.keys(c).filter((id) => id.startsWith('vente/')), 'les possessions de chaque héros').toEqual(['vente/bjorn', 'vente/mira', 'vente/aldric', 'vente/greta']);
    expect(suite.vue.zones['fenetre.reglages'].map((r) => r.id), 'l’étal et les ventes ne se redisent pas en listes').not.toContain('fenetreChoisir@marchand#ajouterAuPanier');
  });

  it('un article au panier : pressé à l’étal, sa ligne et son total, et le paiement ouvert', () => {
    const { suite, jouer } = echoppe();
    const article = Object.values(corps(suite)).filter((e) => e.id.startsWith('etal/')).flatMap(boutons).find((b) => !b.refus)!;
    const s = jouer(article.jeu);
    const c = corps(s);
    const nom = article.libelle.split(' · ')[0];
    expect(Object.values(c).filter((e) => e.id.startsWith('etal/')).flatMap(boutons).find((b) => b.id === article.id)?.presse, 'l’article pressé à l’étal').toBe(true);
    const panier = boutons(c['panier']);
    expect(panier[0].libelle, 'sa ligne au panier').toMatch(new RegExp(`^${nom} ×1 · `));
    expect(panier.find((b) => b.id === 'payer'), 'le paiement de son total, ouvert').toMatchObject({ refus: null });
  });

  it('une possession au lot : pressée chez son héros, et la vente ouverte', () => {
    const { suite, jouer } = echoppe();
    expect(corps(suite)['vendre'], 'un lot vide ne se vend pas').toMatchObject({ refus: expect.any(String) });
    const cape = boutons(corps(suite)['vente/bjorn']).find((b) => !b.refus)!;
    const c = corps(jouer(cape.jeu));
    expect(boutons(c['vente/bjorn']).find((b) => b.id === cape.id)?.presse, 'la possession pressée au lot').toBe(true);
    expect(c['vendre'], 'le lot se vend').toMatchObject({ refus: null });
  });
});
