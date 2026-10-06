/**
 * Chip d'ENTITÉ — SOURCE UNIQUE d'affichage d'une référence (compétence, talent, sort, objet, trait…)
 * sur TOUS les écrans (Codex, créateur, fiche, carte, résumé). Une boîte `.entity-chip` + un
 * déclencheur popover `CodexRef` (survol = description + source ; clic = ouvre le Codex). Gère le
 * CHOIX « A ou B » (chaque option cliquable) de façon identique partout. Le `CodexRowView` du Codex
 * ET les composants d'écran passent par ici → plus aucun rendu d'entité parallèle.
 */
import { Fragment, type ReactNode } from 'react';
import { CodexRef } from './compendium/CodexRef';
import { byId, findTalentById, findTraitById, skillInstanceLabel, talentConcrete, qualityRefLabel, advancementLabel, type AdvancementRef } from '../data';
import { t } from '../i18n';
import { refKey } from '../engine/careerSlots';
import { formatTrait } from '../engine/traits/dispatch';
import type { SkillInstance, TalentInstance, QualityInstance } from '../engine/types';
import type { TraitInstance } from '../engine/statEntry';
import { libelleDeRef } from '../engine/items';

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
  /** Identité STABLE de la cible (préférée quand fournie) — omise, `CodexRef` se rabat sur le lookup
   *  par `label` (auto-liage de prose depuis une donnée sans id). */
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

/** Clé React d'une entrée d'avancement : son identité `refKey(id, spec)` — deux options d'un même
 *  `{pick}` partagent l'id et diffèrent par la `spec` (`alchimiste-2`) ; sans id (tirage, `{pick}`
 *  imbriqué), sa position. */
export function cleDAvancement(a: AdvancementRef, i: number): string | number {
  return 'id' in a ? refKey(a.id, a.spec) : i;
}

/** Une ENTRÉE d'avancement de carrière (`AdvancementRef`), lue sur la STRUCTURE : « A ou B » (`{pick}`) →
 *  un chip par option, chacun par son `id`, séparés par « ou », ou précédés du compte « n parmi : » quand
 *  `pick > 1` (même clé `ref.parmi` que `advancementLabel`) ; une référence → un chip par `id` ; un
 *  tirage (`{random}`) → pastille nue (aucune fiche à ouvrir). */
export function EntityChoice({ category, advancement }: { category: 'skills' | 'talents'; advancement: AdvancementRef }) {
  if ('pick' in advancement) {
    const parmi = advancement.pick > 1;
    return (
      <span className="entity-choice">
        {parmi && <em className="chip-ou">{t('ref.parmi', { n: advancement.pick })}</em>}
        {advancement.of.map((x, i) => (
          <Fragment key={cleDAvancement(x, i)}>
            {i > 0 && !parmi && <em className="chip-ou">{t('ref.ou')}</em>}
            <EntityChoice category={category} advancement={x} />
          </Fragment>
        ))}
      </span>
    );
  }
  if ('id' in advancement) {
    return <EntityRef category={category} id={advancement.id} label={libelleDeRef(category, { id: advancement.id })} show={advancementLabel(category, advancement)} />;
  }
  return <PlainChip label={advancementLabel(category, advancement)} />;
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

/** Chip d'un talent CONCRET (instance d'un héros) — libellé vivant + `×N` si répété. */
export function TalentChip({ talent }: { talent: TalentInstance }) {
  return (
    <EntityRef
      category="talents"
      id={talent.talentId}
      label={findTalentById(talent.talentId)?.label ?? talent.talentId}
      show={`${talentConcrete(talent)}${talent.times > 1 ? ` ×${talent.times}` : ''}`}
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
