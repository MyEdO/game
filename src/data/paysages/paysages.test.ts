/**
 * Le registre des couches de paysage (`src/data/paysages/defs`, #3534) : des dessins que l'hôte trace à ses couleurs et
 * empile dans un même document.
 */
import { describe, expect, it } from 'vitest';
import { COUCHES_DE_PAYSAGE } from '.';

describe('le registre des couches de paysage', () => {
  const couches = Object.values(COUCHES_DE_PAYSAGE);

  it('aucun dessin ne porte de couleur en dur : `fill`, `stroke` et `stop-color` nomment un jeton `var(--…)` ou un dégradé', () => {
    expect(couches.length).toBeGreaterThan(0);
    for (const c of couches) {
      for (const m of c.svg.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)) expect(m[1], `${c.id} : ${m[0]}`).toMatch(/^(none|var\(--[a-z0-9-]+\)|url\(#[a-z0-9-]+\))$/);
    }
  });

  it('l’id d’un dégradé commence par l’id de sa couche, qui seule le nomme : les couches s’empilent sans se croiser', () => {
    for (const c of couches) {
      const ids = [...c.svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      for (const id of ids) expect(id.startsWith(c.id), `${c.id} : ${id}`).toBe(true);
      expect([...c.svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]).filter((id) => !ids.includes(id)), `${c.id} : un dégradé nommé sans être défini`).toEqual([]);
    }
  });

  it('chaque groupe ouvert se ferme', () => {
    for (const c of couches) expect(c.svg.match(/<g[\s>]/g)?.length ?? 0, c.id).toBe(c.svg.match(/<\/g>/g)?.length ?? 0);
  });
});
