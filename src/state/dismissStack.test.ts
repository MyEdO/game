/**
 * CONTRAT DU SOCLE DE CONGÉDIEMENT (#1476, #1752) — les trois verdicts d'un appui, mesurés sur la
 * pile NUE (module feuille : ni React, ni DOM).
 *
 * Le verdict `'reste'` est ce que rend une couche qui a CONSOMMÉ l'appui et demeure à l'écran :
 * bloquante (`onDismiss: null`), refus pur, ou congédiement PARTIEL — une surface à sous-écrans qui
 * descend d'un échelon interne. Elle garde SA couche : l'appui suivant la retrouve.
 *
 * PÉRIMÈTRE : ici, le VERDICT rendu par `dismissTop`. Le comportement des couches bloquantes et
 * l'absence de cascade sous une porte clavier réelle vivent au banc React `ui/echap-pile-lifo`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pushLayer, popLayer, dismissTop, dismissStackKinds, resetDismissStack } from './dismissStack';

beforeEach(() => resetDismissStack());

describe('dismissStack — verdicts d’un appui', () => {
  it('pile vide : `vide`', () => {
    expect(dismissTop()).toBe('vide');
  });

  it('`onDismiss` sans retour : `ferme`, la couche est DÉPILÉE', () => {
    const fermer = vi.fn();
    pushLayer({ kind: 'modale', nature: 'modale', onDismiss: fermer });
    expect(dismissTop()).toBe('ferme');
    expect(fermer).toHaveBeenCalledTimes(1);
    expect(dismissStackKinds()).toEqual([]);
  });

  it('CONGÉDIEMENT PARTIEL (`false`) : `reste`, la couche est TOUJOURS là, et le 2ᵉ appui la ferme', () => {
    // Une surface à sous-écrans : le 1er appui remonte d'un échelon interne (elle reste à l'écran),
    // le 2e la ferme pour de bon.
    let echelon = 1;
    pushLayer({ kind: 'menu-systeme', nature: 'modale', onDismiss: () => { if (echelon > 0) { echelon -= 1; return false; } } });

    expect(dismissTop(), 'appui 1 : consommé par l’échelon interne').toBe('reste');
    expect(echelon).toBe(0);
    expect(dismissStackKinds(), 'la surface est encore à l’écran : elle garde SA couche').toEqual(['menu-systeme']);

    expect(dismissTop(), 'appui 2 : plus d’échelon, la couche se ferme').toBe('ferme');
    expect(dismissStackKinds()).toEqual([]);
  });

  it('retrait HORS-ORDRE : une couche démontée par le rendu retire LA SIENNE, l’ordre des autres tient', () => {
    const bas = pushLayer({ kind: 'bas', nature: 'modale', onDismiss: () => {} });
    pushLayer({ kind: 'milieu', nature: 'modale', onDismiss: () => {} });
    pushLayer({ kind: 'haut', nature: 'modale', onDismiss: () => {} });
    popLayer(bas);
    expect(dismissStackKinds()).toEqual(['milieu', 'haut']);
  });
});
