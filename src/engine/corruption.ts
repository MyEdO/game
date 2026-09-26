/**
 * Corruption & mutations — Livre de base, chapitre 19 (p.184-187).
 *
 * Modèle : `Combatant.corruption` (Points de Corruption) + `Combatant.mutations`
 * (la DONNÉE persistée ; les effets mécaniques sont lus à la volée — effectiveChar,
 * testValue, effectiveMovement, recomputeLoadout — pour survivre au writeback de
 * fin de combat, comme les Traumatismes).
 *
 *  - Gains (l.30-75) : expositions mineure/modérée/majeure — Test de Résistance ou
 *    de Calme, Points selon le DR ; Sombre Pacte (l.17) : +1 Point volontaire pour
 *    relancer un Test.
 *  - Seuil (l.80) : corruption > BFM + BE → Test de Résistance Intermédiaire (+0)
 *    à CHAQUE nouveau gain ; échec → mutation.
 *  - Mutation (l.85-91) : −BFM Points, d100 corps/esprit PAR ESPÈCE, tirage sur le
 *    Tableau de Corruption physique ou mentale (src/data/mutations.ts, verbatim).
 *  - Limites (l.87) : mutations physiques > BE ou mentales > BFM → DAMNÉ (le
 *    personnage bascule dans le Chaos — hors-jeu définitif).
 */
import { Combatant, HitLocation } from './types';
import { RNG, defaultRNG } from './dice';
import { bonus, effectiveChar } from './characteristics';
import { talentCorruptionThreshold } from './combatFeatures/dispatch';
import { findTableEntry } from './tables';
import { mutationBodyMaxForSpecies } from '../data';
import { rollObsession } from '../data/obsessions';
import { acquerirTalent, retirerTalent } from './careerSlots';
import { grantTrait, grantPsychTrait, removeGrantedTrait } from './grantedTraits';
import type { PsychType } from './psychology';
import type { GameOp } from './ops';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { TriggeredEffect } from './flowCore';

export type ExposureLevel = 'mineure' | 'moderee' | 'majeure';

/** Échelle ORDONNÉE des Expositions (LDB 19 l.23-75), du plus léger au plus lourd — SOURCE UNIQUE du
 *  « cran » d'Influence corruptrice. */
export const EXPOSURE_LADDER: ExposureLevel[] = ['mineure', 'moderee', 'majeure'];

/** Atténue une Influence corruptrice de `steps` CRANS sur l'échelle (VDM 05 — Bouclier en acier doré :
 *  « réduit de 2 crans une Influence corruptrice (une Exposition Majeure en devient une Mineure par
 *  exemple) »). Sous le premier cran, l'Influence ne s'applique plus : `null`. `steps` ≤ 0 = inchangé. PUR. */
export function easeExposure(level: ExposureLevel, steps: number): ExposureLevel | null {
  if (steps <= 0) return level;
  const i = EXPOSURE_LADDER.indexOf(level) - steps;
  return i >= 0 ? EXPOSURE_LADDER[i] : null;
}

/** Crans d'atténuation d'Influence corruptrice portés par le combattant (op `corruptionExposure`
 *  `easeSteps` exécutée → `ActiveEffect.corruptionEase`). Σ des abris actifs. PUR. */
export function corruptionEaseSteps(c: Combatant): number {
  return (c.activeEffects ?? []).reduce((s, e) => s + (e.corruptionEase ?? 0), 0);
}

/** Alignement d'une SOURCE de Corruption (Puissance du Chaos) : si fourni, choisit la table EDOC
 *  à tirer pour la mutation, quelle que soit la règle globale ; sinon la règle `corruption-tables-edoc`
 *  décide. `toute` = Chaos non aligné (table EDOC élargie). */
export type ChaosAlign = 'toute' | 'khorne' | 'nurgle' | 'slaanesh' | 'tzeentch';

/** Mutation subie (donnée persistée ; cf. Tableaux LDB 19 l.112/140). */
export interface Mutation {
  /** `id` STABLE (slug) — clé de résolution runtime/données (registre, table de Corruption, rendu).
   *  « On ne se base plus sur le label » : le `label` ne sert qu'à l'affichage. */
  id: string;
  label: string;
  /** Description VERBATIM (LDB 19, colonne « Description Effet ») — affichage seul, jamais lue par le moteur.
   *  Les mutations n'ont pas de flavor en source : c'est donc le texte d'effet littéral du livre. */
  desc: string;
  kind: 'physique' | 'mentale';
  /** Jet d100 sur le tableau (traçabilité). */
  roll: number;
  /** TOUTE la mécanique de la mutation en `GameOp[]` — MÊME vocabulaire/éditeur (GameOpEditor) que
   *  traits et sorts : charMod/moveMod/skillMod/testMod (collecteur passif unifié engine/trauma) ;
   *  `ap` (armure naturelle, loc absent = toutes — lue par mutationArmourBonus) ; `grantNaturalWeapon`
   *  (arme de créature, lue par recomputeLoadout) ; `grantTrait` / `grantPsychTrait` (traits de créature
   *  et psychologiques conférés, posés par attachMutation). Plus aucun champ ad hoc. */
  passive?: GameOp[];
  /** Effets DÉCLENCHÉS de la mutation — MÊME vocabulaire que `TraitData.effects`/`SymptomData.effects`,
   *  dispatchés par l'unique `fireTriggers` (aucun chemin par KIND). Sert les mutations à cadence :
   *  Haine sporadique re-tire sa Cible à chaque `onDayStart` (EDOC 12 l.217). */
  effects?: TriggeredEffect[];
  /** Partie non modélisée de l'effet — verbatim, arbitrage MJ (rien d'inventé). */
  note?: string;
  /** Provenance livre/page — LDB 19 IMPLICITE si absent ; EXPLICITE pour les suppléments (EDO Appendice 2…). */
  source?: { book: string; page: number };
  /** Mutation PHYSIQUE sans manifestation CORPORELLE visible (Souffle du feu, Sang acide, Cri
   *  assourdissant…) : pas de calque rig attendu — déclaré explicitement (≠ visuel à dessiner). */
  nonVisual?: boolean;
  /** Pointeur de SOUS-TABLE (ex. « Tête bestiale » EDOC → re-tirer sur la sous-table Tête Bestiale) :
   *  `rollMutation` re-tire sur `${subTable}-${alignement}` (suffixe hérité de la table courante). */
  subTable?: string;
  /** Apparence COSMÉTIQUE déclarée en DONNÉE (calques du catalogue via `features` + `colors` + `eyes`) —
   *  fusionnée sur le rig quand la mutation est présente (cf. `combatantVisuals`). Type erased : le
   *  moteur ne la lit jamais (comme `Combatant.appearance` côté types). */
  appearance?: import('./authoringAppearance').EntityAppearance;
  /** PROVENANCE, posée par `attachMutation` sur l'instance ATTACHÉE : les niveaux de Talent que son
   *  attache a effectivement acquis (`acquerirTalent` rendu `true`). `detachMutation` ne retire qu'eux. */
  talentsAcquis?: RefDesignee[];
}

// ---------------------------------------------------------------------------
// Gains de Corruption (l.30-75)
// ---------------------------------------------------------------------------

/**
 * Points de Corruption gagnés à l'issue du Test de résistance à une exposition :
 *  - mineure (l.31) : échec → 1 ; succès → 0.
 *  - modérée (l.52) : échec → 2 ; Succès Minime (0-1 DR) → 1 ; Succès (2+) → 0.
 *  - majeure (l.65) : échec → 3 ; 0-1 DR → 2 ; 2-3 DR → 1 ; Impressionnant (4+) → 0.
 */
export function corruptionGain(level: ExposureLevel, success: boolean, dr: number): number {
  if (level === 'mineure') return success ? 0 : 1;
  if (level === 'moderee') return success ? (dr <= 1 ? 1 : 0) : 2;
  return success ? (dr <= 1 ? 2 : dr <= 3 ? 1 : 0) : 3;
}

/** Seuil « Corrompu » (l.80) : BFM + BE (+ niveau d'Âme pure, LDB 10 — « Vous pouvez gagner un nombre de
 *  Points de Corruption supplémentaires égal à votre niveau d'Âme pure avant d'avoir à effectuer un Test
 *  pour savoir si vous êtes corrompu »). SOURCE UNIQUE de la valeur (jauge de fiche + `corruptionThresholdExceeded`). */
export function corruptionThreshold(c: Combatant): number {
  return bonus(effectiveChar(c, 'force-mentale')) + bonus(effectiveChar(c, 'endurance')) + talentCorruptionThreshold(c);
}

/** Seuil « Corrompu » (l.80) : plus de Points de Corruption que BFM + BE. Talent Âme pure (LDB 10) :
 *  « Vous pouvez gagner un nombre de Points de Corruption supplémentaires égal à votre niveau d'Âme
 *  pure avant d'avoir à effectuer un Test pour savoir si vous êtes corrompu » → seuil +niveau. */
export function corruptionThresholdExceeded(c: Combatant): boolean {
  return (c.corruption ?? 0) > corruptionThreshold(c);
}

/** « PROFANE » au sens de la Protection de Phâ (LDB 48 l.393) : créature ayant le Trait Mort-vivant OU
 *  Démoniaque, OU porteuse de Mutations, OU dont la Corruption dépasse ses Bonus de FM + E combinés.
 *  Lue par la Zone sacrée (barrière d'entrée + Brisé aux profanes présents). */
export function isProfane(c: Combatant): boolean {
  const traits = c.traits ?? [];
  if (traits.some((t) => t.id === 'mort-vivant' || t.id === 'demoniaque')) return true;
  if ((c.mutations?.length ?? 0) > 0) return true;
  return (c.corruption ?? 0) > bonus(effectiveChar(c, 'force-mentale')) + bonus(effectiveChar(c, 'endurance'));
}

// ---------------------------------------------------------------------------
// Dissolution du corps et de l'esprit (l.82-91)
// ---------------------------------------------------------------------------

/** Une LIGNE du Tableau « corps ou esprit » (LDB 19 l.78-81) : fourchette d100 → nature de la mutation
 *  (id STABLE 'physique'/'mentale'), `label` = l'intitulé de la ligne du Tableau (AFFICHAGE). */
export interface MutationNatureRow {
  min: number;
  max: number;
  id: 'physique' | 'mentale';
  label: string;
}

const NATURE_ROWS = new Map<number, MutationNatureRow[]>();

/** Lignes du Tableau « corps ou esprit » pour un SEUIL d100 de mutation physique — Corps `01–seuil`,
 *  Esprit au-dessus ; seuil 0 (Elfe) → la seule ligne « Esprit 01-100 ». Mémoïsées par seuil : la
 *  référence est stable (registre d'étapes à table). SOURCE UNIQUE des fourchettes de ce Tableau. */
export function mutationNatureRowsFor(max: number): MutationNatureRow[] {
  const cached = NATURE_ROWS.get(max);
  if (cached) return cached;
  const rows: MutationNatureRow[] = [
    ...(max >= 1 ? [{ min: 1, max, id: 'physique' as const, label: 'Corps' }] : []),
    ...(max < 100 ? [{ min: max + 1, max: 100, id: 'mentale' as const, label: 'Esprit' }] : []),
  ];
  NATURE_ROWS.set(max, rows);
  return rows;
}

/** Lignes du Tableau pour l'ESPÈCE d'un personnage (`id` STABLE) — le seuil vit en DONNÉE
 *  (`SpeciesData.mutationBodyMax`, lu par `mutationBodyMaxForSpecies`). */
export function mutationNatureRows(species: string | undefined): MutationNatureRow[] {
  return mutationNatureRowsFor(mutationBodyMaxForSpecies(species));
}

/**
 * Corps ou esprit, selon l'espèce (`id` STABLE) et le d100 (Tableau l.78-81) — lookup sur les lignes
 * ci-dessus (`findTableEntry`, brique partagée), jamais un match sur le nom. Seuils SOURCÉS : Elfe 0,
 * Nain 5, Halfling 10, Humain 50 (LDB 19) ; Ogre 10 (ADE II « Ogres et Mutations ») ; Gnome 50 =
 * Humain (NADJ « Gnomes et Corruption »).
 */
export function mutationKindFor(species: string | undefined, roll: number): 'physique' | 'mentale' {
  return findTableEntry(mutationNatureRows(species), roll).id;
}

/** Limites de Corruption (l.87) : mutations physiques > BE OU mentales > BFM → damné. */
export function mutationLimitExceeded(c: Combatant): boolean {
  const phys = (c.mutations ?? []).filter((m) => m.kind === 'physique').length;
  const ment = (c.mutations ?? []).filter((m) => m.kind === 'mentale').length;
  return phys > bonus(effectiveChar(c, 'endurance')) || ment > bonus(effectiveChar(c, 'force-mentale'));
}

/** Attache une mutation au personnage : donnée + traits dérivés (créature/psychologie). RNG seedable
 *  pour les Cibles TIRÉES (`argFrom:'obsessions'` — Haine sporadique / Terribles phobies, EDOC 12).
 *  `grantTrait`/`grantPsychTrait` (noyau PARTAGÉ `grantedTraits.ts`, ci-dessus importé) : MÊME chemin
 *  que l'op homonyme de `applyOps`, permanent (aucun `ActiveEffect` porteur — une mutation n'expire
 *  jamais). `grantTalent` : `acquerirTalent` (engine/careerSlots.ts), les passifs d'une mutation ne passant
 *  pas par `applyOps`. */
export function attachMutation(c: Combatant, m: Mutation, rng: RNG = defaultRNG): void {
  const talentsAcquis: RefDesignee[] = [];
  for (const op of m.passive ?? []) {
    if (op.op === 'grantTrait') {
      // Valeur LITTÉRALE (les mutations RAW ont des indices fixes : Peur 3, Morsure +5).
      const value = typeof op.indice === 'number' ? op.indice : undefined;
      // Cible : littérale (`arg`), ou TIRÉE sur le Tableau des Obsessions (`argFrom:'obsessions'`,
      // « Haine sporadique » → Haine (Cible) déterminée par les Obsessions, EDOC 12).
      const arg = op.arg ?? (op.argFrom === 'obsessions' ? rollObsession(rng) : undefined);
      // PROVENANCE de l'instance : la mutation elle-même (registre `TraitInstance.src`) — c'est ce que
      // son propre `removeTrait` de re-ciblage interroge, et rien d'autre.
      grantTrait(c, { id: op.traitId, ...(arg ? { arg } : {}), ...(value != null ? { value } : {}), src: { kind: 'mutation', id: m.id } });
    } else if (op.op === 'grantPsychTrait') {
      const cible = op.cible ?? (op.argFrom === 'obsessions' ? rollObsession(rng) : undefined);
      grantPsychTrait(c, op.psychType as PsychType, cible);
    } else if (op.op === 'grantTalent') {
      if (acquerirTalent(c, op.talent)) talentsAcquis.push(op.talent);
    }
  }
  const attachee: Mutation = { ...m };
  delete attachee.talentsAcquis;
  if (talentsAcquis.length) attachee.talentsAcquis = talentsAcquis;
  c.mutations = [...(c.mutations ?? []), attachee];
}

/** INVERSE structurel d'`attachMutation` : retire l'instance de `c.mutations` (ses passifs charMod/moveMod/
 *  ap/skillMod/grantNaturalWeapon/apparence — lus EN DIRECT sur `c.mutations` par passiveMods/le rig/le
 *  loadout — disparaissent avec elle) et RÉVERSE les grants STRUCTURELS posés à l'attache (Trait, Trait psy,
 *  Talent). Sert la mutation TEMPORISÉE de l'op `rollMutation` (Allure démoniaque « pour toute la durée du
 *  Sort », EDOC 13 l.276-277) ; le chemin CORRUPTION (corruptionFlow → `attachMutation` direct, sans effet
 *  actif porteur) reste PERMANENT, jamais détaché. Le loadout/PB dérivés se recalculent chez l'appelant
 *  (comme pour `attachMutation`). Mute `c`. */
export function detachMutation(c: Combatant, m: Mutation): void {
  const list = c.mutations ?? [];
  let i = -1;
  for (let k = list.length - 1; k >= 0; k--) if (list[k].id === m.id && (list[k].roll ?? null) === (m.roll ?? null)) { i = k; break; }
  if (i < 0) return;
  const attachee = list[i];
  c.mutations = [...list.slice(0, i), ...list.slice(i + 1)];
  for (const talent of attachee.talentsAcquis ?? []) retirerTalent(c, talent);
  for (const op of attachee.passive ?? []) {
    if (op.op === 'grantTrait') {
      const value = typeof op.indice === 'number' ? op.indice : undefined;
      removeGrantedTrait(c, { id: op.traitId, ...(op.arg ? { arg: op.arg } : {}), ...(value != null ? { value } : {}), src: { kind: 'mutation', id: attachee.id } });
    } else if (op.op === 'grantPsychTrait') {
      const j = (c.psychTraits ?? []).findIndex((x) => x.type === op.psychType && (x.cible ?? '') === (op.cible ?? ''));
      if (j >= 0) c.psychTraits = [...c.psychTraits!.slice(0, j), ...c.psychTraits!.slice(j + 1)];
      if (c.psychTraits && !c.psychTraits.length) delete c.psychTraits;
    }
  }
}

/** Détache les mutations portées par les ActiveEffect EXPIRÉS (op `rollMutation` temporisée) — MIROIR de
 *  `dropExpiredGrantedTraits`, appelé aux MÊMES coutures d'expiration (fin de Round / horloge / dissipation).
 *  Renvoie `true` si au moins une mutation a été détachée (→ l'appelant recalcule loadout/PB dérivés). */
export function dropExpiredGrantedMutations(c: Combatant, expired: { grantedMutation?: Mutation }[]): boolean {
  let dropped = false;
  for (const e of expired) if (e.grantedMutation) { detachMutation(c, e.grantedMutation); dropped = true; }
  return dropped;
}

// ---------------------------------------------------------------------------
// Lecture des effets (à la volée, comme les Traumatismes)
// ---------------------------------------------------------------------------

// charMods/Mouvement des mutations : lus DIRECT par le collecteur passif unifié (engine/trauma `passiveMods`
// → passiveCharSum/passiveMoveMod), sans helper `mutationCharDelta`/`mutationMovementDelta` dédié.

/** PA naturels de mutation à `loc` (Peau d'acier, Écailles épineuses, Cornes…) — op `ap` du `passive`
 *  (loc absent = toutes les Localisations) ; additifs. */
export function mutationArmourBonus(c: Combatant, loc: HitLocation): number {
  let d = 0;
  for (const m of c.mutations ?? []) for (const op of m.passive ?? []) {
    if (op.op === 'ap' && (op.loc == null || op.loc === loc)) d += typeof op.amount === 'number' ? op.amount : 0;
  }
  return d;
}

/** PA de mutation à `loc` marqués HORS Déviation Critique (op `ap` avec `noDeviation` — Écailles épineuses,
 *  EDO App.2 l.196). Calque `mutationArmourBonus` mais ne somme QUE ces PA — à soustraire pour le PA sacrifiable
 *  (`deviatableArmourAt`). Le Trait créature Armure (LDB 85) n'est PAS marqué → reste déviatable. */
export function nonDeviatableMutationAP(c: Combatant, loc: HitLocation): number {
  let d = 0;
  for (const m of c.mutations ?? []) for (const op of m.passive ?? []) {
    if (op.op === 'ap' && op.noDeviation === true && (op.loc == null || op.loc === loc)) {
      d += typeof op.amount === 'number' ? op.amount : 0;
    }
  }
  return d;
}

// Les mods de TEST des mutations (compétence nommée Groin poilu, ou char-qualifiés Visage inversé −20 Soc)
// sont désormais émis par le collecteur passif unifié (`passiveSkillSum`/`passiveTestMod`, engine/trauma).
