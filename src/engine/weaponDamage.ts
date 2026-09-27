/**
 * Dégâts d'arme — Livre de base, « Les armes » (62-Les armes.md l.177-180). Chaque point de Dégât
 * reçu réduit les Dégâts de l'arme de 1 ; à +0 (ou BF +0) l'arme est improvisée. L'Atout Incassable
 * (l.310) exempte de tout dégât/corrosion/destruction. Réparation = hors combat (Jalon 5).
 */
import { Weapon, WeaponEnchant, ArmourBypass, WeaponRangeSpec, AmmoRangeMod } from './types';
import { findTrappingById, qualityInstance, type TrappingData } from '../data';
import type { TriggeredEffect } from './flowCore';
import type { GameOp } from './ops';
import { isAtoutQuality, isUnbreakable, qualityIndice, resolveQualities } from './qualities/dispatch';
import { longerThanShort } from './engagement';
import { norm } from '../lib/normalize';

/** L'arme matche-t-elle la FAMILLE requise par un enchantement (mot-clé sur nom/sous-type — « épée »,
 *  « hache », « lance ») ? Pas de famille requise → toujours vrai. Sert à CHOISIR l'arme tenue à
 *  enchanter au lancement (Épée de justice ne lie qu'une épée, etc.). */
export function weaponMatchesFamily(w: { label: string; subType?: string } | undefined, requires?: string): boolean {
  if (!requires) return true;
  if (!w) return false;
  return norm(`${w.label} ${w.subType ?? ''}`).includes(norm(requires));
}

/** Dégâts d'arme encaissés EFFECTIFS (pour la pénalité) : l'Atout Solide(N) absorbe les N premiers
 *  Points de Dégâts sans pénalité (LDB 60 l.30). */
function effectiveDamageTaken(w: Weapon): number {
  return Math.max(0, (w.damageTaken ?? 0) - (qualityIndice(w, 'solide') ?? 0));
}

/** Dégâts d'arme effectifs après réduction par `damageTaken` (la composante fixe positive est
 *  réduite, plancher 0 → BF+0 improvisée ; une composante négative — mains nues — est préservée).
 *  Lit la donnée STRUCTURÉE (`WeaponDamageSpec`) — zéro parsing de chaîne ; « Spécial » (literal) → 0. */
export function effectiveWeaponDamage(w: Weapon, strengthBonus: number): number {
  const d = w.damage;
  const usesBF = 'plusBF' in d && d.plusBF;
  const flat = 'flat' in d ? d.flat : 0;
  const dt = effectiveDamageTaken(w); // Solide(N) absorbe les N premiers points (LDB 60 l.30)
  const reduced = flat >= 0 ? Math.max(0, flat - dt) : flat;
  return Math.max(0, (usesBF ? strengthBonus : 0) + reduced);
}

/** Portée d'arme EFFECTIVE en mètres (MIROIR de `effectiveWeaponDamage` pour les Dégâts) : résout une
 *  `WeaponRangeSpec` non résolue avec le BF du porteur. `number` (mètres fixes) → lui-même ; `{ bf }`
 *  (arme de jet) → `BF * bf` ; null/undefined (pas de Portée) → null. Appelée AUX SITES d'usage (combat :
 *  bandes de portée ; affichage : récap/Codex), jamais stockée — dynamique au BF courant. `strBonus` peut
 *  être un fournisseur PARESSEUX (`() => BF`) : il n'est évalué QUE pour une Portée `{bf}` — une Portée
 *  fixe n'exige donc PAS le BF (ni les caractéristiques) du porteur. */
export function effectiveRange(range: WeaponRangeSpec | null | undefined, strBonus: number | (() => number)): number | null {
  if (range == null) return null;
  if (typeof range === 'number') return range;
  return (typeof strBonus === 'function' ? strBonus() : strBonus) * range.bf;
}

/** Applique le modificateur de la MUNITION sélectionnée à la Portée déjà résolue de l'arme (mètres, LDB 62
 *  colonne « Portée ») : `{ mult }` → `round(rangeM * mult)` (« Moitié de l'arme » = ×0.5) ; `{ add }` →
 *  `max(0, rangeM + add)` (± mètres) ; mod absent/null OU arme sans Portée (`rangeM` null) → inchangé. */
export function applyAmmoMod(rangeM: number | null, mod: AmmoRangeMod | null | undefined): number | null {
  if (rangeM == null || mod == null) return rangeM;
  return 'mult' in mod ? Math.round(rangeM * mod.mult) : Math.max(0, rangeM + mod.add);
}

/** Portée EFFECTIVE de l'arme avec la munition sélectionnée : `applyAmmoMod(effectiveRange(weapon.range,
 *  strBonus), ammoMod)`. SOURCE UNIQUE pour les sites combat (bandes de portée) — le BF reste paresseux. */
export function effectiveWeaponRange(weapon: { range?: WeaponRangeSpec | null }, ammoMod: AmmoRangeMod | null | undefined, strBonus: number | (() => number)): number | null {
  return applyAmmoMod(effectiveRange(weapon.range, strBonus), ammoMod);
}

/** Arme de JET (javelot, couteau de lancer, bombe…) : sa Portée est une SPEC `{ bf }` (BF × N mètres,
 *  LDB 62) — par opposition à une Portée fixe en mètres (arc/arbalète/poudre). C'est le classifieur des
 *  armes lancées, seules concernées par la Dispersion d'un Test de Projectiles (Lancer) raté (LDB 14). */
export function isThrownWeapon(weapon: { type?: string; range?: WeaponRangeSpec | null }): boolean {
  return weapon.type === 'ranged' && typeof weapon.range === 'object' && weapon.range != null && 'bf' in weapon.range;
}

/**
 * Replie les ALTÉRATIONS d'une arme (op `augmentWeapon` / arme invoquée) dans son profil de combat :
 * Atouts ajoutés (Magique → `isMagicWeapon` → touche l'Éthéré ; Percutante…), bonus de Dégâts (ajouté
 * au `flat` de la `WeaponDamageSpec`), ignorance de PA, effets « à la touche » (→ `w.onHitEffects`, lus par
 * `effectsOf`), et — sens DÉGRADANT (VDM 05, *Défaut*) — qualités retirées (`removeQualities`/`removeType`),
 * passifs d'arme conférés (`passive`) et neutralisation des enchantements pré-existants (`suppressEnchants`).
 * Appelé par `recomputeLoadout` → l'arme dérivée `c.weapons` est DÉJÀ altérée, donc visible partout
 * (récap, popover, preview) ET appliquée à la résolution. Sans altération : arme inchangée.
 */
export function applyEnchants(w: Weapon, enchants: WeaponEnchant[]): Weapon {
  if (!enchants.length) return w;
  // `suppressEnchants` (VDM 05 Défaut) : les altérations qui le portent restent seules actives — les autres
  // (les enchantements pré-existants de l'arme) sont neutralisées pour la durée.
  const live = enchants.some((e) => e.suppressEnchants) ? enchants.filter((e) => e.suppressEnchants) : enchants;
  const out: Weapon = { ...w, qualities: [...(w.qualities ?? [])] };
  let dmgPlus = 0;
  const onHit: TriggeredEffect[] = [...(w.onHitEffects ?? [])];
  const passive: GameOp[] = [...(w.passive ?? [])];
  const removed = new Set(w.removedQualities ?? []);
  for (const e of live) {
    for (const id of e.addQualities ?? []) if (!out.qualities.some((x) => x.id === id)) out.qualities.push({ id }); // addQualities = ids (valueless)
    for (const id of e.removeQualities ?? []) removed.add(id);
    dmgPlus += e.damageBonus ?? 0;
    if (e.onHitEffects?.length) onHit.push(...e.onHitEffects);
    if (e.passive?.length) passive.push(...e.passive);
  }
  // Retraits : les ids partent d'ici, le TYPE (Atout/Défaut) est résolu PAR LE REGISTRE au point de fusion
  // (`resolveQualities`, engine/qualities/dispatch) — qui voit AUSSI les qualités de FAMILLE du Groupe.
  const types = [...new Set(live.map((e) => e.removeType).filter((t): t is 'atout' | 'defaut' => t != null))];
  if (removed.size) out.removedQualities = [...removed];
  if (types.length) out.removedTypes = [...new Set([...(w.removedTypes ?? []), ...types])];
  if (dmgPlus > 0 && 'flat' in out.damage) out.damage = { ...out.damage, flat: out.damage.flat + dmgPlus };
  const bypasses = live.map((e) => e.bypass).filter((b): b is ArmourBypass => b != null);
  if (bypasses.length) out.bypass = bypasses.includes('all') ? 'all' : bypasses[bypasses.length - 1]; // 'all' prime
  if (onHit.length) out.onHitEffects = onHit;
  if (passive.length) out.passive = passive;
  return out;
}

/** L'arme est-elle réduite à l'état improvisé (bonus de Dégâts à +0 par usure) ? */
export function isImprovised(w: Weapon): boolean {
  if (!('flat' in w.damage)) return false; // « Spécial » (literal) : jamais improvisé
  const flat = w.damage.flat;
  return flat >= 0 && flat - effectiveDamageTaken(w) <= 0;
}

/** Résolveur d'une Possession par id STABLE — même signature que `TrappingResolver` (engine/items). */
type ResolveTrapping = (id: string) => TrappingData | undefined;

/** Profil d'**Arme improvisée** LU DANS LA DONNÉE (entrée `arme-improvisee`, LDB 62 l.31) : Dégâts,
 *  Atouts et Allonge viennent du catalogue, comme `unarmedWeapon` le fait pour `mains-nues` — aucune
 *  valeur de table en dur. SOURCE UNIQUE partagée par l'usure (Dégâts à +0), la Lance de cavalerie hors
 *  Charge et le Bélier hors-porte (`effectiveWeapon`). Entrée absente = donnée cassée, BRUYANTE. */
export function improvisedProfile(w: Weapon, resolveTrapping: ResolveTrapping = findTrappingById): Weapon {
  const t = resolveTrapping('arme-improvisee');
  if (!t?.damage) throw new Error('improvisedProfile : entrée de catalogue « arme-improvisee » absente ou sans profil d’arme (src/data/trappings.json).');
  // `damageTaken`/`noFamilyQualities` sont des MÉCANIQUES de dérivation, pas des colonnes de la table :
  // elles restent au code. `noFamilyQualities` porte « aucun autre Atout » (l.31) — sans lui,
  // `resolveQualities` réinjecterait les qualités de FAMILLE du Groupe (ex. Rapide/Empaleuse d'Escrime).
  // `subType`/`weaponGroup` restent INTACTS : `combatValue`/`talentDamageBonus` (lus par `subType`)
  // doivent voir la MÊME Spé qu'avant improvisation (une arme usée reste de son Groupe pour la
  // compétence, seules ses qualités changent).
  return {
    ...w,
    damage: { ...t.damage },
    qualities: (t.qualities ?? []).map(qualityInstance),
    reach: t.reach ?? undefined,
    damageTaken: 0,
    noFamilyQualities: true,
  };
}

/** Lance de cavalerie (Groupe Cavalerie, nom contenant « lance ») — la règle « improvisée hors Charge »
 *  (LDB 62 l.58) ne vise QUE les lances du Groupe, pas le Marteau à bec-de-corbin ni le Sabre. Détection
 *  par la DONNÉE de combat (`subType` + nom), JAMAIS par le `WeaponDef.group` de rendu. */
function isCavalryLance(w: Weapon): boolean {
  return w.subType === 'cavalerie' && norm(w.label).includes('lance');
}

/** Contexte d'usage d'une arme — règles d'arme CONTEXTUELLES de Groupe (LDB 62), dérivé de l'attaquant
 *  au moment où l'arme est liée à l'attaque (cf. `firedWeapon`). */
export interface WeaponContext {
  /** L'attaquant a Chargé ce Round (`Combatant.chargedThisTurn`). */
  charged?: boolean;
  /** L'attaquant est monté (`Combatant.mountId`). */
  mounted?: boolean;
  /** L'attaquant possède la Spécialisation de Corps à corps du Groupe de l'arme (`hasWeaponGroupSkill`). */
  hasGroupSkill?: boolean;
  /** MODE de la Spé de Projectiles qui couvre le Groupe de l'arme (`weaponGroupSkillMode`) : `'degraded'`
   *  déclenche la perte de tous les Atouts (Défauts conservés) d'une arme à distance utilisée hors de sa
   *  Spé exacte — Arbalète/Lancer par toute autre Spé de Tir (LDB 62 l.184), Ingénierie par Poudre noire
   *  (l.188). `'full'`/`'none'` n'altèrent pas le profil ici. */
  groupSkillMode?: 'full' | 'degraded' | 'none';
  /** Combat « au contact » avec la cible (LDB 62 l.176, Option « Longueur d'arme ») : toute arme plus
   *  longue que Courte y est traitée comme une Arme improvisée. Dérivé de `areInContact(attacker, target)`. */
  auContact?: boolean;
  /** L'arme doit être résolue au profil d'**Arme improvisée** du fait du contexte (cible/situation) que
   *  `effectiveWeapon` ne peut pas déduire seul. Posé par le funnel (`weaponContextOf`). Source actuelle :
   *  Bélier (`ram`) hors-porte (ADE II 8 l.249, via `ramVsNonDoor`). */
  improvised?: boolean;
  /** Lance-harpon (ADE II 02 l.677) : la corde a été séparée de la flèche → profil dégradé (Portée 60,
   *  perte de l'Atout Immobilisante). MODE DE TIR choisi par le joueur au moment de l'attaque (arbitrage
   *  user #476), pas un événement subi — posé par le funnel (`weaponContextOf`) depuis le choix courant. */
  harpoonRopeCut?: boolean;
}

/**
 * Profil de combat EFFECTIF d'une arme, contexte d'usage compris. Sans `ctx` : seule l'usure→improvisée
 * (LDB 62 l.135) s'applique — Dégâts `+BF+1`, Atout `Inoffensive`, plus aucun autre Atout ; une arme non
 * altérée est renvoyée TELLE QUELLE (même référence). Avec `ctx`, deux règles de Groupe contextuelles
 * s'ajoutent :
 *  - Lance de cavalerie utilisée hors d'un Round de Charge → **Arme improvisée** (LDB 62 l.58).
 *  - Fléau manié **sans la Spécialisation** appropriée → Défaut **Dangereuse**, et **aucun autre Atout**
 *    n'est utilisé (LDB 62 l.146-147).
 *  - Arme à distance couverte en mode **`'degraded'`** (`WeaponContext.groupSkillMode`, Arbalète/Lancer
 *    par toute autre Spé de Tir l.184, Ingénierie par Poudre noire l.188) → perd **tous ses Atouts**, ses
 *    Défauts sont conservés.
 *  - Lance-harpon, corde séparée (`WeaponContext.harpoonRopeCut`, ADE II 02 l.677) → Portée 60, perte de
 *    l'Atout Immobilisante.
 * À appliquer LÀ où l'arme se lie à l'attaque pour que la transformation atteigne la touche, les Dégâts ET
 * le jet RATÉ (la Dangereuse se déclenche sur un échec). Idempotent : ré-appliquer sur un profil déjà
 * transformé (ex. l'usure recalculée dans `applyHit`) ne le ré-altère pas.
 */
export function effectiveWeapon(w: Weapon, ctx?: WeaponContext): Weapon {
  if (isImprovised(w)) return improvisedProfile(w); // usure jusqu'à +0 (LDB 62 l.135)
  if (ctx?.charged === false && isCavalryLance(w)) return improvisedProfile(w); // Lance hors Charge (l.59)
  // Combat « au contact » (LDB 62 l.176) : « n'importe quelle arme plus longue que Courte est considérée
  // comme une Arme improvisée » (l'adversaire est entré dans la longueur d'arme). Allonge ≤ Courte
  // (mains nues / dague) → inchangée. MÊME branche que la Lance hors Charge (profil improvisé partagé).
  if (ctx?.auContact && longerThanShort(w)) return improvisedProfile(w);
  if (ctx?.improvised) return improvisedProfile(w); // improvisation dérivée du contexte par le funnel (ex. Bélier hors-porte, ADE II 8 l.249)
  // Lance-harpon, corde séparée (ADE II 02 l.677) : Portée 60 (au lieu de la Portée de base), perte de l'Atout Immobilisante.
  if (ctx?.harpoonRopeCut) return { ...w, range: 60, qualities: w.qualities.filter((q) => q.id !== 'immobilisante') };

  // Fléau sans la Spécialisation : Défaut Dangereuse + AUCUN autre Atout (l.146-147). Le Test reste sur la
  // Caractéristique brute — déjà assuré par `combatValue` (pas de Spé → pas d'avances, LU par `subType`,
  // gardé INTACT). `noFamilyQualities` bloque juste la ré-injection de Perturbante/À Enroulement (famille
  // du Groupe Fléau) que cette règle retire explicitement.
  if (ctx?.hasGroupSkill === false && w.subType === 'fleau') return { ...w, qualities: [{ id: 'dangereuse' }], noFamilyQualities: true };

  // Arme à distance couverte en mode dégradé (Arbalète/Lancer par toute autre Spé de Tir l.184,
  // Ingénierie par Poudre noire l.188) : perd tous ses Atouts, garde ses Défauts. `resolveQualities` (avec
  // Groupe) sert à ÉNUMÉRER l'ensemble propre+famille avant de filtrer, pour qu'un Atout de FAMILLE soit
  // aussi retiré (pas seulement les Atouts listés sur l'instance) ; `subType`/`weaponGroup` restent
  // INTACTS (`combatValue` doit voir la MÊME Spé de tir dégradée).
  if (ctx?.groupSkillMode === 'degraded') {
    const kept = resolveQualities(w).filter((r) => !isAtoutQuality(r.id)).map((r) => (r.indice != null ? { id: r.id, value: r.indice } : { id: r.id }));
    return { ...w, qualities: kept, noFamilyQualities: true };
  }
  return w;
}

/** Inflige 1 point de Dégât à l'arme (sauf Incassable). */
export function damageWeapon(w: Weapon): void {
  if (isUnbreakable(w)) return;
  w.damageTaken = (w.damageTaken ?? 0) + 1;
}

/** Seuil de Sauvegarde (1d10 ≥ seuil ⇒ l'arme résiste) contre une cassure instantanée pour une arme
 *  Solide(N) : 9+ pour N=1, amélioré de 1 par Indice (8+ pour N=2…), LDB 60 l.30. null si non Solide. */
export function solideSaveThreshold(w: Weapon): number | null {
  const n = qualityIndice(w, 'solide');
  return n && n > 0 ? 10 - n : null;
}

/** Ce seuil est-il IMPERDABLE ? `1` (ou moins) : aucun résultat d'un 1d10 ne le rate. Conséquence
 *  mécanique d'un Indice de Solide ≥ 9, que `LDB 60 l.30` autorise (« Cet Atout peut être pris
 *  plusieurs fois. Chaque fois qu'il est pris, le Test de Sauvegarde est amélioré de 1 ») sans borner
 *  l'amélioration. Lu par la porte — qui n'ouvre PAS un dé qui ne décide rien — et par l'écriture de
 *  l'usure — qui sauve alors sans dé : UNE définition, deux consommateurs. */
export const sauvegardeImperdable = (seuil: number): boolean => seuil <= 1;
