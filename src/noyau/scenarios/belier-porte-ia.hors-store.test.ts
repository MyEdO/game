import { describe, expect, it } from 'vitest';
import { structureImmune } from '../../engine/structures';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { scenario } from '../../scenes/test-scenarios/42-belier-porte';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { bus, EVT, type ChargeDAttaque } from '../bus';
import { buildAiInput, runEnemyAI } from '../combatFlow';
import type { BattleState } from '../etat';
import { chooseEnemyAction } from '../monde/ai';
import { distanceDeContact } from '../monde/footprint';
import { leaveChef, serveAtPoste, translaterFormation } from '../monde/shipPostes';
import { placeCombatant } from '../monde/spawn';

const GRAINE = 2;

function donnerLeTour(banc: Banc, id: string, round?: number): void {
  const battle = banc.getState().battle!;
  const turn = battle.order.indexOf(id);
  expect(turn).toBeGreaterThanOrEqual(0);
  banc.setState({ battle: { ...battle, round: round ?? battle.round, turn, movementUsed: 0, acted: false, action: null } });
}

function ouvrirLeSiege(auContact = false) {
  const banc = ouvrirLeBanc({ graine: GRAINE });
  const { party, scene } = scenario.construire(idsDeTest);
  banc.setState({ party });
  banc.actions.lancerLaScene(scene);
  banc.actions.lancerLeCombat(scenario.autoCombat!);
  banc.actions.fenetreValider('debutDuRound');
  banc.abandonner();

  const battle = banc.getState().battle!;
  const coque = battle.combatants.find((acteur) => acteur.postes?.some((poste) => poste.item.trappingId === 'belier-ade2'))!;
  const poste = coque.postes![0];
  const equipage = () => poste.crewIds!.map((id) => battle.combatants.find((acteur) => acteur.id === id)!);
  const membres = equipage();
  const [ancienChef, chef] = membres;
  const porte = battle.combatants.find((acteur) => acteur.structureEdge)!;

  if (auContact) {
    const dy = porte.pos!.y + 1 - coque.pos!.y;
    expect(translaterFormation(battle.combatants, scene, coque, poste.crewIds!, { x: 0, y: dy })).not.toBeNull();
    const dernierServant = membres[membres.length - 1];
    const positionDuChef = { ...chef.pos! };
    placeCombatant(chef, scene, dernierServant.pos!);
    placeCombatant(dernierServant, scene, positionDuChef);
  }

  donnerLeTour(banc, ancienChef.id);
  banc.actions.quitterLePoste();
  expect(poste.crewIds![0]).toBe(chef.id);
  expect(chef.aiControlled).toBe(true);
  expect(chef.mannedPoste?.item.uid).toBe(poste.item.uid);
  donnerLeTour(banc, chef.id);
  return { banc, scene, battle, coque, poste, chef, porte, equipage };
}

function jouerLeTour(banc: Banc, chefId: string): void {
  runEnemyAI(banc.getState, banc.setState, chefId);
  const tourTermine = ({ battle }: { battle?: BattleState | null }) =>
    !battle || !!battle.over || battle.order[battle.turn] !== chefId;
  banc.jusquA(tourTermine);
  expect(tourTermine(banc.getState())).toBe(true);
}

describe('Bélier — porte (#4226)', () => {
  it('après la succession, choisit puis frappe la porte avec la pièce au contact', () => {
    const { banc, scene, coque, chef, porte, poste } = ouvrirLeSiege(true);
    expect(distanceDeContact(scene, coque, porte)).toBe(1);
    expect(distanceDeContact(scene, chef, porte)).toBeGreaterThan(1);
    const armePersonnelle = chef.weapons.find((arme) => arme.type === 'melee');
    expect(armePersonnelle).toBeDefined();
    expect(armePersonnelle?.uid).not.toBe(poste.item.uid);
    expect(structureImmune(armePersonnelle, porte)).toBe(true);
    const piece = chef.weapons.find((arme) => arme.uid === poste.item.uid);
    expect(structureImmune(piece, porte)).toBe(false);

    const decision = chooseEnemyAction(buildAiInput(chef, banc.getState));
    const blessuresAvant = porte.wounds.current;
    const coups: ChargeDAttaque[] = [];
    const retirer = bus.on(EVT.ANIM_ATTACK, (coup) => {
      if (coup.from === chef.id && coup.to === porte.id) coups.push(coup);
    });
    try {
      jouerLeTour(banc, chef.id);
    } finally {
      retirer();
    }

    expect(decision).toMatchObject({ kind: 'melee', targetId: porte.id, weaponUid: poste.item.uid });
    expect(coups).toEqual([
      expect.objectContaining({ kind: 'melee', weapon: expect.objectContaining({ uid: poste.item.uid }) }),
    ]);
    expect(porte.wounds.current).toBeLessThan(blessuresAvant);
  });

  it('hors de contact, pousse la pièce et son équipe vers la porte, puis frappe en arrivant', () => {
    const { banc, scene, coque, chef, porte, equipage } = ouvrirLeSiege();
    const distance = () => distanceDeContact(scene, coque, porte);
    const distanceAvant = distance();
    const blessuresAvant = porte.wounds.current;
    expect(distanceAvant).toBeGreaterThan(1);
    const mobiles = [coque, ...equipage()];
    const departs = mobiles.map(({ pos }) => ({ ...pos! }));

    jouerLeTour(banc, chef.id);

    expect(distance()).toBeLessThan(distanceAvant);
    const dx = coque.pos!.x - departs[0].x;
    const dy = coque.pos!.y - departs[0].y;
    expect(mobiles.map(({ pos }) => [pos!.x, pos!.y]))
      .toEqual(departs.map(({ x, y }) => [x + dx, y + dy]));
    expect(porte.wounds.current).toBe(blessuresAvant);

    donnerLeTour(banc, chef.id, banc.getState().battle!.round + 1);
    jouerLeTour(banc, chef.id);

    expect(distance()).toBe(1);
    expect(porte.wounds.current).toBeLessThan(blessuresAvant);
  });

  it("poursuit l'objectif de brèche après la mort du dernier adversaire", () => {
    const { banc, chef, poste, porte, battle } = ouvrirLeSiege(true);
    const defenseur = battle.combatants.find((acteur) => acteur.kind === 'ennemi' && !acteur.inert)!;
    defenseur.dead = true;
    const blessuresAvant = porte.wounds.current;

    expect(chooseEnemyAction(buildAiInput(chef, banc.getState)))
      .toMatchObject({ kind: 'melee', targetId: porte.id, weaponUid: poste.item.uid });
    jouerLeTour(banc, chef.id);

    expect(porte.wounds.current).toBeLessThan(blessuresAvant);
  });

  it("laisse la porte intacte quand le groupe n'a pas d'objectif de brèche", () => {
    const { banc, chef, porte } = ouvrirLeSiege(true);
    const battle = banc.getState().battle!;
    banc.setState({ battle: { ...battle, victoryCondition: undefined } });
    const blessuresAvant = porte.wounds.current;

    jouerLeTour(banc, chef.id);

    expect(porte.wounds.current).toBe(blessuresAvant);
  });

  it("un servant entré en renfort ne reçoit pas l'objectif de brèche du chef", () => {
    const { banc, chef, poste, equipage, battle } = ouvrirLeSiege(true);
    const renfort = equipage()[1];
    leaveChef(renfort, poste, battle.combatants);
    serveAtPoste(renfort, poste, battle.combatants);
    expect(renfort.mannedPoste?.item.uid).toBe(poste.item.uid);
    expect(poste.crewIds![0]).toBe(chef.id);

    expect(buildAiInput(renfort, banc.getState).meleeDeStructure?.cibles ?? []).toEqual([]);
  });

  it.each([false, true])("en sous-effectif, ne pousse pas et n'abîme pas la porte (au contact : %s)", (auContact) => {
    const { banc, coque, chef, porte, poste, equipage, battle } = ouvrirLeSiege(auContact);
    for (const servant of equipage().slice(2)) leaveChef(servant, poste, battle.combatants);
    expect(equipage()).toHaveLength(2);
    const position = { ...coque.pos! };
    const blessures = porte.wounds.current;

    jouerLeTour(banc, chef.id);

    expect(coque.pos).toEqual(position);
    expect(porte.wounds.current).toBe(blessures);
  });
});
