import { describe, it, expect } from 'vitest';
import { CAP_GROUPE, capDuGroupe, estDebout, meneurDuMonde, meneurDeboutDuMonde, niMortNiATerre, poserCapDuGroupe } from './combatants';
import { mouvementDuGroupe, optionsDeCheminDuGroupe } from './exploreNav';
import { isOutOfAction } from '../engine/conditions';
import { maxJumpTiles } from '../engine/movement';
import { effectiveMovement } from '../engine/encumbrance';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

/**
 * MENEUR du groupe — définition UNIQUE (#1362, lot L1a) : UN id, celui que le plateau dessine, que
 * le regard de première personne porte, qui s'assoit, qui grimpe et qui reçoit le cap d'entrée de
 * scène. Ce fichier tient les REPLIS de l'élection ; le câblage de ses lecteurs vit en
 * `src/state/meneur-unique.test.ts`.
 */

/** Héros minimal : seuls l'état « hors d'action » et les Blessures pèsent sur l'élection. */
function hero(
  id: string,
  opts: { dead?: boolean; wounds?: number; conditions?: { id: string; value: number }[]; outOfRencontre?: boolean } = {},
): Combatant {
  return {
    id,
    label: id,
    kind: 'hero',
    wounds: { current: opts.wounds ?? 10, max: 10 },
    dead: opts.dead ?? false,
    conditions: opts.conditions ?? [],
    ...(opts.outOfRencontre ? { outOfRencontre: true } : {}),
  } as unknown as Combatant;
}

/** INCONSCIENT avec des Blessures restantes : le cas que `dead` seul laissait passer. */
const inconscient = (id: string, wounds = 8) => hero(id, { wounds, conditions: [{ id: 'inconscient', value: 1 }] });

describe('estDebout — prédicat canonique', () => {
  it('héros valide → debout', () => {
    expect(estDebout(hero('a'))).toBe(true);
  });

  it('héros à 0 Blessure → PAS debout (il est au sol, le plateau ne le fait plus marcher)', () => {
    expect(estDebout(hero('a', { wounds: 0 }))).toBe(false);
  });

  it('héros MORT → pas debout, même avec des Blessures restantes', () => {
    expect(estDebout(hero('a', { dead: true }))).toBe(false);
  });

  it('héros INCONSCIENT à 8 Blessures → pas debout (il ne mène pas, il est porté)', () => {
    const h = inconscient('a');
    expect(isOutOfAction(h), 'le canonique du moteur attrape l’État Inconscient').toBe(true);
    expect(estDebout(h)).toBe(false);
  });

  it('héros à 0 Blessure mais EN JEU (À Terre) → pas debout, et pourtant pas hors d’action', () => {
    const h = hero('a', { wounds: 0 });
    expect(isOutOfAction(h)).toBe(false);
    expect(estDebout(h)).toBe(false);
  });

  it('héros SORTI de la rencontre (`outOfRencontre`) → pas debout', () => {
    expect(estDebout(hero('a', { outOfRencontre: true }))).toBe(false);
  });
});

describe('meneurDuMonde — le premier DEBOUT, à défaut le premier du roster', () => {
  it('groupe entier valide → le premier du roster', () => {
    expect(meneurDuMonde({ party: [hero('a'), hero('b')] })?.id).toBe('a');
  });

  it('premier du roster à 0 Blessure → le premier DEBOUT derrière lui', () => {
    expect(meneurDuMonde({ party: [hero('a', { wounds: 0 }), hero('b')] })?.id).toBe('b');
  });

  it('premier du roster MORT → le premier DEBOUT derrière lui', () => {
    expect(meneurDuMonde({ party: [hero('a', { dead: true }), hero('b')] })?.id).toBe('b');
  });

  it('groupe ENTIER à terre → repli sur le premier du roster (un jeton reste dessiné)', () => {
    expect(meneurDuMonde({ party: [hero('a', { wounds: 0 }), hero('b', { dead: true })] })?.id).toBe('a');
  });

  it('premier du roster INCONSCIENT (8 Blessures) → le premier DEBOUT derrière lui', () => {
    expect(meneurDuMonde({ party: [inconscient('a'), hero('b')] })?.id).toBe('b');
  });

  it('groupe VIDE → aucun meneur', () => {
    expect(meneurDuMonde({ party: [] })).toBeUndefined();
  });
});

describe('meneurDeboutDuMonde — le même meneur, SANS le dernier repli', () => {
  it('un héros debout → le même que le meneur', () => {
    const party = [hero('a', { wounds: 0 }), hero('b')];
    expect(meneurDeboutDuMonde({ party })).toBe(meneurDuMonde({ party }));
    expect(meneurDeboutDuMonde({ party })?.id).toBe('b');
  });

  it('groupe ENTIER à terre → aucun meneur (le geste se refuse, il ne le fait pas faire à un corps au sol)', () => {
    expect(meneurDeboutDuMonde({ party: [hero('a', { wounds: 0 }), hero('b', { dead: true })] })).toBeUndefined();
  });

  it('groupe VIDE → aucun meneur', () => {
    expect(meneurDeboutDuMonde({ party: [] })).toBeUndefined();
  });

  it('groupe ENTIER inconscient → aucun meneur debout (personne ne grimpe)', () => {
    expect(meneurDeboutDuMonde({ party: [inconscient('a'), inconscient('b')] })).toBeUndefined();
  });
});

describe('signature par ÉTAT — `meneurDuMonde` / `meneurDeboutDuMonde`', () => {
  it('rendent le MÊME meneur — l’objet du roster, pas une copie (aucune seconde définition)', () => {
    const party = [inconscient('a'), hero('b')];
    expect(meneurDuMonde({ party })).toBe(party[1]);
    expect(meneurDeboutDuMonde({ party })).toBe(meneurDuMonde({ party }));
    expect(meneurDuMonde({ party })?.id).toBe('b');
  });

  it('groupe entier à terre : le meneur existe, le meneur DEBOUT non', () => {
    const party = [hero('a', { wounds: 0 }), inconscient('b')];
    expect(meneurDuMonde({ party })?.id).toBe('a');
    expect(meneurDeboutDuMonde({ party })).toBeUndefined();
  });
});

describe('cap du GROUPE — UNE entrée, keyée par aucun héros', () => {
  it('pose le cap sous la SEULE clé de groupe — aucun id de héros n’apparaît', () => {
    expect(poserCapDuGroupe({}, 'SO')).toEqual({ [CAP_GROUPE]: 'SO' });
  });

  it('préserve les caps INDIVIDUELS (coques, combattants) déjà en table', () => {
    expect(poserCapDuGroupe({ ship: 'N', orc: 'E' }, 'SO')).toEqual({ ship: 'N', orc: 'E', [CAP_GROUPE]: 'SO' });
  });

  it('PUR : la table reçue n’est pas mutée', () => {
    const avant = { a: 'N' as const };
    poserCapDuGroupe(avant, 'SO');
    expect(avant).toEqual({ a: 'N' });
  });

  it('`capDuGroupe` relit ce que `poserCapDuGroupe` a posé', () => {
    expect(capDuGroupe({ facing: poserCapDuGroupe({}, 'NE') })).toBe('NE');
  });

  it('aucun cap encore posé → `null` (l’appelant décide de son défaut)', () => {
    expect(capDuGroupe({ facing: {} })).toBeNull();
    expect(capDuGroupe({ facing: { a: 'N', ship: 'E' } }), 'un cap de héros n’est PAS celui du groupe').toBeNull();
  });
});

describe('mouvementDuGroupe — l’allure du traînard NI MORT NI À TERRE', () => {
  /** Héros COMPLET : `effectiveMovement` lit la fiche (espèce, encombrement). */
  const vrai = (id: string, graine: number) =>
    createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, rng: makeRNG(graine) });

  it('groupe VIDE → allure 0, et le saut retombe au plancher du moteur', () => {
    expect(mouvementDuGroupe([])).toBe(0);
    expect(optionsDeCheminDuGroupe([]).jump).toBe(maxJumpTiles(0));
  });

  it('groupe ENTIÈREMENT à terre → 0 : personne ne prend d’élan', () => {
    const a = vrai('a', 1);
    a.wounds.current = 0;
    expect(mouvementDuGroupe([a])).toBe(0);
  });

  it('un INCONSCIENT à Blessures restantes COMPTE encore, un héros À TERRE non', () => {
    const debout = vrai('debout', 1);
    const ko = vrai('ko', 2);
    (ko as unknown as { conditions: { id: string; value: number }[] }).conditions = [{ id: 'inconscient', value: 1 }];
    expect(niMortNiATerre(ko), 'la population de la portée de saut ne regarde que mort / 0 Blessure').toBe(true);
    expect(mouvementDuGroupe([debout])).toBeGreaterThan(1);
    // Il COMPTE, et c'est `effectiveMovement` (gating de l'État, données) qui le met à 0 — pas ce module.
    expect(effectiveMovement(ko)).toBe(0);
    expect(mouvementDuGroupe([debout, ko])).toBe(0);
    ko.wounds.current = 0;
    expect(mouvementDuGroupe([debout, ko]), 'à 0 Blessure il sort du minimum')
      .toBe(mouvementDuGroupe([debout]));
  });

  it('un héros DEBOUT plus lent, lui, abaisse bien l’allure', () => {
    const rapide = vrai('rapide', 1);
    const lent = vrai('lent', 2);
    lent.movement = 1;
    expect(mouvementDuGroupe([rapide, lent])).toBeLessThan(mouvementDuGroupe([rapide]));
  });
});
