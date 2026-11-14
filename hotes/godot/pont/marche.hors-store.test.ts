/**
 * LE MARCHÉ DE CARGAISON PAR LE PONT (#3534) : la halle de Grünburg (MSRC 13) et le port de Salzenmund (MDG 15) joués
 * comme Godot les joue (`marcheEnVue`). Chaque offre, son Enc et son prix, son achat composé par les choix du marché (le
 * porteur qui le charge, l'Enc, la conclusion, en réglages de la fenêtre) ; le lot acheté, son porteur, sa vente, son
 * bradage et son transfert vers un porteur co-localisé.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, table, gestesDessines } from './pont.testkit';
import type { Bouton, Element, Entite, Formulaire, Saisie } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

/** Une partie du scénario `scenario` entrée par son service `verbe` dans le marché `cle`. */
function marche(scenario: string, verbe: string, cle: string) {
  const { pont, appel } = table();
  ouvert = pont;
  const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
  let s = drainer(appel, appel('demarrer', { scenario, graine: 7 })).suite;
  const vider = (jusqua?: string) => {
    for (let pas = 0; s.vue.projection.fenetre && s.vue.projection.fenetre.cle !== jusqua; pas++) {
      expect(pas, 'les fenêtres se vident').toBeLessThan(30);
      const g = gestesDessines(s.vue);
      s = jouer((g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.find((x): x is Bouton => x.type === 'bouton' && !x.refus)!).jeu);
    }
  };
  vider('ecranDuLieu');
  if (!s.vue.projection.fenetre) s = jouer(s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Le lieu')!.jeu);
  s = jouer((s.vue.zones['fenetre.corps'].flatMap((e) => (e.type === 'entite' ? e.elements : [])).find((b) => b.type === 'bouton' && 'type' in b.jeu && b.jeu.type === verbe) as Bouton).jeu);
  vider(cle);
  return { suite: s, jouer };
}

const corps = (s: Suite) => Object.fromEntries(s.vue.zones['fenetre.corps'].map((e: Element) => [e.id, e]));
const dans = (e: Element, id: string) => (e as Entite).elements.find((x) => x.id === id);
const champ = (f: Formulaire, nom: string) => f.champs.find((c) => c.nom === nom) as Saisie;

describe('le marché de cargaison par le pont', () => {
  it('la halle : chaque offre, son Enc et son prix par Enc, son achat composé sur un porteur de vrac', () => {
    const { suite, jouer } = marche('commerce-fluvial', 'ouvrirLeMarche', 'marcheDeTerre');
    expect(suite.vue.disposition, 'la halle a son écran').toBe('marcheDeTerre');
    const c = corps(suite);
    expect(c['bourse'], 'la bourse du groupe : les 5000 CO du scénario et les 3d10 pistoles de Berta, Marchande (LDB 08 l.419)').toMatchObject({ type: 'puce', valeur: expect.stringMatching(/^5000 CO \d+\/–$/) });
    const offre = c['offre/laine-terre'];
    expect([dans(offre, 'dispo'), dans(offre, 'prix')], 'son Enc et son prix, 1 CO les 10 Enc au livre (MSRC 13 l.91)').toMatchObject([{ valeur: '350 Enc' }, { valeur: '2/– / Enc' }]);
    expect(dans(offre, 'acheter'), 'l’achat ouvert, à composer').toMatchObject({ type: 'bouton', jeu: { type: 'fenetreChoisir', args: ['marcheDeTerre', 'offre', 'laine-terre'] }, presse: false, refus: null });
    expect(suite.vue.zones['fenetre.reglages'], 'rien à régler avant de composer').toEqual([]);
    const compose = jouer((dans(offre, 'acheter') as Bouton).jeu);
    expect(dans(corps(compose)['offre/laine-terre'], 'acheter'), 'l’achat composé, pressé').toMatchObject({ presse: true });
    const reglages = Object.fromEntries(compose.vue.zones['fenetre.reglages'].map((e) => [e.id, e]));
    expect(reglages['fenetreChoisir@marcheDeTerre#porteur'], 'chaque porteur de vrac et sa place, le retenu pressé').toMatchObject({ valeurs: [{ libelle: 'Charrette · 25/25 Enc libres', presse: true }, { libelle: 'Mule · 14/14 Enc libres', presse: false }] });
    expect(Object.keys(reglages), 'le porteur, l’Enc, la conclusion').toEqual(['fenetreChoisir@marcheDeTerre#porteur', 'fenetreChoisir@marcheDeTerre#encombrement', 'fenetreChoisir@marcheDeTerre#acheter']);
  });

  it('un lot acheté : son porteur et son Enc, sa vente, son bradage, son transfert vers la mule', () => {
    const { suite, jouer } = marche('commerce-fluvial', 'ouvrirLeMarche', 'marcheDeTerre');
    jouer((dans(corps(suite)['offre/laine-terre'], 'acheter') as Bouton).jeu);
    const c = corps(jouer({ type: 'fenetreChoisir', args: ['marcheDeTerre', 'acheter', true] }));
    const lot = Object.values(c).find((e) => e.id.startsWith('lot/'))!;
    expect(lot, 'le lot de laine').toMatchObject({ type: 'entite', nom: 'Laine' });
    expect(dans(lot, 'porteur'), 'sur la charrette').toMatchObject({ libelle: 'Charrette', valeur: '25 Enc' });
    const recompose = jouer((dans(c['offre/laine-terre'], 'acheter') as Bouton).jeu);
    expect(recompose.vue.zones['fenetre.reglages'].find((e) => e.id === 'fenetreChoisir@marcheDeTerre#porteur'), 'la charrette pleine, la mule charge le reste').toMatchObject({ valeurs: [{ libelle: 'Charrette · 0/25 Enc libres', presse: false }, { libelle: 'Mule · 14/14 Enc libres', presse: true }] });
    expect(dans(lot, 'vendre'), 'il se vend').toMatchObject({ jeu: { type: 'fenetreChoisir', args: ['marcheDeTerre', 'vendre', lot.id.slice('lot/'.length)] }, refus: null });
    expect(dans(lot, 'brader'), 'son bradage dit sa raison').toMatchObject({ jeu: { type: 'fenetreChoisir', args: ['marcheDeTerre', 'jeter', lot.id.slice('lot/'.length)] } });
    const deplacer = dans(lot, 'deplacer') as Formulaire;
    expect(deplacer, 'il passe sur la mule').toMatchObject({ verbe: 'deplacerLaCargaison', refus: null });
    expect(champ(deplacer, 'vers'), 'la mule, co-localisée').toMatchObject({ valeurs: [{ libelle: 'Mule · 14/14 Enc libres', presse: true }] });
  });

  it('le port : la cale du navire de campagne, sa bourse, son écran', () => {
    const { suite } = marche('voyage-maritime', 'ouvrirLePort', 'port');
    expect(suite.vue.disposition, 'le port a son écran').toBe('port');
    expect(corps(suite)['bourse'], 'la bourse du groupe').toMatchObject({ valeur: '40 CO' });
  });
});
