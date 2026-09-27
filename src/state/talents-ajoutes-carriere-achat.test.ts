/**
 * Câblage store — un Talent AJOUTÉ à la carrière (`talentEnCarriere`, `src/engine/talentEffects.ts`) s'achète
 * par le chemin RÉEL d'achat (`useGame.getState().buyTalent`, `partyFlow.ts`), la même définition que
 * les rangées de l'écran d'avancement (`buildAdvancementView`, `talentsAjoutesALaCarriere`).
 * EDOC 13 l.524 (Marque de Tzeentch) ; LDB 07 l.103.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pregen, PREGEN } from '../data/pregens';
import { buildAdvancementView } from './advancement';
import type { Combatant } from '../engine/types';

function soldat(over: Partial<Combatant> = {}): Combatant {
  return { ...pregen(PREGEN.soldat), xp: 500, ...over } as Combatant;
}

const MARQUE = [{ id: 'marque-de-tzeentch' }];

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [] });
  useGame.getState().seedRng(1);
});

describe('buyTalent — ajouts de carrière d’un Trait (EDOC 13 l.524)', () => {
  it('porteur de la Marque de Tzeentch : la rangée d’avancement s’ACHÈTE — PX débités, Talent acquis', () => {
    const h = soldat({ traits: [...(pregen(PREGEN.soldat).traits ?? []), ...MARQUE] });
    expect(h.talents.some((t) => t.talentId === 'magie-des-arcanes')).toBe(false);
    expect(buildAdvancementView(h).talents.some((r) => r.talentId === 'magie-des-arcanes' && r.spec === 'feu')).toBe(true);
    useGame.setState({ party: [h] });
    useGame.getState().buyTalent(h.id, 'magie-des-arcanes', 'feu');
    const apres = useGame.getState().party[0];
    expect(apres.talents.find((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'feu')?.times).toBe(1);
    expect(apres.xp).toBe(400);
  });

  it('sans la Marque : ni rangée, ni achat — refus « hors carrière », PX intacts', () => {
    const h = soldat();
    expect(buildAdvancementView(h).talents.some((r) => r.talentId === 'magie-des-arcanes')).toBe(false);
    useGame.setState({ party: [h] });
    useGame.getState().buyTalent(h.id, 'magie-des-arcanes', 'feu');
    const apres = useGame.getState().party[0];
    expect(apres.talents.some((t) => t.talentId === 'magie-des-arcanes')).toBe(false);
    expect(apres.xp).toBe(500);
    expect(useGame.getState().journal.join('\n')).toMatch(/hors carrière/);
  });
});
