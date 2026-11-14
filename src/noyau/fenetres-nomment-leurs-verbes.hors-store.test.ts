/**
 * CHAQUE FENÊTRE NOMME CE QU'ON Y JOUE (#2898, #2928) : toute fenêtre que `fenetreDuJeu` peut rendre (`FENETRES`,
 * `fenetres.testkit.ts`) déclare au moins un verbe, et chacun est une action de la partie, nommée en mots du joueur
 * (`libelleDuGeste`). Une fenêtre sans verbe de joueur le déclare dans sa définition (`AUCUN_VERBE_DE_JOUEUR`), et le
 * test la nomme. Une fenêtre dont les verbes désignent une rangée par son id (flux de jet multi, verbes d'étape)
 * déclare de quoi rendre ce `pid`. Une surface partagée qui se ferme (`SURFACES_A_SORTIE`) en est une, sa sortie pour
 * verbe. Chaque fenêtre a son titre (`libelleDeLaFenetre`), et chaque réglage d'un flux de
 * jet (`REGLAGES_DU_JET`) et chaque choix d'une fenêtre (`CHOIX_DES_FENETRES`) est un geste d'une fenêtre, ou de la
 * conversation qui dessine ses réponses (`conversationEnVue`) : aucun ne se joue hors de celle qui le dessine.
 */
import { describe, it, expect } from 'vitest';
import type { Jeu } from './index';
import { AUCUN_VERBE_DE_JOUEUR } from './modalArbiter';
import { cleDuGeste } from './modalArbiter';
import { fenetreDuJeu } from './combatAuto';
import { REGLAGES_DU_JET } from './reglagesDuJet';
import { CHOIX_DES_FENETRES } from './choixDesFenetres';
import { conversationEnVue } from './dialogue';
import { libelleDeLaFenetre, libelleDuGeste } from './libelles';
import type { CascadeStep } from './pendings';
import { cleDeFixture } from './noyau.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { CLES_DES_FENETRES, ETAT, fenetresDuJeu, MODALES, type Fenetre } from './fenetres.testkit';

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
    ...f.gestes.filter((g) => libelleDuGeste(g) === null).map((g) => `« ${cleDuGeste(g)} » n'a pas de libellé (\`${g.fenetre ? `verbe.${g.fenetre}.fermer` : `verbe.${g.flux ? `${g.flux}.` : ''}${g.verbe}\` ni \`verbe.${g.verbe}`}\`)`),
    ...(f.pid ? [] : ['ses verbes désignent une rangée par son id, et la fenêtre ne déclare pas de quoi rendre ce `pid` (`rangees`)']),
  ];
}

describe('chaque fenêtre que `fenetreDuJeu` peut rendre nomme ses verbes', () => {
  it('le relevé couvre les deux registres et la cascade', () => {
    expect(MODALES.length, 'témoin : les modales du registre').toBeGreaterThan(20);
    expect(FENETRES.some((f) => f.nom === 'hors modale victoire') && FENETRES.some((f) => f.nom === 'cascade, interaction choix')).toBe(true);
  });

  it.each(FENETRES.map((f) => [f.declaree === AUCUN_VERBE_DE_JOUEUR ? `${f.nom} (aucun verbe de joueur, déclaré)` : f.nom, f] as const))('%s', (_nom, f) => {
    expect(fautes(f), f.nom).toEqual([]);
  });

  it('chaque fenêtre a son titre (`libelleDeLaFenetre`)', () => {
    expect(CLES_DES_FENETRES.filter((cle) => libelleDeLaFenetre(cle) === null), 'clé sans `fenetre.<clé>`').toEqual([]);
  });

  it('chaque réglage d’un flux de jet (`REGLAGES_DU_JET`) est un geste d’une fenêtre', () => {
    const declares = Object.entries(REGLAGES_DU_JET).flatMap(([flux, reglages]) => Object.keys(reglages).map((reglage) => `jetRegler@${flux}#${reglage}`));
    const gestes = new Set(FENETRES.flatMap((f) => f.gestes.map(cleDuGeste)));
    expect(declares.length, 'témoin : les réglages des flux de la partie').toBeGreaterThan(25);
    expect(declares.filter((cle) => !gestes.has(cle)), 'réglage qu’aucune fenêtre ne déclare').toEqual([]);
  });

  it('chaque choix d’une fenêtre (`CHOIX_DES_FENETRES`) est un geste de cette fenêtre', () => {
    const declares = Object.entries(CHOIX_DES_FENETRES).flatMap(([fenetre, axes]) => Object.keys(axes).map((axe) => `fenetreChoisir@${fenetre}#${axe}`));
    // La conversation, surface qui ne tient pas la main, dessine ses réponses hors de `fenetreDuJeu` (`conversationEnVue`).
    const conversation = conversationEnVue({ ...ETAT, dialogue: { dialogue: { id: 'd', start: { id: 'n1' }, nodes: [{ id: 'n1', choices: [{ id: 'r1', label: 'Oui' }] }] }, nodeId: 'n1', session: 1 } } as unknown as Jeu);
    const reponses = (conversation?.reponses ?? []).map(({ geste: { verbe, args: [fenetre, axe] } }) => `${verbe}@${fenetre}#${axe}`);
    expect(reponses, 'témoin : la réponse de la conversation').toHaveLength(1);
    const gestes = new Set([...FENETRES.flatMap((f) => f.gestes.map(cleDuGeste)), ...reponses]);
    expect(declares.length, 'témoin : les choix des fenêtres de la partie').toBeGreaterThan(7);
    expect(declares.filter((cle) => !gestes.has(cle)), 'choix qu’aucune fenêtre ne déclare').toEqual([]);
  });

  it('`fenetreDuJeu` rend les gestes déclarés : le Sauvetage par Destin, la porte de départ de nuit, la défaite, le repli, l’anéantissement', () => {
    const destin = fenetreDuJeu({ ...ETAT, pendingFateSave: { heroId: 'h1' } } as unknown as Jeu);
    expect(destin).toMatchObject({ cle: 'destin', proprietaire: 'h1' });
    expect(destin!.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['fenetreChoisir@destin#issue']));
    const depart = fenetreDuJeu({ ...ETAT, pendingDeparture: { mode: 'pied', cause: 'nuit', dawnAt: 0 } } as unknown as Jeu);
    expect(depart).toMatchObject({ cle: 'depart', gestes: [{ verbe: 'fenetreValider', fenetre: 'depart' }, { verbe: 'fenetreFermer', fenetre: 'depart' }] });
    const defaite = fenetreDuJeu({ ...ETAT, mode: 'battle', battle: { over: 'defaite' } } as unknown as Jeu);
    expect(defaite).toMatchObject({ cle: 'defaite', gestes: [{ verbe: 'fenetreFermer', fenetre: 'defaite' }] });
    const repli = fenetreDuJeu({ ...ETAT, mode: 'battle', battle: { over: 'defaite' }, massBattle: { combatScene: { sceneId: 'duel' } } } as unknown as Jeu);
    expect(repli, 'dans le combat d’une bataille de masse, le repli').toMatchObject({ cle: 'repli', gestes: [{ verbe: 'fenetreFermer', fenetre: 'repli' }] });
    expect(fenetreDuJeu({ ...ETAT, partyWiped: true } as unknown as Jeu), 'hors combat, l’anéantissement').toMatchObject({ cle: 'aneantissement' });
  });

  it('`fenetreDuJeu` rend le `pid` de la rangée due : la chute à deux tombants, l’étape-bande de cascade', () => {
    const tombants = [{ id: 't1', interactive: true, attempt: false, result: { chute: 1 } }, { id: 't2', interactive: true, attempt: null, result: null }];
    const chute = fenetreDuJeu({ ...ETAT, pendingFall: { initiateurId: 't1', participants: tombants } } as unknown as Jeu);
    expect(chute).toMatchObject({ cle: 'chute', pid: 't2' });
    expect(chute!.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['jetLancer@chute', 'jetRegler@chute#tenter', 'jetValider@chute']));
    const bande = fenetreDuJeu({ ...ETAT, pendingCascade: { title: 'Témoin', purpose: 'test', cursor: 0, log: [], seq: 1, participants: [ETAPE_TEMOIN] } });
    expect(bande).toMatchObject({ cle: 'cascade', pid: 'rangee' });
    expect(bande!.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['jetLancer@cascadeEnBande', 'jetValider@cascade']));
  });
});
