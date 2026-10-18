/**
 * La mécanique des Traits et des Atouts/Défauts vit dans `traits.json` / `qualities.json`
 * (capabilities/passive/effects) : le registre est DÉRIVÉ de la donnée et le runtime résout PAR ID.
 * Les Traits et les Qualités sont les DEUX familles sans registre généré — 31 `_registry.generated.ts`
 * existent ailleurs sous `src/` (mesuré) : la distinction est vivante, ce fichier la tient, et il porte
 * la SEULE couverture exhaustive de la résolution par id des deux catalogues.
 * Cf. `AGENTS.md` § Pour TOUT agent (« Toute LOGIQUE est keyée par id STABLE »).
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traits, qualities, findTraitById, findQualityById } from './index';

const ENGINE = join(fileURLToPath(new URL('../engine', import.meta.url)));

describe('Traits et Qualités : mécanique en DONNÉE, résolution PAR ID', () => {
  it('aucun registre généré (_registry.generated.ts) pour Traits/Qualités', () => {
    expect(existsSync(join(ENGINE, 'traits/_registry.generated.ts'))).toBe(false);
    expect(existsSync(join(ENGINE, 'qualities/_registry.generated.ts'))).toBe(false);
  });
  it('chaque Trait de traits.json résout PAR ID (registre dérivé de la donnée)', () => {
    for (const t of traits) expect(findTraitById(t.id), t.id).toBeTruthy();
  });
  it('chaque Qualité de qualities.json résout PAR ID', () => {
    for (const q of qualities) expect(findQualityById(q.id), q.id).toBeTruthy();
  });
});
