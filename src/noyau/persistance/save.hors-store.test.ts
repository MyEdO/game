/**
 * LA SAUVEGARDE au noyau (#3041), par la surface (`../index`) : l'instantané ne porte que l'état du JEU, une save
 * d'un autre format est refusée, une save chargée ouvre une partie (`creerPartie`) avec ses règles maison, et le
 * refus d'écrire se décide ici.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { chargerLaSave, creerPartie, estUnPointDeReprise, etatInitialDuJeu, exporterLaSauvegarde, lireSave, metaDeSave, pointDeRepriseAGarder, refusDeSauvegarde, snapshotSave, type EtatDeJeu, type SaveGame } from '../index';
import { initialNet, type BattleState } from '../etat';
import { emptyScene } from '../monde/scene';
import { OPTIONAL_RULES, rule, loadRuleOverrides } from '../../engine/policy';
import { conditionIds } from '../../data/index';
import { FORMAT_SAVE } from './formats.generated';
import { ciblePsy } from '../../engine/psych/ciblage';
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

describe('lireSave — le format courant seul', () => {
  it('une save écrite par `snapshotSave` se relit telle quelle ; d’un autre format, refusée', () => {
    const save = JSON.parse(JSON.stringify(snapshotSave(etatInitialDuJeu(), 'x'))) as SaveGame;
    expect(lireSave(JSON.stringify(save))).toEqual(save);
    expect(lireSave(JSON.stringify({ ...save, version: 'autre-format' }))).toBe('autreFormat');
  });

  it('la lecture rend la save exportée, ou la cause du refus', () => {
    const save = snapshotSave(etatInitialDuJeu(), '2026-10-27T00:00:00.000Z');
    expect(lireSave(exporterLaSauvegarde(save))).toEqual(save);
    expect(lireSave('{pas du json')).toBe('illisible');
    expect(lireSave(JSON.stringify({ ...save, version: 'autre-format' }))).toBe('autreFormat');
  });
});

describe('lireSave — la porte des scènes (`parseSceneDeProjet`)', () => {
  /** Le texte d'une save dont la scène courante ET le paquet portent la scène du scénario « Conditions étendues »,
   *  dont un choix de dialogue est gardé par `{ kind: 'status', atLeast: 'Argent 1' }`. */
  const texteDeSave = (): string => {
    const scene = conditionsEtendues.construire(idsDeTest).scene;
    const campaignDoc = { scenes: [scene], narratif: { presetsPnj: [] }, startSceneId: scene.id, projet: null };
    return exporterLaSauvegarde(snapshotSave({ ...etatInitialDuJeu(), scene, campaignDoc } as unknown as EtatDeJeu, 'x'));
  };

  it('une save dont les scènes passent la porte se relit', () => {
    expect(typeof lireSave(texteDeSave()), 'la save est refusée').toBe('object');
  });

  it('un Statut illisible dans une scène (« Argent » sans Standing) : refus `sceneInvalide`', () => {
    const brut = texteDeSave();
    expect(brut, 'témoin : la Condition de Statut est dans la save').toContain('"atLeast": "Argent 1"');
    expect(lireSave(brut.split('"atLeast": "Argent 1"').join('"atLeast": "Argent"'))).toBe('sceneInvalide');
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
