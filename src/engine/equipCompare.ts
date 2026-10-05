/**
 * Comparaison d'équipement (PUR). Compare un objet (acheté au marchand) à l'objet du MÊME
 * emplacement actuellement équipé par un héros, pour l'accordéon « équiper » du marchand (retour
 * utilisateur : montrer le gain/la perte avant d'équiper). Aucune règle inventée — ne compare que
 * des stats déjà portées par les trappings (Dégâts, Allonge, Portée, Qualités, PA d'armure ;
 * Protection des boucliers via l'Atout « Protectrice N »). Présentation pure → testable hors UI.
 */
import type { Combatant, ItemInstance, HitLocation, WeaponDamageSpec, QualityInstance } from './types';
import { damageScore, isShieldItem, isUnarmed, damageString, unarmedWeapon, reachRankOf } from './items';
import { effectiveRange } from './weaponDamage';
import { bonus, effectiveChar } from './characteristics';
import { resolveQualities } from './qualities/dispatch';
import { qualityRefLabel } from '../data';

export type Trend = 'up' | 'down' | 'same';
export interface CompareRow {
  label: string;
  current: string;
  next: string;
  trend: Trend;
}
export interface EquipComparison {
  slot: 'melee' | 'ranged' | 'armor' | 'shield' | 'other';
  /** Nom de l'objet du même emplacement déjà équipé par le héros (null = rien / mains nues). */
  currentName: string | null;
  rows: CompareRow[];
}

const ZONES: { label: string; locs: HitLocation[] }[] = [
  { label: 'Tête', locs: ['tete'] },
  { label: 'Bras', locs: ['brasG', 'brasD'] },
  { label: 'Corps', locs: ['corps'] },
  { label: 'Jambes', locs: ['jambeG', 'jambeD'] },
];

const trendOf = (n: number): Trend => (n > 0 ? 'up' : n < 0 ? 'down' : 'same');
/** Indice de l'Atout « Protectrice N » (PA d'un bouclier en parade, LDB 62 l.296) — lecture structurée. */
const protectrice = (q: QualityInstance[]): number => q.find((x) => x.id === 'protectrice')?.value ?? 0;

export function compareEquip(item: ItemInstance, hero: Combatant): EquipComparison {
  const items = hero.items ?? [];
  // « Actuellement équipé » pour une ARME = l'arme tenue dans le set actif (les Weapon dérivés `hero.weapons`),
  // plus `it.equipped` (devenu le seul seed du loadout par défaut). L'armure, elle, reste pilotée par `equipped`.
  const wielded = (hero.weapons ?? []).filter((w) => !isUnarmed(w));

  if (isShieldItem(item)) {
    const cur = wielded.find((w) => isShieldItem(w) && w.uid !== item.uid);
    const cp = protectrice(cur?.qualities ?? []);
    const np = protectrice(item.qualities);
    return {
      slot: 'shield',
      currentName: cur?.label ?? null,
      rows: [{ label: 'Protection', current: cp ? `Protectrice ${cp}` : '—', next: np ? `Protectrice ${np}` : '—', trend: trendOf(np - cp) }],
    };
  }

  if (item.kind === 'melee' || item.kind === 'ranged') {
    const cur = wielded.find((w) => w.type === item.kind && !isShieldItem(w) && w.uid !== item.uid);
    const baseline: WeaponDamageSpec | undefined = item.kind === 'melee' ? unarmedWeapon().damage : undefined; // mains nues, LDB 62 l.28
    const curDmg = cur?.damage ?? baseline;
    const rows: CompareRow[] = [
      { label: 'Dégâts', current: cur ? damageString(cur.damage) : (baseline ? `${damageString(baseline)} (mains nues)` : '—'), next: item.damage ? damageString(item.damage) : '—', trend: trendOf(damageScore(item.damage) - damageScore(curDmg)) },
    ];
    if (item.kind === 'melee') {
      // Rien de tenu → base = mains nues, comme pour les Dégâts (Allonge Personnelle, LDB 62 l.28/l.158).
      const curReach = cur ? cur.reach ?? null : unarmedWeapon().reach ?? null;
      const cr = reachRankOf(curReach), nr = reachRankOf(item.reach);
      // Une Allonge hors de l'axe (« Variable », LDB 62 l.31) ou absente ne se compare pas : aucun sens affirmé.
      const trend: Trend = cr != null && nr != null ? trendOf(nr - cr) : 'same';
      rows.push({ label: 'Allonge', current: curReach ? (cur ? curReach : `${curReach} (mains nues)`) : '—', next: item.reach ?? '—', trend });
    } else {
      const bf = () => bonus(effectiveChar(hero, 'force')); // BF du porteur, évalué SEULEMENT pour une Portée de jet `{bf}`
      const curR = effectiveRange(cur?.range, bf), nextR = effectiveRange(item.range, bf);
      rows.push({ label: 'Portée', current: curR != null ? `${curR} m` : '—', next: nextR != null ? `${nextR} m` : '—', trend: trendOf((nextR ?? 0) - (curR ?? 0)) });
    }
    const cq = cur ? resolveQualities(cur).map((r) => qualityRefLabel({ id: r.id, value: r.indice })) : [];
    const nq = resolveQualities(item).map((r) => qualityRefLabel({ id: r.id, value: r.indice }));
    rows.push({ label: 'Qualités', current: cq.length ? cq.join(', ') : '—', next: nq.length ? nq.join(', ') : '—', trend: 'same' });
    return { slot: item.kind, currentName: cur?.label ?? null, rows };
  }

  if (item.kind === 'armor') {
    const cur = items.filter((i) => i.equipped && i.kind === 'armor');
    const newPA = (item.pa ?? 0) - (item.damageTaken ?? 0);
    const rows: CompareRow[] = [];
    for (const z of ZONES) {
      if (!z.locs.some((l) => item.locs?.includes(l))) continue;
      const covering = cur.filter((i) => z.locs.some((l) => i.locs?.includes(l)));
      const curPA = covering.length ? Math.max(0, ...covering.map((i) => (i.pa ?? 0) - (i.damageTaken ?? 0))) : 0;
      // Le modèle prend le MAX par localisation (recomputeLoadout) → gain seulement si la neuve fait mieux.
      rows.push({ label: `PA ${z.label}`, current: String(curPA), next: String(Math.max(curPA, newPA)), trend: trendOf(newPA - curPA) });
    }
    return { slot: 'armor', currentName: cur.map((i) => i.label).join(', ') || null, rows };
  }

  return { slot: 'other', currentName: null, rows: [] };
}
