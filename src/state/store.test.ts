/**
 * Le store web (`useGame`) : ce qu'il ajoute au noyau — le clavier et le curseur de combat, la caméra et la vue,
 * l'inspection, et la remise à zéro d'une partie à l'autre sous ses gardes (`GARDES_D_UNE_PARTIE_A_L_AUTRE`). La boucle de
 * jeu elle-même se joue au banc du noyau (`src/noyau/boucle-de-jeu.hors-store.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { advanceTurn } from '../noyau/combatFlow';
import { GARDES_D_UNE_PARTIE_A_L_AUTRE, useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { createHero } from '../engine/character';
import { emptyScene } from '../noyau/monde/scene';
import { bus, EVT } from '../noyau/bus';
import { type Combatant, type Weapon } from '../engine/types';
import { CAP_GROUPE } from '../noyau/monde/combatants';
import { seedBattleRng } from '../noyau/battleRng';
import { campaignStart } from '../engine/clock';
// L'état de charge vit sur l'ARME (chaque arme à distance gère son
// rechargement et sa munition) — raccourci de FIXTURE vers l'arme à distance du combattant.
const rangedOf = (c: Combatant): Weapon => c.weapons.find((w) => w.type === 'distance')!;
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

function reset() {
  useGame.setState({
    screen: 'menu',
    party: [],
    scene: null,
    mode: 'exploration',
    partyPos: { x: 0, y: 0 },
    flags: {},
    journal: [],
    dialogue: null,
    battle: null,
    pendingTest: null,
    pendingAttack: null,
    pendingDefense: null,
    pendingDisengage: null,
    pendingCast: null,
    pendingHeal: null,
    pendingRoundStart: null,
    pendingFateSave: null,
    pendingReload: null,
    pendingCascade: null,
    pendingLoot: null,
    pendingAppraise: null,
    document: null,
    merchant: null,
    merchantStocks: {},
  });
}

describe('Chance — 3e usage : pré-emption d’initiative en début de Round (LDB 17 l.25)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function endOfRoundBattle(heroFortune: number) {
    const H = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
    H.fortune = heroFortune;
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0';
    E.label = 'Gobelin';
    E.kind = 'ennemi';
    E.fortune = 0;
    E.pos = { x: 5, y: 5 };
    const battle: BattleState = {
      combatants: [H, E], order: [E.id, H.id], turn: 1, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ screen: 'campaign', party: [H], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8) });
    return { H, E };
  }

  it('Tir rapide au CLAVIER : armer (roundStart.viser) → curseur (snapCursorToTarget) → Entrée (commitCursor) → tir', () => {
    const { H, E } = endOfRoundBattle(0);
    H.talents = [{ talentId: 'tir-rapide', times: 1 }];
    H.weapons = [{ label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 30, qualities: [] }] as never;
    rangedOf(H).loaded = true; H.pos = { x: 0, y: 0 };
    E.pos = { x: 2, y: 0 }; // à portée + LdV (scène vide)
    advanceTurn(useGame.getState, useGame.setState); // → Round 2, pendingRoundStart
    seedBattleRng(1);
    // Touche T : arme la visée du tireur (source unique preemptShooterIds → roundStart.viser).
    useGame.getState().fenetreChoisir('debutDuRound', 'viser', H.id);
    expect(useGame.getState().preemptAiming).toBe(H.id);
    // Tab/flèches : le curseur trouve la cible valide du TIREUR (aucun actif à turn:-1 — cursorActor renvoie le tireur).
    useGame.getState().snapCursorToTarget(1);
    expect(useGame.getState().combatCursor?.snappedId).toBe(E.id);
    // Entrée (commitCursor) : tire l'interruption via cliquerLaCase (armé) → declencherLeTirPreventif.
    useGame.getState().commitCursor();
    const st = useGame.getState();
    expect(st.pendingAttack?.interrupt).toBe(true);    // modale de tir ouverte pour le tireur
    expect(st.pendingAttack?.attackerId).toBe(H.id);
    expect(st.preemptAiming).toBeNull();               // désarmé au tir
    expect(st.combatCursor).toBeNull();                // curseur retiré
  });
});

describe('camRot (rotation caméra — état de vue)', () => {
  it('défaut de création : vue de COIN (losange, camEdge false)', () => {
    const init = (useGame as unknown as { getInitialState: () => { camEdge: boolean; camRot: number } }).getInitialState();
    expect(init.camEdge).toBe(false);
    expect(init.camRot).toBe(0);
  });

  it('tourne par crans de 90° (les quatre vues DIAGONALES) et boucle sur un tour complet', () => {
    useGame.setState({ camRot: 0, camEdge: false }); // état par DÉFAUT : vue de coin
    // +1 : le cran suivant, toujours en vue de coin (la vue de face n'est plus sur le chemin du joueur).
    useGame.getState().rotateCam(1);
    expect(useGame.getState().camRot).toBe(1);
    expect(useGame.getState().camEdge).toBe(false);
    // 4 crans (90°) = tour complet → retour à l'état initial (coin, camRot 0).
    for (let i = 0; i < 3; i++) useGame.getState().rotateCam(1);
    expect(useGame.getState().camRot).toBe(0);
    expect(useGame.getState().camEdge).toBe(false);
    // Anti-horaire : un cran depuis (0, coin) décrémente camRot (0→3), toujours en coin.
    useGame.getState().rotateCam(-1);
    expect(useGame.getState().camRot).toBe(3);
    expect(useGame.getState().camEdge).toBe(false);
    useGame.getState().rotateCam(-1);
    expect(useGame.getState().camRot).toBe(2);
    expect(useGame.getState().camEdge).toBe(false);
  });
});

describe('stepPartyDir — pas clavier BLOQUÉ (#792) : silence remplacé par MOVE_BLOCKED, aucun déplacement fantôme', () => {
  beforeEach(() => reset());

  it("mur droit devant : le pas n'a pas bougé le groupe ET a émis MOVE_BLOCKED (pas de rabattement latéral silencieux)", () => {
    const scene = emptyScene('scene-test', 8, 8);
    scene.id = 'stepdir-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 4, y: 4 } });
    const idx = (x: number, y: number) => y * 8 + x;
    scene.layers[0].tiles[idx(3, 3)] = 'mur'; // voisin idéal de 'up' depuis (4,4), en losange par défaut
    useGame.getState().lancerLaScene(scene);
    useGame.setState({ partyPos: { x: 4, y: 4 }, camRot: 0, camEdge: false, viewMode: undefined });

    let blocked = 0;
    const off = bus.on(EVT.MOVE_BLOCKED, () => { blocked += 1; });
    useGame.getState().stepPartyDir('haut');
    off();

    expect(useGame.getState().partyPos).toEqual({ x: 4, y: 4 }); // aucun déplacement fantôme
    expect(blocked).toBe(1);
  });
});

describe('Nouvelle partie / scénario — reset complet de l’état (anti-dérive, zéro-maintenance)', () => {
  beforeEach(() => reset());

  // Champs DÉLIBÉRÉMENT conservés (navigation/vue/groupe) ou dérivés de la scène de départ.
  // Tout le RESTE doit revenir à son défaut de création, automatiquement, sans liste à maintenir.
  const PRESERVED_OR_DERIVED = new Set([
    'screen', 'party', ...GARDES_D_UNE_PARTIE_A_L_AUTRE,           // navigation / groupe / préférences de vue et de touches
    'scene', 'partyPos', 'flags', 'campaignSceneId', 'journal', 'mode', 'inventory', // dérivés
    'facing', // dérivé : orientation du meneur posée à l'entrée de scène (spawnFacing / heroStart)
    'explored', // dérivé : la vue d'arrivée, fondue par la transition du jeu (`noyau/transitionDuJeu.ts`)
  ]);

  it('lancerLaScene réinitialise TOUT champ d’état à son défaut de création (garde-fou anti-dérive)', () => {
    // 1) Salir un maximum de champs — simule une partie précédente abandonnée en plein combat.
    useGame.setState({
      gameTime: campaignStart() + 99_999,
      facing: { fantome: 4 } as any,
      previousScene: { id: 'vieux', pos: { x: 9, y: 9 } },
      document: { title: 'x', text: 'y', remise: 1 },
      dialogue: { dialogue: { id: 'd', start: { id: 'n' }, nodes: [{ id: 'n', text: '', choices: [] }] }, nodeId: 'n' } as any,
      pendingFateSave: { heroId: 'mort', source: 'slow' } as any,
      pendingCast: { x: 1 } as any,
      pendingRoundStart: { round: 7 },
      flags: { vieuxFlag: true },
      journal: ['vieille ligne'],
      explored: { vieux: ['0,0,0'] },
    });

    // 2) Démarrage d’une nouvelle partie/scénario.
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'neuve';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    useGame.getState().fixerLeGroupe([combattantDeTest({ id: 'h', label: 'H', xp: 0 })]);
    useGame.getState().lancerLaScene(scene);

    // 3) Garde-fou générique : tout champ DATA non préservé/dérivé == son défaut de création.
    //    Itère sur l’état de création (Zustand) → couvre AUTOMATIQUEMENT tout futur champ ajouté.
    const init = (useGame as unknown as { getInitialState: () => Record<string, unknown> }).getInitialState();
    const st = useGame.getState() as unknown as Record<string, unknown>;
    //    `worldMap.id` est l'horodatage de sa création (`emptyWorldMap`, `src/noyau/worldMap.ts:220`) :
    //    une partie neuve crée la sienne, l'id seul diffère.
    const sansHorodatage = (k: string, x: unknown) => (k === 'worldMap' ? { ...(x as object), id: 'carte' } : x);
    for (const [k, v] of Object.entries(init)) {
      if (typeof v === 'function' || PRESERVED_OR_DERIVED.has(k)) continue;
      expect({ [k]: sansHorodatage(k, st[k]) }).toEqual({ [k]: sansHorodatage(k, v) }); // échec lisible : nomme le champ qui a fui
    }

    // 4) Points névralgiques explicites (les 5 suspensions de combat + horloge + orientation + retour).
    expect(st.gameTime).toBe(campaignStart());
    // Le fantôme de l'ancienne partie est purgé ; SEUL le cap du GROUPE est ré-orienté vers le
    // contenu (heroStart (0,0) sur une 6×6 → centroïde (2.5,2.5) = SE).
    expect(st.facing).toEqual({ [CAP_GROUPE]: 'SE' });
    expect(st.previousScene).toBeNull();
    expect(st.pendingFateSave).toBeNull();
    expect(st.pendingCast).toBeNull();
    expect(st.pendingRoundStart).toBeNull();
    // Préservés / dérivés bien appliqués :
    expect((st.party as unknown[])).toHaveLength(1);
    expect((st.scene as { id: string }).id).toBe('neuve');
    expect(st.flags).toEqual({}); // flags de l’ancienne partie effacés
    expect(Object.keys(st.explored as object), 'l’exploré de l’ancienne partie est effacé : seule la scène d’arrivée y est').toEqual(['neuve']);
  });

  it('l’inspection est un GESTE, pas une préférence (#1822) : aucun interrupteur à l’état, et la fiche ouverte ne survit pas à une nouvelle partie', () => {
    const init = (useGame as unknown as { getInitialState: () => Record<string, unknown> }).getInitialState();
    expect(init, 'aucun interrupteur d’inspection').not.toHaveProperty('inspectEnabled');
    expect(init, 'aucune bascule d’inspection').not.toHaveProperty('toggleInspectEnabled');
    expect(init, 'la fiche ouverte reste un état de l’écran').toHaveProperty('inspectId', null);
    useGame.getState().setInspectId('h');
    expect(useGame.getState().inspectId).toBe('h');
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'neuve2';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    useGame.getState().fixerLeGroupe([combattantDeTest({ id: 'h', label: 'H', xp: 0 })]);
    useGame.getState().lancerLaScene(scene);
    expect(useGame.getState().inspectId).toBeNull();
  });
});

describe('viewMode (vue du dessus)', () => {
  beforeEach(() => reset());

  it('toggleViewMode bascule iso ⇄ top', () => {
    useGame.setState({ viewMode: 'iso' });
    useGame.getState().toggleViewMode();
    expect(useGame.getState().viewMode).toBe('top');
    useGame.getState().toggleViewMode();
    expect(useGame.getState().viewMode).toBe('iso');
  });

  it('lancerLaScene PRÉSERVE viewMode (préférence de vue, comme zoom/camRot)', () => {
    useGame.setState({ viewMode: 'top' });
    useGame.getState().lancerLaScene(emptyScene('scene-test'));
    expect(useGame.getState().viewMode).toBe('top');
  });
});

