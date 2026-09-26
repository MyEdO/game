import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './siege-enceinte';
import { combatDistance } from '../../state/footprint';
import { lineOfSightCover } from '../../state/lineOfSight';
import { isWalkable, wallBetween, setStructureDown, heightAt } from '../../state/scene';
import { placeCombatant } from '../../state/spawn';
import { reachable, pathTo } from '../../state/path';
import { buildAiInput } from '../../state/combatFlow';
import { servingCrewPresent } from '../../state/shipPostes';
import { chooseEnemyAction } from '../../state/ai';
import { isStructure } from '../../engine/structures';
import { woundsFromHit } from '../../engine/woundsCalc';
import type { SceneEntity } from '../../state/scene';
import type { Weapon } from '../../engine/types';
import { buildTokens } from '../../gameIso/builders/tokens';
import { isOverhang, capsSolid } from '../../gameIso/builders/floors';
import { computeStateVisibleAndLight } from '../../state/visionState';
import { encounterDefSchema } from '../../data/schemas/defs-scenes/scene';

/**
 * Siège à grande échelle (siege-enceinte) — vérif LOGIQUE headless de la Scene PRODUITE par le `MapSpec`.
 * L'ENCEINTE est une VRAIE MASSE de maçonnerie PLEINE, authorée par la recette `cells` : une bande de 2 cases
 * d'épaisseur (rangées 37-38) de `#` (mur plein) percée d'une PORTE `D` (cols 14-15). Chaque `#`/`D` auto-pose
 * une ZONE REMPART sur z1 (bloc solide à 4 m + chemin de ronde marchable + crénelure) → le z0 sous la bande est
 * IMPASSABLE (on ne traverse plus la « jupe »), SAUF le TUNNEL de la porte (z0 passable, herse sur la bouche
 * extérieure). Champ profond, rivière+pont, chemin de ronde épais garni de pièces/archers PNJ alliés-IA, RAMPE au
 * flanc gauche (déportée de la porte), batterie qui brèche la porte, combat vertical.
 */
const MOUTH_ROW = 37; // rangée de bande côté CHAMP : l'arête N porte la HERSE (bouche extérieure du tunnel)
const INNER_ROW = 38; // rangée de bande côté COUR (le tunnel traverse les deux)
const GATE_COLS = [14, 15];

/** Trouve l'emplacement (SceneEntity à poste) dont l'équipage inclut `crewId` (ids d'affûts auto-générés). */
const emplWithCrew = (crewId: string): SceneEntity =>
  scenario.scene.entities.find((e) => e.postes?.[0]?.crewIds?.includes(crewId))!;

describe('Siège — défendre la muraille (siege-enceinte)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('carte PROFONDE 30×46, 2 niveaux ; champ d\'approche ≫ cour modeste', () => {
    const s = scenario.scene;
    expect(s.dimensions).toEqual({ w: 30, h: 46 });
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    // Champ assaillant (y0 → bande y37 = 37 cases) PROFOND ; cour défenseur (y39..45 = 7 cases) MODESTE.
    expect(s.dimensions.h - 39).toBeLessThan(MOUTH_ROW); // cour ≪ champ
  });

  it('enceinte : BLOC PLEIN `mur` (z0) + chemin de ronde `pierre` (z1, 4 m) ; HERSE sur la BOUCHE extérieure ; porte = tunnel passable', () => {
    const s = scenario.scene;
    const gate = s.walls!.filter((w) => w.structure === 'porte-de-ville');
    expect(gate.length).toBe(2);
    expect(gate.map((w) => w.x).sort((a, b) => a - b)).toEqual([14, 15]); // porte aux cols 14-15
    expect(gate.every((w) => w.y === MOUTH_ROW && w.side === 'N')).toBe(true); // bouche = arête N extérieure (côté champ)
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
    const s = scenario.scene;
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

  it('PORTE = STRUCTURE brèchable, PAS une porte ouvrable : intacte elle bloque passage+BFS cour↔champ ; abattue, la BRÈCHE rouvre', () => {
    const s = scenario.scene;
    const gate = s.walls!.filter((w) => w.structure === 'porte-de-ville');
    expect(gate.every((w) => !w.door)).toBe(true); // PAS de door:true → wallIsOpen = structureIsDown SEUL
    const g = gate[0]; // arête N de (g.x, MOUTH_ROW) : sépare la bande (y=MOUTH_ROW) du champ (y=MOUTH_ROW-1)
    expect(wallBetween(s, g.x, MOUTH_ROW, g.x, MOUTH_ROW - 1)).toBe(true);
    expect(reachable(s, { x: g.x, y: MOUTH_ROW, z: 0 }, 1, { blocked: new Set() }).has(`${g.x},${MOUTH_ROW - 1}`)).toBe(false);
    // Abattue (brèche) : passage ET BFS rouverts.
    const breached = setStructureDown(s, g.x, MOUTH_ROW, 'N', 0, true);
    expect(wallBetween(breached, g.x, MOUTH_ROW, g.x, MOUTH_ROW - 1)).toBe(false);
    expect(reachable(breached, { x: g.x, y: MOUTH_ROW, z: 0 }, 1, { blocked: new Set() }).has(`${g.x},${MOUTH_ROW - 1}`)).toBe(true);
  });

  it('TUNNEL franchissable : un chemin z0 CHAMP→COUR par la porte est BLOQUÉ intact, OUVERT à la brèche', () => {
    const s = scenario.scene;
    const gate = s.walls!.filter((w) => w.structure === 'porte-de-ville');
    const gx = gate[0].x; // colonne de porte (x14)
    const field = { x: gx, y: MOUTH_ROW - 2, z: 0 }; // (14,35) côté CHAMP
    const cour = { x: gx, y: INNER_ROW + 1, z: 0 };  // (14,39) côté COUR
    // Champ, DEUX bouches du tunnel (rangées de bande 37-38) et cour sont TOUS marchables (la masse est percée).
    for (const t of [field, { x: gx, y: MOUTH_ROW - 1, z: 0 }, { x: gx, y: MOUTH_ROW, z: 0 }, { x: gx, y: INNER_ROW, z: 0 }, cour])
      expect(isWalkable(s, t.x, t.y, 0)).toBe(true);
    // INTACTE : aucun chemin champ→cour (la masse est murée partout, la herse coupe le tunnel).
    expect(pathTo(s, field, cour, { blocked: new Set() })).toBeNull();
    // ABATTUE : le chemin existe et TRAVERSE bien les deux cases du tunnel (y37 puis y38).
    const breached = setStructureDown(s, gx, MOUTH_ROW, 'N', 0, true);
    const path = pathTo(breached, field, cour, { blocked: new Set() });
    expect(path).not.toBeNull();
    const onPath = (x: number, y: number) => path!.some((p) => p.x === x && (p.z ?? 0) === 0 && p.y === y);
    expect(onPath(gx, MOUTH_ROW)).toBe(true); // bouche CHAMP (y37) franchie
    expect(onPath(gx, INNER_ROW)).toBe(true); // bouche COUR (y38) franchie
    // On ne traverse PAS la masse ailleurs : une colonne de courtine reste impassable au sol, intacte ou non.
    expect(isWalkable(breached, 0, MOUTH_ROW, 0)).toBe(false);
  });

  it('rivière (eau infranchissable) traversée par un PONT (planches) qui canalise l\'assaut', () => {
    const s = scenario.scene;
    expect(isWalkable(s, 0, 20, 0)).toBe(false);   // eau au bord = infranchissable
    expect(isWalkable(s, 14, 20, 0)).toBe(true);   // pont (planches) au centre = franchissable
    expect(isWalkable(s, 15, 21, 0)).toBe(true);
  });

  it('défenseur z=1 ↔ assaillant z=0 : distance verticale (pas de mêlée à travers le vide), LdV de tir dégagée', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const scene = useGame.getState().scene!;
    const hero = b.combatants.find((c) => c.kind === 'hero' && !c.aiControlled && !c.inert)!;
    // Placement PRODUCTION : `placeCombatant` stampe la hauteur métrique `pos.h` (= 4 m, chemin de ronde z1).
    hero.pos = { x: 8, y: MOUTH_ROW, z: 1 };          // sur le chemin de ronde, au-dessus de la courtine
    placeCombatant(hero, scene, hero.pos);            // RAFRAÎCHIT pos.h depuis le relief (4 m) — comme en production
    const foot = { x: 8, y: MOUTH_ROW - 1, h: heightAt(scene, 8, MOUTH_ROW - 1, 0) }; // assaillant au pied du mur (z=0, 0 m)
    // Δhauteur 4 m ÷ 2 m/case = 2 cases de séparation verticale → distance 2 (mêlée refusée à travers le vide).
    expect(combatDistance(hero, { pos: foot } as never)).toBe(2);
    expect(lineOfSightCover(scene, hero.pos, { x: 8, y: 10 }, []).blocked).toBe(false); // pilonne le champ
  });

  it('la rencontre DÉCLARE le siège (`EncounterDef.siege`) — c’est ce qui ouvre les structures à l’IA', () => {
    const assaut = scenario.scene.encounters!.find((e) => e.id === 'assaut')!;
    expect(assaut.siege).toBe(true);
    // Copié TEL QUEL sur l'état de bataille au démarrage (aucune re-dérivation côté runtime).
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    expect(useGame.getState().battle!.siege).toBe(true);
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

  it('BATTERIE assaillante : le canon de siège BRÈCHE la porte tout seul (IA cible la structure)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const canonnier = b.combatants.find((c) => c.id === 'brg-canon')!; // brigand qui SERT le canon assaillant
    expect(canonnier.weapons.some((w) => w.type === 'ranged')).toBe(true); // pièce servie au spawn (poste de l'affût)
    // L'ARTILLERIE assaillante est un AFFÛT inerte rendu comme un ENGIN : espèce DÉRIVÉE de la ref (canon-petit),
    // servi par le brigand → neutralisé en tuant l'équipage, pas en frappant l'affût.
    const affutEnt = emplWithCrew('brg-canon'); // l'emplacement dont l'équipage est le brigand-canonnier
    const affut = b.combatants.find((c) => c.id === affutEnt.id)!;
    expect(affut.inert).toBe(true);
    expect(affut.bodyShape).toBe('engin');
    expect(affut.species).toBe('canon-petit'); // rig engin dérivé de la ref (plus d'appearance.species forcé)
    expect(b.order).not.toContain(affutEnt.id); // affût inerte → aucun tour propre
    expect(affutEnt.ref).toBe('canon-petit');
    expect(affutEnt.appearance).toBeUndefined(); // l'apparence d'engin se dérive de `ref`, rien n'est stocké
    const input = buildAiInput(canonnier, useGame.getState);
    expect(input.structures?.some((st) => st.creatureId === 'porte-de-ville')).toBe(true); // la porte est une cible
    const action = chooseEnemyAction(input);
    expect(action.kind).toBe('shoot');
    const tgt = b.combatants.find((c) => c.id === (action as { targetId: string }).targetId);
    expect(tgt && isStructure(tgt)).toBe(true); // … et c'est bien la STRUCTURE (porte) qui est visée
  });

  it('CONTRAT NÉGATIF : le MÊME canonnier, siège retiré → aucune structure en entrée, aucune décision de structure', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    // Seul le drapeau change : même scène, même roster, même canonnier servant la même pièce.
    useGame.setState({ battle: { ...useGame.getState().battle!, siege: undefined } });
    const b = useGame.getState().battle!;
    const canonnier = b.combatants.find((c) => c.id === 'brg-canon')!;
    expect(b.combatants.some(isStructure)).toBe(true); // les structures SONT là, elles ne sont plus offertes
    const input = buildAiInput(canonnier, useGame.getState);
    expect(input.structures ?? []).toEqual([]);
    const action = chooseEnemyAction(input) as { targetId?: string; thenTargetId?: string };
    const visee = b.combatants.find((c) => c.id === (action.targetId ?? action.thenTargetId));
    expect(visee ? isStructure(visee) : false).toBe(false);
  });

  it('AUCUN défaut DÉRIVÉ : un objectif « détruire la structure » sans `siege` ne rend PAS de structures', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const porte = useGame.getState().battle!.combatants.find(isStructure)!;
    useGame.setState({
      battle: {
        ...useGame.getState().battle!,
        siege: undefined,
        victoryCondition: { type: 'destroyStructure', edge: porte.structureEdge! },
      },
    });
    const b = useGame.getState().battle!;
    const canonnier = b.combatants.find((c) => c.id === 'brg-canon')!;
    expect(buildAiInput(canonnier, useGame.getState).structures ?? []).toEqual([]);
  });

  it('DÉFENSEURS : archers PNJ alliés-IA (agissent seuls) ; pièces INERTES servies (hors tour)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    // Archers défenseurs = héros pilotés par l'IA, armés d'un arc, sur le chemin de ronde (z1).
    const archers = b.combatants.filter((c) => c.aiControlled && c.kind === 'hero' && !c.inert && !c.mannedPoste);
    expect(archers.length).toBe(5); // 4 archers 'A' + 1 guetteur 'G'
    for (const archer of archers) {
      expect(archer.kind).toBe('hero');         // côté héros
      expect(archer.aiControlled).toBe(true);    // … mais piloté par l'IA (le joueur ne le micro-gère pas)
      expect(archer.weapons.some((w) => w.type === 'ranged')).toBe(true); // armé d'un arc
      expect(b.order).toContain(archer.id);      // … et l'archer allié-IA A un tour
      expect(archer.pos?.z).toBe(1);             // sur le chemin de ronde
    }
    // Pièce de rempart INERTE, servie par son équipage PNJ (alliée-IA).
    const balisteEnt = emplWithCrew('crew-baliste');
    const baliste = b.combatants.find((c) => c.id === balisteEnt.id)!;
    expect(baliste.inert).toBe(true);
    // RAW-pur (AA 10 l.136-193) : un engin de siège n'a AUCUNE Blessure → NON-destructible. Un coup ÉNORME (999)
    // inflige 0 (immune via le garde `target.inert`) — on le neutralise en tuant l'équipage, pas en le frappant.
    const coup: Weapon = { label: 'Canon', type: 'ranged', damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'siege' }] };
    expect(woundsFromHit(coup, baliste, 'corps', 999, 0, 1, undefined)).toBe(0);
    expect(b.order).not.toContain(balisteEnt.id); // affût inerte → aucun tour
    // La pièce est SERVIE d'office par son équipage PNJ (alliée-IA) qui TIRE la pièce (pas un arc).
    const crew = b.combatants.find((c) => c.id === 'crew-baliste')!;
    expect(crew.aiControlled).toBe(true);
    expect(crew.mannedPoste?.item.trappingId).toBe('baliste');
    expect(crew.weapons.find((w) => w.type === 'ranged')?.label).toMatch(/[Bb]aliste/); // SEULE arme à distance = la baliste
  });

  it('ÉQUIPAGE QUALIFIÉ : chaque servant a la Projectiles du Groupe de SA pièce → compte dans l’effectif (AA 10 l.230)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
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

  it('ROSTER « assaut » : servants alliés-IA au rempart, emplacements INERTES, brigands + gobelins ennemis', () => {
    const enc = scenario.scene.encounters.find((e) => e.id === 'assaut')!;
    const members = enc.members!;
    const by = (id: string) => members.find((m) => m.entityId === id);
    // Servants DÉRIVÉS de la donnée : `crew` du bind → `crewIds` du poste de l'affût (setPosteCrew).
    const crewOf = (e: SceneEntity) => (e.postes ?? []).flatMap((p) => p.crewIds ?? []);
    const crewAt = (z: number) => scenario.scene.entities.filter((e) => e.postes?.length && (e.z ?? 0) === z).flatMap(crewOf);
    // Servants de REMPART (affûts du chemin de ronde, z1) : alliés pilotés par l'IA.
    const crewRempart = crewAt(1);
    expect(crewRempart.length).toBeGreaterThan(0);
    for (const id of crewRempart) expect(by(id)).toEqual({ entityId: id, side: 'ally', ai: true });
    // Servants de la BATTERIE assaillante (z0) : ennemis (pas d'IA-flag → agissent comme ennemis normaux).
    const crewBatterie = crewAt(0);
    expect(crewBatterie.length).toBeGreaterThan(0);
    for (const id of crewBatterie) expect(by(id)).toEqual({ entityId: id, side: 'enemy' });
    // Emplacements (rempart alliés / batterie ennemis) : INERTES, enrôlés SANS `ai`.
    const empls = scenario.scene.entities.filter((e) => e.postes?.length);
    expect(empls.length).toBe(4);
    for (const e of empls) {
      const m = by(e.id)!;
      expect(m).toBeDefined();
      expect(m.ai).toBeUndefined(); // affût inerte : aucun tour propre
    }
    // Gobelins fantassins : 6 ennemis (marqueurs 'o').
    const gobs = scenario.scene.entities.filter((e) => e.ref === 'gobelin');
    expect(gobs.length).toBe(6);
    for (const g of gobs) expect(by(g.id)).toEqual({ entityId: g.id, side: 'enemy' });
  });

  /**
   * CHEMIN DE RENDU du chemin `bind: { emplacement }` — jusqu'à la DÉCISION de dessiner (#1567). Les
   * gardes du tour de garde parlaient juste (species/bodyShape sains) mais AUCUN jeton ne sortait :
   * depuis la cour (`activeZ` 0, le tour d'un héros), la garnison du chemin de ronde était coupée par
   * la loi d'étage — le sol de z1 coiffe la MASSE PLEINE du rempart (`capsSolid`), le monde le peint
   * d'en bas, mais le builder de jetons ne connaissait que le surplomb sur pilotis (`isOverhang`).
   * La sonde mesure la MÊME vue que l'écran : brouillard réel + `activeZ` du combattant actif.
   */
  it('RENDU : depuis la cour, la garnison du chemin de ronde (défenseurs ET pièces servies) sort en jetons', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    const b = st.battle!;
    const scene = st.scene!;
    const vl = computeStateVisibleAndLight({ scene, battle: b, party: st.party, partyPos: st.partyPos, gameTime: st.gameTime, lightLevel: st.lightLevel });
    const actif = b.combatants.find((c) => c.id === b.order[b.turn])!;
    const activeZ = actif.pos?.z ?? 0;
    expect(activeZ).toBe(0); // le combat s'ouvre au sol : c'est de là qu'on regarde le rempart
    const rendus = new Set(buildTokens(scene, vl.visible, b, { activeZ, viewZ: null, top: false }).map((t) => t.id));
    // Les 2 PIÈCES du rempart (emplacements posés par `bind: { emplacement }`) et leurs 2 servants.
    const piecesRempart = b.combatants.filter((c) => c.bodyShape === 'engin' && (c.pos?.z ?? 0) === 1);
    expect(piecesRempart.length).toBe(2);
    for (const p of piecesRempart) {
      expect(capsSolid(scene, p.pos!.x, p.pos!.y, 1)).toBe(true); // dessus de la masse, pas un surplomb
      expect(isOverhang(scene, p.pos!.x, p.pos!.y, 1)).toBe(false);
      expect(rendus.has(p.id)).toBe(true);
    }
    for (const id of ['crew-baliste', 'crew-canon']) expect(rendus.has(id)).toBe(true);
    // Contre-épreuve : la batterie ENNEMIE au fond du champ reste coupée par le BROUILLARD (loi
    // inchangée) — ce test mesure l'étage, pas la vue.
    for (const c of b.combatants.filter((x) => x.bodyShape === 'engin' && (x.pos?.z ?? 0) === 0)) expect(rendus.has(c.id)).toBe(false);
  });
});
