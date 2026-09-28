/**
 * Câblage store — `arcaneDomainGate` (`src/engine/careerSlots.ts`) sur le chemin RÉEL d'achat
 * (`useGame.getState().buyTalent`, `partyFlow.ts`). La suite pure `careerSlots.test.ts` verrouille
 * le gate en isolation ; celle-ci verrouille qu'il est bien BRANCHÉ dans le store.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pregen, PREGEN } from '../data/pregens';
import type { Combatant } from '../engine/types';

// Carrière « Mystique » Niveau 4 (« Prophète », careerLevels.json) : emplacement de talent
// EXPLICITE « Magie des Arcanes (Cieux) » — sert de 2e Domaine à un lanceur qui possède déjà Feu.
const FEU_SPELLS = ['cauteriser', 'coeurs-ardents', 'couronne-de-flammes', 'grands-feux-d-u-zhul', 'l-egide-d-aqshy', 'l-epee-ardente-de-rhuin', 'mur-de-feu', 'purification'];

function elfProphete(over: Partial<Combatant> = {}): Combatant {
  const w = pregen(PREGEN.sorcier);
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
  const w = pregen(PREGEN.sorcier);
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

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [] });
  useGame.getState().seedRng(1);
});

describe('buyTalent — arcaneDomainGate câblé (VDM 02 l.190-192)', () => {
  it('REFUSE un 2e Domaine (Cieux) tant que le Domaine précédent (Feu) n\'est pas assez maîtrisé', () => {
    const h = elfProphete();
    useGame.setState({ party: [h] });
    useGame.getState().buyTalent(h.id, 'magie-des-arcanes', 'cieux');
    const after = useGame.getState().party[0];
    expect(after.talents.some((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'cieux')).toBe(false);
    expect(after.xp).toBe(500); // PX non débités
    expect(useGame.getState().journal.join('\n')).toMatch(/Domaine précédent/);
  });

  it('ACCEPTE le 2e Domaine une fois le verrou franchi (20 Améliorations Focalisation + 8 Sorts)', () => {
    const h = elfProphete({
      skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 20 }],
      spells: FEU_SPELLS,
    });
    useGame.setState({ party: [h] });
    useGame.getState().buyTalent(h.id, 'magie-des-arcanes', 'cieux');
    const after = useGame.getState().party[0];
    expect(after.talents.some((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'cieux')).toBe(true);
    expect(after.xp).toBe(400); // 500 − 100 PX (première acquisition)
  });
});

describe('buyTalent — Maxi de Magie des Arcanes compté par Domaine (LDB 46 l.177)', () => {
  it('ACCEPTE un Domaine sombre (Nécromancie) en plus de Feu', () => {
    const h = sorcierHumain();
    useGame.setState({ party: [h] });
    useGame.getState().buyTalent(h.id, 'magie-des-arcanes', 'necromancie');
    const after = useGame.getState().party[0];
    expect(after.talents.some((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'necromancie')).toBe(true);
    expect(after.xp).toBe(400);
  });

  it('REFUSE un Domaine déjà tenu (Maxi 1, LDB 10 l.682)', () => {
    const h = sorcierHumain();
    useGame.setState({ party: [h] });
    useGame.getState().buyTalent(h.id, 'magie-des-arcanes', 'feu');
    const after = useGame.getState().party[0];
    expect(after.talents.find((t) => t.talentId === 'magie-des-arcanes' && t.spec === 'feu')?.times).toBe(1);
    expect(after.xp).toBe(500);
    expect(useGame.getState().journal.join('\n')).toMatch(/Maxi atteint/);
  });
});
