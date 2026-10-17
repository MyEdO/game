// @vitest-environment jsdom
/**
 * LIGNE DE TITRE et SOUS-TITRE d'une fenêtre de cascade (zone Z1), mesurés à l'ÉCRAN (montage réel
 * de `CascadeBody`, patron `createRoot`/`act` du repo).
 *
 * Partage des rôles (#1078 LOT B2, puis arbitrage user 2026-08-06 #1117) : le TITRE porte le libellé
 * du pas COURANT — il suit le curseur, la séquence n'écrivant son `title` qu'à sa création
 * (`pushStep`) — et le renvoi de règle accolé à ce libellé ; le SOUS-TITRE (`stepSubtitle`, source
 * unique des six branches) ne porte que la POSITION. Chaque information a UNE surface : jamais deux
 * tuiles pour la même phrase (double rendu de classe #352).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { CascadeBody } from './CascadeModal';
import { dieStep } from '../state/rollSeam';
import { fixtureText } from '../i18n/fixtureText';
import type { CascadeStep } from '../state/pendings';
import { cascadeDeTest } from '../state/cascadeTestKit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

const HERO = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 1 });

/** Ouvre une séquence à UNE étape, le titre de la fenêtre étant fourni par l'appelant. */
function openStep(title: string, step: (heroId: string) => CascadeStep) {
  return openSteps(title, (id) => [step(id)], 0);
}

/** Ouvre une séquence à N étapes, curseur posé — sert à mesurer le COMPTEUR de la branche jet. */
function openSteps(title: string, steps: (heroId: string) => CascadeStep[], cursor: number) {
  const hero = HERO();
  useGame.setState({
    battle: null, party: [hero], suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCascade: cascadeDeTest(steps(hero.id), { title, icon: 'nav/dice', purpose: 'affichage', cursor }),
  });
  return hero;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, party: [], suspendedCascades: [] });
});

const render = () => act(() => { root.render(<CascadeBody />); });
/** Ce qu'un joueur LIT dans la fenêtre, espaces normalisés. */
const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');
/** Combien de fois la phrase se lit dans la fenêtre. */
const occurrences = (needle: string) => (screen().match(new RegExp(needle, 'g')) ?? []).length;
/** Le TITRE de la fenêtre, tel qu'il se lit dans l'en-tête de la modale (`Modal` → `<h3>`). */
const titleText = () => (host.querySelector('h3')?.textContent ?? '').replace(/\s+/g, ' ').trim();

const LIBELLE = 'Gueule de bois';

/** Le SOUS-TITRE de la fenêtre (`RollShell` → `.rm-subtitle`), absent quand il n'y a rien à situer. */
const subtitleEl = () => host.querySelector('.rm-subtitle');
const subtitleText = () => (subtitleEl()?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Pas-jet ordinaire, servant de 1ᵉʳ pas pour qu'une séquence ait DEUX étapes (donc un compteur). */
const jetStep = (id: string, actorId: string, label: string): CascadeStep =>
  ({ id, kind: 'tally', actorId, label, rollLabel: 'Résistance', base: 40, target: 40, result: null, interactive: true } as unknown as CascadeStep);

describe('sous-titre d’étape — il porte la POSITION, jamais le libellé', () => {
  /** Le libellé du pas courant se lit UNE fois, dans le TITRE ; le sous-titre ne dit que la position. */
  const attendu = (compteur: string, surfaces = 1) => {
    expect(occurrences(LIBELLE)).toBe(surfaces);
    expect(titleText(), 'c’est le TITRE qui porte le libellé du pas courant').toContain(LIBELLE);
    expect(subtitleText(), 'le sous-titre ne redit pas le libellé').toBe(compteur);
    expect(subtitleEl()?.querySelector('.ab-codex-info'), 'le renvoi de règle vit sur la ligne de titre').toBeFalsy();
  };

  it('branche CHOIX : titre = libellé du pas, sous-titre = « 2/2 »', () => {
    openSteps('Nuit à l’auberge', (id) => [jetStep('a', id, 'Veille'), {
      id: 'c1', kind: 'choix', label: LIBELLE, interactive: true,
      options: [{ key: 'boire', label: 'Boire' }, { key: 'dormir', label: 'Dormir' }],
    } as unknown as CascadeStep], 1);
    render();
    attendu('2/2', 2);
  });

  it('branche BATCH : titre = libellé du pas, sous-titre = « 2/2 »', () => {
    openSteps('Nuit à l’auberge', (id) => [jetStep('a', id, 'Veille'), {
      id: 'b1', kind: 'batch', label: LIBELLE, interactive: true,
      participants: [{ id, label: 'Résistance', interactive: true, base: 40, target: 40, result: null }],
    } as unknown as CascadeStep], 1);
    render();
    attendu('2/2');
  });

  it('branche JET : titre = libellé du pas, sous-titre = « jet 2/2 » (jets de dé RÉELS)', () => {
    openSteps('Nuit à l’auberge', (id) => [jetStep('a', id, 'Veille'), jetStep('b', id, LIBELLE)], 1);
    render();
    attendu('jet 2/2');
  });

  it('séquence à UNE étape : aucun sous-titre (rien à situer, pas de bande vide)', () => {
    openStep('Nuit à l’auberge', (id) => ({
      id: 'j1', kind: 'tally', actorId: id, label: LIBELLE, rollLabel: 'Résistance',
      base: 40, target: 40, result: null, interactive: true,
    } as unknown as CascadeStep));
    render();
    expect(occurrences(LIBELLE)).toBe(1);
    expect(titleText()).toContain(LIBELLE);
    expect(subtitleEl()).toBeNull();
    expect(occurrences('Nuit à l’auberge'), 'la fenêtre est titrée par le pas JOUÉ').toBe(0);
  });

  /**
   * Branche DÉ (#1508) : une étape à dé NU n'a pas de portrait avant le lancer, son PORTEUR entre donc
   * en Z1 (`stepSubtitle(count, porteur)`). L'arbitrage #1117 y vaut comme ailleurs : Z1 dit POUR QUI
   * le dé tombe et OÙ l'on en est — jamais ce qu'on joue, que le TITRE porte.
   */
  const pasDeDe = (id: string, actorId: string, label: string): CascadeStep => dieStep({
    id, kind: 'uiDieSpy', actorId, label: fixtureText(label), icon: 'journal/critical',
    spec: { n: 1, sides: 10 }, seuil: { indice: 6, source: { kind: 'trait', id: 'protection' }, dome: true },
  })!;

  it('branche DÉ : sous-titre = « porteur — 2/2 », puis le porteur SEUL à une étape', () => {
    openSteps('Défense', (id) => [jetStep('a', id, 'Veille'), pasDeDe('sv', id, 'Sauvegarde')], 1);
    render();
    expect(subtitleText(), 'POUR QUI le dé tombe, et où l’on en est').toBe('Gunnar — 2/2');
    expect(subtitleText(), 'le sous-titre ne redit pas le libellé du pas').not.toContain('Sauvegarde');
    expect(titleText(), 'c’est le TITRE qui porte le libellé du pas courant').toContain('Sauvegarde');

    // Séquence à UNE étape : plus rien à situer, Z1 ne garde que le porteur.
    act(() => { openSteps('Défense', (id) => [pasDeDe('sv', id, 'Sauvegarde')], 0); });
    render();
    expect(subtitleText(), 'rien à situer : le porteur seul').toBe('Gunnar');
    expect(subtitleText(), 'toujours pas le libellé du pas').not.toContain('Sauvegarde');
  });
});

/**
 * POSITION du renvoi de règle (arbitrage user 2026-08-06 : « Je pensais que tu allais mettre un "i"
 * a coté de "Cauchemars" ») : le déclencheur-icône est accolé au libellé du pas — donc sur la ligne
 * de TITRE, qui le porte. Le déclencheur lui-même (patron `CodexRef`) est mesuré dans
 * `StakeNote.test.tsx`.
 */
describe('renvoi de règle — accolé au libellé du pas, sur la ligne de titre', () => {
  it('le titre porte le déclencheur-icône, NOMMÉ par la FICHE qu’il ouvre', () => {
    openStep('Nuit à l’auberge', (id) => ({
      id: 'j1', kind: 'tally', actorId: id, label: 'Cauchemars', rollLabel: 'Résistance',
      stakeRule: { category: 'regles', id: 'trauma' },
      base: 40, target: 40, result: null, interactive: true,
    } as unknown as CascadeStep));
    render();
    const h3 = host.querySelector('h3')!;
    expect(h3.textContent).toContain('Cauchemars');
    expect(h3.querySelector('.ab-codex-info')).toBeTruthy();
    // Le pas s'appelle « Cauchemars », la fiche visée est « Trauma » : le ⓘ annonce la CIBLE, pas son
    // voisinage — sans quoi il promet une fiche qui n'existe pas (#1657 B3-2b-b).
    expect(h3.querySelector('.ab-codex-info')!.getAttribute('aria-label')).toBe('Règle : Trauma');
  });

  it('pas SANS foyer de règle : le titre reste NU (aucune icône morte)', () => {
    openStep('Nuit à l’auberge', (id) => ({
      id: 'j1', kind: 'tally', actorId: id, label: 'Cauchemars', rollLabel: 'Résistance',
      base: 40, target: 40, result: null, interactive: true,
    } as unknown as CascadeStep));
    render();
    expect(host.querySelector('h3')!.textContent).toContain('Cauchemars');
    expect(host.querySelector('h3')!.querySelector('.ab-codex-info')).toBeNull();
  });
});

/**
 * COMPTEUR de la branche JET (arbitrage user 2026-07-11) : « jet N/M » compte les JETS DE DÉ RÉELS,
 * pas les étapes — un pas BATCH vaut ses N rangées, un pas d'affichage/agrégation vaut 0. N = les
 * jets déjà passés + celui-ci. (Le rang d'étape « n/m » nu reste celui des autres branches.)
 */
describe('sous-titre de la branche JET — compteur en JETS DE DÉ', () => {
  const jetStep = (id: string, actorId: string): CascadeStep =>
    ({ id, kind: 'tally', actorId, label: `Étape ${id}`, rollLabel: 'Résistance', base: 40, target: 40, result: null, interactive: true } as unknown as CascadeStep);

  it('deux pas-jet : le premier annonce « jet 1/2 », le second « jet 2/2 »', () => {
    openSteps('Nuit à l’auberge', (id) => [jetStep('a', id), jetStep('b', id)], 0);
    render();
    expect(screen()).toContain('jet 1/2');
    act(() => { useGame.setState({ pendingCascade: { ...useGame.getState().pendingCascade!, cursor: 1 } }); });
    expect(screen()).toContain('jet 2/2');
  });

  it('un pas BATCH de 3 rangées compte 3 jets : le pas-jet suivant annonce « jet 4/4 »', () => {
    openSteps('Traversée', (id) => [
      { id: 'batch', kind: 'weatherResistance', label: 'Traversée — Blizzard', interactive: true,
        participants: [1, 2, 3].map((n) => ({ id, label: `Rôle ${n}`, interactive: true, base: 40, target: 40, result: null })) } as unknown as CascadeStep,
      jetStep('j', id),
    ], 1);
    render();
    expect(screen()).toContain('jet 4/4');
  });

  it('séquence à UN seul jet : aucun compteur (rien à situer)', () => {
    openSteps('Nuit à l’auberge', (id) => [jetStep('a', id)], 0);
    render();
    expect(screen()).not.toContain('jet 1/1');
  });
});

/**
 * TITRE de la fenêtre = le pas COURANT (arbitrage user 2026-08-06, #1117). Une séquence APPEND
 * (`pushStep`, `state/cascade.ts`) et n'écrit son `title` qu'à la CRÉATION : sans dérivation AU RENDU,
 * la fenêtre resterait titrée par le PREMIER pas pendant qu'on en joue un autre (recette : cascade
 * « Défense » alors que le joueur joue « Approche menaçante · jet 2/2 »). Mesuré à l'ÉCRAN, sur
 * plusieurs FORMES de pas (jet, choix, batch) et avec le curseur qui avance.
 */
describe('titre de la fenêtre — il suit le pas COURANT', () => {
  it('deux pas-jet de libellés différents : le titre change avec le curseur', () => {
    openSteps('Défense', (id) => [jetStep('a', id, 'Défense'), jetStep('b', id, 'Approche menaçante')], 0);
    render();
    expect(titleText()).toContain('Défense');
    act(() => { useGame.setState({ pendingCascade: { ...useGame.getState().pendingCascade!, cursor: 1 } }); });
    expect(titleText()).toContain('Approche menaçante');
    expect(titleText(), 'le libellé du 1ᵉʳ pas ne titre plus la fenêtre').not.toContain('Défense');
    expect(screen(), 'la position reste au sous-titre').toContain('jet 2/2');
  });

  it('pas de CHOIX en 2ᵉ position : son libellé titre la fenêtre', () => {
    openSteps('Défense', (id) => [jetStep('a', id, 'Défense'), {
      id: 'c1', kind: 'choix', label: 'Piège à lame', interactive: true,
      options: [{ key: 'oui', label: 'Refermer' }, { key: 'non', label: 'Laisser' }],
    } as unknown as CascadeStep], 1);
    render();
    expect(titleText()).toContain('Piège à lame');
  });

  it('pas BATCH en 2ᵉ position : son libellé titre la fenêtre', () => {
    openSteps('Défense', (id) => [jetStep('a', id, 'Défense'), {
      id: 'b1', kind: 'batch', label: 'Traversée — Blizzard', interactive: true,
      participants: [{ id, label: 'Résistance', interactive: true, base: 40, target: 40, result: null }],
    } as unknown as CascadeStep], 1);
    render();
    expect(titleText()).toContain('Traversée — Blizzard');
  });

  it('pas SANS libellé : repli sur le titre de la séquence', () => {
    openSteps('Nuit à l’auberge', (id) => [
      ({ id: 'a', kind: 'tally', actorId: id, rollLabel: 'Résistance', base: 40, target: 40, result: null, interactive: true } as unknown as CascadeStep),
    ], 0);
    render();
    expect(titleText()).toContain('Nuit à l’auberge');
  });
});

/**
 * BILAN de fin de séquence (curseur EN FIN, aucun pas courant) — arbitrage user 2026-08-06 (#1117) :
 * « Neutre "Bilan" ». Le récap couvre TOUS les pas : il ne porte le nom d'AUCUN d'entre eux, et le
 * compte de jets reste au sous-titre.
 */
describe('bilan de cascade — titre NEUTRE', () => {
  it('séquence jouée jusqu’au bout : le récap est titré « Bilan », pas du nom d’un pas', () => {
    openSteps('Défense', (id) => [jetStep('a', id, 'Défense'), jetStep('b', id, 'Approche menaçante')], 0);
    render();
    act(() => {
      const p = useGame.getState().pendingCascade!;
      useGame.setState({ pendingCascade: { ...p, cursor: p.participants.length } });
    });
    expect(titleText()).toBe('Bilan');
    expect(titleText(), 'le titre de séquence ne titre pas le récap').not.toContain('Défense');
    expect(titleText()).not.toContain('Approche menaçante');
    expect(subtitleText(), 'le compte de jets, sans redire le titre').toBe('2 jets');
  });
});
