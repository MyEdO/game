import { describe, expect, it, vi } from 'vitest';
import { cleArete } from '../../geometry/arete';
import { worldToScreen } from './projection';
import { areteSousLePixel, resoudrePixel, type EtatDePick, type Verdict } from './pickResolve';
import { acteur, etat, milieu, montage } from './arete-dans-la-chaine.fixture';

/**
 * L'ÉTAGE `arete` DANS LA CHAÎNE (#1687, lot 1b-2) — ce que le pixel d'un seuil rend maintenant que
 * l'overlay ne prend plus le pointeur.
 *
 * Le pixel du CENTRE d'un seuil rend `nature:'arete'` et la clé que le survol nommait hier
 * (`cleArete`, l'identité de l'arête) ; un pixel plus loin que la demi-largeur de prise ne la rend
 * pas ; et sur tout autre pixel l'étage est INERTE — le verdict est celui de la MÊME chaîne appelée
 * sans arêtes. Ce dernier volet mesure l'inertie de l'étage sur l'arbre du jour, pas une égalité avec
 * une version antérieure du module.
 *
 * COÛT : de ses deux prix, un seul est un CONTRAT DE TRAVAIL — l'INVERSION DU PIXEL, un
 * `getBoundingClientRect()` que l'étage réclame dès qu'une arête est offerte : il se COMPTE (un
 * appel, jamais deux), donc il se prouve ici. L'autre est une DURÉE (le balayage des arêtes,
 * relativement à la chaîne) : une durée mesure l'ordonnanceur de la machine, pas le travail du code
 * — elle vit au banc `arete-dans-la-chaine.bench.ts`, joué par `npm run bench`, hors de `npm test`
 * et de la CI (#1788). Le montage est commun aux deux : `arete-dans-la-chaine.fixture.ts`.
 */

describe('L’étage `arete` : le seuil se résout dans la chaîne, plus par un hit-target SVG', () => {
  const { scene, dims, pose, portails, aretes, cadre, sansAretes } = montage();

  it('la scène du banc porte bien des accès dérivés (sans quoi rien n’est mesuré)', () => {
    expect(portails.length).toBeGreaterThan(0);
    expect(aretes).toHaveLength(portails.length);
  });

  it('au CENTRE d’un seuil : `nature:"arete"`, la clé d’hier, et la case d’où le geste part', () => {
    for (const { arete, a, b } of aretes) {
      const v = resoudrePixel(etat(scene), null, () => milieu(a, b), cadre);
      expect(v.nature, `${arete.cle} n’est pas résolue comme une arête`).toBe('arete');
      if (v.nature !== 'arete') continue;
      expect(v.arete.cle).toBe(cleArete(arete.x, arete.y, arete.side, arete.z));
      expect(v.via).toBe('arete');
      expect(v.tile).toEqual({ x: arete.ancrage.x, y: arete.ancrage.y, z: 0 });
      expect(v.arete.portail?.id).toBeTruthy();
    }
  });

  it('au-delà de la demi-largeur de prise, le seuil ne prend plus le pixel', () => {
    for (const { arete, a, b } of aretes) {
      const m = milieu(a, b);
      const nx = -(b.cy - a.cy) / Math.hypot(b.cx - a.cx, b.cy - a.cy);
      const ny = (b.cx - a.cx) / Math.hypot(b.cx - a.cx, b.cy - a.cy);
      const recul = arete.largeurPrise / 2 + 1;
      const dehors = { x: m.x + nx * recul, y: m.y + ny * recul };
      expect(resoudrePixel(etat(scene), null, () => dehors, cadre).nature).not.toBe('arete');
    }
  });

  it('HORS seuil, l’étage est INERTE : le verdict reste celui de la chaîne sans arêtes, pixel pour pixel', () => {
    const ecarts: string[] = [];
    const cle = (v: Verdict) => `${v.nature}|${v.via}|${v.tile ? `${v.tile.x},${v.tile.y},${v.tile.z}` : 'rien'}|${v.cid ?? '-'}`;
    for (let x = 0; x < dims.w; x += 1)
      for (let y = 0; y < dims.h; y += 1) {
        const g = worldToScreen(pose, { x, y, lift: 0 });
        const avec = resoudrePixel(etat(scene), null, () => g, cadre);
        if (avec.nature === 'arete') continue;
        const sans = resoudrePixel(etat(scene), null, () => g, sansAretes);
        if (cle(avec) !== cle(sans)) ecarts.push(`${x},${y} : ${cle(avec)} ≠ ${cle(sans)}`);
      }
    expect(ecarts).toEqual([]);
  });

  it('COÛT en MESURES DE LAYOUT : une inversion de pixel par résolution — zéro quand rien ne l’exige', () => {
    // Ce que le thunk porte, c'est un `getBoundingClientRect()` : le compter, c'est compter les
    // mesures de layout par `pointermove`. Avec des arêtes offertes, l'étage l'appelle — sur le seuil
    // comme à côté — et les étages de surface RÉUTILISENT ce point : jamais deux.
    const surLeSeuil = vi.fn(() => milieu(aretes[0].a, aretes[0].b));
    expect(resoudrePixel(etat(scene), null, surLeSeuil, cadre).nature).toBe('arete');
    expect(surLeSeuil).toHaveBeenCalledTimes(1);

    const aCote = vi.fn(() => ({ x: 1e5, y: 1e5 }));
    resoudrePixel(etat(scene), null, aCote, cadre);
    expect(aCote, 'l’étage d’arête et les surfaces partagent le MÊME point inversé').toHaveBeenCalledTimes(1);

    // Aucune arête offerte ET un rayon qui nomme sa cible : le pixel n'est pas inversé du tout.
    const enCombat = { ...etat(scene), mode: 'battle', battle: { combatants: [acteur], order: ['e1'], turn: 0 } } as unknown as EtatDePick;
    const jamais = vi.fn(() => milieu(aretes[0].a, aretes[0].b));
    expect(resoudrePixel(enCombat, { kind: 'combatant', id: 'e1' }, jamais, sansAretes).nature).toBe('combattant');
    expect(jamais).not.toHaveBeenCalled();
  });

  it('PIRE CAS du balayage : 89 arêtes offertes, aucune sous le pixel — aucune prise', () => {
    // La population de la Diligence, mesurée au lot 1b-0 : 89 portails. L'étage les balaie TOUTES
    // quand le pixel n'en touche aucune — son pire cas, et celui du survol ordinaire. Ce que ce cas
    // PROUVE est un verdict : rien sous le pixel, rien de pris, quelle que soit la population offerte.
    // Ce qu'il COÛTE (le balayage relativement à la chaîne sans cet étage) est une mesure de temps :
    // elle vit au banc voisin `arete-dans-la-chaine.bench.ts` (#1788), hors de `npm test`.
    const beaucoup = Array.from({ length: 89 }, (_, i) => aretes[i % aretes.length]);
    const loin = { x: 1e5, y: 1e5 };
    expect(beaucoup.length, 'la population balayée est bien celle de la Diligence').toBe(89);
    expect(areteSousLePixel(loin, beaucoup), 'aucune arête ne prend un pixel hors cadre').toBeNull();
  });
});
