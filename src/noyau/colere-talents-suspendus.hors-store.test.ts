/**
 * Colère des dieux, rangées 106-110 et 116-120 (LDB 40 l.80, l.82) : « vous perdez les Talents Béni et
 * Invocation pour les 1d10 + (Points de Péché) [2d10 + (Points de Péché)] prochains jours ».
 *
 * Contrat : la rangée tirée suspend les DEUX Talents pour UNE durée tirée en jours ; la porte de possession
 * (`effectiveTalents`) ne les voit plus, une Prière de leur famille est refusée (LDB 10 l.109, l.625) ;
 * à l'échéance d'horloge, les Talents reviennent, acquis inchangés et sans PX.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { rollMiscast, miscastRowSource, miscastTableId } from '../engine/miscast';
import { applyOps } from '../engine/ops';
import { effectiveTalents } from '../engine/talentEffects';
import { acquerirTalent } from '../engine/careerSlots';
import { MINUTES_PER_DAY } from '../engine/clock';
import { aucunDe, desEnSuite } from '../engine/dice.testkit';
import type { Combatant } from '../engine/types';

const MAINTENANT = 8 * 60;
const PECHE = 3;

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ gameTime: MAINTENANT });
});

/** Prêtre de Sigmar béni ET invocateur, avec de quoi prier. */
function pretre(): Combatant {
  const p = herosDeScenario(idsDeTest, 'pretre');
  acquerirTalent(p, { id: 'invocation', spec: 'sigmar' });
  const priere = p.skills.find((s) => s.id === 'priere');
  if (priere) priere.advances = Math.max(priere.advances, 5);
  else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  return p as Combatant;
}

/** Tire la rangée de Colère dont le dé NATUREL est `de` sous `PECHE` Points de Péché, puis l'applique
 *  au prêtre, les dés de durée étant `desDeDuree`. */
function subirLaColere(p: Combatant, de: number, desDeDuree: number[]) {
  const m = rollMiscast('colere', aucunDe, PECHE, undefined, de);
  const lignes = applyOps(p, m.ops, { idNeuf: idsDeTest, rng: desEnSuite(desDeDuree), label: m.label, now: MAINTENANT, source: miscastRowSource(miscastTableId('colere'), m.rowId) });
  return { m, lignes };
}

const possede = (p: Combatant, id: string) => effectiveTalents(p).some((t) => t.talentId === id);
const echeances = (p: Combatant) => (p.activeEffects ?? []).map((e) => (e.duration.scale === 'clock' ? e.duration.until : null));

describe('Colère des dieux — perte temporaire de Béni et Invocation (LDB 40 l.80, l.82)', () => {
  it('106-110 « Ne prononcez pas mon nom en vain » : les deux Talents perdus pour 1d10 + (Points de Péché) jours', () => {
    const p = pretre();
    const acquis = structuredClone(p.talents);
    const { m } = subirLaColere(p, 76, [4]); // 76 + 10 × 3 = 106 ; 1d10 = 4
    expect(m.rowId).toBe('colere-ne-prononcez-pas-mon-nom-en-vain');
    expect(possede(p, 'beni')).toBe(false);
    expect(possede(p, 'invocation')).toBe(false);
    expect(echeances(p)).toEqual([MAINTENANT + (4 + PECHE) * MINUTES_PER_DAY, MAINTENANT + (4 + PECHE) * MINUTES_PER_DAY]);
    expect(p.talents).toEqual(acquis);
  });

  it('116-120 « Vous abusez de ma miséricorde » : les deux Talents perdus pour 2d10 + (Points de Péché) jours', () => {
    const p = pretre();
    const { m } = subirLaColere(p, 86, [5, 6]); // 86 + 10 × 3 = 116 ; 2d10 = 5 + 6
    expect(m.rowId).toBe('colere-vous-abusez-de-ma-misericorde');
    expect(possede(p, 'beni')).toBe(false);
    expect(possede(p, 'invocation')).toBe(false);
    expect(echeances(p)).toEqual([MAINTENANT + (11 + PECHE) * MINUTES_PER_DAY, MAINTENANT + (11 + PECHE) * MINUTES_PER_DAY]);
  });

  it('une Prière est refusée pendant la perte, puis les Talents reviennent à l’échéance sans PX', () => {
    const p = pretre();
    const px = structuredClone(p.xp);
    const acquis = structuredClone(p.talents);
    subirLaColere(p, 76, [1]); // 1d10 = 1 → 1 + 3 = 4 jours
    banc.setState({ party: [p] });

    banc.getState().incanterLeSort(p.id, 'benediction-de-bataille', p.id);
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().journal.join('\n')).toMatch(/ne possède pas le Talent Béni/);

    banc.getState().avancerLeTemps(4 * MINUTES_PER_DAY - 1);
    expect(possede(banc.getState().party[0], 'beni')).toBe(false);

    banc.getState().avancerLeTemps(1);
    const rendu = banc.getState().party[0];
    expect(possede(rendu, 'beni')).toBe(true);
    expect(possede(rendu, 'invocation')).toBe(true);
    expect(rendu.talents).toEqual(acquis);
    expect(rendu.xp).toEqual(px);

    banc.getState().incanterLeSort(rendu.id, 'benediction-de-bataille', rendu.id);
    expect(banc.getState().pendingCast).not.toBeNull();
  });
});
