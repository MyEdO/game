/**
 * CONTEXTE des raccourcis pendant un CIBLAGE PAR LA CARTE (désignation des cibles d'un sort) : la
 * souris cible, donc le curseur clavier/manette doit cibler aussi. Le registre distingue deux
 * gardes : la CARTE (verdict de l'arbitre `modalBlocksMapHover` — une modale pilotée par la carte
 * laisse la scène vivante) et le PILOTAGE hors-carte (fin de tour, barre d'action, menu système),
 * qui exige qu'aucune modale ne soit ouverte. Sans cette distinction, `pickActiveModalKey != null`
 * rendait TOUT le clavier muet pendant que la souris continuait de cibler.
 */
import { describe, it, expect, vi } from 'vitest';
import { KEYBINDINGS, bindingParId, formatCombo, modsDeLaTouche, modsMatch, type KeyBinding } from './keybindings';
import { modalHolds, pickActiveModalKey } from './modalArbiter';
import type { GameState } from './store';
import { spawnEnemy } from './spawn';
import { cascadeDeTest } from './cascadeTestKit';

const binding = (id: string) => bindingParId(id)!;

/** État minimal : combat en cours, écran de jeu, aucun pending — les cas posent le leur. */
const fake = (over: Partial<GameState> = {}): GameState =>
  ({
    mode: 'battle', screen: 'campaign', gameMenuOpen: false,
    battle: { over: null, order: [], turn: 0, combatants: [] },
    net: { mode: 'local', mySeat: 0, gmSeat: null, ownership: {} },
    ...over,
  }) as never;

/** Cascade d'incantation dont l'étape courante DÉSIGNE ses cibles sur la carte (`pickingTargets`). */
const cartePilote = (over: Partial<GameState> = {}) =>
  fake({
    // Étape `jet:'cast'` RÉELLE : c'est elle que l'arbitre EFFACE pendant la désignation (entrée
    // `cascade`, `modalArbiter`). Une étape sans `jet` ne mesurerait pas la garde — l'arbitre élirait
    // la cascade et toutes les portes seraient fermées pour une autre raison.
    pendingCascade: cascadeDeTest([{ actorId: 'h1', id: 'c', kind: 'castJet', jet: 'cast' }]),
    pendingCast: { casterId: 'h1', pickingTargets: true } as never,
    ...over,
  });

/** Cascade ORDINAIRE (révélation) : elle bloque la carte — clavier ET souris se taisent. */
const cascadeBloquante = (over: Partial<GameState> = {}) =>
  fake({ pendingCascade: cascadeDeTest([{ id: 'r', kind: 'affichage', actorId: 'h1' }]), ...over });

const CURSEUR = ['cursor-up', 'cursor-down', 'cursor-left', 'cursor-right'];

describe('raccourcis — le CURSEUR vit tant que la carte cible', () => {
  it('hors modale : le curseur répond (référence)', () => {
    for (const id of CURSEUR) expect(binding(id).when(fake()), id).toBe(true);
  });

  it('ciblage de sort PAR LA CARTE : le curseur clavier/manette RESTE vivant, comme la souris', () => {
    for (const id of CURSEUR) expect(binding(id).when(cartePilote()), id).toBe(true);
  });

  it('ciblage de sort PAR LA CARTE : Entrée commet le ciblage sous le curseur', () => {
    expect(binding('cursor-commit').when(cartePilote({ combatCursor: { tile: { x: 1, y: 1 } } as never }))).toBe(true);
  });

  it('cascade ORDINAIRE (carte inerte) : le curseur est MORT', () => {
    for (const id of CURSEUR) expect(binding(id).when(cascadeBloquante()), id).toBe(false);
    expect(binding('cursor-commit').when(cascadeBloquante({ combatCursor: { tile: { x: 1, y: 1 } } as never }))).toBe(false);
  });
});

describe('raccourcis — les gestes qui ENGAGENT ou QUITTENT restent gardés par la modale', () => {
  it('pendant le ciblage par la carte : ni fin de tour, ni barre d’action, ni menu système', () => {
    const s = cartePilote();
    // La fenêtre s'EFFACE (la carte prend la main) mais une modale TIENT toujours la main : les deux
    // verdicts sont distincts (#1852), et ce sont les gestes hors-carte qui suivent le second.
    expect(pickActiveModalKey(s as never), 'aucune fenêtre élue pendant la désignation').toBeNull();
    expect(modalHolds(s as never), 'une situation modale tient pourtant la main').toBe(true);
    expect(binding('end-turn').when(s), 'Espace finirait le tour au milieu d’une désignation de cibles').toBe(false);
    expect(binding('hotbar-1').when(s), 'une capacité de la barre ouvrirait un 2ᵉ flux par-dessus le sort').toBe(false);
    expect(binding('toggle-menu').when(s), 'Échap doit annuler le ciblage, pas ouvrir le menu système').toBe(false);
  });

  it('hors modale, ces mêmes gestes répondent (la garde n’est pas devenue muette)', () => {
    const s = fake();
    expect(binding('end-turn').when(s)).toBe(true);
    expect(binding('hotbar-1').when(s)).toBe(true);
    expect(binding('toggle-menu').when(s)).toBe(true);
  });
});

/**
 * COLLISIONS DE TOUCHES sur le registre ENTIER. Deux raccourcis peuvent légitimement partager un
 * `code` quand leurs `when` s'excluent (POV ⇄ vue iso, pause de Round ⇄ fin de tour ⇄ curseur, les
 * trois portes d'Échap) — mais le partage doit alors être DÉCLARÉ des deux côtés (`sharedBy`). Sans
 * cette garde, ajouter un raccourci sur une touche déjà prise est silencieux : l'ordre du tableau
 * décide, et le nouveau geste n'agit jamais (ou vole celui d'un autre).
 */
describe('raccourcis — aucune collision de touche NON DÉCLARÉE', () => {
  it('un id, un raccourci : les ids du registre sont UNIQUES (`bindingParId` rend le premier)', () => {
    const vus = new Set<string>();
    const doublons = KEYBINDINGS.map((b) => b.id).filter((id) => (vus.has(id) ? true : (vus.add(id), false)));
    expect(doublons).toEqual([]);
  });

  /** La TOUCHE d'un raccourci, c'est son code ET ses modificateurs : `Ctrl+KeyZ` ≠ `KeyZ`. */
  const touches = (b: KeyBinding) => b.codes.map((c) => formatCombo(c, b.mods ?? []));

  it('toute paire d’entrées partageant une touche (code ET modificateurs) se nomme mutuellement dans `sharedBy`', () => {
    const parCode = new Map<string, string[]>();
    for (const b of KEYBINDINGS) for (const c of touches(b)) parCode.set(c, [...(parCode.get(c) ?? []), b.id]);
    const fautes: string[] = [];
    for (const [code, ids] of parCode) {
      for (const a of ids) for (const b of ids) {
        if (a === b) continue;
        if (!bindingParId(a)?.sharedBy?.includes(b)) fautes.push(`${code} : « ${a} » ne déclare pas partager avec « ${b} »`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('`Ctrl+KeyZ` et `KeyZ` ne sont PAS une collision : les modificateurs FONT partie de la touche', () => {
    const annuler = bindingParId('editeur-annuler')!;
    expect(touches(annuler)).toEqual(['ctrl+KeyZ']);
    expect(touches({ ...annuler, mods: undefined })).toEqual(['KeyZ']);
    expect(annuler.sharedBy ?? [], '« Ctrl+Z » n’a rien à partager').toEqual([]);
  });

  it('`sharedBy` ne nomme que des ids EXISTANTS qui partagent réellement une touche (pas une déclaration morte)', () => {
    const fautes: string[] = [];
    for (const b of KEYBINDINGS) {
      for (const other of b.sharedBy ?? []) {
        const o = bindingParId(other);
        if (!o) { fautes.push(`« ${b.id} » nomme « ${other} », absent du registre`); continue; }
        if (!touches(o).some((c) => touches(b).includes(c))) fautes.push(`« ${b.id} » et « ${other} » ne partagent aucune touche`);
      }
    }
    expect(fautes).toEqual([]);
  });
});

/**
 * LA CAMÉRA SE PILOTE AU CLAVIER (et au geste) : l'écran de jeu ne porte aucune plaque de boutons
 * de caméra (spec `docs/plans/2026-08-16-spec-hud-combat.md`, zone 6). Bascule de vue, inspection et
 * recentrage sont donc des raccourcis du registre, et le recentrage remet AUSSI le zoom (la molette
 * avance par incréments continus : aucune suite de crans ne retombe sur 1, et aucun afficheur de zoom
 * n'existe à l'écran).
 */
describe('raccourcis — la caméra se pilote au clavier : bascule de vue, inspection, recentrage', () => {
  it('V bascule la vue sur l’écran de jeu, et se TAIT en vue subjective (le POV a sa propre bascule)', () => {
    const b = binding('toggle-view');
    expect(b.codes).toEqual(['KeyV']);
    expect(b.when(fake({ mode: 'exploration' }))).toBe(true);
    expect(b.when(fake())).toBe(true); // en combat aussi : la vue du dessus est tactique
    expect(b.when(fake({ povActive: true }))).toBe(false);
    expect(b.when(fake({ screen: 'party' }))).toBe(false);
    const toggleViewMode = vi.fn();
    b.run(() => ({ toggleViewMode }) as never);
    expect(toggleViewMode).toHaveBeenCalledOnce();
  });

  it('I INSPECTE ce que le joueur désigne (#1822) — jamais une bascule de mode', () => {
    const b = binding('inspecter');
    expect(b.codes).toEqual(['KeyI']);
    const run = (s: GameState) => { const setInspectId = vi.fn(); b.run(() => ({ ...s, setInspectId }) as never); return setInspectId; };
    // Combat : la case du CURSEUR prime, puis le portrait survolé, puis le jeton survolé.
    const surCase = { combatCursor: { tile: { x: 2, y: 3 } }, battle: { over: null, order: [], turn: 0, combatants: [spawnEnemy({ ref: 'brigand' }, 'e1', { x: 2, y: 3 })] } } as unknown as Partial<GameState>;
    expect(run(fake({ ...surCase, hoverCombatantId: 'h2', hovered: 'h3' }))).toHaveBeenCalledWith('e1');
    expect(run(fake({ hoverCombatantId: 'h2', hovered: 'h3' }))).toHaveBeenCalledWith('h2');
    expect(run(fake({ hovered: 'h3' }))).toHaveBeenCalledWith('h3');
    // Hors combat : l'entité survolée.
    expect(b.when(fake({ mode: 'exploration', battle: null, hovered: 'npc-phillipe' }))).toBe(true);
    expect(run(fake({ mode: 'exploration', battle: null, hovered: 'npc-phillipe' }))).toHaveBeenCalledWith('npc-phillipe');
    // Rien de désigné : la touche se tait, en combat comme hors combat.
    expect(b.when(fake())).toBe(false);
    expect(b.when(fake({ mode: 'exploration', battle: null }))).toBe(false);
    expect(run(fake())).not.toHaveBeenCalled();
  });

  it('C recentre HORS combat aussi, et remet le zoom à 100 %', () => {
    const b = binding('cam-recenter');
    expect(b.when(fake({ mode: 'exploration', battle: null }))).toBe(true);
    expect(b.when(fake({ screen: 'party' }))).toBe(false);
    const resetCamPan = vi.fn();
    const setZoom = vi.fn();
    b.run(() => ({ resetCamPan, setZoom }) as never);
    expect(resetCamPan).toHaveBeenCalledOnce();
    expect(setZoom).toHaveBeenCalledWith(1);
  });
});

/**
 * RETOUR ARRIÈRE ANNULE LE DÉPLACEMENT (#1411 P1 lot C) : la touche du geste adossé à la gouttière de
 * Mouvement. Sa garde est le GATE DU REGISTRE (`deplacement-annulable`), donc elle se tait exactement
 * là où `cancelMove` ne mordrait pas — Mouvement dépensé SANS instantané (relevé) compris.
 */
describe('raccourcis — Retour arrière annule le déplacement', () => {
  /** Combat dont l'acteur actif a l'état de Mouvement donné. */
  const avecMouvement = (over: Record<string, unknown>) =>
    fake({
      battle: {
        over: null, turn: 0, order: ['h1'], action: null, acted: false, movementUsed: 0, moveSnapshot: null,
        combatants: [{ id: 'h1', kind: 'hero', label: 'Gunnar', advantage: 0, conditions: [] }],
        ...over,
      } as never,
    });

  it('un segment restaurable : la touche répond, et EXÉCUTE le dispatcher du registre', () => {
    const b = binding('undo-move');
    expect(b.codes).toEqual(['Backspace']);
    const s = avecMouvement({ movementUsed: 2, moveSnapshot: { pos: { h1: { x: 5, y: 5 } }, facing: {}, movedPreAction: false } });
    expect(b.when(s)).toBe(true);
    const cancelMove = vi.fn();
    b.run(() => ({ ...s, cancelMove }) as never);
    expect(cancelMove).toHaveBeenCalledOnce();
  });

  it('Mouvement dépensé SANS instantané (relevé) ou Action prise : la touche est MUETTE', () => {
    const b = binding('undo-move');
    expect(b.when(avecMouvement({ movementUsed: 2 })), 'aucun instantané : `cancelMove` no-operait').toBe(false);
    expect(b.when(avecMouvement({}))).toBe(false);
    expect(
      b.when(avecMouvement({ movementUsed: 2, acted: true, moveSnapshot: { pos: { h1: { x: 5, y: 5 } }, facing: {}, movedPreAction: false } })),
      'Action prise : l’annulation est une aide PRÉ-Action',
    ).toBe(false);
  });
});

/**
 * X FAIT TOURNER LES SETS (planche USER 2026-08-17, travée gauche de la console) : la colonne de sets
 * a absorbé le commutateur, et sa touche passe au set SUIVANT dans l'ordre où ils y sont dessinés.
 * Le plafond 1×/tour et les gates de contrôle restent au store (`battleSwitchLoadout`).
 */
describe('raccourcis — X commute le set d’armes', () => {
  /** Combat dont l'acteur ACTIF porte `sets` sets, celui d'`actif` au poing. */
  const avecSets = (sets: string[], actif: string, over: Partial<GameState> = {}) =>
    fake({
      battle: {
        over: null, turn: 0, order: ['h1'],
        combatants: [{ id: 'h1', kind: 'hero', label: 'Gunnar', loadouts: sets.map((id) => ({ id })), activeLoadoutId: actif }],
      } as never,
      ...over,
    });

  it('la touche est KeyX, muette sous DEUX sets, et fait tourner en boucle', () => {
    const b = binding('switch-loadout');
    expect(b.codes).toEqual(['KeyX']);
    // Un seul set (ou aucun) : rien à commuter — la touche ne s'applique pas.
    expect(b.when(avecSets(['lo-a'], 'lo-a'))).toBe(false);
    expect(b.when(fake())).toBe(false);
    expect(b.when(avecSets(['lo-a', 'lo-b'], 'lo-a'))).toBe(true);

    // Set SUIVANT dans l'ordre de la colonne…
    const s1 = avecSets(['lo-a', 'lo-b', 'lo-c'], 'lo-a');
    const switch1 = vi.fn();
    b.run(() => ({ ...s1, battleSwitchLoadout: switch1 }) as never);
    expect(switch1).toHaveBeenCalledWith('lo-b');
    // … et retour au PREMIER depuis le dernier (rotation, pas une file).
    const s2 = avecSets(['lo-a', 'lo-b', 'lo-c'], 'lo-c');
    const switch2 = vi.fn();
    b.run(() => ({ ...s2, battleSwitchLoadout: switch2 }) as never);
    expect(switch2).toHaveBeenCalledWith('lo-a');
  });

  it('se tait pendant un ciblage par la carte, comme les autres gestes qui ENGAGENT', () => {
    const s = avecSets(['lo-a', 'lo-b'], 'lo-a', {
      pendingCascade: cascadeDeTest([{ id: 'r', kind: 'affichage', actorId: 'h1' }]),
      pendingCast: { casterId: 'h1', pickingTargets: true } as never,
    });
    expect(binding('switch-loadout').when(s)).toBe(false);
  });
});

/**
 * ÉCHAP PENDANT UN INTERLUDE DE CIBLAGE (#1411 P0-B) — six modes ciblent par la CARTE sans modale
 * (Frappe Mortelle, 2ᵉ frappe, Surincantation, pose de zone, bordée, téléportation). Contrat par
 * ÉTAT, positif :
 *   • un interlude dont la sortie ne perd RIEN (`exitSafe`) : Échap la prend — un seul binding, et
 *     JAMAIS `toggle-menu` (ouvrir le menu système par-dessus un ciblage en cours) ;
 *   • un interlude dont la sortie COMMET (renoncer à un enchaînement, se poser sur sa case) : Échap
 *     ne sélectionne RIEN. La touche d'annulation ne commet jamais — seul le clic explicite le fait.
 */
describe('raccourcis — Échap pendant un INTERLUDE de ciblage par la carte', () => {
  const escapes = (s: GameState) => KEYBINDINGS.filter((k) => k.codes.includes('Escape') && k.when(s)).map((k) => k.id);
  const combat = (over: Partial<GameState>) =>
    fake({ battle: { over: null, order: [], turn: 0, combatants: [], action: null } as never, ...over });
  const avecAction = (action: string) => combat({ battle: { over: null, order: [], turn: 0, combatants: [], action } as never });

  const CAS: [string, GameState, string[]][] = [
    ['Frappe Mortelle', combat({ pendingCleave: { attackerId: 'h1', hitIds: [], count: 0 } as never }), []],
    ['2ᵉ frappe', combat({ pendingDualStrike: { attackerId: 'h1', offWeaponUid: 'w1' } as never }), []],
    ['Surincantation', combat({ pendingCast: { casterId: 'h1', pickingTargets: true } as never }), ['interlude-exit']],
    ['pose de zone', combat({ pendingCast: { casterId: 'h1', result: {}, zone: { placing: true, radius: 2 } } as never }), ['interlude-exit']],
    ['bordée', avecAction('battery'), ['interlude-exit']],
    ['téléportation', avecAction('teleport'), []],
  ];

  for (const [nom, etat, attendu] of CAS) {
    it(`${nom} : Échap sélectionne ${attendu.length ? `« ${attendu[0]} »` : 'RIEN'} — jamais le menu système`, () => {
      const hits = escapes(etat);
      expect(hits, `Échap pendant « ${nom} »`).toEqual(attendu);
      expect(hits, 'le menu système ne s’ouvre jamais par-dessus un ciblage').not.toContain('toggle-menu');
    });
  }

  it('hors interlude, Échap retombe bien sur le menu système (la garde n’est pas devenue muette)', () => {
    expect(escapes(combat({}))).toEqual(['toggle-menu']);
  });

  it('la sortie EXÉCUTÉE est celle du registre : la bordée désarme le mode, sans dispatcher recopié', () => {
    const battleSelectAction = vi.fn();
    const s = avecAction('battery');
    binding('interlude-exit').run(() => ({ ...s, battleSelectAction }) as never);
    expect(battleSelectAction).toHaveBeenCalledWith(null);
  });
});

/**
 * COOP — l'interlude d'AUTRUI n'enferme pas les autres sièges (#1411 P0-B). `interlude-exit` exige
 * `controlsActive` : pendant le ciblage du héros d'un autre joueur, ce siège n'a AUCUNE sortie à
 * prendre — Échap doit donc lui rendre le menu système. L'état est un VRAI combat à deux sièges
 * (deux héros possédés, tour du siège 0, invité au siège 1), pas un `combatants: []` dégénéré.
 */
describe('raccourcis — Échap pendant l’interlude d’un AUTRE siège (coop)', () => {
  const escapes = (s: GameState) => KEYBINDINGS.filter((k) => k.codes.includes('Escape') && k.when(s)).map((k) => k.id);
  const H = (id: string) => ({ id, kind: 'hero', label: id, pos: { x: 5, y: 5 }, conditions: [], activeEffects: [], wounds: { current: 10, max: 10 }, chars: {}, skills: [], talents: [], weapons: [], items: [], advantage: 0 });
  /** Bordée en cours (interlude `battery-cancel`, `exitSafe`), tour du héros `turn`, siège local `mySeat`. */
  const table = (turn: number, mySeat: number) =>
    fake({
      party: [H('h1'), H('h2')] as never,
      net: { mode: 'guest', mySeat, gmSeat: null, ownership: { h1: 0, h2: 1 } } as never,
      battle: { over: null, order: ['h1', 'h2'], turn, combatants: [H('h1'), H('h2')], action: 'battery' } as never,
    });

  it('le siège QUI TIENT le ciblage prend sa sortie (et pas le menu)', () => {
    expect(escapes(table(1, 1))).toEqual(['interlude-exit']);
  });

  it('le siège qui NE tient PAS le ciblage garde le menu système : ni sortie, ni impasse', () => {
    const hits = escapes(table(0, 1));
    expect(hits, 'un siège sans sortie ET sans menu serait enfermé par l’interlude d’autrui').toEqual(['toggle-menu']);
  });
});

describe('raccourcis — une touche-MODIFICATEUR est son propre modificateur', () => {
  it('la table nomme les deux positions de chaque modificateur, et rien d’autre', () => {
    expect(modsDeLaTouche('AltLeft')).toBe('alt');
    expect(modsDeLaTouche('AltRight')).toBe('alt');
    expect(modsDeLaTouche('ControlLeft')).toBe('ctrl');
    expect(modsDeLaTouche('ControlRight')).toBe('ctrl');
    expect(modsDeLaTouche('ShiftLeft')).toBe('shift');
    expect(modsDeLaTouche('ShiftRight')).toBe('shift');
    expect(modsDeLaTouche('KeyA'), 'une touche ordinaire ne porte aucun modificateur').toBeNull();
  });

  it('un raccourci NU sur Alt répond à son propre appui — et `KeyA` nu sous Alt reste refusé', () => {
    // L'appui d'`AltLeft` porte `altKey` vrai : sans l'exclusion, aucun raccourci d'Alt ne serait
    // jamais frappable.
    expect(modsMatch([], ['alt'], 'AltLeft'), 'Alt nu s’est tu sur son propre appui').toBe(true);
    expect(modsMatch([], ['alt'], 'AltRight')).toBe(true);
    expect(modsMatch([], ['ctrl'], 'ControlLeft')).toBe(true);
    expect(modsMatch([], ['alt'], 'KeyA'), 'Alt+A a déclenché le raccourci de A').toBe(false);
    expect(modsMatch([], ['ctrl'], 'KeyA')).toBe(false);
    // L'exclusion ne porte QUE le modificateur de la touche frappée : Ctrl+Alt (AltGr) reste refusé.
    expect(modsMatch([], ['ctrl', 'alt'], 'AltLeft'), 'Ctrl tenu pendant l’appui d’Alt est passé').toBe(false);
    // La couche Maj reste tolérée sur une touche nue, et exacte quand elle est déclarée.
    expect(modsMatch([], ['shift'], 'Digit1')).toBe(true);
    expect(modsMatch(['ctrl'], ['ctrl'], 'KeyZ')).toBe(true);
    expect(modsMatch(['ctrl'], ['ctrl', 'shift'], 'KeyZ')).toBe(false);
    // Un raccourci Ctrl+Alt DÉCLARÉ sur la touche Alt : son propre mod sort du comparatif.
    expect(modsMatch(['ctrl'], ['ctrl', 'alt'], 'AltLeft')).toBe(true);
  });
});
