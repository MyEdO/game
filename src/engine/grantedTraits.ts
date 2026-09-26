/**
 * Traits de créature TEMPORISÉS accordés par un sort (Jalon 2.6 — op `grantTrait`) :
 * Envol (Vol), Effrayant (Peur), Terrifiant (Terreur), Protection (9+), Perturbant,
 * Sang corrosif, Vision dans l'obscurité (Infravision), Vaincre les impies (Haine)…
 *
 * Principe : le trait (`TraitInstance` structuré — `{ id:'peur', value:2 }`) est POSÉ dans `c.traits`
 * → tous les consommateurs EXISTANTS (dispatch `engine/traits/`, psychologie, IA, déplacement) le voient
 * comme un trait natif ; il est RETIRÉ (une instance) à l'expiration de l'`ActiveEffect` porteur
 * (`grantedTrait`) — fin de Round (`endOfRound`) OU échéance d'horloge (cascade #T3).
 *
 * Les champs psy dérivés au spawn (`causesPeur`/`causesTerreur`/`psychImmune`/`psychTraits`)
 * sont re-synchronisés : les SCALAIRES sont re-dérivés du parse complet de `c.traits` (ils ne
 * viennent que des traits) ; `psychTraits` est ajusté ADDITIVEMENT (on n'y retire que la
 * contribution du trait accordé) car des entrées peuvent venir d'ailleurs (mutations).
 */
import { Combatant, type EffectSource } from './types';
import { parsePsychTraits, type PsychType } from './psychology';
import type { TraitInstance } from './statEntry';

/** Re-dérive les scalaires psy depuis les traits courants (Peur/Terreur/Immunité). */
function resyncPsychScalars(c: Combatant): void {
  const p = parsePsychTraits(c.traits ?? []);
  c.causesPeur = p.causesPeur;
  c.causesTerreur = p.causesTerreur;
  c.psychImmune = p.psychImmune;
}

/** Égalité STRUCTURELLE de deux `TraitInstance` (la même instance accordée doit être retrouvée). */
const sameInstance = (a: TraitInstance, b: TraitInstance): boolean =>
  a.id === b.id && (a.value ?? null) === (b.value ?? null) && (a.arg ?? '') === (b.arg ?? '')
  && (a.count ?? null) === (b.count ?? null) && (a.range ?? null) === (b.range ?? null)
  // PROVENANCE comprise : deux instances identiques de sources différentes (Haine (Elfes) d'une
  // mutation et d'une prière) ne sont pas la même — sans elle, le retrait tirerait au hasard.
  && (a.src?.kind ?? '') === (b.src?.kind ?? '') && (a.src?.id ?? '') === (b.src?.id ?? '');

/** Index de la DERNIÈRE occurrence de `t` dans `list` (celle posée par le sort), ou -1. */
const lastIndexOfInstance = (list: TraitInstance[], t: TraitInstance): number => {
  for (let k = list.length - 1; k >= 0; k--) if (sameInstance(list[k], t)) return k;
  return -1;
};

/** Accorde le `TraitInstance` (structuré — `{ id:'vol', value:35 }`, `{ id:'haine', arg:'mort-vivant' }`) :
 *  posé tel quel, psychologie re-synchronisée. Mute `c`. */
export function grantTrait(c: Combatant, t: TraitInstance): void {
  c.traits = [...(c.traits ?? []), t];
  c.liveTraits = [...(c.liveTraits ?? []), t]; // modificateurs de PROFIL du trait accordé → appliqués en DIRECT (collecteur passif)
  resyncPsychScalars(c);
  const contrib = parsePsychTraits([t]).psychTraits ?? [];
  if (contrib.length) c.psychTraits = [...(c.psychTraits ?? []), ...contrib];
}

/** Accorde un Trait PSYCHOLOGIQUE (≠ état de combat) dans `c.psychTraits` — noyau PARTAGÉ par l'op
 *  `grantPsychTrait` (`ops.ts`, effet temporisé) et `attachMutation` (`corruption.ts`, permanent :
 *  Colère impie → Frénésie, mutation → Haine). Mute `c`. */
export function grantPsychTrait(c: Combatant, type: PsychType, cible?: string): void {
  c.psychTraits = [...(c.psychTraits ?? []), { type, ...(cible ? { cible } : {}) }];
}

/** Retire UNE instance du trait accordé (jamais un natif en double : la dernière occurrence — celle
 *  posée par le sort) et synchronise la psychologie dérivée. Mute `c`. */
export function removeGrantedTrait(c: Combatant, t: TraitInstance): void {
  const i = lastIndexOfInstance(c.traits ?? [], t);
  if (i < 0) return;
  c.traits = [...c.traits!.slice(0, i), ...c.traits!.slice(i + 1)];
  const li = lastIndexOfInstance(c.liveTraits ?? [], t); // retire l'occurrence accordée des modificateurs de profil en direct
  if (li >= 0) c.liveTraits = [...c.liveTraits!.slice(0, li), ...c.liveTraits!.slice(li + 1)];
  resyncPsychScalars(c);
  const contrib = parsePsychTraits([t]).psychTraits ?? [];
  for (const pt of contrib) {
    const j = (c.psychTraits ?? []).findIndex((x) => x.type === pt.type && (x.cible ?? '') === (pt.cible ?? ''));
    if (j >= 0) c.psychTraits = [...c.psychTraits!.slice(0, j), ...c.psychTraits!.slice(j + 1)];
  }
  if (c.psychTraits && !c.psychTraits.length) delete c.psychTraits;
}

/** Retire les instances du Trait `traitId` que la source `src` a ACCORDÉES à `c` — retrouvées par le
 *  registre d'instance `TraitInstance.src` (posé par l'op `grantTrait` et par `attachMutation`), quels
 *  que soient leur argument et leur indice — et renvoie celles qui l'ont été. Noyau de l'op
 *  `removeTrait` : un porteur qui RE-CIBLE son Trait (Haine sporadique, EDOC 12 l.217) retire LE SIEN puis
 *  le ré-accorde, au lieu d'empiler une instance par jour ; le même Trait porté nativement ou accordé
 *  par un TIERS (Haine d'une prière, LDB 226) reste intact. Source inconnue = rien à attribuer, donc
 *  rien retiré. Mute `c`. */
export function removeGrantedTraitsFrom(c: Combatant, traitId: string, src?: EffectSource): TraitInstance[] {
  if (!src) return [];
  const removed = (c.traits ?? []).filter((t) => t.id === traitId && t.src?.kind === src.kind && t.src?.id === src.id);
  for (const t of removed) removeGrantedTrait(c, t);
  return removed;
}

/** Retire les traits accordés par les effets actifs EXPIRÉS d'une liste (helper partagé
 *  fin-de-Round / purge d'horloge). Mute `c`. */
export function dropExpiredGrantedTraits(c: Combatant, expired: { grantedTrait?: TraitInstance }[]): void {
  for (const e of expired) if (e.grantedTrait) removeGrantedTrait(c, e.grantedTrait);
}
