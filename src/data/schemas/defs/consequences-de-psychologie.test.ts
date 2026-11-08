/**
 * #2968 L09 — les conséquences d'un Test de Psychologie se désignent par `ref(type)` (`{ id }` refiné au
 * parse contre l'index des ids) : la Psychologie qui suit (`becomes`), l'État infligé à l'échec
 * (`failCondition`). Fixtures : référence connue, inconnue, écrite en id nu.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './psychology';
import { versDisque } from '../grammaire/prose';
import psychologyJson from '../../psychology.json';

/** Le document réel à sa forme disque (sans la prose matérialisée au chargement). */
const disque = versDisque(psychologyJson);

/** Le document réel, son entrée qui porte `cle` y portant `valeur`. */
const avec = (cle: string, valeur: unknown): unknown[] => disque.map((p) => (cle in p ? { ...p, [cle]: valeur } : p));

const PORTEURS = [
  { porteur: 'psychology.json › becomes', cle: 'becomes', connue: 'peur', catalogue: 'psychologies' },
  { porteur: 'psychology.json › failCondition', cle: 'failCondition', connue: 'brise', catalogue: 'états' },
];

describe('#2968 L09 — conséquences de Psychologie désignées par `ref(type)`', () => {
  it.each(PORTEURS)('$porteur : le document réel et une référence connue parsent', ({ cle, connue }) => {
    expect(disque.some((p) => cle in p)).toBe(true);
    expect(schema.safeParse(disque).success).toBe(true);
    expect(schema.safeParse(avec(cle, { id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée, son catalogue nommé', ({ cle, catalogue }) => {
    const r = schema.safeParse(avec(cle, { id: 'cible-inexistante' }));
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' ')).toContain(`« cible-inexistante » est absent du catalogue des ${catalogue}`);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ cle, connue }) => {
    expect(schema.safeParse(avec(cle, connue)).success).toBe(false);
  });
});
