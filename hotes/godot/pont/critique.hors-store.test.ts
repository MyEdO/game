/**
 * LE COUP CRITIQUE À L'ÉCRAN (#3328) : la vue figée « Coup Critique » (`figerVuesDeLEcran`, le combat du dôme joué par le
 * pont jusqu'au premier Coup Critique) : la fenêtre dit sa localisation, les Blessures perdues, les États infligés et
 * ses effets, et pas seulement son titre.
 */
import { describe, it, expect } from 'vitest';
import { figerVuesDeLEcran } from '../recettes/ecran';
import type { Puce } from '../../../src/hote/elements';

describe('le Coup Critique à l’écran', () => {
  it('l’étape qui révèle un Coup Critique le dit dans la fenêtre', () => {
    const corps = figerVuesDeLEcran().find((v) => v.nom === 'Coup Critique')!.zones['fenetre.corps'];
    const puces = corps.filter((e): e is Puce => e.type === 'puce');
    expect(puces.find((p) => p.id === 'critique/localisation')?.valeur, 'la localisation du Coup Critique').toBeTruthy();
    expect(new Set(puces.map((p) => p.ton)).size, 'un seul ton : celui du camp de la victime').toBe(1);
    expect(corps.filter((e) => e.id.startsWith('critique/effet/')).length, 'chacun de ses effets en ligne').toBeGreaterThan(0);
  });
});
