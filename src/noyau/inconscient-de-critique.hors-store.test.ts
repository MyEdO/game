/**
 * L'Inconscient d'une Blessure critique dure la rencontre, ou jusqu'à une Aide médicale, sauf indication contraire :
 * il tombe à la clôture du combat. LDB 18 l.53 ; arbitrage #4948 (Clément, 2026-11-24, « À la fin du combat »).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { finalizeBattle } from './combatFlow';
import { inBattleId } from './monde/combatants';
import { seedBattleRng } from './battleRng';
import { createHero } from '../engine/character';
import { addCondition, removeCondition, stacks, tickDeath, COND } from '../engine/conditions';
import { suffocationTick } from '../engine/suffocation';
import { bonus, effectiveChar } from '../engine/characteristics';
import { testScene } from '../scenes/test-fixture';
import { CRITIQUE_DOCS } from '../data/criticals';
import type { GameOp } from '../engine/ops';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const INCONSCIENT_DE_CRITIQUE: GameOp = { op: 'condition', id: { id: 'inconscient' }, value: 1, finDeRencontre: true };

function enCombat(): string {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ battle: null, party: [hero], pendingCascade: null, pendingRoundStart: null, journal: [] });
  banc.getState().lancerLaScene(testScene());
  seedBattleRng(777);
  banc.getState().lancerLeCombat('enc-mutants', undefined, { noSurprise: true });
  banc.abandonner();
  return hero.id;
}
const jouer = (ops: GameOp[]) => applyEffects(() => banc.getState(), banc.setState, [{ type: 'ops', on: 'heros', ops } as never]);
const auGroupe = (id: string) => banc.getState().party.find((h) => h.id === id)!;
const auCombat = (id: string) => inBattleId(banc.getState().battle, id)!;
const clore = () => finalizeBattle(() => banc.getState(), banc.setState);

describe('Inconscient d’une Critique (LDB 18 l.53)', () => {
  it('tombe à la clôture du combat', () => {
    const id = enCombat();
    jouer([INCONSCIENT_DE_CRITIQUE]);
    expect(stacks(auCombat(id), COND.inconscient)).toBe(1);
    clore();
    expect(stacks(auGroupe(id), COND.inconscient)).toBe(0);
  });

  it('une Aide médicale le lève avant la clôture', () => {
    const id = enCombat();
    jouer([INCONSCIENT_DE_CRITIQUE, { op: 'aideMedicale' }]);
    expect(stacks(auCombat(id), COND.inconscient)).toBe(0);
  });

  it('une Critique à 0 Blessure : le KO de LDB 18 l.15 tient après la clôture', () => {
    const id = enCombat();
    jouer([INCONSCIENT_DE_CRITIQUE]);
    const c = auCombat(id);
    c.wounds.current = 0;
    for (let i = 0; i <= bonus(effectiveChar(c, 'endurance')); i++) tickDeath(c);
    clore();
    expect(stacks(auGroupe(id), COND.inconscient)).toBe(1);
  });

  it('une Critique, puis la suffocation jusqu’à 0 Blessure : l’Inconscient de LDB 18 l.346 tient après la clôture', () => {
    const id = enCombat();
    jouer([INCONSCIENT_DE_CRITIQUE]);
    const c = auCombat(id);
    c.wounds.current = 1;
    c.activeEffects = [...(c.activeEffects ?? []), { label: 'Étranglement', bonus: 0, duration: { scale: 'rounds', left: 8 }, suffocates: true } as never];
    suffocationTick(c);
    expect(c.wounds.current).toBe(0);
    clore();
    expect(stacks(auGroupe(id), COND.inconscient)).toBe(1);
  });

  it('un KO à 0 Blessure, puis une Critique : l’État reste celui du KO, que rien ne verrouille', () => {
    const id = enCombat();
    addCondition(auCombat(id), COND.inconscient);
    jouer([INCONSCIENT_DE_CRITIQUE]);
    clore();
    const h = auGroupe(id);
    removeCondition(h, COND.inconscient, 1);
    expect(stacks(h, COND.inconscient)).toBe(0);
  });

  it('retrait natif : l’Inconscient d’une Critique ne se retire pas avant la fin de la rencontre', () => {
    const id = enCombat();
    jouer([INCONSCIENT_DE_CRITIQUE]);
    removeCondition(auCombat(id), COND.inconscient, 1);
    expect(stacks(auCombat(id), COND.inconscient)).toBe(1);
  });

  it('les tables de Critiques posent l’Inconscient pour la rencontre, sauf les deux qui ne le lèvent que par Aide médicale', () => {
    const autres: string[] = [];
    let deRencontre = 0;
    const walk = (o: unknown, ou: string): void => {
      if (Array.isArray(o)) { o.forEach((x) => walk(x, ou)); return; }
      if (!o || typeof o !== 'object') return;
      const r = o as Record<string, unknown>;
      if (r.op === 'condition' && (r.id as { id?: string })?.id === COND.inconscient) {
        if (r.finDeRencontre === true && r.unlockBy == null) deRencontre++;
        else autres.push(`${ou} ${String(r.unlockBy)}`);
      }
      Object.values(r).forEach((x) => walk(x, ou));
    };
    for (const table of CRITIQUE_DOCS) for (const e of table.entries) walk(e, `${table.id}/${e.id}`);
    expect(autres).toEqual(['criticals-ldb-corps/clavicule-cassee medicalAid', 'criticals-aa-corps/aa-corps-96 medicalAid']); // LDB 18 l.151
    expect(deRencontre).toBe(38);
  });
});
