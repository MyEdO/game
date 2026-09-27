import { createHero, skillCharacteristicById } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Combatant, SkillInstance } from '../../engine/types';
import type { Scene, SceneEntity } from '../../state/scene';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';
import { rigSpeciesId } from '../../data';

/**
 * « Chute du gréement » — la CHUTE PASSE PAR LA PORTE DES DÉS (#1508 T2, MDG 13 l.684-688 + LDB 15 l.80).
 *
 * Un Critique de navire à la Localisation « Gréement » impose aux personnages qui s'y trouvent un Test
 * d'Athlétisme ; qui le rate TOMBE. La hauteur se lit dans une table par la TAILLE de la coque et la
 * STATION du tombant, puis les Dégâts ajoutent un 1d10 — deux dés qui se montrent, se lancent et se
 * POSENT comme n'importe quel jet du jeu, au lieu de tomber sous `applyOps`.
 *
 * Ce que la scène met sous la main, et qu'aucune autre n'offrait :
 *  - une coque de Taille MOYENNE (cogue, 25 m → bande « moyenne/grande ») : le gréement y vaut 2d10 m,
 *    donc DEUX étapes de dé (hauteur puis Dégâts) ;
 *  - la MÊME coque porte l'Amélioration « Nid-de-pie » (aucun des navires livrés ne la porte) : depuis
 *    le nid, la hauteur est un ENTIER (25 m) — UNE seule étape, celle des Dégâts.
 * Deux matelots, un par station, pour voir les deux formes dans la même partie.
 *
 * Les trois gestes de recette (console `__wfrp`) sont documentés dans `docs/test-scenarios.md`.
 */

/** Ajoute/renforce une Compétence à la Caractéristique CANONIQUE de la Compétence (donnée). */
function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const characteristic = skillCharacteristicById(skillId);
  const ex = c.skills.find((s) => s.id === skillId && s.spec === spec);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic, advances } as SkillInstance);
}

/**
 * Deux gabiers, chacun à SA station — c'est la station qui décide de la hauteur lue dans la table.
 * Athlétisme volontairement FAIBLE : le Test du gréement se rate souvent, et c'est l'échec qu'on vient
 * voir. Le siège du joueur les tient tous les deux, donc les deux dés s'ouvrent en fenêtre (posables
 * sous « Dés fixés »).
 */
function equipage(): Combatant[] {
  const gabier = createHero({ speciesId: 'humains-reiklander', careerId: 'matelot', label: 'Gabier Ott', motivation: 'Test', rng: makeRNG(1508), id: 'gabier' });
  gabier.shipRole = 'mousse';
  gabier.shipStation = 'greement';
  skill(gabier, 'athletisme', 5); // il tombe volontiers : c'est l'échec qu'on vient voir
  skill(gabier, 'voile', 45);
  gabier.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.45 };

  const vigie = createHero({ speciesId: 'humains-reiklander', careerId: 'matelot', label: 'Vigie Nissa', motivation: 'Test', rng: makeRNG(1509), id: 'vigie' });
  vigie.shipRole = 'vigie';
  vigie.shipStation = 'nid-de-pie';
  skill(vigie, 'athletisme', 5);
  skill(vigie, 'perception', 50);
  vigie.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'F', build: 0.4 };

  return [gabier, vigie];
}

// Coque de test : une COGUE (25 m → Taille « moyenne », MDG 12 l.122-129) qui porte le NID-DE-PIE.
// Navire de TEST, jamais un navire de campagne modifié : l'Amélioration vit sur CETTE instance.
function construireScene(): Scene {
  /** La coque des héros — déclarée à part pour que la rencontre la NOMME sans la recopier. */
  const cogueDEssai: SceneEntity = {
    id: 'cogue-test', kind: 'personnage', ref: 'cogue', pos: { x: 8, y: 6 }, facing: 'E',
    label: 'La cogue d’essai', crewIds: ['gabier', 'vigie'],
    upgrades: [{ id: 'nid-de-pie' }],
  };

  /** La coque ADVERSE — même déclaration que celle des héros, sans équipage posté. */
  const coguePirate: SceneEntity = {
    id: 'cogue-pirate', kind: 'personnage', ref: 'cogue', pos: { x: 16, y: 6 }, facing: 'O',
    label: 'La cogue pirate',
  };

  const scene = buildScene({
    id: 'test-chute-greement',
    label: 'Chute du gréement',
    desc: 'Une cogue au mouillage, gréement et nid-de-pie garnis.',
    size: [20, 12],
    terrain: 'eau',
    metresPerTile: 10,
    heroStart: [3, 6],
    startMessage:
      'Deux matelots dans la mâture : Ott dans le gréement, Nissa au nid-de-pie. Un boulet dans le gréement, '
      + 'et il faudra tenir bon — sinon la hauteur se tire, puis les Dégâts. Console : __wfrp.shipCrit("greement").',
    entities: [
      // La coque des HÉROS : c'est elle que le Critique frappe, et ses `crewIds` sont les deux postés.
      cogueDEssai,
      // Une coque ADVERSE : sans rencontre, le scénario était INERTE — aucun combat, aucun plan de voyage,
      // donc `__wfrp.shipCrit` n'avait pas de coque en jeu et refusait. La route JOUABLE d'un Critique de
      // navire est le combat naval (patron « Duel naval ») : l'ennemi ouvre la rencontre, le Critique suit.
      coguePirate,
    ],
    encounters: [
      {
        id: 'greement',
        victoryCondition: { type: 'woundsThreshold', targetId: 'cogue-pirate', belowPercent: 50 },
        members: [
          { entityId: 'cogue-test', side: 'ally' },
          { entityId: 'cogue-pirate', side: 'enemy' },
        ],
      },
    ],
  });
  return scene;
}

export const scenario: TestScenario = {
  id: 'chute-du-greement',
  order: 13,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'Chute du gréement (dés à la porte)',
  tests:
    'La CHUTE passe par la porte des jets (#1508, MDG 13 l.684-688 + LDB 15 l.80) : un Critique « Gréement » '
    + 'impose l’Athlétisme aux matelots de la mâture ; qui rate voit s’ouvrir « Hauteur de chute (2d10) » puis '
    + '« Dégâts de chute (1d10) » — deux étapes affichées, lançables et POSABLES sous « Dés fixés ». Depuis le '
    + 'NID-DE-PIE, la hauteur est un entier (25 m) : une seule étape. Coque MOYENNE portant l’Amélioration '
    + 'Nid-de-pie (aucun navire livré ne la porte).',
  partyNote: 'Gabier Ott (gréement) · Vigie Nissa (nid-de-pie) — Athlétisme faible, la chute arrive',
  construire: () => ({ party: equipage(), scene: construireScene() }),
  autoCombat: 'greement',
};
