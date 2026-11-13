/**
 * Inversion de Test (LDB 12 l.42) : chaque source ne s'offre que sur les Tests que son passage vise
 * (contexte de Test), et l'aperçu comme la condition du Talent sont l'issue que la rangée écrit.
 * ADE II 09 l.33 (jeton de Convalescence), LDB 21 l.9/l.27, LDB 23 l.218, LDB 10 l.899/l.966,
 * EDOC 8 l.172, MDG 09 l.54
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { cascadeDeTest } from './cascade.testkit';
import { cleDeFixture } from './noyau.testkit';
import { FLOWS } from './rollFlowSpecs';
import { initialNet } from './etat';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { appliquerIssueActivite } from './activityIssue';
import { applyOps, type GameOp } from '../engine/ops';
import { activityById, travelActivitySpec } from '../engine/activities';
import { unarmedWeapon } from '../engine/items';
import { makeRNG } from '../engine/dice';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';
import type { BatchParticipant, CascadeStep } from './pendings';
import { monoStep } from './rollSeam';
import { fixtureText } from '../i18n/fixtureText';

const CHARS = { force: 40, dexterite: 40, agilite: 40, endurance: 40, 'force-mentale': 55, 'capacite-de-combat': 45, 'capacite-de-tir': 45, initiative: 40, intelligence: 40, sociabilite: 40 };
const heros = (id: string, over: Partial<Combatant> = {}): Combatant => blessuresSurLeProfil({
  id, name: id, label: id, kind: 'heros', characteristics: { ...CHARS }, wounds: blessuresDeBase(10), advantage: 0,
  conditions: [], traumas: [], resilience: 0, fortune: 0, weapons: [unarmedWeapon()], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, skills: [], talents: [], movement: 4,
  bodyShape: 'humanoide', pos: { x: 0, y: 0 }, ...over,
}) as unknown as Combatant;

const jeton = (c: Combatant, op: Omit<Extract<GameOp, { op: 'grantReverseToken' }>, 'op'>, label = 'Source'): Combatant => {
  applyOps(c, [{ op: 'grantReverseToken', ...op }], { idNeuf: idsDeTest, rng: makeRNG(1), label });
  return c;
};
const JETON_CONVALESCENCE = { skill: { id: 'calme' }, contexte: 'psych' } as const;
const jetonsDe = (banc: Banc, id: string) => (banc.getState().battle?.combatants ?? banc.getState().party).find((c) => c.id === id)!.activeEffects ?? [];

/** Une rangée de Calme, cible 55, dé 64 posé (échec, DR −1). */
const RANGEE: BatchParticipant = { id: 'H', interactive: true, base: 55, target: 55, skill: { id: 'calme' }, result: { roll: 64, target: 55, sl: -1, success: false } };

/** Bande ouverte sur `H` : les champs d'étape sont ceux que posent les producteurs (`combatPsychBands`,
 *  `psychologieDeRencontre`, bandes de voyage). */
type ChampsDeBande = { kind?: CascadeStep['kind']; contexte?: CascadeStep['contexte']; meta?: CascadeStep['meta'] };
function bande(banc: Banc, h: Combatant, etape: ChampsDeBande, rangee: Partial<BatchParticipant> = {}): void {
  banc.setState({
    battle: { combatants: [h], log: [] } as never,
    pendingCascade: cascadeDeTest([{ id: 'b1', kind: cleDeFixture('batch'), aggregate: 'none', ...etape, participants: [{ ...RANGEE, ...rangee }] }]),
  });
}
const rangee = (banc: Banc) => banc.getState().pendingCascade!.participants[0].participants![0];
const PSY: ChampsDeBande = { kind: cleDeFixture('psychologieDeCombat'), contexte: 'psych' };

describe('jeton de Convalescence sur une bande de Psychologie (ADE II 09 l.33 ; LDB 21 l.9)', () => {
  it('Peur, cible 55, dé 64 : offert, aperçu 46 réussite DR +1 ; le clic inverse la rangée et consomme le jeton', () => {
    const banc = ouvrirLeBanc();
    bande(banc, jeton(heros('H'), JETON_CONVALESCENCE), PSY);
    expect(FLOWS.cascadeEnBande.reverseAvailable(banc.getState, 'H')).toBe(true);
    expect(FLOWS.cascadeEnBande.reversePreview(banc.getState, 'H')).toEqual({ roll: 46, sl: 1, success: true });
    banc.getState().jetInverser('cascadeEnBande', 'H');
    expect(rangee(banc).result).toEqual({ roll: 46, target: 55, sl: 1, success: true });
    expect(jetonsDe(banc, 'H').filter((e) => e.reverseToken)).toEqual([]);
  });

  it('même jeton sur un Calme hors Psychologie : non offert, le clic ne change rien', () => {
    const banc = ouvrirLeBanc();
    bande(banc, jeton(heros('H'), JETON_CONVALESCENCE), {});
    expect(FLOWS.cascadeEnBande.reverseAvailable(banc.getState, 'H')).toBe(false);
    banc.getState().jetInverser('cascadeEnBande', 'H');
    expect(rangee(banc).result).toEqual(RANGEE.result);
    expect(jetonsDe(banc, 'H').filter((e) => e.reverseToken)).toHaveLength(1);
  });

  it('jeton générique (« Observer une cible ») sur un Test de Force Mentale, cible 55, dé 64 : offert, 46', () => {
    const banc = ouvrirLeBanc();
    bande(banc, jeton(heros('H'), {}), PSY, { skill: undefined });
    expect(FLOWS.cascadeEnBande.reversePreview(banc.getState, 'H')).toEqual({ roll: 46, sl: 1, success: true });
  });

  it('jeton générique ET jeton de Convalescence : le jeton taillé pour ce Test est consommé, le générique reste', () => {
    const banc = ouvrirLeBanc();
    bande(banc, jeton(jeton(heros('H'), {}, 'Observer une cible'), JETON_CONVALESCENCE, 'Convalescence'), PSY);
    banc.getState().jetInverser('cascadeEnBande', 'H');
    expect(jetonsDe(banc, 'H').filter((e) => e.reverseToken).map((e) => e.label)).toEqual(['Observer une cible']);
  });

  it('bande OPPOSÉE (adversaire DR +4) : l’aperçu dit l’échec que la ré-opposition écrit', () => {
    const banc = ouvrirLeBanc();
    bande(banc, jeton(heros('H'), JETON_CONVALESCENCE), { ...PSY, meta: { opposed: { aT: { roll: 20, target: 60, success: true, sl: 4, isDouble: false, base: 60 }, attackerName: 'B' } } as never });
    expect(FLOWS.cascadeEnBande.reversePreview(banc.getState, 'H')).toEqual({ roll: 46, sl: 1, success: false });
    banc.getState().jetInverser('cascadeEnBande', 'H');
    expect(rangee(banc).result!.success).toBe(false);
  });

  it('rangée à +1 DR sur réussite (Commandant émérite) : l’aperçu porte le DR que la rangée écrit, 2', () => {
    const banc = ouvrirLeBanc();
    bande(banc, jeton(heros('H'), JETON_CONVALESCENCE), PSY, { bonusSlOnSuccess: 1 });
    expect(FLOWS.cascadeEnBande.reversePreview(banc.getState, 'H')).toEqual({ roll: 46, sl: 2, success: true });
  });

  it('Détermination posée sur la rangée : rien à inverser', () => {
    const banc = ouvrirLeBanc();
    bande(banc, jeton(heros('H'), JETON_CONVALESCENCE), PSY, { immune: true, result: { roll: 55, target: 55, sl: 0, success: true } });
    expect(FLOWS.cascadeEnBande.reverseAvailable(banc.getState, 'H')).toBe(false);
  });
});

describe('dé fixé sur une rangée à +DR de Talent (MDG 09 l.54)', () => {
  it('dé 20, cible 40, +1 DR : DR 3, comme le jet tiré', () => {
    const banc = ouvrirLeBanc({ desFixes: true });
    bande(banc, heros('H'), {}, { base: 40, target: 40, bonusSlOnSuccess: 1, result: { roll: 88, target: 40, sl: -4, success: false } });
    banc.getState().jetImposerLeResultat('cascadeEnBande', 20, 'H');
    expect(rangee(banc).result).toEqual({ roll: 20, target: 40, sl: 3, success: true });
  });
});

describe('Calme d’approche (LDB 21 l.27)', () => {
  it('jeton de Convalescence : offert, aperçu 46', () => {
    const banc = ouvrirLeBanc();
    const h = jeton(heros('H', { skills: [{ skillId: 'calme', advances: 0 }] as never }), JETON_CONVALESCENCE);
    banc.setState({
      battle: { combatants: [h], log: [] } as never,
      pendingApproach: {
        combatantId: 'H', test: { skill: { id: 'calme' }, difficulty: 'intermediaire', label: 'Calme' } as never, sourceId: 'x',
        intent: { kind: 'tile', pt: { x: 1, y: 1 } }, result: { roll: 64, target: 55, sl: -1, success: false },
      },
    });
    expect(FLOWS.approche.reversePreview(banc.getState)).toEqual({ roll: 46, sl: 1, success: true });
  });
});

describe('Pilote (LDB 10 l.966) : seulement sur un Test pour traverser des eaux dangereuses', () => {
  const PILOTE = () => heros('H', { talents: [{ talentId: 'pilote', times: 1 }] as never });
  const etapeDeVoile = (contexte?: 'perilDesEaux'): CascadeStep => ({
    id: 'st0', kind: cleDeFixture('fleuvePerilNavigation'), actorId: 'H', target: 40, base: 40, rollLabel: 'Voile', skill: { id: 'voile' },
    ...(contexte ? { contexte } : {}), result: { roll: 82, target: 40, sl: -4, success: false },
  });
  it('le mint d’étape mono porte la Compétence de sa ligne et le contexte déclaré', () => {
    const st = monoStep({
      id: 'st0', kind: cleDeFixture('fleuvePerilNavigation'), actor: PILOTE(), label: fixtureText('Évitement'), difficulty: 'intermediaire',
      ligne: { test: { skill: { id: 'voile' } } }, contexte: 'perilDesEaux', stake: { category: 'x', id: 'y' } as never,
    })!;
    expect([st.skill, st.contexte]).toEqual([{ id: 'voile' }, 'perilDesEaux']);
  });
  it('évitement d’un péril : offert, 28 réussite plafonnée à DR +1', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ battle: { combatants: [PILOTE()], log: [] } as never, pendingCascade: cascadeDeTest([etapeDeVoile('perilDesEaux')]) });
    expect(FLOWS.cascade.reversePreview(banc.getState, 'st0')).toEqual({ roll: 28, sl: 1, success: true });
  });
  it('Test de Voile hors péril : non offert', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ battle: { combatants: [PILOTE()], log: [] } as never, pendingCascade: cascadeDeTest([etapeDeVoile()]) });
    expect(FLOWS.cascade.reverseAvailable(banc.getState, 'st0')).toBe(false);
  });
});

describe('Pansement de fortune (LDB 10 l.899) : seulement avec des Bandages', () => {
  it('Test de Guérison raté sans Bandages déclarés : non offert', () => {
    const banc = ouvrirLeBanc();
    const h = heros('H', { talents: [{ talentId: 'pansement-de-fortune', times: 1 }] as never });
    banc.setState({ party: [h], pendingTest: { actorId: 'H', label: 'Guérison', sujet: { skill: { id: 'guerison' } }, skillValue: 40, difficulty: 'intermediaire', requireSL: 0, target: 40, roll: 82, success: false, sl: -4 } as never });
    expect(FLOWS.test.reverseAvailable(banc.getState)).toBe(false);
  });
});

describe('Pratiquer une Compétence (EDOC 8 l.172)', () => {
  it('réussite : jeton de la Compétence pratiquée, consommé sur un Test de cette Compétence', () => {
    const banc = ouvrirLeBanc();
    const h = heros('H', { skills: [{ skillId: 'athletisme', advances: 0 }] as never });
    banc.setState({ party: [h] });
    const def = activityById('pratiquer-competence')!;
    const spec = travelActivitySpec(h, def, { freeSkill: { id: 'athletisme' } })!;
    appliquerIssueActivite(banc.getState, h, def, spec, { roll: 10, target: 40, sl: 3, success: true });
    expect(h.activeEffects!.map((e) => [e.reverseToken, e.duration])).toEqual([[{ skill: { id: 'athletisme' } }, { scale: 'adventure' }]]);
    banc.setState({ party: [h], pendingTest: { actorId: 'H', label: 'Athlétisme', sujet: { skill: { id: 'athletisme' } }, skillValue: 40, difficulty: 'intermediaire', requireSL: 0, target: 40, roll: 82, success: false, sl: -4 } as never });
    banc.getState().jetInverser('test');
    expect(banc.getState().pendingTest!.roll).toBe(28);
    expect(jetonsDe(banc, 'H').filter((e) => e.reverseToken)).toEqual([]);
  });

  it('échec : aucun jeton', () => {
    const banc = ouvrirLeBanc();
    const h = heros('H', { skills: [{ skillId: 'athletisme', advances: 0 }] as never });
    const def = activityById('pratiquer-competence')!;
    appliquerIssueActivite(banc.getState, h, def, travelActivitySpec(h, def, { freeSkill: { id: 'athletisme' } })!, { roll: 90, target: 40, sl: -5, success: false });
    expect((h.activeEffects ?? []).filter((e) => e.reverseToken)).toEqual([]);
  });
});

describe('coop : l’inversion se joue au siège du porteur', () => {
  function coop(banc: Banc, h2: Combatant, pending: Record<string, unknown>) {
    banc.setState({
      battle: { combatants: [h2, heros('h3')], order: ['h2', 'h3'], turn: 0, round: 1, log: [], over: null } as never,
      mode: 'battle', party: [h2],
      net: { ...initialNet(), mode: 'hote', mySeat: 0, ownership: { h2: 1, h3: 2 }, slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'A', 2: 'B' } },
      ...pending,
    });
  }
  const intention = (banc: Banc, siege: number, action: string, args: unknown[]) => appliquerLIntentionDUnSiege(banc.getState, siege, action, args);

  it('étape mono de GROUPE : le siège de l’acteur de l’étape inverse, un tiers et l’hôte sont refusés', () => {
    const banc = ouvrirLeBanc();
    coop(banc, jeton(heros('h2'), {}), {
      pendingCascade: cascadeDeTest([{ id: 'st0', kind: cleDeFixture('testDeclenche'), actorId: 'h2', groupOwner: true, target: 55, base: 55, rollLabel: 'Calme', skill: { id: 'calme' }, result: { roll: 64, target: 55, sl: -1, success: false } }]),
    });
    expect(intention(banc, 2, 'jetInverser', ['cascade', 'st0'])).toBe('refusee');
    expect(intention(banc, 0, 'jetInverser', ['cascade', 'st0'])).toBe('refusee');
    expect(banc.getState().pendingCascade!.participants[0].result!.roll).toBe(64);
    expect(intention(banc, 1, 'jetInverser', ['cascade', 'st0'])).toBe('appliquee');
    expect(banc.getState().pendingCascade!.participants[0].result).toEqual({ roll: 46, target: 55, sl: 1, success: true });
  });

  it('rangée de bande : seul le siège du porteur de la rangée inverse', () => {
    const banc = ouvrirLeBanc();
    coop(banc, jeton(heros('h2'), JETON_CONVALESCENCE), {
      pendingCascade: cascadeDeTest([{ id: 'b1', kind: cleDeFixture('psychologieDeCombat'), contexte: 'psych', aggregate: 'none', groupOwner: true, participants: [{ ...RANGEE, id: 'h2' }] }]),
    });
    expect(intention(banc, 2, 'jetInverser', ['cascadeEnBande', 'h2'])).toBe('refusee');
    expect(intention(banc, 1, 'jetInverser', ['cascadeEnBande', 'h2'])).toBe('appliquee');
    expect(banc.getState().pendingCascade!.participants[0].participants![0].result!.roll).toBe(46);
  });
});
