import { describe, expect, it } from 'vitest';
import { findTrappingById } from '../data';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { EMPTY_FLOW } from '../engine/flowCore';
import { activeLoadout, isUnarmed } from '../engine/items';
import { malepierreReserveOf } from '../engine/magic';
import { skillBaseValue, testValue } from '../engine/skills';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { objetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { testScene } from '../scenes/test-fixture';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { auContact, MELEE } from './combatDeTest.testkit';
import { applyEffects, runFlow } from './combatEffects';
import { applyAttackResult } from './combatFlow';
import { etatInitialDuJeu } from './etat';
import { emptyNarratif } from './monde/campaignNarratif';
import { testFlow } from './monde/flow';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { emptyScene, sceneMetresPerTile, type Scene } from './monde/scene';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { sceneLightSources } from './visionState';
import { parseProject } from './worldMap';

function ouvrir(banc: Banc, objets: NarratifBlock['objets'], scene: Scene = emptyScene('objets-portes', 6, 6)): void {
  const projet = parseProject({
    type: 'projet', id: 'regles-des-objets', label: 'Règles des objets', versionContenu: 1, maison: 'Objets de test',
    scenes: [scene], narratif: { ...emptyNarratif(), objets },
  });
  banc.getState().chargerLeProjet({ scenes: projet.scenes, entryId: scene.id, narratif: projet.narratif, projet });
}

const porteur = (banc: Banc) => banc.getState().party[0];

function donner(banc: Banc, trappingId: string) {
  applyEffects(banc.getState, banc.setState, [{ type: 'giveTrapping', trappingId, heroId: porteur(banc).id }]);
  return porteur(banc).items!.find((it) => it.trappingId === trappingId)!;
}

function orienter(banc: Banc): number {
  runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'orientation' } }, EMPTY_FLOW, EMPTY_FLOW));
  banc.getState().ensemencerLeTirage(8);
  banc.getState().jetLancer('test');
  const resultat = banc.getState().pendingTest!;
  expect(resultat.success).toBe(true);
  banc.getState().jetValider('test');
  return resultat.sl;
}

describe('règles intrinsèques des objets d’une campagne jouée', () => {
  it('la Carte marine ne modifie pas les DR d’un Test d’Orientation à terre (MDG 15 l.290)', () => {
    const banc = ouvrirLeBanc({ etat: { party: [combattantDeTest({ kind: 'heros' })] } });
    ouvrir(banc, []);
    const drATerre = orienter(banc);
    expect(donner(banc, 'carte-marine')).toBeDefined();
    expect(orienter(banc) - drATerre).toBe(0);
  });

  /** MDG 14 l.275 ; LDB 74 l.58 */
  it('éclaire la scène quand la lampe est portée et bonifie l’Orientation même lorsqu’elle est rangée, après sauvegarde', () => {
    const lampe = objetDeCampagne({
      id: 'lampe-de-navigation', label: 'Lampe de navigation',
      categorie: 'trapping', subType: { id: 'vetements-et-accessoires' }, enc: 1,
      passive: [
        { op: 'skillDRBonus', skill: { id: 'orientation' }, bonus: 1 },
        { op: 'light', radiusM: 20, tone: { id: 'lanterne' } },
      ],
    });
    const banc = ouvrirLeBanc({ etat: { party: [combattantDeTest({ kind: 'heros' })] } });
    ouvrir(banc, [lampe]);
    const sansLampe = orienter(banc);
    const sac = donner(banc, 'sac-a-dos');
    const { uid } = donner(banc, lampe.id);
    const lumieresPortees = () => sceneLightSources(banc.getState()).filter((source) => source.carried);
    expect(lumieresPortees()).toEqual([]);
    banc.getState().equiperLObjet(uid);
    const rayon = 20 / sceneMetresPerTile(banc.getState().scene!);
    expect(lumieresPortees()).toMatchObject([{ radiusTiles: rayon, tone: 'lanterne' }]);
    expect(orienter(banc)).toBe(sansLampe + 1);

    const save = sauverLeBanc(banc);
    resetSceneRegistry();
    banc.setState(etatInitialDuJeu());
    chargerSurLeBanc(banc, save);
    expect(porteur(banc).items?.find((it) => it.trappingId === lampe.id)).toMatchObject({ uid, equipped: true });
    expect(lumieresPortees()).toMatchObject([{ radiusTiles: rayon, tone: 'lanterne' }]);

    banc.getState().rangerLObjet(uid, sac.uid);
    expect(porteur(banc).items?.find((it) => it.uid === uid)).toMatchObject({ inside: sac.uid, equipped: false });
    expect(lumieresPortees()).toEqual([]);
    expect(orienter(banc)).toBe(sansLampe + 1);
  });

  /** LDB 09 l.168 ; LDB 67 l.66 */
  it('l’outil déclaré par la campagne ôte le malus de Crochetage, même rangé', () => {
    const outil = objetDeCampagne({
      ...findTrappingById('outils-de-crochetage')!, id: 'rossignols-du-projet', label: 'Rossignols',
    });
    const banc = ouvrirLeBanc({ etat: { party: [combattantDeTest({ kind: 'heros' })] } });
    ouvrir(banc, [outil]);
    const sujet = { skill: { id: 'crochetage' } };
    const valeurDuTest = () => testValue(porteur(banc), sujet);
    const sansMalus = skillBaseValue(porteur(banc), sujet);
    expect(valeurDuTest()).toBe(sansMalus - 10);
    const sac = donner(banc, 'sac-a-dos');
    expect(donner(banc, outil.id).inside).toBe(sac.uid);
    expect(valeurDuTest()).toBe(sansMalus);
  });

  /** LDB 46 l.173 ; VDM 02 l.163–165 */
  it('une incantation puise dans la réserve du fragment de campagne seulement à la validation', () => {
    const pierre = objetDeCampagne({
      ...findTrappingById('malepierre-brute')!, id: 'fragment-du-projet', label: 'Fragment de malepierre',
      niConsumedPerDR: 2, maison: 'Taux de consommation de la pierre de test',
    });
    const sorcier = herosDeScenario(idsDeTest, 'sorcier');
    sorcier.characteristics.intelligence = 85;
    const banc = ouvrirLeBanc({ desFixes: true, reglesMaison: { 'magie-vdm-incantation': true }, etat: { party: [sorcier] } });
    ouvrir(banc, [pierre]);
    expect(malepierreReserveOf(porteur(banc))).toBe(0);
    const { uid } = donner(banc, pierre.id);
    expect(malepierreReserveOf(porteur(banc))).toBe(20);

    banc.getState().incanterLeSort(sorcier.id, 'armure-aethyrique', sorcier.id);
    banc.getState().jetLancer('incantation');
    banc.getState().jetImposerLeResultat('incantation', 12);
    const consomme = banc.getState().pendingCast!.result!.malepierreConsumed!;
    expect(consomme).toBeGreaterThan(0);
    expect(malepierreReserveOf(porteur(banc))).toBe(20);
    banc.getState().jetValider('incantation');
    expect(porteur(banc).items?.find((it) => it.uid === uid)?.niReserve).toBe(20 - 2 * consomme);
  });

  /** LDB 73 l.19 */
  it('joue le Crochet de campagne comme arme et permet son entraînement seulement lorsqu’il est équipé', () => {
    const crochet = objetDeCampagne({
      ...findTrappingById('crochet')!, id: 'crochet-du-projet',
    });
    const banc = ouvrirLeBanc({ etat: { party: [combattantDeTest({ kind: 'heros', xp: 400 })] } });
    ouvrir(banc, [crochet]);
    const { uid } = donner(banc, crochet.id);
    const armeDerivee = () => porteur(banc).weapons.find((arme) => arme.derivedFromItem === uid);
    expect(armeDerivee()).toBeUndefined();
    banc.getState().entrainerLaProthese(uid);
    expect(porteur(banc).xp).toBe(400);

    banc.getState().equiperLObjet(uid);
    expect(armeDerivee()).toMatchObject({ damage: { plusBF: true, flat: 2 } });
    for (let palier = 0; palier < 4; palier++) banc.getState().entrainerLaProthese(uid);
    expect(porteur(banc).xp).toBe(0);
    expect(porteur(banc).items?.find((it) => it.uid === uid)?.prosthesisReduced).toBe(20);
    banc.getState().equiperLObjet(uid);
    expect(armeDerivee()).toBeUndefined();
    expect(porteur(banc).weapons.some(isUnarmed)).toBe(true);
  });

  /** LDB 10 l.972 */
  it.each([
    { parade: 'bouclier', perdue: true, avantage: 2 },
    { parade: 'bouclier', perdue: false, avantage: 1 },
    { parade: 'lame Protectrice', perdue: true, avantage: 0 },
  ])('Porte-bouclier avec $parade, défense perdue : $perdue, Avantages : $avantage', ({ parade, perdue, avantage }) => {
    const bouclier = objetDeCampagne({ ...findTrappingById('bouclier')!, id: 'bouclier-du-projet' });
    const lame = objetDeCampagne({ id: 'lame-protectrice-du-projet', qualities: [{ id: 'protectrice', value: 2 }] });
    const hero = combattantDeTest({ kind: 'heros', talents: [{ talentId: 'porte-bouclier', times: 2 }] });
    const banc = ouvrirLeBanc({ etat: { party: [hero] } });
    ouvrir(banc, [bouclier, lame], testScene());
    const { uid } = donner(banc, (parade === 'bouclier' ? bouclier : lame).id);
    const set = activeLoadout(porteur(banc))!;
    banc.getState().garnirLaPanoplie(hero.id, set.id, 'main', uid);

    banc.getState().lancerLeCombat('enc-mutants', undefined, { noSurprise: true });
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const { H: defenseur, E: attaquant, patch } = auContact(banc.getState());
    banc.setState(patch);
    const armeDeParade = defenseur.weapons.find((arme) => arme.uid === uid);
    expect(armeDeParade?.qualities).toContainEqual({ id: 'protectrice', value: 2 });
    applyAttackResult(banc.getState, banc.setState, attaquant, defenseur, MELEE, {
      hit: perdue, attackerRoll: 20, defenderRoll: perdue ? 75 : 15, netSL: perdue ? 2 : -2,
      location: 'corps', damage: 5, woundsLost: perdue ? 3 : 0, critical: false,
      advantageTo: perdue ? 'attaquant' : 'defenseur', defenderDefeated: false, log: '', parryWeapon: armeDeParade,
    });
    expect(banc.getState().battle!.combatants.find((c) => c.id === hero.id)?.advantage).toBe(avantage);
  });
});
