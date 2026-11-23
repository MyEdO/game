import { describe, expect, it } from 'vitest';
import { arena } from '../../../src/scenes/test-scenarios/_shared';
import { loadRuleOverrides, rule } from '../../../src/engine/policy';
import { ouvrirEnAuto, REGLES_DU_ROGUELITE } from './partie';

describe('les règles optionnelles du roguelite', () => {
  it('toute partie ouverte par ouvrirEnAuto joue sous REGLES_DU_ROGUELITE, dont l’incantation VDM', () => {
    loadRuleOverrides({});
    expect(rule('magie-vdm-incantation')).toBe(false);
    const { partie } = ouvrirEnAuto(1, () => ({ party: [], scene: arena({ id: 'regles', label: 'Règles', w: 4, h: 4 }), projet: null }));
    expect(REGLES_DU_ROGUELITE).toMatchObject({ 'magie-vdm-incantation': true });
    for (const [id, valeur] of Object.entries(REGLES_DU_ROGUELITE)) expect(rule(id as 'magie-vdm-incantation'), id).toBe(valeur);
    partie.fermer();
  });
});
