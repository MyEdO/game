import { describe, it, expect } from 'vitest';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { feat, elementsOf } from './elements';
import type { Appearance } from '../../../engine/authoringAppearance';
import { asRigSpeciesId } from '../appearance';
import { equipDe } from '../../../noyau/equipementDessine';
import { findTrappingById } from '../../../data';

const NO_EQUIP = equipDe(findTrappingById, [], []);
const EAR = 'M-8 7 Q-15 4 -14 -3'; // début du path de l'oreille pointue (élément 'oreilles-pointues')
const base: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 7 };

describe("catalogue d'apparence — éléments réutilisables (convergence B1)", () => {
  it('feat() résout des clés en calques ; clé inconnue ignorée ; concat additive', () => {
    expect(feat('queue').length).toBeGreaterThan(0);
    expect(feat('inconnu')).toEqual([]);
    expect(feat('queue', 'griffes').length).toBe(feat('queue').length + feat('griffes').length);
  });

  it('elementsOf("trait") liste les traits keyés (pour les pickers de l\'éditeur)', () => {
    const keys = elementsOf('trait').map((e) => e.key);
    for (const k of ['queue', 'cornes-demon', 'oreilles-pointues', 'crocs', 'ecailles']) expect(keys).toContain(k);
  });

  it("un PNJ quelconque porte un trait du catalogue — réutilisable HORS de sa race", () => {
    const without = bonesToSvg(resolveRig(base, NO_EQUIP, {}, 'Nu', 'front'));
    const withEars = bonesToSvg(resolveRig({ ...base, features: ['oreilles-pointues'] }, NO_EQUIP, {}, 'Nu', 'front'));
    expect(without).not.toContain(EAR);          // un Humain nu n'a pas d'oreilles pointues
    expect(withEars).toContain(EAR);             // …jusqu'à ce qu'il en pioche dans le catalogue
    // et c'est EXACTEMENT l'élément que la race Elfe porte par défaut (catalogue PARTAGÉ, pas dupliqué)
    const elf = bonesToSvg(resolveRig({ ...base, species: asRigSpeciesId('haut-elfe') }, NO_EQUIP, {}, 'Nu', 'front'));
    expect(elf).toContain(EAR);
  });

  it("les features d'instance sont cumulatives (plusieurs traits ajoutés)", () => {
    const one = bonesToSvg(resolveRig({ ...base, features: ['oreilles-pointues'] }, NO_EQUIP, {}, 'Nu', 'front'));
    const two = bonesToSvg(resolveRig({ ...base, features: ['oreilles-pointues', 'cornes-demon'] }, NO_EQUIP, {}, 'Nu', 'front'));
    expect(two).toContain(EAR);                       // garde le 1er trait
    expect(two.length).toBeGreaterThan(one.length);   // …et empile le 2e (cornes) par-dessus
  });

  it('une DIFFORMITÉ de mutation est posable en APPARENCE PURE (sans trait/talent)', () => {
    // Les visuels de mutation (LDB 19) sont des éléments de catalogue → posables via features.
    const keys = elementsOf('mutation').map((e) => e.key);
    expect(keys).toContain('tentacule-epais');
    expect(keys).toContain('cornes-asymetriques');
    // Posé en apparence : la difformité se rend, AUCUN trait/mécanique requis.
    const svg = bonesToSvg(resolveRig({ ...base, features: ['cornes-asymetriques'] }, NO_EQUIP, {}, 'Nu', 'front'));
    expect(svg).toContain('data-mut="cornes-asymetriques"');
  });

  it('un calque REMPLAÇANT (tentacule) substitue le membre via features (replace)', () => {
    const svg = bonesToSvg(resolveRig({ ...base, features: ['tentacule-epais'] }, NO_EQUIP, {}, 'Nu', 'front'));
    expect(svg).toContain('data-mut="tentacule-epais"'); // le tentacule remplace le bras gauche
  });
});
