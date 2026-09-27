import type { Combatant } from '../../engine/types';
import { skillCharacteristicById } from '../../engine/character';
import { memeRef } from '../../engine/careerSlots';
import { Scene, Terrain } from '../../state/scene';
import type { WorldMap } from '../../state/worldMap';
import type { IconId } from '../../ui/icons';
import { buildEncounters, type AuthoredEncounter } from '../../state/encounterAuthoring';
import { buildScene } from '../../state/mapSpec';

/** Ajoute la Compétence (id, spec) à un héros à la Caractéristique de sa donnée, ou porte ses Augmentations
 *  à `advances` si elle y est déjà (`memeRef`). */
export function renforceCompetence(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const ex = c.skills.find((s) => memeRef(s, { id: skillId, spec }));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic: skillCharacteristicById(skillId), advances });
}

/** Attache des rencontres authored (terse) à une scène : expanse chaque liste d'ennemis en
 *  entités 'personnage' + `members` canoniques, pousse les entités dans la scène et pose les
 *  rencontres. Mutation EN PLACE (les scénarios construisent leur scène impérativement). */
export function setEncounters(scene: Scene, list: AuthoredEncounter[]): void {
  const built = buildEncounters(list);
  scene.entities.push(...built.entities);
  scene.encounters = built.encounters;
}

/** Sections du menu des scénarios de test : clé (portée par la donnée) → libellé + icône
 *  (id du registre src/ui/icons), dans l'ordre d'affichage. */
export const SCENARIO_SECTIONS = [
  { key: 'combat', label: 'Combat', icon: 'action/attack' },
  { key: 'magie', label: 'Magie', icon: 'action/cast' },
  { key: 'creatures', label: 'Créatures', icon: 'scenario/bestiary' },
  { key: 'survie', label: 'Survie', icon: 'scenario/travel' },
  { key: 'progression', label: 'Progression', icon: 'resource/xp' },
  { key: 'marche', label: 'Marché', icon: 'scenario/market' },
  { key: 'scenarios', label: 'Scénarios complets', icon: 'nav/campaign' },
  { key: 'naval', label: 'Naval', icon: 'scenario/naval' },
  { key: 'rendu', label: 'Rendu', icon: 'scenario/gallery' },
] as const satisfies readonly { key: string; label: string; icon: IconId }[];

export type ScenarioCategory = (typeof SCENARIO_SECTIONS)[number]['key'];

/** Ce qu'un scénario CONSTRUIT, à chaque appel de sa fabrique `construire`, sur les datasets VIVANTS
 *  (#1692) : rien de ce qui lit un dataset ne se calcule au niveau module d'un fichier de scénario. */
export interface ScenarioConstruit {
  party: Combatant[];
  scene: Scene;
  /** Scènes supplémentaires du scénario (destinations de voyage, intérieurs…) — chargées en projet. */
  extraScenes?: Scene[];
  /** Carte du monde du scénario (#T2 Voyage). */
  worldMap?: WorldMap;
  /** Bloc narratif du scénario (presets de PNJ/affaires/indices) — posé au chargement (`loadProject`)
   *  pour que les `presetId` des entités de scène résolvent (#671). */
  narratif?: import('../../state/campaignNarratif').NarratifBlock;
  /** Bataille de masse (ADE II 08) : amorce le sous-système de Puissance de Bataille après le chargement
   *  de la scène (les Scènes de combat démarrent les rencontres de cette scène). */
  massBattle?: import('../../engine/massBattle').MassBattleSpec;
  /** Navire de campagne (MDG 13-15) posé au lancement, APRÈS le reset de scène (comme `money`) — pour
   *  un scénario de voyage/combat maritime (appareillage sur `state.vessel`). */
  vessel?: import('../../state/store').CampaignVessel;
}

/** Un scénario de test = sa FICHE (valeurs qui ne lisent aucun dataset : menu, doc générée, lancement)
 *  + UNE fabrique, `construire`, qui rend tout son contenu construit. Lancé par `lancerScenario`
 *  (`src/state/scenarioFlow.ts`). */
export interface TestScenario {
  id: string;
  order: number; // tri d'affichage dans la section
  category: ScenarioCategory; // section du menu
  icon: IconId; // icône de carte (registre src/ui/icons, famille scenario/*)
  title: string;
  tests: string; // une ligne : « ce que ça vérifie »
  partyNote: string; // ex. « Arbalétrier solo »
  construire: () => ScenarioConstruit;
  autoCombat?: string; // id d'encounter → démarre le combat directement
  /** Bourse de départ (le lancement écrase la richesse par défaut) — ex. payer la diligence. */
  money?: { gold: number; silver: number; brass: number };
  /** Règles optionnelles pré-activées au lancement (mêmes ids que le panneau Règles maison, donc
   *  modifiables en jeu) — ex. `{ 'travel-etapes': true }` pour le Voyage par Étapes EDOC. */
  rules?: Record<string, import('../../engine/policy').RuleValue>;
  /** Ouvre un interlude (« Entre deux aventures », LDB 23) AVANT la bataille de masse — le budget
   *  d'Activités (max 3) qu'il alloue est CELUI dans lequel puise la préparation (ADE II 8 l.65).
   *  Sans lui, une `massBattle` démarre au Round 1 sans préparation. Valeur = nombre de semaines. */
  interludeWeeks?: number;
}

/** Arène dégagée + point de départ des héros (base des scénarios de combat direct). Preset MINCE
 *  au-dessus de `buildScene` (headless-editor) : mêmes défauts (16×10, 'herbe', départ à gauche-milieu). */
export function arena(opts: {
  id: string;
  label: string;
  w?: number;
  h?: number;
  terrain?: Terrain;
  heroStart?: { x: number; y: number };
}): Scene {
  const w = opts.w ?? 16;
  const h = opts.h ?? 10;
  const hs = opts.heroStart ?? { x: 2, y: Math.floor(h / 2) };
  return buildScene({
    id: opts.id,
    label: opts.label,
    desc: 'Arène de test.',
    size: [w, h],
    terrain: opts.terrain ?? 'herbe',
    heroStart: [hs.x, hs.y],
  });
}
