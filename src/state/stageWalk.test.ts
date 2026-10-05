/**
 * MARCHE TENUE (loi du module `stageWalk`, mesurée sur le STORE RÉEL) : tenir une direction enchaîne
 * les pas AU RYTHME DU GLISSEMENT — un pas à la fois, chaque case est une arrivée, relâcher termine le
 * pas en cours et rien de plus, et une porte qui s'ouvre arrête la marche sur la case atteinte.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { parseProject } from './worldMap';
import { bus, EVT } from './bus';
import { emptyScene } from './scene';
import { flowFromEffects } from './flow';
import { resetStageGestes } from './stageGestes';
import { STEP_MS } from '../geometry/walk';
import { demarrerMarche, arreterMarche, resetStageWalk, marcheEnVol } from './stageWalk';
import { chebyshev } from '../engine/grid';
import { pushLayer, resetDismissStack } from './dismissStack';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { cascadeDeTest } from './cascadeTestKit';

const get = useGame.getState;

/** Couloir marchable 10×10, groupe au centre, vue iso au cran d'ouverture. */
function poserScene(): void {
  const sc = emptyScene(10, 10);
  sc.id = 'marche-tenue';
  sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 5, y: 5 } });
  get().startScene(sc);
  useGame.setState({
    screen: 'campaign', mode: 'exploration', partyPos: { x: 5, y: 5 },
    camRot: 0, camEdge: false, viewMode: undefined, povActive: false,
    dialogue: null, gameMenuOpen: false, merchant: null, worldMapOpen: false,
    pendingCascade: null, pendingLoot: null, battle: null,
  } as never);
}

/** Trace des cases COMMISES (`partyPos` après chaque pas) — une entrée par arrivée. */
function traceur(): { cases: { x: number; y: number }[]; off: () => void } {
  const cases: { x: number; y: number }[] = [];
  const off = useGame.subscribe((s, prev) => {
    if (s.partyPos !== prev.partyPos) cases.push({ x: s.partyPos.x, y: s.partyPos.y });
  });
  return { cases, off };
}

beforeEach(() => {
  vi.useFakeTimers();
  resetStageWalk();
  resetDismissStack();
  poserScene();
});

afterEach(() => {
  resetStageWalk();
  resetDismissStack();
  vi.useRealTimers();
});

describe('UN PAS À LA FOIS — la cadence est la durée du glissement', () => {
  it('armer cent fois la même direction avant la fin du glissement ne commet QU’UN pas', () => {
    const t = traceur();
    for (let i = 0; i < 100; i++) demarrerMarche(get, { vue: 'iso', dir: 'up' });
    t.off();
    expect(t.cases.length, 'le ré-armement doit être inerte tant que le pas est en vol').toBe(1);
    expect(marcheEnVol()).toBe(true);
  });

  it('maintenir trois glissements commet EXACTEMENT trois cases adjacentes, une par STEP_MS', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    expect(t.cases.length, 'le premier pas part à l’enfoncement, sans attendre').toBe(1);
    vi.advanceTimersByTime(STEP_MS - 1);
    expect(t.cases.length, 'aucun pas ne se commet PENDANT un glissement').toBe(1);
    vi.advanceTimersByTime(1);
    expect(t.cases.length).toBe(2);
    vi.advanceTimersByTime(STEP_MS);
    expect(t.cases.length).toBe(3);
    arreterMarche({ vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS * 5);
    t.off();
    expect(t.cases.length, 'relâché : le pas en vol arrive, et rien ne s’enchaîne').toBe(3);
    // Cases ADJACENTES (aucun saut) et entières (aucune fraction de case).
    for (let i = 1; i < t.cases.length; i++) {
      const d = chebyshev(t.cases[i], t.cases[i - 1]);
      expect(d, `saut entre la case ${i - 1} et la case ${i}`).toBe(1);
    }
    const fin = get().partyPos;
    expect(Number.isInteger(fin.x) && Number.isInteger(fin.y), 'arrêt sur une case entière').toBe(true);
    expect(t.cases[t.cases.length - 1]).toEqual({ x: fin.x, y: fin.y });
  });

  it('relâcher PENDANT un glissement laisse le pas arriver, sans pas supplémentaire', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(Math.floor(STEP_MS / 2));
    arreterMarche({ vue: 'iso', dir: 'up' });
    const arrivee = { ...get().partyPos };
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(1);
    expect(get().partyPos).toEqual(arrivee);
    expect(marcheEnVol()).toBe(false);
  });

  it('changer de direction pendant le glissement : le pas SUIVANT prend la nouvelle', () => {
    const depart = { ...get().partyPos };
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    const apres1 = { ...get().partyPos };
    demarrerMarche(get, { vue: 'iso', dir: 'right' });
    expect(get().partyPos, 'ré-armer ne commet rien tout de suite').toEqual(apres1);
    vi.advanceTimersByTime(STEP_MS);
    const apres2 = { ...get().partyPos };
    const d1 = { x: apres1.x - depart.x, y: apres1.y - depart.y };
    const d2 = { x: apres2.x - apres1.x, y: apres2.y - apres1.y };
    expect(d2, 'le 2ᵉ pas doit suivre la direction ré-armée').not.toEqual(d1);
  });

  it('PILE des directions tenues : W tenu + D pressé → D ; D relâché → RETOUR à W ; W relâché → arrêt', () => {
    const pas = (): { x: number; y: number } => {
      const avant = { ...get().partyPos };
      vi.advanceTimersByTime(STEP_MS);
      const apres = get().partyPos;
      return { x: apres.x - avant.x, y: apres.y - avant.y };
    };
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    const versW = pas();
    demarrerMarche(get, { vue: 'iso', dir: 'right' }); // W reste enfoncée SOUS D
    const versD = pas();
    expect(versD, 'la direction pressée en dernier gagne').not.toEqual(versW);
    arreterMarche({ vue: 'iso', dir: 'right' }); // D relâchée, W toujours tenue
    expect(pas(), 'lâcher D doit rendre la marche à W, encore enfoncée').toEqual(versW);
    arreterMarche({ vue: 'iso', dir: 'up' });
    const arret = { ...get().partyPos };
    vi.advanceTimersByTime(STEP_MS * 4);
    expect(get().partyPos, 'plus rien de tenu : arrêt sur la case').toEqual(arret);
  });

  it('relâcher puis re-presser aussitôt ne commet AUCUN pas hors cadence', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(Math.floor(STEP_MS / 2));
    arreterMarche({ vue: 'iso', dir: 'up' });
    demarrerMarche(get, { vue: 'iso', dir: 'up' }); // re-pressé EN PLEIN glissement
    expect(t.cases.length, 'deux cases en moins d’un glissement').toBe(1);
    vi.advanceTimersByTime(Math.ceil(STEP_MS / 2));
    t.off();
    expect(t.cases.length, 'le pas suivant tombe à la fin du glissement, pas avant').toBe(2);
  });

  it('`resetStageWalk` annule le glissement EN VOL (aucun pas orphelin du timer précédent)', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    resetStageWalk();
    demarrerMarche(get, { vue: 'iso', dir: 'up' }); // repart d'un glissement NEUF
    expect(t.cases.length).toBe(2);
    vi.advanceTimersByTime(STEP_MS);
    t.off();
    expect(t.cases.length, 'le timer de la marche remise à zéro a commis un pas de plus').toBe(3);
  });

  it('relâcher une AUTRE direction que celle tenue ne coupe pas la marche', () => {
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    arreterMarche({ vue: 'iso', dir: 'down' });
    const avant = { ...get().partyPos };
    vi.advanceTimersByTime(STEP_MS);
    expect(get().partyPos, 'la direction encore tenue doit continuer').not.toEqual(avant);
  });
});

/**
 * RECETTE CDP du 2026-08-19, anomalie (A) : maintien de W depuis (25,23) sur `arene-hub` — 4 pas puis
 * plus rien. La cause n'est ni une porte ni un timer : la case visée au 5ᵉ pas (20,18) porte le prop
 * `puits` (entité `p0` du projet), donc `exploreStepDest` rend `null`. C'est un MUR, et le mur se joue
 * ici sur la scène RÉELLE pour que la lecture de cette trace ne se refasse jamais.
 */
describe('MUR de la scène réelle (arene-hub) — la marche bute, elle ne meurt pas', () => {
  const doc = parseProject(lireProjetLivre('arene/arene-projet.json'));

  function entrerAuHub(): void {
    useGame.getState().loadProject(doc.scenes, 'arene-hub', doc.worldMap, doc.narratif);
    useGame.setState({
      screen: 'campaign', mode: 'exploration', partyPos: { x: 25, y: 23 },
      camRot: 0, camEdge: false, viewMode: undefined, povActive: false,
      pendingCascade: null, pendingLogQueue: [], dialogue: null, merchant: null, worldMapOpen: false,
    } as never);
  }

  it('maintien de W : quatre cases jusqu’au puits, puis blocage RÉPÉTÉ (aucun pas fantôme, aucune marche morte)', () => {
    entrerAuHub();
    let blocages = 0;
    const off = bus.on(EVT.MOVE_BLOCKED, () => { blocages += 1; });
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(2000);
    t.off();
    off();
    expect(t.cases, 'le chemin commis avant le puits').toEqual([{ x: 24, y: 22 }, { x: 23, y: 21 }, { x: 22, y: 20 }, { x: 21, y: 19 }]);
    expect(get().partyPos, 'aucun pas fantôme dans le puits (20,18)').toEqual({ x: 21, y: 19 });
    expect(blocages, 'le mur doit se signaler à chaque tentative (le heurt AUDIO, lui, ne sonne qu’une fois)').toBeGreaterThan(1);
  });

  it('bloqué contre le puits, CHANGER de direction repart immédiatement (sans relâcher)', () => {
    entrerAuHub();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(1000); // contre le puits depuis un moment
    expect(get().partyPos).toEqual({ x: 21, y: 19 });
    demarrerMarche(get, { vue: 'iso', dir: 'right' }); // 2ᵉ touche pressée, la 1ᵉʳᵉ reste tenue
    vi.advanceTimersByTime(STEP_MS);
    expect(get().partyPos, 'une direction bloquée ne doit pas condamner les autres').not.toEqual({ x: 21, y: 19 });
  });
});

describe('FRONTIÈRE DE SCÈNE — une marche tenue ne traverse pas la transition', () => {
  /** Scène de départ : un trigger sur la case atteinte au 1ᵉʳ pas transitionne vers `dest`. */
  function scenePiegee(id: string, dest: string) {
    const sc = emptyScene(10, 10);
    sc.id = id;
    sc.label = id;
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 5, y: 5 } });
    sc.triggers.push({ id: 'porte', rect: { x: 4, y: 4, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'transition', scene: dest }]) });
    return sc;
  }

  function sceneArrivee(id: string) {
    const sc = emptyScene(10, 10);
    sc.id = id;
    sc.label = id;
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 8, y: 8 } });
    return sc;
  }

  it('trigger de transition traversé touche TENUE : aucun pas AVEUGLE dans la scène d’arrivée', () => {
    useGame.getState().loadProject([scenePiegee('walk-a', 'walk-b'), sceneArrivee('walk-b')], 'walk-a');
    useGame.setState({ screen: 'campaign', mode: 'exploration', partyPos: { x: 5, y: 5 }, camRot: 0, camEdge: false, viewMode: undefined, povActive: false } as never);
    demarrerMarche(get, { vue: 'iso', dir: 'up' }); // 1ᵉʳ pas → (4,4) → trigger → scène B
    expect(useGame.getState().scene?.id, 'la transition doit avoir eu lieu').toBe('walk-b');
    const arrivee = { ...useGame.getState().partyPos };
    vi.advanceTimersByTime(500); // 3 glissements de large
    expect(useGame.getState().partyPos, 'la touche encore enfoncée a marché dans la scène d’arrivée').toEqual(arrivee);
    expect(useGame.getState().scene?.id).toBe('walk-b');
  });

  it('la frontière remet les gestes vivants à zéro par UNE couture (`resetStageGestes`)', () => {
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    expect(marcheEnVol()).toBe(true);
    resetStageGestes();
    expect(marcheEnVol(), 'la marche survit à la remise à zéro des gestes de frontière').toBe(false);
  });
});

describe('UNE PORTE QUI S’OUVRE arrête la marche sur la case atteinte', () => {
  it('un dialogue ouvert à la 2ᵉ case : pas de 3ᵉ case', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS); // 2ᵉ case
    expect(t.cases.length).toBe(2);
    useGame.setState({ dialogue: { dialogue: { id: 'd', start: 'n', nodes: [] }, nodeId: 'n' } } as never);
    const arret = { ...get().partyPos };
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length, 'la marche a sauté par-dessus la porte ouverte').toBe(2);
    expect(get().partyPos).toEqual(arret);
  });

  it('une modale du registre (cascade) ouverte à la 2ᵉ case : pas de 3ᵉ case', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    useGame.setState({ pendingCascade: cascadeDeTest([{ id: 'r', kind: 'affichage', actorId: 'h1' }]) });
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(2);
  });

  it('une fenêtre HORS-modale (butin) ouverte à la 2ᵉ case : pas de 3ᵉ case', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    useGame.setState({ pendingLoot: { title: 'x', gear: [] } } as never);
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(2);
  });

  it('une COMMANDE d’interlude en souffrance (`pendingOrders`) n’est pas une porte : la marche continue', () => {
    // Livrée à l'interlude SUIVANT (`interludeFlow`), la liste persiste toute l'aventure : aucune
    // fenêtre ne la montre, et le registre la déclare `tientLaMain: false`.
    useGame.setState({ pendingOrders: [{ heroId: 'h1', trappingId: 'corde' }] });
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS * 2);
    t.off();
    expect(t.cases.length).toBe(3);
  });

  it('une DÉSIGNATION de cibles (sort délégué à la carte) à la 2ᵉ case : pas de 3ᵉ case', () => {
    // La modale a cédé son geste à la carte (`pendingCast.pickingTargets`) : plus de fenêtre élue,
    // mais la situation TIENT la main (`MODAL_DEFS.tientLaMain`).
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    useGame.setState({ pendingCascade: cascadeDeTest([{ id: 'c', kind: 'castJet', jet: 'cast' }]), pendingCast: { pickingTargets: true } as never });
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(2);
  });

  it('un écran PAR SIÈGE (couche posée sur la pile de ce client) à la 2ᵉ case : pas de 3ᵉ case', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    pushLayer({ kind: 'fiche-perso', nature: 'modale', plan: 'application', onDismiss: () => {} });
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(2);
  });

  it('un POPOVER (infobulle du codex) posé à la 2ᵉ case : la 3ᵉ case est parcourue', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    pushLayer({ kind: 'infobulle', nature: 'popover', plan: 'application', onDismiss: () => {} });
    vi.advanceTimersByTime(STEP_MS);
    t.off();
    expect(t.cases.length).toBe(3);
  });

  it('un ÉCRAN plein-champ ouvert à la 2ᵉ case : pas de 3ᵉ case', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    useGame.setState({ screen: 'menu' } as never);
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(2);
  });

  it('la direction coupée par une porte exige un NOUVEAU front (même loi clavier et manette)', () => {
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    useGame.setState({ pendingLoot: { title: 'x', gear: [] } } as never);
    vi.advanceTimersByTime(STEP_MS * 2);
    useGame.setState({ pendingLoot: null } as never); // la fenêtre se referme, la direction est TOUJOURS poussée
    const arret = { ...get().partyPos };
    demarrerMarche(get, { vue: 'iso', dir: 'up' }); // répétition de la manette : pas un front
    vi.advanceTimersByTime(STEP_MS * 3);
    expect(get().partyPos, 'la marche est repartie seule sans nouvelle pression').toEqual(arret);
    arreterMarche({ vue: 'iso', dir: 'up' }); // relâchement = le front qui rouvre
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    expect(get().partyPos, 'après un vrai front, la marche doit repartir').not.toEqual(arret);
  });

  it('un combat ouvert à la 2ᵉ case : pas de 3ᵉ case', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    vi.advanceTimersByTime(STEP_MS);
    useGame.setState({ mode: 'battle' } as never);
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(2);
  });

  it('la BASCULE de vue coupe le maintien armé par l’autre vue (aucune marche fantôme)', () => {
    const t = traceur();
    demarrerMarche(get, { vue: 'iso', dir: 'up' });
    useGame.setState({ povActive: true } as never);
    vi.advanceTimersByTime(STEP_MS * 4);
    t.off();
    expect(t.cases.length).toBe(1);
  });
});
