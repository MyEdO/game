/**
 * LA SAUVEGARDE au noyau (#3041), par la surface (`../index`) : l'instantané ne porte que l'état du JEU, une save
 * d'un autre format est refusée, une save chargée ouvre une partie (`creerPartie`) avec ses règles maison, et le
 * refus d'écrire se décide ici.
 */
import { combattantDeTest } from '../../engine/combattantDeTest.testkit';
import { effectiveArmourAt } from '../../engine/characteristics';
import { tickDurations } from '../../engine/conditions';
import { makeRNG } from '../../engine/dice';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { damageArmour, emptyArmour, estUneVraieArme, itemFromTrappingById, lacherLArme, recomputeLoadout } from '../../engine/items';
import { applyOps } from '../../engine/ops';
import { describe, it, expect, onTestFinished, vi } from 'vitest';
import {
  chargerLaSave,
  creerPartie,
  estUnPointDeReprise,
  etatInitialDuJeu,
  exporterLaSauvegarde,
  lireSave,
  metaDeSave,
  pointDeRepriseAGarder,
  refusDeSauvegarde,
  snapshotSave,
  type EtatDeJeu,
  type SaveGame,
} from '../index';
import { initialNet, type BattleState } from '../etat';
import { ouvrirLeBanc } from '../banc.testkit';
import { buildEncounter } from '../monde/encounterAuthoring';
import { emptyScene } from '../monde/scene';
import { OPTIONAL_RULES, rule, loadRuleOverrides } from '../../engine/policy';
import { conditionIds, eyes, findVehicleById, species, type TrappingData } from '../../data/index';
import { vehicleCombatant } from '../../engine/vehicle';
import { FORMAT_SAVE } from './formats.generated';
import * as referencesDeCreation from './referencesDeCreation';
import { enregistrerEntree } from '../../data/atelierDuCodex';
import { ciblePsy } from '../../engine/psych/ciblage';
import { garanti } from '../../lib/garanti';
import { testScene } from '../../scenes/test-fixture';
import { scenario as conditionsEtendues } from '../../scenes/test-scenarios/98-conditions-etendues';

/** L'état d'un hôte web : l'état du jeu, plus des clés de son interface. */
const etatDUnHote = (): EtatDeJeu & Record<string, unknown> => ({ ...etatInitialDuJeu(), camRot: 2, zoom: 1.8, reveler: true, sheetId: 'h', keyOverrides: { a: 'KeyA' } });

/** Un héros minimal, porteur d'États. */
const heros = (id: string, ...etats: string[]) => ({ id, label: id, kind: 'heros', conditions: etats.map((e) => ({ id: e, value: 1 })) });

const ENTREES = { graine: 3, cadence: 'manuel' as const, desFixes: true, persisterLeHeros: () => {} };

describe('snapshotSave — l’état du JEU, jamais l’interface d’un hôte', () => {
  it('ses clés sont celles de l’état initial du jeu, hors `campaignNarratif` ; aucune clé de l’hôte n’entre', () => {
    const save = snapshotSave(etatDUnHote(), '2026-10-27T00:00:00.000Z', { 'regle-x': true });
    const jeu = Object.keys(etatInitialDuJeu());
    const cles = Object.keys(save.data);
    expect(cles.filter((k) => !jeu.includes(k)), 'une clé de la save hors `EtatDeJeu`').toEqual([]);
    expect(jeu.filter((k) => !cles.includes(k))).toEqual(['campaignNarratif']);
    expect(metaDeSave(save)).toEqual({ version: FORMAT_SAVE, savedAt: '2026-10-27T00:00:00.000Z', sceneLabel: 'Sans scène', gameTime: etatInitialDuJeu().gameTime });
    expect(save.rules).toEqual({ 'regle-x': true });
  });

  it('le mémo de pli d’une étape à table ne part pas', () => {
    const etat = { ...etatInitialDuJeu(), pendingCascade: { steps: [{ id: 's', foldMemo: { secret: 1 } }] } } as unknown as EtatDeJeu;
    expect(JSON.stringify(snapshotSave(etat, 'x').data.pendingCascade)).not.toMatch(/foldMemo/);
  });
});

describe('lireSave — format courant', () => {
  it.each(['3bdb6fe66470f1fe', '3386ad14e6f47600', '4af3c3767de89f9f'])('relit le format %s et retire les anciens choix publics de Colérique', (version) => {
    const [cible, autre] = ['cible-ancien-format', 'autre-ancien-format'].map((id) => combattantDeTest({ id, kind: 'heros' }));
    const etat = { ...etatInitialDuJeu(), party: [cible, autre] };
    const { data, ...meta } = snapshotSave(etat, '2026-11-22T09:00:00Z');
    const { personnesVues: _personnesVues, ...sansMemoire } = data;
    const escalade = { arrivee: { x: 3, y: 4, z: 1 } };
    const ancienne = {
      ...meta, version,
      data: {
        ...sansMemoire,
        ...(version !== '3bdb6fe66470f1fe' ? { pendingTest: { actorId: autre.id, escalade } } : {}),
        pendingCascade: {
          title: 'Colérique', cursor: 0, seq: 1, log: [], purpose: 'combat',
          participants: [{ id: 'ancien-choix', kind: 'personneChoisie', actorId: autre.id, options: [
            { key: autre.id, label: autre.label }, { key: 'personne-cachee', label: 'Personne cachée' },
          ], defaultChoice: 'personne-cachee', chosen: autre.id, meta: { choiceTargetId: cible.id } }],
        },
      },
    };
    const lue = lireSave(JSON.stringify(ancienne));
    if (typeof lue === 'string') throw new Error(lue);
    const reprise = chargerLaSave(lue).etat;
    expect(reprise.personnesVues).toEqual({});
    if (version !== '3bdb6fe66470f1fe') expect(reprise.pendingTest).toMatchObject({ escalade });
    expect(reprise.pendingCascade?.participants[0]).toMatchObject({
      options: [{ key: 'personne/0', label: autre.label }],
      chosen: 'personne/0',
      defaultChoice: 'personne/0',
    });
  });

  it('réserve la reprise de la carte et de la coque à la transition de l’amarrage', () => {
    const etat: EtatDeJeu = {
      ...etatInitialDuJeu(),
      lieu: 'quai',
      worldMap: {
        id: 'reik', label: 'Reik',
        places: [{ id: 'quai', label: 'Quai', pos: { x: 10, y: 20 }, scene: { id: 'quai' } }],
        routes: [],
      },
      vessel: {
        uid: 'navire-1', vehicleId: 'barge-fluviale', wounds: { current: 48, max: 60 },
        morale: { score: 50, lastMoraleWeek: 0, factors: [] },
      },
    };
    const courante = snapshotSave(etat, '2026-11-22T06:30:00.000Z');
    const ancienne = { ...courante, version: '3bdb6fe66470f1fe' };
    const migrerLesCouleurs = vi.spyOn(referencesDeCreation, 'migrerLaSaveAvantLesDeuxCouleurs');
    onTestFinished(() => migrerLesCouleurs.mockRestore());

    expect(lireSave(exporterLaSauvegarde(ancienne))).toEqual(courante);
    expect(lireSave(exporterLaSauvegarde({ ...ancienne, version: 'e8e579742f3dbb30' }))).toBe('autreFormat');

    const carte = etat.worldMap!;
    const avecCale = snapshotSave({
      ...etat,
      worldMap: {
        ...carte,
        places: carte.places.map((lieu) => ({ ...lieu, amarrage: 'cale-seche', constructeurDeBateaux: 43, materiauxCaleSeche: true })),
      },
    }, courante.savedAt);
    expect(lireSave(exporterLaSauvegarde(avecCale))).toEqual(avecCale);
    expect(migrerLesCouleurs).not.toHaveBeenCalled();
  });

  it('relit l’usure d’un Trait Armure temporisé et la perte d’une arme de Trait dans une rencontre', () => {
    const fiche = combattantDeTest({ id: 'heros-usure', kind: 'heros' });
    const banc = ouvrirLeBanc({ etat: { party: [fiche] } });
    const scene = testScene();
    const { entities, encounter } = buildEncounter({
      id: 'enc-ours',
      enemies: [{ creature: { id: 'ours' }, pos: { x: 12, y: 10 } }],
    });
    banc.getState().lancerLaScene({
      ...scene, entities: [...scene.entities, ...entities], encounters: [...scene.encounters, encounter],
    });
    banc.getState().lancerLeCombat(encounter.id);
    const etat = banc.getState();
    const bataille = garanti(etat.battle, encounter.id, 'rencontre ouverte');
    const oursId = entities[0].id;
    const porteur = garanti(bataille.combatants.find((c) => c.id === fiche.id), fiche.id, 'combattant');
    const ours = garanti(bataille.combatants.find((c) => c.id === oursId), oursId, 'adversaire');
    const arme = garanti(ours.weapons.find(estUneVraieArme), oursId, 'arme de Trait');
    expect(ours.items ?? []).toEqual([]);

    applyOps(porteur, [{ op: 'grantTrait', trait: { id: 'armure', value: 2, matiere: 'peau' }, durationRounds: 1 }], {
      idNeuf: idsDeTest, rng: makeRNG(1), source: { kind: 'trait', id: 'metamorphose' },
    });
    expect(damageArmour(porteur, 'corps')).toBe(true);
    lacherLArme(ours, arme);

    const save = snapshotSave(etat, '2026-11-21T06:30:00.000Z');
    const lue = lireSave(exporterLaSauvegarde(save));
    if (typeof lue === 'string') throw new Error(lue);
    const relue = garanti(chargerLaSave(lue).etat.battle, encounter.id, 'rencontre relue');
    const protege = garanti(relue.combatants.find((c) => c.id === fiche.id), fiche.id, 'combattant relu');
    const desarme = garanti(relue.combatants.find((c) => c.id === oursId), oursId, 'adversaire relu');
    expect([effectiveArmourAt(protege, 'corps'), effectiveArmourAt(protege, 'tete')]).toEqual([1, 2]);
    recomputeLoadout(protege);
    recomputeLoadout(desarme);
    expect([effectiveArmourAt(protege, 'corps'), effectiveArmourAt(protege, 'tete')]).toEqual([1, 2]);
    expect(desarme.weapons.filter(estUneVraieArme)).toEqual([]);
    expect(desarme.weapons.filter((w) => w.natural).map((w) => w.attackKind)).toEqual(['morsure']);

    tickDurations(protege);
    expect([effectiveArmourAt(protege, 'corps'), effectiveArmourAt(protege, 'tete')]).toEqual([0, 0]);
  });

  it('refuse le format qui incluait les PA du Trait dans l’instantané d’armure', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-11-21T06:30:00.000Z');
    const fiche = combattantDeTest({ kind: 'heros', traits: [{ id: 'armure', value: 2, matiere: 'peau' }] });
    const ancienPorteur = { ...fiche, armour: emptyArmour(2) };
    const ancienne = { ...save, version: '53cdffa19bea1f90', data: { ...save.data, party: [ancienPorteur] } };
    expect(lireSave(exporterLaSauvegarde(ancienne))).toBe('autreFormat');
  });

  it('relit la sauvegarde du profil Pertuisane/Fauchard avec ses données intactes', () => {
    const profil: TrappingData = {
      id: 'pertuisane-fauchard',
      label: 'Pertuisane/Fauchard',
      categorie: 'melee',
      subType: { id: 'armes-d-hast' },
      hands: 2,
      availability: 'limitee',
      shape: { id: 'pertuisane' },
      qualities: [{ id: 'defensive' }, { id: 'empaleuse' }, { id: 'taillade', value: 2 }],
      price: null,
      source: { book: 'aux-armes', page: 97 },
    };
    const arme = itemFromTrappingById(profil.id, idsDeTest, (id) => id === profil.id ? profil : undefined)!;
    expect(arme).toMatchObject({ trappingId: profil.id, shape: profil.shape, qualities: profil.qualities });
    const porteur = combattantDeTest({
      kind: 'heros',
      items: [arme],
      details: { age: 24, eyes: [{ id: 'bleu', colonne: 'humain' }], hair: { label: 'Brun clair' } },
    });
    const courante = snapshotSave({ ...etatInitialDuJeu(), party: [porteur] }, '2026-11-21T06:30:00.000Z');
    const migrerLesReferences = vi.spyOn(referencesDeCreation, 'migrerLaSaveAvantLesReferences');
    onTestFinished(() => migrerLesReferences.mockRestore());

    expect(lireSave(exporterLaSauvegarde(courante))).toEqual(courante);
    expect(migrerLesReferences).not.toHaveBeenCalled();
  });

  it('refuse une sauvegarde antérieure à l’emboîtement des références de scène', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-11-21T06:30:00.000Z');
    const scene = {
      ...emptyScene('quai', 4, 4),
      triggers: [{
        id: 'depart',
        rect: { x: 1, y: 1, w: 1, h: 1 },
        flow: { kind: 'effet', effet: { type: 'setVessel', vehicleId: 'loup-imperial' } },
      }],
    };
    const ancienne = { ...save, version: '6567d83e466bf816', data: { ...save.data, scene } };
    expect(lireSave(JSON.stringify(ancienne))).toBe('autreFormat');
  });
});

describe('migrerLaSaveAvantLesReferences — résolution des anciennes couleurs', () => {
  it('résout les anciennes couleurs dans le groupe et chez le PNJ, y compris une ambiguïté du LDB', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-11-21T06:30:00.000Z');
    const data = {
      ...save.data,
      party: [{ ...heros('reiklander'), species: 'humains-reiklander', details: { age: 24, eyes: 'Bleu', hair: 'Brun clair' } }],
      battle: {
        combatants: [{
          ...heros('garde'), kind: 'ennemi', species: 'humain',
          appearanceOverride: { species: 'halflings' },
          details: { age: 35, eyes: 'Marron foncé', hair: 'Moutarde' },
        }],
      },
    };
    referencesDeCreation.migrerLaSaveAvantLesReferences(data);
    expect(data.party[0].details).toEqual({
      age: 24, eyes: [{ id: 'bleu', colonne: 'humain' }], hair: { id: 'brun-clair', colonne: 'humain' },
    });
    expect(data.battle.combatants[0].details).toEqual({
      age: 35, eyes: [{ label: 'Marron foncé' }], hair: { id: 'noir', colonne: 'halfling' },
    });
  });

  it('une espèce réaffectée au Codex ne désambiguïse pas rétrospectivement un ancien libellé', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-11-21T06:30:00.000Z');
    const espece = 'halflings-piedfoin';
    const index = species.findIndex((e) => e.id === espece);
    const transaction = enregistrerEntree('races', { ...species[index], refChar: 'humain' }, index);
    if (!transaction.ok) throw new Error(transaction.erreurs.join(', '));
    try {
      const data = { ...save.data, party: [{ ...heros('halfling'), species: espece, details: { eyes: 'Marron foncé', hair: 'Moutarde' } }] };
      referencesDeCreation.migrerLaSaveAvantLesReferences(data);
      expect(data.party[0].details?.eyes).toEqual([{ label: 'Marron foncé' }]);
    } finally {
      transaction.reprendre();
    }
  });

  it('préserve un ancien libellé devenu ambigu après édition d’une autre rangée', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-11-21T06:30:00.000Z');
    const index = eyes.findIndex((e) => e.id === 'gris');
    const rangee = eyes[index];
    const transaction = enregistrerEntree('eyes', { ...rangee, color: { ...rangee.color, humain: 'Bleu' } }, index);
    if (!transaction.ok) throw new Error(transaction.erreurs.join(', '));
    try {
      const data = { ...save.data, party: [{ ...heros('reiklander'), species: 'humain', details: { eyes: 'Bleu', hair: 'Brun clair' } }] };
      referencesDeCreation.migrerLaSaveAvantLesReferences(data);
      expect(data.party[0].details?.eyes).toEqual([{ label: 'Bleu' }]);
    } finally {
      transaction.reprendre();
    }
  });

  it('préserve la couleur ancienne dont la rangée a été remplacée au Codex', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-11-21T06:30:00.000Z');
    const index = eyes.findIndex((e) => e.id === 'gris');
    const rangee = eyes[index];
    expect(rangee.color.humain).toBe('Gris');
    const transaction = enregistrerEntree('eyes', {
      ...rangee,
      id: 'gris-ardoise',
      label: 'Gris ardoise',
      color: { ...rangee.color, humain: 'Gris ardoise' },
    }, index);
    if (!transaction.ok) throw new Error(transaction.erreurs.join(', '));
    try {
      expect(eyes.some((e) => e.color.humain === 'Gris')).toBe(false);
      const data = { ...save.data, party: [{ ...heros('reiklander'), species: 'humain', details: { eyes: 'Gris', hair: 'Brun clair' } }] };
      referencesDeCreation.migrerLaSaveAvantLesReferences(data);
      expect(data.party[0].details).toEqual({ eyes: [{ label: 'Gris' }], hair: { id: 'brun-clair', colonne: 'humain' } });
    } finally {
      transaction.reprendre();
    }
    expect(eyes[index]).toEqual(rangee);
  });
});

describe('lireSave — reprise ou refus', () => {
  it('resérialise deux couleurs d’yeux dans leur ordre et garde une rangée répétée', () => {
    const hautElfe = combattantDeTest({
      id: 'haut-elfe',
      kind: 'heros',
      details: { eyes: [{ id: 'bleu', colonne: 'haut-elfe' }, { id: 'noir', colonne: 'haut-elfe' }] },
    });
    const elfeSylvain = combattantDeTest({
      id: 'elfe-sylvain',
      kind: 'heros',
      details: { eyes: [{ id: 'gris-pale', colonne: 'elfe-sylvain' }, { id: 'gris-pale', colonne: 'elfe-sylvain' }] },
    });
    const save = snapshotSave({ ...etatInitialDuJeu(), party: [hautElfe, elfeSylvain] }, '2026-11-21T06:30:00.000Z');
    const lue = lireSave(exporterLaSauvegarde(save));
    if (typeof lue === 'string') throw new Error(lue);
    const { etat } = chargerLaSave(lue);
    expect(etat.party.map((h) => h.details?.eyes)).toEqual([hautElfe.details?.eyes, elfeSylvain.details?.eyes]);
  });

  it('une save écrite par `snapshotSave` se relit telle quelle ; d’un autre format, refusée', () => {
    const save = JSON.parse(JSON.stringify(snapshotSave(etatInitialDuJeu(), 'x'))) as SaveGame;
    expect(lireSave(JSON.stringify(save))).toEqual(save);
    expect(lireSave(JSON.stringify({ ...save, version: 'autre-format' }))).toBe('autreFormat');
  });

  it('reprend la coque de voyage dans son milieu et refuse le format antérieur au regroupement', () => {
    const base = etatInitialDuJeu();
    const vehicleId = 'barge-fluviale';
    const vessel = { vehicleId, uid: 'barge-du-groupe', morale: { score: 75, lastMoraleWeek: 0, factors: [] } };
    const vehicle = vehicleCombatant(findVehicleById(vehicleId)!, vessel.uid, 'maritime')!;
    const travelPlan: NonNullable<EtatDeJeu['travelPlan']> = {
      routeId: 'traversee', fromPlaceId: 'a', toPlaceId: 'b', km: 25, kmDone: 0, mode: 'mer',
      hoursPerDay: 6, interrupted: false, vehicle,
    };
    const courante = snapshotSave({ ...base, vessel, travelPlan }, 'x');
    const relue = lireSave(exporterLaSauvegarde(courante));
    if (typeof relue === 'string') throw new Error(relue);
    expect(chargerLaSave(relue).etat.travelPlan?.vehicle).toMatchObject({ creatureId: vehicleId, milieuNaval: 'maritime' });

    const ancienne = snapshotSave({ ...base, vessel: { ...vessel, vehicleId: 'barge' } }, 'x');
    for (const version of ['75cda557adb5237f', 'a198864262579dc1']) {
      expect(lireSave(exporterLaSauvegarde({ ...ancienne, version })), `format ${version}`).toBe('autreFormat');
    }
  });

  it('refuse le format qui persistait les semaines de sept jours et les anciennes Cartes marines (#2404)', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-11-20T00:00:00.000Z');
    expect(lireSave(exporterLaSauvegarde({ ...save, version: '188b93914cd22280' }))).toBe('autreFormat');
  });

  it('la lecture rend la save exportée, ou la cause du refus', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-10-27T00:00:00.000Z');
    expect(lireSave(exporterLaSauvegarde(save))).toEqual(save);
    expect(lireSave('{pas du json')).toBe('illisible');
    expect(lireSave(JSON.stringify({ ...save, version: 'autre-format' }))).toBe('autreFormat');
  });
});

it('charge les anciens registres dans les bornes de l’effectif, avec la solde offerte actualisée', () => {
  const base = etatInitialDuJeu();
  const vessel = {
    vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] },
    crewLost: 5,
    wagesOwed: 288,
    crew: [{ roleId: 'mousse', count: 12 }],
    recueillisSansSolde: [{ roleId: 'navigateur', count: 2 }],
  };
  const pendingCouncil = { today: 7, wageBrass: 12 * 288, phase: 'choix' as const };
  const charge = chargerLaSave(snapshotSave({ ...base, vessel, pendingCouncil }, 'x')).etat;
  expect(charge.vessel).toEqual({ ...vessel, crew: [{ roleId: 'mousse', count: 10 }], recueillisSansSolde: [] });
  expect(charge.pendingCouncil).toEqual({ ...pendingCouncil, wageBrass: 10 * 288 });

  const valide = { ...vessel, crew: [{ roleId: 'mousse', count: 8 }] };
  const chargeValide = chargerLaSave(snapshotSave({ ...base, vessel: valide }, 'x')).etat;
  expect(chargeValide.vessel).toEqual(valide);
});

describe('lireSave — la porte des scènes (`parseSceneDeProjet`)', () => {
  /** Le texte d'une save dont la scène courante ET le paquet portent la scène du scénario « Conditions étendues »,
   *  dont un choix de dialogue est gardé par `{ kind: 'status', atLeast: { tier: 'argent', standing: 1 } }`. */
  const texteDeSave = (): string => {
    const scene = conditionsEtendues.construire(idsDeTest).scene;
    const campaignDoc = { scenes: [scene], narratif: { presetsPnj: [] }, startSceneId: scene.id, projet: null };
    return exporterLaSauvegarde(snapshotSave({ ...etatInitialDuJeu(), scene, campaignDoc } as unknown as EtatDeJeu, 'x'));
  };

  it('une save dont les scènes passent la porte se relit', () => {
    expect(typeof lireSave(texteDeSave()), 'la save est refusée').toBe('object');
  });

  it('un Statut illisible dans une scène (Échelon écrit en libellé, pas en id) : refus `sceneInvalide`', () => {
    const brut = texteDeSave();
    expect(brut, 'témoin : la Condition de Statut est dans la save').toContain('"tier": "argent"');
    expect(lireSave(brut.split('"tier": "argent"').join('"tier": "Argent"'))).toBe('sceneInvalide');
  });
});

describe('chargerLaSave — l’état de jeu à ouvrir, ses règles, ses retraits', () => {
  it('ouvre une partie sur l’état chargé, écran campagne, session réseau neuve, règles maison posées', () => {
    const r = OPTIONAL_RULES.find((x) => x.kind === 'flag')!;
    const avant = { ...etatInitialDuJeu(), flags: { 'quete-x': true }, gameTime: 12345, net: { ...initialNet(), mode: 'hote' as const, roomCode: 'ABCDEF' } };
    const save = JSON.parse(JSON.stringify(snapshotSave(avant, 'x', { [r.id]: !r.default }))) as SaveGame;
    const { etat, regles, retraits } = chargerLaSave(save);
    expect(retraits).toBeNull();
    expect([etat.screen, etat.flags, etat.gameTime]).toEqual(['campaign', { 'quete-x': true }, 12345]);
    expect(etat.net, 'la session est celle de l’hôte qui charge').toEqual(initialNet());
    const partie = creerPartie(etat, { ...ENTREES, reglesMaison: regles });
    try {
      expect(partie.etat().flags).toEqual({ 'quete-x': true });
      expect(rule(r.id)).toBe(!r.default);
    } finally {
      partie.fermer();
      loadRuleOverrides({});
    }
  });

  it('élague les règles et les États hors du registre, et les nomme', () => {
    const connu = conditionIds()[0];
    const save = { ...snapshotSave(etatInitialDuJeu(), 'x'), rules: { 'regle-hors-registre': true } } as SaveGame;
    save.data = { ...save.data, party: [heros('h', connu, 'etat-hors-registre')] as unknown as SaveGame['data']['party'] };
    const { etat, regles, retraits } = chargerLaSave(save);
    expect(regles).toEqual({});
    expect(etat.party[0].conditions.map((c) => c.id)).toEqual([connu]);
    expect(retraits).toEqual({ regles: ['regle-hors-registre'], etats: ['etat-hors-registre'], groupes: [] });
  });

  it('retire ENTIER le Trait psychologique dont la Cible est hors de `groups.json`, la nomme, garde le reste (LDB 21 l.17-21)', () => {
    const connu = conditionIds()[0];
    const animosite = { type: 'animosite', cible: ciblePsy.groupe('skaven') };
    const save = snapshotSave(etatInitialDuJeu(), 'x');
    const h = { ...heros('h', connu), psychTraits: [{ type: 'haine', cible: ciblePsy.groupe('groupe-hors-registre') }, animosite, { type: 'trauma' }] };
    save.data = { ...save.data, party: [h] as unknown as SaveGame['data']['party'] };
    const { etat, retraits } = chargerLaSave(save);
    expect(etat.party[0].psychTraits).toEqual([animosite, { type: 'trauma' }]);
    expect(etat.party[0].conditions.map((c) => c.id)).toEqual([connu]);
    expect(retraits).toEqual({ regles: [], etats: [], groupes: ['groupe-hors-registre'] });
    const intacte = snapshotSave(etatInitialDuJeu(), 'x');
    intacte.data = { ...intacte.data, party: [{ ...heros('h', connu), psychTraits: [animosite] }] as unknown as SaveGame['data']['party'] };
    expect(chargerLaSave(intacte).retraits, 'une Cible connue ne retire rien').toBeNull();
  });

  it('les Terreurs subies d’un héros traversent l’écriture et la relecture de la save (ADE II 09 l.9)', () => {
    const terreursSubies = [{ brise: 2, groupes: ['skaven'] }, { brise: 1, groupes: [] }];
    const save = snapshotSave({ ...etatInitialDuJeu(), party: [{ ...heros('h'), terreursSubies }] as unknown as EtatDeJeu['party'] }, 'x');
    const lue = lireSave(exporterLaSauvegarde(save));
    if (typeof lue === 'string') throw new Error(`save refusée : ${lue}`);
    expect(chargerLaSave(lue).etat.party[0].terreursSubies).toEqual(terreursSubies);
  });

  it('une assise d’un héros absent du groupe est élaguée ; une scène sans assise n’en gagne pas le champ', () => {
    const sans = emptyScene('scene-sans-assise', 4, 4);
    expect('seatAssignments' in chargerLaSave(snapshotSave({ ...etatInitialDuJeu(), scene: sans }, 'x')).etat.scene!).toBe(false);
    const avec = { ...emptyScene('scene-assise', 4, 4), seatAssignments: { 'table-absente': { 'place-1': { kind: 'groupe' as const, rang: 0 } } } };
    expect(chargerLaSave(snapshotSave({ ...etatInitialDuJeu(), scene: avec }, 'x')).etat.scene!.seatAssignments).toEqual({});
  });

  it('re-dérive la couche narrative du paquet de campagne', () => {
    const narratif = { chapitres: [] } as unknown as NonNullable<EtatDeJeu['campaignNarratif']>;
    const campaignDoc = { scenes: [emptyScene('scene-du-paquet', 4, 4)], narratif, startSceneId: 'scene-du-paquet', projet: null };
    expect(chargerLaSave(snapshotSave({ ...etatInitialDuJeu(), campaignDoc }, 'x')).etat.campaignNarratif).toEqual(narratif);
  });
});

describe('refusDeSauvegarde — l’hôte hors combat seul écrit la save', () => {
  it('en combat : `combat` ; d’un autre siège que l’hôte : `invite` ; sinon rien', () => {
    const enCombat = { battle: {} as BattleState, serieSubie: null };
    expect(refusDeSauvegarde(enCombat, 0)).toBe('combat');
    expect(refusDeSauvegarde(enCombat, 2)).toBe('combat');
    expect(refusDeSauvegarde({ battle: null, serieSubie: null }, 2)).toBe('invite');
    expect(refusDeSauvegarde({ battle: null, serieSubie: null }, 0)).toBeNull();
  });
});

describe('le point de reprise — l’arrivée dans une autre scène d’une campagne', () => {
  it('l’arrivée du groupe dans une autre scène le pose ; l’entrée dans la première scène, un autre événement ou un appel programmé, non', () => {
    expect(estUnPointDeReprise({ type: 'emis', evt: 'arrivee_en_scene', payload: { sceneId: 'bourg', neuve: false } })).toBe(true);
    expect(estUnPointDeReprise({ type: 'emis', evt: 'arrivee_en_scene', payload: { sceneId: 'bourg', neuve: true } })).toBe(false);
    expect(estUnPointDeReprise({ type: 'emis', evt: 'scene_dirty', payload: undefined })).toBe(false);
    expect(estUnPointDeReprise({ type: 'etatGagne', porteur: 'h', etat: 'a-terre' })).toBe(false);
  });

  it('il se garde pour une campagne lancée, hors combat et au siège de l’hôte ; jamais pour un scénario de test', () => {
    const campagne = { scenes: [], narratif: { chapitres: [] } as unknown as NonNullable<EtatDeJeu['campaignNarratif']>, startSceneId: 's', projet: { id: 'campagne' } };
    const calme = { battle: null, serieSubie: null };
    expect(pointDeRepriseAGarder({ ...calme, campaignDoc: campagne }, 0)).toBe(true);
    expect(pointDeRepriseAGarder({ ...calme, campaignDoc: campagne }, 1), 'un invité').toBe(false);
    expect(pointDeRepriseAGarder({ battle: {} as BattleState, serieSubie: null, campaignDoc: campagne }, 0), 'en combat').toBe(false);
    expect(pointDeRepriseAGarder({ ...calme, campaignDoc: { ...campagne, projet: null } }, 0), 'un scénario de test').toBe(false);
    expect(pointDeRepriseAGarder({ ...calme, campaignDoc: null }, 0), 'aucun paquet').toBe(false);
  });
});
