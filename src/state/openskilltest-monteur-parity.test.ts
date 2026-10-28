import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from '../noyau/combatEffects';
import { testFlow } from '../noyau/monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { rollStep } from '../noyau/rollSeam';
import { DIFFICULTY_MODIFIERS, type Combatant, type ModLine } from '../engine/types';
import { clampTarget } from '../engine/tests';
import { testStatePenalty } from '../engine/conditions';
import { setRule, resetRule } from '../engine/policy';
import { seedBattleRng } from '../noyau/battleRng';
import { RULE_REF } from '../engine/ruleRefs';
import { ligneDe, lignesDe } from '../engine/modLine.testkit';
import { psychologies } from '../data';
import { codexLookupById } from '../ui/compendium/registry';
import type { TravelPlan } from '../noyau/travelFlow';
import { ciblePsy } from '../engine/psych/ciblage';

/**
 * PARITÉ de la cible d'un Test de scène : le calcul HISTORIQUE d'`openSkillTest`
 * (`value + DIFFICULTY_MODIFIERS[difficulty] + météo`, borné par `clampTarget`) et le MONTEUR
 * canonique (`rollStep`, `rollSeam.ts`) rendent la MÊME cible ET le MÊME écrêtage — sur les quatre
 * régimes que ce site fait vivre : acteur sain, acteur à États + Soutien + malus social FONDUS,
 * allègement de Difficulté (`easierIf`), météo maritime SUR la cible. Le 5ᵉ cas exerce l'écrêtage.
 *
 * L'oracle est la formule HISTORIQUE, écrite ici à la main : elle survit à la migration du site et
 * refuse toute dérive de la cible. Le second volet exerce le monteur avec les canaux du contrat
 * (`valeur` fondue + `soutien` + `dansLaValeur` + `surLaCible`) — sa garde d'exactitude (`exact`,
 * THROW en DEV) juge au passage que la valeur d'`openSkillTest` se RECONSTRUIT depuis le Niveau de
 * Compétence nu, ce qu'aucune mesure n'avait établi.
 */

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 40, dexterite: 40, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

function hero(id: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id, name: id, label: id, kind: 'hero',
    characteristics: { ...CHARS },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
    skills: [], talents: [], items: [], psychState: [], engagedWith: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant;
}

const seaPlan = (precip: 'legeres' | 'abondantes' | 'tres-abondantes'): TravelPlan => ({
  routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 8, km: 100, kmDone: 0,
  sea: {
    heading: 'ouest', windFrom: 'ouest', daysToEvent: 5, daysAtSea: 0, step: 'meteo', lines: [], milesToday: 0,
    weather: { precipitations: precip, temperature: 'mediane', visibilite: 'degage', vent: 'brise-fraiche' },
  },
} as unknown as TravelPlan);

/** La cible HISTORIQUE, telle que le site la calculait avant le monteur (oracle de la parité). */
function cibleHistorique(value: number, difficulty: keyof typeof DIFFICULTY_MODIFIERS, meteo = 0): { target: number; clamped?: number } {
  return clampTarget(value + DIFFICULTY_MODIFIERS[difficulty] + meteo);
}

/** Les deux montages d'une même situation, comparés champ à champ (cible ET écrêtage). */
function memeCible(vieux: { target: number; clamped?: number }, monteur: { target: number; clamped?: number }): void {
  expect([vieux.target, vieux.clamped]).toEqual([monteur.target, monteur.clamped]);
}

describe('openSkillTest × monteur canonique — la cible est BIT-IDENTIQUE (#1153 L2’)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingTest: null, pendingCascade: null, travelPlan: null, scene: null, flags: {} });
  });

  it('(a) acteur SAIN, Difficulté Intermédiaire : ancien calcul === rollStep', () => {
    const h = hero('h1', { skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 5 }] } as Partial<Combatant>);
    useGame.setState({ party: [h] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, difficulty: 'intermediaire', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.skillValue).toBe(45); // Ag 40 + 5 avances, rien d'autre
    const vieux = cibleHistorique(pt.skillValue, 'intermediaire');
    const monteur = rollStep({ actor: h, test: { skill: 'athletisme' }, difficulty: 'intermediaire', valeur: pt.skillValue });
    memeCible(vieux, monteur);
    expect([pt.target, pt.clamped]).toEqual([monteur.target, monteur.clamped]);
  });

  it('(b) acteur à ÉTATS + Soutien + malus social FONDUS : le split du monteur reconstruit la valeur', () => {
    const h1 = hero('h1', {
      characteristics: { ...CHARS, sociabilite: 60 },
      skills: [{ id: 'charme', characteristic: 'sociabilite', advances: 10 }],
      conditions: [{ id: 'extenue', value: 2 }],
      psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }],
    } as unknown as Partial<Combatant>);
    const h2 = hero('h2', {
      characteristics: { ...CHARS, sociabilite: 20 },
      skills: [{ id: 'charme', characteristic: 'sociabilite', advances: 1 }],
    } as unknown as Partial<Combatant>);
    useGame.setState({ party: [h1, h2] });
    // Le fixture EXERCE bien les trois postes (sinon la parité ne mesurerait rien).
    expect(testStatePenalty(h1, 'charme')).toBeLessThan(0);
    runFlow(useGame.getState, useGame.setState, testFlow(
      { skill: { id: 'charme' }, difficulty: 'difficile', vsGroups: ['elfe'], requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW,
    ));
    const pt = useGame.getState().pendingTest!;
    expect(pt.actorId).toBe('h1');
    expect(pt.psychMod).toBe(-20); // Animosité « contenue » (LDB 21)
    expect(pt.target).toBe(20); // Soc 60 +10 avances −20 Exténué −20 Animosité +10 Soutien −20 Difficile
    expect(pt.support?.bonus).toBe(10); // Soutien de h2 (LDB 12)
    const vieux = cibleHistorique(pt.skillValue, 'difficile');
    const monteur = rollStep({
      actor: h1, test: { skill: 'charme' }, difficulty: 'difficile',
      valeur: pt.skillValue, soutien: pt.support,
      dansLaValeur: [{ label: 'Animosité', value: pt.psychMod!, famille: 'jet' }] as ModLine[],
    });
    memeCible(vieux, monteur);
    expect([pt.target, pt.clamped]).toEqual([monteur.target, monteur.clamped]);
  });

  it('(c) allègement `easierIf` + malus social : la Difficulté ALLÉGÉE est celle des deux calculs', () => {
    const h1 = hero('h1', {
      characteristics: { ...CHARS, sociabilite: 50 },
      skills: [
        { id: 'marchandage', characteristic: 'sociabilite', advances: 8 },
        { id: 'commerage', characteristic: 'sociabilite', advances: 2 },
      ],
      psychTraits: [{ type: 'prejuge', cible: ciblePsy.groupe('nain') }],
    } as unknown as Partial<Combatant>);
    useGame.setState({ party: [h1] });
    runFlow(useGame.getState, useGame.setState, testFlow(
      {
        skill: { id: 'marchandage' }, difficulty: 'difficile', vsGroups: ['nain'], requireSL: 0,
        easierIf: { hasSkill: { id: 'commerage' }, steps: 1 },
      }, EMPTY_FLOW, EMPTY_FLOW,
    ));
    const pt = useGame.getState().pendingTest!;
    expect(pt.easedBy).toBeTruthy();
    expect(pt.difficulty).not.toBe('difficile'); // allégée d'un cran
    expect(pt.psychMod).toBe(-10); // Préjugé (LDB 21)
    expect(pt.target).toBe(38); // Soc 50 +8 avances −10 Préjugé −10 Complexe (allégée d'un cran)
    const vieux = cibleHistorique(pt.skillValue, pt.difficulty as keyof typeof DIFFICULTY_MODIFIERS);
    const monteur = rollStep({
      actor: h1, test: { skill: 'marchandage' }, difficulty: pt.difficulty,
      valeur: pt.skillValue,
      dansLaValeur: [{ label: 'Préjugé', value: pt.psychMod!, famille: 'jet' }] as ModLine[],
    });
    memeCible(vieux, monteur);
    expect([pt.target, pt.clamped]).toEqual([monteur.target, monteur.clamped]);
  });

  it('(d) météo maritime : le mod reste SUR LA CIBLE, hors de la valeur', () => {
    const h = hero('h1', { skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 0 }] } as Partial<Combatant>);
    useGame.setState({ party: [h], travelPlan: seaPlan('abondantes') });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, difficulty: 'intermediaire', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    const meteo = lignesDe(pt.mods, RULE_REF['meteo-maritime']);
    expect(meteo.map((m) => m.value)).toEqual([-20]);
    expect(pt.skillValue).toBe(40); // la météo n'entre PAS dans la valeur
    const vieux = cibleHistorique(pt.skillValue, 'intermediaire', -20);
    const monteur = rollStep({
      actor: h, test: { skill: 'athletisme' }, difficulty: 'intermediaire', valeur: pt.skillValue,
      surLaCible: meteo as ModLine[],
    });
    memeCible(vieux, monteur);
    expect([pt.target, pt.clamped]).toEqual([monteur.target, monteur.clamped]);
  });

  it('(e) ÉCRÊTAGE : la cible franchit le plafond — le `clamped` voyage à l’identique', () => {
    const h = hero('h1', {
      characteristics: { ...CHARS, agilite: 80 },
      skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 15 }],
    } as unknown as Partial<Combatant>);
    useGame.setState({ party: [h] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, difficulty: 'tresFacile', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    const vieux = cibleHistorique(pt.skillValue, 'tresFacile');
    expect(vieux.clamped).toBeLessThan(0); // le fixture DÉPASSE bien le plafond
    const monteur = rollStep({ actor: h, test: { skill: 'athletisme' }, difficulty: 'tresFacile', valeur: pt.skillValue });
    memeCible(vieux, monteur);
    expect([pt.target, pt.clamped]).toEqual([monteur.target, monteur.clamped]);
  });

  it('la garde d’exactitude du monteur est ACTIVE ici : une part annoncée mais NON fondue est refusée', () => {
    const h = hero('h1', { skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 5 }] } as Partial<Combatant>);
    // Sans ce cas, les parités ci-dessus prouveraient la cible mais pas la RECONSTRUCTION : un `exact`
    // faux passerait inaperçu si la garde ne mordait pas dans cet environnement.
    expect(() => rollStep({
      actor: h, test: { skill: 'athletisme' }, difficulty: 'intermediaire', valeur: 45,
      dansLaValeur: [{ label: 'jamais fondu', value: -20, famille: 'jet' }] as ModLine[],
    })).toThrow(/ne se reconstruit pas/);
  });
});

/**
 * TRANSPORT de la ligne montée : ce que le monteur a ÉMIS (base nue, lignes nommées avec leur famille
 * et leur fiche) arrive TEL QUEL sur le pending, pour tous les candidats — c'est la seule façon que
 * l'écran ait la MÊME ligne que la cible. Sans ces cas, l'éclatement par source resterait invisible.
 */
describe('la LIGNE MONTÉE voyage jusqu’au pending (#1153 L2’ R4)', () => {
  beforeEach(() => {
    resetRule('social-status-reaction-roll');
    useGame.setState({ battle: null, pendingTest: null, pendingCascade: null, travelPlan: null, scene: null, flags: {} });
  });

  const noble = (id: string, over: Partial<Combatant> = {}): Combatant => hero(id, {
    characteristics: { ...CHARS, sociabilite: 45 },
    skills: [{ id: 'charme', characteristic: 'sociabilite', advances: 5 }],
    career: 'noble', careerLevel: 1,
    ...over,
  } as unknown as Partial<Combatant>);

  it('mod de STATUT : la ligne émise porte SA fiche, et base + Σ mods + Difficulté === cible', () => {
    const h = noble('h1');
    useGame.setState({ party: [h] });
    runFlow(useGame.getState, useGame.setState, testFlow(
      { skill: { id: 'charme' }, difficulty: 'intermediaire', vsStatus: 'Bronze 1', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW,
    ));
    const pt = useGame.getState().pendingTest!;
    const statut = ligneDe(pt.mods, RULE_REF.statut)!;
    expect(statut.value).toBe(pt.psychMod); // la ligne EST le mod fondu, pas un doublon d'affichage
    expect(pt.base! + pt.mods!.reduce((s, m) => s + m.value, 0) + DIFFICULTY_MODIFIERS[pt.difficulty]).toBe(pt.target);
  });

  it('sous l’option « Réaction au Statut », la ligne DIT l’inversion (label et valeur de la même source)', () => {
    // d10 forcé à 9-10 par le RNG seedé : « Opinions extrêmes » inverse le modificateur. La ligne
    // affichée est CELLE qui a fait la cible — libellé et valeur ne peuvent plus diverger.
    setRule('social-status-reaction-roll', true);
    try {
      const h = noble('h1');
      useGame.setState({ party: [h] });
      let pt = null as ReturnType<typeof useGame.getState>['pendingTest'];
      for (let seed = 1; seed <= 40 && !pt; seed += 1) {
        seedBattleRng(seed);
        useGame.setState({ pendingTest: null, pendingCascade: null });
        runFlow(useGame.getState, useGame.setState, testFlow(
          { skill: { id: 'charme' }, difficulty: 'intermediaire', vsStatus: 'Bronze 1', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW,
        ));
        const cur = useGame.getState().pendingTest!;
        if ((cur.psychMod ?? 0) < 0) pt = cur; // inversion tirée (le mod d'un Or vers un Bronze est +10)
      }
      expect(pt, 'aucun seed n’a tiré 9-10 en 40 essais').toBeTruthy();
      const statut = ligneDe(pt!.mods, RULE_REF.statut)!;
      expect(statut.value).toBe(pt!.psychMod);
      expect(statut.value).toBeLessThan(0);
      expect(pt!.base! + pt!.mods!.reduce((s, m) => s + m.value, 0) + DIFFICULTY_MODIFIERS[pt!.difficulty]).toBe(pt!.target);
    } finally {
      resetRule('social-status-reaction-roll');
    }
  });

  it('MULTI-candidats : chaque candidat porte SA ligne, et `testSetActor` la fait suivre', () => {
    const h1 = hero('h1', {
      characteristics: { ...CHARS, agilite: 55 },
      skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 5 }],
      conditions: [{ id: 'extenue', value: 1 }],
    } as unknown as Partial<Combatant>);
    const h2 = hero('h2', {
      characteristics: { ...CHARS, agilite: 40 },
      skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 2 }],
    } as unknown as Partial<Combatant>);
    useGame.setState({ party: [h1, h2] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, difficulty: 'intermediaire', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.candidates).toHaveLength(2);
    const c1 = pt.candidates!.find((c) => c.id === 'h1')!;
    const c2 = pt.candidates!.find((c) => c.id === 'h2')!;
    expect(c1.base).toBe(60); // Ag 55 + 5 avances, NU (l'État est une ligne)
    expect(c1.mods!.map((m) => [m.ref, m.value])).toEqual([[RULE_REF.soutien, 10], [{ category: 'etats', id: 'extenue' }, -10]]);
    expect(c2.mods!.map((m) => m.ref)).toEqual([RULE_REF.soutien]);
    expect(pt.actorId).toBe('h1');
    expect(pt.mods).toEqual(c1.mods);
    useGame.getState().testSetActor('h2');
    const apres = useGame.getState().pendingTest!;
    expect([apres.base, apres.mods]).toEqual([c2.base, c2.mods]);
  });
});

/**
 * La fiche que NOMME une ligne sociale doit S'OUVRIR. Un `{category, id}` qui ne résout pas rend une
 * chip morte à l'écran — et le défaut ne se voit ni au type ni à l'arithmétique. La mesure porte sur
 * la porte RÉELLE du Codex (`codexLookupById`, le registre vivant), pour CHAQUE psychologie qui
 * déclare un `containedSocialMod` : ce sont exactement les entrées que `socialPsychLines` peut citer.
 */
describe('les fiches citées par les lignes sociales RÉSOLVENT au Codex (#1153 L2’ R3)', () => {
  it('chaque psychologie à `containedSocialMod` a sa fiche, dans l’espace utilisé par le producteur', () => {
    const concernees = psychologies.filter((p) => p.containedSocialMod != null);
    expect(concernees.length).toBeGreaterThan(0); // sinon la garde serait vide et verte
    const mortes = concernees
      .map((p) => ({ id: p.id, ref: { category: 'psychologies', id: p.id } }))
      .filter((x) => !codexLookupById(x.ref.category, x.ref.id));
    expect(mortes.map((x) => x.id), 'chip morte : la fiche ne s’ouvre pas').toEqual([]);
  });

  it('la fiche de la règle de Statut (LDB 08) s’ouvre aussi — même porte', () => {
    expect(codexLookupById(RULE_REF.statut.category, RULE_REF.statut.id)).toBeTruthy();
    expect(codexLookupById(RULE_REF['meteo-maritime'].category, RULE_REF['meteo-maritime'].id)).toBeTruthy();
    expect(codexLookupById(RULE_REF['exposition-hydrique'].category, RULE_REF['exposition-hydrique'].id)).toBeTruthy();
  });
});
