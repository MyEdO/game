/**
 * Invocation de créatures en combat (champ `SpellSpec.summon`) — Nécromancie (« Réanimation »,
 * « Relever les morts »), Ulric (« Hurlement du loup »), Démonologie (« Manifestation de Démon
 * mineur »), Chaos (« Déchirer l'Aethyr »)…
 *
 * La créature est tirée du bestiaire (`spawnEnemy`), placée sur une case libre près du lanceur,
 * insérée dans l'initiative (juste après le lanceur) et marquée `Combatant.summon`. Elle combat
 * dans le camp du lanceur (`allyOfCaster`, par défaut) — donc CONTRÔLÉE comme un membre du groupe
 * si le lanceur est un héros (`kind: 'hero'`), ou pilotée par l'IA s'il est un ennemi — ou bien
 * HOSTILE (`allyOfCaster: false` — démons « pas sous votre contrôle »). Elle se dissipe au
 * franchissement de Round une fois sa durée écoulée, ou si le lanceur tombe (`despawnIfCasterDown`,
 * minions morts-vivants liés au sorcier). Hors combat : pas de grille → effet journalisé.
 */
import type { Combatant } from '../engine/types';
import type { PorteurDeFiche } from '../engine/statblock';
import type { BattleState } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import { Pt, tileKey } from './path';
import { Scene, isWalkable } from './scene';
import { occupied } from './combatGeometry';
import { inBattleId } from './combatants';
import { spawnEnemy } from './spawn';
import { grantTrait } from '../engine/grantedTraits';
import { resolveFormula, slBonus, nomDeSource, type GameOp } from '../engine/ops';
import { isOutOfAction } from '../engine/conditions';
import { RNG, defaultRNG } from '../engine/dice';
import { t } from '../i18n';
import { chebyshev } from '../engine/grid';

/** Descripteur d'invocation = la charge utile de l'op `summon` du Flow (donnée éditable du sort) ;
 *  le discriminant `op` est superflu pour cette fonction dédiée → l'op complète s'assigne quand même. */
type Summon = Omit<Extract<GameOp, { op: 'summon' }>, 'op'>;
/** Ce qu'`applySummon` invoque : l'op `summon` (réf. du bestiaire), ou la fiche d'un défunt qui se
 *  reconstitue (`ScheduledRespawn`, #1882). */
export type Invocation = Summon | (Omit<Summon, 'ref'> & { porteur: PorteurDeFiche });

/** Cases walkable et LIBRES (toute empreinte exclue) autour de `center`, en anneaux croissants (≤8),
 *  sur l'ÉTAGE de `center` (z-aware, #802) : un lanceur posé sur un chemin de ronde `z>0` invoque sur
 *  SON étage, jamais au sol en contrebas. */
function freeTilesNear(scene: Scene, battle: BattleState, center: Pt, n: number): Pt[] {
  const blocked = occupied(battle, '__summon-placement__'); // un id ⇒ toutes les empreintes bloquent
  const z = center.z ?? 0;
  const out: Pt[] = [];
  for (let r = 1; r <= 8 && out.length < n; r++)
    for (let dy = -r; dy <= r && out.length < n; dy++)
      for (let dx = -r; dx <= r && out.length < n; dx++) {
        const x = center.x + dx, y = center.y + dy;
        if (chebyshev({ x, y }, center) !== r) continue; // seulement l'anneau de rayon r
        if (isWalkable(scene, x, y, z) && !blocked.has(tileKey(x, y, z))) out.push(z ? { x, y, z } : { x, y });
      }
  return out;
}

function insertAfter(order: string[], afterId: string, id: string): void {
  const i = order.indexOf(afterId);
  if (i >= 0) order.splice(i + 1, 0, id);
  else order.push(id); // lanceur absent de l'ordre (rare) → la créature agit en fin de Round
}

export interface SummonOpts {
  /** DR du jet (échelle `countPerSL`). */
  sl?: number;
  /** Durée du Sort en Rounds (null = pas d'expiration par Round — « Jusqu'à l'aube », etc.). */
  rounds?: number | null;
  /** Libellé du Sort (journal de dissipation). */
  label?: string;
  rng?: RNG;
  /** Id du sort source (absent pour un death-spawn de trait). */
  spellId?: string;
}

/**
 * Invoque la/les créature(s) de `summon` près du lanceur. Mute la bataille (combatants + ordre),
 * renvoie le journal. Hors combat : journalisé (rien posé sur la grille).
 */
export function applySummon(get: Get, set: SetFn, caster: Combatant, summon: Invocation, opts: SummonOpts = {}): string[] {
  const porteur: PorteurDeFiche = 'porteur' in summon ? summon.porteur : { ref: summon.ref };
  const invoque = 'porteur' in summon ? caster.label : summon.ref;
  const rng = opts.rng ?? defaultRNG;
  const count = Math.max(1, resolveFormula(summon.count, caster, rng) + slBonus(opts.sl, summon.countPerSL));
  const battle = get().battle;
  const scene = get().scene;
  const hostile = summon.allyOfCaster === false;
  if (!battle || !scene || !caster.pos) {
    return [`${caster.label} invoque ${count} × ${invoque}${hostile ? ' (hostile)' : ''} — hors combat, effet narratif (arbitrage MJ).`];
  }
  // Camp : allié = même `kind` que le lanceur (contrôlé/IA selon son camp) ; hostile = camp opposé.
  const kind: Combatant['kind'] = hostile ? (caster.kind === 'hero' ? 'enemy' : 'hero') : caster.kind;
  const tiles = freeTilesNear(scene, battle, caster.pos, count);
  // `baseOrder` (ordre canonique restauré à chaque Round) peut être LE MÊME tableau que `order` en
  // début de combat : il faut le dédoubler, sinon les deux `insertAfter` ci-dessous frapperaient le
  // même tableau et l'id serait inséré DEUX fois (doublon dans l'initiative → clés React en double).
  if (!battle.baseOrder || battle.baseOrder === battle.order) battle.baseOrder = [...battle.order];
  const placed: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const pos = tiles[i];
    if (!pos) break; // plus de place libre à proximité
    const id = `summon-${caster.id}-${battle.round}-${battle.combatants.length}-${i}`;
    const c = spawnEnemy(porteur, id, pos);
    c.kind = kind;
    if (summon.size) c.size = summon.size;
    for (const t of summon.addTraits ?? []) grantTrait(c, t); // traits surchargés (Frénésie, Magique…) — déjà structurés
    c.summon = {
      byId: caster.id,
      ...(opts.label ? { label: opts.label } : {}),
      ...(opts.rounds != null ? { expiresAtRound: battle.round + opts.rounds } : {}),
      ...(summon.despawnIfCasterDown ? { despawnIfSummonerDown: true } : {}),
      ...(opts.spellId ? { spellId: opts.spellId } : {}),
    };
    battle.combatants.push(c);
    insertAfter(battle.baseOrder, caster.id, id);
    insertAfter(battle.order, caster.id, id);
    placed.push(c);
  }
  set({ battle: { ...battle } });
  if (!placed.length) return [t('summon.noRoom', { name: caster.label, ref: invoque })];
  const name = placed[0].label;
  const tag = hostile ? t('summon.fragHostile') : kind === 'hero' ? t('summon.fragAllies') : '';
  return [t('summon.summons', { name: caster.label, n: placed.length, label: name, tag })];
}

/**
 * Dissipe les invocations expirées au franchissement de Round : durée écoulée (`round` a dépassé
 * `expiresAtRound`) OU lanceur hors de combat (`despawnIfSummonerDown`). Mute la bataille (retire
 * des combattants ET de l'ordre), renvoie le journal de dissipation.
 */
export function purgeExpiredSummons(battle: BattleState, round: number): string[] {
  const gone = battle.combatants.filter((c) => {
    if (!c.summon) return false;
    if (c.summon.expiresAtRound != null && round >= c.summon.expiresAtRound) return true;
    if (c.summon.despawnIfSummonerDown) {
      const s = inBattleId(battle, c.summon!.byId);
      if (!s || isOutOfAction(s)) return true;
    }
    return false;
  });
  if (!gone.length) return [];
  const goneIds = new Set(gone.map((c) => c.id));
  battle.combatants = battle.combatants.filter((c) => !goneIds.has(c.id));
  battle.order = battle.order.filter((id) => !goneIds.has(id));
  if (battle.baseOrder) battle.baseOrder = battle.baseOrder.filter((id) => !goneIds.has(id));
  return gone.map((c) => t('summon.dispels', { name: c.label, label: nomDeSource(c.summon) }));
}
