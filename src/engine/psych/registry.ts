/**
 * Psychologie DATA-DRIVEN (LDB 21/85) — `parsePsychTraits` lit la sémantique psy directement dans la
 * DONNÉE : `TraitData.capabilities` (`psychType`/`psychImmune`/`psychIndice` de `traits.json`) + le
 * `TraitInstance` structuré (`value` = Indice de Peur/Terreur ; `arg` = Cible d'un trait ciblé, un id
 * STABLE de `groups.json` ou `@id` d'un individu posé par une scène — jamais une chaîne FR). Plus de `defs/` ni de regex sur libellé reconstitué
 * (l'ancien round-trip struct→string→regex est retiré). Ajouter/éditer un trait psy = la DONNÉE (au
 * Codex), zéro code par trait.
 */
import type { PsychParse } from './types';
import type { PsychTrait, PsychType } from '../psychology';
import type { TraitList } from '../statEntry';
import { findTraitById } from '../../data';
import { ARG_JOKER } from '../../data/schemas/grammaire/reference';
import { cibleDeLArg, ciblePsyLue, estCibleType, type CiblePsy } from './ciblage';

export type { PsychParse } from './types';

/** Cibles d'UNE instance : son `arg` est une seule Cible — plusieurs Cibles sont plusieurs instances,
 *  agrégées par `parsePsychTraits`. « (un/une/deux) au choix » = wildcard(s) — Cible `undefined`
 *  (inerte tant que non désignée par l'éditeur ; « deux au choix » émet 2 entrées wildcard). Un `arg`
 *  qu'aucune Cible ne lit (`cibleDeLArg`) → `undefined` (inerte), jamais une chaîne FR résiduelle. Sans
 *  `arg`, la Cible fixe de la def (`capabilities.psychCible`). */
function ciblesDeLInstance(x: { id: string; arg?: string }, psychCible: string | undefined): (CiblePsy | undefined)[] {
  if (x.arg === undefined) return [psychCible === undefined ? undefined : ciblePsyLue(psychCible)];
  const id = x.arg.trim();
  if (!id) return [undefined];
  if (ARG_JOKER.test(id)) return /^deux /i.test(id) ? [undefined, undefined] : [undefined];
  return [cibleDeLArg(x.id, id)];
}

/** Propriétés psy d'un combattant, dérivées de ses `TraitInstance` via les capacités de la donnée. */
export function parsePsychTraits(traits: TraitList): PsychParse {
  const out: PsychParse = {};
  for (const x of traits) {
    const caps = findTraitById(x.id)?.capabilities;
    if (!caps) continue;
    if (caps.psychImmune || caps.swarm || caps.mindless) out.psychImmune = true; // Nuée LDB 85 l.253 ; Fabriqué LDB 85 l.142
    const pt = caps.psychType;
    if (pt === 'peur') {
      if (x.value != null) out.causesPeur = x.value;
    } else if (pt === 'terreur') {
      if (x.value != null) out.causesTerreur = x.value;
    } else if (pt && estCibleType(pt)) {
      for (const cible of ciblesDeLInstance(x, caps.psychCible)) {
        const trait: PsychTrait = { type: pt as PsychType, cible };
        if (caps.psychIndice != null) trait.indice = caps.psychIndice;
        (out.psychTraits ??= []).push(trait);
      }
    }
  }
  return out;
}
