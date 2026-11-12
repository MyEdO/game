import type { FabriqueDId } from '../../engine/fabriqueDId';
import { herosDeScenario } from './_heros';
import { contexteDeNaissanceDObjet, itemFromTrappingById } from '../../engine/items';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';

/**
 * ASPERSION (MDG 16 l.19, #497) : « Asperger d'eau » (`aspergerDEau`) gate ses cibles
 * sur `waterSprayCandidates(active, battle.combatants.filter(c => c.kind === active.kind))` — VOULU
 * (« ≥1 ALLIÉ Créature marine adjacent ») : la créature marine à asperger doit donc entrer en jeu
 * avec le MÊME `kind` que le héros, jamais `kind:'ennemi'`. Mécanisme canonique = `side:'allie'` sur un
 * membre de rencontre (`AuthoredEnemy.side`, `encounterAuthoring.ts`) — `combatSlice.ts` bascule
 * `enemies[i].kind = 'heros'` pour tout membre `side:'allie'` (même précédent que le cheval montable
 * d'`entrainement.ts`) ; `ai:true` l'IA-pilote pour que le joueur n'ait pas à jouer son tour.
 *
 * Victoire = `surviveRounds` (aucun véritable adversaire n'est nécessaire : `victoryConditionMet`
 * l'évalue sur `battle.round`, pas sur `enemiesAlive`) — le combat reste ouvert assez de Rounds pour
 * observer les deux issues de `suffocationTick` (#477) : aspergée = immunisée ce Round / non aspergée
 * = suffoque (−1 PB), sans qu'un ennemi hostile ne parasite la démonstration.
 *
 * Terrain 100 % terrestre (aucune tuile d'eau) : `spawn.ts` (`placeCombatant`) dérive `offTerrain:
 * true` au placement, sans intervention manuelle. Adjacence AU SPAWN (pas de déplacement requis pour
 * la recette) : `lancerLeCombat` place le héros SOLO à `(heroStart.x − 1, heroStart.y)`
 * (`combatSlice.ts:2425`) — l'anguille est posée exactement à `heroStart`, donc à distance 1.
 */
function porteurDOutre(idNeuf: FabriqueDId) {
  const h = herosDeScenario(idNeuf, 'soldat');
  const outre = itemFromTrappingById('outre-a-eau', idNeuf, undefined, contexteDeNaissanceDObjet(h))!;
  h.items = [...(h.items ?? []), outre];
  return h;
}

const HERO_START = { x: 2, y: 4 };
function construireScene(): Scene {
  const scene = arena({ id: 'test-aspersion', label: 'Aspersion — créature marine hors de l’eau', heroStart: HERO_START });
  scene.startMessage =
    { texte: "Une anguille mâcheprise s'est échouée sur la berge, loin de l'eau, ALLIÉE égarée du groupe : hors " +
    // MDG 16 l.19
    "de son terrain, elle suffoque (Trait Créature marine). Le Soldat porte une outre à " +
    "eau — l'Action « Asperger d'eau » l'immunise pour le Round où elle est posée ; sans elle, l'anguille " +
    "perd 1 Blessure par Round." };
  setEncounters(scene, [
    {
      id: 'enc-aspersion',
      enemies: [{ creature: { id: 'anguille-macheprise' }, pos: { ...HERO_START }, side: 'allie', ai: true }],
      victoryCondition: { type: 'surviveRounds', rounds: 3 },
    },
  ]);
  return scene;
}

export const scenario: TestScenario = {
  id: 'aspersion',
  order: 19,
  category: 'creatures',
  icon: 'scenario/bestiaire',
  title: 'Aspersion — créature marine hors de l’eau (#497)',
  tests:
    // MDG 16 l.19
    "Action « Asperger d'eau » (#497) : une Créature marine ALLIÉE (anguille mâcheprise, " +
    "`side:'allie'` → `kind:'heros'`) échouée sur la terre (`offTerrain`, aucune tuile d'eau, adjacente " +
    "AU SPAWN) suffoque Round après Round (`suffocationTick`, #477) sauf si le Soldat, outre à eau en " +
    "poche (`hasWaterContainer`), l'asperge (`aspergerDEau` pose `wateredThisRound`, aucun jet, consomme " +
    "l'Action) ; `waterSprayCandidates` filtre STRICTEMENT par `kind` identique à l'aspergeur.",
  partyNote: 'Soldat solo, outre à eau en poche.',
  construire: (idNeuf) => ({ party: [porteurDOutre(idNeuf)], scene: construireScene() }),
  autoCombat: 'enc-aspersion',
};
