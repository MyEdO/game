/**
 * #2968 L01 — l'action hôte d'un geste secondaire se désigne par `ref('action')` (`{ id }` refiné au parse
 * contre l'index des ids). Fixtures : référence connue, inconnue, écrite en id nu.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './actions';
import actionsJson from '../../actions.json';

/** Le document réel, son geste secondaire portant `hote` à `valeur`. */
const avecHote = (valeur: unknown): unknown[] =>
  structuredClone(actionsJson).map((a) => ('hote' in a ? { ...a, hote: valeur } : a));

describe('#2968 L01 — action hôte désignée par `ref(\'action\')`', () => {
  it('actions.json › hote : le document réel et une référence connue parsent', () => {
    expect(actionsJson.some((a) => 'hote' in a)).toBe(true);
    expect(schema.safeParse(actionsJson).success).toBe(true);
    expect(schema.safeParse(avecHote({ id: 'course' })).success).toBe(true);
  });

  it('actions.json › hote : une référence inconnue est refusée, son catalogue nommé', () => {
    const r = schema.safeParse(avecHote({ id: 'cible-inexistante' }));
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' ')).toContain('« cible-inexistante » est absent du catalogue des actions');
  });

  it('actions.json › hote : une référence écrite en id nu est refusée, au champ lui-même', () => {
    const porteur = actionsJson.findIndex((a) => 'hote' in a);
    const r = schema.safeParse(avecHote('incantation'));
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toContain(`${porteur}.hote`);
  });
});
