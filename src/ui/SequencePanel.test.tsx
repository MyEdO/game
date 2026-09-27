// @vitest-environment jsdom
/**
 * LE TABLEAU DE MARQUE (#1279 S1) — monté POUR DE VRAI dans la fenêtre de manche (`CascadeBody`,
 * patron `CascadeTableMode.test.tsx`) sur une partie de Bras de fer réelle. Mesuré AVANT ce lot : la
 * fenêtre d'une manche ne disait NI le score, NI le rang de manche (les cumuls vivent dans l'état de
 * séquence, que rien ne rendait) — une partie de six manches était aveugle.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from '../state/battleRng';
import { emptyScene } from '../state/scene';
import { CascadeBody } from './CascadeModal';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
const get = useGame.getState.bind(useGame);

function render() {
  act(() => { root.render(<CascadeBody />); });
}

/** Pose le DR de chaque rangée de la manche ouverte, puis la clôt (aucun dé : l'affichage est en cause). */
function poseManche(sl: Record<string, number>): void {
  const pc = get().pendingCascade!;
  const band = pc.participants[0];
  const rows = band.participants!.map((r) => ({
    ...r, result: { roll: 11, target: r.target!, sl: sl[r.id], success: true },
  }));
  act(() => {
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
    get().cascadeNext();
  });
}

/**
 * Pose la manche MONO à jet adverse FIGÉ — le chemin RÉEL d'une partie contre un adversaire de la
 * salle (celui du bug rapporté) : le dé du challenger ET le jet figé de l'adversaire sont posés, puis
 * la manche se clôt. `sl` négatif = Test raté (l'issue du jet suit `roll ≤ target`, comme en jeu).
 */
function poseMancheMono(mien: number, sien: number): void {
  const pc = get().pendingCascade!;
  const step = pc.participants[0];
  const opp = step.meta!.opposed!;
  const res = (sl: number) => ({ roll: sl >= 0 ? 11 : 99, target: step.target ?? 50, sl, success: sl >= 0 });
  act(() => {
    useGame.setState({
      pendingCascade: {
        ...pc,
        participants: [{
          ...step,
          result: res(mien),
          meta: { ...step.meta, opposed: { ...opp, aT: { ...opp.aT, ...res(sien), base: opp.aT.base ?? 40 } } },
        }],
      },
    });
    get().cascadeNext();
  });
}

const board = () => host.querySelector('[data-seq-board]');
const bandeTitre = () => host.querySelector('.creator-band-head h3')?.textContent ?? '';
const compteur = () => host.querySelector('.creator-band-right')?.textContent ?? '';
const texte = () => host.textContent ?? '';

beforeEach(() => {
  seedBattleRng(3);
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, sequence: null } as never);
});

describe('SequencePanel — une partie de Bras de fer n’est plus aveugle', () => {
  function partie(): [Combatant, Combatant] {
    const [a, b] = makePregens().slice(0, 2) as [Combatant, Combatant];
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    return [a, b];
  }

  it('la fenêtre de manche PORTE le score des deux camps, la cible et le rang de manche', () => {
    const [a, b] = partie();
    render();
    expect(board(), 'le tableau de marque est monté dans la fenêtre').not.toBeNull();
    expect(bandeTitre()).toContain('Le bras de fer');
    expect(compteur()).toContain('Manche 1');
    expect(texte(), 'les deux camps sont nommés').toContain(a.label);
    expect(texte()).toContain(b.label);
    expect(texte(), 'cumul sur la cible du Test étendu (l.34)').toContain('0/10 DR');

    poseManche({ [a.id]: 4, [b.id]: 1 });
    render();
    expect(compteur(), 'la manche a avancé').toContain('Manche 2');
    // Le cumul MONTRÉ est celui de l'état de séquence (DR de la manche + Bonus de Force, l.34).
    const cum = get().sequence!.cum as Record<string, number>;
    expect(cum.player).toBeGreaterThan(0);
    expect(texte()).toContain(`${cum.player}/10 DR`);
    expect(texte()).toContain(`${cum.opponent}/10 DR`);
  });

  /**
   * LE TABLEAU PROGRESSE ENTRE DEUX MANCHES — déroulé de recette REJOUÉ : Bras de fer contre un
   * adversaire de la salle, manche 1 GAGNÉE (l'op de manche du vainqueur tire : « porte son Avantage
   * à 1 », `NADJ 16 l.34`), puis lecture de la fenêtre de la manche 2. Le dé est LANCÉ par la porte du
   * jeu (`cascadeRoll`), pas posé : l'issue d'une manche mono passe par l'opposition figée
   * (`opposedCascadeRoll`), et un résultat posé à la main court-circuiterait justement ce chemin.
   * Ce qu'un cumul vers cible doit montrer, c'est le TOTAL de chaque camp APRÈS la manche close
   * (`LDB 12 l.170-179`) — le socle écrit `seq.cum`, le système le rend, la fenêtre suivante le lit.
   */
  it('MANCHE GAGNÉE (dé LANCÉ) : le cumul du vainqueur MONTE, et la fenêtre de la manche 2 le montre', () => {
    seedBattleRng(1);
    const [a] = makePregens().slice(0, 1) as [Combatant];
    a.characteristics.force = 45; // Bonus de Force 4 (l.34) — la partie tient plusieurs manches
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'profil', id: 'halfling' } });
    render();
    expect(texte(), 'au départ, les deux camps sont à zéro').toContain('0/10 DR');

    const step = get().pendingCascade!.participants[0];
    act(() => { get().cascadeRoll(step.id); });
    act(() => { get().cascadeNext(); });
    render();

    const cum = get().sequence!.cum as Record<string, number>;
    expect(get().journal.some((l) => l.includes('Avantage')), 'l’op de manche du VAINQUEUR a tiré : la manche est gagnée').toBe(true);
    expect(cum.player, 'le DR de la manche s’AJOUTE au cumul du challenger').toBeGreaterThan(0);
    expect(compteur(), 'la manche a avancé').toContain('Manche 2');
    expect(texte(), 'la fenêtre de la manche 2 montre le cumul, pas un zéro figé').toContain(`${cum.player}/10 DR`);
    expect(texte(), 'et le camp battu reste planché à 0 (l.174) — le 0/10 lisible à l’écran est le SIEN').toContain(`${cum.opponent}/10 DR`);
  });

  /**
   * MANCHE PERDUE : le cumul du challenger reste à 0 — c'est le RAW, pas un bug (`LDB 12 l.174` : « Si
   * le DR total passe en dessous de 0, recommencez depuis le début », plancher tenu par
   * `extendedTestStep`). Ce que l'écran doit alors rendre LISIBLE, c'est que l'AUTRE camp, lui, a
   * avancé : un tableau où rien ne bouge des deux côtés serait indistinguable d'un moteur en panne.
   */
  it('MANCHE PERDUE : le challenger reste à 0/10 (plancher RAW) — et le camp adverse, lui, PROGRESSE', () => {
    const [a] = makePregens().slice(0, 1) as [Combatant];
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    poseMancheMono(-4, 2); // Test raté : −4 DR ; l'adversaire prend sa manche
    render();
    const cum = get().sequence!.cum as Record<string, number>;
    expect(cum.player, 'le total ne descend jamais sous 0 (l.174)').toBe(0);
    expect(cum.opponent, 'le camp d’en face cumule le sien').toBeGreaterThan(0);
    expect(texte()).toContain('0/10 DR');
    expect(texte(), 'l’écran DIT que la partie avance : le camp adverse monte').toContain(`${cum.opponent}/10 DR`);
  });

  /**
   * L'ATTRIBUTION SE LIT — contre un adversaire À FICHE (entité de SCÈNE, chemin BANDE), l'écran et le
   * journal doivent nommer le MÊME camp. Mesuré AVANT : le tableau disait « Négociant (test) 0/10 DR »
   * pendant que le journal disait « Force : −4 DR. » (le porteur d'une rangée était résolu par
   * l'accesseur du COMBAT, aveugle aux PNJ de scène, et retombait sur le libellé de son TEST) — deux
   * noms pour un camp, et un cumul de vainqueur attribué au perdant à la lecture.
   */
  it('ATTRIBUTION : adversaire à FICHE — l’écran et le journal nomment le MÊME camp', () => {
    seedBattleRng(3);
    const [a] = makePregens().slice(0, 1) as [Combatant];
    const negociant = {
      id: 'negociant', kind: 'personnage' as const, pos: { x: 2, y: 2 }, label: 'Négociant (test)',
      statblock: {
        type: 'statblock' as const,
        label: 'Négociant (test)',
        char: {
          'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30,
          agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
        },
        skills: [{ id: 'pari', value: 40 }],
      },
      tavernGame: { gameId: 'bras-de-fer' },
    };
    useGame.setState({
      party: [a], journal: [],
      scene: { ...emptyScene(), entities: [negociant] },
      battle: null, sequence: null, pendingCascade: null,
    });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'npc', id: 'negociant' } });

    const pc = get().pendingCascade!;
    const band = pc.participants[0];
    const rows = band.participants!.map((r) => ({
      ...r, result: { roll: 11, target: r.target!, sl: r.id === a.id ? 6 : -4, success: r.id === a.id },
    }));
    act(() => {
      useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
      get().cascadeNext();
    });
    render();

    const cum = get().sequence!.cum as Record<string, number>;
    const journal = get().journal.join('\n');
    expect(cum.player, 'le vainqueur cumule (DR de manche + Bonus de Force, l.34)').toBeGreaterThan(0);
    expect(cum.opponent, 'le battu reste planché à 0 (l.174)').toBe(0);
    expect(texte(), 'la jauge du challenger porte SON cumul').toContain(`${a.label}`);
    expect(texte()).toContain(`${cum.player}/10 DR`);
    expect(texte(), 'et celle de l’adversaire, le sien').toContain('Négociant (test)');
    expect(journal, 'le journal nomme l’adversaire comme l’écran — jamais son Test à sa place').toContain('Négociant (test) : -4 DR.');
    expect(journal).toContain(`${a.label} : +6 DR.`);
  });

  it('aucune séquence en cours : aucun tableau de marque (la fenêtre n’invente pas de score)', () => {
    const [a] = makePregens().slice(0, 1) as [Combatant];
    useGame.setState({ party: [a] });
    // Dominos contre la salle : une manche UNIQUE sans cible de cumul — rien à suivre d'une manche à
    // l'autre (un jeu de LANCERS, lui, a un passage en cours à montrer : il porte un tableau).
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    render();
    expect(get().pendingCascade, 'la fenêtre de manche est bien ouverte').not.toBeNull();
    expect(board()).toBeNull();
  });

  /** JEU D'ÉQUIPE (Middenball l.121) : le tableau de marque dit les BUTS de chaque camp et, en note,
   *  la SOMME de DR du dernier tour — celle qui décide le but. Le panneau ne dérive rien : ces deux
   *  grandeurs viennent du `board` du système. */
  it('Middenball : le tableau de marque porte le score PAR ÉQUIPE (buts) et la somme du tour', () => {
    const party = makePregens().slice(0, 2) as Combatant[];
    useGame.setState({ party });
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    // Un tour joué : options tranchées, puis 11 rangées à 3 DR contre 11 à 1 DR.
    for (let i = 0; i < 4; i++) {
      const cur = get().pendingCascade?.participants[get().pendingCascade!.cursor];
      if (!cur || cur.kind !== 'tavern-option') break;
      act(() => { get().cascadeChoose(cur.id, '0'); get().cascadeNext(); });
    }
    const pc = get().pendingCascade!;
    const idx = pc.participants.findIndex((s) => s.kind === 'tavern-round');
    const band = pc.participants[idx];
    const rows = band.participants!.map((r) => ({
      ...r, result: { roll: 11, target: r.target!, sl: r.id.startsWith('figurant-o-') ? 1 : 3, success: true },
    }));
    const participants = [...pc.participants];
    participants[idx] = { ...band, participants: rows };
    act(() => {
      useGame.setState({ pendingCascade: { ...pc, participants, cursor: idx } });
      get().cascadeNext();
    });
    render();

    expect(board(), 'le tableau de marque est monté').not.toBeNull();
    expect(bandeTitre()).toContain('Middenball');
    expect(compteur(), 'six tours, deux mi-temps').toContain('Manche 2/6');
    expect(compteur()).toContain('phase 1/2');
    expect(texte()).toContain('Votre équipe');
    expect(texte(), 'la SOMME du tour est dite en note').toContain('33 DR au dernier tour');
    expect(texte()).toContain('11 DR au dernier tour');
    const buts = [...host.querySelectorAll('[data-seq-score] b')].map((n) => n.textContent);
    expect(buts, 'un but pour le camp qui a dépassé 25, aucun pour l’autre').toEqual(['1', '0']);
  });
});
