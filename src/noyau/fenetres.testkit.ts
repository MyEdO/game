/**
 * LES FENÊTRES QUE `fenetreDuJeu` PEUT RENDRE (#2898, #2928), relevées pour les tests de totalité : chaque modale
 * (`MODAL_DEFS`), chaque situation `HORS_MODAL` qui tient la main et, pour la cascade (politique `partial`, ses verbes
 * sont ceux de l'étape courante), chaque étape-jet de combat (`JET_AUTO`), chaque fenêtre réactive qu'elle ouvre en
 * son sein (`FENETRE_DU_JET`) et chaque interaction (`VERBES_D_INTERACTION`), avec sa clé, ses verbes et de quoi rendre le `pid` qu'ils prennent. Lu par
 * `fenetres-nomment-leurs-verbes.hors-store.test.ts` et `hote/gestes.hors-store.test.ts`.
 */
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie } from './index';
import { MODAL_DEFS, HORS_MODAL, type HorsModalDef, type ModalDef, type VerbesDeFenetre } from './modalArbiter';
import { FENETRE_DU_JET, JET_AUTO, VERBES_D_INTERACTION, verbesDeLaFenetre, verbesDuJet } from './combatAuto';
import type { CascadeStep } from './pendings';
import { FLOW_VERBS, type FlowKey } from './flowVerbs';
import { cleDeFixture } from './noyau.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {}, idNeuf: idNeufDeBanc };
/** L'état d'une partie neuve : ses actions. */
export const ETAT = creerPartie(etatInitialDuJeu(), ENTREES).etat();

/** `pid` : la fenêtre a-t-elle de quoi rendre l'id que ses verbes prennent en premier argument, quand il en faut un ? */
export interface Fenetre { nom: string; cle: string; verbes: readonly string[]; declaree?: VerbesDeFenetre; pid: boolean }

/** Le flux de jet `cle` désigne-t-il ses rangées par leur id (flux multi : premier argument `pid`) ? */
const fluxAPid = (cle: FlowKey): boolean => FLOW_VERBS[cle].kind === 'multi';
const multi = (def: ModalDef | HorsModalDef): boolean => (def.flux ?? []).some(fluxAPid);

/** Les modales hors de la cascade, et la clé de la cascade (politique `partial`). */
export const MODALES = (MODAL_DEFS as readonly ModalDef[]).filter((d) => d.auto.mode !== 'partial');
const CASCADE = (MODAL_DEFS as readonly ModalDef[]).find((d) => d.auto.mode === 'partial')!.key;
/** Chaque fenêtre que `fenetreDuJeu` peut rendre, le `pid` d'une interaction lu sur l'étape témoin à rangées `temoin`. */
export const fenetresDuJeu = (temoin: CascadeStep): readonly Fenetre[] => [
  ...MODALES.map((d) => ({ nom: `modale ${d.key}`, cle: d.key, verbes: verbesDeLaFenetre(d), declaree: d.verbes, pid: !multi(d) || !!d.rangees })),
  ...(HORS_MODAL as readonly HorsModalDef[]).filter((d) => d.tientLaMain).map((d) => ({ nom: `hors modale ${d.key}`, cle: d.key, verbes: verbesDeLaFenetre(d), declaree: d.verbes, pid: !multi(d) })),
  ...(Object.keys(JET_AUTO) as (keyof typeof JET_AUTO)[]).flatMap((jet) => {
    const { flux, rangees, reactives = [] } = FENETRE_DU_JET[jet];
    return [
      { nom: `cascade, étape-jet ${jet}`, cle: CASCADE, verbes: verbesDuJet(jet), pid: !(flux && fluxAPid(flux)) || !!rangees },
      ...reactives.map((r) => ({ nom: `cascade, étape-jet ${jet}, fenêtre ${r.flux}`, cle: CASCADE, verbes: verbesDuJet(jet, r), pid: !fluxAPid(r.flux) || !!r.rangees })),
    ];
  }),
  ...Object.entries(VERBES_D_INTERACTION).map(([i, { verbes, pid }]) => ({ nom: `cascade, interaction ${i}`, cle: CASCADE, verbes, declaree: verbes, pid: !verbes.length || !!pid(temoin) })),
];

/** Les fenêtres, sans rangée témoin : leurs clés et leurs verbes ne dépendent pas du `pid`. */
const SANS_RANGEE = fenetresDuJeu({ id: 'etape', kind: cleDeFixture('note') });

/** Chaque clé de fenêtre que `fenetreDuJeu` peut rendre. */
export const CLES_DES_FENETRES: ReadonlySet<string> = new Set(SANS_RANGEE.map((f) => f.cle));

/** Chaque verbe qu'une fenêtre peut offrir. */
export const VERBES_DES_FENETRES: ReadonlySet<string> = new Set(SANS_RANGEE.flatMap((f) => f.verbes));
