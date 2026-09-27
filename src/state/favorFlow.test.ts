/**
 * Système de Faveurs (LDB 23 l.139-151, #509) : création, acquittement (Mineure 1 / Majeure 2+
 * consécutives, reset si interruption), Importante jamais acquittable par Activité, rupture →
 * Niveau de Carrière −1 (min 0).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { fromBrass } from '../engine/money';
import { creditBourse } from './bourseFlow';
import { testScene } from '../scenes/test-fixture';
import { setRule, resetRule } from '../engine/policy';

function setup() {
  vi.useFakeTimers();
  vi.clearAllTimers();
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], favors: [], journal: [] });
  useGame.getState().startScene(testScene());
  vi.clearAllTimers();
  useGame.setState({ favors: [] });
  creditBourse(useGame.getState, useGame.setState, h.id, fromBrass(1000));
  useGame.getState().seedRng(11);
  return h.id;
}

/** Ouvre un interlude d'1 semaine et fixe `left`/`granted` à des valeurs connues (les événements
 *  d100 restent aléatoires — même patron que `interlude-activities-508.test.ts`). `granted` = les
 *  emplacements d'Activité OCTROYÉS au héros ; `left` = ce qu'il en reste. */
function openInterlude(heroId: string, left = 3, granted = left) {
  useGame.getState().startInterlude(1);
  draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  const itl = useGame.getState().interlude!;
  itl.perHero[heroId] = { ...itl.perHero[heroId], fx: undefined, left, granted };
  useGame.setState({ interlude: { ...itl } });
}

describe('Faveurs (LDB 23 l.139-151, #509)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('favor-rumor-spreads'); });

  it('grantFavor : crée une Faveur portée par le héros', () => {
    const heroId = setup();
    useGame.getState().favorGrant(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favors = useGame.getState().favors;
    expect(favors).toHaveLength(1);
    expect(favors[0]).toMatchObject({ heroId, level: 'mineure', owedTo: 'un aubergiste', progress: 0 });
  });

  it('Mineure : UNE Activité l’acquitte (LDB 23 l.147)', () => {
    const heroId = setup();
    useGame.getState().favorGrant(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favorId = useGame.getState().favors[0].id;
    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    expect(useGame.getState().favors).toHaveLength(0); // soldée, retirée
    expect(useGame.getState().interlude!.perHero[heroId].left).toBe(2); // Activité consommée
  });

  it('Majeure : DEUX Activités consécutives l’acquittent, réparties sur deux interludes (LDB 23 l.149)', () => {
    const heroId = setup();
    useGame.getState().favorGrant(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = useGame.getState().favors[0].id;

    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    expect(useGame.getState().favors[0].progress).toBe(1);
    useGame.getState().interludeEnd(); // consacré CET interlude → progression PRÉSERVÉE

    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    expect(useGame.getState().favors).toHaveLength(0); // 2/2 → soldée
  });

  it('Majeure interrompue par CHOIX : un emplacement DISPONIBLE non consacré remet la progression à 0', () => {
    const heroId = setup();
    useGame.getState().favorGrant(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = useGame.getState().favors[0].id;

    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    expect(useGame.getState().favors[0].progress).toBe(1);
    useGame.getState().interludeEnd();

    openInterlude(heroId, 3); // 3 emplacements offerts, AUCUN consacré à la Faveur → un choix
    useGame.getState().interludeEnd();
    expect(useGame.getState().favors).toHaveLength(1);
    expect(useGame.getState().favors[0].progress).toBe(0); // « consécutives » rompu → reset
  });

  it('Majeure : un interlude SANS aucun emplacement possible ne rompt RIEN (rupture par CHOIX seul, #1040)', () => {
    const heroId = setup();
    useGame.getState().favorGrant(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = useGame.getState().favors[0].id;

    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    expect(useGame.getState().favors[0].progress).toBe(1);
    useGame.getState().interludeEnd();

    openInterlude(heroId, 0, 0); // aucune Activité octroyée (événement, devoir elfique) : aucun choix possible
    useGame.getState().interludeEnd();
    expect(useGame.getState().favors[0].progress, 'la chaîne survit à un interlude sans emplacement').toBe(1);

    // Et la chaîne reprend : l'interlude suivant l'achève.
    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    expect(useGame.getState().favors, '2 Activités « consécutives » → soldée').toHaveLength(0);
  });

  it('emplacements TOUS dépensés ailleurs : la chaîne casse (le héros POUVAIT consacrer, il ne l’a pas fait)', () => {
    const heroId = setup();
    useGame.getState().favorGrant(heroId, 'majeure', 'un noble', 'Une escorte discrète');
    const favorId = useGame.getState().favors[0].id;

    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    useGame.getState().interludeEnd();

    openInterlude(heroId, 0, 2); // 2 octroyés, 0 restant : consommés par d'AUTRES Activités
    useGame.getState().interludeEnd();
    expect(useGame.getState().favors[0].progress).toBe(0);
  });

  it('Importante : jamais acquittable par Activité (LDB 23 l.151) — no-op, la Faveur demeure', () => {
    const heroId = setup();
    useGame.getState().favorGrant(heroId, 'importante', 'un seigneur', 'Éliminer un rival');
    const favorId = useGame.getState().favors[0].id;
    openInterlude(heroId, 3);
    useGame.getState().favorSettle(heroId, favorId);
    expect(useGame.getState().favors).toHaveLength(1);
    expect(useGame.getState().favors[0].progress).toBe(0);
    expect(useGame.getState().interlude!.perHero[heroId].left).toBe(3); // aucune Activité consommée
  });

  it('Rupture : retire la Faveur et réduit le Niveau de Carrière de 1, plancher 0 (LDB 23 l.141)', () => {
    const heroId = setup();
    useGame.setState({ party: useGame.getState().party.map((h) => (h.id === heroId ? { ...h, careerLevel: 1 } : h)) });
    useGame.getState().favorGrant(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favorId = useGame.getState().favors[0].id;
    useGame.getState().favorBreak(heroId, favorId);
    expect(useGame.getState().favors).toHaveLength(0);
    const hero = useGame.getState().party.find((h) => h.id === heroId)!;
    expect(hero.careerLevel).toBe(0); // 1 − 1 = 0

    // Plancher 0 : rompre une seconde Faveur ne descend pas sous 0.
    useGame.getState().favorGrant(heroId, 'mineure', 'un autre créancier', 'Un autre service');
    const favorId2 = useGame.getState().favors[0].id;
    useGame.getState().favorBreak(heroId, favorId2);
    expect(useGame.getState().party.find((h) => h.id === heroId)!.careerLevel).toBe(0);
  });

  it('Rupture, règle maison désactivée (`favor-rumor-spreads`) : le Niveau ne bouge pas', () => {
    setRule('favor-rumor-spreads', false);
    const heroId = setup();
    useGame.setState({ party: useGame.getState().party.map((h) => (h.id === heroId ? { ...h, careerLevel: 2 } : h)) });
    useGame.getState().favorGrant(heroId, 'mineure', 'un aubergiste', 'Un service rendu');
    const favorId = useGame.getState().favors[0].id;
    useGame.getState().favorBreak(heroId, favorId);
    expect(useGame.getState().party.find((h) => h.id === heroId)!.careerLevel).toBe(2);
  });
});
