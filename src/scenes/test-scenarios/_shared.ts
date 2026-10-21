import { Combatant, type SkillInstance } from '../../engine/types';
import { byId } from '../../data';
import { estSpecialisable, refusDeSpec } from '../../data/schemas/grammaire/ref';
import { Scene } from '../../noyau/monde/scene';
import type { Terrain } from '../../data/schemas/defs-scenes/scene';
import type { ContenuDeScenario, LancementDeScenario } from '../../noyau/lancementDeScenario';
import type { IconIdGenerated } from '../../data/icones.generated';
import { buildEncounters, type AuthoredEncounter } from '../../noyau/monde/encounterAuthoring';
import { buildScene } from '../../noyau/mapSpec';

/** Ajoute ou renforce une Compétence d'un héros de scénario, à la Caractéristique de la donnée. Une
 *  Compétence groupée se possède par spécialisation, désignée par son id — LDB 09 l.40, LDB 09 l.44. */
export function renforcerCompetence(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const def = byId('skill', skillId);
  if (!def) throw new Error(`[scénario] Compétence inconnue : ${skillId}`);
  if (spec == null && estSpecialisable('skill', skillId)) throw new Error(`[scénario] ${skillId} est groupée : sa spécialisation manque`);
  const refus = spec == null ? null : refusDeSpec('skill', skillId, spec);
  if (refus) throw new Error(`[scénario] ${skillId} : spécialisation ${spec} refusée (${refus})`);
  const ex = c.skills.find((k) => k.id === skillId && k.spec === spec);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, ...(spec != null ? { spec } : {}), characteristic: def.characteristic, advances } as SkillInstance);
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
  { key: 'marche', label: 'Marché', icon: 'scenario/market' },
  { key: 'scenarios', label: 'Scénarios complets', icon: 'nav/campaign' },
  { key: 'naval', label: 'Naval', icon: 'scenario/naval' },
  { key: 'rendu', label: 'Rendu', icon: 'scenario/gallery' },
] as const satisfies readonly { key: string; label: string; icon: IconIdGenerated }[];

export type ScenarioCategory = (typeof SCENARIO_SECTIONS)[number]['key'];

/** Un scénario de test = sa FICHE (valeurs qui ne lisent aucun dataset : menu, doc générée, lancement)
 *  + UNE fabrique, `construire`, qui rend tout son contenu construit. Lancé par son lancement
 *  (`lancementDuScenario`), que joue la séquence du noyau (`noyau/lancementDeScenario.ts`). */
export interface TestScenario {
  id: string;
  order: number; // tri d'affichage dans la section
  category: ScenarioCategory; // section du menu
  icon: IconIdGenerated; // icône de carte (registre src/ui/icons, famille scenario/*)
  title: string;
  tests: string; // une ligne : « ce que ça vérifie »
  partyNote: string; // ex. « Arbalétrier solo »
  /** Rien de ce qui lit un dataset ne se calcule au niveau module d'un fichier de scénario (#1692). */
  construire: () => ContenuDeScenario;
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

/** LE lancement d'un scénario (#2898), constructeur UNIQUE que partagent le web (`state/scenarioFlow.ts`) et tout
 *  hôte du noyau : le contenu construit à neuf, et les réglages de la fiche. */
export function lancementDuScenario(sc: TestScenario): LancementDeScenario {
  return { ...sc.construire(), regles: sc.rules, bourse: sc.money, combatDirect: sc.autoCombat, semainesDInterlude: sc.interludeWeeks };
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
