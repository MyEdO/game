import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { clotureDImports } from '../../../scripts/guards/lib/importGraph.mjs';
import { COUCHES, estZone, zoneDe } from '../../../scripts/guards/lib/couches.mjs';

/**
 * Anti-spoiler du Codex (#767), contrat de l'API : le registre ne prend aucun narratif. Il ne projette
 * que `src/data`, et ses conditions `etat` se libellent sur l'ensemble vide qu'il passe lui-même
 * (`ETATS_DU_CODEX`). Aucun module de sa clôture d'import, types compris, n'atteint donc la couche
 * de campagne chargée, qui vit chez l'hôte : un `build()` de catégorie qui lirait `campaignNarratif`
 * y ferait entrer une zone qui ne survit pas (`survit`, `COUCHES`), et ce test rougit en nommant le module.
 */
describe('anti-spoiler : la couche de campagne n’entre jamais dans l’index Compendium (#767)', () => {
  it('la clôture d’import du registre n’atteint aucun module du store', () => {
    const registre = fileURLToPath(new URL('./registry.ts', import.meta.url));
    const cloture = [...clotureDImports([registre])];
    expect(cloture.length, 'la marche ne voit pas le registre : le test ne mesure plus rien.').toBeGreaterThan(10);
    const survit = (f: string): boolean => { const z = zoneDe(f); return estZone(z) && COUCHES[z].survit === true; };
    expect(cloture.filter((f) => !survit(f))).toEqual([]);
  });
});
