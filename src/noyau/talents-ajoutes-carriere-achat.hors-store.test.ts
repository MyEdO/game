/**
 * Câblage du noyau — un Talent AJOUTÉ à la carrière (`talentEnCarriere`, `src/engine/talentEffects.ts`) s'achète
 * par le chemin RÉEL d'achat (`banc.getState().acheterLeTalent`, `partyFlow.ts`), la même définition que
 * les rangées de l'écran d'avancement (`buildAdvancementView`, `talentsAjoutesALaCarriere`).
 * EDOC 13 l.524 (Marque de Tzeentch) ; LDB 07 l.103.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { buildAdvancementView } from './monde/advancement';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function soldat(over: Partial<Combatant> = {}): Combatant {
  return { ...herosDeScenario(idsDeTest, 'soldat'), xp: 500, ...over } as Combatant;
}

const MARQUE = [{ id: 'marque-de-tzeentch' }];

beforeEach(() => {
  banc.setState({ battle: null, party: [], journal: [] });
  banc.getState().ensemencerLeTirage(1);
});

describe('acheterLeTalent — ajouts de carrière d’un Trait (EDOC 13 l.524)', () => {
  it('porteur de la Marque de Tzeentch : la rangée d’avancement s’ACHÈTE — PX débités, Talent acquis', () => {
    const h = soldat({ traits: [...(herosDeScenario(idsDeTest, 'soldat').traits ?? []), ...MARQUE] });
    expect(h.talents.some((t) => t.talentId === 'magie-des-arcanes')).toBe(false);
    expect(buildAdvancementView({ battle: null, flags: {} }, h).talents.some((r) => r.talentId === 'magie-des-arcanes' && r.spec === 'feu')).toBe(true);
    banc.setState({ party: [h] });
    banc.getState().acheterLeTalent(h.id, { id: 'magie-des-arcanes', spec: 'feu' });
    const apres = banc.getState().party[0];
    expect(apres.talents.find((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'feu')?.times).toBe(1);
    expect(apres.xp).toBe(400);
  });

  it('sans la Marque : ni rangée, ni achat — refus « hors carrière », PX intacts', () => {
    const h = soldat();
    expect(buildAdvancementView({ battle: null, flags: {} }, h).talents.some((r) => r.talentId === 'magie-des-arcanes')).toBe(false);
    banc.setState({ party: [h] });
    banc.getState().acheterLeTalent(h.id, { id: 'magie-des-arcanes', spec: 'feu' });
    const apres = banc.getState().party[0];
    expect(apres.talents.some((t) => t.talentId === 'magie-des-arcanes')).toBe(false);
    expect(apres.xp).toBe(500);
    expect(banc.getState().journal.join('\n')).toMatch(/hors carrière/);
  });
});
