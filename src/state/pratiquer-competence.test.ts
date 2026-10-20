/**
 * Pratiquer une Compétence (EDOC 8 l.172 ; `activities.json › pratiquer-competence`) : le poste porte la
 * Compétence CHOISIE, de l'épinglage (`setTravelRole`) au départ (`startTravel`, qui pose les postes
 * depuis les rôles) jusqu'à la rangée de l'Étape. Compétences offertes, dans la liste `freeSkill` de
 * l'Activité : LDB 09 l.30, l.36, l.44, l.46.
 * Sans Compétence choisie, le poste n'est pas tenu (EDOC 8 l.133).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import type { WorldMap } from '../noyau/worldMap';
import { seedBattleRng } from '../noyau/battleRng';
import { setRule, resetRule } from '../engine/policy';
import { activityById, competencesAPratiquer, postingTenu, refusCandidatActivite, stageAssignmentFromRoles } from '../engine/activities';
import { refusNePeutTenter } from '../engine/skills';
import { ECHEC_SANS_JET } from '../engine/tests';
import { refLabel, skills, specPoolOf } from '../data';
import { avecActivite } from './activiteMer.testkit';
import { avanceEtapeCascade } from './cascade.testkit';
import type { Combatant } from '../engine/types';
import type { BatchParticipant } from '../noyau/pendings';
import type { RefDesignee } from '../data/schemas/grammaire/ref';

const heros = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    skills: [{ id: 'escalade', advances: 10 }, { id: 'evaluation', advances: 0 }] as Combatant['skills'],
    ...over,
  } as Combatant);

const scene = (id: string, label: string): Scene => Object.assign(emptyScene('scene-test', 10, 10), { id, label });
const CARTE: WorldMap = {
  id: 'carte-test', label: 'Carte de test',
  places: [
    { id: 'pa', label: 'Village A', pos: { x: 20, y: 50 }, scene: 'lieu-a-scene' },
    { id: 'pb', label: 'Bourg B', pos: { x: 70, y: 40 }, scene: 'lieu-b-scene' },
  ],
  routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 24, modes: ['pied'], perilDie: 0 }],
};

/** Rangée du héros dans la bande des postes de l'Étape, montée par le producteur réel : rôle épinglé
 *  (`setTravelRole`), départ (`startTravel`), qui ouvre la cascade du jour, puis la Météo d'Étape jouée. */
function rangeeAuDepart(posting: Parameters<ReturnType<typeof useGame.getState>['setTravelRole']>[1]): BatchParticipant | undefined {
  useGame.setState({ party: [heros()], journal: [], pendingCascade: null, travelPlan: null });
  useGame.getState().loadProject({ scenes: [scene('lieu-a-scene', 'Village A'), scene('lieu-b-scene', 'Bourg B')], entryId: 'lieu-a-scene', worldMap: CARTE, projet: null });
  useGame.getState().setTravelRole('h', posting);
  useGame.getState().startTravel('r1', 'pied');
  const bande = () => useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'stagePosteBatch');
  // La Météo d'Étape ouvre la cascade du jour ; la bande des postes la suit.
  for (let garde = 0; !bande() && garde < 10; garde++) {
    const p = useGame.getState().pendingCascade;
    if (!p?.participants[p.cursor]) break;
    avanceEtapeCascade(useGame.getState);
  }
  return bande()?.participants?.find((p) => p.id === 'h');
}

/** L'Activité du catalogue, relue à chaque appel : `setDataset` la remplace. */
const pratiquer = () => activityById('pratiquer-competence')!;

/** Exécute `fn` avec la liste `freeSkill` de Pratiquer éditée, posée par le seam `setDataset` du Compendium. */
const avecListe = <T,>(liste: RefDesignee[], fn: () => T): T => avecActivite({ ...pratiquer(), freeSkill: liste }, fn);

describe('Pratiquer une Compétence : les Compétences offertes', () => {
  it('celles de sa fiche d’abord, une Avancée sans Augmentation fermée avec son refus', () => {
    const h = heros();
    expect(competencesAPratiquer(h, pratiquer()).slice(0, 2)).toEqual([
      { ref: { id: 'escalade' } },
      { ref: { id: 'evaluation' }, refus: refusNePeutTenter(h, { skill: 'evaluation' }) },
    ]);
  });

  it('les Compétences de base hors fiche sont offertes ouvertes, aucune Avancée hors fiche (LDB 09 l.30)', () => {
    const offertes = competencesAPratiquer(heros(), pratiquer());
    expect(offertes).toContainEqual({ ref: { id: 'orientation' } });
    const horsFiche = offertes.slice(2);
    expect(horsFiche.every((o) => skills.find((sd) => sd.id === o.ref.id)?.acces === 'base' && !o.refus)).toBe(true);
    expect(offertes.some((o) => o.ref.id === 'metier')).toBe(false);
  });

  it('une Compétence de base GROUPÉE s’offre par chacune de ses Spécialisations, jamais nue (LDB 09 l.36, l.44)', () => {
    const offertes = competencesAPratiquer(heros({ skills: [] }), pratiquer());
    const groupees = skills.filter((sd) => sd.acces === 'base' && specPoolOf(sd).length > 0);
    expect(groupees.map((sd) => sd.id).sort()).toEqual(['art', 'chevaucher', 'corps-a-corps', 'discretion', 'divertissement']);
    for (const sd of groupees) {
      expect(offertes.filter((o) => o.ref.id === sd.id && !o.ref.spec), sd.id).toEqual([]);
      expect(offertes.filter((o) => o.ref.id === sd.id).map((o) => o.ref.spec), sd.id).toEqual(specPoolOf(sd));
    }
  });

  it('Sigrid : Divertissement (Chant) acquise, Divertissement (Comédie) reste offerte, ouverte, et Chant une seule fois (LDB 09 l.46)', () => {
    const offertes = competencesAPratiquer(heros({ skills: [{ id: 'divertissement', spec: 'chant', advances: 8 }] as Combatant['skills'] }), pratiquer());
    expect(offertes).toContainEqual({ ref: { id: 'divertissement', spec: 'comedie' } });
    expect(offertes.filter((o) => o.ref.id === 'divertissement' && o.ref.spec === 'chant')).toEqual([{ ref: { id: 'divertissement', spec: 'chant' } }]);
  });

  it('candidat : ouvert s’il peut tenter une Compétence ; Inconscient, fermé dès le premier niveau avec sa raison', () => {
    const def = activityById('pratiquer-competence')!;
    expect(refusCandidatActivite(heros(), def)).toBeUndefined();
    const ko = heros({ conditions: [{ id: 'inconscient', value: 1 }] } as Partial<Combatant>);
    expect(competencesAPratiquer(ko, def).every((o) => o.refus)).toBe(true);
    expect(refusCandidatActivite(ko, def)).toBe(refusNePeutTenter(ko, { action: def.label }));
  });
});

describe('Pratiquer une Compétence : la liste `freeSkill` éditée au Compendium (EDOC 8 l.172)', () => {
  it('une Compétence retirée de la liste n’est plus offerte, sur la fiche comme hors fiche', () => {
    const sansElles = pratiquer().freeSkill!.filter((r) => r.id !== 'orientation' && r.id !== 'escalade');
    const offertes = avecListe(sansElles, () => competencesAPratiquer(heros(), pratiquer()));
    expect(offertes.some((o) => o.ref.id === 'orientation')).toBe(false);
    expect(offertes.some((o) => o.ref.id === 'escalade')).toBe(false);
    expect(offertes).toContainEqual({ ref: { id: 'athletisme' } });
  });

  it('une Spécialisation listée ne couvre qu’elle ; la Compétence listée sans Spécialisation les couvre toutes', () => {
    const offertes = avecListe([{ id: 'divertissement', spec: 'chant' }, { id: 'art' }], () => competencesAPratiquer(heros({ skills: [] }), pratiquer()));
    const art = skills.find((sd) => sd.id === 'art')!;
    expect(offertes.map((o) => o.ref)).toEqual([...specPoolOf(art).map((spec) => ({ id: 'art', spec })), { id: 'divertissement', spec: 'chant' }]);
  });

  it('un rôle épinglé sur une Compétence retirée de la liste n’est plus tenu, et la liste vidée de ce qu’il peut tenter le ferme', () => {
    const h = heros();
    expect(postingTenu({ activityId: 'pratiquer-competence', freeSkill: { id: 'escalade' } })).toBe(true);
    avecListe([{ id: 'evaluation' }], () => {
      expect(postingTenu({ activityId: 'pratiquer-competence', freeSkill: { id: 'escalade' } })).toBe(false);
      expect(refusCandidatActivite(h, pratiquer())).toBe(refusNePeutTenter(h, { action: pratiquer().label }));
    });
  });
});

describe('Pratiquer une Compétence : du rôle épinglé à la rangée de l’Étape', () => {
  beforeEach(() => { seedBattleRng(1); setRule('travel-etapes', true); });
  afterEach(() => resetRule('travel-etapes'));

  it('Compétence choisie : la rangée de la bande la teste, elle', () => {
    const rangee = rangeeAuDepart({ activityId: 'pratiquer-competence', freeSkill: { id: 'escalade' } })!;
    expect(rangee.label).toBe(refLabel('skills', { id: 'escalade' }));
    expect(rangee.result).toBeNull();
  });

  it('Compétence choisie que le héros ne peut pas tenter : la rangée naît sans jet, refus nommé', () => {
    const rangee = rangeeAuDepart({ activityId: 'pratiquer-competence', freeSkill: { id: 'evaluation' } })!;
    expect(rangee.result).toBe(ECHEC_SANS_JET);
    expect(rangee.refus).toBe(refusNePeutTenter(useGame.getState().party[0], { skill: 'evaluation' }));
  });
});

describe('Poste tenu : une seule source (`postingTenu`)', () => {
  beforeEach(() => useGame.setState({ party: [heros()], journal: [] }));

  it('`setTravelRole` refuse Pratiquer une Compétence sans Compétence : le rôle épinglé ne bouge pas', () => {
    useGame.getState().setTravelRole('h', { activityId: 'recuperer' });
    useGame.getState().setTravelRole('h', { activityId: 'pratiquer-competence' });
    expect(useGame.getState().party[0].travelRole).toEqual({ activityId: 'recuperer' });
  });

  it('un rôle épinglé que l’édition du catalogue rend non tenu n’est plus épinglé : l’Étape retombe sur le rôle inféré', () => {
    useGame.getState().setTravelRole('h', { activityId: 'recuperer' });
    avecActivite({ ...activityById('recuperer')!, freeSkill: [{ id: 'escalade' }] }, () => {
      const h = useGame.getState().party[0];
      expect(postingTenu(h.travelRole!)).toBe(false);
      expect(stageAssignmentFromRoles([h]).h?.activityId).not.toBe('recuperer');
      expect(stageAssignmentFromRoles([h])).toEqual(stageAssignmentFromRoles([{ ...h, travelRole: undefined }]));
    });
  });
});
