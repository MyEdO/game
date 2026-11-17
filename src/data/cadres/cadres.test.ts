/**
 * Le registre des cadres de panneau (`src/data/cadres/defs`, #3935) : des dessins en neuf tranches que l'hôte trace à
 * ses couleurs autour d'un contenu de toute taille.
 */
import { describe, expect, it } from 'vitest';
import { CADRE_DES_CADRES, CADRES } from '.';

describe('le registre des cadres de panneau', () => {
  const cadres = Object.values(CADRES);

  it('aucun dessin ne porte de couleur en dur : `fill`, `stroke` et `stop-color` nomment un jeton `var(--…)` ou un dégradé', () => {
    expect(cadres.length).toBeGreaterThan(0);
    for (const c of cadres) {
      for (const m of c.svg.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)) expect(m[1], `${c.id} : ${m[0]}`).toMatch(/^(none|var\(--[a-z0-9-]+\)|url\(#[a-z0-9-]+\))$/);
    }
  });

  it('l’id d’un dégradé ou d’une découpe commence par l’id de son cadre, qui seul le nomme', () => {
    for (const c of cadres) {
      const ids = [...c.svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      for (const id of ids) expect(id.startsWith(c.id), `${c.id} : ${id}`).toBe(true);
      expect([...c.svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]).filter((id) => !ids.includes(id)), `${c.id} : un id nommé sans être défini`).toEqual([]);
    }
  });

  it('les tranches de bord laissent un bord et un centre à répéter : deux tranches opposées tiennent dans le cadre', () => {
    for (const c of cadres) {
      const [gauche, haut, droite, bas] = c.tranches;
      expect(gauche + droite, c.id).toBeLessThan(CADRE_DES_CADRES.largeur);
      expect(haut + bas, c.id).toBeLessThan(CADRE_DES_CADRES.hauteur);
    }
  });
});
