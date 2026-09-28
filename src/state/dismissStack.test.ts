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
import { pushLayer, popLayer, dismissTop, dismissStackKinds, resetDismissStack, coucheDuDessus, modaleDuDessus } from './dismissStack';

beforeEach(() => resetDismissStack());

describe('dismissStack — verdicts d’un appui', () => {
  it('pile vide : `vide`', () => {
    expect(dismissTop()).toBe('vide');
  });

  it('`onDismiss` sans retour : `ferme`, la couche est DÉPILÉE', () => {
    const fermer = vi.fn();
    pushLayer({ kind: 'modale', nature: 'modale', plan: 'application', onDismiss: fermer });
    expect(dismissTop()).toBe('ferme');
    expect(fermer).toHaveBeenCalledTimes(1);
    expect(dismissStackKinds()).toEqual([]);
  });

  it('CONGÉDIEMENT PARTIEL (`false`) : `reste`, la couche est TOUJOURS là, et le 2ᵉ appui la ferme', () => {
    // Une surface à sous-écrans : le 1er appui remonte d'un échelon interne (elle reste à l'écran),
    // le 2e la ferme pour de bon.
    let echelon = 1;
    pushLayer({ kind: 'menu-systeme', nature: 'modale', plan: 'application', onDismiss: () => { if (echelon > 0) { echelon -= 1; return false; } } });

    expect(dismissTop(), 'appui 1 : consommé par l’échelon interne').toBe('reste');
    expect(echelon).toBe(0);
    expect(dismissStackKinds(), 'la surface est encore à l’écran : elle garde SA couche').toEqual(['menu-systeme']);

    expect(dismissTop(), 'appui 2 : plus d’échelon, la couche se ferme').toBe('ferme');
    expect(dismissStackKinds()).toEqual([]);
  });

  it('retrait HORS-ORDRE : une couche démontée par le rendu retire LA SIENNE, l’ordre des autres tient', () => {
    const bas = pushLayer({ kind: 'bas', nature: 'modale', plan: 'application', onDismiss: () => {} });
    pushLayer({ kind: 'milieu', nature: 'modale', plan: 'application', onDismiss: () => {} });
    pushLayer({ kind: 'haut', nature: 'modale', plan: 'application', onDismiss: () => {} });
    popLayer(bas);
    expect(dismissStackKinds()).toEqual(['milieu', 'haut']);
  });
});

describe('dismissStack — le PLAN d’abord, puis l’ordre des ouvertures', () => {
  it('une couche d’APPLICATION ouverte AVANT une couche de SCÈNE reste au-dessus : c’est elle qu’un appui ferme (refs #1987)', () => {
    const fermerFiche = vi.fn();
    pushLayer({ kind: 'fiche-perso', nature: 'modale', plan: 'application', onDismiss: fermerFiche });
    pushLayer({ kind: 'dialogue', nature: 'modale', plan: 'scene', onDismiss: null });
    expect(dismissTop(), 'l’appui ferme la fiche').toBe('ferme');
    expect(fermerFiche).toHaveBeenCalledTimes(1);
    expect(modaleDuDessus()?.kind, 'la conversation devient la modale du dessus').toBe('dialogue');
    expect(dismissTop(), 'la conversation, bloquante, consomme l’appui').toBe('reste');
  });

  it('la scène ouverte en dernier reste sous l’application ; dans un plan, la dernière ouverte est au-dessus ; un popover n’est jamais la modale du dessus', () => {
    pushLayer({ kind: 'a', nature: 'modale', plan: 'application', onDismiss: () => {} });
    pushLayer({ kind: 'b', nature: 'modale', plan: 'application', onDismiss: () => {} });
    pushLayer({ kind: 'bulle', nature: 'popover', plan: 'application', onDismiss: () => {} });
    pushLayer({ kind: 'dialogue', nature: 'modale', plan: 'scene', onDismiss: null });
    expect(dismissStackKinds(), 'ordre peint : la scène sous l’application').toEqual(['dialogue', 'a', 'b', 'bulle']);
    expect(coucheDuDessus()?.kind).toBe('bulle');
    expect(modaleDuDessus()?.kind).toBe('b');
    expect(coucheDuDessus((c) => c.plan === 'scene')?.kind).toBe('dialogue');
  });
});
