import { describe, it, expect } from 'vitest';
import { schema } from './schemas/defs/actions';
import { ACTIONS } from './index';

/**
 * Contrat de COÛT d'`actions.json` (#1467 L1b V-P3) : une action maison porte sa raison dans le champ d'enveloppe
 * `maison` (`maisonSchema`). Le TYPE le garde, mesuré ici sur la donnée réelle mutée.
 */

type Action = Record<string, unknown>;
/** Copie profonde de la donnée réelle — chaque mutation part de l'état committé, jamais d'une fixture. */
const copie = (): Action[] => JSON.parse(JSON.stringify(ACTIONS));
/** Index de la première entrée portant un arbitrage de coût (la cible des mutations). */
const CIBLE = ACTIONS.findIndex((a) => typeof a.maison === 'string');

describe('actions.json — l’arbitrage de coût est une RAISON, portée par le type seul (#1467 L1b)', () => {
  it('la donnée RÉELLE valide son schéma, et la cible des mutations existe', () => {
    expect(CIBLE).toBeGreaterThanOrEqual(0);
    expect(schema.safeParse(ACTIONS).success).toBe(true);
  });

  it('`maison: true` (l’ancien drapeau) est REFUSÉ — un booléen ne dit aucune raison', () => {
    const m = copie();
    m[CIBLE].maison = true;
    const r = schema.safeParse(m);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path.join('.')).toBe(`${CIBLE}.maison`);
  });

  it('`costNote` réintroduit est REFUSÉ — la note n’a plus de champ où vivre (strictObject)', () => {
    const m = copie();
    m[CIBLE].costNote = 'note ressuscitée';
    const r = schema.safeParse(m);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.success ? {} : r.error)).toContain('costNote');
  });

  it('`maison: ""` est REFUSÉ — `.min(1)` est STRUCTUREL, une raison vide n’en est pas une', () => {
    const m = copie();
    m[CIBLE].maison = '';
    expect(schema.safeParse(m).success).toBe(false);
  });

  it('`maison` ABSENT est ACCEPTÉ — le coût découle alors de la guideline ou du folio cité', () => {
    const m = copie();
    delete m[CIBLE].maison;
    expect(schema.safeParse(m).success).toBe(true);
  });

  it('les autres refines SURVIVENT à la mort du couple — une action sans geste ni dette reste refusée', () => {
    const m = copie();
    delete m[0].run;
    delete m[0].intent;
    delete m[0].blocked;
    const r = schema.safeParse(m);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.success ? {} : r.error)).toContain('ni geste (run), ni dette déclarée (blocked)');
  });
});
