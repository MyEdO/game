import { describe, it, expect } from 'vitest';
import type { ActiveEffect } from '../engine/types';
import { summarizeEffects, chipCodex } from './effectIcons';

/**
 * ANCRAGE DE RÈGLE d'un contrecoup, part de la PASTILLE : l'effet durable de « Purifier la chair »
 * (`LDB 40 l.75`) porte pour source la RANGÉE tirée — `{ kind: 'colereDesDieux', id }`, posée par le
 * chemin réel (`src/noyau/combat/miscast-chip-codex.hors-store.test.ts`) — et sa pastille ouvre la
 * fiche Codex de CETTE rangée (`chipCodex`, arbitrage user 2026-07-18).
 */
describe('Contrecoup — la pastille de l’effet porte SA rangée (LDB 40 l.75)', () => {
  it('la pastille de l’effet nomme la rangée et ouvre SA fiche Codex', () => {
    const effet = {
      label: 'Purifier la chair', duration: { scale: 'rounds', left: 3 },
      source: { kind: 'colereDesDieux', id: 'colere-purifier-la-chair' },
    } as ActiveEffect;
    const h = { conditions: [], activeEffects: [effet] };
    const chip = summarizeEffects(h.conditions, h.activeEffects).visible
      .find((c) => c.kind === 'effet' && c.source?.id === 'colere-purifier-la-chair');
    expect(chip, 'la pastille de l’effet porte son entité source').toBeTruthy();
    const cible = chipCodex(chip!);
    expect(cible, 'une pastille reliée à aucune règle n’ouvrirait ni fiche ni popover').toBeTruthy();
    expect(cible!.category).toBe('colereDesDieux');
    expect(cible!.id, 'le popover ouvre la fiche de LA rangée').toBe('colere-purifier-la-chair');
  });
});
