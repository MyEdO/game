import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene } from './monde/scene';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { setRule } from '../engine/policy';
import { toBrass } from '../engine/money';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #619 Lot A — le maquignon vend des MONTURES/VÉHICULES (`unitIds`, `computeFreshStockLines`) : acheter
 * une unité crée une POSSESSION (`ajouterLaPossession`) au lieu d'un objet de sac, la bourse paie le prix
 * `purchase` de `creatures.json` (pas le barème trapping).
 * #760 — l'achat d'une unité entre dans l'écran de RÉPARTITION (comme un objet de sac) : le
 * joueur choisit le héros propriétaire, la possession n'est créée qu'à la validation de l'échoppe (`fenetreValider('marchand')`).
 */
const hero = (id: string, name: string): Combatant =>
  combattantDeTest({ id, label: name, items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: blessuresDeBase(10), conditions: [], weapons: [] });

const maquignonScene = () => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 0, y: 0 }, merchant: { archetype: { id: 'maquignon' } } } as never);
  return sc;
};

describe('#619 Lot A — maquignon : achat d\'unité → possession', () => {
  beforeEach(() => {
    banc.setState({ party: [], scene: null, merchant: null, merchantStocks: {}, possessions: [], journal: [] });
    setRule('marche-mode', 'sans-disponibilite'); // déterministe : toute Dispo Commune/Limitée/Rare en stock (LDB 59 l.15)
  });

  it('le stock liste la mule avec sa Disponibilité, échoue sans le maquignon (garde de câblage)', () => {
    banc.setState({ party: [hero('h', 'H')], scene: maquignonScene() });
    banc.getState().ouvrirLeMarchand('pnj');
    const line = banc.getState().merchant!.stock.find((l) => l.id === 'mule');
    expect(line).toBeDefined();
    expect(line!.qty).toBeGreaterThan(0);
  });

  it('acheter une mule (panier) ouvre la répartition avec une entrée unité — aucune possession avant confirmation (#760)', () => {
    banc.setState({ party: [hero('h', 'H')], scene: maquignonScene() });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    banc.getState().ouvrirLeMarchand('pnj');
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().fenetreChoisir('marchand', 'ajouterAuPanier', 'mule');
    banc.getState().fenetreChoisir('marchand', 'payer', true);
    const st = banc.getState();
    expect(st.possessions.length).toBe(0); // pas encore de possession : en attente de répartition
    expect(st.merchant!.pendingDistribution).toBeTruthy();
    const entry = st.merchant!.pendingDistribution!.find((d) => 'unit' in d && d.unit.id === 'mule');
    expect(entry).toBeDefined();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(before); // bourse débitée du prix `purchase` (5 or)
    expect((st.party[0].items ?? []).some((i) => i.trappingId === 'mule')).toBe(false); // jamais un objet de sac (parité `giveTrapping` évitée)
  });

  it('confirmer la répartition sur le héros CHOISI (pas party[0] par défaut) crée la possession avec le bon ownerId', () => {
    banc.setState({ party: [hero('h1', 'H1'), hero('h2', 'H2')], scene: maquignonScene() });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    banc.getState().ouvrirLeMarchand('pnj');
    banc.getState().fenetreChoisir('marchand', 'ajouterAuPanier', 'mule');
    banc.getState().fenetreChoisir('marchand', 'payer', true);
    const mule = banc.getState().merchant!.pendingDistribution!.find((d) => 'unit' in d && d.unit.id === 'mule');
    expect(mule).toBeDefined();
    banc.getState().fenetreChoisir('marchand', 'repartition', mule!.uid, 'h2'); // réassigne au 2e héros (pas le défaut party[0])
    banc.getState().fenetreValider('marchand');
    const st = banc.getState();
    const pos = st.possessions.find((p) => p.nature === 'bete' && 'id' in p.ref && p.ref.id === 'mule');
    expect(pos).toBeDefined();
    expect(pos!.ownerId).toBe('h2');
    expect(pos!.location).toEqual({ kind: 'avec-le-groupe' });
    expect(st.merchant!.pendingDistribution).toBeFalsy();
  });

  it('acheter un trapping ordinaire (harnachement) chez le maquignon reste inchangé (aucune casse)', () => {
    banc.setState({ party: [hero('h', 'H')], scene: maquignonScene() });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    banc.getState().ouvrirLeMarchand('pnj');
    const line = banc.getState().merchant!.stock.find((l) => l.id === 'selle-et-harnais');
    expect(line).toBeDefined();
    banc.getState().fenetreChoisir('marchand', 'ajouterAuPanier', 'selle-et-harnais');
    banc.getState().fenetreChoisir('marchand', 'payer', true);
    const st = banc.getState();
    expect(st.merchant!.pendingDistribution).toBeTruthy(); // panier avec objet de sac → écran de répartition renseigné
    expect(st.merchant!.pendingDistribution!.some((d) => 'item' in d && d.item.trappingId === 'selle-et-harnais')).toBe(true);
    banc.getState().fenetreValider('marchand');
    expect(banc.getState().party[0].items!.some((i) => i.trappingId === 'selle-et-harnais')).toBe(true);
  });

  it('un panier mixte (unité + objet de sac) verse l\'objet au bon héros ET crée la possession de l\'unité (#760)', () => {
    banc.setState({ party: [hero('h1', 'H1'), hero('h2', 'H2')], scene: maquignonScene() });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    banc.getState().ouvrirLeMarchand('pnj');
    banc.getState().fenetreChoisir('marchand', 'ajouterAuPanier', 'mule');
    banc.getState().fenetreChoisir('marchand', 'ajouterAuPanier', 'selle-et-harnais');
    banc.getState().fenetreChoisir('marchand', 'payer', true);
    const dist = banc.getState().merchant!.pendingDistribution!;
    const unite = dist.find((d) => 'unit' in d);
    const objet = dist.find((d) => 'item' in d);
    expect(unite).toBeDefined();
    expect(objet).toBeDefined();
    banc.getState().fenetreChoisir('marchand', 'repartition', unite!.uid, 'h2');
    banc.getState().fenetreChoisir('marchand', 'repartition', objet!.uid, 'h1');
    banc.getState().fenetreValider('marchand');
    const st = banc.getState();
    const pos = st.possessions.find((p) => p.nature === 'bete' && 'id' in p.ref && p.ref.id === 'mule');
    expect(pos!.ownerId).toBe('h2');
    expect(st.party.find((h) => h.id === 'h1')!.items!.some((i) => i.trappingId === 'selle-et-harnais')).toBe(true);
    expect(st.party.find((h) => h.id === 'h2')!.items!.some((i) => i.trappingId === 'selle-et-harnais')).toBe(false);
  });
});
