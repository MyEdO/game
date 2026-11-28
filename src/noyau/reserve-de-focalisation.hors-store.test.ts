/**
 * Câblage noyau de la réserve de Focalisation : VDM 02 l.131-135, l.178 ; LDB 46 l.132 ; LDB 47 l.21.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ligneDeTexte } from '../engine/journal';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { adresseDeCreation } from '../engine/adresseDeCreation';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { buildAiInput, castSpell, withPreRollFixedDie } from './combatFlow';
import type { BattleState } from './etat';
import { emptyScene } from './monde/scene';
import { spawnEnemy } from './monde/spawn';
import { niSansFocalisation, focalisationAboutie, focusDRExpectation } from '../engine/magic';
import type { CastableSpell } from './monde/ai';
import { canCastFromGrimoire } from '../engine/grimoire';
import { findSpellById } from '../data';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); banc.getState().ensemencerLeTirage(21); setRule('magie-vdm-incantation', true); });
afterEach(() => resetRule('magie-vdm-incantation'));

function sorciere(): Combatant {
  const w = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 707, careerTalent: { id: 'magie-mineure' }, specChoices: { [adresseDeCreation.carriereCompetence(3)]: 'feu' }, talentsRolled: false });
  w.skills.push({ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 8 } as never);
  w.spells = ['cauteriser', 'coeurs-ardents', ...(w.spells ?? [])];
  return w;
}

describe('réserve de Focalisation — focaliser puis lancer un autre sort du même Vent (VDM 02 l.131)', () => {
  it('2 DR focalisés sur Cautériser : Cœurs ardents (NI 8) se lance au NI 6', () => {
    const w = sorciere();
    banc.setState({ party: [w] });
    banc.setState({ pendingFocus: { casterId: w.id, spellId: 'cauteriser', result: { dr: 2, success: true, isCritical: false, isFumble: false, roll: 33, log: ligneDeTexte('focalisation') } } });
    banc.getState().jetValider('focalisation');
    expect(banc.getState().party.find((h) => h.id === w.id)!.focus).toEqual({ spell: 'cauteriser', dr: 2 });

    banc.setState({ pendingCast: { casterId: w.id, targetId: w.id, spellId: 'coeurs-ardents', missile: false, result: null } });
    banc.getState().jetLancer('incantation');
    expect(banc.getState().pendingCast!.result!.niRequired).toBe(6);
  });
});

describe('IA : la Focalisation est prête au NI sans réserve (LDB 46 l.128, l.132)', () => {
  function pretPour(dr: number, option = false): CastableSpell['focusState'] | undefined {
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

describe('IA : Rounds de Focalisation espérés jusqu’au NI 0 (LDB 46 l.130, l.132 ; VDM 02 l.131, l.133)', () => {
  function plan(focus: { spellId: string; dr: number }, option: boolean) {
    setRule('magie-vdm-incantation', option);
    const { lanceur } = auCombat(focus);
    const coeurs = buildAiInput(lanceur, banc.getState).spells.find((s) => s.id === 'coeurs-ardents')!;
    return { focusState: coeurs.focusState, parRound: focusDRExpectation(lanceur, coeurs.data)! };
  }

  it('option active : 2 DR sur Cautériser, Cœurs ardents (NI 8) reste à 6', () => {
    const { focusState, parRound } = plan({ spellId: 'cauteriser', dr: 2 }, true);
    expect(Math.ceil(6 / parRound)).not.toBe(Math.ceil(8 / parRound));
    expect(focusState).toMatchObject({ rounds: Math.ceil(6 / parRound) });
  });

  it('option désactivée : 3 DR sur Cœurs ardents (NI 8) restent acquis, 5 à focaliser', () => {
    const { focusState, parRound } = plan({ spellId: 'coeurs-ardents', dr: 3 }, false);
    expect(Math.ceil(5 / parRound)).not.toBe(Math.ceil(8 / parRound));
    expect(focusState).toMatchObject({ rounds: Math.ceil(5 / parRound) });
  });
});

/** Combat : la sorcière (focalisée par la couture `focalisation`) face à un ennemi qui sait dissiper. */
function auCombat(focus: { spellId: string; dr: number }, dissipateur = false) {
  const w = sorciere();
  w.characteristics.intelligence = 50;
  w.skills = [...w.skills.filter((s) => s.id !== 'langue'), { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 }];
  w.pos = { x: 5, y: 5 };
  banc.setState({ party: [w] });
  banc.setState({ pendingFocus: { casterId: w.id, spellId: focus.spellId, result: { dr: focus.dr, success: true, isCritical: false, isFumble: false, roll: 33, log: ligneDeTexte('focalisation') } } });
  banc.getState().jetValider('focalisation');
  const lanceur = banc.getState().party.find((h) => h.id === w.id)!;
  const e = spawnEnemy({ ref: 'humain' }, 'e', { x: 7, y: 5 });
  e.skills = dissipateur ? [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 100 }] : [];
  const order = [lanceur.id, e.id];
  const battle: BattleState = {
    combatants: [lanceur, e], order, baseOrder: order, turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  };
  banc.setState({ mode: 'battle', scene: emptyScene('s', 20, 20) as never, battle, party: [lanceur], net: { ...banc.getState().net, gmSeat: 0 } });
  return { lanceur, e };
}

function incanterAvec(de: number): void {
  const jeu = banc.getState;
  withPreRollFixedDie(jeu, banc.setState, () => jeu().jetLancer('incantation'), () => jeu().jetImposerLeResultat('incantation', de));
}

const kindsDeLaCascade = () => (banc.getState().pendingCascade?.participants ?? []).map((p) => p.kind);

describe('Dissipation d’un lancement focalisé (VDM 02 l.133, l.135, l.178)', () => {
  it('Contre-sort gagné : Sort dissipé, réserve perdue, aucune Incantation Imparfaite', () => {
    const { lanceur, e } = auCombat({ spellId: 'cauteriser', dr: 2 }, true);
    castSpell(banc.getState, banc.setState, lanceur, e, 'carreau');
    incanterAvec(7);
    expect(banc.getState().pendingCast?.result).toMatchObject({ cast: true, niRequired: 2 });
    banc.getState().jetRegler('contreSort', 'declaration', 'solo', e.id);
    banc.getState().jetLancer('contreSort', e.id);
    banc.getState().jetImposerLeResultat('contreSort', 7, e.id);
    banc.getState().jetValider('contreSort');
    expect(banc.getState().pendingCast?.result).toMatchObject({ cast: false, dispelled: true });
    banc.getState().jetValider('incantation');
    expect(banc.getState().pendingCast).toBeNull();
    expect(kindsDeLaCascade()).not.toContain('tableDIncantationImparfaite');
    expect(banc.getState().battle!.combatants.find((c) => c.id === lanceur.id)!.focus).toBeUndefined();
  });
});

describe('Projectile magique sur soi avec une réserve (LDB 46 l.132 ; VDM 02 l.133)', () => {
  it('la réserve est dépensée avant la touche : aucun Test de Focalisation interrompue', () => {
    const { lanceur } = auCombat({ spellId: 'cauteriser', dr: 2 });
    const avant = lanceur.wounds.current;
    castSpell(banc.getState, banc.setState, lanceur, lanceur, 'carreau');
    incanterAvec(7);
    expect(banc.getState().pendingCast?.result).toMatchObject({ cast: true, niRequired: 2 });
    banc.getState().jetValider('incantation');
    const apres = banc.getState().battle!.combatants.find((c) => c.id === lanceur.id)!;
    expect(apres.wounds.current).toBeLessThan(avant);
    expect(apres.focus).toBeUndefined();
    expect(kindsDeLaCascade()).not.toContain('testDeclenche');
  });
});

describe('Focalisation d’un Sort lu au grimoire (LDB 46 l.132 ; LDB 47 l.21)', () => {
  function lectrice(): Combatant {
    const w = sorciere();
    w.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 });
    w.spells = (w.spells ?? []).filter((s) => s !== 'coeurs-ardents');
    w.items = [...(w.items ?? []), { uid: 'g1', name: 'Grimoire', trappingId: 'grimoire', kind: 'misc', enc: 1, qualities: [] } as never];
    return w;
  }
  function focaliserPuisLire(w: Combatant, spellId: string, dr: number): Combatant {
    banc.setState({ party: [w] });
    banc.setState({ pendingFocus: { casterId: w.id, spellId, result: { dr, success: true, isCritical: false, isFumble: false, roll: 33, log: ligneDeTexte('focalisation') } } });
    banc.getState().jetValider('focalisation');
    return banc.getState().party.find((h) => h.id === w.id)!;
  }
  const coeurs = findSpellById('coeurs-ardents')!;

  it('option désactivée : aboutie au NI doublé, puis lancée au grimoire à NI 0', () => {
    setRule('magie-vdm-incantation', false);
    expect(canCastFromGrimoire(lectrice(), coeurs)).toBe(true);
    expect(focalisationAboutie(focaliserPuisLire(lectrice(), coeurs.id, coeurs.cn!), coeurs)).toBe(false);
    const w = focaliserPuisLire(lectrice(), coeurs.id, 2 * coeurs.cn!);
    expect(focalisationAboutie(w, coeurs)).toBe(true);
    banc.getState().incanterLeSort(w.id, coeurs.id, w.id, true);
    expect(banc.getState().pendingCast?.grimoire).toBe(true);
    banc.getState().jetLancer('incantation');
    expect(banc.getState().pendingCast!.result!.niRequired).toBe(0);
  });

  it('option active : la réserve s’applique après le doublement (VDM 02 l.133)', () => {
    const w = focaliserPuisLire(lectrice(), 'cauteriser', 3);
    banc.getState().incanterLeSort(w.id, coeurs.id, w.id, true);
    banc.getState().jetLancer('incantation');
    expect(banc.getState().pendingCast!.result!.niRequired).toBe(2 * coeurs.cn! - 3);
  });
});
