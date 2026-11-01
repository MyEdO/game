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
import { parsePsychTraits, type PsychTrait, type PsychType } from './psychology';
import { identiteDeCiblage, type CiblePsy } from './psych/ciblage';
import type { TraitInstance } from './statEntry';

/** Re-dérive les scalaires psy depuis les traits courants (Peur/Terreur/Immunité). */
function resyncPsychScalars(c: Combatant): void {
  const p = parsePsychTraits(c.traits ?? []);
  c.causesPeur = p.causesPeur;
  c.causesTerreur = p.causesTerreur;
  c.psychImmune = p.psychImmune;
}

/** Deux PROVENANCES désignent-elles la même source ? Absente = aucune source (Trait natif). */
const memeSource = (a: EffectSource | undefined, b: EffectSource | undefined): boolean =>
  (a?.kind ?? '') === (b?.kind ?? '') && (a?.id ?? '') === (b?.id ?? '');

/** Égalité STRUCTURELLE de deux `TraitInstance` (la même instance accordée doit être retrouvée). */
export const sameInstance = (a: TraitInstance, b: TraitInstance): boolean =>
  a.id === b.id && (a.value ?? null) === (b.value ?? null) && (a.arg ?? '') === (b.arg ?? '')
  && (a.count ?? null) === (b.count ?? null) && (a.range ?? null) === (b.range ?? null)
  // PROVENANCE comprise : deux instances identiques de sources différentes (Haine (Elfes) d'une
  // mutation et d'une prière) ne sont pas la même — sans elle, le retrait tirerait au hasard.
  && memeSource(a.src, b.src);

/** Index du DERNIER élément de `list` qui satisfait `pred` (l'instance accordée suit la native), ou -1. */
export function dernierIndex<T>(list: readonly T[], pred: (x: T) => boolean): number {
  for (let k = list.length - 1; k >= 0; k--) if (pred(list[k])) return k;
  return -1;
}

/** Traits psy que l'instance `t` contribue, chacun à la PROVENANCE de l'instance. */
const contributionPsy = (t: TraitInstance): PsychTrait[] =>
  (parsePsychTraits([t]).psychTraits ?? []).map((p) => (t.src ? { ...p, src: t.src } : p));

/** Accorde le `TraitInstance` (structuré — `{ id:'vol', value:35 }`, `{ id:'haine', arg:'mort-vivant' }`) :
 *  posé en COPIE, psychologie re-synchronisée. Mute `c`. */
export function grantTrait(c: Combatant, accorde: TraitInstance): void {
  const t = structuredClone(accorde); // #2097, #379
  c.traits = [...(c.traits ?? []), t];
  c.liveTraits = [...(c.liveTraits ?? []), t]; // modificateurs de PROFIL du trait accordé → appliqués en DIRECT (collecteur passif)
  resyncPsychScalars(c);
  const contrib = contributionPsy(t);
  if (contrib.length) c.psychTraits = [...(c.psychTraits ?? []), ...contrib];
}

/** Accorde un Trait PSYCHOLOGIQUE (≠ état de combat) dans `c.psychTraits` — noyau PARTAGÉ par l'op
 *  `grantPsychTrait` (`ops.ts`, effet temporisé) et `attachMutation` (`corruption.ts`, permanent :
 *  Colère impie → Frénésie, mutation → Haine). `src` = PROVENANCE de l'instance, comme `TraitInstance.src`
 *  de `grantTrait`. Mute `c`. */
export function grantPsychTrait(c: Combatant, type: PsychType, cible?: CiblePsy, src?: EffectSource): PsychTrait {
  const pose: PsychTrait = { type, ...(cible ? { cible } : {}), ...(src ? { src: structuredClone(src) } : {}) }; // #2097
  c.psychTraits = [...(c.psychTraits ?? []), pose];
  return structuredClone(pose);
}

/** `x` est-il l'instance accordée `pt` (même identité de ciblage, même provenance) ? */
export const memeTraitPsy = (pt: PsychTrait) => (x: PsychTrait): boolean =>
  identiteDeCiblage(x.type, x.cible) === identiteDeCiblage(pt.type, pt.cible) && memeSource(x.src, pt.src);

/** Retire UNE instance du Trait psy accordé `pt` (la dernière occurrence) de `list`, ou `undefined` si
 *  elle n'y est pas. */
function sansLeTraitPsy(list: readonly PsychTrait[], pt: PsychTrait): PsychTrait[] | undefined {
  const j = dernierIndex(list, memeTraitPsy(pt));
  return j < 0 ? undefined : [...list.slice(0, j), ...list.slice(j + 1)];
}

/** Retire les Traits psy accordés par les effets actifs EXPIRÉS (`grantedPsychTrait`), à appeler APRÈS la
 *  restitution des Traits suspendus (`restoreSuppressedPsych`) : l'instance quitte `c.psychTraits`, ou la
 *  suspension d'un effet encore actif (`suppressedPsych`) qui la restituerait sinon, puis l'affliction de
 *  même identité est désactivée quand plus aucun Trait ne la porte. VDM 10 l.332 ; LDB 43 l.70. Mute `c`. */
export function dropExpiredGrantedPsych(c: Combatant, expired: readonly { grantedPsychTrait?: PsychTrait }[]): void {
  for (const e of expired) {
    const pt = e.grantedPsychTrait;
    if (!pt) continue;
    const reste = sansLeTraitPsy(c.psychTraits ?? [], pt);
    if (reste) c.psychTraits = reste;
    else {
      const suspendant = (c.activeEffects ?? []).find((a) => a.suppressedPsych?.some(memeTraitPsy(pt)));
      if (suspendant) suspendant.suppressedPsych = sansLeTraitPsy(suspendant.suppressedPsych!, pt);
    }
    if (c.psychTraits && !c.psychTraits.length) delete c.psychTraits;
    const identite = identiteDeCiblage(pt.type, pt.cible);
    if ((c.psychTraits ?? []).some((x) => identiteDeCiblage(x.type, x.cible) === identite)) continue;
    for (const a of c.psychState ?? []) if (a.active === true && identiteDeCiblage(a.type, a.cible) === identite) a.active = false;
  }
}

/** Retire UNE instance du trait accordé (jamais un natif en double : la dernière occurrence — celle
 *  posée par le sort) et synchronise la psychologie dérivée. Mute `c`. */
export function removeGrantedTrait(c: Combatant, t: TraitInstance): void {
  const i = dernierIndex(c.traits ?? [], (x) => sameInstance(x, t));
  if (i < 0) return;
  c.traits = [...c.traits!.slice(0, i), ...c.traits!.slice(i + 1)];
  const li = dernierIndex(c.liveTraits ?? [], (x) => sameInstance(x, t)); // retire l'occurrence accordée des modificateurs de profil en direct
  if (li >= 0) c.liveTraits = [...c.liveTraits!.slice(0, li), ...c.liveTraits!.slice(li + 1)];
  resyncPsychScalars(c);
  for (const pt of contributionPsy(t)) {
    const identite = identiteDeCiblage(pt.type, pt.cible);
    const j = dernierIndex(c.psychTraits ?? [], (x) => identiteDeCiblage(x.type, x.cible) === identite && memeSource(x.src, pt.src));
    if (j >= 0) c.psychTraits = [...c.psychTraits!.slice(0, j), ...c.psychTraits!.slice(j + 1)];
  }
  if (c.psychTraits && !c.psychTraits.length) delete c.psychTraits;
}

/** Les instances du trait `traitId` que la source `src` a accordées à `c` (aucune sans source). */
export function traitsAccordesPar(c: Combatant, traitId: string, src?: EffectSource): TraitInstance[] {
  return src ? (c.traits ?? []).filter((t) => t.id === traitId && t.src?.kind === src.kind && t.src?.id === src.id) : [];
}

/** Retire les traits accordés par les effets actifs EXPIRÉS d'une liste (helper partagé
 *  fin-de-Round / purge d'horloge). Mute `c`. */
export function dropExpiredGrantedTraits(c: Combatant, expired: { grantedTrait?: TraitInstance }[]): void {
  for (const e of expired) if (e.grantedTrait) removeGrantedTrait(c, e.grantedTrait);
}
