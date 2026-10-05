/**
 * Dispatcher PUR des capacités de TALENTS (LDB 10) : agrège les champs du registre par porteur
 * (niveau = `times` du talent) et expose des helpers typés consommés par combat.ts / combatFlow /
 * rollFlows / store. Aucune mutation. Même patron que `engine/qualities/dispatch.ts`.
 */
import type { Combatant, Weapon } from '../types';
import { groupMatch } from '../groups';
import { isShieldItem } from '../items';
import { findTalentById, findTraitById } from '../../data';
import { canStrikeFirst } from '../qualities/dispatch';
import { effectiveEntry } from '../variants';
import { weaponLoaded } from '../weaponLoad';
import type { CombatFeature, CombatFeatureCtx, CastingKind } from './types';

/** Famille d'incantation d'un Talent par son `id` STABLE (« magie-mineure », « beni ») via sa DONNÉE
 *  EFFECTIVE (`effectiveEntry`, #563/#564 — `combat` est republiable par variante réglée, comme pour
 *  `featuresOf` l.59/64), ou undefined. Pour les consommateurs qui ont un id, pas un Combattant. */
export function castingKindOf(talentId: string): CastingKind | undefined {
  return effectiveEntry(findTalentById(talentId))?.combat?.castingKind;
}

/** Domaine d'Arcane du lanceur (LDB 46) : la spécialisation du talent à `castingKind:'arcane'` (Magie des
 *  Arcanes — Métal, Bêtes…), ou undefined. Source DONNÉE (`combat.castingKind`), consommée pour les
 *  exemptions d'armure, le domaine d'incantation, le Souffle de breathType. */
export function arcaneDomainOf(c: Combatant): string | undefined {
  for (const t of c.talents ?? []) if (castingKindOf(t.talentId) === 'arcane') return t.spec;
  return undefined;
}

/** `id` STABLE du Domaine d'Arcane du lanceur : la spec du Talent Magie des Arcanes EST un id de
 *  `domains.json`. Le RUNTIME en aval
 *  (breathType, attributs de Domaine) lit par `findDomainById`. undefined si pas de Domaine / non spécialisé. */
export function arcaneDomainIdOf(c: Combatant): string | undefined {
  return arcaneDomainOf(c);
}

/** Domaine du Chaos du lanceur (EDOC 13) : la spécialisation du talent à `castingKind:'chaos'` (Magie du
 *  Chaos — Nurgle/Slaanesh/Tzeentch/Indivisible), ou undefined. Miroir d'`arcaneDomainOf` — source DONNÉE
 *  (`combat.castingKind`), consommée par tout Sort d'Arcanes du Chaos « se manifestant selon le Domaine »
 *  (Allure démoniaque : sélection de la colonne du Tableau des aspects démoniaques). Sans Talent Magie du
 *  Chaos → undefined (un Sort d'Arcanes du Chaos est réservé aux porteurs du Talent, EDOC 13 l.264-266). */
export function chaosDomainOf(c: Combatant): string | undefined {
  for (const t of c.talents ?? []) if (castingKindOf(t.talentId) === 'chaos') return t.spec;
  return undefined;
}

/** Capacités de combat présentes sur le combattant, lues de la DONNÉE (`TalentData.combat`) : talents
 *  POSSÉDÉS (niveau = times) + talents ACCORDÉS par un effet actif de sort (op `grantTalent`, niveau 1
 *  tant que l'effet dure — Flambeau de Vertu : Sans peur ; Cœurs ardents : Cœur vaillant…, Jalon 2.6).
 *  La DONNÉE lue est l'entrée EFFECTIVE (`effectiveEntry`, #563/#564) : la variante réglée active
 *  remplace le `combat` de base ; aucun code ne nomme un Talent. */
export function featuresOf(c: Combatant): { def: CombatFeature; ctx: CombatFeatureCtx }[] {
  const out: { def: CombatFeature; ctx: CombatFeatureCtx }[] = [];
  for (const t of c.talents ?? []) {
    const def = effectiveEntry(findTalentById(t.talentId))?.combat;
    if (def) out.push({ def, ctx: { combatant: c, level: t.times ?? 1, spec: t.spec } });
  }
  for (const e of c.activeEffects ?? []) {
    if (!e.grantedTalent) continue;
    const def = effectiveEntry(findTalentById(e.grantedTalent.talentId))?.combat;
    if (def) out.push({ def, ctx: { combatant: c, level: 1, spec: e.grantedTalent.spec } });
  }
  return out;
}

/** Sans peur (LDB 10 l.1051) : `c` porte-t-il le Talent contre `foe` ? PAS une immunité —
 *  détection d'éligibilité (talent possédé vs l'Ennemi spécifié, par Groupes, ou ACCORDÉ par un
 *  sort sans spec, toutes sources). L'appelant (`sansPeurVs`) en déduit un seul Test de Calme
 *  Accessible (+20) à la rencontre — qui PEUT échouer, cf. `resolvePeurTest`/`resolveTerreurTest`. */
export function fearImmuneVs(c: Combatant, foe: Pick<Combatant, 'groups'>): boolean {
  return featuresOf(c).some(
    ({ def, ctx }) => def.fearImmune && (ctx.spec == null || groupMatch(ctx.spec, foe.groups ?? [])),
  );
}

/** Somme des niveaux des capacités vérifiant `pred` (0 si aucune). */
function levelSum(c: Combatant, pred: (d: CombatFeature) => boolean): number {
  return featuresOf(c).reduce((s, { def, ctx }) => s + (pred(def) ? ctx.level : 0), 0);
}

/** Pénalité de main secondaire (LDB 14 l.181 : -20), transformée par les capacités (Ambidextre → -10/0).
 *  Interprète le champ DÉCLARATIF `offHandPenalty:{perLevel,zeroAt}` : -20 +perLevel×niveau, 0 dès `zeroAt`. */
export function offHandPenalty(c: Combatant): number {
  let pen = -20;
  for (const { def, ctx } of featuresOf(c)) {
    if (def.offHandPenalty) {
      const { perLevel, zeroAt } = def.offHandPenalty;
      pen = ctx.level >= zeroAt ? 0 : Math.min(0, pen + perLevel * ctx.level);
    }
  }
  return pen;
}

/** Modes d'attaque conférés par les capacités du combattant (ex. 'dual-wield' via Maniement de deux armes). */
export function attackModesFor(c: Combatant): string[] {
  const out: string[] = [];
  for (const { def } of featuresOf(c)) if (def.attackModes) out.push(...def.attackModes);
  return out;
}

/** Bonus de Dégâts des talents pour CETTE attaque : Coup puissant (mêlée), Tir précis (distance),
 *  Combat déloyal (Bagarre), Charge berserk/Déterminé (en Charge). LDB 10. */
export function talentDamageBonus(c: Combatant, weapon: Weapon, charged: boolean): number {
  const melee = weapon.type === 'melee';
  const brawl = melee && weapon.subType === 'bagarre'; // Groupe « Bagarre » (id)
  return (
    (melee ? levelSum(c, (d) => !!d.meleeDamageBonus) : levelSum(c, (d) => !!d.rangedDamageBonus)) +
    (brawl ? levelSum(c, (d) => !!d.brawlDamageBonus) : 0) +
    (charged && melee ? levelSum(c, (d) => !!d.chargeDamageBonus) : 0)
  );
}

/** Tueur (LDB 10) : Bonus de Force = Bonus d'Endurance de la cible s'il est plus élevé. */
export function isSlayer(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.slayer);
}

/** Robuste (LDB 10) : réduit tous les Dégâts subis de niveau (min 1 Blessure — plancher déjà garanti). */
export function talentDamageReduction(c: Combatant): number {
  return levelSum(c, (d) => !!d.damageReduction);
}

/** Frappe blessante (LDB 10) : +niveau Blessures quand on inflige une Blessure Critique. */
export function talentCritExtraWounds(c: Combatant): number {
  return levelSum(c, (d) => !!d.critExtraWounds);
}

/** Tir sûr (LDB 10) : PA de la cible ignorés au tir (niveau). */
export function talentRangedAPIgnore(c: Combatant): number {
  return levelSum(c, (d) => !!d.rangedAPIgnore);
}

/** La pénalité de Localisation visée est-elle annulée ? Frappe assommante (Tête + arme Assommante,
 *  mêlée) / Tir mortel (à distance). LDB 10. */
export function ignoresCalledShotPenalty(c: Combatant, kind: 'melee' | 'ranged', location: string | null | undefined, weaponHasAssommante: boolean): boolean {
  if (kind === 'ranged') return featuresOf(c).some(({ def }) => def.ignoreCalledShotRanged);
  return location === 'tete' && weaponHasAssommante && featuresOf(c).some(({ def }) => def.ignoreCalledShotHead);
}

/** Tireur d'élite (LDB 10) : ignore les modificateurs de Taille de la cible au tir. */
export function ignoresSizeRangedMods(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.ignoreSizeRangedMods);
}

/** Tireur embusqué (LDB 10) : ajuste le modificateur de bande de portée (Longue → 0, Extrême → ÷2). */
export function sniperRangeAdjust(c: Combatant, mod: number): number {
  if (mod >= 0 || !featuresOf(c).some(({ def }) => def.sniper)) return mod;
  if (mod === -10) return 0; // Longue distance : aucune pénalité
  return Math.ceil(mod / 2); // Portée extrême : moitié des pénalités (−30 → −15)
}

/** Combat instinctif (LDB 10) : +10 × niveau à l'Initiative de combat. */
export function talentInitiativeBonus(c: Combatant): number {
  return 10 * levelSum(c, (d) => !!d.initiativeBonus);
}

/** Tir rapide (LDB 10) : pré-emption d'initiative gratuite avec une arme à distance CHARGÉE. */
export function canPreemptRanged(c: Combatant): boolean {
  if (!featuresOf(c).some(({ def }) => def.strikeFirstRanged)) return false;
  return c.weapons.some((w) => w.type === 'ranged' && weaponLoaded(c, w));
}

/** Vigilance (LDB 10) : peut tester Perception (+0) pour ignorer la Surprise. */
export function hasSurpriseSave(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.surpriseSave);
}

/** Rechargement rapide (toutes armes) / Artilleur (Poudre noire) : +DR au Test de rechargement. LDB 10. */
export function reloadDRBonus(c: Combatant, weapon: Weapon | undefined): number {
  const g = weapon?.subType ?? ''; // id de Groupe (poudre-noire / ingenierie / poudre-noire-et-ingenierie)
  const blackpowder = g === 'poudre-noire' || g === 'ingenierie' || g === 'poudre-noire-et-ingenierie';
  return levelSum(c, (d) => d.reloadDR === 'all' || (d.reloadDR === 'blackpowder' && blackpowder));
}

/** Sprinter / Fuite ! (LDB 10) : +1 Mouvement en Course / en Fuite. */
export function runMovementBonus(c: Combatant): number {
  return featuresOf(c).some(({ def }) => def.runBonus) ? 1 : 0;
}
export function fleeMovementBonus(c: Combatant): number {
  return featuresOf(c).some(({ def }) => def.fleeBonus) ? 1 : 0;
}

/** Fuite ! variante AA 13 l.68 : +1 Mouvement pour la Cible d'une Poursuite (0 sans la capacité).
 *  Présent uniquement en mode « Avantage de groupe » (porté par la variante réglée de `talents.json`,
 *  résolue par `effectiveEntry`) — GÉNÉRIQUE : tout talent déclarant `pursuitTargetBonus`. */
export function pursuitTargetMovementBonus(c: Combatant): number {
  return featuresOf(c).some(({ def }) => def.pursuitTargetBonus) ? 1 : 0;
}

/** Porte-bouclier (LDB 10 l.972). Bouclier = `isShieldItem`. */
export function shieldAdvantageLevel(c: Combatant, parryWeapon: Weapon | undefined): number {
  if (!parryWeapon || !isShieldItem(parryWeapon)) return 0;
  return levelSum(c, (d) => !!d.shieldAdvantage);
}

/** Réaction défensive à coût d'Avantages de réserve (Porte-Bouclier variante AA 13 l.84) : coût en
 *  Avantages (0 = capacité absente) de la réaction offerte quand on se défend au Bouclier. Bouclier requis
 *  (`isShieldItem`). GÉNÉRIQUE — tout talent déclarant `advantageDefenseReaction`.
 *  Présent uniquement en mode « Avantage de groupe » (porté par la variante réglée, résolue par
 *  `effectiveEntry`, `src/engine/variants.ts`). */
export function shieldReactionCost(c: Combatant, parryWeapon: Weapon | undefined): number {
  if (!parryWeapon || !isShieldItem(parryWeapon)) return 0;
  for (const { def } of featuresOf(c)) if (def.advantageDefenseReaction) return def.advantageDefenseReaction.avantage;
  return 0;
}

/** Contre-attaque sur Test opposé de DÉFENSE gagné en mêlée — lue en DONNÉES, traits ET talents
 *  confondus (capacité GÉNÉRIQUE `counterOnDefenseWin`). Champion (LDB 85) : sans condition d'arme.
 *  Riposte (LDB 10) : exige une arme de PARADE Rapide (`counterRequiresFastParry`). */
export function canCounterOnDefenseWin(c: Combatant, parryWeapon: Weapon | undefined): boolean {
  const fast = canStrikeFirst(parryWeapon ? [parryWeapon] : []);
  for (const t of c.traits ?? []) {
    const cap = findTraitById(t.id)?.capabilities;
    if (cap?.counterOnDefenseWin && (!cap.counterRequiresFastParry || fast)) return true;
  }
  for (const { def } of featuresOf(c)) {
    if (def.counterOnDefenseWin && (!def.counterRequiresFastParry || fast)) return true;
  }
  return false;
}

/** Renversement (LDB 10) : vole TOUS les Avantages adverses au lieu de +1 sur un opposé gagné. */
export function hasStealAdvantage(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.stealAdvantage);
}

/** Frappe blessante — variante « Nouveaux talents et talents mis à jour » (AA 13 l.57) : porte-t-il la
 *  capacité PERMANENTE « deux lancers, garde le préféré » sur le tableau de Blessures Critiques ? Même
 *  drapeau conceptuel que `hasActiveFlag(c, 'critRollTwice')` (Bénédiction de Sauvagerie, LDB 41,
 *  temporaire) — les deux sources s'ORent au point de résolution du Critique (`combatFlow.ts`). */
export function hasCritRollTwiceTalent(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.critRollTwice);
}

/** Maîtrise du combat (LDB 10) : compte pour 1+niveau personnes au calcul du surnombre. */
export function outnumberCountBonus(c: Combatant): number {
  return levelSum(c, (d) => !!d.outnumberCount);
}

/** Renversement — variante « Avantage de groupe » (AA 13 l.92-98) : prend 1 Avantage dans la réserve adverse
 *  (au lieu de tout l'Avantage individuel via `stealAdvantage`, lecture LDB). */
export function stealsOneAdvantage(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.stealOne);
}

/** Poids d'un combattant au décompte de domination de fin de Round (AA 11 l.44) : 1, ou 2 pour un porteur
 *  de Coude-à-coude en mode « Avantage de groupe » (l.4387, « compte comme deux combattants »). */
export function advantageTransferWeight(c: Combatant): number {
  return featuresOf(c).reduce((m, { def }) => Math.max(m, def.transferWeight ?? 1), 1);
}

/** Artilleur / Rechargement rapide — variante AA (l.4353/4434) : recharger compte comme une Action
 *  Évaluer → +1 Avantage supplémentaire au rechargement. Lu par le flux de rechargement (mode groupe). */
export function reloadGrantsAssessAdvantage(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.reloadAssessAdvantage);
}

/** Cavalier émérite — variante AA (l.4369) : Taille considérée = celle de la monture contre la Peur/
 *  Terreur causée UNIQUEMENT par la Taille de l'adversaire. Lu par la résolution de peur montée. */
export function fearSizeAsMount(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.fearSizeAsMount);
}

/** Coût d'Avantage d'une Retraite stratégique (Désengagement, mode groupe AA 11 l.37 : 2 Avantages) pour
 *  `c` : abaissé au `retreatCost` déclaré par un Talent (Impitoyable AA 13 l.74 → 1). Défaut 2. Lu par le
 *  Désengagement en mode « Avantage de groupe ». */
export function retreatAdvantageCost(c: Combatant): number {
  return featuresOf(c).reduce((m, { def }) => (def.retreatCost != null ? Math.min(m, def.retreatCost) : m), 2);
}

/** Impitoyable (LDB 10 l.591) : au Désengagement « Sacrifier l'Avantage », le porteur GARDE niveau
 *  Avantages au lieu de tomber à 0 (0 si le talent est absent). Mode Livre de base uniquement. */
export function keptAdvantageOnDisengage(c: Combatant): number {
  return levelSum(c, (d) => !!d.keepAdvantageOnDisengage);
}

/** Impitoyable (LDB 10 l.591) : le porteur peut se Désengager en Sacrifiant l'Avantage même sans être
 *  strictement supérieur en Avantage à ses adversaires (Mode Livre de base). */
export function canDisengageWithLessAdvantage(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.disengageWithLessAdvantage);
}

/** Battement — variante AA (l.4361) : le combattant porte le Talent qui l'autorise à déclarer une manœuvre
 *  de Battement (Action, Test de Corps à corps NON opposé retirant de l'Avantage à la réserve adverse). */
export function hasBattement(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.battement);
}

/** Distraire (LDB 10 / AA 13 l.51) : le combattant porte le Talent qui l'autorise à déclarer une manœuvre de
 *  Distraction (Mouvement, Test opposé Athlétisme/Calme empêchant la cible de gagner de l'Avantage). */
export function hasDistraire(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.distraire);
}

/** Cœur vaillant (LDB 10) : récupération du Brisé même Engagé. */
export function hasBraveheart(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.braveheart);
}

/** Endurci (LDB 10) : PB d'Hémorragique ignorés (niveau). */
export function bleedIgnoreLevel(c: Combatant): number {
  return levelSum(c, (d) => !!d.bleedIgnore);
}

/** Niveau GÉNÉRIQUE d'une capacité de combat booléenne, par clé (somme des niveaux des talents qui la
 *  portent). Permet à la DONNÉE (un État qui déclare `stacksReducedBy: '<clé>'`) de lire une capacité
 *  sans la coder en dur — ex. Hémorragique réduit par Endurci (`bleedIgnore`). */
export function featureLevel(c: Combatant, key: keyof CombatFeature): number {
  return levelSum(c, (d) => !!d[key]);
}

/** Agrège les capacités de combat BOOLÉENNES de `c` en `Record<clé, niveau>` (somme des niveaux des
 *  features qui portent le drapeau) — vue éditable lue par la Condition `capability` (Cœur vaillant
 *  `braveheart`…). Champs non-booléens (offHandPenalty/reloadDR/attackModes) ignorés. */
export function aggregateCapabilities(c: Combatant): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { def, ctx } of featuresOf(c))
    for (const [k, v] of Object.entries(def)) if (v === true) out[k] = (out[k] ?? 0) + ctx.level;
  return out;
}

/** Harmonisation aethyrique (LDB 10) : pas d'Imparfaite sur un double RÉUSSI de Focalisation. */
export function hasFocusHarmony(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.focusNoMiscastOnDouble);
}

/** Diction instinctive (LDB 10) : pas d'Imparfaite sur un double RÉUSSI de Langue (Magick). */
export function hasInstinctiveDiction(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.castNoMiscastOnDouble);
}

/** Effrayant (LDB 10) : Indice de Peur du porteur (niveau), 0 sinon. */
export function talentFearIndice(c: Combatant): number {
  return levelSum(c, (d) => !!d.causesFear);
}

/** Négociateur (LDB 59 l.43) : un Marchandage gagné réduit le prix de 20 % même sans Succès
 *  Stupéfiant. Lu par merchantFlow à la conclusion. */
export function hasBargainBonus(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.bargainBonus);
}

/** Inversion d'un Test RATÉ de la Compétence `{ skill, spec }` (Sociable → Ragot, Pharmacologie →
 *  Métier (Apothicaire)…) : renvoie le plafond de DR éventuel (`capDR`), `null` si aucun talent ne
 *  s'applique. Réf STRUCTURÉE par id. LDB 10. */
export function talentReverseFailed(c: Combatant, q: { skill?: string; spec?: string }): { capDR?: number } | null {
  if (!q.skill) return null;
  for (const { def } of featuresOf(c)) {
    const rf = def.reverseFailed;
    if (!rf) continue;
    if (rf.skills.some((s) => s.id === q.skill && (s.spec == null || s.spec === q.spec))) return { capDR: rf.capDR };
  }
  return null;
}

/** Costaud (LDB 10) : limite d'Encombrement +2 × niveau. Remplace le check `talentId === 'costaud'`. */
export function talentEncumbranceBonus(c: Combatant): number {
  return 2 * levelSum(c, (d) => !!d.encumbranceBonus);
}

/** Cœur PUR de `traitEncumbranceFactor` — le plus grand `encumbranceFactor` porté l'emporte (JAMAIS
 *  cumulatif : une seule Taille de capacité à la fois). Exporté pour un test direct sans dépendance au
 *  catalogue de traits. */
export function maxEncumbranceFactor(capabilities: { encumbranceFactor?: number }[]): number {
  return capabilities.reduce((f, d) => (d.encumbranceFactor ? Math.max(f, d.encumbranceFactor) : f), 1);
}

/** Encombrement portable ×N (ADE II 2 l.708, folio 31) : facteur MULTIPLICATIF sur (Bonus de Force +
 *  Bonus d'Endurance), porté par le Trait RACIAL (`capabilities.encumbranceFactor`, Ogre) — composé par
 *  `items.maxEncumbrance`. 1 = aucune capacité de ce type (aucun effet sur `maxEncumbrance`). */
export function traitEncumbranceFactor(c: Combatant): number {
  return maxEncumbranceFactor((c.traits ?? []).map((t) => ({ encumbranceFactor: findTraitById(t.id)?.capabilities?.encumbranceFactor })));
}

/** Âme pure (LDB 10) : seuil de Corruption relevé de niveau. Remplace le check `talentId === 'ame-pure'`. */
export function talentCorruptionThreshold(c: Combatant): number {
  return levelSum(c, (d) => !!d.corruptionThreshold);
}

/** Chirurgie (LDB 10) : le combattant peut opérer (mode de soin chirurgical). Remplace `talentId === 'chirurgie'`. */
export function hasSurgery(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.surgery);
}

/** Commandant d'équipe (AA 13 l.29-35) : le combattant porte le Talent qui l'autorise à diriger une
 *  équipe d'artillerie (Arme d'équipe) à portée de voix. Lu par l'affordance + la substitution de score. */
export function hasCommandTeam(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.commandTeam);
}

/** Chansons de marin CONNUES du combattant (MDG 09 l.36 : « Chaque fois qu'un Personnage achète un
 *  nouveau niveau dans ce Talent, il apprend une nouvelle chanson ») — les SPECS de ses acquisitions du
 *  Talent à `seaShanty` (ids de `sea-shanties.json`, résolus en `SeaShantyData` par `findSeaShantyById`). */
export function knownShanties(c: Combatant): string[] {
  const out: string[] = [];
  for (const { def, ctx } of featuresOf(c)) if (def.seaShanty && ctx.spec) out.push(ctx.spec);
  return out;
}
