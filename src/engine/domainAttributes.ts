/**
 * Attributs de Domaine (LDB 48 — intros des 8 Couleurs, L14) : l'effet PASSIF dont bénéficie
 * tout Sort « issu du Domaine » (subType du sort — application STRICTE : les Arcanes communs,
 * sans subType, n'en bénéficient pas ; le chapitre 47 ne les rattache pas au Domaine du lanceur).
 *
 * Citations (48 - Magie des Couleurs.md) :
 *  - LDB 48 l.11  : « Chaque fois que vous lancez avec succès un Sort du Domaine de la Bête, vous
 *    pouvez aussi gagner le Trait de créature Peur 1 pour les 1d10 prochains Rounds. »
 *  - LDB 48 l.106 : « Les Sorts infligeant des Dégâts ignorent les PA des armures en métal, et se
 *    dirigent vers toutes les autres cibles dans les 2 mètres, à l'exception de ceux possédant le
 *    Talent Magie des Arcanes (Cieux), infligeant un nombre de Dégâts égal à votre BFM […]. »
 *  - LDB 48 l.203 : « Vous pouvez infliger +1 État Enflammé à quiconque ciblé […] à moins qu'il ne
 *    possède le Talent Magie des Arcanes (Feu). Chaque État Enflammé situé à une distance en
 *    mètres égale à votre BFM ajoute +10 aux tentatives de Focalisation ou d'Incantation… »
 *  - LDB 48 l.302 : « Vous pouvez infliger un État Aveuglé aux cibles […] sauf Talent (Lumière).
 *    Si une cible possède Démoniaque ou Mort-vivant, les Sorts infligent une frappe supplémentaire
 *    de BInt Dégâts qui ignore le Bonus d'Endurance et les PA. »
 *  - LDB 48 l.399 : « Les Sorts infligeant des Dégâts ignorent les PA des armures métalliques, et
 *    infligent un bonus de Dégâts égal au nombre de PA de l'armure métallique portée à la
 *    Localisation frappée. »
 *  - LDB 48 l.501 : « Vous pouvez assigner +1 État Exténué à chaque cible vivante affectée […].
 *    Une cible peut n'avoir qu'un seul État Exténué gagné de cette façon à la fois. »
 *  - LDB 48 l.588 : « les Sorts lancés depuis le Domaine des Ombres ignorent tous les PA non
 *    magiques. »
 *  - LDB 48 l.690 : « +10 pour Incanter ou Focaliser dans un environnement rural […] les créatures
 *    vivantes ciblées se voient retirer tous les États Exténué et Hémorragique, après que tous les
 *    autres effets ont été appliqués […] les Morts-vivants subissent +BFM Dégâts ignorant BE+PA. »
 *
 * Choix jeu-sans-MJ (documentés) : les « vous pouvez » offensifs (Feu/Lumière/Mort) ne sont
 * appliqués qu'aux cibles ADVERSES (un lanceur rationnel n'enflamme pas ses alliés) ; le +10
 * « environnement rural » de la Vie n'est pas câblé (pas de classification de scène) ; l'armure
 * PLATE d'un statblock (matière inconnue) compte comme NON-métal et NON-magique.
 */
import type { Combatant, HitLocation } from './types';
import type { TriggeredEffect } from './flowCore';
import { RNG } from './dice';
import { groupMatch, groupesDe } from './groups';
import { bypassedAP } from './armourBypass';
import { findDomainById } from '../data';
import { arcaneDomainOf } from './combatFeatures/dispatch';
import { applyOps } from './ops';

/** Forme MINIMALE d'un sort pour la résolution de son Domaine : le RUNTIME lit le seul `domainId`
 *  (id STABLE, indépendant de la langue) ; absent = Sort sans Domaine (Magie Mineure, Prière…). */
type SpellDomainRef = { domainId?: string | null };

/** Le combattant possède-t-il le Talent « Magie des Arcanes (Domaine) » (exemption des riders) ?
 *  Taxonomie des 4 types de Sorts (mineurs/Arcane/Domaine/Chaos), LDB 46 l.14. */
export function hasArcaneTalent(c: Combatant, domain: string): boolean {
  const arc = arcaneDomainOf(c);
  return arc != null && arc.toLowerCase() === domain.toLowerCase();
}

// PA par matière (métal/cuir), PA magiques et ignorance générale : moteur UNIQUE engine/armourBypass.
export { metalAPAt } from './armourBypass';

/** Modulation de la MITIGATION d'un Projectile par l'attribut du Domaine (Cieux/Métal/Ombres) — PARAMÈTRE
 *  lu en DONNÉES (`DomainData.missile`) : `bypass` (matière ignorée) + `bonusFromBypass` (Métal : ajoute
 *  les PA ignorés aux Dégâts). `totalAP` = PA effectifs de la cible à la localisation. */
export function domainMissileMods(
  target: Combatant,
  spell: SpellDomainRef,
  loc: HitLocation,
  totalAP: number,
): { apIgnored: number; bonusDamage: number } {
  const missile = findDomainById(spell.domainId)?.missile;
  if (!missile) return { apIgnored: 0, bonusDamage: 0 };
  const ignored = bypassedAP(target, loc, missile.bypass, totalAP);
  return { apIgnored: ignored, bonusDamage: missile.bonusFromBypass ? ignored : 0 };
}

/** Appartenance au Groupe « mort-vivant » (LDB 85 : catégorie déclarée par l'entrée du bestiaire OU
 *  par le Trait porté — `groupesDe`) — GROUPE, pas le trait lui-même (une créature du Groupe sans porter le
 *  Trait n'est pas ciblable par un effet qui exige LE TRAIT, cf. `capabilities.undead` pour ce cas). */
const isUndead = (c: Combatant): boolean => groupMatch('mort-vivant', groupesDe(c));
const isDaemon = (c: Combatant): boolean => groupMatch('demon', groupesDe(c));
/** « cible vivante » (Mort/Vie) : ni Mort-vivant ni Démon. */
export const isLiving = (c: Combatant): boolean => !isUndead(c) && !isDaemon(c);

/** Riders « à la touche » d'un Sort du Domaine (Feu → En flammes ; Lumière → Aveuglé + frappe ;
 *  Mort → Exténué ; Vie → purge/flétrissure) — DONNÉE éditable (`DomainData.onHitEffects`, `TriggeredEffect[]`).
 *  Le gating (cible adverse / vivante / mort-vivante / résistance par Talent) vit dans les Conditions Flow
 *  `relation`/`has`. Appliqués par le dispatcher `noyau/triggeredEffects` (walker `runPureFlowLines`, `noyau/combat/flowEval`). */
export function domainOnHitEffects(spell: SpellDomainRef): TriggeredEffect[] {
  // `DomainData.effects` est typé avec la feuille `Effect` complète (couche state, pour l'éditeur de
  // Flow partagé) ; un rider de Domaine ne porte JAMAIS de transition/dialogue (que des `GameOp`), donc
  // le rétrécir à la feuille `EffectOp` engine-pure est SAIN (signature publique du moteur = pure, #8).
  return (findDomainById(spell.domainId)?.effects ?? []) as TriggeredEffect[];
}

/** Bonus d'incantation lié à l'ENVIRONNEMENT (LDB 48 l.690 — Vie/Ghyran : « Recevez un bonus de +10 aux
 *  lancers pour Incanter ou Focaliser dans un environnement rural ou sauvage »). Lu en DONNÉE
 *  (`DomainData.environmentBonus`) ; `env` = classification de la Scène (`Scene.environment`). 0 si le
 *  Domaine n'a pas d'attribut d'environnement ou si l'environnement courant n'y figure pas. */
export function domainEnvironmentBonus(spell: SpellDomainRef, env: string | null | undefined): number {
  const eb = findDomainById(spell.domainId)?.environmentBonus;
  if (!eb || !env) return 0;
  return eb.environments.includes(env) ? eb.mod : 0;
}

/** Le Sort relève-t-il du Domaine de la SORCELLERIE (LDB 49) ? Marqueur DONNÉE (`DomainData.sorcery`). */
export function isSorceryDomain(spell: SpellDomainRef): boolean {
  return findDomainById(spell.domainId)?.sorcery === true;
}

/** Ops post-incantation appliquées AU LANCEUR après un Sort de Domaine réussi — PARAMÈTRE en données
 *  (`DomainData.casterOps` : `GameOp[]`). Ex. Bête (Ghur) : `grantTrait` Peur 1 pendant 1d10 Rounds.
 *  Exécutées via `applyOps` — source unique, pas de réimplémentation de grantTrait ici. */
export function domainCasterOps(caster: Combatant, spell: SpellDomainRef, rng: RNG): string[] {
  const ops = findDomainById(spell.domainId)?.casterOps;
  if (!ops?.length) return [];
  return applyOps(caster, ops, { rng, label: 'Attribut de domaine' });
}

/**
 * Magie des mers (MDG 02 l.178-186 : « Les modificateurs suivants s'appliquent aux tentatives de
 * Focalisation et d'Incantation en mer. ») — 4 Domaines portent un `seaModifier` (`DomainData`).
 * PARAMÈTRE en données ; `atSea` = contexte navigation fourni par l'appelant (état, hors du moteur pur).
 */
export type SeaWind = 'violente-tempete' | 'calme-plat' | string;

/** Feu (Aqshy, l.182) : « Les Tests de Focalisation pour ce Domaine subissent -1 DR. »
 *  Omission ASSUMÉE (#337) : l'exception « +1 DR si le sort cible un vaisseau EN FLAMMES » (même
 *  ligne) n'est pas modélisée — `resolveFocus` n'a pas de cible physique (pas de `target: Combatant`),
 *  donc rien à tester pour l'État *En flammes* d'une COQUE. Nécessiterait de faire porter une cible
 *  au Test de Focalisation (chantier hors périmètre #337). */
export function domainSeaFocalisationDR(spell: SpellDomainRef, atSea: boolean): number {
  if (!atSea) return 0;
  return findDomainById(spell.domainId)?.seaModifier?.focalisationDR ?? 0;
}

/** Vie (Ghyran, l.186) : « Les DR des Tests de Focalisation sont doublés sur les mers. » */
export function domainSeaFocalisationDoubled(spell: SpellDomainRef, atSea: boolean): boolean {
  return atSea && !!findDomainById(spell.domainId)?.seaModifier?.focalisationDrDoubled;
}

/** Vie (Ghyran, l.186) : « une Focalisation Critique donne une Incantation Imparfaite Majeure au lieu
 *  de Mineure » (l'exception « Harmonisation aethyrique » reste gérée par l'appelant, LDB 46). */
export function domainSeaFocusCritMiscastMajeure(spell: SpellDomainRef, atSea: boolean): boolean {
  return atSea && !!findDomainById(spell.domainId)?.seaModifier?.focusCritMiscastMajeure;
}

/** Cieux (Azyr, l.184) : « +1 DR sur les Tests d'Incantation » en Violente tempête, « -1 DR » en Calme plat. */
export function domainSeaIncantationDR(spell: SpellDomainRef, atSea: boolean, wind: SeaWind | null | undefined): number {
  if (!atSea) return 0;
  const sm = findDomainById(spell.domainId)?.seaModifier;
  if (!sm) return 0;
  if (wind === 'violente-tempete') return sm.incantationStormDR ?? 0;
  if (wind === 'calme-plat') return sm.incantationCalmDR ?? 0;
  return 0;
}

/** Bête (Ghur, l.180) : « les Incantations et Focalisations critiques ainsi que les Maladresses se
 *  produisent à la fois sur les doubles et les résultats se terminant par un 0. » */
export function domainSeaWidensCritFumble(spell: SpellDomainRef, atSea: boolean): boolean {
  return atSea && !!findDomainById(spell.domainId)?.seaModifier?.critFumbleOnTens;
}

/**
 * Modificateurs de DR propres au VENT du Domaine (`DomainData.windModifiers`) — hors mer
 * (`seaModifier`, MDG). Les huit Vents en portent une rubrique dans Les Vents de Magie :
 * `VDM 04 l.48-56` (Hysh, folio 55) · `VDM 05 l.38-44` (Chamon, 67) · `VDM 06 l.34-38` (Ghyran, 79)
 * `VDM 07 l.42-48` (Azyr, 91) · `VDM 08 l.36-40` (Ulgu, 103) · `VDM 09 l.38-42` (Shyish, 115)
 * `VDM 10 l.38-42` (Aqshy, 127) · `VDM 11 l.38-44` (Ghur, 139).
 *
 * POINT DE LECTURE UNIQUE de la donnée : `resolveCasting`/`resolveFocus`/`castLandProbability`
 * (`engine/magic`) n'appellent que cette fonction, et aucun Domaine n'y est nommé.
 */
export type WindTest = 'incantation' | 'focalisation' | 'seconde-vue';

/** Contexte des modificateurs de Vent, fourni par l'appelant (état) : ids des circonstances du monde
 *  courant (météo, saison, relief, lieu…) ET des annulations en cours (`cancelledBy.circumstance`,
 *  ex. l'assistant qui chante pour un sorcier Lumineux). Vide = aucune circonstance connue. */
export interface WindContext {
  circumstances?: readonly string[];
}

/** Delta de DR du Vent pour `test`, somme des modificateurs dont la circonstance tient et dont
 *  l'annulation ne tient pas. 0 si le Domaine n'a pas de rubrique de Vent. */
export function domainWindDR(spell: SpellDomainRef, test: WindTest, ctx: WindContext = {}): number {
  const mods = findDomainById(spell.domainId)?.windModifiers;
  if (!mods?.length) return 0;
  const circ = ctx.circumstances ?? [];
  let dr = 0;
  for (const m of mods) {
    if (!m.tests.includes(test)) continue;
    if (m.when && !m.when.some((c) => circ.includes(c))) continue;
    if (m.cancelledBy && circ.includes(m.cancelledBy.circumstance)) continue;
    dr += m.dr;
  }
  return dr;
}
