/**
 * Renommage `name` → `label` des porteurs de LIBELLÉ sérialisés (#604) — `Combatant`, `ItemInstance`
 * et `Weapon` (`engine/types.ts`), et les porteurs recensés plus bas. Ces champs sont un libellé
 * d'AFFICHAGE : le vocabulaire du dépôt est `label` partout (arbitrage 2026-07-19).
 *
 * SEUL consommateur : le ROSTER (`roster.ts`) — repli idempotent de `rosterLoad` (liste nue, non
 * versionnée) et `ROSTER_MIGRATIONS[2]` de l'export `EXPORT_VERSION`. Même primitive que
 * `remapCharKeysDeep` (`charKeyMigration.ts`, #311) : réécriture récursive d'un document déjà cloné.
 *
 * Le remap est borné par la FORME, pas par un chemin : un `name` n'est réécrit que sur un objet
 * reconnu comme porteur. Tous les autres `name` sont laissés INTACTS — notamment ceux qui portent un
 * **id** et le champ `name` des `GameOp` authorés, hors du périmètre de ce renommage.
 */

/** Un `GameOp` sérialisé (clé `op`) n'est JAMAIS un porteur de libellé — garde-fou commun aux 3 formes. */
function isGameOp(o: Record<string, unknown>): boolean {
  return typeof o.op === 'string';
}

/** `Weapon` : discriminant `type` melee/ranged + `damage` STRUCTURÉ (`WeaponDamageSpec`, un objet). */
function isWeaponLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && (o.type === 'melee' || o.type === 'ranged')
    && !!o.damage && typeof o.damage === 'object';
}

/** `ItemInstance` : `uid` + `kind` (`ItemKind`) — l'`uid` est posé à la création de toute instance. */
function isItemLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.uid === 'string' && typeof o.kind === 'string';
}

/** `Combatant` : `id` + `kind` dans le trio de camps (`hero`/`enemy`/`npc`). Couvre AUSSI
 *  `ScheduledRespawn.caster` (#608 Lot 6, `{id,name,kind,pos}` — même trio de camps, aucun bearer dédié
 *  requis). */
function isCombatantLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.id === 'string'
    && (o.kind === 'hero' || o.kind === 'enemy' || o.kind === 'npc');
}

/** `CampaignVessel` (#608 Lot 6) : `vehicleId` + `morale` STRUCTURÉ (objet — distingue du `SceneOp`
 *  d'auteur `setVessel`/`adjustVessel` dont `morale?` reste un nombre plat, jamais renommé). */
function isVesselLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.vehicleId === 'string' && !!o.morale && typeof o.morale === 'object';
}

/** `CustomStatblock` (#608 Lot 6, `state/scene.ts`) : `char` STRUCTURÉ (objet de Caractéristiques) —
 *  aucun autre porteur de ce dépôt ne porte ce champ. */
function isStatblockLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && !!o.char && typeof o.char === 'object' && !Array.isArray(o.char);
}

/** `MedicNpc` (#608 Lot 6, `state/medicFlow.ts`) : `skill`+`intBonus` numériques + `acts` tableau —
 *  soigneur PNJ tarifé de l'infirmerie. */
function isMedicNpcLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.skill === 'number' && typeof o.intBonus === 'number' && Array.isArray(o.acts);
}

/** `MassBattleArmy` (#608 Lot 6, `state/massBattleFlow.ts`) : `combatant` STRUCTURÉ (le Combattant
 *  inanimé porteur de Puissance, `{label, combatant}`). */
function isArmyLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && !!o.combatant && typeof o.combatant === 'object';
}

/** `PendingVictory.defeated[]` (#608 Lot 6, `state/pendings.ts`) : `count` numérique, jamais d'`id` —
 *  regroupement PAR nom/identité bestiaire de l'écran de victoire. */
function isDefeatedLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.count === 'number' && !('id' in o);
}

/** `PendingTest.candidates[]` (#608 Lot 6, `state/pendings.ts`) : `id`+`value`+`target` numériques —
 *  candidat de Test hors combat (le joueur choisit qui lance). */
function isCandidateLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.id === 'string' && typeof o.value === 'number' && typeof o.target === 'number';
}

/** `pendingCampaign` (#608 Lot B, `state/store.ts`) : `scenes` TABLEAU + `startSceneId` STRING — le
 *  couple exact du champ persisté (`BuiltinCampaign`/`SavedProject`, qui portent la MÊME forme, sont
 *  déjà en `label` — aucune collision). */
function isPendingCampaignLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && Array.isArray(o.scenes) && typeof o.startSceneId === 'string';
}

/** `SceneOp` `setVessel`/`adjustVessel` (#608 Lot B, `state/scene.ts`) : discriminant `type` EXACT —
 *  aucun autre porteur de ce dépôt ne porte ce `type` (le `GameOp` équivalent utilise `op`, jamais
 *  `type`). La scène VIVANTE (mutée, `state.scene`) voyage dans la save — un dialogue/trigger encore
 *  non déclenché au moment de la sauvegarde y garde son effet d'auteur intact. */
function isSceneVesselOpLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && (o.type === 'setVessel' || o.type === 'adjustVessel');
}

/** Réécrit récursivement `{ name, … }` → `{ label, … }` sur les seuls porteurs de libellé.
 *  IDEMPOTENT : un objet portant déjà `label` est laissé tel quel (un 2e passage est un no-op), et un
 *  objet portant les DEUX garde son `label` (la clé déjà migrée fait foi). */
export function remapNameToLabelDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapNameToLabelDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  const bearer = isWeaponLike(o) || isItemLike(o) || isCombatantLike(o)
    || isVesselLike(o) || isStatblockLike(o) || isMedicNpcLike(o) || isArmyLike(o)
    || isDefeatedLike(o) || isCandidateLike(o) || isSceneVesselOpLike(o)
    || isPendingCampaignLike(o);
  if (bearer && typeof o.name === 'string' && !('label' in o)) {
    const { name, ...rest } = o;
    return Object.fromEntries(
      Object.entries({ label: name, ...rest }).map(([k, v]) => [k, remapNameToLabelDeep(v)]),
    );
  }
  if (bearer && o.label !== undefined && 'name' in o) {
    const { name: _drop, ...rest } = o;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, remapNameToLabelDeep(v)]));
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remapNameToLabelDeep(v)]));
}
