/**
 * Récolte (ZI 13 l.302-316 ; #1988 B4a-i) : `harvestVictoryCreature` émet un don de `count` pièces de la
 * créature (`PIECES_DE_CREATURE_TRAPPING_ID`, `creatureId`), remises par la fabrique de don, valuées par
 * `valeurDUnePiece` à la vente (`valeurPropre`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyEffects, harvestVictoryCreature } from './combatEffects';
import { flowEffects, flowFromEffects } from './flow';
import { emptyScene, type Effect, type Scene } from './scene';
import { barterQuote, sellBuyerAvailability, sellGain, sellRefusal, valeurPropre, type MerchantState } from './merchantFlow';
import { parseProject } from './worldMap';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { createHero } from '../engine/character';
import { giveTrappingQualities, instancesDeDon, itemLabel, totalEncumbrance } from '../engine/items';
import { harvestSizeOf, harvestYield, PIECES_DE_CREATURE_TRAPPING_ID, valeurDUnePiece } from '../engine/harvest';
import { toBrass } from '../engine/money';
import { creatures, findTrappingById } from '../data';
import type { Combatant, ItemInstance } from '../engine/types';

const GRIFFON = creatures.find((c) => c.id === 'griffon')!;
const RECOLTABLES = creatures.filter((c) => c.harvest);
type DonDObjet = Extract<Effect, { type: 'giveTrapping' }>;
const sansUid = ({ uid: _uid, ...reste }: ItemInstance) => reste;
const MARCHAND: MerchantState = { entityId: 'm', archetype: 'armurier', settlement: 'ville', resaleRate: 0.5, stock: [], cart: [], bargainLocked: false };

function heros(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  h.items = [];
  return h;
}

beforeEach(() => {
  useGame.setState({ party: [heros()], battle: null, scene: null, flags: {}, pendingTest: null, pendingCascade: null, pendingVictory: null, pendingLoot: null, journal: [] });
});

/** Les deux branches du Test de récolte, telles que `harvestVictoryCreature` les pose. */
function branchesDeRecolte(creatureId: string): { reussite: DonDObjet[]; echec: DonDObjet[] } {
  useGame.setState({ pendingTest: null, pendingCascade: null });
  harvestVictoryCreature(useGame.getState, useGame.setState, creatureId);
  const pt = useGame.getState().pendingTest!;
  const dons = (f: typeof pt.onSuccess) => flowEffects(f!).filter((e): e is DonDObjet => e.type === 'giveTrapping');
  return { reussite: dons(pt.onSuccess), echec: dons(pt.onFailure) };
}

describe('câblage — `harvestVictoryCreature` sur une vraie créature', () => {
  it('chaque branche donne `count` pièces de la créature ; appliquée, elle pose `count` instances de 1 Enc', () => {
    const taille = harvestSizeOf(GRIFFON);
    const { reussite, echec } = branchesDeRecolte(GRIFFON.id);
    expect(reussite).toEqual([{ type: 'giveTrapping', trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: GRIFFON.id, count: harvestYield(taille, 0) }]);
    expect(echec).toEqual([{ type: 'giveTrapping', trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: GRIFFON.id, count: harvestYield(taille, -1) }]);

    useGame.setState({ pendingTest: null, pendingCascade: null });
    const avant = totalEncumbrance(useGame.getState().party[0]);
    applyEffects(useGame.getState, useGame.setState, reussite);
    const h = useGame.getState().party[0];
    const pieces = h.items!.filter((i) => i.trappingId === PIECES_DE_CREATURE_TRAPPING_ID);
    expect(pieces).toHaveLength(reussite[0].count!);
    for (const p of pieces) {
      expect(p.creatureId).toBe(GRIFFON.id);
      expect(p.enc).toBe(1);
      expect(itemLabel(p)).toBe('Pièces de créature brutes (Griffon)');
      expect(sellRefusal(p)).toBeNull();
      expect(sellBuyerAvailability(p, 0)).toBeNull();
      expect(toBrass(sellGain(p, MARCHAND))).toBe(toBrass(valeurDUnePiece(GRIFFON.harvest!, 'Frais')));
    }
    expect(totalEncumbrance(h) - avant).toBe(pieces.length);
  });
});

describe('valeur — pour toute créature récoltable, chaque branche remet `harvestYield` pièces valant chacune `valeurDUnePiece(…, Frais)`', () => {
  it.each(RECOLTABLES.map((c) => [c.id] as const))('%s', (id) => {
    const c = creatures.find((x) => x.id === id)!;
    const { reussite, echec } = branchesDeRecolte(id);
    for (const [don, dr] of [[reussite[0], 0], [echec[0], -1]] as const) {
      const pieces = instancesDeDon(don, don.count ?? 1);
      expect(pieces, `DR ${dr}`).toHaveLength(harvestYield(harvestSizeOf(c), dr));
      for (const p of pieces) expect(toBrass(valeurPropre(p)!), `DR ${dr}`).toBe(toBrass(valeurDUnePiece(c.harvest!, 'Frais')));
    }
  });

  // Les deux écarts d'arrondi MESURÉS sur toute créature récoltable × réussite/échec × 3 états × 0-4 baisses : la baisse
  // de prix (LDB 59 l.60) se règle par pièce, `floor` par pièce (#1988 B4a-i).
  it.each([
    ['défaut, 4 baisses', {}],
    ['marchandage perdu, 4 baisses', { bargainSell: { won: false, drNet: -1, negotiator: false } }],
  ] as const)('nuee-de-squigs-des-cavernes (2 Enc), %s : 15 sous en lot, 14 par pièce', (_nom, extra) => {
    const pieces = instancesDeDon({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: 'nuee-de-squigs-des-cavernes' }, 2);
    const m: MerchantState = { ...MARCHAND, ...extra, sellHalvings: Object.fromEntries(pieces.map((p) => [p.uid, 4])) };
    expect(pieces.reduce((s, p) => s + toBrass(sellGain(p, m)), 0)).toBe(14);
  });
});

describe('commerce — la pièce est hors catalogue marchand', () => {
  it('aucun troc ne la cote (critère existant : prix catalogue nul)', () => {
    expect(findTrappingById(PIECES_DE_CREATURE_TRAPPING_ID)!.price).toBeNull();
    expect(barterQuote(PIECES_DE_CREATURE_TRAPPING_ID, 'dague')).toBeNull();
  });
});

describe('fabrique unique — Effet, ramassage, op et butin rendent la même instance', () => {
  function combatAvecProp(prop: Scene['entities'][number]): Combatant {
    const hero = heros();
    hero.pos = { x: 0, y: 0 };
    const scene = emptyScene(8, 8);
    scene.id = 'ramassage';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } }, { ...prop, pos: { x: 1, y: 0 } });
    const bh: Combatant = structuredClone(hero);
    const battle: BattleState = {
      combatants: [bh], order: [bh.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [hero], scene, mode: 'battle', battle, flags: {} });
    return bh;
  }
  const ramasse = (don: DonDObjet): ItemInstance[] => {
    const bh = combatAvecProp({ id: 'corps', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Corps', usable: { actions: [{ id: 'fouiller', flow: flowFromEffects([don]) }] } });
    useGame.getState().battlePickup('corps', 'fouiller:eff:0');
    return useGame.getState().battle!.combatants.find((c) => c.id === bh.id)!.items ?? [];
  };
  const parEffet = (don: DonDObjet): ItemInstance[] => {
    useGame.setState({ party: [heros()], battle: null, scene: null });
    applyEffects(useGame.getState, useGame.setState, [don]);
    return useGame.getState().party[0].items ?? [];
  };

  it.each([
    ['objet magique', { type: 'giveTrapping', trappingId: 'epee-batarde', qualities: ['magique'], identified: false } as DonDObjet],
    ['pièce', { type: 'giveTrapping', trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: 'griffon', count: 3 } as DonDObjet],
  ])('%s', (_nom, don) => {
    const attendu = instancesDeDon(don, don.count ?? 1).map(sansUid);
    expect(parEffet(don).map(sansUid)).toEqual(attendu);
    expect(ramasse(don).map(sansUid)).toEqual(attendu);
    expect(giveTrappingQualities(don)).toEqual(attendu[0].qualities);
  });

  it.each([
    ['arene-zone12', ['magique', 'de-plaies-atroces']],
    ['arene-exp-foret', ['raffine']],
  ] as const)('%s/p17 : le ramassage en combat garde les qualités du butin', (sceneId, qualites) => {
    const doc = parseProject(lireProjetLivre('arene/arene-projet.json'));
    const p17 = doc.scenes.find((s: Scene) => s.id === sceneId)!.entities.find((e: Scene['entities'][number]) => e.id === 'p17')!;
    const don = flowEffects(p17.usable!.actions![0].flow).find((e): e is DonDObjet => e.type === 'giveTrapping')!;
    const bh = combatAvecProp(p17);
    useGame.getState().battlePickup('p17', `${p17.usable!.actions![0].id}:eff:${flowEffects(p17.usable!.actions![0].flow).indexOf(don)}`);
    const it = useGame.getState().battle!.combatants.find((c) => c.id === bh.id)!.items!.find((i) => i.trappingId === don.trappingId)!;
    for (const q of qualites) expect(it.qualities.map((x) => x.id)).toContain(q);
    if (don.identified === false) expect(it.identified).toBe(false);
  });
});
