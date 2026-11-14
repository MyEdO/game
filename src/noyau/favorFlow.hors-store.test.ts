/**
 * Système de Faveurs (LDB 23 l.139-151, #509) : création, acquittement (Mineure 1 / Majeure 2+
 * consécutives, reset si interruption), Importante jamais acquittable par Activité, rupture →
 * Niveau de Carrière −1 (min 0).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { fromBrass } from '../engine/money';
import { creditBourse } from './bourseFlow';
import { testScene } from '../scenes/test-fixture';
import { setRule, resetRule } from '../engine/policy';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function setup() {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], favors: [], journal: [] });
  banc.getState().lancerLaScene(testScene());
  banc.abandonner();
  banc.setState({ favors: [] });
  creditBourse(banc.getState, banc.setState, h.id, fromBrass(1000));
  banc.getState().ensemencerLeTirage(11);
  return h.id;
}

/** Ouvre un interlude d'1 semaine et fixe `left`/`granted` à des valeurs connues (les événements
 *  d100 restent aléatoires — même patron que `interlude-activities-508.hors-store.test.ts`). `granted` = les
 *  emplacements d'Activité OCTROYÉS au héros ; `left` = ce qu'il en reste. */
function openInterlude(heroId: string, left = 3, granted = left) {
  banc.getState().ouvrirLInterlude(1);
  draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  const itl = banc.getState().interlude!;
  itl.perHero[heroId] = { ...itl.perHero[heroId], fx: undefined, left, granted };
  banc.setState({ interlude: { ...itl } });
}

describe('Faveurs (LDB 23 l.139-151, #509)', () => {
  afterEach(() => { resetRule('faveur-rumeur-se-repand'); });

  it('grantFavor : crée une Faveur portée par le héros', () => {
    const heroId = setup();
    banc.getState().accorderLaFaveur(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favors = banc.getState().favors;
    expect(favors).toHaveLength(1);
    expect(favors[0]).toMatchObject({ heroId, level: 'mineure', owedTo: 'un aubergiste', progress: 0 });
  });

  it('Mineure : UNE Activité l’acquitte (LDB 23 l.147)', () => {
    const heroId = setup();
    banc.getState().accorderLaFaveur(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favorId = banc.getState().favors[0].id;
    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    expect(banc.getState().favors).toHaveLength(0); // soldée, retirée
    expect(banc.getState().interlude!.perHero[heroId].left).toBe(2); // Activité consommée
  });

  it('Majeure : DEUX Activités consécutives l’acquittent, réparties sur deux interludes (LDB 23 l.149)', () => {
    const heroId = setup();
    banc.getState().accorderLaFaveur(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = banc.getState().favors[0].id;

    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    expect(banc.getState().favors[0].progress).toBe(1);
    banc.getState().fenetreValider('interlude'); // consacré CET interlude → progression PRÉSERVÉE

    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    expect(banc.getState().favors).toHaveLength(0); // 2/2 → soldée
  });

  it('Majeure interrompue par CHOIX : un emplacement DISPONIBLE non consacré remet la progression à 0', () => {
    const heroId = setup();
    banc.getState().accorderLaFaveur(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = banc.getState().favors[0].id;

    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    expect(banc.getState().favors[0].progress).toBe(1);
    banc.getState().fenetreValider('interlude');

    openInterlude(heroId, 3); // 3 emplacements offerts, AUCUN consacré à la Faveur → un choix
    banc.getState().fenetreValider('interlude');
    expect(banc.getState().favors).toHaveLength(1);
    expect(banc.getState().favors[0].progress).toBe(0); // « consécutives » rompu → reset
  });

  it('Majeure : un interlude SANS aucun emplacement possible ne rompt RIEN (rupture par CHOIX seul, #1040)', () => {
    const heroId = setup();
    banc.getState().accorderLaFaveur(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = banc.getState().favors[0].id;

    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    expect(banc.getState().favors[0].progress).toBe(1);
    banc.getState().fenetreValider('interlude');

    openInterlude(heroId, 0, 0); // aucune Activité octroyée (événement, devoir elfique) : aucun choix possible
    banc.getState().fenetreValider('interlude');
    expect(banc.getState().favors[0].progress, 'la chaîne survit à un interlude sans emplacement').toBe(1);

    // Et la chaîne reprend : l'interlude suivant l'achève.
    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    expect(banc.getState().favors, '2 Activités « consécutives » → soldée').toHaveLength(0);
  });

  it('emplacements TOUS dépensés ailleurs : la chaîne casse (le héros POUVAIT consacrer, il ne l’a pas fait)', () => {
    const heroId = setup();
    banc.getState().accorderLaFaveur(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = banc.getState().favors[0].id;

    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    banc.getState().fenetreValider('interlude');

    openInterlude(heroId, 0, 2); // 2 octroyés, 0 restant : consommés par d'AUTRES Activités
    banc.getState().fenetreValider('interlude');
    expect(banc.getState().favors[0].progress).toBe(0);
  });

  it('Importante : jamais acquittable par Activité (LDB 23 l.151) — no-op, la Faveur demeure', () => {
    const heroId = setup();
    banc.getState().accorderLaFaveur(heroId, 'importante', 'un seigneur', 'Éliminer un rival');
    const favorId = banc.getState().favors[0].id;
    openInterlude(heroId, 3);
    banc.getState().solderLaFaveur(heroId, favorId);
    expect(banc.getState().favors).toHaveLength(1);
    expect(banc.getState().favors[0].progress).toBe(0);
    expect(banc.getState().interlude!.perHero[heroId].left).toBe(3); // aucune Activité consommée
  });

  it('Rupture : retire la Faveur et réduit le Niveau de Carrière de 1, plancher 0 (LDB 23 l.141)', () => {
    const heroId = setup();
    banc.setState({ party: banc.getState().party.map((h) => (h.id === heroId ? { ...h, careerLevel: 1 } : h)) });
    banc.getState().accorderLaFaveur(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favorId = banc.getState().favors[0].id;
    banc.getState().rompreLaFaveur(heroId, favorId);
    expect(banc.getState().favors).toHaveLength(0);
    const hero = banc.getState().party.find((h) => h.id === heroId)!;
    expect(hero.careerLevel).toBe(0); // 1 − 1 = 0

    // Plancher 0 : rompre une seconde Faveur ne descend pas sous 0.
    banc.getState().accorderLaFaveur(heroId, 'mineure', 'un autre créancier', 'Un autre service');
    const favorId2 = banc.getState().favors[0].id;
    banc.getState().rompreLaFaveur(heroId, favorId2);
    expect(banc.getState().party.find((h) => h.id === heroId)!.careerLevel).toBe(0);
  });

  it('Rupture, règle maison désactivée (`faveur-rumeur-se-repand`) : le Niveau ne bouge pas', () => {
    setRule('faveur-rumeur-se-repand', false);
    const heroId = setup();
    banc.setState({ party: banc.getState().party.map((h) => (h.id === heroId ? { ...h, careerLevel: 2 } : h)) });
    banc.getState().accorderLaFaveur(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favorId = banc.getState().favors[0].id;
    banc.getState().rompreLaFaveur(heroId, favorId);
    expect(banc.getState().party.find((h) => h.id === heroId)!.careerLevel).toBe(2);
  });
});
