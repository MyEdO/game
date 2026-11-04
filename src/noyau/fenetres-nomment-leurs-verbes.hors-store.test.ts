/**
 * CHAQUE FENÊTRE NOMME CE QU'ON Y JOUE (#2898, #2928) : toute fenêtre que `fenetreDuJeu` peut rendre (`FENETRES`,
 * `fenetres.testkit.ts`) déclare au moins un verbe, et chacun est une action de la partie, nommée en mots du joueur
 * (`libelleDuGeste`). Une fenêtre sans verbe de joueur le déclare dans sa définition (`AUCUN_VERBE_DE_JOUEUR`), et le
 * test la nomme. Une fenêtre dont les verbes désignent une rangée par son id (flux de jet multi, verbes d'étape)
 * déclare de quoi rendre ce `pid`. Chaque fenêtre a son titre (`libelleDeLaFenetre`), et chaque réglage d'un flux de
 * jet (`<flux>Set…`) est le verbe d'une fenêtre : aucun ne se joue hors de celle qui le dessine.
 */
import { describe, it, expect } from 'vitest';
import type { Jeu } from './index';
import { AUCUN_VERBE_DE_JOUEUR } from './modalArbiter';
import { cleDuGeste } from './modalArbiter';
import { fenetreDuJeu } from './combatAuto';
import { FLOW_VERBS } from './flowVerbs';
import { libelleDeLaFenetre, libelleDuGeste } from './libelles';
import type { CascadeStep } from './pendings';
import { cleDeFixture } from './noyau.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { CLES_DES_FENETRES, ETAT, fenetresDuJeu, MODALES, VERBES_DES_FENETRES, type Fenetre } from './fenetres.testkit';

/** Une étape témoin à rangées : de quoi lire le `pid` de chaque interaction. */
const ETAPE_TEMOIN: CascadeStep = { id: 'etape', kind: cleDeFixture('note'), label: fixtureText('etape'), participants: [{ id: 'rangee', interactive: true, base: 0, target: 0, difficulty: 'intermediaire', result: null }] };
const FENETRES = fenetresDuJeu(ETAPE_TEMOIN);

/** Ce qui manque à la fenêtre : un geste, une action de la partie derrière chacun, son libellé (`libelleDuGeste`). */
function fautes(f: Fenetre): string[] {
  const aucunDeclare = f.declaree === AUCUN_VERBE_DE_JOUEUR;
  return [
    ...(f.gestes.length === 0 && !aucunDeclare ? ['aucun verbe déclaré (`verbes`, `flux`, `drive`, `intents`) ni `AUCUN_VERBE_DE_JOUEUR`'] : []),
    ...(aucunDeclare && f.gestes.length ? [`déclarée sans verbe de joueur, elle en nomme : ${f.gestes.map(cleDuGeste).join(', ')}`] : []),
    ...f.gestes.filter((g) => typeof Reflect.get(ETAT, g.verbe) !== 'function').map((g) => `« ${g.verbe} » n'est pas une action de la partie`),
    ...f.gestes.filter((g) => libelleDuGeste(g) === null).map((g) => `« ${cleDuGeste(g)} » n'a pas de libellé (\`verbe.${g.flux ? `${g.flux}.` : ''}${g.verbe}\` ni \`verbe.${g.verbe}\`)`),
    ...(f.pid ? [] : ['ses verbes désignent une rangée par son id, et la fenêtre ne déclare pas de quoi rendre ce `pid` (`rangees`)']),
  ];
}

describe('chaque fenêtre que `fenetreDuJeu` peut rendre nomme ses verbes', () => {
  it('le relevé couvre les deux registres et la cascade', () => {
    expect(MODALES.length, 'témoin : les modales du registre').toBeGreaterThan(20);
    expect(FENETRES.some((f) => f.nom === 'hors modale victory') && FENETRES.some((f) => f.nom === 'cascade, interaction choix')).toBe(true);
  });

  it.each(FENETRES.map((f) => [f.declaree === AUCUN_VERBE_DE_JOUEUR ? `${f.nom} (aucun verbe de joueur, déclaré)` : f.nom, f] as const))('%s', (_nom, f) => {
    expect(fautes(f), f.nom).toEqual([]);
  });

  it('chaque fenêtre a son titre (`libelleDeLaFenetre`)', () => {
    expect([...CLES_DES_FENETRES].filter((cle) => libelleDeLaFenetre(cle) === null), 'clé sans `fenetre.<clé>`').toEqual([]);
  });

  it('chaque réglage d’un flux de jet (`<flux>Set…`) est le verbe d’une fenêtre', () => {
    const prefixes = Object.keys(FLOW_VERBS);
    const reglages = Object.keys(ETAT).filter((v) => typeof Reflect.get(ETAT, v) === 'function' && prefixes.some((p) => new RegExp(`^${p}Set[A-Z]`).test(v)));
    expect(reglages.length, 'témoin : les réglages des flux de la partie').toBeGreaterThan(20);
    expect(reglages.filter((v) => !VERBES_DES_FENETRES.has(v)), 'réglage qu’aucune fenêtre ne déclare').toEqual([]);
  });

  it('`fenetreDuJeu` rend les gestes déclarés : le Sauvetage par Destin, la porte de départ de nuit', () => {
    const destin = fenetreDuJeu({ ...ETAT, pendingFateSave: { heroId: 'h1' } } as unknown as Jeu);
    expect(destin).toMatchObject({ cle: 'fateSave', proprietaire: 'h1' });
    expect(destin!.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['fateNegate', 'fateSurvive', 'fateAccept']));
    const depart = fenetreDuJeu({ ...ETAT, pendingDeparture: { mode: 'pied', cause: 'nuit', dawnAt: 0 } } as unknown as Jeu);
    expect(depart).toMatchObject({ cle: 'departure', gestes: [{ verbe: 'departWaitDawn' }, { verbe: 'departCancel' }] });
  });

  it('`fenetreDuJeu` rend le `pid` de la rangée due : la chute à deux tombants, l’étape-bande de cascade', () => {
    const tombants = [{ id: 't1', interactive: true, attempt: false, result: { chute: 1 } }, { id: 't2', interactive: true, attempt: null, result: null }];
    const chute = fenetreDuJeu({ ...ETAT, pendingFall: { initiateurId: 't1', participants: tombants } } as unknown as Jeu);
    expect(chute).toMatchObject({ cle: 'fall', pid: 't2' });
    expect(chute!.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['jetRoll@fall', 'fallChoose', 'fallConfirm']));
    const bande = fenetreDuJeu({ ...ETAT, pendingCascade: { title: 'Témoin', purpose: 'test', cursor: 0, log: [], seq: 1, participants: [ETAPE_TEMOIN] } });
    expect(bande).toMatchObject({ cle: 'cascade', pid: 'rangee' });
    expect(bande!.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['jetRoll@cascadeBatch', 'cascadeNext']));
  });
});
