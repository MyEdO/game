/**
 * LES ÉVÉNEMENTS DU NOYAU LUS PAR LA SEULE SURFACE (#4830, #4848) : un hôte anime un coup par `ChargeDAttaque`, et
 * reçoit chaque Test jeté (`TestJete`), dans l'ordre des jets, avec ce qu'il teste ; la Compétence d'un Test
 * d'incantation se lit aussi dans sa ligne de jet (`JetEnVue`), le sort en contexte. L'hôte n'importe que `./index`.
 */
import { describe, it, expect } from 'vitest';
import {
  creerPartie, etatInitialDuJeu, jetsEnVue, type ChargeDAttaque, type EntreesDeLaPartie, type Evenement, type Jeton, type ResultatDeLAppel,
  type TestJete,
} from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { groupeDeScenario, herosDeScenario, tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { emptyScene } from './monde/scene';
import { EMPTY_FLOW } from '../engine/flowCore';
import { addCondition } from '../engine/conditions';
import { surUnBancHorsTest } from './banc.testkit';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

/** Les Tests qu'un appel a jetés, dans l'ordre. */
const testsJetes = (r: ResultatDeLAppel): TestJete[] =>
  r.evenements.flatMap((e: Evenement) => (e.type === 'emis' && e.evt === 'test_jete' ? [e.payload] : []));

/** Le combat de `heroDuDuel` contre les mutants de `testScene`, son premier round ouvert, le héros et le premier
 *  ennemi au contact, le tour au héros ; la partie s'ouvre sur `entrees`. */
function duel(entrees: EntreesDeLaPartie) {
  const ouverture = creerPartie(etatInitialDuJeu(), entrees);
  ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
  ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const { H, E, patch } = auContact(garde);
  return { H, E, partie: creerPartie({ ...garde, ...patch }, entrees) };
}

describe('événements du noyau — lus par la seule surface', () => {
  it('un Test de Calme de scène : son porteur, sa Compétence et son issue, à son jet', () => {
    const scene = { ...emptyScene('epreuve', 4, 4), id: 'epreuve' };
    scene.entities.push({
      id: 'autel', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Autel',
      usable: { actions: [{ id: 'contempler', label: 'Contempler', flow: { kind: 'test', test: { skill: { id: 'calme' }, difficulty: 'intermediaire' }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW } }] },
    } as never);
    const heros = tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => ({ ...h, pos: { x: 0, y: 0 } }));
    const partie = creerPartie({ ...etatInitialDuJeu(), party: heros, scene }, ENTREES);
    try {
      expect(testsJetes(partie.envoyer({ type: 'jouerAction', args: ['autel', 'contempler'] })), 'ouvrir la fenêtre ne jette rien').toEqual([]);
      const jetes = testsJetes(partie.envoyer({ type: 'jetLancer', args: ['test'] }));
      const pose = partie.etat().pendingTest!;
      expect(jetes).toEqual([{ porteur: heros[0].id, reference: { genre: 'competence', id: 'calme' }, issue: { roll: pose.roll, cible: pose.target, dr: pose.sl, reussi: pose.success } }]);
      expect(JSON.parse(JSON.stringify(jetes)), 'le Test jeté traverse le JSON sans perte').toStrictEqual(jetes);
      expect(testsJetes(partie.envoyer({ type: 'jetValider', args: ['test'] })), 'valider ne rejette rien').toEqual([]);
    } finally {
      partie.fermer();
    }
  });

  it('un Test d’incantation : sa ligne nomme Langue (Magick), le sort en contexte', () => {
    const sorcier = { ...herosDeScenario(idsDeTest, 'sorcier'), pos: { x: 1, y: 1 } };
    const scene = { ...emptyScene('cabinet', 4, 4), id: 'cabinet' };
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [sorcier], scene }, ENTREES);
    try {
      partie.envoyer({ type: 'incanterLeSort', args: [sorcier.id, 'arme-aethyrique', sorcier.id] });
      const jetes = testsJetes(partie.envoyer({ type: 'jetLancer', args: ['incantation'] }));
      expect(jetes).toMatchObject([{ porteur: sorcier.id, reference: { genre: 'competence', id: 'langue', spec: 'magick' } }]);
      const [jet] = jetsEnVue(partie.etat());
      expect(jet.flux).toBe('incantation');
      expect(jet.lignes[0]).toMatchObject({
        qui: sorcier.id, etat: 'revele', reference: { genre: 'competence', id: 'langue', spec: 'magick' }, sort: { genre: 'sort', id: 'arme-aethyrique' },
      });
    } finally {
      partie.fermer();
    }
  });

  it('une attaque au corps à corps : le coup s’anime par sa charge', () => {
    const { H, E, partie } = duel(ENTREES);
    try {
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      partie.envoyer({ type: 'jetLancer', args: ['attaque'] });
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['attaque', 11] });
      const appel = partie.envoyer({ type: 'jetValider', args: ['attaque'] });
      const coups = appel.evenements.flatMap((e): ChargeDAttaque[] => (e.type === 'emis' && e.evt === 'anim_attack' ? [e.payload] : []));
      expect(coups).toMatchObject([{ kind: 'melee', from: H.id, to: E.id }]);
    } finally {
      partie.fermer();
    }
  });

  it('une attaque ratée relancée par la Chance : le nouveau jet se dit relancé', () => {
    const { H, E, partie } = duel(ENTREES);
    try {
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      partie.envoyer({ type: 'jetLancer', args: ['attaque'] });
      const impose = testsJetes(partie.envoyer({ type: 'jetImposerLeResultat', args: ['attaque', 96] }));
      expect(impose, 'le dé imposé est un jet neuf, non relancé').toMatchObject([{ porteur: H.id, issue: { roll: 96, reussi: false } }]);
      expect(impose[0].relance).toBeUndefined();
      const relance = testsJetes(partie.envoyer({ type: 'jetRelancer', args: ['attaque'] }));
      expect(relance.map(({ issue: _issue, ...jet }) => jet), 'l’attaque relancée, puis la défense de l’ennemi re-résolue').toEqual([
        { porteur: H.id, reference: impose[0].reference, relance: true },
        { porteur: E.id, reference: { genre: 'competence', id: 'corps-a-corps' }, relance: true },
      ]);
      expect(relance[0].issue.roll).toBe(partie.etat().pendingAttack!.result!.attackerRoll);
    } finally {
      partie.fermer();
    }
  });

  it('en cadence auto : chaque coup porté suit le jet de son attaquant, sorti une fois, avec sa Compétence', () => {
    const partie = creerPartie(etatInitialDuJeu(), { ...ENTREES, cadence: 'auto', desFixes: false });
    try {
      const file: Jeton[] = [];
      const appels: ResultatDeLAppel[] = [];
      const suivre = (r: ResultatDeLAppel) => {
        appels.push(r);
        file.push(...r.evenements.flatMap((e) => (e.type === 'programme' ? [e.jeton] : [])));
      };
      suivre(partie.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' }));
      suivre(partie.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] }));
      for (let pas = 0; file.length && pas < 5000 && !partie.etat().battle?.over; pas++) suivre(partie.reprendre(file.shift()!));
      let coups = 0;
      let depuisLeCoup: TestJete[] = [];
      for (const e of appels.flatMap((r) => r.evenements)) {
        if (e.type !== 'emis') continue;
        if (e.evt === 'test_jete') depuisLeCoup.push(e.payload);
        if (e.evt !== 'anim_attack' || e.payload.kind !== 'melee') continue;
        const { from, result } = e.payload;
        const sien = depuisLeCoup.filter((j) => j.porteur === from && j.reference.genre === 'competence' && j.issue.roll === result.attackerRoll);
        expect(sien, `le coup de ${from} (dé ${result.attackerRoll}) suit un seul jet de son attaquant`).toHaveLength(1);
        coups++;
        depuisLeCoup = [];
      }
      expect(coups, 'aucun coup porté au corps à corps').toBeGreaterThan(0);
    } finally {
      partie.fermer();
    }
  });

  it('un coup ennemi à défendre : son jet figé sort à la défense, avant elle', () => {
    const { H, E, partie } = duel(ENTREES);
    try {
      const file: Jeton[] = [];
      const jetes: TestJete[] = [];
      const suivre = (r: ResultatDeLAppel) => {
        jetes.push(...testsJetes(r));
        file.push(...r.evenements.flatMap((e) => (e.type === 'programme' ? [e.jeton] : [])));
      };
      const round = partie.etat().battle!.round;
      suivre(partie.envoyer({ type: 'terminerLeTour', args: [] }));
      if (partie.etat().battle!.round === round) suivre(partie.envoyer({ type: 'terminerLeTour', args: [] }));
      suivre(partie.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] }));
      for (let pas = 0; file.length && pas < 200 && !partie.etat().pendingDefense; pas++) suivre(partie.reprendre(file.shift()!));
      const pd = partie.etat().pendingDefense;
      expect(pd?.attackerId, 'l’ennemi n’a pas attaqué le héros').toBe(E.id);
      expect(jetes.filter((j) => j.porteur === E.id && j.reference.genre === 'competence'), 'le coup figé ne sort pas avant la défense').toEqual([]);
      const defense = testsJetes(partie.envoyer({ type: 'jetLancer', args: ['defense'] }));
      expect(defense).toMatchObject([{ porteur: E.id, issue: { roll: pd!.atk.roll } }, { porteur: H.id }]);
    } finally {
      partie.fermer();
    }
  });

  it('une partie rouverte pendant une défense figée : le coup figé sort à la défense, avant elle', () => {
    const { H, E, partie } = duel(ENTREES);
    let rouverte = partie;
    try {
      const file: Jeton[] = [];
      const suivre = (r: ResultatDeLAppel) => file.push(...r.evenements.flatMap((e) => (e.type === 'programme' ? [e.jeton] : [])));
      const round = partie.etat().battle!.round;
      suivre(partie.envoyer({ type: 'terminerLeTour', args: [] }));
      if (partie.etat().battle!.round === round) suivre(partie.envoyer({ type: 'terminerLeTour', args: [] }));
      suivre(partie.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] }));
      for (let pas = 0; file.length && pas < 200 && !partie.etat().pendingDefense; pas++) suivre(partie.reprendre(file.shift()!));
      const garde = partie.etat();
      expect(garde.pendingDefense?.attackerId, 'l’ennemi n’a pas attaqué le héros').toBe(E.id);
      partie.fermer();
      rouverte = creerPartie(garde, ENTREES);
      const defense = testsJetes(rouverte.envoyer({ type: 'jetLancer', args: ['defense'] }));
      expect(defense).toMatchObject([{ porteur: E.id, issue: { roll: garde.pendingDefense!.atk.roll } }, { porteur: H.id }]);
    } finally {
      rouverte.fermer();
    }
  });

  it('une attaque sur une cible inconsciente : le jet de l’attaquant sort une fois, en réussite forcée', () => {
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
    ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
    const garde = ouverture.etat();
    ouverture.fermer();
    const { H, E, patch } = auContact(garde);
    addCondition(E, 'inconscient');
    const partie = creerPartie({ ...garde, ...patch }, ENTREES);
    try {
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      const jetes = testsJetes(partie.envoyer({ type: 'jetLancer', args: ['attaque'] }));
      expect(jetes).toEqual([{
        porteur: H.id, reference: { genre: 'competence', id: 'corps-a-corps', spec: 'base' }, forcee: true,
        issue: { roll: partie.etat().pendingAttack!.result!.attackerRoll, cible: expect.any(Number), dr: expect.any(Number), reussi: true },
      }]);
    } finally {
      partie.fermer();
    }
  });

  it('la Résilience puis le dé choisi : un seul jet forcé sort', () => {
    const scene = { ...emptyScene('epreuve', 4, 4), id: 'epreuve' };
    scene.entities.push({
      id: 'autel', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Autel',
      usable: { actions: [{ id: 'contempler', label: 'Contempler', flow: { kind: 'test', test: { skill: { id: 'calme' }, difficulty: 'intermediaire' }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW } }] },
    } as never);
    const heros = tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => ({ ...h, pos: { x: 0, y: 0 } }));
    const partie = creerPartie({ ...etatInitialDuJeu(), party: heros, scene }, ENTREES);
    try {
      partie.envoyer({ type: 'jouerAction', args: ['autel', 'contempler'] });
      const jetes = [
        ...testsJetes(partie.envoyer({ type: 'jetForcerLaReussite', args: ['test'] })),
        ...testsJetes(partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', 5] })),
        ...testsJetes(partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', 3] })),
      ];
      expect(partie.etat().pendingTest?.roll, 'le dé choisi réécrit le jet forcé').toBe(3);
      expect(jetes).toMatchObject([{ porteur: heros[0].id, reference: { genre: 'competence', id: 'calme' }, forcee: true }]);
      expect(jetes).toHaveLength(1);
    } finally {
      partie.fermer();
    }
  });

  it('une Activité combinée au dé choisi : ses deux Tests sortent sur ce dé, dans l’ordre', () => {
    const h = herosDeScenario(idsDeTest, 'soldat');
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [h], pendingActivity: {
      heroId: h.id, kind: 'catalog', label: 'A', skillLabel: 'A', skillValue: 55, difficulty: 'intermediaire', ligne: {},
      roll: 64, target: 55, sl: -1, success: false, teste: { skill: { id: 'discretion' } },
      target2: 50, skill2: 'B', skillValue2: 50, teste2: { skill: { id: 'perception' } }, sl2: -2, success2: false,
    } as never }, ENTREES);
    try {
      const jetes = testsJetes(partie.envoyer({ type: 'jetImposerLeResultat', args: ['activite', 30] }));
      expect(jetes).toEqual([
        expect.objectContaining({ porteur: h.id, reference: { genre: 'competence', id: 'discretion' }, issue: expect.objectContaining({ roll: 30 }) }),
        expect.objectContaining({ porteur: h.id, reference: { genre: 'competence', id: 'perception' }, issue: expect.objectContaining({ roll: 30 }) }),
      ]);
    } finally {
      partie.fermer();
    }
  });

  it('la Focalisation forcée avant le jet : son Test sort, forcé', () => {
    const h = herosDeScenario(idsDeTest, 'sorcier');
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [h], pendingFocus: { casterId: h.id, spellId: h.spells![0], result: null } }, ENTREES);
    try {
      const jetes = testsJetes(partie.envoyer({ type: 'jetForcerLaReussite', args: ['focalisation'] }));
      expect(jetes).toEqual([expect.objectContaining({ porteur: h.id, reference: expect.objectContaining({ genre: 'competence', id: 'focalisation' }), forcee: true })]);
    } finally {
      partie.fermer();
    }
  });

  it('une manche de Cerevis contre un habitué : son jet figé sort au jet du joueur, avant lui', () => {
    const heros = tousLesHerosDeScenario(idsDeTest).slice(0, 1);
    const partie = creerPartie({ ...etatInitialDuJeu(), party: heros }, { ...ENTREES, reglesMaison: { 'jeux-de-taverne': true } });
    try {
      const ouverture = testsJetes(partie.envoyer({ type: 'jouerALaTaverne', args: [heros[0].id, { gameId: 'cerevis', opponent: { kind: 'profil', id: 'humain' } }] }));
      const pc = partie.etat().pendingCascade!;
      const manche = pc.participants[pc.cursor];
      const fige = manche.meta!.opposed!;
      expect(ouverture, 'le jet de l’habitué ne sort pas avant celui du joueur').toEqual([]);
      const jetes = testsJetes(partie.envoyer({ type: 'jetLancer', args: ['cascade', manche.id] }));
      expect(jetes).toMatchObject([
        { porteur: fige.attackerId, reference: { genre: 'competence', id: 'pari' }, issue: { roll: fige.aT.roll } },
        { porteur: heros[0].id, reference: { genre: 'competence', id: 'pari' } },
      ]);
      expect(fige.attackerId, 'l’habitué a une fiche').toEqual(expect.any(String));
    } finally {
      partie.fermer();
    }
  });

  it('« Tenez votre position » : le jet figé de l’armée ennemie sort au jet du PJ, avant lui', () => {
    const party = groupeDeScenario(idsDeTest, 'soldat', 'chasseur');
    const perHero = Object.fromEntries(party.map((h) => [h.id, { eventRoll: 1, left: 3, revenueBrass: 0 }]));
    const garde = surUnBancHorsTest((banc) => {
      banc.setState({ party, interlude: { weeks: 3, phase: 'activities', perHero } as never });
      banc.getState().amorcerLaBataille({ puissanceAlliee: 50, puissanceEnnemie: 55, plannedRounds: 3, situations: [['tenez-votre-position']] });
      banc.getState().engagerLaBataille();
      return banc.getState();
    });
    const partie = creerPartie({ ...garde, screen: 'massBattle' }, ENTREES);
    let rouverte = partie;
    try {
      expect(testsJetes(partie.envoyer({ type: 'fenetreChoisir', args: ['batailleDeMasse', 'scene', 'tenez-votre-position'] })), 'le jet ennemi ne sort pas avant celui du PJ').toEqual([]);
      const figee = partie.etat();
      const pa = figee.pendingActivity!;
      const armee = figee.massBattle!.ennemi.combatant.id;
      const attendus = [
        { porteur: armee, reference: { genre: 'puissance' }, issue: { roll: pa.enemyRoll } },
        { porteur: pa.heroId },
      ];
      const jetes = testsJetes(partie.envoyer({ type: 'jetLancer', args: ['activite'] }));
      expect(jetes).toMatchObject(attendus);
      expect(jetes).toHaveLength(2);
      partie.fermer();
      rouverte = creerPartie(figee, ENTREES);
      const jetesRouverte = testsJetes(rouverte.envoyer({ type: 'jetLancer', args: ['activite'] }));
      expect(jetesRouverte, 'une partie rouverte perd le jet figé de l’armée').toMatchObject(attendus);
      expect(jetesRouverte).toHaveLength(2);
    } finally {
      rouverte.fermer();
    }
  });

  it('un Contre-sort : le Test du lanceur et celui du contre-lanceur sortent une fois chacun, en Langue (Magick)', () => {
    const sorcier = { ...herosDeScenario(idsDeTest, 'sorcier'), spells: ['flechette'] };
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [sorcier], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
    ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
    const garde = ouverture.etat();
    ouverture.fermer();
    const { H, E, patch } = auContact(garde);
    E.skills = [...E.skills, { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
    const partie = creerPartie({ ...garde, ...patch }, ENTREES);
    try {
      partie.envoyer({ type: 'incanterLeSort', args: [H.id, 'flechette'] });
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      const magick = { genre: 'competence', id: 'langue', spec: 'magick' };
      const jetes = [
        ...testsJetes(partie.envoyer({ type: 'jetLancer', args: ['incantation'] })),
        ...testsJetes(partie.envoyer({ type: 'jetValider', args: ['incantation'] })),
      ];
      expect(jetes.map(({ porteur, reference }) => ({ porteur, reference }))).toEqual([{ porteur: H.id, reference: magick }, { porteur: E.id, reference: magick }]);
    } finally {
      partie.fermer();
    }
  });
});
