/**
 * Moteur des AXES de forces/faiblesses (#409) — SOURCE UNIQUE de dérivation, partagée par le
 * mini-radar par personnage, le rail de composition du groupe (#417) et les « rôles » en toutes
 * lettres des cartes (`heroRoles`, réconcilié sur `dominantAxes`).
 *
 * Formule (MAISON — aucune règle RAW ne stat un axe de forces, cf. `axes.json` `source:'maison'`) —
 * 4e reprise (#3884) sur la réfutation utilisateur 2026-07-14 : « Comment Wilhelmina Faust peut être
 * taggée Soins alors qu'elle n'a aucune compétence, sort ou talent dans la matière ? ». Une FORCE est
 * un INVESTISSEMENT (Augmentations de Compétence, Talent de l'axe), jamais une aptitude : la
 * Caractéristique ne fait que PONDÉRER l'investissement, elle ne le remplace pas (même une Compétence
 * de Base, testable non formée — LDB 09 l.25 —, ne fait pas une force sans Augmentation).
 *
 *   `score = clamp01( skillPart + talentPart × TALENT_BONUS_WEIGHT )`
 *   - skillPart = le MEILLEUR (`Math.max`, un pic de spécialisation) `investissement × pondérateur`
 *     parmi les `skills` de l'axe : investissement = `min(1, Augmentations / ADVANCES_PLEIN)` (0 sans
 *     Augmentation) ; pondérateur = `CHAR_WEIGHT_MIN + (1 − CHAR_WEIGHT_MIN) × Caractéristique
 *     normalisée` (`(Caractéristique EFFECTIVE − CHAR_MIN) / CHAR_SPAN` clampé 0..1, `skillBaseValue`
 *     moins les Augmentations, SOURCE UNIQUE partagée avec la valeur de Test réelle). Propriété :
 *     sans Augmentation, skillPart = 0 quelle que soit la Caractéristique.
 *   - talentPart = la meilleure contribution parmi les `talents` matchés (`TALENT_BASE + TALENT_STEP ×
 *     (times − 1)` plafonné 1). `TALENT_BONUS_WEIGHT = 0.3` : le Talent BONIFIE, il ne qualifie pas seul
 *     (0.3 < `AXIS_QUALIFY_MIN`).
 *
 * `AXIS_QUALIFY_MIN` : plancher de QUALIFICATION d'une « force marquée » (`dominantAxes`/
 * `partyCoverage`). Propriété : tout porteur sans Augmentation sur les Compétences de l'axe score au plus
 * `TALENT_BONUS_WEIGHT`, donc sous le seuil.
 */
import type { Combatant } from './types';
import { skillBaseValue } from './skills';
import { refCouvre, type RefDesignee } from '../data/schemas/grammaire/ref';
import type { AxisData } from '../data';
import { effectiveTalents } from './talentEffects';

const ADVANCES_PLEIN = 8;
const CHAR_MIN = 15;
const CHAR_SPAN = 55;
const CHAR_WEIGHT_MIN = 0.75;
const TALENT_BASE = 0.5;
const TALENT_STEP = 0.1;
const TALENT_BONUS_WEIGHT = 0.3;

/** Plancher de QUALIFICATION d'un axe comme « force marquée » (vitrines `dominantAxes`/
 *  `partyCoverage`), cf. tête de fichier. */
export const AXIS_QUALIFY_MIN = 0.45;

function skillContribution(hero: Combatant, ref: RefDesignee): number {
  const advances = hero.skills.find((s) => refCouvre(ref, s))?.advances ?? 0;
  const char = Math.max(0, Math.min(1, (skillBaseValue(hero, { skill: ref }) - advances - CHAR_MIN) / CHAR_SPAN));
  return Math.min(1, advances / ADVANCES_PLEIN) * (CHAR_WEIGHT_MIN + (1 - CHAR_WEIGHT_MIN) * char);
}

function talentContribution(hero: Combatant, ref: RefDesignee): number {
  let best = 0;
  for (const t of effectiveTalents(hero)) {
    if (!refCouvre(ref, { id: t.talentId, spec: t.spec })) continue;
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

/** Couverture de GROUPE par axe : agrégat MAX (le rail de composition ne demande pas « la moyenne couvre-t-elle
 *  l'axe » mais « quelqu'un dans le groupe couvre-t-il l'axe »), et son PORTEUR, le premier meilleur à égalité.
 *  Vitrine « forces marquées » : une alvéole ne s'allume QUE si le meilleur porteur franchit `AXIS_QUALIFY_MIN` ;
 *  sous le seuil, agrégat ramené à 0 et aucun porteur — « à pourvoir », pas une fausse couverture par
 *  Caractéristique nue (réfutation utilisateur 2026-07-15). */
export function partyCoverage(members: Combatant[], axes: AxisData[]): (AxisValue & { porteurId?: string })[] {
  return axes.map((a) => {
    let best = 0;
    let porteurId: string | undefined;
    for (const m of members) {
      const v = axisScore(m, a);
      if (v > best) { best = v; porteurId = m.id; }
    }
    return best >= AXIS_QUALIFY_MIN ? { id: a.id, label: a.label, value: best, porteurId } : { id: a.id, label: a.label, value: 0 };
  });
}

/** Les `n` axes DOMINANTS d'un Combattant (score décroissant, filtrés à `AXIS_QUALIFY_MIN` — une
 *  « force » affichée exige plus qu'une Caractéristique nue non formée, cf. tête de fichier). SOURCE
 *  UNIQUE des « rôles » en toutes lettres des cartes (`heroRoles`) ET du
 *  mini-radar. */
export function dominantAxes(hero: Combatant, axes: AxisData[], n: number): AxisValue[] {
  return axesProfile(hero, axes)
    .filter((a) => a.value >= AXIS_QUALIFY_MIN)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}