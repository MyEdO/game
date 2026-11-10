/**
 * Câblage du noyau — `arcaneDomainGate` (`src/engine/careerSlots.ts`) sur le chemin RÉEL d'achat
 * (`banc.getState().acheterLeTalent`, `partyFlow.ts`). La suite pure `careerSlots.test.ts` verrouille
 * le gate en isolation ; celle-ci verrouille qu'il est bien BRANCHÉ dans le noyau.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Carrière « Mystique » Niveau 4 (« Prophète », careerLevels.json) : emplacement de talent
// EXPLICITE « Magie des Arcanes (Cieux) » — sert de 2e Domaine à un lanceur qui possède déjà Feu.
const FEU_SPELLS = ['cauteriser', 'coeurs-ardents', 'couronne-de-flammes', 'grands-feux-d-u-zhul', 'l-egide-d-aqshy', 'l-epee-ardente-de-rhuin', 'mur-de-feu', 'purification'];

function elfProphete(over: Partial<Combatant> = {}): Combatant {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  return {
    ...w,
    species: 'hauts-elfes', // arcaneDomainsBonusOf: force-mentale → cap > 1
    career: 'mystique',
    careerLevel: 4,
    characteristics: { ...w.characteristics, 'force-mentale': 42 }, // Bonus 4 → plafond largement au-dessus de 2
    talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }],
    skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 5 }],
    spells: [],
    xp: 500,
    ...over,
  } as Combatant;
}

// Carrière « Sorcier » Niveau 2 : emplacement « Magie des Arcanes (Au choix) », non désigné.
function sorcierHumain(): Combatant {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  return {
    ...w,
    species: 'humains-reiklander',
    career: 'sorcier',
    careerLevel: 2,
    careerSlotChoices: {},
    talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }],
    skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 5 }],
    spells: [],
    xp: 500,
  };
}


describe('acheterLeTalent — arcaneDomainGate câblé (VDM 02 l.190-192)', () => {
  it('REFUSE un 2e Domaine (Cieux) tant que le Domaine précédent (Feu) n\'est pas assez maîtrisé', () => {
    const h = elfProphete();
    banc.setState({ party: [h] });
    banc.getState().acheterLeTalent(h.id, { id: 'magie-des-arcanes', spec: 'cieux' });
    const after = banc.getState().party[0];
    expect(after.talents.some((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'cieux')).toBe(false);
    expect(after.xp).toBe(500); // PX non débités
    expect(banc.getState().journal.join('\n')).toMatch(/Domaine précédent/);
  });

  it('ACCEPTE le 2e Domaine une fois le verrou franchi (20 Améliorations Focalisation + 8 Sorts)', () => {
    const h = elfProphete({
      skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 20 }],
      spells: FEU_SPELLS,
    });
    banc.setState({ party: [h] });
    banc.getState().acheterLeTalent(h.id, { id: 'magie-des-arcanes', spec: 'cieux' });
    const after = banc.getState().party[0];
    expect(after.talents.some((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'cieux')).toBe(true);
    expect(after.xp).toBe(400); // 500 − 100 PX (première acquisition)
  });
});

describe('acheterLeTalent — Maxi de Magie des Arcanes compté par Domaine (LDB 46 l.177)', () => {
  it('ACCEPTE un Domaine sombre (Nécromancie) en plus de Feu', () => {
    const h = sorcierHumain();
    banc.setState({ party: [h] });
    banc.getState().acheterLeTalent(h.id, { id: 'magie-des-arcanes', spec: 'necromancie' });
    const after = banc.getState().party[0];
    expect(after.talents.some((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'necromancie')).toBe(true);
    expect(after.xp).toBe(400);
  });

  it('REFUSE un Domaine déjà tenu (Maxi 1, LDB 10 l.682)', () => {
    const h = sorcierHumain();
    banc.setState({ party: [h] });
    banc.getState().acheterLeTalent(h.id, { id: 'magie-des-arcanes', spec: 'feu' });
    const after = banc.getState().party[0];
    expect(after.talents.find((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'feu')?.times).toBe(1);
    expect(after.xp).toBe(500);
    expect(banc.getState().journal.join('\n')).toMatch(/Maxi atteint/);
  });
});
