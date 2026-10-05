/**
 * Psychologie DATA-DRIVEN (LDB 21/85) — `parsePsychTraits` lit la sémantique psy directement dans la
 * DONNÉE : `TraitData.capabilities` (`psychType`/`psychImmune`/`psychIndice` de `traits.json`) + le
 * `TraitInstance` structuré (`value` = Indice de Peur/Terreur ; `arg` = Cible d'un trait ciblé, un id
 * STABLE de `groups.json` — jamais une chaîne FR). Plus de `defs/` ni de regex sur libellé reconstitué
 * (l'ancien round-trip struct→string→regex est retiré). Ajouter/éditer un trait psy = la DONNÉE (au
 * Codex), zéro code par trait.
 */
import type { PsychParse } from './types';
import type { PsychTrait, PsychType } from '../psychology';
import type { TraitList } from '../statEntry';
import { findTraitById, findGroupById } from '../../data';

export type { PsychParse } from './types';

/** Traits psy CIBLÉS (Cible = `instance.arg`, un id de Groupe) ; Peur/Terreur portent un Indice
 *  (`instance.value`). */
const TARGETED: ReadonlySet<string> = new Set(['animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']);

/** Éclate un `arg` d'auteur en Cibles individuelles : la VIRGULE est un raccourci d'auteur pour
 *  PLUSIEURS Traits mono-cible (« Les riches, Les hommes-bêtes » → 2 Traits, un par segment trimé).
 *  « (un/une/deux) au choix » = wildcard(s) — Cible `undefined` (inerte tant que non désignée par
 *  l'éditeur ; « deux au choix » émet 2 entrées wildcard). Un segment qui ne résout PAS un id de Groupe
 *  connu (`groups.json`) → `undefined` (inerte), jamais une chaîne FR résiduelle. */
function splitCibles(arg: string | undefined): (string | undefined)[] {
  if (!arg) return [undefined];
  if (/au choix/i.test(arg)) return /deux/i.test(arg) ? [undefined, undefined] : [undefined];
  return arg.split(',').map((seg) => {
    const id = seg.trim();
    return findGroupById(id) ? id : undefined;
  });
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
    } else if (pt && TARGETED.has(pt)) {
      for (const cible of splitCibles(x.arg ?? caps.psychCible)) {
        const trait: PsychTrait = { type: pt as PsychType, cible };
        if (caps.psychIndice != null) trait.indice = caps.psychIndice;
        (out.psychTraits ??= []).push(trait);
      }
    }
  }
  return out;
}
