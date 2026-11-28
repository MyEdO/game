/**
 * Invocation de créatures en combat (champ `SpellSpec.summon`) — Nécromancie (« Réanimation »,
 * « Relever les morts »), Ulric (« Hurlement du loup »), Démonologie (« Manifestation de Démon
 * mineur »), Chaos (« Déchirer l'Aethyr »)…
 *
 * La créature est tirée du bestiaire (`spawnEnemy`), placée sur une case libre près du lanceur,
 * insérée dans l'initiative (juste après le lanceur) et marquée `Combatant.summon`. Elle combat
 * dans le camp du lanceur (`allyOfCaster`, par défaut) — donc CONTRÔLÉE comme un membre du groupe
 * si le lanceur est un héros (`kind: 'heros'`), ou pilotée par l'IA s'il est un ennemi — ou bien
 * HOSTILE (`allyOfCaster: false` — démons « pas sous votre contrôle »). Elle se dissipe au
 * franchissement de Round une fois sa durée écoulée, ou si le lanceur tombe (`despawnIfCasterDown`,
 * minions morts-vivants liés au sorcier). Hors combat : pas de grille → effet journalisé.
 */
import type { Combatant } from '../engine/types';
import type { PorteurDeFiche } from '../engine/statblock';
import type { BattleState } from './etat';
import type { Get, Set as SetFn } from './flowTypes';
import { pointDeCase, type Pt, tileKey } from './monde/path';
import { Scene } from './monde/scene';
import { occupied, tientDebout } from './monde/combatGeometry';
import { footprintN, footprintTiles } from './monde/footprint';
import { inBattleId } from './monde/combatants';
import { spawnEnemy, traitsDeLIndividu } from './monde/spawn';
import { grantTrait } from '../engine/grantedTraits';
import { resolveFormula, type GameOp } from '../engine/ops';
import { nomDeSource } from '../engine/faits';
import { indiceSurLeProfil, slBonus } from '../engine/formule';
import { isOutOfAction } from '../engine/conditions';
import { RNG } from '../engine/dice';
import { t } from '../i18n';
import { chebyshev } from '../engine/grid';
import { mirrorPools } from '../engine/advantagePool';
import { nomDe } from '../engine/nom';
import { ligneDeTexte, type EntreeDuJournal } from '../engine/journal';

/** Descripteur d'invocation = la charge utile de l'op `summon` du Flow (donnée éditable du sort) ;
 *  le discriminant `op` est superflu pour cette fonction dédiée → l'op complète s'assigne quand même. */
type Summon = Omit<Extract<GameOp, { op: 'summon' }>, 'op'>;
/** Ce qu'`applySummon` invoque : l'op `summon` (réf. du bestiaire), ou la fiche d'un défunt qui se
 *  reconstitue (`ScheduledRespawn`, #1882). */
export type Invocation = Summon | (Omit<Summon, 'creature'> & { porteur: PorteurDeFiche });

/** Cases d'ancrage LIBRES autour de `center`, en anneaux croissants (≤8), sur l'ÉTAGE de `center` (z-aware, #802) : chaque
 *  case de l'empreinte de `pose` (`footprintN`, LDB 15 l.12) y tient debout (`tientDebout` : marchable, joignable à pied
 *  depuis `center`), hors de toute empreinte en bataille et des empreintes déjà rendues. Un lanceur posé sur un chemin de ronde `z>0` invoque sur SON étage, jamais au sol en contrebas. */
export function freeTilesNear(scene: Scene, battle: Pick<BattleState, 'combatants' | 'zones'>, center: Pt, n: number, pose: Parameters<typeof footprintN>[0]): Pt[] {
  const blocked = occupied(battle, '__summon-placement__'); // un id ⇒ toutes les empreintes bloquent
  const z = center.z ?? 0;
  const cote = footprintN(pose);
  const debout = tientDebout(scene, center, blocked);
  const out: Pt[] = [];
  for (let r = 1; r <= 8 && out.length < n; r++)
    for (let dy = -r; dy <= r && out.length < n; dy++)
      for (let dx = -r; dx <= r && out.length < n; dx++) {
        const x = center.x + dx, y = center.y + dy;
        if (chebyshev({ x, y }, center) !== r) continue; // seulement l'anneau de rayon r
        const cases = footprintTiles({ x, y }, cote);
        if (!cases.every((t) => debout(t.x, t.y))) continue;
        for (const t of cases) blocked.add(tileKey(t.x, t.y, z));
        out.push(pointDeCase(x, y, z));
      }
  return out;
}

function insertAfter(order: string[], afterId: string | undefined, id: string): void {
  const i = afterId === undefined ? -1 : order.indexOf(afterId);
  if (i >= 0) order.splice(i + 1, 0, id);
  else order.push(id); // sans place nommée dans l'ordre → le combattant agit en fin de Round
}

/** Inscrit `c` en bataille : parmi les combattants, dans l'ordre du Round courant ET dans l'ordre canonique d'où repart
 *  chaque Round (`baseOrder`, `advanceTurn`), juste après `apresId` (en fin d'ordre sans lui), puis dans la réserve
 *  d'Avantage de son camp (AA 11 l.11-13). Mute la bataille. L'invocation et l'outillage de recette l'appellent. */
export function inscrireEnBataille(battle: BattleState, c: Combatant, apresId?: string): void {
  // `baseOrder` peut être LE MÊME tableau que `order` en début de combat : dédoublé, sinon les deux insertions
  // frapperaient le même tableau et l'id y serait DEUX fois (doublon dans l'initiative → clés React en double).
  if (!battle.baseOrder || battle.baseOrder === battle.order) battle.baseOrder = [...battle.order];
  battle.combatants.push(c);
  insertAfter(battle.baseOrder, apresId, c.id);
  insertAfter(battle.order, apresId, c.id);
  if (battle.advantagePools) mirrorPools(battle.advantagePools, [c]);
}

export interface SummonOpts {
  /** DR du jet (échelle `countPerSL`). */
  sl?: number;
  /** Durée du Sort en Rounds (null = pas d'expiration par Round — « Jusqu'à l'aube », etc.). */
  rounds?: number | null;
  /** Libellé du Sort (journal de dissipation). */
  label?: string;
  rng: RNG;
  /** Id du sort source (absent pour un death-spawn de trait). */
  spellId?: string;
}

/**
 * Invoque la/les créature(s) de `summon` près du lanceur. Mute la bataille (combatants + ordre),
 * renvoie le journal. Hors combat : journalisé (rien posé sur la grille).
 */
export function applySummon(get: Get, set: SetFn, caster: Combatant, summon: Invocation, opts: SummonOpts): string[] {
  const porteur: PorteurDeFiche = 'porteur' in summon ? summon.porteur : { ref: summon.creature.id };
  const invoque = 'porteur' in summon ? nomDe(caster) : summon.creature.id;
  const rng = opts.rng;
  const count = Math.max(1, resolveFormula(summon.count, caster, rng) + slBonus(opts.sl, summon.countPerSL));
  const battle = get().battle;
  const scene = get().scene;
  const hostile = summon.allyOfCaster === false;
  if (!battle || !scene || !caster.pos) {
    return [t('summon.horsCombat', { name: nomDe(caster), n: count, label: invoque, tag: hostile ? t('summon.fragHostileHorsCombat') : '' })];
  }
  // Camp : allié = même `kind` que le lanceur (contrôlé/IA selon son camp) ; hostile = camp opposé.
  const kind: Combatant['kind'] = hostile ? (caster.kind === 'heros' ? 'ennemi' : 'heros') : caster.kind;
  const base = battle.combatants.length;
  const invoquer = (i: number): Combatant => {
    const id = `summon-${caster.id}-${battle.round}-${base + i}-${i}`;
    const c = spawnEnemy(porteur, id, undefined);
    c.kind = kind;
    if (summon.size) c.size = summon.size;
    for (const t of traitsDeLIndividu(summon.addTraits ?? [], { id, indice: indiceSurLeProfil(c) }, { dejaPortes: c.traits })) grantTrait(c, t); // traits surchargés (Frénésie, Magique…)
    return c;
  };
  const premier = invoquer(0);
  const tiles = freeTilesNear(scene, battle, caster.pos, count, premier);
  const placed: Combatant[] = [];
  tiles.forEach((pos, i) => {
    const c = i === 0 ? premier : invoquer(i);
    c.pos = pos;
    c.summon = {
      byId: caster.id,
      ...(opts.label ? { label: opts.label } : {}),
      ...(opts.rounds != null ? { expiresAtRound: battle.round + opts.rounds } : {}),
      ...(summon.despawnIfCasterDown ? { despawnIfSummonerDown: true } : {}),
      ...(opts.spellId ? { spellId: opts.spellId } : {}),
    };
    inscrireEnBataille(battle, c, caster.id);
    placed.push(c);
  });
  set({ battle: { ...battle } });
  if (!placed.length) return [t('summon.noRoom', { name: nomDe(caster), ref: invoque })];
  const name = nomDe(placed[0]);
  const tag = hostile ? t('summon.fragHostile') : kind === 'heros' ? t('summon.fragAllies') : '';
  return [t('summon.summons', { name: nomDe(caster), n: placed.length, label: name, tag })];
}

/**
 * Dissipe les invocations expirées au franchissement de Round : durée écoulée (`round` a dépassé
 * `expiresAtRound`) OU lanceur hors de combat (`despawnIfSummonerDown`). Mute la bataille (retire
 * des combattants ET de l'ordre), renvoie le journal de dissipation.
 */
export function purgeExpiredSummons(battle: BattleState, round: number): EntreeDuJournal[] {
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
  return gone.map((c) => ligneDeTexte(t('summon.dispels', { name: nomDe(c), label: nomDeSource(c.summon) })));
}
