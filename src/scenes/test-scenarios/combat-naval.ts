import { makeShowcaseParty, PREGEN } from '../../data/pregens';
import { itemFromTrappingById, loadWeapon } from '../../engine/items';
import type { Combatant, ShipPoste } from '../../engine/types';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

// Ids STABLES des 2 canonniers (le Soldat + le Chasseur du groupe d'arène) qui SERVENT les pierriers.
const GUNNERS = [`pregen-${PREGEN.soldat}`, `pregen-${PREGEN.chasseur}`] as const;

/**
 * Un poste de PIERRIER (canon léger de pont, MDG 12) monté à tribord de la barge, servi par `chefId`,
 * avec son STOCK DE MUNITIONS (l.410-424) : balles & poudre (Empaleuse/Perforante, Tir de zone 3) ET
 * petites munitions (Tir de zone 6) — le coffre appartient à la PIÈCE (sélecteur sur la fiche du navire),
 * plus à la besace du servant. La pièce appartient à la COQUE (source de vérité) ; au début du combat
 * `applyShipPostes` la sert au chef (`mannedPoste`) → l'attaque dédiée « Servir le pierrier ».
 */
function pierrierPoste(chefId: string): ShipPoste {
  const balles = itemFromTrappingById('balles-et-poudre-pierrier')!;
  balles.qty = 10; // de quoi bombarder plusieurs Rounds (Recharge entre chaque tir)
  const mitraille = itemFromTrappingById('petites-munitions-et-poudre-pierrier')!;
  mitraille.qty = 6;
  return { item: itemFromTrappingById('pierrier')!, side: 'tribord', crewIds: [chefId], ammo: [balles, mitraille], ammoUid: balles.uid };
}

/**
 * Groupe d'arène ; les 2 chefs de pièce (Soldat + Chasseur, cf. GUNNERS) démarrent CHARGÉS — les munitions
 * vivent dans le COFFRE du poste (cf. `pierrierPoste`), le canon reste un poste de la barge (servi au
 * combat par `applyShipPostes`). Les 2 autres (Tueur + Sorcier) gardent leur arme de mêlée pour l'abordage.
 */
function makeNavalParty(): Combatant[] {
  const party = makeShowcaseParty();
  for (const id of GUNNERS) {
    const g = party.find((h) => h.id === id);
    // Chargé d'emblée → tir dès le 1er Round. L'état de charge vit sur CHAQUE arme (arbitrage 2026-08-16).
    if (g) for (const w of g.weapons.filter((x) => x.type === 'ranged')) loadWeapon(g, w);
  }
  return party;
}

// Bataille navale (MDG 13-14) — vitrine jouable de la chaîne navale :
//  - chaque canon est un POSTE de la coque, SERVI par un chef de pièce (MDG 12) : les 2 canonniers du
//    groupe servent les pierriers de LEUR barge (attaque « Servir le pierrier », arc de bordée) au lieu de
//    porter le canon en inventaire ;
//  - le NAVIRE ennemi (cogue, coque E45/B50) est un Combattant à PV : on le bombarde comme un ennemi ; un
//    Coup Critique se résout sur les tables de NAVIRE (localisation par gréement → États Voie d'eau / En
//    flammes) et son ÉQUIPAGE exposé (pirates, `crewIds`) encaisse les Éclats / un Critique « Équipage ».
const construireScene = (): Scene => buildScene({
  id: 'test-bataille-navale',
  label: 'Bataille navale',
  size: [18, 12],
  terrain: 'planches',
  heroStart: [2, 6],
  startMessage:
    'Le capitaine rugit par-dessus le vent : « Cogue pirate à l’horizon, coque blindée de fer — ça va cogner dur ! ' +
    'Canonniers, à vos pièces, servez les pierriers et arrosez-la de boulets ! Un coup bien placé peut l’ouvrir à ' +
    'la voie d’eau ou y mettre le feu. Le reste, apprêtez les grappins, on aborde ! » Sur le pont adverse, les ' +
    'pirates restent exposés au feu et à l’abordage.',
  encounters: [
    {
      id: 'enc-naval',
      enemies: [
        // index 0 = la cogue ennemie ; équipage exposé = les pirates (index 1-3), ids `enemy-enc-naval-<i>`.
        // Amélioration d'INSTANCE « Blindage (fer) » (MDG 12 l.236) → +2 PA de coque : les pierriers tapent
        // moins fort, la cogue encaisse plus longtemps (démontre les améliorations qui modifient le navire).
        { ref: 'cogue', pos: { x: 13, y: 6 }, label: 'Cogue pirate', upgrades: [{ id: 'blindage-fer' }],
          crewIds: ['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3'] },
        { ref: 'pirate-fluvial', pos: { x: 11, y: 4 } },
        { ref: 'pirate-fluvial', pos: { x: 11, y: 8 } },
        { ref: 'chef-pirate', pos: { x: 15, y: 6 } },
        // index 4 = la BARGE AMIE (côté allié) : 2 pierriers SERVIS par les 2 canonniers du groupe. Son
        // équipage exposé (`crewIds`) = ces canonniers ; `applyShipPostes` leur pose le `mannedPoste`. Cap NORD
        // (appliqué par `faceAtCombatStart`) → la cogue, plein EST, tombe pile dans l'arc de la bordée TRIBORD
        // (octant 2) ; vire le cap (Phase 2 Manœuvre) et la cogue sort de l'arc.
        { ref: 'bateau-de-patrouille', pos: { x: 3, y: 6 }, side: 'ally', facing: 'N', label: 'Barge des aventuriers',
          crewIds: [...GUNNERS], postes: [pierrierPoste(GUNNERS[0]), pierrierPoste(GUNNERS[1])] },
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'combat-naval',
  order: 11,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'Combat naval',
  tests:
    'Postes d’artillerie SERVIS (MDG 12-13) : 2 héros servent les pierriers de leur barge (« Servir un ' +
    'poste », arc de bordée) au lieu de les porter en inventaire ; navire-Combattant à PV avec Amélioration ' +
    'd’instance « Blindage (fer) » (+2 PA de coque) ; Coup Critique → tables de NAVIRE (Voie d’eau / En flammes) ; ' +
    'équipage lié (crewIds) → Éclats / critique « Équipage » sur de vrais marins ; le Tueur + le Sorcier abordent. ' +
    'L’échelle de la scène (metresPerTile) est éditable : à 10 m/case, vue « mer ouverte » où chaque navire occupe sa Taille.',
  partyNote: 'Groupe d’arène ; le Soldat + le Chasseur servent les pierriers, le Tueur + le Sorcier abordent',
  construire: () => ({ party: makeNavalParty(), scene: construireScene() }),
  autoCombat: 'enc-naval',
};
