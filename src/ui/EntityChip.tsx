/**
 * Chip d'ENTITÉ — SOURCE UNIQUE d'affichage d'une référence (compétence, talent, sort, objet, trait…)
 * sur TOUS les écrans (Codex, créateur, fiche, carte, résumé). Une boîte `.entity-chip` + un
 * déclencheur popover `CodexRef` (survol = description + source ; clic = ouvre le Codex). Gère le
 * CHOIX « A ou B » (chaque option cliquable) de façon identique partout. Le `CodexRowView` du Codex
 * ET les composants d'écran passent par ici → plus aucun rendu d'entité parallèle.
 */
import { Fragment, type ReactNode } from 'react';
import { CodexRef } from './compendium/CodexRef';
import { splitTopLevelOu } from '../engine/careerSlots';
import { statName } from '../engine/statEntry';
import { byId, findTalentById, findTraitById, skillInstanceLabel, refConcrete, qualityRefLabel } from '../data';
import { formatTrait } from '../engine/traits/dispatch';
import type { SkillInstance, QualityInstance } from '../engine/types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { TraitInstance } from '../engine/statEntry';

/** Un chip : boîte `.entity-chip` + déclencheur `CodexRef` (`label` = clé de résolution) + badge
 *  optionnel en fin (carac/valeur, `+avancées`, `×N`…). */
export function EntityRef({
  category,
  id,
  label,
  show,
  badge,
  instance,
  className,
}: {
  category: string;
  /** Identité STABLE de la cible (préférée quand fournie) — omise seulement pour les cas SANS id
   *  stable (`EntityChoice` « A ou B » éclaté d'un libellé brut) ; `CodexRef` se rabat alors sur le
   *  lookup par `label`. */
  id?: string;
  label: string;
  show?: ReactNode;
  badge?: ReactNode;
  /** Instance paramétrée (« 8 Tentacules +8 ») — affichée en tête du popover + transmise au Codex. */
  instance?: string;
  className?: string;
}) {
  return (
    <span className={`entity-chip${className ? ` ${className}` : ''}`}>
      <CodexRef category={category} id={id} label={label} instance={instance}>
        {show ?? label}
      </CodexRef>
      {badge != null && badge !== '' && <em className="entity-badge">{badge}</em>}
    </span>
  );
}

/**
 * Pastille NUE : la MÊME boîte `.entity-chip` (matière, badge) pour un libellé qui ne désigne AUCUNE
 * entité du Codex — un nom d'objet authoré en clair (`TrappingRef {text}`, « A ou B » composite).
 * Aucun `CodexRef`, donc aucun lookup par LIBELLÉ : la borne d'objet se voit, sans promettre une
 * fiche qui n'existe pas. La variante `plain` retire le curseur d'aide et la réaction dorée, qui
 * annonceraient un popover (affordance morte).
 */
export function PlainChip({ label, badge }: { label: string; badge?: ReactNode }) {
  return (
    <span className="entity-chip plain">
      {label}
      {badge != null && badge !== '' && <em className="entity-badge">{badge}</em>}
    </span>
  );
}

/** Groupe de CHOIX « A ou B » avec options DÉJÀ séparées : un chip cliquable par option + « ou ». */
export function ChoiceChips({ category, options }: { category: string; options: { id?: string; label: string; show: string }[] }) {
  return (
    <span className="entity-choice">
      {options.map((o, i) => (
        <Fragment key={i}>
          {i > 0 && <em className="chip-ou">ou</em>}
          <EntityRef category={category} id={o.id} label={o.label} show={o.show} />
        </Fragment>
      ))}
    </span>
  );
}

/** Une ENTRÉE brute de compétence/talent : « A ou B » → choix éclaté ; sinon un simple chip. */
export function EntityChoice({ category, entry }: { category: string; entry: string }) {
  const opts = splitTopLevelOu(entry);
  return opts.length > 1 ? (
    <ChoiceChips category={category} options={opts.map((o) => ({ label: statName(o), show: o }))} />
  ) : (
    <EntityRef category={category} label={statName(entry)} show={entry} />
  );
}

/** Chip d'une compétence CONCRÈTE (instance d'un héros) — libellé vivant + badge `+avancées`. */
export function SkillChip({ skill }: { skill: SkillInstance }) {
  return (
    <EntityRef
      category="skills"
      id={skill.id}
      label={byId('skill', skill.id)?.label ?? skill.id}
      show={skillInstanceLabel(skill)}
      badge={`+${skill.advances}`}
    />
  );
}

/** Chip d'un talent désigné (id, spec) — libellé vivant + `×N` quand `times` > 1. */
export function TalentChip({ talent, times }: { talent: RefDesignee; times?: number }) {
  return (
    <EntityRef
      category="talents"
      id={talent.id}
      label={findTalentById(talent.id)?.label ?? talent.id}
      show={`${refConcrete('talents', talent)}${times != null && times > 1 ? ` ×${times}` : ''}`}
    />
  );
}

/** Chip d'une QUALITÉ/DÉFAUT d'objet (`{id, value?}`) — clé Codex `qualities` = libellé de base ; l'Indice
 *  (« Solide 3 ») s'affiche mais n'entre pas dans la clé de résolution. */
export function QualityChip({ quality }: { quality: QualityInstance }) {
  return (
    <EntityRef category="qualities" id={quality.id} label={qualityRefLabel({ id: quality.id })} show={qualityRefLabel(quality)} />
  );
}

/** Suite inline de chips de qualités (espace sécable entre chips → enroulement naturel, sans wrapper flex). */
export function QualityChips({ qualities }: { qualities: QualityInstance[] }) {
  return (
    <>
      {qualities.map((q, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <QualityChip quality={q} />
        </Fragment>
      ))}
    </>
  );
}

/** Chip d'un Trait STRUCTURÉ (`TraitInstance`, LDB 85) — porté par une créature OU un Trait RACIAL
 *  d'espèce (#572, ex. Ogre) — libellé fidèle via `formatTrait`. */
export function TraitChip({ trait }: { trait: TraitInstance }) {
  return (
    <EntityRef category="traits" id={trait.id} label={findTraitById(trait.id)?.label ?? trait.id} show={formatTrait(trait)} />
  );
}

/** Suite inline de chips de Traits (même patron que `QualityChips`). */
export function TraitChips({ traits }: { traits: TraitInstance[] }) {
  return (
    <>
      {traits.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <TraitChip trait={t} />
        </Fragment>
      ))}
    </>
  );
}
