/**
 * LE MARCHÉ DE CARGAISON PAR LE PONT (#3534) : la halle de Grünburg (MSRC 13) et le port de Salzenmund (MDG 15) joués
 * comme Godot les joue (`marcheEnVue`). Chaque offre, son Enc et son prix, son achat (le porteur qui le charge, l'Enc) ;
 * le lot acheté, son porteur, sa vente, son bradage et son transfert vers un porteur co-localisé.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Bouton, Element, Entite, Formulaire, Saisie } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.fermer(); ouvert = null; });

/** Une partie du scénario `scenario` entrée par son service `verbe` dans le marché `cle`. */
function marche(scenario: string, verbe: string, cle: string) {
  const { pont, appel } = table();
  ouvert = pont;
  const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
  let s = drainer(appel, appel('demarrer', { scenario, graine: 7 })).suite;
  const vider = (jusqua?: string) => {
    for (let pas = 0; s.vue.projection.fenetre && s.vue.projection.fenetre.cle !== jusqua; pas++) {
      expect(pas, 'les fenêtres se vident').toBeLessThan(30);
      const g = s.vue.zones['fenetre.gestes'];
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
  it('la halle : chaque offre, son Enc et son prix par Enc, son achat sur un porteur de vrac', () => {
    const { suite } = marche('commerce-fluvial', 'ouvrirLeMarche', 'marcheDeTerre');
    expect(suite.vue.disposition, 'la halle a son écran').toBe('marcheDeTerre');
    const c = corps(suite);
    expect(c['bourse'], 'la bourse du groupe').toMatchObject({ type: 'puce', valeur: '5000 CO' });
    const offre = c['offre/laine-terre'];
    expect([dans(offre, 'dispo'), dans(offre, 'prix')], 'son Enc et son prix').toMatchObject([{ valeur: '350 Enc' }, { valeur: '1 CO / Enc' }]);
    const achat = dans(offre, 'acheter') as Formulaire;
    expect(achat, 'l’achat ouvert').toMatchObject({ verbe: 'acheterLaCargaison', refus: null });
    expect(achat.champs.map((x) => x.nom), 'le porteur, l’offre, l’Enc, dans l’ordre du verbe').toEqual(['porteur', 'offre', 'enc']);
    expect(champ(achat, 'porteur'), 'chaque porteur de vrac et sa place, le retenu saisi d’avance').toMatchObject({ valeurs: [{ libelle: 'Charrette · 25/25 Enc libres', presse: true }, { libelle: 'Mule · 14/14 Enc libres', presse: false }] });
    expect(champ(achat, 'enc'), 'l’Enc que le porteur retenu charge').toMatchObject({ valeur: 25, min: 1, max: 350 });
    expect(suite.vue.zones['fenetre.reglages'], 'rien ne se redit en réglage').toEqual([]);
  });

  it('un lot acheté : son porteur et son Enc, sa vente, son bradage, son transfert vers la mule', () => {
    const { suite, jouer } = marche('commerce-fluvial', 'ouvrirLeMarche', 'marcheDeTerre');
    const porteur = (champ(dans(corps(suite)['offre/laine-terre'], 'acheter') as Formulaire, 'porteur') as Extract<Saisie, { type: 'saisieChoix' | 'saisieCoches' }>).valeurs[0].valeur;
    const c = corps(jouer({ type: 'acheterLaCargaison', args: [porteur, 'laine-terre', 25] }));
    const lot = Object.values(c).find((e) => e.id.startsWith('lot/'))!;
    expect(lot, 'le lot de laine').toMatchObject({ type: 'entite', nom: 'Laine' });
    expect(dans(lot, 'porteur'), 'sur la charrette').toMatchObject({ libelle: 'Charrette', valeur: '25 Enc' });
    expect(dans(c['offre/laine-terre'], 'acheter'), 'la charrette pleine, la mule charge le reste').toMatchObject({ refus: null, champs: [{ nom: 'porteur', valeurs: [{ libelle: 'Mule · 14/14 Enc libres', presse: true }, { libelle: 'Charrette · 0/25 Enc libres', presse: false }] }, {}, { valeur: 14 }] });
    expect(dans(lot, 'vendre'), 'il se vend').toMatchObject({ jeu: { type: 'vendreLaCargaison' }, refus: null });
    expect(dans(lot, 'brader'), 'son bradage dit sa raison').toMatchObject({ jeu: { type: 'jeterLaCargaison' } });
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
