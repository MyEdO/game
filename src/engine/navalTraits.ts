/**
 * EFFETS des **Traits & Améliorations** de navire (MDG 12) — couche PURE. Distinction RAW (ch.12 l.81,169) :
 * les **Traits** sont intégrés à la construction (fixes, `ship.traits` du type), les **Améliorations**
 * s'ajoutent/retirent plus tard (par INSTANCE, `Combatant.upgrades`). L'appelant (state) concatène les deux ;
 * ce module ne lit que des **réfs par id** (`NavalTraitRef` = `{ id, value? }`, JAMAIS un libellé) — l'Indice
 * d'un Trait `ranked` vit dans `value` (plus aucun parsing de chaîne au runtime).
 *
 * EFFET = `GameOp[]`, langue UNIQUE (pas de champ ad hoc) : l'effet mécanisé vit dans le `passive` des
 * entrées de `src/data/naval-traits.json` (éditable au Codex via le `GameOpEditor` EXISTANT) — `ap` pour
 * Blindage, `moveMod` pour Lissage, `skillDRBonus` pour Peu maniable : le MÊME vocabulaire que les passifs de
 * trait/mutation. Seul le PORTEUR diffère (réf de coque vs `TraitInstance` du Combattant) → un collecteur
 * naval `navalPassiveOps` (calqué sur `passiveMods` : UN aplatissement + filtres minces), aucun système
 * parallèle. Restent en CHAMP DE DOMAINE les sous-systèmes navire hors vocabulaire combattant : `ram` (Bélier,
 * géométrie de collision) et `deckCover` (Sabord, couvert des postes). Ce module ne fait qu'EXPOSER ces effets
 * là où une brique EXISTANTE les consomme (spawn → PA de coque ; manœuvre → M/DR ; collision → Bélier ; tir → Sabord).
 *
 * Anti-double-compte : les colonnes E/B des navires NOMMÉS de `vehicles.json` sont DÉJÀ finales (elles
 * intègrent Renforcé/Solide) → ces Traits-là n'ont PAS de `passive` (desc seule). Man et « Peu maniable » sont
 * en revanche des colonnes DISTINCTES → Peu maniable porte bien son `skillDRBonus` (Voile/Ramer).
 */
import { findNavalTrait, findVehicleById } from '../data';
import type { GameOp } from './ops';
import type { Combatant, CoverClass, DeckCoverClass, NavalTraitRef } from './types';
import { couvertLePlusProtecteur } from './cover';

/** Indice (niveau) du Trait naval `id` dans une liste de réfs : `value` de la réf (défaut 1 si présent sans
 *  Indice explicite), absent → 0. PUR. Source UNIQUE de lecture de l'Indice (jamais un parsing de libellé). */
export function navalTraitLevel(traits: NavalTraitRef[] | undefined, id: string): number {
  const ref = (traits ?? []).find((t) => t.id === id);
  return ref ? ref.value ?? 1 : 0;
}

/**
 * FOYER UNIQUE de la concaténation « Traits du TYPE puis Améliorations de l'INSTANCE » que MDG 12
 * l.81/169 distingue (« intégrés à la construction » vs « ajoutées plus tard »). L'ORDRE est porteur :
 * `navalTraitLevel` rend la PREMIÈRE réf trouvée, donc le Trait du type prime sur une Amélioration
 * de même id. Les deux porteurs du repo se réduisent au même couple (id de véhicule, améliorations)
 * et n'ont chacun qu'un ADAPTATEUR ci-dessous — aucun site ne réécrit ce spread. PUR.
 */
export function navalTraitsDe(vehicleId: string | undefined, upgrades: NavalTraitRef[] | undefined): NavalTraitRef[] {
  return [...(findVehicleById(vehicleId ?? '')?.ship?.traits ?? []), ...(upgrades ?? [])];
}

/** Réfs navales EFFECTIVES d'une COQUE en jeu (`Combatant` : combat, manœuvre, Critiques, spawn). PUR. */
export function hullNavalTraits(hull: Combatant): NavalTraitRef[] {
  return navalTraitsDe(hull.creatureId, hull.upgrades);
}

/** Réfs navales EFFECTIVES du NAVIRE DE CAMPAGNE persisté (`CampaignVessel` : voyage, port, carte).
 *  Typé STRUCTURELLEMENT — ce module PUR ne connaît pas l'état de l'hôte. PUR. */
export function vesselNavalTraits(vessel: { vehicleId: string; upgrades?: NavalTraitRef[] } | null | undefined): NavalTraitRef[] {
  return vessel ? navalTraitsDe(vessel.vehicleId, vessel.upgrades) : [];
}

/** Une coque possède-t-elle ce Trait/Amélioration naval ? (présence de l'id, tout Indice ≥ 1). PUR. */
export function shipHasNavalTrait(traits: NavalTraitRef[] | undefined, id: string): boolean {
  return (traits ?? []).some((t) => t.id === id);
}

/** COLLECTEUR UNIQUE des `GameOp` PASSIFS d'une liste de réfs navales (Traits du type + Améliorations
 *  d'instance), chaque op répété ×Indice pour un Trait `ranked` (« Renforcé 2 » → bloc `passive` ×2). PUR.
 *  Même FORME que `passiveMods` (un aplatissement → filtres minces) ; vocabulaire `GameOp` PARTAGÉ avec les
 *  passifs de trait/mutation — seul le porteur (réf de coque vs `TraitInstance`) diffère. Les helpers
 *  ci-dessous projettent l'op qui les concerne ; aucun ne ré-itère le catalogue. */
export function navalPassiveOps(traits: NavalTraitRef[] | undefined): GameOp[] {
  const out: GameOp[] = [];
  for (const ref of traits ?? []) {
    const e = findNavalTrait(ref.id);
    if (!e?.passive?.length) continue;
    const level = e.ranked ? ref.value ?? 1 : 1;
    for (let i = 0; i < level; i++) out.push(...e.passive);
  }
  return out;
}

/** PA de coque conférés par l'Amélioration **Blindage** — op `ap` sur la Coque (MÊME op que l'armure naturelle
 *  d'une mutation ; MDG 12 l.234/236 : bronze 1 / fer 2). Sommé puis baké sur `armour.corps` au spawn,
 *  mitigé par les dégâts navals. PUR. */
export function hullArmourBonus(traits: NavalTraitRef[] | undefined): number {
  return navalPassiveOps(traits).reduce(
    (n, op) => (op.op === 'ap' && (op.loc === 'corps' || op.loc == null) && typeof op.amount === 'number' ? n + op.amount : n),
    0,
  );
}

/** Bonus de Mouvement conféré par l'Amélioration **Lissage** — op `moveMod` (MÊME op qu'une mutation ;
 *  MDG 12 l.293 : M +1). Ajouté au M de base dans la manœuvre. PUR. */
export function navalMoveMod(traits: NavalTraitRef[] | undefined): number {
  return navalPassiveOps(traits).reduce((n, op) => (op.op === 'moveMod' ? n + op.mod : n), 0);
}

/** Facteur MULTIPLICATIF du Mouvement — op `moveScale` (MÊME op que la séquelle/sort ; MSRC 12 l.27 :
 *  **Coque de course** « une rapidité équivalente à deux fois sa vitesse de Mouvement normale » → 2/1). Produit
 *  de tous les `moveScale` collectés (défaut neutre 1/1). Appliqué APRÈS les `moveMod` (ordre canonique
 *  d'`effectiveMovement`, ops.ts l.745) là où le M de manœuvre se calcule (`shipManeuverParams`). PUR. */
export function navalMoveMult(traits: NavalTraitRef[] | undefined): { num: number; den: number } {
  let num = 1, den = 1;
  for (const op of navalPassiveOps(traits)) if (op.op === 'moveScale') { num *= op.num; den *= op.den; }
  return { num, den };
}

/** Bonus de DR (négatif = malus) à un Test de Compétence `skillId` conféré par le Trait **Peu maniable** & co —
 *  op `skillDRBonus` (MÊME op qu'un Trait de personnage ; MDG 12 l.173 : −1 DR/niveau aux Tests de
 *  Voile/Ramer). Lu par la manœuvre comme `extraDR` du Test de Navigation. Ne matche QUE les ops portant un
 *  `skill` (une op `testType`-only, #221, n'a pas de `skill` → exclue naturellement). PUR. */
export function navalSkillTestDR(traits: NavalTraitRef[] | undefined, skillId: string): number {
  return navalPassiveOps(traits).reduce(
    (n, op) => (op.op === 'skillDRBonus' && op.skill?.id === skillId && typeof op.bonus === 'number' ? n + op.bonus : n),
    0,
  );
}

/** Bonus de DR (négatif = malus) à un TYPE de Test d'équipage `testTypeId` (`crew-test-types.json`, #221) —
 *  MÊME op `skillDRBonus`, ciblage agnostique de la compétence (une Poursuite se court à la Voile OU aux
 *  avirons). Ne matche QUE les ops portant un `testType` correspondant. PUR. */
export function navalTestTypeDR(traits: NavalTraitRef[] | undefined, testTypeId: string): number {
  return navalPassiveOps(traits).reduce(
    (n, op) => (op.op === 'skillDRBonus' && op.testType?.id === testTypeId && typeof op.bonus === 'number' ? n + op.bonus : n),
    0,
  );
}

/** Bonus de collision du **Bélier** (MDG 12 l.221 ; valeurs en donnée) : `ic` ajouté à l'Indice de Collision
 *  quand le porteur éperonne de sa proue, `ap` = PA frontaux. Champ de DOMAINE `ram` (sous-système collision,
 *  hors vocabulaire combattant) injecté dans `resolveCollision` par l'appelant. PUR — premier porteur trouvé
 *  (un navire ne porte qu'un Bélier). */
export function belierRam(traits: NavalTraitRef[] | undefined): { ic: number; ap: number } {
  for (const ref of traits ?? []) {
    const ram = findNavalTrait(ref.id)?.ram;
    if (ram) return { ic: ram.ic, ap: ram.ap };
  }
  return { ic: 0, ap: 0 };
}

/** Modificateur BRUT (points de %) au Test de Navigation POUR DIRIGER le bateau, sommé sur les Traits +
 *  Améliorations (MSRC 12 l.66 : Bouteur +20 ; l.140 : Gréement de course −10). Champ de DOMAINE `navTestMod`
 *  (le +20/−10 vise le Test lui-même, hors vocabulaire combattant `skillDRBonus`). PUR. */
export function navalNavTestMod(traits: NavalTraitRef[] | undefined): number {
  return (traits ?? []).reduce((n, ref) => n + (findNavalTrait(ref.id)?.navTestMod ?? 0), 0);
}

/** Le même modificateur CONVERTI en DR de Test d'équipage de manœuvre (MDG 14) : le Test de Navigation pour
 *  diriger est remplacé par le Test d'équipage dont le total est en DR ; LDB (jets) 10 points = 1 DR → ÷10.
 *  Consommé UNE FOIS par `shipManeuverParams` (manœuvre tactique) et le Test d'équipage de manœuvre de voyage. PUR. */
export function navalNavTestDR(traits: NavalTraitRef[] | undefined): number {
  return Math.trunc(navalNavTestMod(traits) / 10);
}

/** COUVERT de pont conféré par les Traits/Améliorations d'une coque — champ de domaine `deckCover` GRADUÉ
 *  (`DeckCoverClass`, migré du booléen) : **Sabord** et **Murs blindés** = `totale` (MDG 12 l.364 / MSRC 12
 *  l.85), **Plat-bord** = `moyenne` (MSRC 12 l.111, « couverture moyenne … tirs Difficiles »). Retourne le
 *  MEILLEUR couvert offert (`none` si aucun). DATA-DRIVEN (pas de nom littéral codé). PUR. */
export function navalDeckCover(traits: NavalTraitRef[] | undefined): DeckCoverClass | 'none' {
  let best: DeckCoverClass | 'none' = 'none';
  for (const ref of traits ?? []) {
    const dc = findNavalTrait(ref.id)?.deckCover;
    if (dc) best = couvertLePlusProtecteur(best, dc);
  }
  return best;
}

/** Couvert du servant d'un poste : le plus protecteur entre celui du poste (gun-port authoré) et celui des
 *  Améliorations de sa coque (`navalDeckCover`). MDG 12 l.362-364 ; MSRC 12 l.85,111. PUR. */
export function couvertDuPoste(hull: Combatant, poste: { cover?: DeckCoverClass }): CoverClass {
  return couvertLePlusProtecteur(poste.cover ?? 'none', navalDeckCover(hullNavalTraits(hull)));
}
