/**
 * CHAQUE FENÊTRE NOMME CE QU'ON Y JOUE (#2898) : toute fenêtre que `fenetreDuJeu` peut rendre — chaque modale
 * (`MODAL_DEFS`), chaque situation `HORS_MODAL` qui tient la main et, pour la cascade (politique `partial`, ses verbes
 * sont ceux de l'étape courante), chaque étape-jet de combat (`JET_AUTO`) et chaque interaction
 * (`VERBES_D_INTERACTION`) — déclare au moins un verbe, et chacun est une action de la partie. Une fenêtre sans verbe
 * de joueur le déclare dans sa définition (`AUCUN_VERBE_DE_JOUEUR`), et le test la nomme. Une fenêtre dont les verbes
 * désignent une rangée par son id (flux de jet multi, verbes d'étape) déclare de quoi rendre ce `pid`.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type Jeu } from './index';
import { MODAL_DEFS, HORS_MODAL, AUCUN_VERBE_DE_JOUEUR, type HorsModalDef, type ModalDef, type VerbesDeFenetre } from './modalArbiter';
import { FENETRE_DU_JET, JET_AUTO, VERBES_D_INTERACTION, fenetreDuJeu, verbesDeLaFenetre, verbesDuJet } from './combatAuto';
import type { CascadeStep } from './pendings';
import { FLOW_VERBS, type FlowKey } from './flowVerbs';
import { cleDeFixture } from './noyau.testkit';
import { fixtureText } from '../i18n/fixtureText';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
const ETAT = creerPartie(etatInitialDuJeu(), ENTREES).etat();

/** `pid` : la fenêtre a-t-elle de quoi rendre l'id que ses verbes prennent en premier argument, quand il en faut un ? */
interface Fenetre { nom: string; verbes: readonly string[]; declaree?: VerbesDeFenetre; pid: boolean }

/** Une étape témoin à rangées : de quoi lire le `pid` de chaque interaction. */
const ETAPE_TEMOIN: CascadeStep = { id: 'etape', kind: cleDeFixture('note'), label: fixtureText('etape'), participants: [{ id: 'rangee', interactive: true, base: 0, target: 0, result: null }] };
/** Le flux de jet `cle` désigne-t-il ses rangées par leur id (flux multi : premier argument `pid`) ? */
const fluxAPid = (cle: FlowKey): boolean => FLOW_VERBS[cle].kind === 'multi';
const multi = (def: ModalDef | HorsModalDef): boolean => (def.flux ?? []).some(fluxAPid);

const modales = (MODAL_DEFS as readonly ModalDef[]).filter((d) => d.auto.mode !== 'partial');
const FENETRES: readonly Fenetre[] = [
  ...modales.map((d) => ({ nom: `modale ${d.key}`, verbes: verbesDeLaFenetre(d), declaree: d.verbes, pid: !multi(d) || !!d.rangees })),
  ...(HORS_MODAL as readonly HorsModalDef[]).filter((d) => d.tientLaMain).map((d) => ({ nom: `hors modale ${d.key}`, verbes: verbesDeLaFenetre(d), declaree: d.verbes, pid: !multi(d) })),
  ...(Object.keys(JET_AUTO) as (keyof typeof JET_AUTO)[]).map((jet) => {
    const { flux, rangees } = FENETRE_DU_JET[jet];
    return { nom: `cascade, étape-jet ${jet}`, verbes: verbesDuJet(jet), pid: !(flux && fluxAPid(flux)) || !!rangees };
  }),
  ...Object.entries(VERBES_D_INTERACTION).map(([i, { verbes, pid }]) => ({ nom: `cascade, interaction ${i}`, verbes, declaree: verbes, pid: !verbes.length || !!pid(ETAPE_TEMOIN) })),
];

/** Ce qui manque à la fenêtre : un verbe, ou une action de la partie derrière chacun. */
function fautes(f: Fenetre): string[] {
  const aucunDeclare = f.declaree === AUCUN_VERBE_DE_JOUEUR;
  return [
    ...(f.verbes.length === 0 && !aucunDeclare ? ['aucun verbe déclaré (`verbes`, `flux`, `drive`, `intents`) ni `AUCUN_VERBE_DE_JOUEUR`'] : []),
    ...(aucunDeclare && f.verbes.length ? [`déclarée sans verbe de joueur, elle en nomme : ${f.verbes.join(', ')}`] : []),
    ...f.verbes.filter((v) => typeof Reflect.get(ETAT, v) !== 'function').map((v) => `« ${v} » n'est pas une action de la partie`),
    ...(f.pid ? [] : ['ses verbes désignent une rangée par son id, et la fenêtre ne déclare pas de quoi rendre ce `pid` (`rangees`)']),
  ];
}

describe('chaque fenêtre que `fenetreDuJeu` peut rendre nomme ses verbes', () => {
  it('le relevé couvre les deux registres et la cascade', () => {
    expect(modales.length, 'témoin : les modales du registre').toBeGreaterThan(20);
    expect(FENETRES.some((f) => f.nom === 'hors modale victory') && FENETRES.some((f) => f.nom === 'cascade, interaction choix')).toBe(true);
  });

  it.each(FENETRES.map((f) => [f.declaree === AUCUN_VERBE_DE_JOUEUR ? `${f.nom} (aucun verbe de joueur, déclaré)` : f.nom, f] as const))('%s', (_nom, f) => {
    expect(fautes(f), f.nom).toEqual([]);
  });

  it('`fenetreDuJeu` rend les verbes déclarés : le Sauvetage par Destin, la porte de départ de nuit', () => {
    const destin = fenetreDuJeu({ ...ETAT, pendingFateSave: { heroId: 'h1' } } as unknown as Jeu);
    expect(destin).toMatchObject({ cle: 'fateSave', proprietaire: 'h1' });
    expect(destin!.verbes).toEqual(expect.arrayContaining(['fateNegate', 'fateSurvive', 'fateAccept']));
    const depart = fenetreDuJeu({ ...ETAT, pendingDeparture: { mode: 'pied', cause: 'nuit', dawnAt: 0 } } as unknown as Jeu);
    expect(depart).toMatchObject({ cle: 'departure', verbes: ['departWaitDawn', 'departCancel'] });
  });

  it('`fenetreDuJeu` rend le `pid` de la rangée due : la chute à deux tombants, l’étape-bande de cascade', () => {
    const tombants = [{ id: 't1', interactive: true, attempt: false, result: { chute: 1 } }, { id: 't2', interactive: true, attempt: null, result: null }];
    const chute = fenetreDuJeu({ ...ETAT, pendingFall: { initiateurId: 't1', participants: tombants } } as unknown as Jeu);
    expect(chute).toMatchObject({ cle: 'fall', pid: 't2' });
    expect(chute!.verbes).toEqual(expect.arrayContaining(['fallRoll', 'fallChoose', 'fallConfirm']));
    const bande = fenetreDuJeu({ ...ETAT, pendingCascade: { title: 'Témoin', purpose: 'test', cursor: 0, log: [], seq: 1, participants: [ETAPE_TEMOIN] } });
    expect(bande).toMatchObject({ cle: 'cascade', pid: 'rangee' });
    expect(bande!.verbes).toEqual(expect.arrayContaining(['cascadeBatchRoll', 'cascadeNext']));
  });
});
