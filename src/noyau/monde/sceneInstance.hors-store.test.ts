import { describe, it, expect, beforeEach } from 'vitest';
import { captureMutation, applyMutation, type SceneMutation } from './sceneInstance';
import { emptyScene, doorIsOpen, setDoorOpen, type Scene, type WallSeg } from './scene';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { removeEntity } from '../combatPlacement';
import { chargerSurLeBanc, sansLaCleDeJeu, sauverLeBanc } from '../persistance/save.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

const DOOR_OPENED: WallSeg = { x: 1, y: 1, side: 'N', door: true, closed: true };
const DOOR_UNTOUCHED: WallSeg = { x: 3, y: 3, side: 'N', door: true, closed: true };

function fixtureScene(id: string): Scene {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  s.entities.push({ id: 'decor-untouche', kind: 'prop', pos: { x: 2, y: 0 }, decor: { id: 'tonneau' } });
  s.entities.push({ id: 'decor-retire', kind: 'prop', pos: { x: 3, y: 0 }, decor: { id: 'tonneau' } });
  s.walls = [DOOR_OPENED, DOOR_UNTOUCHED];
  return s;
}

describe('sceneInstance — helpers PURS (#707)', () => {
  it('captureMutation détecte une entité retirée', () => {
    const authored = fixtureScene('s1');
    const current: Scene = { ...authored, entities: authored.entities.filter((e) => e.id !== 'decor-retire') };
    const mut = captureMutation(current, authored);
    expect(mut).toEqual<SceneMutation>({ removedEntityIds: ['decor-retire'], flags: {} });
  });

  it('captureMutation détecte un flag de porte changé', () => {
    const authored = fixtureScene('s2');
    const current = setDoorOpen(authored, 1, 1, 'N', 0, true);
    const mut = captureMutation(current, authored);
    expect(mut).toEqual<SceneMutation>({ removedEntityIds: [], flags: { __door_1_1_N_0: true } });
  });

  it('captureMutation ignore un flag authored INCHANGÉ', () => {
    const authored = fixtureScene('s3');
    const current: Scene = { ...authored, flags: { ...authored.flags } };
    const mut = captureMutation(current, authored);
    expect(mut).toBeUndefined();
  });

  it('captureMutation renvoie undefined si rien n’a changé', () => {
    const authored = fixtureScene('s4');
    const mut = captureMutation(authored, authored);
    expect(mut).toBeUndefined();
  });

  it('applyMutation filtre les entités retirées et fusionne les flags delta', () => {
    const cloned = fixtureScene('s5');
    const mut: SceneMutation = { removedEntityIds: ['decor-retire'], flags: { __door_1_1_N_0: true } };
    const out = applyMutation(cloned, mut);
    expect(out.entities.map((e) => e.id)).not.toContain('decor-retire');
    expect(out.entities.map((e) => e.id)).toContain('decor-untouche');
    expect(out.flags.__door_1_1_N_0).toBe(true);
  });

  it('captureMutation garde l’entité ajoutée ou déplacée en jeu, à l’identique, et ignore l’ordre de ses clés', () => {
    const authored = fixtureScene('s7');
    const sac = { id: 'sol-1', kind: 'prop' as const, decor: { id: 'bourse' }, pos: { x: 4, y: 4 } };
    const deplace = { ...authored.entities.find((e) => e.id === 'decor-untouche')!, pos: { x: 5, y: 5 } };
    const reordonne = (({ decor, pos, kind, id }) => ({ decor, pos, kind, id }))(authored.entities.find((e) => e.id === 'decor-retire')!);
    const current: Scene = { ...authored, entities: [...authored.entities.map((e) => (e.id === deplace.id ? deplace : e.id === reordonne.id ? reordonne : e)), sac] };
    expect(captureMutation(current, authored)).toEqual<SceneMutation>({ removedEntityIds: [], flags: {}, entitesChangees: [deplace, sac] });
  });

  it('applyMutation remplace l’entité changée à sa place et ajoute la nouvelle, sans partager leurs objets', () => {
    const sac = { id: 'sol-1', kind: 'prop' as const, decor: { id: 'bourse' }, pos: { x: 4, y: 4 } };
    const deplace = { id: 'decor-untouche', kind: 'prop' as const, pos: { x: 5, y: 5 }, decor: { id: 'tonneau' } };
    const mut: SceneMutation = { removedEntityIds: [], flags: {}, entitesChangees: [deplace, sac] };
    const out = applyMutation(fixtureScene('s8'), mut);
    expect(out.entities.map((e) => e.id)).toEqual(['hs', 'decor-untouche', 'decor-retire', 'sol-1']);
    expect(out.entities.find((e) => e.id === 'decor-untouche')).toEqual(deplace);
    expect(out.entities.find((e) => e.id === 'sol-1')).not.toBe(sac);
  });

  it('applyMutation est un no-op si mutation absente', () => {
    const cloned = fixtureScene('s6');
    const out = applyMutation(cloned, undefined);
    expect(out).toBe(cloned);
  });
});

function hero() {
  return (blessuresSurLeProfil({
    id: 'h1', name: 'Testeur', race: 'humain', career: 'soldat', careerLevel: 1,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  })) as unknown as import('../../engine/types').Combatant;
}

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('sceneInstance — câblage noyau, REVISIT (#707)', () => {
  it('une entité retirée et une porte ouverte SURVIVENT au revisit ; le décor/porte non touché reste intact', () => {
    banc.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-a');
    const sceneB = fixtureScene('scene-b');
    banc.getState().chargerLeProjet({ scenes: [sceneA, sceneB], entryId: 'scene-a', projet: null });

    removeEntity(banc.getState, banc.setState, 'decor-retire');
    banc.setState((s) => ({ scene: setDoorOpen(s.scene!, 1, 1, 'N', 0, true) }));
    expect(banc.getState().scene!.entities.map((e) => e.id)).not.toContain('decor-retire');
    expect(doorIsOpen(banc.getState().scene!, DOOR_OPENED)).toBe(true);

    banc.getState().quitterLaScene('scene-b');
    expect(banc.getState().scene?.id).toBe('scene-b');
    expect(banc.getState().sceneInstances['scene-a']).toEqual<SceneMutation>({
      removedEntityIds: ['decor-retire'],
      flags: { __door_1_1_N_0: true },
    });

    banc.getState().quitterLaScene('scene-a');
    const back = banc.getState().scene!;
    expect(back.id).toBe('scene-a');
    expect(back.entities.map((e) => e.id)).not.toContain('decor-retire'); // ressuscité si régression
    expect(back.entities.map((e) => e.id)).toContain('decor-untouche');
    expect(doorIsOpen(back, DOOR_OPENED)).toBe(true); // referme si régression
    expect(doorIsOpen(back, DOOR_UNTOUCHED)).toBe(false); // porte jamais touchée : reste authored
  });

  it('une scène jamais mutée : sceneInstances reste vide, le revisit ne change rien', () => {
    banc.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-c');
    const sceneB = fixtureScene('scene-d');
    banc.getState().chargerLeProjet({ scenes: [sceneA, sceneB], entryId: 'scene-c', projet: null });
    banc.getState().quitterLaScene('scene-d');
    banc.getState().quitterLaScene('scene-c');
    expect(banc.getState().sceneInstances).toEqual({});
    const back = banc.getState().scene!;
    expect(back.entities.map((e) => e.id).sort()).toEqual(['decor-retire', 'decor-untouche', 'hs']);
    expect(doorIsOpen(back, DOOR_OPENED)).toBe(false);
  });

  it('nouvelle partie (lancerLaScene) REMET sceneInstances à vide', () => {
    banc.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-e');
    banc.getState().chargerLeProjet({ scenes: [sceneA], entryId: 'scene-e', projet: null });
    removeEntity(banc.getState, banc.setState, 'decor-retire');
    banc.getState().quitterLaScene('scene-e'); // capture (même scène, revisit immédiat)
    expect(Object.keys(banc.getState().sceneInstances)).toHaveLength(1);
    banc.getState().lancerLaScene(fixtureScene('scene-f'));
    expect(banc.getState().sceneInstances).toEqual({});
  });

  // RÈGLE : à l'entrée en scène, l'assise se NORMALISE — ne survit que la place dont le meuble est
  // posé, la place déclarée au catalogue, et le corps disponible.
  it('quitterLaScene : l’assise AUTHORÉE d’un héros hors groupe est élaguée à l’entrée en scène', () => {
    banc.setState({ party: [hero()] });
    const a = fixtureScene('scene-t1');
    const b = fixtureScene('scene-t2');
    b.entities.push({ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, decor: { id: 'table-ronde-4-tabourets' }, facing: 'N' });
    b.entities.push({ id: 'attable', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 2, y: 2 } }); // abord NORD
    b.seatAssignments = {
      'table-1': { 'place-1': { kind: 'entite', entityId: 'attable' }, 'place-3': { kind: 'groupe', rang: 4 } },
    };
    banc.getState().chargerLeProjet({ scenes: [a, b], entryId: 'scene-t1', projet: null });
    banc.getState().quitterLaScene('scene-t2');
    // Le PNJ authoré reste assis ; le héros qui n'est pas du groupe ne réserve rien.
    expect(banc.getState().scene!.seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'entite', entityId: 'attable' } } });
  });

  describe('save/load RÉEL (chargerLaSave, #707)', () => {
    it('l’entité retirée et la porte ouverte survivent à une vraie sauvegarde → chargement → revisit', () => {
      banc.setState({ party: [hero()] });
      const sceneA = fixtureScene('scene-g');
      const sceneB = fixtureScene('scene-h');
      banc.getState().chargerLeProjet({ scenes: [sceneA, sceneB], entryId: 'scene-g', projet: null });
      removeEntity(banc.getState, banc.setState, 'decor-retire');
      banc.getState().quitterLaScene('scene-h', undefined, { x: 0, y: 0 }); // capture scene-g avant sauvegarde d'une AUTRE scène
      const texte = sauverLeBanc(banc);

      banc.setState({ sceneInstances: {} }); // « nouvelle partie » — état écrasé avant le chargement
      expect(banc.getState().sceneInstances).toEqual({});
      chargerSurLeBanc(banc, texte);
      expect(banc.getState().sceneInstances['scene-g']).toEqual<SceneMutation>({ removedEntityIds: ['decor-retire'], flags: {} });

      banc.getState().quitterLaScene('scene-g');
      expect(banc.getState().scene!.entities.map((e) => e.id)).not.toContain('decor-retire');
    });

    // MÊME RÈGLE au CHARGEMENT : une save dont l'assise ment (meuble disparu, place inconnue, héros
    // hors groupe) arrive normalisée, jamais telle quelle.
    it('une save v28 portant une place INVALIDE arrive ÉLAGUÉE en état', () => {
      banc.setState({ party: [hero()] });
      const s = fixtureScene('scene-assise');
      s.entities.push({ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, decor: { id: 'table-ronde-4-tabourets' }, facing: 'N' });
      s.entities.push({ id: 'attable', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 2, y: 2 } }); // abord NORD de la table
      banc.getState().chargerLeProjet({ scenes: [s], entryId: 'scene-assise', projet: null });
      banc.setState((st) => ({ scene: { ...st.scene!, seatAssignments: { 'table-1': { 'place-1': { kind: 'entite', entityId: 'attable' } } } } }));
      // La save est trafiquée à la VERSION COURANTE : meuble disparu, héros hors groupe, slot inconnu
      // — exactement ce qu'un paquet de campagne réédité ou un groupe recomposé produit.
      const brut = JSON.parse(sauverLeBanc(banc)) as { data: { scene: Scene } };
      const data = brut.data;
      data.scene.seatAssignments = {
        'table-1': { 'place-1': { kind: 'entite', entityId: 'attable' }, plafond: { kind: 'entite', entityId: 'attable' } },
        'meuble-disparu': { 'place-1': { kind: 'entite', entityId: 'attable' } },
        'table-2': { 'place-1': { kind: 'groupe', rang: 4 } },
      };

      chargerSurLeBanc(banc, JSON.stringify(brut));
      expect(banc.getState().scene!.seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'entite', entityId: 'attable' } } });
    });

    it('tolérance PAR CONSTRUCTION : clé « sceneInstances » absente du snapshot → valeur initiale ({}) au chargement', () => {
      banc.setState({ party: [hero()] });
      const sceneA = fixtureScene('scene-i');
      banc.getState().chargerLeProjet({ scenes: [sceneA], entryId: 'scene-i', projet: null });
      removeEntity(banc.getState, banc.setState, 'decor-retire');
      banc.getState().quitterLaScene('scene-i'); // capture : l'état chargé avant la save porte une instance
      expect(Object.keys(banc.getState().sceneInstances)).toHaveLength(1);
      // Save écrite à la version COURANTE, clé `sceneInstances` RETIRÉE : filet n°1 de la politique de
      // version (champ manquant → `initialFields`), pas une save d'une autre version.
      chargerSurLeBanc(banc, sansLaCleDeJeu(sauverLeBanc(banc), 'sceneInstances'));
      expect(banc.getState().sceneInstances).toEqual({});
    });
  });
});
