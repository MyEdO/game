/**
 * Câblage noyau de la réserve de Focalisation sous `magie-vdm-incantation` : VDM 02 l.131-135.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { buildAiInput } from './combatFlow';
import { emptyScene } from './monde/scene';
import { niSansFocalisation } from '../engine/magic';
import { findSpellById } from '../data';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); banc.getState().ensemencerLeTirage(21); setRule('magie-vdm-incantation', true); });
afterEach(() => resetRule('magie-vdm-incantation'));

function sorciere(): Combatant {
  const w = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 707, careerTalent: { id: 'magie-mineure' }, talentsRolled: false });
  w.skills.push({ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 8 } as never);
  w.spells = ['cauteriser', 'coeurs-ardents', ...(w.spells ?? [])];
  return w;
}

describe('réserve de Focalisation — focaliser puis lancer un autre sort du même Vent (VDM 02 l.131)', () => {
  it('2 DR focalisés sur Cautériser : Cœurs ardents (NI 8) se lance au NI 6', () => {
    const w = sorciere();
    banc.setState({ party: [w] });
    banc.setState({ pendingFocus: { casterId: w.id, spellId: 'cauteriser', result: { dr: 2, success: true, isCritical: false, isFumble: false, roll: 33, log: 'focalisation' } } });
    banc.getState().jetValider('focalisation');
    expect(banc.getState().party.find((h) => h.id === w.id)!.focus).toEqual({ spell: 'cauteriser', dr: 2 });

    banc.setState({ pendingCast: { casterId: w.id, targetId: w.id, spellId: 'coeurs-ardents', missile: false, result: null } });
    banc.getState().jetLancer('incantation');
    expect(banc.getState().pendingCast!.result!.niRequired).toBe(6);
  });
});

describe('IA : la Focalisation est prête au NI sans réserve (LDB 46 l.128, l.132)', () => {
  function pretPour(dr: number, option = false): string | undefined {
    setRule('magie-vdm-incantation', option);
    const w: Combatant = { ...sorciere(), kind: 'ennemi', pos: { x: 5, y: 5 }, focus: { spell: 'coeurs-ardents', dr } };
    const h: Combatant = { ...sorciere(), id: 'h', kind: 'heros', pos: { x: 1, y: 1 } };
    banc.setState({
      battle: { combatants: [w, h], order: [w.id, h.id], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [], partyPos: { x: 0, y: 0 }, facing: {}, scene: emptyScene('s') as never, gameTime: 0, lightLevel: 1,
    });
    return buildAiInput(w, banc.getState).spells.find((s) => s.id === 'coeurs-ardents')?.focusState;
  }

  it('DR égaux au NI imprimé → prêt ; un DR de moins → pas prêt', () => {
    const coeurs = findSpellById('coeurs-ardents')!;
    expect(niSansFocalisation(coeurs, sorciere())).toBe(coeurs.cn);
    expect(pretPour(coeurs.cn!)).toBe('ready');
    expect(pretPour(coeurs.cn! - 1)).not.toBe('ready');
  });

  it('option active : DR sous le NI imprimé → pas prêt, même au-dessus du NI réduit (VDM 02 l.131-133)', () => {
    expect(pretPour(5, true)).not.toBe('ready');
  });
});
