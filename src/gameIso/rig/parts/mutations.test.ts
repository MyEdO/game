import { VIEWS, type View } from '../facing';
import { describe, it, expect } from 'vitest';
import { idsPhysiques, idsMentales, mutationById } from '../../../data/mutations';
import { combatantOverlays, combatantAppearance } from './combatantVisuals';
import { APPEARANCE_ELEMENTS } from './elements';
import { resolveRig } from '../composeRig';
import type { Combatant } from '../../../engine/types';
import type { Appearance } from '../appearance';
import { asRigSpeciesId } from '../appearance';

const APP: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 3 };
const NO_EQUIP = { weapons: [], armour: [] };
/** Combatant minimal porteur de mutations, résolues PAR ID (les autres champs lus — traits/traumas —
 *  sont undefined). */
const cm = (...ids: string[]): Combatant =>
  ({ mutations: ids.map((id) => mutationById(id)).filter(Boolean) } as unknown as Combatant);

describe('apparence data-driven des mutations (LDB 19)', () => {
  it('chaque mutation physique déclare son apparence (sauf Choix du MJ) ; clés de catalogue valides', () => {
    for (const id of idsPhysiques()) {
      const m = mutationById(id)!;
      if (id === 'choix-du-mj') { expect(m.appearance).toBeUndefined(); continue; }
      // Mutation NON-VISUELLE déclarée en donnée (Souffle du feu, Sang acide… : aucune manifestation
      // corporelle) → pas d'apparence attendue. C'est un état modélisé, pas un visuel différé.
      if (m.nonVisual) { expect(m.appearance, id).toBeUndefined(); continue; }
      expect(m.appearance, id).toBeTruthy();
      for (const k of m.appearance!.features ?? []) expect(APPEARANCE_ELEMENTS[k], `${id} → ${k}`).toBeTruthy();
    }
  });

  it('combatantOverlays : difformités → calques du catalogue (membre remplacé inclus)', () => {
    const ov = combatantOverlays(cm('tentacule-epais', 'groin-poilu'));
    // Tentacule = MEMBRE REMPLACÉ : bras gauche substitué + poing effacé.
    expect(ov.some((o) => o.svg.includes('data-mut="tentacule-epais"') && o.bone === 'epauleG' && o.replace)).toBe(true);
    expect(ov.some((o) => o.bone === 'mainG' && o.replace && o.svg === '')).toBe(true);
    expect(ov.some((o) => o.svg.includes('data-mut="groin-poilu"') && o.bone === 'tete')).toBe(true);
  });

  it('les mutations mentales ne produisent aucun calque', () => {
    expect(combatantOverlays(cm(...idsMentales()))).toEqual([]);
  });

  it('combatantAppearance : morpho cumulée (carrure/jambes) + clamp', () => {
    expect(combatantAppearance(APP, cm('corpulent')).build).toBeCloseTo(0.7);
    expect(combatantAppearance({ ...APP, build: 0.9 }, cm('corpulent')).build).toBe(1);
    expect(combatantAppearance(APP, cm('emacie')).build).toBeCloseTo(0.3);
    expect(combatantAppearance(APP, cm('court-sur-pattes')).legs).toBeCloseTo(0.78);
  });

  it('combatantAppearance : peau corps entier (prime), œil remplacé, visage inversé', () => {
    // Peau corps entier : la palette @peau est surchargée (prime sur la couleur choisie).
    expect(combatantAppearance(APP, cm('peau-d-acier')).colors?.peau).toBe('#8a93a0');
    expect(combatantAppearance({ ...APP, colors: { peau: '#112233' } }, cm('ecailles-epineuses')).colors?.peau).not.toBe('#112233');
    // Œil énorme remplace l'œil peint EN PLACE (clé d'œil → art résolu).
    expect(combatantAppearance(APP, cm('oeil-enorme')).eyes?.G).toContain('oeil-enorme');
    expect(combatantAppearance(APP, cm('visage-inverse')).faceFlip).toBe(true);
  });

  it('combatantAppearance : même référence si aucune mutation visuelle (stabilité des props)', () => {
    expect(combatantAppearance(APP, cm())).toBe(APP);
    expect(combatantAppearance(APP, cm('bete-interieure'))).toBe(APP); // mentale = pas de visuel
  });
});

describe('rendu rig des mutations (resolveRig)', () => {
  const partsOf = (view: View, c: Combatant) =>
    resolveRig(combatantAppearance(APP, c), NO_EQUIP, {}, undefined, view, combatantOverlays(c)).flatMap((b) => b.parts);

  it('détail de visage : visible de face, absent de dos', () => {
    expect(partsOf('front', cm('groin-poilu')).some((p) => p.svg.includes('data-mut="groin-poilu"'))).toBe(true);
    expect(partsOf('back', cm('groin-poilu')).some((p) => p.svg.includes('data-mut="groin-poilu"'))).toBe(false);
  });

  it('cornes : toutes vues, rendues DERRIÈRE la part de tête (behind → layer -2)', () => {
    for (const view of VIEWS) {
      const corne = partsOf(view, cm('cornes-asymetriques')).find((p) => p.svg.includes('data-mut="cornes-asymetriques"'));
      expect(corne, view).toBeTruthy();
      expect(corne!.layer).toBe(-2);
    }
  });

  it('Court sur pattes raccourcit les jambes (os cuisse plus court)', () => {
    const cuisse = (c: Combatant) =>
      resolveRig(combatantAppearance(APP, c), NO_EQUIP, {}, undefined, 'front', []).find((b) => b.id === 'cuisseG')!.scale[1];
    expect(cuisse(cm('court-sur-pattes'))).toBeLessThan(cuisse(cm()));
  });

  it('Visage inversé : le slot visage est rendu retourné (flip), pas les cheveux', () => {
    const tete = (c: Combatant) =>
      resolveRig(combatantAppearance(APP, c), NO_EQUIP, {}, undefined, 'front', []).find((b) => b.id === 'tete')!.parts;
    expect(tete(cm('visage-inverse')).filter((p) => p.svg.includes('translate(0,14) scale(1,-1)')).length).toBe(1);
    expect(tete(cm()).some((p) => p.svg.includes('scale(1,-1)'))).toBe(false);
  });
});
