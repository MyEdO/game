/**
 * `miscast.json` — le dialecte porte les DURÉES en formules sin-paramétrées et l'État RÉCURRENT.
 *
 * `days` porte une `Formula` sin-paramétrée (`formulaSinSchema`), comme `rounds`/`hours`/`minutes` : le
 * moteur la résout ainsi (`GameOp['castPenalty'].days`, `engine/ops.ts`), le dialecte l'accepte donc au
 * même titre. Un nombre nu EST une `Formula` valide — la donnée (`colere-pensez-a-vos-actes`,
 * `"days": 7`) l'atteste. Les durées sin-paramétrées de la Colère des dieux passent par la durée canonique
 * (`OpDuree`) : `suppressTalents.durationDays` (LDB 40 l.80, l.82), `deitySkillMod.durationHours`/`durationDays`
 * (LDB 40 l.61, l.70).
 *
 * `perRound` + `unlessCondition` + `durationRounds` entrent au dialecte : la forme de « Purifier la
 * chair » (`LDB 40 l.75`, `LDB 16 l.117`). Le dialecte reste CLOS (`strictObject`).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './miscast';
import miscastJson from '../../miscast.json';

const SOURCE = { book: 'livre-de-base', page: 218, note: 'Tableau de la Colère des dieux, LDB 40 l.75' } as const;

/** Un document-table minimal portant UNE rangée dont les `ops` sont celles qu'on éprouve. */
const table = (ops: unknown[]) => ([{
  id: 'miscast-colere', type: 'miscast', label: 'Colère des dieux', die: 'd100', source: SOURCE,
  entries: [{ id: 'colere-eprouvee', min: 1, max: 5, label: 'Éprouvée', ops, source: SOURCE }],
}]);

/** Premier message d'erreur rendu par le parse — le contrat se lit AU MESSAGE, pas au seul booléen. */
const refus = (data: unknown): string => {
  const r = schema.safeParse(data);
  expect(r.success, 'le schéma a ACCEPTÉ une entrée qu’il doit refuser').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' | ');
};

describe('miscast.json — `days` formulaire et État RÉCURRENT à durée intrinsèque', () => {
  it('TÉMOIN : le dataset RÉEL est accepté', () => {
    expect(schema.safeParse(miscastJson).success).toBe(true);
  });

  it('`days` : la formule « 1d10 + (Points de Péché) » est ACCEPTÉE', () => {
    const ops = [{ op: 'castPenalty', skill: { id: 'priere' }, mod: -10, days: { sum: [{ dice: { n: 1, sides: 10 } }, { sinPoints: true }] } }];
    expect(schema.safeParse(table(ops)).success).toBe(true);
  });

  it('`days` : le nombre nu reste ACCEPTÉ (un nombre EST une Formula — `colere-pensez-a-vos-actes`)', () => {
    const ops = [{ op: 'castPenalty', skill: { id: 'priere' }, maxZeroDR: true, days: 7 }];
    expect(schema.safeParse(table(ops)).success).toBe(true);
  });

  it('la perte de Béni et Invocation pour « 2d10 + (Points de Péché) » jours est ACCEPTÉE (LDB 40 l.82)', () => {
    const ops = [{ op: 'suppressTalents', talents: [{ id: 'beni' }, { id: 'invocation' }], durationDays: { sum: [{ dice: { n: 2, sides: 10 } }, { sinPoints: true }] } }];
    expect(schema.safeParse(table(ops)).success).toBe(true);
  });

  it('le malus aux Compétences du dieu, toutes pour des heures ou une au hasard pour des jours, est ACCEPTÉ (LDB 40 l.61, l.70)', () => {
    const duree = { sum: [{ dice: { n: 1, sides: 10 } }, { sinPoints: true }] };
    expect(schema.safeParse(table([{ op: 'deitySkillMod', pick: 'all', mod: -10, durationHours: duree }])).success).toBe(true);
    expect(schema.safeParse(table([{ op: 'deitySkillMod', pick: 'random', mod: -10, durationDays: duree }])).success).toBe(true);
    expect(refus(table([{ op: 'deitySkillMod', pick: 'une', mod: -10, durationDays: duree }]))).not.toBe('');
    expect(refus(table([{ op: 'deitySkillMod', pick: 'all', mod: -10 }]))).toContain('durée EXCLUSIVE');
    expect(refus(table([{ op: 'deitySkillMod', pick: 'all', mod: -10, durationHours: duree, durationDays: duree }]))).toContain('durée EXCLUSIVE');
  });

  it('la forme de « Purifier la chair » est ACCEPTÉE : État posé + cause RÉCURRENTE de 1d10 Rounds', () => {
    const ops = [
      { op: 'condition', id: { id: 'inconscient' }, value: 1 },
      { op: 'condition', id: { id: 'inconscient' }, value: 1, perRound: true, unlessCondition: { id: 'inconscient' }, durationRounds: { dice: { n: 1, sides: 10 } } },
    ];
    expect(schema.safeParse(table(ops)).success).toBe(true);
  });

  it('le dialecte n’accueille QUE ce que la table utilise : `onlyIfCondition` est REFUSÉ (aucune rangée ne le pose)', () => {
    const ops = [{ op: 'condition', id: { id: 'inconscient' }, value: 1, onlyIfCondition: { id: 'a-terre' } }];
    expect(refus(table(ops))).toContain('onlyIfCondition');
  });

  it('le dialecte est CLOS : un champ qu’il ne déclare pas est REFUSÉ en le nommant', () => {
    const ops = [{ op: 'condition', id: { id: 'inconscient' }, value: 1, champInconnu: { dice: { n: 1, sides: 10 } } }];
    expect(refus(table(ops))).toContain('champInconnu');
  });
});
