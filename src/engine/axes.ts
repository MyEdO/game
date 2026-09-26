/**
 * Moteur des AXES de forces/faiblesses (#409) — SOURCE UNIQUE de dérivation, partagée par le
 * mini-radar par personnage, le rail de composition du groupe (#417) et les « rôles » en toutes
 * lettres des cartes (`heroRoles`, `src/ui/CharCard.tsx`, réconcilié sur `dominantAxes`).
 *
 * Formule de normalisation (MAISON — aucune règle RAW ne stat un axe de forces, cf. `axes.json`
 * `source:'maison'`) — 2e reprise 2026-07-14 (réfutation utilisateur du plancher par Caractéristiques
 * NUES : « Comment Wilhelmina Faust peut être taggée Soins alors qu'elle n'a aucune compétence, sort
 * ou talent dans la matière ? » — un plancher purement caractéristique attribue une CAPACITÉ à qui n'a
 * que l'APTITUDE, ce que le RAW interdit pour les Compétences Avancées). Le RAW tranche déjà entre les
 * deux (`docs/raw/4e/competences.md` § Compétences de Base vs Avancées) :
 *   « Les Compétences de Base peuvent faire l'objet d'un Test même si vous n'y avez pas mis
 *   d'Augmentation. Pour cela, tentez simplement un Test utilisant la Caractéristique associée. »
 *   — LDB 09 l.25
 *   « Vous ne pouvez effectuer de Test de Compétence Avancée que si vous y avez ajouté au moins une
 *   Augmentation. Si ce n'est pas le cas, vous ne pouvez pas tenter le Test de Compétence. »
 *   — LDB 09 l.30
 *
 *   `score = clamp01( skillPart + talentPart × TALENT_BONUS_WEIGHT )`
 *   - skillPart = la MEILLEURE (`Math.max`, un pic de spécialisation) valeur normalisée parmi les
 *     `skills` GATÉES par `possesses` (`skillCombatApps.ts` — SOURCE UNIQUE de la distinction
 *     Base/Avancée, réutilisée telle quelle, jamais réimplémentée) : Compétence de Base → toujours
 *     testable (Caractéristique nue + avances éventuelles) ; Compétence Avancée SANS Augmentation →
 *     EXCLUE (contribution 0, jamais un repli sur la Caractéristique). La valeur RETENUE est
 *     `skillBaseValue` (`skills.ts` — Caractéristique EFFECTIVE + avances, SOURCE UNIQUE partagée avec
 *     la valeur de Test réelle), normalisée `(valeur − SKILL_VALUE_MIN) / SKILL_VALUE_SPAN` clampé 0..1.
 *     Repères calibrés sur les pré-tirés réels (#409) : les Tests WFRP4 en début de jeu vivent ~15
 *     (Caractéristique faible non formée) à ~70 (Caractéristique forte + belle formation) —
 *     `SKILL_VALUE_MIN = 15`, `SKILL_VALUE_SPAN = 55`.
 *   - talentPart = la meilleure contribution parmi les `talents` matchés (formule inchangée :
 *     `TALENT_BASE + TALENT_STEP × (times − 1)` plafonné 1 — un Talent est binaire, jamais « à moitié
 *     possédé », aucune ambiguïté Base/Avancée à trancher). `TALENT_BONUS_WEIGHT = 0.3` : le Talent
 *     BONIFIE le score de compétence, il ne le remplace jamais (un axe SANS compétence possédée et
 *     SANS Talent reste à 0 — « un axe expert s'allume avec la formation », jamais compensé).
 *
 * `axisScore` reste NON durci (`possesses` — LDB 09 l.25 — les Compétences de Base se testent non
 * formées, c'est légitime). Le score BRUT d'une Compétence de Base nue (Caractéristique moyenne, zéro
 * avance) atterrit néanmoins dans une zone basse-mais-non-nulle (~0.25-0.45 sur les pré-tirés réels) :
 * suffisant pour un TEST, pas pour une FORCE affichée. `AXIS_QUALIFY_MIN` (3e reprise 2026-07-15, #417)
 * sépare les deux lectures : `dominantAxes`/`partyCoverage` (vitrines « forces marquées ») EXIGENT ce
 * plancher de QUALIFICATION en plus du tri décroissant — `axisScore` seul (jets, calculs internes)
 * reste inchangé. Calibré sur Wilhelmina Faust (`PREGEN.sorcier`) : Mêlée/Discrétion (Caractéristiques
 * nues, aucune avance) tombent à 0.44/0.25 — sous le seuil, écartées des « forces » — tandis que
 * Social/Savoir/Négoce (avances réelles) dépassent 0.49 et restent.
 */
import type { Combatant } from './types';
import { skillBaseValue } from './skills';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { possesses } from './skillCombatApps';
import type { AxisData } from '../data';

const SKILL_VALUE_MIN = 15;
const SKILL_VALUE_SPAN = 55;
const TALENT_BASE = 0.5;
const TALENT_STEP = 0.1;
const TALENT_BONUS_WEIGHT = 0.3;

/** Plancher de QUALIFICATION d'un axe comme « force marquée » (vitrines `dominantAxes`/
 *  `partyCoverage` uniquement — `axisScore` brut reste non durci, cf. tête de fichier). */
export const AXIS_QUALIFY_MIN = 0.45;

function skillContribution(hero: Combatant, ref: RefDesignee): number {
  if (!possesses(hero, ref.id, ref.spec)) return 0;
  const value = skillBaseValue(hero, ref.id, ref.spec);
  return Math.max(0, Math.min(1, (value - SKILL_VALUE_MIN) / SKILL_VALUE_SPAN));
}

function talentContribution(hero: Combatant, ref: RefDesignee): number {
  let best = 0;
  for (const t of hero.talents) {
    if (t.talentId !== ref.id) continue;
    if (ref.spec && t.spec !== ref.spec) continue;
    best = Math.max(best, Math.min(1, TALENT_BASE + TALENT_STEP * (Math.max(1, t.times) - 1)));
  }
  return best;
}

/** Score normalisé 0..1 d'un Combattant sur UN axe — cf. formule en tête de fichier. */
export function axisScore(hero: Combatant, axis: AxisData): number {
  let skillPart = 0;
  for (const ref of axis.skills ?? []) skillPart = Math.max(skillPart, skillContribution(hero, ref));
  let talentPart = 0;
  for (const ref of axis.talents ?? []) talentPart = Math.max(talentPart, talentContribution(hero, ref));
  return Math.max(0, Math.min(1, skillPart + talentPart * TALENT_BONUS_WEIGHT));
}

export interface AxisValue {
  id: string;
  label: string;
  value: number;
}

/** Profil complet d'un Combattant sur une liste d'axes (ordre = ordre de `axes`, celui de la rose). */
export function axesProfile(hero: Combatant, axes: AxisData[]): AxisValue[] {
  return axes.map((a) => ({ id: a.id, label: a.label, value: axisScore(hero, a) }));
}

/** Couverture de GROUPE : agrégat MAX par axe (le rail de composition ne demande pas « la moyenne
 *  couvre-t-elle l'axe » mais « quelqu'un dans le groupe couvre-t-il l'axe »). #417 consomme ceci
 *  pour le rail de composition — AUCUN placement en jeu dans ce lot. Vitrine « forces marquées » :
 *  une alvéole ne s'allume QUE si le meilleur porteur franchit `AXIS_QUALIFY_MIN` (sous le seuil,
 *  agrégat ramené à 0 — « à pourvoir », pas une fausse couverture par Caractéristique nue). */
export function partyCoverage(members: Combatant[], axes: AxisData[]): AxisValue[] {
  return axes.map((a) => {
    const best = members.reduce((b, m) => Math.max(b, axisScore(m, a)), 0);
    return { id: a.id, label: a.label, value: best >= AXIS_QUALIFY_MIN ? best : 0 };
  });
}

/** Les `n` axes DOMINANTS d'un Combattant (score décroissant, filtrés à `AXIS_QUALIFY_MIN` — une
 *  « force » affichée exige plus qu'une Caractéristique nue non formée, cf. tête de fichier). SOURCE
 *  UNIQUE des « rôles » en toutes lettres des cartes (`heroRoles`, `src/ui/CharCard.tsx`) ET du
 *  mini-radar. */
export function dominantAxes(hero: Combatant, axes: AxisData[], n: number): AxisValue[] {
  return axesProfile(hero, axes)
    .filter((a) => a.value >= AXIS_QUALIFY_MIN)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}