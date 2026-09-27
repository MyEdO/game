/**
 * DOUBLE PÉREMPTION du monde volumique (#1176) : la clé de mémo des acteurs (`actorPoseKey`, composée
 * par `stage/VolumetricWorld`) et l'identité de cache de texture (`BillboardSubject.identity`) se
 * dérivent de la MÊME signature d'entrées de dessin (`combatantRenderSignature`). Une entrée que le billboard
 * consomme ne peut donc plus périmer l'une sans l'autre.
 *
 * Chaque axe porte sa PREUVE D'EFFET dans le même test : le SVG rendu (ou l'échelle du sujet) diffère
 * VRAIMENT entre les deux états comparés — sinon la sonde ne pèserait rien.
 */
import { describe, expect, it } from 'vitest';
import { actorBillboards, actorPoseKey, combatantRenderSignature, type ActorPose } from './sceneMeshes';
import { emptyScene, sceneMetresPerTile } from '../../../state/scene';
import type { Combatant, Weapon } from '../../../engine/types';

const scene = emptyScene(6, 6);
const mpt = sceneMetresPerTile(scene);

/** Héros rendu depuis SON PROPRE inventaire (pas de `creatureId`, pas d'IA) : garde-robe = `career`,
 *  équipement = `weapons`/`items` — le chemin du groupe joueur. */
function héros(patch: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h1', label: 'Héros', kind: 'hero', pos: { x: 1, y: 1 }, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [], characteristics: {}, advantage: 0,
    conditions: [], armour: {}, skills: [], talents: [], movement: 4, career: 'soldat', species: 'humain',
    ...patch,
  } as unknown as Combatant;
}

const pose = (c: Combatant): ActorPose => ({ c, x: 1, y: 1, z: 0, facing: 'S' });
const sujet = (c: Combatant) => actorBillboards([pose(c)], scene, mpt)[0];
const svgDe = (c: Combatant) => sujet(c).svg('front', false, 0);

const ÉPÉE = { label: 'Épée', type: 'melee', group: 'base', damage: 4, shape: 'epee' } as unknown as Weapon;

describe('Signature de dessin d’un acteur — la clé de mémo ET l’identité de texture la portent', () => {
  const base = héros();

  const AXES: [string, Combatant][] = [
    ['career (garde-robe)', héros({ career: 'noble' })],
    ['weapons (équipement en main)', héros({ weapons: [ÉPÉE] })],
    ['size (échelle du jeton)', héros({ size: 'grande' })],
  ];

  for (const [axe, muté] of AXES)
    it(`${axe} : le dessin ou l’échelle change → la clé ET l’identity changent`, () => {
      // La sonde MORD : l'axe a un effet visuel mesurable.
      const effet = svgDe(base) !== svgDe(muté) || sujet(base).scaleK !== sujet(muté).scaleK;
      expect(effet, `${axe} n’a aucun effet visuel — la sonde ne pèse rien`).toBe(true);
      expect(actorPoseKey(pose(muté))).not.toBe(actorPoseKey(pose(base)));
      expect(sujet(muté).identity).not.toBe(sujet(base).identity);
    });

  it('un champ SANS effet visuel ne périme rien (la signature n’est pas un compteur)', () => {
    const compta = héros({ advantage: 3, wounds: { current: 12, max: 12 } });
    expect(svgDe(compta)).toBe(svgDe(base));
    expect(sujet(compta).scaleK).toBe(sujet(base).scaleK);
    expect(actorPoseKey(pose(compta))).toBe(actorPoseKey(pose(base)));
    expect(sujet(compta).identity).toBe(sujet(base).identity);
  });

  it('la signature est STABLE d’un appel à l’autre (aucune entrée d’horloge ni d’aléa)', () => {
    expect(combatantRenderSignature(base)).toBe(combatantRenderSignature(héros()));
  });

  it('l’identity reste ancrée sur l’ID du combattant, la signature ne le porte pas', () => {
    // L'apparence par défaut est SEMÉE par l'id (`defaultAppearance`) : deux héros nus se dessinent
    // différemment, donc leurs signatures divergent — c'est l'id, à part, qui garantit l'unicité.
    const jumeau = héros({ id: 'h2' });
    expect(sujet(jumeau).identity.startsWith('acteur:h2|')).toBe(true);
    expect(sujet(base).identity.startsWith('acteur:h1|')).toBe(true);
    expect(combatantRenderSignature(base)).toBe(sujet(base).identity.split('|')[1]);
  });
});
