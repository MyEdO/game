import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { ouvrirLeDuel } from '../combatDeTest.testkit';
import { testScene } from '../../scenes/test-fixture';
import { groupeVitrineDeScenario } from '../../scenes/test-scenarios/_heros';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { distanceDeContact } from '../monde/footprint';
import { paintHeight } from '../sceneEdit';
import { attackPlan, buildAiInput, castTargetBlock, counterspellCandidates, previewAttack } from '../combatFlow';
import { cliquerSurLeCombattant } from '../combatOrParty';
import { fenetreDAttaque } from '../fenetreDAttaque';
import { rangeBandId } from '../../engine/combat';
import { ligneDeRegle } from '../../engine/reglesChiffrees';
import { effectiveChar } from '../../engine/characteristics';
import { findSpellById } from '../../data';
import type { Scene } from '../monde/scene';
import type { Weapon } from '../../engine/types';

/**
 * #4127 : les mesures du combat lisent l'échelle de la scène (`sceneMetresPerTile`). LDB 15 l.12 ; LDB 46 l.156 ; LDB 62 l.163.
 * Scène de fixture du jeu, relief peint par la fabrique de l'éditeur (`paintHeight`), échelle déclarée par la scène.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** La scène de fixture, une marche de 3 m peinte en (11,10), à `metresPerTile` m par case. */
const sceneA = (metresPerTile: number): Scene => ({ ...paintHeight(testScene(), { x: 11, y: 10 }, 3, 1), metresPerTile });
const duel = (scene: Scene, tiers?: 'heros' | 'ennemi') =>
  ouvrirLeDuel(banc, { scene, party: groupeVitrineDeScenario(idsDeTest) }, 'enc-mutants', tiers);

const ARC: Weapon = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 4 }, range: 50, qualities: [] };
const PIQUE: Weapon = { label: 'Pique', type: 'melee', damage: { plusBF: true, flat: 6 }, reach: 'Très longue', qualities: [] };

describe('#4127 — une scène à 10 m par case', () => {
  it('deux cases voisines, 3 m de dénivelé : au contact (1) et la mêlée offerte', () => {
    const { H, E, poser } = duel(sceneA(10));
    poser(H, { x: 10, y: 10 });
    poser(E, { x: 11, y: 10 });
    expect([H.pos?.h ?? 0, E.pos?.h], 'témoin : la marche de 3 m').toEqual([0, 3]);
    expect(distanceDeContact(banc.getState().scene, H, E)).toBe(1);
    expect(attackPlan(banc.getState, H, E).kind).toBe('attaque');
  });

  it('témoin à 2 m par case : la même marche sépare (1,5 case), la mêlée n’est pas directe', () => {
    const { H, E, poser } = duel(sceneA(2));
    poser(H, { x: 10, y: 10 });
    poser(E, { x: 11, y: 10 });
    expect(distanceDeContact(banc.getState().scene, H, E)).toBe(1.5);
    expect(attackPlan(banc.getState, H, E).kind).not.toBe('attaque');
  });

  /** Le tir de H sur E, ARC en main, à 2 cases sur la scène `scene` : la fenêtre ouverte par le clic, et l'aperçu du jet. */
  const tirADeuxCases = (scene: Scene) => {
    const { H, E, poser } = duel(scene);
    H.weapons = [ARC];
    poser(H, { x: 5, y: 5 });
    poser(E, { x: 7, y: 5 });
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true });
    banc.reprendreLesEnAttente();
    return { f: fenetreDAttaque(banc.getState()), apercu: previewAttack(banc.getState, H, E) };
  };

  it('un tir à 2 cases est à la bande de 20 m : Courte, sans Esquive de Bout Portant', () => {
    expect(rangeBandId(20, 50, 1), 'témoin : 20 m pour une Portée de 50 m').toBe('courte');
    const { f, apercu } = tirADeuxCases(sceneA(10));
    expect(apercu.difficultyParts).toContainEqual(ligneDeRegle('portee-d-une-arme', 'courte'));
    expect(f?.bloque, 'la fenêtre de tir est ouverte, à portée').toBeNull();
    expect(f!.defense, 'aucune Esquive : la cible n’est pas à Bout Portant').toBeNull();
  });

  it('témoin à 2 m par case : le même tir est à Bout Portant (4 m), la cible annonce son Esquive', () => {
    const { f, apercu } = tirADeuxCases(sceneA(2));
    expect(apercu.difficultyParts).toContainEqual(ligneDeRegle('portee-d-une-arme', 'bout-portant'));
    expect(f!.defense).toMatchObject({ pending: {} });
  });

  it('Dissipation : un contre-lanceur à FM mètres, au plancher en cases, est éligible ; une case au-delà, non', () => {
    const { H, E, T, poser } = duel(sceneA(10), 'heros');
    E.characteristics['force-mentale'] = 35;
    E.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
    const portee = Math.floor(effectiveChar(E, 'force-mentale') / 10);
    expect(portee, 'témoin : FM 35 → 3 cases de 10 m').toBe(3);
    poser(H, { x: 2, y: 2 });
    poser(T!, { x: 5, y: 5 });
    poser(E, { x: 5 + portee, y: 5 });
    const candidats = () => counterspellCandidates(banc.getState().battle, banc.getState().scene, H, T!).map((c) => c.id);
    expect(candidats()).toContain(E.id);
    poser(E, { x: 5 + portee + 1, y: 5 });
    expect(candidats()).not.toContain(E.id);
  });

  it('Fléchette (FM mètres) : FM 35 → 3 cases de 10 m, la cible à 3 cases est à portée, à 4 cases non', () => {
    const { H, E, poser } = duel(sceneA(10));
    H.characteristics['force-mentale'] = 35;
    const flechette = findSpellById('flechette')!;
    poser(H, { x: 2, y: 5 });
    poser(E, { x: 5, y: 5 });
    expect(castTargetBlock(banc.getState, H, flechette, E)).toBeNull();
    poser(E, { x: 6, y: 5 });
    expect(castTargetBlock(banc.getState, H, flechette, E)?.reason).toBe('range');
  });

  it('témoin à 2 m par case : la même Fléchette porte à 17 cases, la cible à 4 cases est à portée', () => {
    const { H, E, poser } = duel(sceneA(2));
    H.characteristics['force-mentale'] = 35;
    poser(H, { x: 2, y: 5 });
    poser(E, { x: 6, y: 5 });
    expect(castTargetBlock(banc.getState, H, findSpellById('flechette')!, E)).toBeNull();
  });

  /** L'Explosion connue de E (FM 40 : Portée 40 m, ZdE de 4 m de diamètre), telle que l'IA la lit sur la scène `scene`. */
  const explosionDeLIA = (scene: Scene) => {
    const { E } = duel(scene);
    E.characteristics['force-mentale'] = 40;
    E.spells = ['explosion'];
    return buildAiInput(E, banc.getState).spells.find((x) => x.id === 'explosion');
  };

  it('Explosion : 40 m → 4 cases de portée, un rayon de 2 m ne couvre que la case du centre', () => {
    expect(explosionDeLIA(sceneA(10))).toMatchObject({ range: 4, shape: { area: { radius: 0 } } });
  });

  it('témoin à 2 m par case : 20 cases de portée, rayon d’une case', () => {
    expect(explosionDeLIA(sceneA(2))).toMatchObject({ range: 20, shape: { area: { radius: 1 } } });
  });

  /** H, une pique d'Allonge Très longue (4 m), face à E à `ecart` cases sur la scène `scene`. */
  const piqueA = (scene: Scene, ecart: number) => {
    const { H, E, poser } = duel(scene);
    H.weapons = [PIQUE];
    poser(H, { x: 5, y: 5 });
    poser(E, { x: 5 + ecart, y: 5 });
    return attackPlan(banc.getState, H, E).kind;
  };

  it('Allonge Très longue (4 m) : au contact la mêlée est offerte ; à 2 cases de 10 m, non', () => {
    expect(piqueA(sceneA(10), 1)).toBe('attaque');
    expect(piqueA(sceneA(10), 2)).not.toBe('attaque');
  });

  it('témoin à 2 m par case : la même pique frappe à 2 cases (4 m)', () => {
    expect(piqueA(sceneA(2), 2)).toBe('attaque');
  });
});
