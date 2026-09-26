import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { buildAdvancementView } from '../../state/advancement';
import { scenario } from './niveau-complet';

/** LDB 07 l.124 : chaque héros du scénario franchit (ou non) la porte « Niveau complet » en UN achat de Talent
 *  sur le chemin réel (`useGame.buyTalent`). Comme en carrière : EDOC 13 l.524 ; ajout : LDB 10 l.467. */

beforeEach(() => {
  useGame.setState({ battle: null, party: scenario.makeParty(), journal: [] });
});

const heros = (id: string) => useGame.getState().party.find((h) => h.id === id)!;

describe('niveau-complet — la porte de LDB 07 l.124 en un achat', () => {
  it('au lancement : aucun Niveau complet, les PX d’UN Talent chacun, Frénésie et Mains agiles proposées', () => {
    for (const h of useGame.getState().party) {
      const v = buildAdvancementView(h);
      expect(v.completed).toBe(false);
      expect(v.xp).toBe(v.talents.find((t) => t.talentId === 'sociable')!.nextCost);
    }
    expect(buildAdvancementView(heros('nc-flagellant')).talents.some((t) => t.talentId === 'frenesie')).toBe(true);
    expect(buildAdvancementView(heros('nc-tzeentch')).talents.some((t) => t.talentId === 'mains-agiles')).toBe(true);
  });

  it.each([
    ['nc-carriere', 'sociable', true],
    ['nc-tzeentch', 'mains-agiles', false],
    ['nc-flagellant', 'frenesie', true],
  ] as const)('%s achète %s : Niveau complet = %s, PX épuisés', (id, talentId, complet) => {
    useGame.getState().buyTalent(id, talentId);
    const h = heros(id);
    expect(h.talents.some((t) => t.talentId === talentId && t.times === 1)).toBe(true);
    expect(h.xp).toBe(0);
    expect(buildAdvancementView(h).completed).toBe(complet);
  });

  it('contre-témoin : nc-tzeentch complète son Niveau en achetant Sociable, Talent de sa carrière', () => {
    useGame.getState().buyTalent('nc-tzeentch', 'mains-agiles');
    expect(buildAdvancementView(heros('nc-tzeentch')).completed).toBe(false);
    useGame.setState({ party: useGame.getState().party.map((h) => (h.id === 'nc-tzeentch' ? { ...h, xp: 1000 } : h)) });
    useGame.getState().buyTalent('nc-tzeentch', 'sociable');
    expect(heros('nc-tzeentch').talents.some((t) => t.talentId === 'sociable' && t.times === 1)).toBe(true);
    expect(buildAdvancementView(heros('nc-tzeentch')).completed).toBe(true);
  });
});
