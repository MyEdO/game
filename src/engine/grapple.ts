/**
 * EMPOIGNADE (grappling) — Livre de base, « Combat » (14), Option « Empoignade ».
 *
 * RAW (LDB 14, version corrigée, l.155-169) :
 *  - l.159 : « Au lieu d'infliger des Dégâts […] vous pouvez tenter d'Empoigner […]. Vous devez
 *    déclarer cette intention AVANT d'effectuer le lancer pour toucher. Si vous remportez le Test opposé,
 *    vous ET votre adversaire êtes Empoignés, et votre adversaire gagne l'État *Empêtré*. »
 *  - l.161 : « Si vous commencez votre tour Empoigné, vous pouvez BRISER l'Empoignade si vous disposez
 *    d'un Avantage SUPÉRIEUR […] ; autrement, vous devez effectuer un Test opposé de Force pour votre
 *    Action. Sur un succès, choisissez : • BF + DR Dégâts (Localisation via le lancer de Force), en
 *    IGNORANT tous les PA. • Soit 1) Conférer *Empêtré* à l'adversaire, OU 2) vous défaire de l'État
 *    *Empêtré* ET retirer un *Empêtré* supplémentaire par DR obtenu. Si vous PERDEZ le Test opposé :
 *    votre adversaire gagne +1 Avantage. »
 *  - l.169 : « Ceux qui ne sont pas partie prenante gagnent +20 pour toucher le Personnage Empoigné avec
 *    le plus FAIBLE Avantage, et +10 pour celui qui a l'Avantage le plus IMPORTANT. »
 *
 * État `grapplingWith` = relation SYMÉTRIQUE (les DEUX parties) — calque EXACT de `contactWith`
 * (engagement.ts). Tout vient de la Source (aucune invention). PUR.
 */
import type { Combatant } from './types';
import type { ModLine } from './combat';
import { RULE_REF } from './ruleRefs';
import { isInanimate } from './structures';

/** LDB 14 l.159 ; AA 10 l.96 ; MDG 13 l.612 ; EDOC 07 l.314 ; #1595 c.6230022636. */
export function peutEtreEmpoigne(target: Pick<Combatant, 'bodyShape' | 'inert'>): boolean {
  return !isInanimate(target);
}

/** Deux combattants sont-ils mutuellement Empoignés (LDB 14 l.159) ? Relation SYMÉTRIQUE (posée par
 *  paire) — un seul côté suffit donc à la lire. Pure. */
export function areGrappling(a: Combatant, b: Combatant): boolean {
  return !!a.grapplingWith?.includes(b.id) || !!b.grapplingWith?.includes(a.id);
}

/** Pose l'Empoignade symétriquement (LDB 14 l.159 : « vous ET votre adversaire êtes Empoignés »).
 *  Idempotent. L'État *Empêtré* de l'adversaire est posé À PART (donnée, via addCondition). */
export function setGrapple(a: Combatant, b: Combatant): void {
  for (const [x, y] of [[a, b], [b, a]] as const) {
    x.grapplingWith ??= [];
    if (!x.grapplingWith.includes(y.id)) x.grapplingWith.push(y.id);
  }
}

/** Retire l'Empoignade A↔B des deux côtés (Brisée, ou une partie hors d'action). Idempotent. */
export function clearGrapple(a: Combatant, b: Combatant): void {
  if (a.grapplingWith) a.grapplingWith = a.grapplingWith.filter((id) => id !== b.id);
  if (b.grapplingWith) b.grapplingWith = b.grapplingWith.filter((id) => id !== a.id);
}


/**
 * Bonus de tiers (LDB 14 l.169) : un attaquant qui n'est PAS partie à l'Empoignade gagne **+20** pour
 * toucher l'Empoigné dont l'Avantage est le PLUS FAIBLE des deux, **+10** pour celui dont l'Avantage est
 * le plus IMPORTANT. `partner` = l'AUTRE Empoigné (celui avec qui `target` est Empoigné). Renvoie null si
 * la cible n'est pas Empoignée, si l'attaquant EST partie à l'Empoignade, ou si le partenaire est introuvable.
 * Égalité d'Avantage → traité comme « le plus faible » (+20). PUR.
 * `famille: 'circonstance'` : c'est l'immobilisation de l'ADVERSAIRE qui l'ouvre, pas une ressource
 * du tiers (l'Avantage n'y CHOISIT que la valeur) — critère de `combineMods`, donc plafonné.
 */
export function grappleTierMod(attacker: Combatant, target: Combatant, partner: Combatant | undefined): ModLine | null {
  if (!target.grapplingWith?.length || areGrappling(attacker, target) || !partner) return null;
  const lower = target.advantage <= partner.advantage; // cible = Avantage le plus FAIBLE (égalité → +20)
  return { label: 'Empoignade (cible bloquée)', value: lower ? 20 : 10, famille: 'circonstance', ref: RULE_REF.empoignade };
}

/** Résout le partenaire d'Empoignade de `target` dans la liste de combat puis applique `grappleTierMod`
 *  (LDB 14 l.169). Source du modificateur injecté en `env` par `attackEnv` (mêlée ET tir). */
export function grappleEnvMod(attacker: Combatant, target: Combatant, all: Combatant[]): ModLine | null {
  if (!target.grapplingWith?.length || areGrappling(attacker, target)) return null;
  const partner = all.find((c) => target.grapplingWith!.includes(c.id));
  return grappleTierMod(attacker, target, partner);
}
