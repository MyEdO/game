import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { emptyScene } from './scene';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { setRule, resetRule } from '../engine/policy';
import { toBrass } from '../engine/money';
import type { Combatant } from '../engine/types';

/**
 * #619 Lot A — le maquignon vend des MONTURES/VÉHICULES (`unitIds`, `computeFreshStockLines`) : acheter
 * une unité crée une POSSESSION (`addPossession`) au lieu d'un objet de sac, la bourse paie le prix
 * `purchase` de `creatures.json` (pas le barème trapping).
 * #760 — l'achat d'une unité entre dans l'écran de RÉPARTITION (comme un objet de sac) : le
 * joueur choisit le héros propriétaire, la possession n'est créée qu'à `confirmDistribution`.
 */
const hero = (id: string, name: string): Combatant =>
  ({ id, name, items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

const maquignonScene = () => {
  const sc = emptyScene(4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'maquignon' } } as never);
  return sc;
};

describe('#619 Lot A — maquignon : achat d\'unité → possession', () => {
  beforeEach(() => {
    useGame.setState({ party: [], scene: null, merchant: null, merchantStocks: {}, possessions: [], journal: [] });
    setRule('market-mode', 'sans-disponibilite'); // déterministe : toute Dispo Commune/Limitée/Rare en stock (LDB 59 l.15)
  });
  afterEach(() => resetRule('market-mode'));

  it('le stock liste la mule avec sa Disponibilité, échoue sans le maquignon (garde de câblage)', () => {
    useGame.setState({ party: [hero('h', 'H')], scene: maquignonScene() });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock.find((l) => l.id === 'mule');
    expect(line).toBeDefined();
    expect(line!.qty).toBeGreaterThan(0);
  });

  it('acheter une mule (panier) ouvre la répartition avec une entrée unité — aucune possession avant confirmation (#760)', () => {
    useGame.setState({ party: [hero('h', 'H')], scene: maquignonScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().addToCart('mule');
    useGame.getState().payCart();
    const st = useGame.getState();
    expect(st.possessions.length).toBe(0); // pas encore de possession : en attente de répartition
    expect(st.merchant!.pendingDistribution).toBeTruthy();
    const entry = st.merchant!.pendingDistribution!.find((d) => 'unit' in d && d.unit.id === 'mule');
    expect(entry).toBeDefined();
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBeLessThan(before); // bourse débitée du prix `purchase` (5 or)
    expect((st.party[0].items ?? []).some((i) => i.trappingId === 'mule')).toBe(false); // jamais un objet de sac (parité `giveTrapping` évitée)
  });

  it('confirmer la répartition sur le héros CHOISI (pas party[0] par défaut) crée la possession avec le bon ownerId', () => {
    useGame.setState({ party: [hero('h1', 'H1'), hero('h2', 'H2')], scene: maquignonScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    useGame.getState().addToCart('mule');
    useGame.getState().payCart();
    const idx = useGame.getState().merchant!.pendingDistribution!.findIndex((d) => 'unit' in d && d.unit.id === 'mule');
    expect(idx).toBeGreaterThanOrEqual(0);
    useGame.getState().assignDistribution(idx, 'h2'); // réassigne au 2e héros (pas le défaut party[0])
    useGame.getState().confirmDistribution();
    const st = useGame.getState();
    const pos = st.possessions.find((p) => p.nature === 'bete' && 'creatureId' in p.ref && p.ref.creatureId === 'mule');
    expect(pos).toBeDefined();
    expect(pos!.ownerId).toBe('h2');
    expect(pos!.location).toEqual({ kind: 'avec-le-groupe' });
    expect(st.merchant!.pendingDistribution).toBeFalsy();
  });

  it('acheter un trapping ordinaire (harnachement) chez le maquignon reste inchangé (aucune casse)', () => {
    useGame.setState({ party: [hero('h', 'H')], scene: maquignonScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock.find((l) => l.id === 'selle-et-harnais');
    expect(line).toBeDefined();
    useGame.getState().addToCart('selle-et-harnais');
    useGame.getState().payCart();
    const st = useGame.getState();
    expect(st.merchant!.pendingDistribution).toBeTruthy(); // panier avec objet de sac → écran de répartition renseigné
    expect(st.merchant!.pendingDistribution!.some((d) => 'item' in d && d.item.trappingId === 'selle-et-harnais')).toBe(true);
    useGame.getState().confirmDistribution();
    expect(useGame.getState().party[0].items!.some((i) => i.trappingId === 'selle-et-harnais')).toBe(true);
  });

  it('un panier mixte (unité + objet de sac) verse l\'objet au bon héros ET crée la possession de l\'unité (#760)', () => {
    useGame.setState({ party: [hero('h1', 'H1'), hero('h2', 'H2')], scene: maquignonScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    useGame.getState().addToCart('mule');
    useGame.getState().addToCart('selle-et-harnais');
    useGame.getState().payCart();
    const dist = useGame.getState().merchant!.pendingDistribution!;
    const unitIdx = dist.findIndex((d) => 'unit' in d);
    const itemIdx = dist.findIndex((d) => 'item' in d);
    expect(unitIdx).toBeGreaterThanOrEqual(0);
    expect(itemIdx).toBeGreaterThanOrEqual(0);
    useGame.getState().assignDistribution(unitIdx, 'h2');
    useGame.getState().assignDistribution(itemIdx, 'h1');
    useGame.getState().confirmDistribution();
    const st = useGame.getState();
    const pos = st.possessions.find((p) => p.nature === 'bete' && 'creatureId' in p.ref && p.ref.creatureId === 'mule');
    expect(pos!.ownerId).toBe('h2');
    expect(st.party.find((h) => h.id === 'h1')!.items!.some((i) => i.trappingId === 'selle-et-harnais')).toBe(true);
    expect(st.party.find((h) => h.id === 'h2')!.items!.some((i) => i.trappingId === 'selle-et-harnais')).toBe(false);
  });
});
