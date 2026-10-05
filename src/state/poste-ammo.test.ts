import { describe, it, expect } from 'vitest';
import { compatibleAmmo, selectedAmmo, consumeAmmo } from '../engine/items';
import { weaponLoaded, loadRegister } from '../engine/weaponLoad';
import { resolveVolley } from '../engine/volley';
import { serveChef } from './shipPostes';
import { applyOups } from './combatFlow';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import type { Combatant, ItemInstance, ShipPoste, Weapon } from '../engine/types';
import { objetDeTest } from '../engine/objetDeTest.testkit';
import { type SurchargeDObjet } from '../engine/objetDeTest.testkit';

/**
 * #25 — MUNITIONS PAR POSTE (MDG 12 l.410-424 « Munitions pour pièces d'artillerie ») : le poste porte
 * son STOCK (`ShipPoste.ammo`) et sa SÉLECTION persistante (`ShipPoste.ammoUid`) ; le pool du chef =
 * stock du poste ∪ sa besace (`compatibleAmmo`, source unique), consommé au tir (`consumeAmmo`).
 * + INCIDENT D'ARME D'ÉQUIPE (ch.12 l.464) : « Si une arme dotée du Défaut Arme d'équipe subit un
 * Incident de tir, tous les membres de son équipage sont affectés. »
 */
const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ammoItem = (uid: string, trappingId: string, qty: number, over: SurchargeDObjet = {}): ItemInstance =>
  objetDeTest({ uid, trappingId, kind: 'ammo', subType: 'munition-de-siege', qty, qualities: [], enc: 0, equipped: false, ...over });
const mkPoste = (ammo: ItemInstance[], ammoUid?: string): ShipPoste =>
  ({ side: 'tribord',
    item: { uid: 'canon', name: 'Canon (moyen)', kind: 'ranged', subType: 'armes-de-siege', weaponGroup: 'poudre-noire',
      damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'arme-d-equipe', value: 2 }, { id: 'recharge', value: 6 }] },
    crewIds: ['chef', 'aide'], ammo, ammoUid }) as unknown as ShipPoste;
const mkCrew = (id: string, items: ItemInstance[] = []): Combatant =>
  ({ id, name: id, kind: 'hero', characteristics: { ...chars },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], items,
    skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 20 }], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
const mkHull = (poste: ShipPoste): Combatant =>
  ({ id: 'ship', name: 'Frégate', kind: 'npc', bodyShape: 'vehicule', creatureId: 'cogue', crewIds: ['chef', 'aide'],
    postes: [poste], pos: { x: 5, y: 5 }, conditions: [], weapons: [],
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 40, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: { current: 60, max: 60 }, advantage: 0, skills: [], talents: [], armour: { corps: 0 } }) as unknown as Combatant;
const foeHull = (): Combatant =>
  ({ id: 'target', name: 'Caraque', kind: 'enemy', bodyShape: 'vehicule', creatureId: 'knarr', pos: { x: 9, y: 5 },
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 40, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: { current: 60, max: 60 }, advantage: 0, conditions: [], weapons: [], skills: [], talents: [], armour: { corps: 0 }, crewIds: [] }) as unknown as Combatant;

describe('Stock de munitions du poste (MDG 12 l.410-424)', () => {
  it('compatibleAmmo du chef = stock du POSTE (en tête) ∪ sa besace ; selectedAmmo suit poste.ammoUid', () => {
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 5);
    const mitraille = ammoItem('mitraille', 'mitraille-et-poudre', 3);
    const perso = ammoItem('perso', 'boulet-perso', 2);
    const poste = mkPoste([boulet, mitraille], 'mitraille');
    const chef = mkCrew('chef', [perso]);
    serveChef(chef, poste); // pose mannedPoste + l'arme dérivée (mountSide)
    const gun = chef.weapons.find((w) => w.uid === 'canon')!;
    expect(compatibleAmmo(chef, gun).map((a) => a.uid)).toEqual(['boulet', 'mitraille', 'perso']);
    expect(selectedAmmo(chef, gun)!.uid).toBe('mitraille'); // sélection PERSISTANTE du poste
    // Registre UNIQUE d'une pièce SERVIE : la sélection vit sur LA PIÈCE (plus de choix parallèle porté par le chef).
    loadRegister(chef, gun).ammoUid = 'boulet';
    expect(selectedAmmo(chef, gun)!.uid).toBe('boulet');
  });

  it('consumeAmmo décrémente LÀ où vit la munition (stock du poste) et retire l’instance à 0', () => {
    const mitraille = ammoItem('mitraille', 'mitraille-et-poudre', 1);
    const poste = mkPoste([mitraille], 'mitraille');
    const chef = mkCrew('chef');
    serveChef(chef, poste);
    consumeAmmo(chef, mitraille);
    expect(poste.ammo!.some((a) => a.uid === 'mitraille')).toBe(false); // épuisée → retirée du coffre
    expect(chef.items).toEqual([]); // jamais touchée à la besace
  });

  it('resolveVolley tire la munition du STOCK DU POSTE (qualités de la munition fusionnées)', () => {
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 5, { qualities: [{ id: 'percutante' }], damage: { flat: 0, plusBF: false } });
    const poste = mkPoste([boulet], 'boulet');
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    const volley = resolveVolley(hull, [poste], foeHull(), 'voile', 2, true, [chef, aide], makeRNG(5));
    expect(volley.shots).toHaveLength(1);
    expect(volley.shots[0].ammoName).toBe('Boulet et poudre');
    expect(volley.shots[0].ammo!.uid).toBe('boulet');
    expect(volley.shots[0].weapon.qualities.some((q) => q.id === 'percutante')).toBe(true); // munition bakée
  });

  it('bordée jouable : la munition du poste est CONSOMMÉE au « Feu ! » (shipBatteryConfirm)', () => {
    seedBattleRng(7);
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 2);
    const poste = mkPoste([boulet], 'boulet');
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    useGame.setState({
      battle: { combatants: [hull, chef, aide, foeHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [chef, aide], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never,
    });
    useGame.getState().battleShipBattery('ship', 'target');
    const p = useGame.getState().pendingShipBattery!;
    for (const part of p.participants) useGame.getState().shipBatteryRoll(part.id);
    useGame.getState().shipBatteryConfirm();
    expect(poste.ammo![0].qty).toBe(1); // 2 → 1 : un boulet parti avec la bordée
  });

  /**
   * BORDÉE MANQUÉE (#1019) — le Test d'équipage de Tir de batterie TIENT LIEU du jet de touche de chaque
   * pièce (MDG 14 l.128) : raté (total < 1 DR, l.13), la bordée n'inflige RIEN. Mais les pièces ONT fait
   * feu : elles se déchargent (LDB 62 l.333) et brûlent leur munition (MDG 12 l.410-424). Contrat d'ÉTAT —
   * la poudre d'une bordée manquée n'est pas gratuite (une fusion des deux boucles la rendrait gratuite).
   */
  it('Test d’équipage RATÉ : 0 Dégât, mais la pièce est DÉCHARGÉE, la munition CONSOMMÉE, et le journal dit que la bordée MANQUE', () => {
    seedBattleRng(7);
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 2);
    const poste = mkPoste([boulet], 'boulet');
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    useGame.setState({
      battle: { combatants: [hull, chef, aide, foeHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [chef, aide], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never,
    });
    useGame.getState().battleShipBattery('ship', 'target');
    const before = useGame.getState().battle!.combatants.find((c) => c.id === 'target')!.wounds.current;
    // Jets FORCÉS à l'échec franc (le dé n'est pas l'objet du test, la CONSÉQUENCE l'est) : −4 DR chacun,
    // doublé pour le rôle essentiel → Test d'équipage raté quels que soient le Moral et la graine.
    const p = useGame.getState().pendingShipBattery!;
    useGame.setState({ pendingShipBattery: { ...p, participants: p.participants.map((x) => ({ ...x, result: { roll: 95, target: 55, sl: -4 } })) } } as never);
    useGame.getState().shipBatteryConfirm();

    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'target')!.wounds.current).toBe(before); // aucune Blessure
    expect(poste.loaded).toBe(false); // … mais la pièce a fait feu : déchargée
    expect(poste.reloadProgress).toBe(0);
    expect(poste.ammo![0].qty).toBe(1); // … et son boulet est parti (2 → 1)
    expect(useGame.getState().journal.join('\n')).toMatch(/MANQUE/i); // aucun jet silencieux : le journal le DIT
  });
});

/**
 * La munition se fixe au CHARGEMENT — VERSANT PIÈCE : le coup d'une pièce porte SA
 * munition (`ShipPoste.loadedAmmoUid`, posée par `loadWeapon` au Test étendu de recharge, MDG 12 l.462 /
 * LDB 62 l.335) ; en changer sur une pièce chargée la DÉCHARGE. Aucune munition n'est détruite hors tir.
 */
describe('Munition FIXÉE AU CHARGEMENT — pièces d’artillerie', () => {
  const mkBattle = (hull: Combatant, crew: Combatant[], order: string[]) =>
    useGame.setState({
      battle: { combatants: [hull, ...crew, foeHull()], order, turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
      party: crew, facing: { ship: 'N' }, pendingShipBattery: null, pendingReload: null, scene: null as never,
    });

  it('setPosteAmmo sur une pièce CHARGÉE la décharge (le chef perd son gate de tir), sans rien détruire', () => {
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 5);
    const mitraille = ammoItem('mitraille', 'mitraille-et-poudre', 3);
    const poste = mkPoste([boulet, mitraille], 'boulet');
    const chef = mkCrew('chef');
    const hull = mkHull(poste);
    serveChef(chef, poste); // pièce PRISE = amorcée → munition capturée
    expect(poste.loadedAmmoUid).toBe('boulet');
    mkBattle(hull, [chef, mkCrew('aide')], ['ship']);

    useGame.getState().setPosteAmmo('ship', 'canon', 'mitraille');

    expect(poste.loaded).toBe(false);            // le coup au boulet n'est plus là
    expect(poste.loadedAmmoUid).toBeUndefined();
    expect(poste.reloadProgress).toBe(0);        // Test étendu à refaire depuis zéro
    expect(weaponLoaded(chef, chef.weapons.find((w) => w.uid === 'canon')!)).toBe(false); // le chef ne peut plus tirer la pièce
    expect(poste.ammo!.find((a) => a.uid === 'boulet')!.qty).toBe(5); // stock intact : rien n'est détruit
    expect(poste.ammoUid).toBe('mitraille');     // la sélection dit « à charger »
  });

  it('setPosteAmmo sur la munition DÉJÀ chargée : sans effet (aucun rechargement imposé)', () => {
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 5);
    const poste = mkPoste([boulet], 'boulet');
    const chef = mkCrew('chef');
    serveChef(chef, poste);
    mkBattle(mkHull(poste), [chef], ['ship']);

    useGame.getState().setPosteAmmo('ship', 'canon', 'boulet');

    expect(poste.loaded).toBe(true);
    expect(poste.loadedAmmoUid).toBe('boulet');
  });

  it('recharge d’équipage en MITRAILLE → la bordée suivante tire de la MITRAILLE', () => {
    seedBattleRng(1); // jet bas → réussite franche : le Test étendu aboutit
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 5);
    const mitraille = ammoItem('mitraille', 'mitraille-et-poudre', 3);
    const poste = mkPoste([boulet, mitraille], 'boulet');
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    poste.loaded = false; // la pièce a tiré : à recharger
    poste.reloadProgress = 5; // Recharge 6 → un DR suffit
    poste.loadedAmmoUid = undefined;
    poste.ammoUid = 'mitraille'; // l'équipage charge de la mitraille
    mkBattle(hull, [chef, aide], ['ship']);

    useGame.getState().battleShipReload('ship', 'canon');
    // Jet FORCÉ à la réussite franche (le dé n'est pas l'objet du test, la CAPTURE l'est) : le Test étendu aboutit.
    const pr = useGame.getState().pendingReload!;
    useGame.setState({ pendingReload: { ...pr, roll: 5, sl: 20, success: true } });
    useGame.getState().reloadConfirm();
    expect(poste.loaded).toBe(true);
    expect(poste.loadedAmmoUid).toBe('mitraille');

    // La SÉLECTION revient au boulet APRÈS le chargement : le coup déjà chargé ne change pas pour autant.
    poste.ammoUid = 'boulet';
    const volley = resolveVolley(hull, [poste], foeHull(), 'voile', 2, true, [chef, aide], makeRNG(5));
    expect(volley.shots[0].ammo!.uid).toBe('mitraille'); // ce qui part = ce qui a été CHARGÉ
  });

  it('bascule de munition du CHEF (hotbar) : la bordée suivante ne part plus au boulet abandonné', () => {
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 5);
    const mitraille = ammoItem('mitraille', 'mitraille-et-poudre', 3);
    const poste = mkPoste([boulet, mitraille], 'boulet');
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    expect(poste.loadedAmmoUid).toBe('boulet');
    mkBattle(hull, [chef, aide], ['chef']); // le CHEF est l'actif : sa hotbar pilote `battleSelectAmmo`

    useGame.getState().battleSelectAmmo('mitraille');

    expect(poste.loaded).toBe(false); // la pièce est muette tant qu'elle n'est pas rechargée
    expect(poste.loadedAmmoUid).toBeUndefined();
    const volley = resolveVolley(hull, [poste], foeHull(), 'voile', 2, true, [chef, aide], makeRNG(5));
    expect(volley.shots[0].ammo!.uid).not.toBe('boulet');
  });

  // Le Test étendu de rechargement d'une pièce (LDB 62 l.335) est une DÉPENSE d'équipage : reprendre la
  // pièce (nouveau chef, relève) ne le remplace pas. Seule une pièce dont le cycle n'a JAMAIS commencé est
  // amorcée à la mise en batterie. Sans ce gate, changer de servant rechargerait gratis.
  it('reprendre une pièce qui a TIRÉ ne la recharge pas (le Test étendu en cours survit à la relève)', () => {
    const boulet = ammoItem('boulet', 'boulet-et-poudre', 5);
    const poste = mkPoste([boulet], 'boulet');
    const chef = mkCrew('chef');
    serveChef(chef, poste); // 1re mise en batterie : la pièce est amorcée
    expect(poste.loaded).toBe(true);

    poste.loaded = false; // elle a fait feu…
    poste.reloadProgress = 3; // … et son équipage a déjà cumulé 3 DR
    const releve = mkCrew('releve');
    serveChef(releve, poste);

    expect(poste.loaded).toBe(false); // toujours déchargée : la relève ne remplace pas le Test étendu
    expect(poste.reloadProgress).toBe(3); // et le cumul déjà obtenu n'est pas perdu non plus
    expect(weaponLoaded(releve, releve.weapons.find((w) => w.uid === 'canon')!)).toBe(false);
  });
});

describe('Incident de tir d’une Arme d’équipe (MDG 12 l.464) — tous les servants affectés', () => {
  it('applyOups misfire sur le chef d’une pièce Arme d’équipe → l’AIDE encaisse aussi', () => {
    const poste = mkPoste([]);
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    useGame.setState({
      battle: { combatants: [hull, chef, aide], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [chef, aide], facing: { ship: 'N' }, scene: null as never,
    });
    const get = () => useGame.getState();
    const set = ((patch: never) => useGame.setState(patch)) as never;
    const gun = chef.weapons.find((w) => w.uid === 'canon')! as Weapon;
    applyOups(get, set, chef, gun, { roll: 42, kind: 'misfire', label: 'Incident de Tir !' });
    expect(chef.wounds.current).toBeLessThan(12); // le tireur encaisse (Bras principal)
    expect(aide.wounds.current).toBeLessThan(12); // « tous les membres de son équipage sont affectés » (l.464)
  });

  it('arme SANS Arme d’équipe → l’Incident ne frappe que le tireur (règle LDB inchangée)', () => {
    const poste = mkPoste([]);
    poste.item.qualities = [{ id: 'recharge', value: 6 }] as never; // pas d'arme-d-equipe
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    useGame.setState({
      battle: { combatants: [hull, chef, aide], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [chef, aide], facing: { ship: 'N' }, scene: null as never,
    });
    const get = () => useGame.getState();
    const set = ((patch: never) => useGame.setState(patch)) as never;
    const gun = chef.weapons.find((w) => w.uid === 'canon')! as Weapon;
    applyOups(get, set, chef, gun, { roll: 42, kind: 'misfire', label: 'Incident de Tir !' });
    expect(chef.wounds.current).toBeLessThan(12);
    expect(aide.wounds.current).toBe(12);
  });
});
