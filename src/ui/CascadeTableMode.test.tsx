// @vitest-environment jsdom
/**
 * MODE TABLE (#942 L3) — la fenêtre de cascade MONTÉE pour de vrai (`CascadeBody`, patron
 * `createRoot`/`act` du repo) sur une étape à table : les DEUX affordances de la MÊME étape (champ
 * « Fixer le dé » du `ForcedRollPicker`, grille de lignes d'`OptionChooser`) ne s'offrent que sous
 * l'option « Dés fixés » ET au siège qui contrôle l'étape ; cliquer une ligne POSE le dé qui
 * l'atteint (modificateur compris) ; le champ est borné aux FACES du dé et refuse le reste ; un dé
 * posé reste RÉ-ÉDITABLE tant que l'étape est courante.
 *
 * La saisie est jouée FRAPPE PAR FRAPPE puis validée par Entrée (comme un vrai clavier) : un test qui
 * poserait « 48 » en UN événement ne verrait ni le dé intermédiaire « 4 », ni un champ démonté après
 * la pose, ni le geste TERMINAL qui commet seul (#955).
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { startCascade, registerTableStep, registerCascadeApplier } from '../state/cascade';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { freeCons } from '../state/rollSeam';
import { CascadeBody } from './CascadeModal';
import type { CascadeStep } from '../state/pendings';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { applyAttackResult } from '../state/combatFlow';
import { seedBattleRng } from '../state/battleRng';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Table à d100 (deux fourchettes) et table à d10 (le domaine du dé n'est PAS toujours le d100). */
const T = 'test-table-mode-ui';
const T10 = 'test-table-mode-ui-d10';

let host: HTMLDivElement;
let root: Root;

/** Étape à table (aucun acteur : le tirage est du MONDE — le siège hôte/MJ le contrôle). */
const tableStep = (tableId: string, mod?: number): CascadeStep =>
  ({ id: 'tm', kind: 'uiTableSpy', label: fixtureText('Tirage sur tableau'), icon: 'nav/dice', table: { tableId, ...(mod != null ? { mod } : {}) }});

function openTable(mod?: number, tableId = T) {
  useGame.setState({
    battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
  startCascade(useGame.getState, useGame.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep(tableId, mod)] });
}

function render() {
  act(() => { root.render(<CascadeBody />); });
}

const dieInput = () => host.querySelector('.rm-die-pick input[type="number"]') as HTMLInputElement | null;
const rowButtons = () => [...host.querySelectorAll('.rm-loc-grid button')] as HTMLButtonElement[];
const rowButton = (text: string) => rowButtons().find((b) => (b.textContent ?? '').includes(text));
const step = () => useGame.getState().pendingCascade!.participants[0];
const result = () => step().table!.result;

/** UNE frappe : la valeur du champ devient `value` (React contrôle l'input, d'où le setter natif).
 *  Une frappe ne COMMET rien — le dé se pose au geste terminal (#955). */
function typeChar(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Geste TERMINAL (Entrée) : c'est LUI qui pose le dé saisi. */
function pressEnter(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

/** Saisie clavier RÉELLE : caractère par caractère (le champ est relu entre chaque : il peut se
 *  démonter), puis Entrée qui commet. */
function typeSlowly(value: string) {
  let acc = '';
  for (const ch of value) {
    acc += ch;
    const input = dieInput();
    expect(input, `le champ a disparu après « ${acc.slice(0, -1)} » — la saisie n'est plus corrigeable`).not.toBeNull();
    typeChar(input!, acc);
  }
  pressEnter(dieInput()!);
}

beforeEach(() => {
  resetDesFixes();
  registerTableStep(T, {
    label: 'Table du mode',
    die: 100,
    // Une ligne LABELLÉE et une ligne SANS libellé (repli sur sa fourchette) : le picker rend les deux.
    rows: [{ min: 1, max: 50, id: 'basse', label: 'Ligne basse' }, { min: 51, max: 100, id: 'haute' }],
    lines: (die) => [`ligne ${die <= 50 ? 'basse' : 'haute'} (dé ${die})`],
  });
  registerTableStep(T10, {
    label: 'Table à d10',
    die: 10,
    rows: [{ min: 1, max: 5, id: 'bas', label: 'Bas' }, { min: 6, max: 10, id: 'haut', label: 'Haut' }],
    lines: (die) => [`d10 → ${die}`],
  });
  registerCascadeApplier('uiTableSpy', () => {});
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetDesFixes();
});

describe('Mode table — les deux affordances d’une étape à table', () => {
  it('option ON, siège qui contrôle : le champ « Fixer le dé » ET la grille des lignes sont là (le « Lancer » reste)', () => {
    setDesFixes(true);
    openTable();
    render();
    expect(dieInput()).not.toBeNull();
    // La FOURCHETTE est portée par CHAQUE tuile (verdict vision #942 L7) : c'est ce qui fait lire
    // une table d100 et non un choix libre — libellée ou pas, la ligne annonce ses bornes. Elle est
    // une SURFACE à elle (`.rm-range`, option-chooser.css), qui porte son ton et son écart au libellé.
    expect(rowButtons().map((b) => b.querySelector('.rm-range')?.textContent ?? null)).toEqual(['01-50', '51-100']);
    expect(rowButtons().map((b) => b.textContent)).toEqual(['Ligne basse01-50', '51-100']);
    // L'écart se lit au CSS (`.rm-range` / `.rm-range:first-child`) : un libellé est un ÉLÉMENT, sinon
    // la fourchette est toujours premier enfant et se colle au nom de la ligne.
    expect(rowButtons().map((b) => b.querySelector('.rm-range')?.previousElementSibling?.textContent ?? null)).toEqual(['Ligne basse', null]);
    expect(host.textContent).toContain('Lancer'); // le tirage naturel reste le défaut
  });

  it('CLIC sur une ligne (mod −10) : le dé posé est celui qui ATTEINT la ligne, et la ligne cliquée sort', () => {
    setDesFixes(true);
    openTable(-10);
    render();
    act(() => { rowButton('51-100')!.click(); });
    // Poser la borne BRUTE (51) donnerait un dé effectif de 41 → ligne 'basse' : la ligne cliquée glisserait.
    expect(result()).toMatchObject({ roll: 61, die: 51, id: 'haute' });
  });

  it('ligne HORS D’ATTEINTE sous le `mod` : bouton éteint, la raison LIÉE (jamais un `title` muet)', () => {
    setDesFixes(true);
    openTable(60);
    render();
    const basse = rowButton('Ligne basse')!;
    // ÉTEINTE mais ATTEIGNABLE : `aria-disabled` + clic inerte, jamais le `disabled` HTML — qui la
    // sortirait du clavier, de la manette et du tap, donc de la raison qu'elle DOIT pouvoir dire.
    expect(basse.getAttribute('aria-disabled'), 'la ligne éteinte n’est pas marquée refusée').toBe('true');
    expect(basse.disabled, '`disabled` HTML : la ligne sort du clavier et de la manette').toBe(false);
    // La raison ne vit plus dans un `title` natif (invisible à l'arbre a11y, inatteignable au doigt) :
    // N lignes éteintes par la MÊME cause se LIENT au récapitulatif rendu une fois sous la grille —
    // grammaire de refus UNIQUE de la primitive (`RollOption.refusId` → `GatedAction` forme
    // `reasonId`), arbitrage user 2026-08-24.
    expect(basse.title, 'plus de raison en infobulle native').toBe('');
    const raison = host.querySelector(`#${basse.getAttribute('aria-describedby')}`);
    expect(raison?.textContent, 'la raison est à l’écran, et le bouton la DÉSIGNE').toContain("hors d'atteinte");
    expect(rowButton('51-100')!.getAttribute('aria-disabled'), 'une ligne OFFERTE n’est pas éteinte').toBeNull();
    expect(rowButton('51-100')!.getAttribute('aria-describedby'), 'une ligne atteignable ne désigne aucun refus').toBeNull();
    act(() => { basse.click(); });
    expect(result(), 'une ligne inatteignable ne pose aucun dé').toBeUndefined();
  });

  it('SAISIE frappe par frappe : « 48 » pose 48 (pas 4), « 97 » pose 97 — le champ survit à chaque frappe', () => {
    setDesFixes(true);
    openTable(10);
    render();
    typeChar(dieInput()!, '4');
    expect(result(), 'une frappe intermédiaire ne pose RIEN : le commit est terminal (#955)').toBeUndefined();
    typeChar(dieInput()!, '48');
    pressEnter(dieInput()!);
    expect(result(), 'un chiffre intermédiaire figé = la valeur du joueur jamais atteinte').toMatchObject({ roll: 48, die: 58, id: 'haute' });
    openTable();
    render();
    typeSlowly('97');
    expect(result()).toMatchObject({ roll: 97, die: 97, id: 'haute' });
  });

  it('dé posé RÉ-ÉDITABLE tant que l’étape est courante : le champ reste monté, la saisie suivante re-pose', () => {
    setDesFixes(true);
    openTable();
    render();
    typeSlowly('97');
    const input = dieInput();
    expect(input, 'le champ démonté après la pose = une valeur subie').not.toBeNull();
    expect(input!.value).toBe('97');
    typeChar(input!, '12');
    pressEnter(input!);
    expect(result()).toMatchObject({ roll: 12, id: 'basse' });
    // La grille reste servie elle aussi : re-choisir une ligne re-pose le dé.
    act(() => { rowButton('51-100')!.click(); });
    expect(result()).toMatchObject({ roll: 51, id: 'haute' });
  });

  it('table à d10 : le champ est BORNÉ aux faces du dé — « 47 » est REFUSÉ, jamais ramené en silence à 10', () => {
    setDesFixes(true);
    openTable(undefined, T10);
    render();
    expect(dieInput()!.getAttribute('max')).toBe('10');
    typeSlowly('4');
    expect(result()).toMatchObject({ roll: 4, id: 'bas' });
    typeChar(dieInput()!, '47');
    pressEnter(dieInput()!);
    expect(result(), '47 appliqué comme « 10 » serait une valeur menteuse : le dé reste celui saisi').toMatchObject({ roll: 4, id: 'bas' });
    expect(dieInput()!.value, 'une saisie refusée revient à la dernière valeur valide').toBe('4');
  });

  it('le RÉSULTAT d’un dé posé porte la marque « Dé fixé » — UNE seule surface (l’étiquette du champ)', () => {
    setDesFixes(true);
    openTable();
    render();
    typeSlowly('97');
    expect(result()).toMatchObject({ roll: 97, id: 'haute' });
    expect(host.querySelector('.rm-die-pick > label')?.textContent).toContain('Dé fixé');
    expect((host.textContent ?? '').split('Dé fixé').length - 1).toBe(1);
    expect(host.querySelector('.prow-fixed-mark')).toBeNull();
  });

  it('étape SUIVANTE / BILAN : la fenêtre de pose se ferme avec le curseur — plus de champ ni de grille pour l’étape figée', () => {
    setDesFixes(true);
    // Séquence de DEUX étapes : le curseur avance, l'étape 1 sort de sa fenêtre.
    useGame.setState({
      battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Tirage', purpose: 'test',
      steps: [{ ...tableStep(T), id: 's1' }, { ...tableStep(T), id: 's2' }],
    });
    render();
    typeSlowly('9');
    const fige = useGame.getState().pendingCascade!.participants[0].table!.result;
    act(() => { useGame.getState().cascadeNext(); }); // conséquence de s1 appliquée, curseur sur s2
    // Le champ à l'écran est celui de s2 : y saisir n'écrit PAS sur l'étape figée.
    typeSlowly('72');
    const parts = () => useGame.getState().pendingCascade!.participants;
    expect(parts()[0].table!.result, 'le dé d’une étape déjà subie ne se réécrit pas depuis l’étape suivante').toEqual(fige);
    expect(parts()[1].table!.result).toMatchObject({ roll: 72, id: 'haute' });
    // BILAN (« Tout lancer » → curseur en fin) : plus AUCUNE affordance de pose à l'écran.
    act(() => { useGame.getState().cascadeNext(); });
    expect(useGame.getState().pendingCascade, 'la cascade se referme après la dernière étape').toBeNull();
  });

  it('BILAN de « Tout lancer » : ni champ ni grille (les conséquences sont déjà appliquées)', () => {
    setDesFixes(true);
    useGame.setState({
      battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Tirage', purpose: 'test',
      steps: [{ ...tableStep(T), id: 's1' }, { ...tableStep(T), id: 's2' }],
    });
    render();
    act(() => { useGame.getState().cascadeResolveAll(); });
    const p = useGame.getState().pendingCascade!;
    expect(p.cursor).toBe(p.participants.length);
    expect(dieInput(), 'un champ au bilan proposerait de re-tirer une conséquence déjà subie').toBeNull();
    expect(host.querySelector('.rm-loc-grid')).toBeNull();
    expect(host.textContent).toContain('Terminer');
  });

  it('option ÉTEINTE : AUCUNE des deux affordances (le tirage naturel, lui, reste offert)', () => {
    openTable();
    render();
    expect(dieInput()).toBeNull();
    expect(host.querySelector('.rm-loc-grid')).toBeNull();
    expect(host.textContent).toContain('Lancer');
  });

  it('option ON mais siège qui NE contrôle PAS l’étape (coop) : aucune des deux affordances', () => {
    setDesFixes(true);
    openTable();
    useGame.setState({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 1 } as never });
    render();
    expect(dieInput()).toBeNull();
    expect(host.querySelector('.rm-loc-grid')).toBeNull();
  });
});

/**
 * VALEUR AFFICHÉE = VALEUR APPLIQUÉE (#942 L4, verdict vision) — sur une table à `mod`, la ligne est
 * résolue par le dé EFFECTIF (`naturel + mod`, `rollTableStep`). Toute surface montrant le dé posé
 * montre donc l'effectif ET l'opération : le naturel SEUL fait lire 61 au joueur là où la ligne vient
 * de 51 — la classe de « valeur menteuse » que `ForcedRollPicker` s'interdit déjà pour sa borne.
 */
describe('Mode table — le dé montré est celui qui RÉSOUT (table à modificateur)', () => {
  /** Mention portée par le SÉLECTEUR (le champ) — la rangée de table porte la sienne, même classe. */
  const dieHint = () => host.querySelector('.rm-die-pick .hint')?.textContent ?? '';

  it('CHAMP : dé posé 61 sous −10 → l’écran porte l’effectif 51 et l’opération, jamais 61 seul', () => {
    setDesFixes(true);
    openTable(-10);
    render();
    typeSlowly('61');
    expect(result()).toMatchObject({ roll: 61, die: 51 });
    expect(dieHint(), 'le dé effectif n’est pas affiché à côté de la saisie').toContain('51');
    expect(dieHint()).toContain('(61 − 10)');
  });

  it('modificateur POSITIF (+10 par Point de Péché, LDB 40 l.46) : les deux surfaces portent l’effectif et le « + »', () => {
    // Premier `mod` POSITIF en production (#942 L6, Colère des dieux) : l'opération se lit « + », et le
    // dé montré reste celui qui RÉSOUT — le naturel seul ferait lire 48 là où la ligne vient de 58.
    setDesFixes(true);
    openTable(10);
    render();
    typeSlowly('48');
    expect(result()).toMatchObject({ roll: 48, die: 58, id: 'haute' });
    expect(dieHint(), 'le dé effectif n’est pas affiché à côté de la saisie').toContain('58');
    expect(dieHint()).toContain('(48 + 10)');
    // PASTILLE : posée en UN geste (le dé de `Dice` s'anime à chaque NOUVELLE valeur — une pose en
    // deux frappes laisserait le roulement en cours, pas le verdict).
    openTable(10);
    render();
    act(() => { rowButton('51-100')!.click(); });
    render();
    const chip = host.querySelector('.rm-roll.table .rm-roll-dice')?.textContent ?? '';
    expect(chip, 'la pastille porte le dé naturel, pas celui qui a résolu la ligne').toContain('51');
    expect(chip, 'la pastille montre l’opération avec le mauvais signe').toContain('(41 + 10)');
  });

  it('RANGÉE DE TABLE (après la pose) : la pastille de dé porte l’effectif + l’opération', () => {
    setDesFixes(true);
    openTable(-10);
    render();
    act(() => { rowButton('51-100')!.click(); });
    render();
    // La PASTILLE de dé (et elle seule) : le libellé de la ligne contient déjà « 51 », il ne prouve rien.
    const chip = host.querySelector('.rm-roll.table .rm-roll-dice')?.textContent ?? '';
    expect(chip, 'la pastille porte le dé naturel, pas celui qui a résolu la ligne').toContain('51');
    expect(chip, 'le dé naturel est affiché seul').toContain('(61 − 10)');
    expect(chip.replace('(61 − 10)', ''), 'la pastille montre 61 comme dé résolvant').not.toContain('61');
  });

  it('SANS modificateur : aucune opération parasite (le dé posé EST le dé qui résout)', () => {
    setDesFixes(true);
    openTable();
    render();
    typeSlowly('61');
    expect(result()).toMatchObject({ roll: 61, die: 61 });
    expect(host.querySelector('.rm-die-pick .hint'), 'une mention d’opération sans modificateur').toBeNull();
  });

  it('GRISAGE : la raison est À L’ÉCRAN et les lignes éteintes la citent (aria-describedby)', () => {
    setDesFixes(true);
    openTable(-60); // sous −60, aucun dé de 1 à 100 n'atteint [51-100]
    render();
    // CONTRAT de `GatedAction` : une ligne éteinte porte `aria-disabled` et JAMAIS `disabled` — elle
    // reste atteignable au clavier/à la manette/au doigt pour que sa raison soit lisible.
    const off = rowButtons().filter((b) => b.getAttribute('aria-disabled') === 'true');
    expect(off.length, 'aucune ligne grisée : le cas n’est pas exercé').toBeGreaterThan(0);
    expect(off.every((b) => !b.disabled), 'une ligne grisée ne porte jamais le `disabled` HTML').toBe(true);
    expect(host.textContent).toContain('grisée');
    expect(host.textContent).toContain('hors d’atteinte'.replace('’', "'"));
    const noteId = off[0].getAttribute('aria-describedby');
    expect(noteId, 'la ligne éteinte ne pointe aucune raison visible').toBeTruthy();
    expect(host.querySelector(`#${noteId}`)?.textContent ?? '').toContain('grisée');
  });

  it('POSITION STABLE du champ : même ordre à l’écran avant et après le tirage', () => {
    setDesFixes(true);
    openTable(-10);
    render();
    const order = () => [...host.querySelectorAll('.rm-roll.table, .rm-loc-grid, .rm-die-pick input[type="number"]')]
      .map((e) => (e.classList.contains('rm-loc-grid') ? 'grille' : e.tagName === 'INPUT' ? 'champ' : 'table'));
    const avant = order();
    act(() => { rowButton('Ligne basse')!.click(); });
    render();
    expect(order(), 'le champ saute de place entre les deux états de la MÊME étape').toEqual(avant);
  });
});

/**
 * PLANCHER de table ≠ 1 (sonde du juge vision, PROMUE) — le dé effectif est BORNÉ par le résolveur au
 * plancher de SA table (`clamp`, `rollTableStep`) : une UI qui recalculerait `naturel + mod` de son
 * côté afficherait 1 là où le moteur a résolu 11. L'écran AFFICHE le `die` du résolveur, il ne le
 * dérive pas — c'est cette table (min 11) qui sépare les deux comportements.
 */
describe('Mode table — plancher ≠ 1 : l’écran affiche le dé du RÉSOLVEUR, jamais un recalcul', () => {
  const T11 = 'test-table-plancher-11';

  beforeEach(() => {
    registerTableStep(T11, {
      label: 'Table à plancher 11',
      die: 100,
      rows: [{ min: 11, max: 50, id: 'basse', label: 'Ligne basse' }, { min: 51, max: 100, id: 'haute', label: 'Ligne haute' }],
      lines: (die) => [`plancher (dé ${die})`],
    });
  });

  it('dé 15 sous −20 : le moteur borne à 11, et les DEUX surfaces affichent 11 (pas 1)', () => {
    setDesFixes(true);
    useGame.setState({
      battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
    // Dé DÉCLARÉ sur l'étape (15) : le chemin qui expose l'écart. Une SAISIE au champ serait d'abord
    // ramenée aux naturels que la table peut résoudre (`clampTableNatural` : 15 → 31), et 31 − 20 = 11
    // tomberait juste même avec un recalcul — la sonde ne prouverait alors rien.
    startCascade(useGame.getState, useGame.setState, {
      title: 'Tirage', purpose: 'test',
      steps: [{ id: 'tm', kind: 'uiTableSpy', label: fixtureText('Tirage'), icon: 'nav/dice', table: { tableId: T11, mod: -20, clamp: true, forcedRoll: 15 }}],
    });
    render();
    act(() => { useGame.getState().cascadeTableRoll('tm'); });
    render();
    expect(result(), 'le résolveur ne borne pas au plancher de la table').toMatchObject({ roll: 15, die: 11, id: 'basse' });
    const champ = host.querySelector('.rm-die-pick .hint')?.textContent ?? '';
    expect(champ, 'le champ recalcule le dé au lieu de lire celui du résolveur').toContain('11');
    expect(champ, 'le champ a dérivé un dé sous le plancher de la table').not.toContain('= 1 ');
    const chip = host.querySelector('.rm-roll.table .rm-roll-dice')?.textContent ?? '';
    expect(chip, 'la pastille recalcule le dé au lieu de lire celui du résolveur').toContain('11');
  });
});

/**
 * VERDICT VISION #942 L7 — les deux contrats réfutés par le juge sur l'écran de cascade :
 *  1. le MOMENT DE LA POSE est lisible : l'étape RESTE à l'écran, à l'état résolu (ligne élue FERRÉE
 *     + valeur EN TÊTE), jusqu'au geste d'avancer — poser un dé n'avance pas le pas ;
 *  2. la barre d'actions est SŒUR du corps défilable, jamais fille : c'est ce qui la garde à l'écran
 *     quand le corps déborde (le pied ne descend plus avec le contenu).
 */
describe('Après la pose — l’étape reste lisible à l’état résolu (verdict vision)', () => {
  /** Séquence de DEUX étapes : la seconde prouve que le curseur n'a pas bougé tout seul. L'applier
   *  rend une CONSÉQUENCE (prose) — c'est elle qui, sans coupure, se collait au tirage suivant. */
  function openDeux() {
    registerCascadeApplier('uiTableProse', (_g, _s, step) => ({
      consequences: freeCons([`Sigmund — Événement (${step.table!.result!.roll}) : la vie suit son cours.`]),
    }));
    useGame.setState({
      battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Les nouvelles de la période', purpose: 'test',
      steps: [
        { ...tableStep(T), kind: 'uiTableProse', id: 's1', label: fixtureText('Événement — Sigmund')},
        { ...tableStep(T), kind: 'uiTableProse', id: 's2', label: fixtureText('Événement — Grunni')},
      ],
    });
  }

  it('DIAGNOSTIC : poser un dé ne COMMITTE ni n’AVANCE — le curseur reste sur l’étape posée', () => {
    setDesFixes(true);
    openDeux();
    render();
    act(() => { rowButton('Ligne basse')!.click(); });
    const p = useGame.getState().pendingCascade!;
    expect(p.cursor, 'la pose a fait avancer le pas toute seule').toBe(0);
    expect(p.participants[0].committed, 'la pose a committé l’étape sans geste de validation').toBeFalsy();
    expect(p.participants[0].table!.result).toMatchObject({ id: 'basse' });
    // L'étape POSÉE est celle qui reste à l'écran (son libellé), pas celle d'après.
    expect(host.textContent).toContain('Sigmund');
    expect(host.textContent, 'l’écran est passé au héros suivant sans validation').not.toContain('Grunni');
  });

  it('CONTRAT 1 : après la pose, la tuile ÉLUE est ferrée et la VALEUR est en tête de l’étape', () => {
    setDesFixes(true);
    openDeux();
    render();
    act(() => { rowButton('Ligne basse')!.click(); });
    render();
    // Tuile ÉLUE : état ferré (aria-pressed), pas un simple bouton mis en avant.
    const elue = rowButtons().find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(elue, 'aucune tuile n’est ferrée après la pose').toBeDefined();
    expect(elue!.textContent).toContain('Ligne basse');
    expect(rowButtons().filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    // VALEUR EN TÊTE : la rangée de tirage précède la grille dans le flux du document.
    const rangee = host.querySelector('.rm-roll.table');
    const grille = host.querySelector('.rm-loc-grid');
    expect(rangee, 'la valeur posée n’est pas rendue').not.toBeNull();
    expect(grille).not.toBeNull();
    expect(
      rangee!.compareDocumentPosition(grille!) & Node.DOCUMENT_POSITION_FOLLOWING,
      'la grille passe AVANT la valeur : le verdict se cherche sous les tuiles',
    ).toBeTruthy();
    expect(host.querySelector('.rm-roll.table .rm-roll-dice')?.textContent ?? '').toContain('1');
  });

  // Arbitrage user 2026-08-09 (« Corps purgé par bande ») : une séquence pose UNE question à la fois.
  // L'étape validée quitte le corps AVEC ses verdicts — sa mémoire vit au Journal, puis au Bilan.
  it('CONTRAT 1bis : le corps est PURGÉ au passage d’étape — la prose validée sort de la fenêtre et reste au Journal', () => {
    setDesFixes(true);
    openDeux();
    render();
    act(() => { rowButton('Ligne basse')!.click(); });
    // La prose de s1 n'existe qu'À LA VALIDATION (l'applier la produit) : elle ne pouvait apparaître
    // que dans la PILE des étapes validées — c'est exactement ce que la purge retire.
    const proseS1 = 'Sigmund — Événement';
    act(() => { useGame.getState().cascadeNext(); }); // s1 validée → le corps passe à s2
    render();
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
    expect(host.textContent, 'la prose de s1 traîne encore sous le titre de s2').not.toContain(proseS1);
    expect(host.textContent, 'un filet « Étape en cours » n’a plus d’objet sans pile').not.toContain('Étape en cours');
    // La mémoire du joueur : le verdict de s1 est au JOURNAL (écrit par `commitStep`).
    expect(useGame.getState().journal.some((l) => l.includes(proseS1))).toBe(true);
  });

  it('CONTRAT 2 : la barre d’actions est SŒUR du corps défilable (pied fixe), jamais dans le scroll', () => {
    setDesFixes(true);
    openDeux();
    render();
    const scroll = host.querySelector('.rs-scroll');
    expect(scroll, 'aucun corps défilable : la modale entière redevient le scrollport').not.toBeNull();
    const actions = host.querySelector('.modal-actions')!;
    expect(actions, 'la barre d’actions a disparu').not.toBeNull();
    expect(scroll!.contains(actions), 'la barre d’actions est DANS le corps défilable : elle sortira du champ dès que le contenu déborde').toBe(false);
    expect(actions.parentElement, 'la barre n’est pas sœur du corps défilable').toBe(scroll!.parentElement);
    // Le contenu long (grille + pile) vit bien DANS le corps défilable.
    expect(scroll!.querySelector('.rm-loc-grid')).not.toBeNull();
  });
});

/**
 * CORPS PURGÉ PAR BANDE (#1117 L1, arbitrage user 2026-08-09) — deux bandes successives (Animosité →
 * Haine) : la fenêtre de la 2ᵉ ne montre QUE ses rangées. Avant l'arbitrage, les rangées résolues de
 * la bande précédente restaient empilées au-dessus, sans séparateur : l'écran disait « Haine » en
 * montrant des issues d'Animosité. Les verdicts partis du corps restent au JOURNAL.
 */
describe('bandes successives — le corps ne rend QUE la bande courante', () => {
  const heroOf = (id: string) => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, rng: makeRNG(1) });
    h.id = id;
    return h;
  };
  const bandRow = (id: string, label: string) => ({ id, label, interactive: true, base: 50, target: 50, result: null });
  // POSSESSION dérivée des rangées comme dans `rollSeam.bandStep` : une bande anonyme n'entre plus dans
  // une séquence (#1262 V2 L4, `cascade.assertBandeDeclarePossession`).
  const bandStep = (id: string, label: string, rows: ReturnType<typeof bandRow>[]): CascadeStep =>
    ({
      id, kind: 'uiBandProse', label, icon: 'nav/dice', aggregate: 'none', participants: rows,
      ...(new Set(rows.map((r) => r.id)).size > 1 ? { groupOwner: true } : { actorId: rows[0].id }),
    }) as CascadeStep;

  function openBandes() {
    registerCascadeApplier('uiBandProse', (_g, _s, step) => ({
      consequences: freeCons((step.participants ?? []).map((part) => `${part.label} — verdict`)),
    }));
    useGame.setState({
      battle: null, party: [heroOf('h1'), heroOf('h2')], pendingCascade: null, suspendedCascades: [], journal: [],
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Sang-froid', purpose: 'test',
      steps: [
        bandStep('bA', 'Animosité (Elfes)', [bandRow('h1', 'Animosité-A1'), bandRow('h2', 'Animosité-A2')]),
        bandStep('bB', 'Haine (Elfes)', [bandRow('h1', 'Haine-B1')]),
      ],
    });
  }

  /** Pose des jets DÉTERMINISTES sur les rangées de la bande courante (aucun RNG dans la sonde). */
  function rollBand() {
    const pc = useGame.getState().pendingCascade!;
    const st = pc.participants[pc.cursor];
    const participants = st.participants!.map((part) => ({ ...part, result: { roll: 99, target: 50, sl: -2, success: false } }));
    useGame.setState({ pendingCascade: { ...pc, participants: pc.participants.map((x, i) => (i === pc.cursor ? { ...x, participants } : x)) } });
  }

  it('au passage à la 2ᵉ bande, les rangées de la 1ʳᵉ ont quitté le DOM ; leurs verdicts sont au Journal', () => {
    openBandes();
    render();
    expect(host.textContent).toContain('Animosité-A1');
    expect(host.textContent).toContain('Animosité-A2');
    act(() => { rollBand(); });
    act(() => { useGame.getState().cascadeNext(); });
    render();
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
    expect(host.textContent, 'le titre de la bande courante est bien celui de la 2ᵉ').toContain('Haine');
    expect(host.textContent, 'la rangée h1 de la bande précédente est restée sous le titre « Haine »').not.toContain('Animosité-A1');
    expect(host.textContent, 'la rangée h2 de la bande précédente est restée sous le titre « Haine »').not.toContain('Animosité-A2');
    expect(host.textContent, 'la rangée de la bande COURANTE doit être rendue').toContain('Haine-B1');
    // Mémoire du joueur : les verdicts sortis du corps sont au Journal.
    const journal = useGame.getState().journal;
    expect(journal.some((l) => l.includes('Animosité-A1 — verdict'))).toBe(true);
    expect(journal.some((l) => l.includes('Animosité-A2 — verdict'))).toBe(true);
  });
});

describe('BILAN — un tirage joué se VOIT, même sans conséquence écrite (#1426)', () => {
  it('étape à table COMMITTÉE sans `outcome` : elle a sa rangée de bilan (dé + ligne atteinte) et compte 1 jet', () => {
    // L'arbitrage « résolu d'office → visible au bilan » (2026-08-23) tient ICI : sans rangée, une
    // table que le socle a tirée pour un porteur qu'aucun siège ne tient n'aurait JAMAIS été vue.
    // L'applier-espion `uiTableSpy` ne rend aucune conséquence : l'étape n'a donc pas d'`outcome`.
    openTable();
    act(() => { useGame.getState().cascadeTableRoll('tm'); });
    const tire = result()!;
    act(() => { useGame.getState().cascadeResolveAll(); }); // COMMIT sans fermer → curseur en fin = BILAN
    const casc = useGame.getState().pendingCascade!;
    expect(casc.cursor, 'prémisse : on est bien au bilan').toBe(casc.participants.length);
    expect(casc.participants[0].outcome ?? [], 'prémisse : aucune conséquence écrite').toHaveLength(0);
    render();
    const texte = host.textContent ?? '';
    expect(texte, 'le bilan ne montre pas le tirage').toContain(tire.lines[0]);
    expect(texte, 'le dé jeté ne se lit nulle part').toContain(String(tire.die));
    expect(texte, 'un tirage EST un jet : le compte du bilan doit le porter').toContain('1 jet');
  });
});

/**
 * UNE SEULE FENÊTRE pour la Blessure critique (#1426) — le d100 de SÉVÉRITÉ (LDB 18) et la décision
 * Dévier/Subir (LDB 63 l.30) sont la MÊME étape, montée pour de vrai. Ce que l'écran doit dire :
 *  — AVANT le dé : rien à trancher. Le Critique naît DU dé (il est posé par le PLI post-dé), donc
 *    AUCUNE voie n'est rendue — un joueur ne choisit pas devant une case vide ;
 *  — APRÈS le dé, dans la MÊME fenêtre : la ligne de tirage en TÊTE (zone stable), le panneau riche du
 *    Critique (`CriticalBody`), et les voies Dévier/Subir DESSOUS. Jamais deux corps successifs.
 */
describe('Blessure critique — le dé en tête, le Critique, les voies dessous (#1426)', () => {
  const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  const combattant = (p: Partial<Combatant>): Combatant =>
    ({
      id: 'x', label: 'X', kind: 'hero', characteristics: CHARS,
      wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 0,
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      ...p,
    } as unknown as Combatant);
  const gourdin: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
  const coupCritique: AttackResult = {
    hit: true, attackerRoll: 12, netSL: 4, location: 'corps', critLocation: 'corps', damage: 8, woundsLost: 3,
    critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
  };

  /** Ouvre la fenêtre unique sur un HÉROS BLINDÉ (siège humain : les voies lui sont offertes). */
  function openCritique() {
    seedBattleRng(424242);
    const h = combattant({ id: 'h1', label: 'Hardi', kind: 'hero', armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    const e = combattant({ id: 'e1', label: 'Brute', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [gourdin] });
    useGame.setState({
      battle: { combatants: [e, h], order: ['e1', 'h1'], baseOrder: ['e1', 'h1'], turn: 0, round: 1, action: null,
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
      mode: 'battle', party: [h], pendingCascade: null, suspendedCascades: [], journal: [],
      net: { mode: 'local', mySeat: 0, gmSeat: null, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
    applyAttackResult(useGame.getState, useGame.setState, e, h, gourdin, { ...coupCritique });
  }

  const boutonTexte = (t: string) => [...host.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(t));

  it('AVANT le dé : la fenêtre porte le tirage, et AUCUNE voie n’est rendue (le Critique n’existe pas encore)', () => {
    openCritique();
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.kind, 'prémisse : c’est bien l’étape de Blessure critique').toBe('deviation');
    expect(st.table!.result, 'prémisse : le dé n’est pas tombé').toBeUndefined();
    expect(st.options?.map((o) => o.key), 'prémisse : les voies sont DÉCLARÉES sur l’étape').toEqual(['devier', 'subir']);
    render();
    expect(boutonTexte('Dévier'), 'une voie offerte AVANT le dé : on choisirait devant une case vide').toBeUndefined();
    expect(boutonTexte('Subir')).toBeUndefined();
    expect(host.querySelector('.crit-stats'), 'aucun Critique à montrer avant son dé').toBeNull();
  });

  it('APRÈS le dé, MÊME fenêtre : la ligne de tirage en TÊTE, le Critique, puis les voies Dévier/Subir', () => {
    openCritique();
    const id = useGame.getState().pendingCascade!.participants[0].id;
    act(() => { useGame.getState().cascadeTableRoll(id); });
    const apres = useGame.getState().pendingCascade!.participants[0];
    expect(apres.deviation?.crit, 'prémisse : le PLI post-dé a posé le Critique').toBeTruthy();
    render();
    const devier = boutonTexte('Dévier');
    const subir = boutonTexte('Subir');
    expect(devier, 'les voies doivent s’ouvrir une fois le dé tombé').toBeDefined();
    expect(subir).toBeDefined();
    // DEUX lignes de tirage : celle de l'ÉTAPE, en TÊTE (zone stable, `extra`), et celle que porte le
    // panneau du Critique. Une seule = la tête est tombée, et le dé de l'étape se lit seulement à
    // l'intérieur du panneau — ce n'est plus la même fenêtre.
    const tirages = [...host.querySelectorAll('.rm-roll.table')];
    expect(tirages, 'la ligne de tirage de l’ÉTAPE a disparu de la tête de fenêtre').toHaveLength(2);
    expect(tirages[0].textContent, 'le dé tiré ne se lit pas en tête').toContain(String(apres.table!.result!.die));
    const critique = host.querySelector('.crit-stats');
    expect(critique, 'le panneau riche du Critique (CriticalBody) manque').not.toBeNull();
    // ORDRE À L'ÉCRAN : tirage → Critique → voies. Une seule fenêtre, lue de haut en bas.
    const pos = (n: Node) => [...host.querySelectorAll('*')].indexOf(n as Element);
    expect(pos(tirages[0]), 'le tirage doit rester en TÊTE').toBeLessThan(pos(critique!));
    expect(pos(critique!), 'les voies se prennent SOUS le Critique').toBeLessThan(pos(devier!));
  });

  /**
   * Le rendu des voies est GÉNÉRIQUE : il ne connaît AUCUNE clé d'option. Une voie indisponible ne
   * l'apprend pas du rendu (« si la clé vaut `devier` et que l'armure est nulle ») mais de son PRODUCTEUR,
   * qui la marque `refus` — la cause s'affiche alors au survol/focus/tap (arbitrage 2026-08-24, jamais
   * inline), et le bouton reste atteignable au clavier (`aria-disabled`, jamais `disabled`).
   * Le PA sacrifiable, lui, est déjà la porte du producteur : sans lui, l'étape n'offre AUCUNE voie
   * (`deviation-armour.test.ts` — « rien à sacrifier → aucune voie de Déviation »).
   */
  it('les voies sont rendues SANS branche par clé : « Dévier » est active, et une voie à `refus` porte sa cause', () => {
    openCritique();
    const id = useGame.getState().pendingCascade!.participants[0].id;
    act(() => { useGame.getState().cascadeTableRoll(id); });
    render();
    const devier = boutonTexte('Dévier')!;
    expect(devier.getAttribute('aria-disabled'), '« Dévier » est rendue refusée alors que l’étape l’OFFRE.').not.toBe('true');
    expect(devier.hasAttribute('disabled'), 'une voie ne se coupe jamais du clavier par `disabled`.').toBe(false);

    // La MÊME voie, marquée `refus` par son producteur : le rendu la refuse SANS rien savoir de sa clé.
    const pc = useGame.getState().pendingCascade!;
    const cur = pc.participants[pc.cursor];
    act(() => {
      useGame.setState({
        pendingCascade: {
          ...pc,
          participants: pc.participants.map((s) => (s.id !== cur.id ? s : {
            ...s, options: (s.options ?? []).map((o) => (o.key !== 'devier' ? o : { ...o, refus: 'Plus aucune pièce à sacrifier à cette localisation.' })),
          })),
        } as never,
      });
    });
    render();
    const refusee = boutonTexte('Dévier')!;
    expect(refusee.getAttribute('aria-disabled'), 'une voie porteuse d’un `refus` doit être rendue refusée.').toBe('true');
    expect(refusee.textContent, 'la cause ne doit PAS s’écrire sous le libellé (survol/focus/tap seulement).').not.toContain('Plus aucune pièce');
  });

  /**
   * « Le tirage n'est pas un aller sans retour » — la re-pose du dé reste offerte SUR L'ÉTAPE À VOIES,
   * exactement comme sur une étape d'affichage : même délégué (`affordancesDuDe`), donc même champ
   * « Dé fixé » et même grille de lignes, tant que l'étape est COURANTE et non validée. Sans ce
   * branchement, le dé de sévérité devenait irrévocable dès qu'une décision Dévier/Subir l'accompagnait.
   */
  it('APRÈS le dé, étape à VOIES : le dé se RE-POSE (champ « Dé fixé »), la Blessure suit, et un dé DÉJÀ VU rend la MÊME', () => {
    setDesFixes(true);
    openCritique();
    const id = useGame.getState().pendingCascade!.participants[0].id;
    act(() => { useGame.getState().cascadeTableSetForcedRoll(id, 76); });
    const etape = () => useGame.getState().pendingCascade!.participants[0];
    expect(etape().options?.length, 'prémisse : l’étape porte bien ses voies').toBeGreaterThan(0);
    render();

    expect(dieInput(), 'le champ « Fixer le dé » a disparu dès que l’étape offre des voies').not.toBeNull();
    expect(host.querySelector('.rm-die-pick > label')?.textContent).toContain('Dé fixé');
    expect(rowButtons().length, 'la grille des lignes de la table n’est plus servie').toBeGreaterThan(0);
    expect(boutonTexte('Dévier'), 'les voies doivent rester offertes SOUS la pose').toBeDefined();
    // La BLESSURE affichée en tête de fenêtre (le nombre du dé, lui, s'anime : on ne le mesure pas ici).
    const teteTirage = () => (host.querySelectorAll('.rm-roll.table')[0]?.textContent ?? '');
    const label = () => etape().table!.result!.lines[0];
    const a = { ligne: etape().table!.result!.id, crit: etape().deviation!.crit, label: label() };
    expect(teteTirage(), 'la Blessure du dé posé ne se lit pas en tête').toContain(a.label);

    typeSlowly('20'); // RE-POSE : le dé n'est pas un aller sans retour
    render(); // le store ne repeint qu'au flush suivant sous `act` — on lit l'ÉCRAN à jour
    const b = { ligne: etape().table!.result!.id, label: label() };
    expect(b.ligne, '20 et 76 doivent tomber sur des lignes DIFFÉRENTES, sinon la sonde ne prouve rien').not.toBe(a.ligne);
    expect(teteTirage(), 'la Blessure AFFICHÉE n’a pas suivi la re-pose').toContain(b.label);
    expect(teteTirage(), 'la Blessure de la pose ABANDONNÉE s’affiche encore').not.toContain(a.label);
    expect(boutonTexte('Dévier'), 'les voies ont disparu après la re-pose').toBeDefined();

    typeSlowly('76'); // dé DÉJÀ VU → le mémo de pli le re-sert tel quel
    render();
    expect(etape().table!.result!.id).toBe(a.ligne);
    expect(etape().deviation!.crit, 'MÊME dé, MÊME étape → MÊME Blessure').toEqual(a.crit);
    expect(teteTirage()).toContain(a.label);
  });
});
