import { describe, it, expect } from 'vitest';
import { resolveRig } from '../../composeRig';
import type { Appearance } from '../../../../engine/authoringAppearance';
import { asRigSpeciesId } from '../../appearance';
import { equipDe } from '../../../../noyau/equipementDessine';


// Canal `TenueDef.overlays` (#pelisse-loup-blanc) : une tenue peut déclarer un calque
// ASYMÉTRIQUE attaché à un os précis, à PLAN dédié (échappe au z inégal des bras
// epauleG/epauleD — cf. `parts/dorsal.ts`). Chevalier du Loup Blanc est l'étalon : de DOS,
// son crâne de loup + monticule de pelisse débordent l'épaule DROITE du personnage
// (bone `epauleD`, plan `avant`, vue `back` — depuis #644 it3 la vue `front` n'a plus
// d'overlay : crâne et pelisse y vivent dans le slot torse, à x négatif).
const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 7 };

describe('canal TenueDef.overlays — pauldron asymétrique (plane)', () => {
  it('epauleD porte DEUX entrées (bras normal z=8 + calque à plan z=99), jamais mirroité', () => {
    const bones = resolveRig(app, equipDe([], []), {}, 'chevalier-du-loup-blanc', 'back');
    const epauleD = bones.filter((b) => b.id === 'epauleD');
    expect(epauleD.length).toBe(2);
    const planeEntry = epauleD.find((b) => b.z === 99);
    expect(planeEntry).toBeTruthy();
    expect(planeEntry!.parts.every((p) => !p.mirror)).toBe(true);
  });

  it("le calque n'est JAMAIS dupliqué sur epauleG (asymétrie réelle, pas un miroir)", () => {
    const bones = resolveRig(app, equipDe([], []), {}, 'chevalier-du-loup-blanc', 'back');
    const epauleG = bones.filter((b) => b.id === 'epauleG');
    expect(epauleG.length).toBe(1); // seul le bras normal (slot `bras`), aucun plan-overlay
  });

  it('une tenue SANS overlays (défaut des 117 autres) ne produit aucune entrée à plan supplémentaire', () => {
    const bones = resolveRig(app, equipDe([], []), {}, 'citadins', 'front');
    const epauleD = bones.filter((b) => b.id === 'epauleD');
    expect(epauleD.length).toBe(1); // une seule epauleD : le bras normal, aucun plan-overlay
  });
});
