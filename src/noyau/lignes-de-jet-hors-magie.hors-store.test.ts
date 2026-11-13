/**
 * UNE SEULE SOURCE DE LIGNE PAR JET, HORS MAGIE (#3059, lot J3) : la cible qu'une fenêtre annonce avant le jet est celle
 * que le résolveur jette (invariant de L4b). Flux FIGÉS (Main ensanglantée, Chirurgie, Évaluation) : la ligne est posée
 * au pending à l'ouverture (`rollLine`) et le résolveur la jette, même si l'acteur change ensuite. Flux sur l'ACTEUR
 * VIVANT (Course, Frénésie, Approche, Chute, Fuite, Corruption) : un lecteur pur du noyau (`ligneDuTestNomme`,
 * `ligneDeFrenesie`), lu par la fenêtre web, par la projection des hôtes (`jetsEnVue`) et par le résolveur. Fixture
 * commune : l'acteur devient *Exténué* entre l'ouverture et le jet ; les Tests nommés sont ceux de la fiche de test
 * (`poserFicheDeTest`), à Difficulté non intermédiaire. Course LDB 15 l.41 ; Chute LDB 15 l.82 ; Fuite LDB 15 l.66 ;
 * Frénésie LDB 21 l.31 ; Approche LDB 21 l.27 ; Corruption LDB 19 l.29 ; Main ensanglantée AA 07 l.117 ; Chirurgie
 * LDB 10 l.184 ; Évaluation LDB 59 l.41 ; bornes de la cible LDB 12 l.25-28.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { poserLeTestDeMain, startDisengage } from './combatFlow';
import { fleeTouche } from './pendings';
import { passeDeLOperation } from './acteDeSoin';
import { evaluerLObjet } from './merchantFlow';
import { applyEffects } from './combatEffects';
import { ligneDeFrenesie, ligneDuTestNomme } from './rollFlowSpecs';
import { fenetreDeCorruption, refusDeLaNature } from './fenetreDeCorruption';
import { jetsEnVue } from './jetsEnVue';
import { emptyScene } from './monde/scene';
import { seedBattleRng } from './battleRng';
import { testDeRegle } from '../engine/reglesChiffrees';
import { testDuCavalier } from '../engine/movement';
import { addCondition, COND } from '../engine/conditions';
import { cibleMesuree } from '../engine/tests';
import { NATURES_D_INFLUENCE } from '../data/schemas/grammaire/valeurs';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import type { Combatant, ItemInstance } from '../engine/types';
import type { Jeu } from './etat';
import { poserFicheDeTest, restaurerFiche } from '../engine/ficheDeTest.testkit';

afterEach(() => { restaurerFiche(); });

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 45, initiative: 30, agilite: 38, dexterite: 42, intelligence: 60, 'force-mentale': 33, sociabilite: 30 };

/** Héros d'épreuve : chaque Test du lot sur une valeur distincte ; l'Évaluation dépasse la borne haute (Int 60 + 50). */
const heros = (id = 'h', over: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id, label: id, kind: 'heros', pos: { x: 1, y: 1 }, size: 'moyenne', characteristics: { ...CHARS },
  skills: [
    { id: 'athletisme', advances: 12 }, { id: 'calme', advances: 7 }, { id: 'resistance', advances: 4 },
    { id: 'guerison', advances: 21 }, { id: 'evaluation', advances: 50 },
  ],
  talents: [], advantage: 0, conditions: [], wounds: blessuresDeBase(12), weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, resilience: 0, fortune: 0, ...over,
}) as unknown as Combatant);

function enCombat(banc: Banc, h: Combatant, ...autres: Combatant[]): void {
  banc.setState({
    scene: { ...emptyScene('scene-test', 8, 4), weather: 'clair' }, gameTime: 0, party: [h],
    battle: { combatants: [h, ...autres], order: [h.id, ...autres.map((c) => c.id)], turn: 0, round: 1, log: [], acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map() } as never,
  });
  seedBattleRng(7);
}

/** L'acteur, dans le pool où le jeu le lit (combat, sinon groupe), devient Exténué : la valeur change après l'ouverture. */
function exterue(banc: Banc, id: string): void {
  const s = banc.getState();
  const touche = (c: Combatant) => { if (c.id !== id) return c; const x = structuredClone(c); addCondition(x, COND.extenue); return x; };
  banc.setState(s.battle ? { battle: { ...s.battle, combatants: s.battle.combatants.map(touche) } } : { party: s.party.map(touche) });
}

const acteur = (s: Jeu, id: string): Combatant => (s.battle?.combatants ?? s.party).find((c) => c.id === id)!;

/** La cible que la projection des hôtes (`jetsEnVue`) annonce pour la ligne de `qui` du flux `flux`, avant le jet. */
function cibleEnVue(s: Jeu, flux: string, qui: string): number | null {
  const ligne = jetsEnVue(s).find((v) => v.flux === flux)?.lignes.find((l) => l.qui === qui);
  expect(ligne?.genre, `${flux} : une ligne de Test pour ${qui}`).toBe('test');
  return ligne?.genre === 'test' ? ligne.cible : null;
}

describe('flux sur l’acteur vivant : la cible annoncée par le lecteur est celle du jet', () => {
  it('Course : `ligneDuTestNomme` sur l’acteur Exténué = `result.target`', () => {
    poserFicheDeTest();
    const banc = ouvrirLeBanc();
    enCombat(banc, heros());
    banc.setState({ pendingRun: { combatantId: 'h', test: testDuCavalier(heros(), testDeRegle('course', 'courir')), result: null } });
    exterue(banc, 'h');
    const annoncee = cibleMesuree(ligneDuTestNomme(acteur(banc.getState(), 'h'), banc.getState().pendingRun!.test));
    const enVue = cibleEnVue(banc.getState(), 'course', 'h');
    banc.getState().jetLancer('course');
    expect(cibleMesuree(banc.getState().pendingRun!.result!)).toEqual(annoncee);
    expect(enVue, 'jetsEnVue').toBe(annoncee.target);
  });

  it('Chute : la rangée annonce la cible que le résolveur jette', () => {
    poserFicheDeTest();
    const banc = ouvrirLeBanc();
    enCombat(banc, heros());
    banc.setState({ pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 2, y: 1 }, metres: 6, initiateurId: 'h', participants: [{ id: 'h', interactive: true, attempt: true, result: null }] } });
    exterue(banc, 'h');
    const annoncee = cibleMesuree(ligneDuTestNomme(acteur(banc.getState(), 'h'), banc.getState().pendingFall!.test));
    const enVue = cibleEnVue(banc.getState(), 'chute', 'h');
    banc.getState().jetLancer('chute', 'h');
    expect(cibleMesuree(banc.getState().pendingFall!.participants[0].result!)).toEqual(annoncee);
    expect(enVue, 'jetsEnVue').toBe(annoncee.target);
  });

  it('Approche d’une source de Peur : idem', () => {
    poserFicheDeTest();
    const banc = ouvrirLeBanc();
    enCombat(banc, heros());
    banc.setState({ pendingApproach: { combatantId: 'h', test: testDeRegle('calme-d-approche', 'se-rapprocher'), sourceId: 'x', intent: { kind: 'tile', pt: { x: 2, y: 1 } }, result: null } });
    exterue(banc, 'h');
    const annoncee = cibleMesuree(ligneDuTestNomme(acteur(banc.getState(), 'h'), banc.getState().pendingApproach!.test));
    const enVue = cibleEnVue(banc.getState(), 'approche', 'h');
    banc.getState().jetLancer('approche');
    expect(cibleMesuree(banc.getState().pendingApproach!.result as never)).toEqual(annoncee);
    expect(enVue, 'jetsEnVue').toBe(annoncee.target);
  });

  it('Frénésie : `ligneDeFrenesie` = `result.target`', () => {
    const banc = ouvrirLeBanc();
    enCombat(banc, heros());
    banc.setState({ pendingFrenzy: { combatantId: 'h', result: null } });
    exterue(banc, 'h');
    const annoncee = cibleMesuree(ligneDeFrenesie(acteur(banc.getState(), 'h')));
    const enVue = cibleEnVue(banc.getState(), 'frenesie', 'h');
    banc.getState().jetLancer('frenesie');
    expect(cibleMesuree(banc.getState().pendingFrenzy!.result as never)).toEqual(annoncee);
    expect(enVue, 'jetsEnVue').toBe(annoncee.target);
  });

  it('Fuite : le Test du fuyard annonce la cible que son slot jette', () => {
    poserFicheDeTest();
    const banc = ouvrirLeBanc();
    // Le frappeur (non joué) porte son coup dans le dos à l'ouverture et blesse : le Test du fuyard est dû (LDB 15 l.66).
    const epee = { uid: 'e', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4, bare: true }, qualities: [], hand: 'main', hands: 1 };
    const brute = heros('x', {
      kind: 'ennemi', pos: { x: 2, y: 1 }, engagedWith: ['h'], weapons: [epee], items: [{ uid: 'e', label: 'Épée', kind: 'melee', qualities: [] }],
      loadouts: [{ id: 'lo', main: 'e' }], activeLoadoutId: 'lo',
      characteristics: { ...CHARS, 'capacite-de-combat': 90, force: 80 },
    } as unknown as Partial<Combatant>);
    enCombat(banc, heros('h', { engagedWith: ['x'], movement: 4 } as Partial<Combatant>), brute);
    startDisengage(banc.getState, banc.setState, acteur(banc.getState(), 'h'));
    banc.getState().jetRegler('desengagement', 'fuir', true);
    const test = fleeTouche(banc.getState().pendingDisengage!)!.test;
    exterue(banc, 'h');
    const annoncee = cibleMesuree(ligneDuTestNomme(acteur(banc.getState(), 'h'), test));
    const enVue = cibleEnVue(banc.getState(), 'fuite', 'h');
    banc.getState().jetLancer('fuite', 'h');
    expect(cibleMesuree(fleeTouche(banc.getState().pendingDisengage!)!.jet as { target: number; clamped?: number })).toEqual(annoncee);
    expect(enVue, 'jetsEnVue').toBe(annoncee.target);
  });

  it('Corruption (nature spirituelle choisie) : la ligne du Test retenu = la cible du jet', () => {
    poserFicheDeTest();
    const banc = ouvrirLeBanc();
    banc.setState({ battle: null, party: [heros()] });
    banc.getState().ensemencerLeTirage(13);
    applyEffects(banc.getState, banc.setState, [{ type: 'corruptionExposure', level: 'mineure', heroId: 'h' }]);
    banc.getState().jetRegler('corruption', 'nature', 'spirituelle');
    exterue(banc, 'h');
    const annoncee = cibleMesuree(ligneDuTestNomme(acteur(banc.getState(), 'h'), banc.getState().pendingCorruption!.test));
    const enVue = cibleEnVue(banc.getState(), 'corruption', 'h');
    banc.getState().jetLancer('corruption');
    const pc = banc.getState().pendingCorruption!;
    expect(cibleMesuree({ target: pc.target!, clamped: pc.clamped })).toEqual(annoncee);
    expect(enVue, 'jetsEnVue').toBe(annoncee.target);
  });
});

describe('flux figés : la ligne posée à l’ouverture est celle que le résolveur jette', () => {
  it('Main ensanglantée : Exténué après l’ouverture, la ligne figée reste la cible du jet', () => {
    const banc = ouvrirLeBanc();
    const h = heros('h', { handGates: ['main'] } as Partial<Combatant>);
    enCombat(banc, h);
    poserLeTestDeMain(banc.setState, acteur(banc.getState(), 'h'), 'main', { attackerId: 'h', targetId: 'h', location: null, result: null } as never, 'Attaque', 'action/attaquer');
    const ligne = banc.getState().pendingHandGate!.ligne;
    expect(ligne.difficulty).toBe('accessible');
    exterue(banc, 'h');
    banc.getState().jetLancer('mainEnsanglantee');
    const pg = banc.getState().pendingHandGate!;
    expect(pg.ligne).toEqual(ligne);
    expect(cibleMesuree(pg)).toEqual(cibleMesuree(ligne));
  });

  it('Chirurgie (Rééducation, Accessible) : la passe jette la ligne posée à son ouverture', () => {
    const banc = ouvrirLeBanc();
    const chirurgien = heros('c');
    const patient = heros('p');
    banc.setState({
      battle: null, party: [chirurgien, patient],
      medic: { patientId: 'p', surgery: { kind: 'reeducation', difficulty: 'accessible', healerId: 'c', healerName: 'c', skill: 81, intBonus: 6, drCible: 6, cumDR: 0 } } as never,
    });
    seedBattleRng(7);
    banc.setState({ pendingSurgery: passeDeLOperation(banc.getState()) });
    const ligne = banc.getState().pendingSurgery!.ligne;
    expect(ligne.difficulty).toBe('accessible');
    exterue(banc, 'c');
    banc.getState().jetLancer('chirurgie');
    const ps = banc.getState().pendingSurgery!;
    expect(ps.ligne).toEqual(ligne);
    expect(cibleMesuree(ps)).toEqual(cibleMesuree(ligne));
  });

  it('Évaluation au-delà de la borne (Int 60 + 50) : la cible annoncée avant le jet est la cible bornée du jet', () => {
    const banc = ouvrirLeBanc();
    const dague = { uid: 'd1', label: 'Dague', kind: 'trapping', trappingId: 'dague', qualities: [] } as unknown as ItemInstance;
    banc.setState({ battle: null, party: [heros('h', { items: [dague] })] });
    seedBattleRng(7);
    evaluerLObjet(banc.getState, banc.setState, 'd1');
    const avant = banc.getState().pendingAppraise!;
    banc.getState().jetLancer('evaluation');
    const apres = banc.getState().pendingAppraise!;
    expect(cibleMesuree(avant), 'la cible que la fenêtre lit avant le jet').toEqual(cibleMesuree(apres));
    expect(cibleMesuree(avant.ligne)).toEqual(cibleMesuree(apres));
    expect(apres.target, 'la cible est bornée (LDB 12 l.25-28)').toBeLessThan(110);
  });
});

describe('Corruption : la nature que la fenêtre offre est celle que le verbe accepte (LDB 19 l.29)', () => {
  const ouvrir = (nature?: 'physique' | 'spirituelle') => {
    poserFicheDeTest();
    const banc = ouvrirLeBanc();
    banc.setState({ battle: null, party: [heros()] });
    banc.getState().ensemencerLeTirage(13);
    applyEffects(banc.getState, banc.setState, [{ type: 'corruptionExposure', level: 'mineure', heroId: 'h', ...(nature ? { nature } : {}) }]);
    return banc;
  };

  for (const cle of NATURES_D_INFLUENCE) {
    it(`l’option ${cle} annonce la cible du Test que son choix fait jeter`, () => {
      const banc = ouvrir();
      const option = fenetreDeCorruption(banc.getState())!.nature!.options.find((o) => o.valeur === cle)!;
      banc.getState().jetRegler('corruption', 'nature', cle);
      banc.getState().jetLancer('corruption');
      expect(banc.getState().pendingCorruption!.target).toBe(option.cible);
    });
  }

  for (const lance of [false, true]) {
    it(`contrat ${lance ? 'après' : 'avant'} le jet : refus annoncé ⇔ verbe sans effet`, () => {
      const banc = ouvrir();
      if (lance) banc.getState().jetLancer('corruption');
      for (const cle of NATURES_D_INFLUENCE) {
        const autre = cle === 'physique' ? 'spirituelle' : 'physique';
        if (!lance) banc.getState().jetRegler('corruption', 'nature', autre);
        const refus = fenetreDeCorruption(banc.getState())!.nature!.options.find((o) => o.valeur === cle)!.refus;
        expect(refus).toBe(refusDeLaNature(banc.getState()));
        const avant = banc.getState().pendingCorruption!.nature;
        banc.getState().jetRegler('corruption', 'nature', cle);
        expect(banc.getState().pendingCorruption!.nature === cle, `nature ${cle}`).toBe(refus === null || avant === cle);
        expect(refus === null, `nature ${cle}`).toBe(!lance);
      }
    });
  }

  it('nature imposée par la source : aucun choix offert, le verbe ne change rien', () => {
    const banc = ouvrir('spirituelle');
    expect(fenetreDeCorruption(banc.getState())!.nature).toBeNull();
    banc.getState().jetRegler('corruption', 'nature', 'physique');
    expect(banc.getState().pendingCorruption!.nature).toBe('spirituelle');
  });
});
