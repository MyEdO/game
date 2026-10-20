import { describe, it, expect } from 'vitest';
import { CREATURES, defId } from './creatures';
import { SPECIES_BODY_SHAPE, bodyShapeForSpecies } from '../../engine/bodyForm';
import type { BodyShape } from '../../engine/types';
import type { CreatureDef } from './creatures/types';

/**
 * GARDE DE COHÉRENCE couche-de-rendu ↔ couche-de-règles (#187). Deux taxonomies coexistent :
 *  - le PLAN CORPOREL FIN de rendu (`CreatureDef.plan` : biped/quadruped/serpentine/arachnid/avian/
 *    winged/cephalopod/squig/…) — squelette + poses, dans `gameIso/rig` ;
 *  - la FORME DE CORPS grossière de règles (`BodyShape`, Tableau de Localisation LDB 76 p.312) —
 *    SOURCE DE VÉRITÉ neutre `engine/bodyForm.SPECIES_BODY_SHAPE`, lue par `noyau/monde/spawn.bodyShapeOf`.
 *
 * Le plan fin PROJETTE sur la forme grossière (many-to-one : tous les gabarits humanoïdes-like →
 * humanoïde). Ce test verrouille l'invariant « projection(plan) == forme déclarée » pour CHAQUE espèce :
 * si un `defs/` déclarait un plan de rendu contredisant la forme de règles (ou l'inverse), il échoue.
 * C'est ce qui autorise `bodyShapeOf` à ne PLUS router par le registre de rendu sans risque de dérive.
 */

/** Projection PLAN de rendu (fin) → FORME de corps de règles (grossier), LDB 76 p.312. */
function planToBodyShape(c: CreatureDef): BodyShape {
  switch (c.plan) {
    case 'quadruped': return 'quadrupede';
    // bipède de RENDU + queue/4 localisations de patte (Cornu/Carnosaure) → quadrupède ; MAIS le
    // trait optionnel `wings` (hybrides type Cockatrice, ZI 65 — grandes ailes MEMBRANEUSES
    // remplaçant les bras avant) déplace les localisations avant sur les ailes → table oiseau,
    // même bascule que winged/avian (ailes = bras, p.312).
    case 'theropode': return c.thero?.wings ? 'oiseau' : 'quadrupede';
    case 'avian':
    case 'winged': return 'oiseau'; // ailes = bras (p.312), tableau humanoïde réétiqueté
    case 'serpentine': return 'serpent';
    case 'arachnid': return 'araignee';
    default: return 'humanoide'; // biped/cephalopod/squig/amorphous/spectral/jabberslythe/crustace/fish/… → table par défaut
  }
}

describe('cohérence plan de rendu ↔ forme de corps de règles (LDB p.312, #187)', () => {
  it('chaque espèce du registre de rig projette sur SA forme de corps déclarée (engine/bodyForm)', () => {
    const mismatches: string[] = [];
    for (const c of CREATURES) {
      const id = defId(c);
      const projected = planToBodyShape(c);
      const declared = bodyShapeForSpecies(id);
      if (projected !== declared) mismatches.push(`${id} : plan '${c.plan}' → ${projected}, mais bodyForm déclare ${declared}`);
    }
    expect(
      mismatches,
      'Dérive taxonomie rendu ↔ règles (#187). Corriger `engine/bodyForm.SPECIES_BODY_SHAPE` OU le `plan` du def :\n  ' +
        mismatches.join('\n  '),
    ).toEqual([]);
  });

  it('aucune espèce fantôme dans le registre de règles (toute clé de SPECIES_BODY_SHAPE est une espèce du rig)', () => {
    const known = new Set(CREATURES.map(defId));
    const ghosts = Object.keys(SPECIES_BODY_SHAPE).filter((sp) => !known.has(sp));
    expect(ghosts, `Espèces déclarées dans engine/bodyForm mais absentes du registre de rig : ${ghosts.join(', ')}`).toEqual([]);
  });
});
