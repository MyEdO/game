import { describe, it, expect } from 'vitest';
import { schema } from './schemas/defs/actions';
import actionsJson from './actions.json';

/**
 * Contrat de l'arbitrage de COÛT d'`actions.json` (#1467 L1b V-P3) — le TYPE remplace un refine.
 *
 * Le def portait le couple `maison: boolean` + `costNote: string` liés par un `superRefine`
 * bidirectionnel. La migration `2026-08-27-l1b-4b-actions-maison-raison.mjs` a fondu les deux dans le
 * champ d'enveloppe `maison: z.string().min(1)` : le texte de la note EST la raison. Le refine est
 * mort — ce que le TYPE garde désormais se mesure ici, sur la donnée réelle mutée, sans quoi la mort
 * du refine ne serait couverte par rien.
 */

type Action = Record<string, unknown>;
const REELLES = actionsJson as unknown as Action[];
/** Copie profonde de la donnée réelle — chaque mutation part de l'état committé, jamais d'une fixture. */
const copie = (): Action[] => JSON.parse(JSON.stringify(REELLES));
/** Index de la première entrée portant un arbitrage de coût (la cible des mutations). */
const CIBLE = REELLES.findIndex((a) => typeof a.maison === 'string');

describe('actions.json — l’arbitrage de coût est une RAISON, portée par le type seul (#1467 L1b)', () => {
  it('la donnée RÉELLE valide son schéma, et la cible des mutations existe', () => {
    expect(CIBLE).toBeGreaterThanOrEqual(0);
    expect(schema.safeParse(REELLES).success).toBe(true);
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

  it('les autres refines SURVIVENT à la mort du couple — une action sans dispatcher, intention ni dette reste refusée', () => {
    const m = copie();
    delete m[0].run;
    delete m[0].intent;
    delete m[0].blocked;
    const r = schema.safeParse(m);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.success ? {} : r.error)).toContain('ni dispatcher (run), ni intention (intent), ni dette déclarée (blocked)');
  });
});
