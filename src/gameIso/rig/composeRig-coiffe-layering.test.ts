import { describe, it, expect } from 'vitest';
import { resolveRig } from './composeRig';
import { bonesToSvg } from './renderBones';
import { SLOT_LAYER } from './bones';
import { APPEARANCE_ELEMENTS } from './parts/elements';
import type { Appearance } from '../../engine/authoringAppearance';
import { asRigSpeciesId } from './appearance';
import { equipDe } from '../../noyau/equipementDessine';

const NO_EQUIP = equipDe([], []);
const EAR = 'M-8 7 Q-15 4 -14 -3'; // début du path de l'oreille pointue (élément 'oreilles-pointues')
const HEAUME = 'Q-10.5 -17.5 0 -18.5'; // début du path du heaume (tenue 'guerrier-du-chaos', slot tete)
const elfInHelm: Appearance = { species: asRigSpeciesId('haut-elfe'), sex: 'M', build: 0.5, seed: 7 };

describe('composeRig — une coiffe de tenue COUVRE les oreilles pointues (pas l’inverse)', () => {
  it('Haut-Elfe casqué (guerrier-du-chaos, vue front) : le heaume se peint APRÈS (au-dessus de) l’oreille', () => {
    const svg = bonesToSvg(resolveRig(elfInHelm, NO_EQUIP, {}, 'guerrier-du-chaos', 'front'));
    const earAt = svg.indexOf(EAR);
    const heaumeAt = svg.indexOf(HEAUME);
    expect(earAt).toBeGreaterThanOrEqual(0);
    expect(heaumeAt).toBeGreaterThanOrEqual(0);
    // ordre de peintre = ordre d'apparition dans le SVG concaténé (cf. renderBones.bonesToSvg) :
    // l'oreille doit être peinte AVANT le heaume pour finir DESSOUS.
    expect(earAt, `'oreilles-pointues' se peint au-dessus du heaume de tenue (devrait être dessous)`).toBeLessThan(heaumeAt);
  });

  it('Haut-Elfe sans coiffe (Nu) : l’oreille reste visible (au-dessus des cheveux, rien pour la couvrir)', () => {
    const svg = bonesToSvg(resolveRig(elfInHelm, NO_EQUIP, {}, 'Nu', 'front'));
    expect(svg).toContain(EAR);
  });

  // Éléments dont la sémantique est « dépasse des cheveux, couvert par une coiffe fermée » —
  // seul membre actuel : les oreilles pointues d'elfe (cf. bug prouvé, ref rig audit 2026-07-16).
  // Liste EXPLICITE (pas déduite des layers) : c'est le contrat qui doit tenir, pas sa conséquence.
  const SOUS_COIFFE_ELEMENTS = ['oreilles-pointues'];

  it('invariant : les éléments « sous coiffe » restent, PAR CONSTRUCTION, entre cheveux et tete', () => {
    for (const key of SOUS_COIFFE_ELEMENTS) {
      const el = APPEARANCE_ELEMENTS[key];
      expect(el, `élément '${key}' introuvable au catalogue`).toBeTruthy();
      for (const ov of el.overlays ?? []) {
        if (ov.bone !== 'tete') continue;
        expect(ov.layer, `'${key}' (vue ${ov.view ?? '*'}, layer=${ov.layer}) doit être < SLOT_LAYER.tete (${SLOT_LAYER.tete}) pour rester couvert par une coiffe fermée`)
          .toBeLessThan(SLOT_LAYER.tete);
        expect(ov.layer, `'${key}' (vue ${ov.view ?? '*'}, layer=${ov.layer}) doit être > SLOT_LAYER.cheveux (${SLOT_LAYER.cheveux}) pour dépasser de la chevelure`)
          .toBeGreaterThan(SLOT_LAYER.cheveux);
      }
    }
  });
});
