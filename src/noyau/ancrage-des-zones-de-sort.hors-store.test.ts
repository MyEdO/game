import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findSpellById, spells, type SpellData } from '../data';
import { setDataset } from '../data/overrides';
import type { EntreeVivante } from '../data/datasets';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { t } from '../i18n';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resolveRoundBoundary, withPreRollFixedDie, zoneSousLeCurseur } from './combatFlow';
import type { BattleState } from './etat';
import { fenetreDIncantation } from './fenetreDIncantation';
import { emptyScene } from './monde/scene';
import { spawnEnemy } from './monde/spawn';
import { zoneCovers } from './monde/zones';
import type { Pt } from './monde/path';

const foret = findSpellById('foret-d-epines')!;
const feu = findSpellById('grands-feux-d-u-zhul')!;
const pha = findSpellById('protection-de-pha')!;

const point: EntreeVivante<SpellData> = {
  ...foret, id: 'epreuve-ancrage-point', label: 'Zone sur un point', cn: 0, variants: undefined,
  duration: { kind: 'rounds', value: 2 },
};
const cible: EntreeVivante<SpellData> = {
  ...feu, id: 'epreuve-ancrage-cible', label: 'Zone sur un ennemi', cn: 0, variants: undefined,
};
const soi: EntreeVivante<SpellData> = {
  ...pha, id: 'epreuve-ancrage-lanceur', label: 'Zone sur le lanceur', cn: 0, variants: undefined,
};
const originales = [...spells];
beforeAll(() => setDataset('spells', [...originales, point, cible, soi]));
afterAll(() => setDataset('spells', originales));

const centre = { x: 6, y: 5, z: 1 };
const bord = { x: 8, y: 5, z: 1 };

function lanceurDuSort(sort: Pick<EntreeVivante<SpellData>, 'id'>) {
  const lanceur = herosDeScenario(idsDeTest, 'sorcier');
  lanceur.characteristics.intelligence = 50;
  lanceur.characteristics['force-mentale'] = 40;
  lanceur.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 }];
  lanceur.spells = [sort.id];
  return lanceur;
}

function ouvrir(sort: Pick<EntreeVivante<SpellData>, 'id'>, { dissipation = false, metresPerTile = 2 } = {}) {
  const lanceur = lanceurDuSort(sort);
  lanceur.pos = { x: 3, y: 5, z: sort.id === point.id ? 0 : 1 };
  const allie = herosDeScenario(idsDeTest, 'sorcier');
  allie.id = 'allie';
  allie.pos = { x: 4, y: 5, z: 1 };
  const ennemi = spawnEnemy({ ref: 'humain' }, 'ennemi', { ...bord });
  ennemi.wounds = blessuresDeBase(45, 45, ennemi);
  ennemi.skills = dissipation ? [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 100 }] : [];
  const sousLeBord = spawnEnemy({ ref: 'humain' }, 'ennemi-en-bas', { ...bord, z: 0 });
  sousLeBord.skills = [];
  const neutre = spawnEnemy({ ref: 'humain' }, 'neutre', { x: 10, y: 5, z: 1 });
  neutre.kind = 'pnj';
  neutre.skills = [];

  const scene = { ...emptyScene('banc-ancrage', 20, 20), metresPerTile };
  scene.layers.push({ ...scene.layers[0], z: 1 });
  const combatants = [lanceur, allie, ennemi, sousLeBord, neutre];
  const order = combatants.map((c) => c.id);
  const battle: BattleState = {
    combatants, order, baseOrder: order, turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  };
  const banc = ouvrirLeBanc({ desFixes: true, reglesMaison: { 'magie-vdm-incantation': false } });
  const jeu = banc.getState;
  banc.setState({ mode: 'battle', scene, battle, party: [lanceur, allie] });
  if (dissipation) banc.setState({ net: { ...jeu().net, gmSeat: 0 } });
  jeu().incanterLeSort(lanceur.id, sort.id);
  return { banc, jeu, lanceur, allie, ennemi, neutre, zones: () => jeu().battle!.zones ?? [] };
}

function incanterAvec(banc: Banc, de: number): void {
  const jeu = banc.getState;
  withPreRollFixedDie(jeu, banc.setState,
    () => jeu().jetLancer('incantation'),
    () => jeu().jetImposerLeResultat('incantation', de));
}

function poserLePoint(jeu: Banc['getState'], pt: Pt): void {
  jeu().jetRegler('incantation', 'carte', 'zone');
  expect(jeu().pendingCast?.zone?.placing).toBe(true);
  jeu().cliquerLaCaseDuCombat(pt);
}

describe('ancrage des zones persistantes (LDB 47 l.28 ; LDB 48 l.252, l.389, l.747)', () => {
  it('les Grands feux exigent un ennemi et persistent dans la ZdE autour de sa case', () => {
    const { banc, jeu, allie, lanceur, ennemi, neutre, zones } = ouvrir(cible);
    expect(jeu().pendingCast).toBeNull();
    expect(zoneSousLeCurseur(jeu, centre)).toBeNull();
    jeu().cliquerLaCaseDuCombat(centre);
    jeu().cliquerLeCombattant(lanceur.id);
    jeu().cliquerLeCombattant(allie.id);
    jeu().cliquerLeCombattant(neutre.id);
    expect(jeu().pendingCast).toBeNull();

    jeu().cliquerLeCombattant(ennemi.id);
    expect(jeu().pendingCast).toMatchObject({ targetId: ennemi.id, missile: true });
    incanterAvec(banc, 7);
    expect(jeu().pendingCast?.result).toMatchObject({ cast: true });
    expect(fenetreDIncantation(jeu())?.pose).toBeNull();
    jeu().jetRegler('incantation', 'surincantationZone', 1);
    expect(jeu().pendingCast?.overcast?.zone).toBe(1);
    jeu().jetValider('incantation');

    expect(jeu().pendingCast).toBeNull();
    expect(zones()).toHaveLength(1);
    expect(zones()[0]).toMatchObject({ casterId: lanceur.id, source: { kind: 'sort', id: cible.id }, rounds: 4 });
    expect(zones()[0].tiles).toHaveLength(25);
    expect(zoneCovers(zones()[0], centre)).toBe(true);
    expect(zoneCovers(zones()[0], { x: 10, y: 5, z: 1 })).toBe(true);
    expect(zoneCovers(zones()[0], { x: 11, y: 5, z: 1 })).toBe(false);
  });

  it('la ZdE utilise le point validé, le rayon surincanté et l’étage malgré l’occupant en bordure', () => {
    const { banc, jeu, zones } = ouvrir(point);
    incanterAvec(banc, 7);
    expect(jeu().pendingCast?.result).toMatchObject({ cast: true });
    jeu().jetRegler('incantation', 'surincantationZone', 1);
    expect(zones()).toEqual([]);
    poserLePoint(jeu, centre);

    expect(jeu().pendingCast).toBeNull();
    expect(zones()).toHaveLength(1);
    expect(zones()[0].tiles).toHaveLength(25);
    expect(zoneCovers(zones()[0], { ...centre, x: 4 })).toBe(true);
    expect(zoneCovers(zones()[0], bord)).toBe(true);
    expect(zoneCovers(zones()[0], { ...bord, x: 9 })).toBe(false);
    expect(zoneCovers(zones()[0], { ...bord, z: 0 })).toBe(false);
  });

  it('le disque existe à vide, survit un round puis disparaît au terme de sa durée', () => {
    const { banc, jeu, zones, lanceur } = ouvrir(point);
    const dansLeVide = { x: 12, y: 10, z: 1 };
    incanterAvec(banc, 7);
    poserLePoint(jeu, dansLeVide);

    expect(jeu().pendingCast).toBeNull();
    expect(zones()).toHaveLength(1);
    expect(zones()[0]).toMatchObject({ casterId: lanceur.id, source: { kind: 'sort', id: point.id }, rounds: 2 });
    expect(zones()[0].tiles).toHaveLength(9);
    expect(zoneCovers(zones()[0], dansLeVide)).toBe(true);
    resolveRoundBoundary(jeu, banc.setState);
    expect(zones().map((zone) => zone.rounds)).toEqual([1]);
    resolveRoundBoundary(jeu, banc.setState);
    expect(zones()).toEqual([]);
  });

  it('un rayon en cases nul garde seulement la case posée', () => {
    const { banc, jeu, zones } = ouvrir(point, { metresPerTile: 4 });
    incanterAvec(banc, 7);
    poserLePoint(jeu, centre);
    expect(zones().map((zone) => zone.tiles)).toEqual([[centre]]);
  });

  it('Portée Vous applique la zone sur le lanceur et son étage, sans choix de point', () => {
    const { banc, jeu, lanceur, zones } = ouvrir(soi);
    incanterAvec(banc, 7);
    expect(fenetreDIncantation(jeu())).toMatchObject({ pose: null, zone: { aPoser: false } });
    jeu().jetRegler('incantation', 'carte', 'zone');
    expect(jeu().pendingCast?.zone?.placing).toBeFalsy();
    jeu().jetValider('incantation');

    expect(jeu().pendingCast).toBeNull();
    expect(zones()).toHaveLength(1);
    expect(zoneCovers(zones()[0], lanceur.pos!)).toBe(true);
    expect(zoneCovers(zones()[0], { ...lanceur.pos!, z: 0 })).toBe(false);
    expect(zoneCovers(zones()[0], { x: 2, y: 5, z: 1 })).toBe(true);
  });

  it('hors combat, la persistance du sort paraît dans le journal', () => {
    const banc = ouvrirLeBanc({ desFixes: true });
    const jeu = banc.getState;
    const lanceur = lanceurDuSort(point);
    banc.setState({ party: [lanceur] });
    jeu().incanterLeSort(lanceur.id, point.id);
    incanterAvec(banc, 7);
    expect(jeu().pendingCast?.result).toMatchObject({ cast: true });
    jeu().jetValider('incantation');

    expect(jeu().pendingCast).toBeNull();
    expect(jeu().battle).toBeNull();
    expect(jeu().journal).toContain(t('cf.zonePersiste', { spell: point.label }));
  });

  it('un jet d’Incantation raté clôt le lancement sans rendre de pose', () => {
    const { banc, jeu, zones } = ouvrir(point);
    incanterAvec(banc, 97);
    expect(jeu().pendingCast?.result).toMatchObject({ cast: false, isFumble: false });
    jeu().jetValider('incantation');
    expect(jeu().pendingCast).toBeNull();
    expect(zones()).toEqual([]);
  });

  it('une Dissipation réussie clôt le lancement avant toute pose', () => {
    const { banc, jeu, ennemi, zones } = ouvrir(point, { dissipation: true });
    incanterAvec(banc, 67);
    expect(jeu().pendingCast?.result).toMatchObject({ cast: true });
    expect(jeu().pendingCounterspell?.participants.map((p) => p.id)).toContain(ennemi.id);
    jeu().jetRegler('contreSort', 'declaration', 'solo', ennemi.id);
    jeu().jetLancer('contreSort', ennemi.id);
    jeu().jetImposerLeResultat('contreSort', 7, ennemi.id);
    expect(jeu().pendingCounterspell?.participants.find((p) => p.id === ennemi.id)?.result?.dispelled).toBe(true);
    jeu().jetValider('contreSort');
    expect(jeu().pendingCast?.result).toMatchObject({ cast: false, dispelled: true });
    jeu().jetValider('incantation');

    expect(jeu().pendingCast).toBeNull();
    expect(zones()).toEqual([]);
  });
});
