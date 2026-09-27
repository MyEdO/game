import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';
import { ficheDEntite } from '../../state/sceneNpc';
import { applyCriticalToTarget, firedAttackBlock } from '../../state/combatFlow';
import { applyShipPostes } from '../../state/shipPostes';
import { availableAttacks } from '../../state/combatManeuvers';
import { seedBattleRng } from '../../state/battleRng';
import { layerTiles, sceneMetresPerTile } from '../../state/scene';
import { PREGEN } from '../../data/pregens';
import type { BattleState } from '../../state/store';
import type { Combatant } from '../../engine/types';

/** Ids de PARTY pregen des 2 canonniers (Soldat + Chasseur) — chefs de pièce des pierriers de la barge amie.
 *  Couplage runtime `applyShipPostes` : ces ids ne changent PAS (ils réfèrent le groupe, pas la rencontre). */
const GUNNER_IDS = [`pregen-${PREGEN.soldat}`, `pregen-${PREGEN.chasseur}`];

const scen = testScenarios.find((s) => s.id === 'combat-naval')!;

/** Reconstruit le roster d'entités du scénario (ids déterministes `enemy-enc-naval-<i>` — cogue, pirates
 *  ET la barge AMIE), par la fiche que `combatSlice` spawne au démarrage (`ficheDEntite`). */
function spawnRoster(): Combatant[] {
  const ents = scen.scene.entities
    .filter((e) => e.id.startsWith('enemy-enc-naval-'))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return ents.map(ficheDEntite);
}

/**
 * La Scène est compilée par `buildScene(MapSpec)` (headless-editor) — plus aucun `arena()`+`setEncounters()`
 * impératif. Ce bloc verrouille l'ÉQUIVALENCE en jeu : mêmes dimensions, terrain 'planches', échelle 2 m/case
 * (metresPerTile non forcé → défaut), et un roster d'ennemis dont l'ORDRE d'index est load-bearing (la cogue
 * référence `enemy-enc-naval-1..3` ; la barge amie est l'index 4, côté 'ally', avec ses 2 postes de pierrier).
 */
describe('Scène compilée par buildScene — équivalence de map', () => {
  const scene = scen.scene;
  it('dimensions 18×12, terrain planches, échelle par défaut (2 m/case, non forcée)', () => {
    expect(scene.dimensions).toEqual({ w: 18, h: 12 });
    expect(layerTiles(scene, 0).every((t) => t === 'planches')).toBe(true);
    expect(scene.metresPerTile).toBe(2); // pas de metresPerTile forcé par le MapSpec → défaut EXPLICITE d'emptyScene (#841 FU-A)
    expect(sceneMetresPerTile(scene)).toBe(2);
    expect(scene.entities.find((e) => e.kind === 'heroStart')?.pos).toEqual({ x: 2, y: 6 });
  });

  it('roster de 5 ennemis aux ids déterministes, ordre d’index préservé (cogue 0, pirates 1-3, barge 4)', () => {
    const members = scene.encounters.find((e) => e.id === 'enc-naval')!.members ?? [];
    expect(members.map((m) => m.entityId)).toEqual([
      'enemy-enc-naval-0',
      'enemy-enc-naval-1',
      'enemy-enc-naval-2',
      'enemy-enc-naval-3',
      'enemy-enc-naval-4',
    ]);
    const byId = (id: string) => scene.entities.find((e) => e.id === id)!;
    expect(byId('enemy-enc-naval-0').ref).toBe('cogue'); // index 0 = la cogue ennemie
    expect(byId('enemy-enc-naval-0').crewIds).toEqual(['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3']);
    expect(byId('enemy-enc-naval-0').upgrades).toEqual([{ id: 'blindage-fer' }]);
    expect(byId('enemy-enc-naval-1').ref).toBe('pirate-fluvial');
    expect(byId('enemy-enc-naval-2').ref).toBe('pirate-fluvial');
    expect(byId('enemy-enc-naval-3').ref).toBe('chef-pirate');
    expect(byId('enemy-enc-naval-4').ref).toBe('bateau-de-patrouille'); // index 4 = la barge amie
  });

  it('la barge amie (index 4) est côté ally, cap Nord, avec ses 2 postes de pierrier servis par les canonniers', () => {
    const members = scene.encounters.find((e) => e.id === 'enc-naval')!.members ?? [];
    expect(members[4]).toEqual({ entityId: 'enemy-enc-naval-4', side: 'ally' });
    const barge = scene.entities.find((e) => e.id === 'enemy-enc-naval-4')!;
    expect(barge.facing).toBe('N');
    expect(barge.postes).toHaveLength(2);
    expect(barge.postes!.map((p) => p.side)).toEqual(['tribord', 'tribord']);
    // chaque poste est servi par un des 2 canonniers du groupe (ids de PARTY pregen inchangés)
    expect(barge.postes!.map((p) => p.crewIds)).toEqual([[GUNNER_IDS[0]], [GUNNER_IDS[1]]]);
    expect(barge.crewIds).toEqual(GUNNER_IDS); // équipage exposé = les 2 canonniers
  });
});

/**
 * Vérification BOUT-EN-BOUT du scénario jouable (sans navigateur) : l'authoring (cogue + équipage) se
 * SPAWN en un navire-Combattant lié à de vrais marins, et un Coup Critique encaissé par la coque produit
 * un effet NAVAL (État sur la coque) ou touche l'équipage — toute la chaîne MDG 13-14.
 */
describe('Scénario Bataille navale — chaîne navale jouable', () => {
  it('la cogue spawn comme COQUE (vehicule, enemy, B50) liée à son ÉQUIPAGE (crewIds → vrais marins)', () => {
    const ship = spawnRoster().find((c) => c.id === 'enemy-enc-naval-0')!;
    expect(ship.bodyShape).toBe('vehicule');
    expect(ship.kind).toBe('enemy');
    expect(ship.creatureId).toBe('cogue');
    expect(ship.wounds.max).toBe(50);
    expect(ship.crewIds).toEqual(['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3']);
  });

  it('l’Amélioration d’instance « Blindage (fer) » donne 2 PA de coque au spawn (MDG 12 l.236)', () => {
    const ship = spawnRoster().find((c) => c.id === 'enemy-enc-naval-0')!;
    expect(ship.upgrades).toEqual([{ id: 'blindage-fer' }]); // authoré sur l'instance de la scène (réf par id)
    expect(ship.armour.corps).toBe(2); // mitige les Dégâts navals (applyOps op wounds)
  });

  it('frapper la coque pose un État NAVAL ou touche l’équipage lié (balayage de seeds, déterministe)', () => {
    let navalEffect = false;
    for (let seed = 1; seed <= 60 && !navalEffect; seed++) {
      seedBattleRng(seed);
      const roster = spawnRoster();
      const ship = roster.find((c) => c.id === 'enemy-enc-naval-0')!;
      const crew = roster.filter((c) => ship.crewIds!.includes(c.id));
      const before = crew.map((c) => c.wounds.current);
      const get = (() => ({ battle: { combatants: roster } })) as never;
      applyCriticalToTarget(ship, 'corps', true, 0, [], (() => {}) as never, { get });
      const hullState = ship.conditions.length > 0;
      const crewHurt = crew.some((c, i) => c.wounds.current < before[i] || (c.traumas?.length ?? 0) > 0 || c.conditions.length > 0);
      navalEffect = hullState || crewHurt;
    }
    expect(navalEffect).toBe(true);
  });
});

/**
 * Artillerie JOUABLE par poste servi (MDG 12-13) — jamais un pierrier posé dans un inventaire.
 * Au démarrage, `applyShipPostes` sert les pierriers de la barge AMIE à leurs chefs de pièce (le Soldat +
 * le Chasseur) → l'attaque dédiée « Servir le pierrier » apparaît, épinglant le canon du poste.
 */
describe('Artillerie jouable — 2 héros SERVENT un poste de pierrier (pas d’inventaire)', () => {
  it('applyShipPostes pose le mannedPoste sur le Soldat + le Chasseur, et l’attaque « Servir » apparaît', () => {
    const party = scen.makeParty();
    const all = [...party, ...spawnRoster()];
    applyShipPostes(all); // comme combatSlice au démarrage
    const gunners = party.filter((h) => h.mannedPoste);
    expect(gunners.length).toBe(2); // le Soldat (seed 101) + le Chasseur (seed 303)
    const battle = { combatants: all, acted: false } as unknown as BattleState;
    for (const g of gunners) {
      const w = g.weapons.find((x) => x.uid === g.mannedPoste!.item.uid);
      expect(w?.type).toBe('ranged'); // le pierrier servi est une arme à distance
      expect(w?.subType).toBe('armes-de-siege');
      const serve = availableAttacks(g, battle).find((o) => o.id === 'poste');
      expect(serve).toBeDefined(); // bouton « Servir le pierrier »
      expect(serve!.weaponUid).toBe(g.mannedPoste!.item.uid); // épingle le canon (≠ arme perso auto-choisie)
    }
  });

  it('les 2 autres héros (Tueur + Sorcier) ne servent AUCUN poste — ils aborderont', () => {
    const party = scen.makeParty();
    applyShipPostes([...party, ...spawnRoster()]);
    expect(party.filter((h) => !h.mannedPoste).length).toBe(2);
  });

  it('la bordée tribord PEUT TIRER sur la cogue (cap Nord = octant tribord + munition de siège + chargé)', () => {
    const party = scen.makeParty();
    const all = [...party, ...spawnRoster()];
    applyShipPostes(all);
    const gunner = party.find((h) => h.mannedPoste)!;
    gunner.pos = { x: 3, y: 6 }; // à bord de la barge
    const cogue = all.find((c) => c.id === 'enemy-enc-naval-0')!; // plein est de la barge
    const barge = all.find((c) => c.id === 'enemy-enc-naval-4')!;
    // `faceAtCombatStart` applique le cap authoré (Nord) ; la cogue plein EST tombe dans l'arc TRIBORD.
    const get = (() => ({ battle: { combatants: all }, facing: { [barge.id]: 'N' }, log: () => {} })) as never;
    // null = le tir PART : dans l'arc (cap Nord) + munition compatible + chargé. (Un cap 'E' le mettrait en
    // proue → reason 'arc' ; sans munition → 'noammo'.) → garde-fou contre les deux régressions.
    expect(firedAttackBlock(get, gunner, cogue, gunner.mannedPoste!.item.uid)).toBeNull();
  });
});
