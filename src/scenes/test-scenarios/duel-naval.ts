import { makeShowcaseParty } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import type { SkillRef } from '../../data';
import type { ShipPoste } from '../../engine/types';
import type { Scene, SceneEntity } from '../../state/scene';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

// Banc du MODÈLE DEUX-ÉCHELLES couche MER (MDG 13-14, plan combat-naval-modele §1bis) : DEUX jetons-coques sur
// l'eau ouverte à ~150 m (portée LONGUE du canon, MDG 12 l.401 → 15 cases à 10 m/case), l'équipage ABSTRAIT
// (passager, hors ordre ET hors rendu — il s'exprime par les Tests d'équipage). Le joueur joue LE TOUR DU NAVIRE ;
// la coque adverse est pilotée par l'IA de coque (`runShipAI` : manœuvre pour aligner sa bordée, puis feu). L'approche
// se JOUE sur plusieurs Rounds (M du navire en Distance-points/Round, 1 point = 1 case à cette échelle).

let ammoSeq = 0;
function ammo(trappingId: string, qty: number) {
  const base = itemFromTrappingById(trappingId)!;
  return { ...base, uid: `duel-ammo-${trappingId}-${++ammoSeq}`, qty };
}
/** Poste d'artillerie ARMÉ (coffre à boulets, MDG 12 l.410-424). L'équipage abstrait le sert d'office à la Mer. */
function canon(side: 'tribord' | 'babord' | 'proue' | 'poupe'): ShipPoste {
  const a = ammo('boulet-et-poudre', 12);
  const m = ammo('mitraille-et-poudre', 4);
  return { item: itemFromTrappingById('canon-moyen')!, side, ammo: [a, m], ammoUid: a.uid };
}
/** Marin d'équipage COMPÉTENT (passager, hors rendu à la Mer) — CustomStatblock sourcé (règle stricte 7 : aucune
 *  créature « matelot » au bestiaire → omission documentée). Le barreur tient la Voile, l'artilleur la Poudre noire. */
function marine(id: string, label: string, x: number, y: number, skills: SkillRef[]): SceneEntity {
  return {
    id, kind: 'personnage', pos: { x, y }, label, appearance: { species: 'humains-reiklander' },
    statblock: { type: 'statblock' as const, label, char: { M: 4, 'capacite-de-combat': 35, 'capacite-de-tir': 40, force: 35, endurance: 38, agilite: 35, dexterite: 35, intelligence: 30, 'force-mentale': 35, sociabilite: 30, B: 13 }, skills },
  } as SceneEntity;
}
const HELM: SkillRef[] = [{ id: 'voile', value: 55 }, { id: 'ramer', value: 45 }];
const GUN: SkillRef[] = [{ id: 'projectiles', spec: 'poudre-noire', value: 55 }];

const construireScene = (): Scene => buildScene({
  id: 'test-duel-naval',
  label: 'Duel naval',
  desc: 'Duel de deux coques en mer ouverte (échelle MER 10 m/case).',
  size: [24, 14],
  terrain: 'eau',
  metresPerTile: 10, // MDG 13 l.362 : 1 point de Distance = 10 m → 1 case ; portées 50/75/150 m = 5/7,5/15 cases
  heroStart: [2, 7],
  startMessage:
    'Barre à toi ! Tu tiens la barre du navire — manœuvre, puis ordonne la bordée. Ton équipage sert les canons et la ' +
    'voile en ton nom. La coque ennemie est à environ 150 mètres : aligne une bordée et fais feu — l’adversaire fera ' +
    'de même. Elle se rendra une fois la coque à moitié éventrée.',
  entities: [
    // Coque ALLIÉE (le Grimm) — cap EST, deux bordées de canons moyens + une chasse de proue ; passagers = 2 marins.
    { id: 'grimm-duel', kind: 'personnage', ref: 'loup-imperial', pos: { x: 3, y: 7 }, facing: 'E', label: 'Le Grimm',
      crewIds: ['grimm-helm', 'grimm-gun'], postes: [canon('tribord'), canon('babord'), canon('proue')] } as SceneEntity,
    marine('grimm-helm', 'Timonier du Grimm', 3, 6, HELM),
    marine('grimm-gun', 'Maître canonnier du Grimm', 3, 8, GUN),
    // Coque ENNEMIE (cogue) — cap OUEST, deux bordées ; passagers = 2 marins pirates compétents.
    { id: 'cogue-duel', kind: 'personnage', ref: 'cogue', pos: { x: 18, y: 7 }, facing: 'O', label: 'La cogue pirate',
      crewIds: ['cogue-helm', 'cogue-gun'], postes: [canon('tribord'), canon('babord'), canon('proue')] } as SceneEntity,
    marine('cogue-helm', 'Barreur pirate', 18, 6, HELM),
    marine('cogue-gun', 'Canonnier pirate', 18, 8, GUN),
  ],
  encounters: [
    {
      id: 'duel',
      // Reddition à mi-coque (woundsThreshold sur la COQUE ennemie) : la victoire = la reddition, pas le naufrage.
      victoryCondition: { type: 'woundsThreshold', targetId: 'cogue-duel', belowPercent: 50 },
      members: [
        { entityId: 'grimm-duel', side: 'ally' },
        { entityId: 'grimm-helm', side: 'ally' },
        { entityId: 'grimm-gun', side: 'ally' },
        { entityId: 'cogue-duel', side: 'enemy' },
        { entityId: 'cogue-helm', side: 'enemy' },
        { entityId: 'cogue-gun', side: 'enemy' },
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'duel-naval',
  order: 12,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'Duel naval (échelle Mer)',
  tests:
    'Modèle DEUX-ÉCHELLES couche MER (MDG 13-14) : 2 jetons-coques sur l’eau à ~150 m, équipage ABSTRAIT ' +
    '(passager, hors ordre/rendu), le joueur joue LE TOUR DU NAVIRE (Manœuvrer / Bordée), l’IA de coque adverse ' +
    'manœuvre pour aligner sa bordée puis fait feu. Reddition à mi-coque. Le combat naval person-scale (abordage) ' +
    'reste le scénario « Combat naval ».',
  partyNote: 'Groupe d’arène embarqué (passagers du Grimm) ; l’équipage abstrait sert les pièces',
  construire: () => ({ party: makeShowcaseParty(), scene: construireScene() }),
  autoCombat: 'duel',
};
