/**
 * SENTINELLE « sort invisible » — anti-régression du bug d'origine (un sort de dégâts/contrôle/soin/
 * invocation classé `cat:'other'` → utilité 0 → jamais joué par l'IA). On balaie TOUS les sorts CURÉS de
 * la base et on exige : tout sort à effet mécanique de COMBAT (offensif = Projectile/dégât/contrôle hostile,
 * OU soin, OU invocation alliée) produit `spellActionValue > 0` à un PLACEMENT pertinent. Si un tel sort
 * sort à 0, c'est un BUG (à corriger côté évaluateur/donnée), PAS à masquer — il est LISTÉ.
 *
 * Hors-périmètre VOLONTAIRE : les buffs purs (charMod/skillMod/octrois) dont la valeur est MARGINALE et
 * contextuelle (un buff non-combat peut légitimement valoir ~0 en combat) — couverts par ai-spell-value.
 */
import { describe, it, expect } from 'vitest';
import { spells } from '../data';
import { spellActionValue, spellIsOffensive, type SpellPlacement } from './aiSpellValue';
import { spellOps } from '../noyau/monde/flow';
import type { Combatant } from '../engine/types';

const chars = (v: number) => ({ 'capacite-de-combat': v, 'capacite-de-tir': v, force: v, endurance: v, initiative: v, agilite: v, dexterite: v, intelligence: v, 'force-mentale': v, sociabilite: v });
const MELEE = { label: 'Épée', type: 'melee' as const, damage: { plusBF: true, flat: 4 }, qualities: [] };
const ARM0 = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

/** Lanceur ARMÉ + ENTAMÉ (pour valoriser un auto-soin/healCaster), FM/Int hautes (Projectiles chiffrables). */
const caster = (): Combatant => ({
  id: 'caster', label: 'Lanceur', kind: 'enemy',
  characteristics: { ...chars(40), 'force-mentale': 60, intelligence: 60 }, wounds: { current: 4, max: 14, base: 14 },
  advantage: 0, conditions: [], weapons: [MELEE], armour: { ...ARM0 }, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 },
} as Combatant);

/** Cible ennemie de référence — porte les `onlyGroups` requis par les ops de dégâts du sort (placement pertinent). */
const enemyTarget = (groups: string[]): Combatant => ({
  id: 'foe', label: 'Cible', kind: 'hero', characteristics: { ...chars(30) },
  wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [MELEE], armour: { ...ARM0 },
  skills: [], talents: [], movement: 4, pos: { x: 2, y: 0 }, groups,
} as Combatant);

/** Allié entamé (pour les sorts de soin de cible). */
const woundedAlly = (): Combatant => ({
  id: 'ally', label: 'Allié', kind: 'enemy', characteristics: { ...chars(35) },
  wounds: { current: 2, max: 14, base: 14 }, advantage: 0, conditions: [], weapons: [MELEE], armour: { ...ARM0 },
  skills: [], talents: [], movement: 4, pos: { x: 1, y: 0 },
} as Combatant);

describe('Sentinelle anti « sort invisible » — aucun sort de combat curé à valeur 0', () => {
  it('tout sort offensif / soin / invocation curé vaut > 0 à un placement pertinent', () => {
    const c = caster();
    const dead: string[] = [];
    for (const sp of spells) {
      if (!sp.curated) continue; // les homebrew (frenchy.bzh) n'ont pas de spec mécanique complète
      const tOps = spellOps(sp.effects, 'target');
      const cOps = spellOps(sp.effects, 'caster');
      const allOps = [...tOps, ...cOps];
      const offensive = spellIsOffensive(sp);
      const hasHeal = allOps.some((o) => o.op === 'heal' || o.op === 'healCaster' || o.op === 'cureCriticalWound');
      const hasSummon = allOps.some((o) => o.op === 'summon' && (o as { allyOfCaster?: boolean }).allyOfCaster !== false);
      if (!offensive && !hasHeal && !hasSummon) continue; // hors périmètre (buff/utilitaire pur)

      // Groupes requis par d'éventuels gates de dégâts `onlyGroups` (Feu de l'âme « les Morts-vivants… »).
      const reqGroups = tOps.flatMap((o) => (o.op === 'wounds' || o.op === 'banish') ? ((o as { onlyGroups?: string[] }).onlyGroups ?? []) : []);
      const foe = enemyTarget(reqGroups);
      const placements: SpellPlacement[] = [];
      if (offensive) placements.push({ kind: 'unit', subject: foe });
      if (hasHeal || hasSummon) { placements.push({ kind: 'self' }); placements.push({ kind: 'unit', subject: woundedAlly() }); }

      const best = Math.max(...placements.map((p) => spellActionValue(c, sp, p, { landProb: 1, refEnemy: foe, horizon: 3 })));
      if (!(best > 1e-6)) dead.push(`${sp.id} — « ${sp.label} » (offensif=${offensive}, heal=${hasHeal}, summon=${hasSummon})`);
    }
    expect(dead, `Sorts « invisibles » (valeur 0 malgré un effet de combat) :\n${dead.join('\n')}`).toEqual([]);
  });
});
