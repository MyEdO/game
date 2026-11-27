import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { ouvrirLeDuel } from '../combatDeTest.testkit';
import { armeDeTest, objetDeTest } from '../../engine/objetsDeTest.testkit';
import { weaponFromItem } from '../../engine/items';
import { ligneDe } from '../../engine/modLine.testkit';
import { RULE_REF } from '../../engine/ruleRefs';
import { lancerLeScenario } from '../lancementDeScenario';
import { cliquerSurLeCombattant } from '../combatOrParty';
import { lancementDuScenario } from '../../scenes/test-scenarios/_shared';
import { scenario } from '../../scenes/test-scenarios/siege-enceinte';
import { distanceDeContact } from '../../noyau/monde/footprint';
import { lineOfSightCover } from '../../noyau/monde/lineOfSight';
import { isWalkable, wallBetween, structureAt, structureIsDown, heightAt } from '../../noyau/monde/scene';
import { placeCombatant } from '../../noyau/monde/spawn';
import { reachable, pathTo } from '../../noyau/monde/path';
import { attackEnv, attackPlan, buildAiInput, collapseStructure, etatDeTourNeuf, runEnemyAI } from '../../noyau/combatFlow';
import { weaponLoaded } from '../../engine/weaponLoad';
import { servingCrewPresent } from '../../noyau/monde/shipPostes';
import { adversairesDe, chooseEnemyAction } from '../../noyau/monde/ai';
import { isStructure } from '../../engine/structures';
import { woundsFromHit } from '../../engine/woundsCalc';
import type { SceneEntity } from '../../noyau/monde/scene';
import type { Weapon } from '../../engine/types';
import { encounterDefSchema } from '../../data/schemas/defs-scenes/scene';
import { findSiegeEngineById } from '../../data';

const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * Siège à grande échelle (siege-enceinte) — vérif LOGIQUE headless de la Scene PRODUITE par le `MapSpec`.
 * L'ENCEINTE est une VRAIE MASSE de maçonnerie PLEINE, authorée par la recette `cells` : une bande de 2 cases
 * d'épaisseur (rangées 37-38) de `#` (mur plein) percée d'une PORTE `D` (cols 14-15). Chaque `#`/`D` auto-pose
 * une ZONE REMPART sur z1 (bloc solide à 4 m + chemin de ronde marchable + crénelure) → le z0 sous la bande est
 * IMPASSABLE (on ne traverse plus la « jupe »), SAUF le TUNNEL de la porte (z0 passable, herse sur la bouche
 * extérieure). Champ profond, rivière+pont, chemin de ronde épais garni de pièces/archers PNJ alliés-IA, RAMPE au
 * flanc gauche (déportée de la porte), batterie qui pilonne la porte, combat vertical.
 */
const MOUTH_ROW = 37; // rangée de bande côté CHAMP : l'arête N porte la HERSE (bouche extérieure du tunnel)
const INNER_ROW = 38; // rangée de bande côté COUR (le tunnel traverse les deux)
const GATE_COLS = [14, 15];

/** Trouve l'emplacement (SceneEntity à poste) dont l'équipage inclut `crewId` (ids d'affûts auto-générés). */
const emplWithCrew = (crewId: string): SceneEntity =>
  scenarioConstruit.scene.entities.find((e) => e.postes?.[0]?.crewIds?.includes(crewId))!;

it.each(GATE_COLS)('Siège, colonne %i : le joueur tire une flèche de la cour sur un assaillant à travers la herse', (x) => {
  const banc = ouvrirLeBanc({ desFixes: true });
  const get = banc.getState;
  const { H, E, poser } = ouvrirLeDuel(banc, scenario.construire(idsDeTest), 'assaut');
  const arc = objetDeTest('arc');
  const fleches = objetDeTest('fleche');
  const stock = fleches.qty!;
  H.items = [arc, fleches];
  H.weapons = [weaponFromItem(arc)];
  poser(H, { x, y: INNER_ROW + 1, z: 0 });
  poser(E, { x, y: MOUTH_ROW - 1, z: 0 });

  cliquerSurLeCombattant(get, E.id, { confirm: true });
  banc.reprendreLesEnAttente();
  expect(get().pendingAttack).toMatchObject({ attackerId: H.id, targetId: E.id });
  get().jetLancer('attaque');
  expect(get().pendingAttack?.weapon).toMatchObject({ type: 'distance', uid: arc.uid });
  get().jetImposerLeResultat('attaque', 98);
  expect(get().pendingAttack?.result).toMatchObject({ attackerRoll: 98, hit: false });
  get().jetValider('attaque');
  banc.reprendreLesEnAttente();

  expect(get().battle!.log).toContainEqual(expect.objectContaining({ kind: 'tir', actorId: H.id, targetId: E.id }));
  const tireur = get().battle!.combatants.find((c) => c.id === H.id)!;
  expect(tireur.items?.find((i) => i.uid === fleches.uid)?.qty).toBe(stock - 1);
});

describe('Siège — défendre la muraille (siege-enceinte)', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });

  it('carte PROFONDE 30×46, 2 niveaux ; champ d\'approche ≫ cour modeste', () => {
    const s = scenarioConstruit.scene;
    expect(s.dimensions).toEqual({ w: 30, h: 46 });
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    // Champ assaillant (y0 → bande y37 = 37 cases) PROFOND ; cour défenseur (y39..45 = 7 cases) MODESTE.
    expect(s.dimensions.h - 39).toBeLessThan(MOUTH_ROW); // cour ≪ champ
  });

  it('enceinte : BLOC PLEIN `mur` (z0) + chemin de ronde `pierre` (z1, 4 m) ; HERSE sur la BOUCHE extérieure ; porte = tunnel passable', () => {
    const s = scenarioConstruit.scene;
    const herses = s.walls!.filter((w) => w.structure === 'herse')
      .map(({ x, y, side, z = 0 }) => ({ x, y, side, z }))
      .sort((a, b) => a.x - b.x);
    expect(herses).toEqual(GATE_COLS.map((x) => ({ x, y: MOUTH_ROW, side: 'N', z: 0 })));
    // MODÈLE GÉNÉRAL (comme un bâtiment) : la MASSE est un BLOC PLEIN `mur` (terrain z0) — le moteur en dérive
    // toutes les faces —, le chemin de ronde une COUCHE DE SOL `pierre` marchable posée par-dessus (z1, 4 m).
    // AUCUNE « zone rempart » gameplay : la seule donnée sur z1 est la CRÉNELURE (décoration de rendu).
    const z0 = s.layers.find((l) => l.z === 0)!;
    const z1 = s.layers.find((l) => l.z === 1)!;
    const W = s.dimensions.w;
    const t0 = (x: number, y: number) => z0.tiles[y * W + x];
    const t1 = (x: number, y: number) => z1.tiles[y * W + x];
    expect(z1.crenellated).toBeDefined(); // crénelure = DÉCORATION de rendu (n'affecte NI passabilité NI LdV — cf. plus bas)
    expect(s.walls!.some((w) => w.structure === 'mur-en-pierre')).toBe(false); // courtine = terrain (bloc plein), pas WallSeg
    // Courtine = bloc plein `mur` au sol (IMPASSABLE + opaque) ; colonnes de PORTE = sol `pierre` passable (tunnel).
    for (const x of [0, 8, 21, 29]) for (const y of [MOUTH_ROW, INNER_ROW]) {
      expect(t0(x, y)).toBe('mur');
      expect(isWalkable(s, x, y, 0)).toBe(false); // masse pleine → on ne traverse pas au sol
    }
    for (const x of GATE_COLS) for (const y of [MOUTH_ROW, INNER_ROW]) {
      expect(t0(x, y)).toBe('pierre'); // tunnel : sol passable
      expect(isWalkable(s, x, y, 0)).toBe(true); // le SOL du tunnel est marchable (la herse INTACTE barre la bouche)
    }
    // Chemin de ronde = couche de sol `pierre` marchable à 4 m sur toute la bande (courtine ET porte).
    for (const x of [0, 8, 14, 21, 29]) for (const y of [MOUTH_ROW, INNER_ROW]) {
      expect(t1(x, y)).toBe('pierre');
      expect(z1.height![y * W + x]).toBe(4);
      expect(isWalkable(s, x, y, 1)).toBe(true);
    }
    expect(t0(0, 36)).not.toBe('mur'); // rangée 36 (champ) HORS enceinte
    expect(t0(0, 39)).not.toBe('mur'); // rangée 39 (cour) HORS enceinte
    // La verticalité du rempart est la COUCHE z1 (4 m) + le bloc plein du terrain, pas un champ `WallSeg.height`.
    expect(s.walls!.every((w) => !('height' in w))).toBe(true);
  });

  it('RAMPE au FLANC GAUCHE (cols 3-4) rejoint le chemin de ronde z1 (4 m) ; la PORTE (cols 14-15) n’a AUCUNE rampe derrière (zone de mort)', () => {
    const s = scenarioConstruit.scene;
    expect((s as { stairs?: unknown }).stairs).toBeUndefined(); // plus AUCUN escalier explicite
    const h0 = s.layers.find((l) => l.z === 0)!.height!;
    const h1 = s.layers.find((l) => l.z === 1)!.height!;
    const idx = (x: number, y: number) => y * s.dimensions.w + x;
    // Rampe FLANC GAUCHE (cols 3-4) : 39=4 m, 40=3 m, 41=2 m, 42=1 m, 43=0 m (raccord plat).
    for (const x of [3, 4]) {
      expect(h0[idx(x, 39)]).toBe(4); // sommet (jouxte le chemin de ronde y38)
      expect(h0[idx(x, 40)]).toBe(3);
      expect(h0[idx(x, 41)]).toBe(2);
      expect(h0[idx(x, 42)]).toBe(1);
      expect(h0[idx(x, 43)]).toBe(0);
    }
    // Chemin de ronde z1 (rangées 37 + 38) à 4 m sur les colonnes de courtine (posé PAR L'ASCII via `cells`).
    for (const x of [0, 8, 21, 29]) {
      expect(h1[idx(x, MOUTH_ROW)]).toBe(4);
      expect(h1[idx(x, INNER_ROW)]).toBe(4);
    }
    // La PORTE est aux cols 14-15 : DERRIÈRE elle (rangées 39-44 = la cour) NE contient AUCUNE case de rampe →
    // hauteur 0 partout (la rampe ne bloque plus la porte, cour = zone de mort dégagée).
    for (const x of GATE_COLS)
      for (let y = 39; y <= 44; y++)
        expect(h0[idx(x, y)]).toBe(0);
    // Connexité : depuis la cour (z0) on atteint le CHEMIN DE RONDE (z1) par la RAMPE du flanc gauche.
    const path = pathTo(s, { x: 3, y: 44, z: 0 }, { x: 6, y: INNER_ROW, z: 1 }, { blocked: new Set() });
    expect(path).not.toBeNull();
    expect(path!.some((p) => (p.z ?? 0) === 1)).toBe(true); // le trajet passe bien sur la couche 1
    // … et il grimpe bien par la rampe du flanc gauche (case surélevée en cols 3/4).
    expect(path!.some((p) => (p.x === 3 || p.x === 4) && (p.z ?? 0) === 0 && (h0[idx(p.x, p.y)] ?? 0) > 0)).toBe(true);
  });

  it('annonce au lancement que les assaillants doivent abattre la herse pour forcer le passage', () => {
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(scenario, idsDeTest));
    expect(banc.getState().journal.map((e) => e.texte)).toContainEqual(expect.stringContaining(
      "les assaillants ne peuvent forcer le passage — le tunnel de la porte — qu'une fois la herse abattue.",
    ));
  });

  // AA 10 l.42 ; AA 10 l.70 ; #4105, commentaire 6861489526.
  it.each(GATE_COLS)('colonne %i : la herse baissée laisse voir et tirer sans couvert et barre le pas et la mêlée', (x) => {
    const { H, E, poser } = ouvrirLeDuel(banc, scenario.construire(idsDeTest), 'assaut');
    const champ = { x, y: MOUTH_ROW - 1, z: 0 };
    const bouche = { x, y: MOUTH_ROW, z: 0 };
    poser(H, bouche);
    poser(E, champ);

    const s = banc.getState().scene!;
    const arete = structureAt(s, x, MOUTH_ROW, 'N')!;
    expect(arete.door).toBeFalsy();
    expect(structureIsDown(s, arete)).toBe(false);
    expect(wallBetween(s, x, champ.y, x, bouche.y, 0)).toBe(true);
    const deplacement = { blocked: new Set<string>() };
    expect(reachable(s, bouche, 1, deplacement).has(`${x},${champ.y}`)).toBe(false);

    const arc = armeDeTest('arc');
    for (const [tireur, cible] of [[H, E], [E, H]] as const) {
      expect(lineOfSightCover(s, tireur.pos!, cible.pos!, [])).toMatchObject({ blocked: false, cover: 'none' });
      expect(distanceDeContact(s, tireur, cible)).toBe(Infinity);
      expect(attackPlan(banc.getState, tireur, cible).kind, 'aucune attaque de mêlée sur place').not.toBe('attaque');

      const armes = tireur.weapons;
      tireur.weapons = [arc];
      expect(attackPlan(banc.getState, tireur, cible, { weaponUid: arc.uid }).kind).toBe('attaque');
      const tir = attackEnv(banc.getState, tireur, cible, arc);
      expect(tir.blocked).toBe(false);
      expect(ligneDe(tir.env, RULE_REF['cible-sous-couverture'])).toBeUndefined();
      tireur.weapons = armes;
    }

    const cour = { x, y: INNER_ROW + 1, z: 0 };
    expect(pathTo(s, champ, cour, deplacement)).toBeNull();
    const herse = banc.getState().battle!.combatants.find((c) =>
      c.structureEdge?.x === x && c.structureEdge.y === MOUTH_ROW && c.structureEdge.side === 'N',
    )!;
    collapseStructure(banc.getState, banc.setState, herse);

    const breche = banc.getState().scene!;
    expect(wallBetween(breche, x, champ.y, x, bouche.y, 0)).toBe(false);
    expect(reachable(breche, bouche, 1, deplacement).has(`${x},${champ.y}`)).toBe(true);
    expect(distanceDeContact(breche, H, E)).toBe(1);
    expect(attackPlan(banc.getState, H, E).kind).toBe('attaque');
    const chemin = pathTo(breche, champ, cour, deplacement);
    expect(chemin?.map((p) => ({ ...p, z: p.z ?? 0 }))).toEqual([
      champ, bouche, { x, y: INNER_ROW, z: 0 }, cour,
    ]);
    expect(isWalkable(breche, 0, MOUTH_ROW, 0)).toBe(false);
  });

  it('rivière (eau infranchissable) traversée par un PONT (planches) qui canalise l\'assaut', () => {
    const s = scenarioConstruit.scene;
    expect(isWalkable(s, 0, 20, 0)).toBe(false);   // eau au bord = infranchissable
    expect(isWalkable(s, 14, 20, 0)).toBe(true);   // pont (planches) au centre = franchissable
    expect(isWalkable(s, 15, 21, 0)).toBe(true);
  });

  it('défenseur z=1 ↔ assaillant z=0 : distance verticale (pas de mêlée à travers le vide), LdV de tir dégagée', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const scene = banc.getState().scene!;
    const hero = b.combatants.find((c) => c.kind === 'heros' && !c.aiControlled && !c.inert)!;
    // Placement PRODUCTION : `placeCombatant` stampe la hauteur métrique `pos.h` (= 4 m, chemin de ronde z1).
    hero.pos = { x: 8, y: MOUTH_ROW, z: 1 };          // sur le chemin de ronde, au-dessus de la courtine
    placeCombatant(hero, scene, hero.pos);            // RAFRAÎCHIT pos.h depuis le relief (4 m) — comme en production
    const foot = { x: 8, y: MOUTH_ROW - 1, h: heightAt(scene, 8, MOUTH_ROW - 1, 0) }; // assaillant au pied du mur (z=0, 0 m)
    // Δhauteur 4 m ÷ 2 m/case = 2 cases de séparation verticale → distance 2 (mêlée refusée à travers le vide).
    expect(distanceDeContact(banc.getState().scene, hero, { pos: foot } as never)).toBe(2);
    expect(lineOfSightCover(scene, hero.pos, { x: 8, y: 10 }, []).blocked).toBe(false); // pilonne le champ
  });

  it('la rencontre DÉCLARE le siège (`EncounterDef.siege`) — c’est ce qui ouvre les structures à l’IA', () => {
    const assaut = scenarioConstruit.scene.encounters!.find((e) => e.id === 'assaut')!;
    expect(assaut.siege).toBe(true);
    // Copié TEL QUEL sur l'état de bataille au démarrage (aucune re-dérivation côté runtime).
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    expect(banc.getState().battle!.siege).toBe(true);
  });

  it('SCHÉMA : le défaut du drapeau est LITTÉRAL — absent au parse, jamais matérialisé en `false`', () => {
    const parsed = encounterDefSchema.parse({ id: 'e', members: [] } as never) as Record<string, unknown>;
    expect('siege' in parsed).toBe(false);
    expect((parsed as { siege?: boolean }).siege).toBeUndefined();
  });

  it('SCHÉMA : DÉCOCHER en éditeur sérialise SANS la clé (une seule graphie de l’absence)', () => {
    const apresCoche = { id: 'e', members: [], siege: true };
    const apresDecoche = { ...apresCoche, siege: undefined };
    expect(encounterDefSchema.parse(apresDecoche as never)).toBeTruthy();
    expect(JSON.parse(JSON.stringify(apresDecoche))).toEqual({ id: 'e', members: [] });
    expect(JSON.stringify(apresDecoche).includes('siege')).toBe(false);
  });

  it('SCHÉMA : le drapeau est BOOLÉEN et se nomme `siege` (zod strict refuse le reste)', () => {
    expect(() => encounterDefSchema.parse({ id: 'e', members: [], siege: 'oui' } as never)).toThrow();
    expect(() => encounterDefSchema.parse({ id: 'e', members: [], sieges: true } as never)).toThrow();
  });

  it('BATTERIE assaillante : le canonnier tire sa PIÈCE SERVIE sur la herse (décision, télégraphe, coup) (#4187)', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const canonnier = b.combatants.find((c) => c.id === 'brg-canon')!; // mercenaire qui SERT le canon assaillant
    const piece = canonnier.weapons.find((w) => w.uid === canonnier.mannedPoste?.item.uid)!;
    expect(piece.type).toBe('distance'); // pièce servie au spawn (poste de l'affût)
    const affutEnt = emplWithCrew('brg-canon'); // l'emplacement dont l'équipage est le mercenaire-canonnier
    const affut = b.combatants.find((c) => c.id === affutEnt.id)!;
    expect(affut.inert).toBe(true);
    expect(affut.bodyShape).toBe('engin');
    expect(affut.species).toBeUndefined();
    expect(b.order).not.toContain(affutEnt.id); // affût inerte → aucun tour propre
    expect(affutEnt.engin?.id).toBe('canon-petit');
    expect(affutEnt.appearance).toBeUndefined();
    const input = buildAiInput(canonnier, banc.getState);
    expect(input.structures?.some((st) => st.creatureId === 'herse')).toBe(true);
    const action = chooseEnemyAction(input);
    expect(action.kind).toBe('tir');
    const { targetId, weaponUid } = action as Extract<typeof action, { kind: 'tir' }>;
    const tgt = b.combatants.find((c) => c.id === targetId);
    expect(tgt && isStructure(tgt)).toBe(true);
    expect(tgt?.creatureId).toBe('herse');
    expect(weaponUid, 'la décision désigne la pièce évaluée').toBe(piece.uid);
    expect(weaponLoaded(canonnier, piece)).toBe(true);
    // Le tour du canonnier, joué par le flux du jeu.
    banc.setState({ battle: { ...b, ...etatDeTourNeuf(), turn: b.order.indexOf(canonnier.id) } });
    runEnemyAI(banc.getState, banc.setState, canonnier.id);
    expect(banc.getState().actorAim, 'télégraphe du tir').toEqual({ fromId: canonnier.id, toId: targetId, kind: 'tir' });
    banc.jusquA((s) => (s.battle?.log ?? []).some((e) => e.kind === 'tir' && e.actorId === canonnier.id), 20);
    const apres = banc.getState().battle!;
    expect(apres.log.some((e) => e.kind === 'tir' && e.actorId === canonnier.id && e.targetId === targetId), 'le tir part sur la herse').toBe(true);
    const tireur = apres.combatants.find((c) => c.id === canonnier.id)!;
    expect(weaponLoaded(tireur, piece), 'la pièce est déchargée par le tir').toBe(false);
  });

  it('CANON DE REMPART : son empreinte tient entière sur le chemin de ronde (aucune case sur le vide de z1) (#4187)', () => {
    const s = scenarioConstruit.scene;
    const affut = emplWithCrew('crew-canon');
    const fp = findSiegeEngineById(affut.engin!.id)!.siegeFootprint!;
    expect(fp).toBe(2);
    const z1 = s.layers.find((l) => l.z === 1)!;
    expect(affut.z).toBe(1);
    for (let dy = 0; dy < fp; dy++) for (let dx = 0; dx < fp; dx++) {
      const x = affut.pos.x + dx;
      const y = affut.pos.y + dy;
      expect(z1.tiles[y * s.dimensions.w + x], `case (${x},${y}) de l'empreinte`).not.toBe('vide');
      expect(isWalkable(s, x, y, 1)).toBe(true);
    }
  });

  it('CANON DE REMPART : son servant, mené par l\'IA, tire sa pièce en contrebas (décision, télégraphe, coup) (#4187)', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const servant = b.combatants.find((c) => c.id === 'crew-canon')!;
    const piece = servant.weapons.find((w) => w.uid === servant.mannedPoste?.item.uid)!;
    expect(piece.type).toBe('distance');
    expect(servant.pos?.z).toBe(1);
    const action = chooseEnemyAction(buildAiInput(servant, banc.getState));
    expect(action.kind).toBe('tir');
    const { targetId, weaponUid } = action as Extract<typeof action, { kind: 'tir' }>;
    expect(weaponUid, 'la décision désigne la pièce servie').toBe(piece.uid);
    const cible = b.combatants.find((c) => c.id === targetId)!.pos!;
    expect(cible.z ?? 0, 'la cible est en contrebas').toBe(0);
    expect(weaponLoaded(servant, piece)).toBe(true);
    // Le tour du servant, joué par le flux du jeu.
    banc.setState({ battle: { ...b, ...etatDeTourNeuf(), turn: b.order.indexOf(servant.id) } });
    runEnemyAI(banc.getState, banc.setState, servant.id);
    expect(banc.getState().actorAim, 'télégraphe du tir').toEqual({ fromId: servant.id, toId: targetId, kind: 'tir' });
    banc.jusquA((s) => (s.battle?.log ?? []).some((e) => e.kind === 'tir' && e.actorId === servant.id), 20);
    const apres = banc.getState().battle!;
    expect(apres.log.some((e) => e.kind === 'tir' && e.actorId === servant.id && e.targetId === targetId), 'le tir part sur la cible').toBe(true);
    const tireur = apres.combatants.find((c) => c.id === servant.id)!;
    expect(weaponLoaded(tireur, piece), 'la pièce est déchargée par le tir').toBe(false);
  });

  it('PERCEPTION : un servant du rempart (z1) perçoit ses adversaires au sol (#4187)', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const servant = banc.getState().battle!.combatants.find((c) => c.id === 'crew-canon')!;
    expect(servant.pos?.z).toBe(1);
    const input = buildAiInput(servant, banc.getState);
    const percus = adversairesDe(input).filter((h) => h.pos && input.perceived?.has(`${h.pos.x},${h.pos.y},0`));
    expect(percus.length, 'adversaires au sol perçus depuis le rempart').toBeGreaterThan(0);
  });

  it('CONTRAT NÉGATIF : le MÊME canonnier, siège retiré → aucune structure en entrée, aucune décision de structure', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    // Seul le drapeau change : même scène, même roster, même canonnier servant la même pièce.
    banc.setState({ battle: { ...banc.getState().battle!, siege: undefined } });
    const b = banc.getState().battle!;
    const canonnier = b.combatants.find((c) => c.id === 'brg-canon')!;
    expect(b.combatants.some(isStructure)).toBe(true); // les structures SONT là, elles ne sont plus offertes
    const input = buildAiInput(canonnier, banc.getState);
    expect(input.structures ?? []).toEqual([]);
    const action = chooseEnemyAction(input) as { targetId?: string; thenTargetId?: string };
    const visee = b.combatants.find((c) => c.id === (action.targetId ?? action.thenTargetId));
    expect(visee ? isStructure(visee) : false).toBe(false);
  });

  it('AUCUN défaut DÉRIVÉ : un objectif « détruire la structure » sans `siege` ne rend PAS de structures', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const porte = banc.getState().battle!.combatants.find(isStructure)!;
    banc.setState({
      battle: {
        ...banc.getState().battle!,
        siege: undefined,
        victoryCondition: { type: 'destroyStructure', edge: porte.structureEdge! },
      },
    });
    const b = banc.getState().battle!;
    const canonnier = b.combatants.find((c) => c.id === 'brg-canon')!;
    expect(buildAiInput(canonnier, banc.getState).structures ?? []).toEqual([]);
  });

  it('DÉFENSEURS : archers PNJ alliés-IA (agissent seuls) ; pièces INERTES servies (hors tour)', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    // Archers défenseurs = héros pilotés par l'IA, armés d'un arc, sur le chemin de ronde (z1).
    const archers = b.combatants.filter((c) => c.aiControlled && c.kind === 'heros' && !c.inert && !c.mannedPoste);
    expect(archers.length).toBe(5); // 4 archers 'A' + 1 guetteur 'G'
    for (const archer of archers) {
      expect(archer.kind).toBe('heros');         // côté héros
      expect(archer.aiControlled).toBe(true);    // … mais piloté par l'IA (le joueur ne le micro-gère pas)
      expect(archer.weapons.some((w) => w.type === 'distance')).toBe(true); // armé d'un arc
      expect(b.order).toContain(archer.id);      // … et l'archer allié-IA A un tour
      expect(archer.pos?.z).toBe(1);             // sur le chemin de ronde
    }
    // Pièce de rempart INERTE, servie par son équipage PNJ (alliée-IA).
    const balisteEnt = emplWithCrew('crew-baliste');
    const baliste = b.combatants.find((c) => c.id === balisteEnt.id)!;
    expect(baliste.inert).toBe(true);
    // RAW-pur (AA 10 l.136-193) : un engin de siège n'a AUCUNE Blessure → NON-destructible. Un coup ÉNORME (999)
    // inflige 0 (immune via le garde `target.inert`) — on le neutralise en tuant l'équipage, pas en le frappant.
    const coup: Weapon = { label: 'Canon', type: 'distance', damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'siege' }] };
    expect(woundsFromHit(coup, baliste, 'corps', 999, 0, 1, undefined)).toBe(0);
    expect(b.order).not.toContain(balisteEnt.id); // affût inerte → aucun tour
    // La pièce est SERVIE d'office par son équipage PNJ (alliée-IA) qui TIRE la pièce (pas un arc).
    const crew = b.combatants.find((c) => c.id === 'crew-baliste')!;
    expect(crew.aiControlled).toBe(true);
    expect(crew.mannedPoste?.item.trappingId).toBe('baliste');
    expect(crew.weapons.find((w) => w.type === 'distance')?.label).toMatch(/[Bb]aliste/); // SEULE arme à distance = la baliste
  });

  it('ÉQUIPAGE QUALIFIÉ : chaque servant a la Projectiles du Groupe de SA pièce → compte dans l’effectif (AA 10 l.230)', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('assaut');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    // Servant de baliste (rempart) : Groupe Arbalète → qualifié → effectif ≥ 1.
    const crewBal = b.combatants.find((c) => c.id === 'crew-baliste')!;
    expect(crewBal.skills.some((s) => s.id === 'projectiles' && s.spec === 'arbalete')).toBe(true);
    expect(servingCrewPresent(crewBal, b.combatants)).toBeGreaterThanOrEqual(1);
    // Servant de canon (rempart) : Groupe Poudre noire.
    const crewCan = b.combatants.find((c) => c.id === 'crew-canon')!;
    expect(crewCan.skills.some((s) => s.id === 'projectiles' && s.spec === 'poudre-noire')).toBe(true);
    expect(servingCrewPresent(crewCan, b.combatants)).toBeGreaterThanOrEqual(1);
    // Canonnier de siège assaillant (brg-canon) : Groupe Poudre noire → la batterie tire qualifiée.
    const canonnier = b.combatants.find((c) => c.id === 'brg-canon')!;
    expect(canonnier.skills.some((s) => s.id === 'projectiles' && s.spec === 'poudre-noire')).toBe(true);
    expect(servingCrewPresent(canonnier, b.combatants)).toBeGreaterThanOrEqual(1);
    // Servant de catapulte assaillant (brg-cata) : Groupe Catapulte.
    const cataCrew = b.combatants.find((c) => c.id === 'brg-cata')!;
    expect(cataCrew.skills.some((s) => s.id === 'projectiles' && s.spec === 'catapulte')).toBe(true);
    expect(servingCrewPresent(cataCrew, b.combatants)).toBeGreaterThanOrEqual(1);
  });

  it('ROSTER « assaut » : servants alliés-IA au rempart, emplacements INERTES, mercenaires + gobelins ennemis', () => {
    const enc = scenarioConstruit.scene.encounters.find((e) => e.id === 'assaut')!;
    const members = enc.members!;
    const by = (id: string) => members.find((m) => m.entityId === id);
    // Servants DÉRIVÉS de la donnée : `crew` du bind → `crewIds` du poste de l'affût (setPosteCrew).
    const crewOf = (e: SceneEntity) => (e.postes ?? []).flatMap((p) => p.crewIds ?? []);
    const crewAt = (z: number) => scenarioConstruit.scene.entities.filter((e) => e.postes?.length && (e.z ?? 0) === z).flatMap(crewOf);
    // Servants de REMPART (affûts du chemin de ronde, z1) : alliés pilotés par l'IA.
    const crewRempart = crewAt(1);
    expect(crewRempart.length).toBeGreaterThan(0);
    for (const id of crewRempart) expect(by(id)).toEqual({ entityId: id, side: 'allie', ai: true });
    // Servants de la BATTERIE assaillante (z0) : ennemis (pas d'IA-flag → agissent comme ennemis normaux).
    const crewBatterie = crewAt(0);
    expect(crewBatterie.length).toBeGreaterThan(0);
    for (const id of crewBatterie) expect(by(id)).toEqual({ entityId: id, side: 'ennemi' });
    // Emplacements (rempart alliés / batterie ennemis) : INERTES, enrôlés SANS `ai`.
    const empls = scenarioConstruit.scene.entities.filter((e) => e.postes?.length);
    expect(empls.length).toBe(4);
    for (const e of empls) {
      const m = by(e.id)!;
      expect(m).toBeDefined();
      expect(m.ai).toBeUndefined(); // affût inerte : aucun tour propre
    }
    // Gobelins fantassins : 6 ennemis (marqueurs 'o').
    const gobs = scenarioConstruit.scene.entities.filter((e) => e.creature?.id === 'gobelin');
    expect(gobs.length).toBe(6);
    for (const g of gobs) expect(by(g.id)).toEqual({ entityId: g.id, side: 'ennemi' });
  });
});
