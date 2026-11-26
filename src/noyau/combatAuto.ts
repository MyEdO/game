/**
 * Pilote d'AUTO-CADENCE (« Cadence de combat » Rapide / Auto-combat) — brique FEUILLE.
 *
 * `tickCombatAuto` regarde la modale ACTIVE (`pickActiveModalKey`) et, si le mode l'autorise et qu'elle
 * relève de l'autorité, la résout en enchaînant ses résolveurs de store — SANS jamais toucher aux
 * actions d'influence (`relancer`/`forcerLaReussite`/`pactiser`/`ajouterUnDR`) → « zéro dépense » par construction.
 *
 * Deux couches de politique (cf. critique : la granularité réelle des jets de combat est l'étape de
 * cascade, pas une clé modale) :
 *  - `MODAL_DEFS.auto` (modalArbiter) pour les modales STANDALONE (frénésie, course, focalisation, Destin…) ;
 *  - `JET_AUTO` (ici) pour les étapes-JET de la `cascade` de COMBAT (attaque/défense/… bespoke) — leur
 *    résolution passe par leur propre flux (`jetLancer(flux)`→`jetValider(flux)`, qui fait avancer la cascade), PAS par le
 *    résolveur générique « tout résoudre » (`jetLancer('cascade')`, réservé aux jets de NUIT/VOYAGE, qui ont un `target`).
 *
 * Module FEUILLE : n'importe RIEN de `combatFlow` ; tout passe par `get().xxx`. INERT tant que la chaîne
 * de reprise (C3/C4) ne l'appelle pas — `cadenceAuto()` est faux par défaut (mode « manuel »).
 */
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import { tourEnCoursDe } from './etat';
import type { CascadeStep } from './pendings';
import {
  pickActiveModalKey,
  modalOwnerOf,
  voyageHubActive,
  autoPolicyOf,
  modaleActive,
  pendingOuvert,
  HORS_MODAL,
  MODAL_DEFS,
  SURFACES_HORS_PENDING,
  AUCUN_VERBE_DE_JOUEUR,
  cleDuGeste,
  type AutoPolicy,
  type CleDeRegistre,
  type FenetreAValider,
  type FenetreQuiSeFerme,
  type GesteDuJeu,
  type HorsModalDef,
  type IssueDeFenetre,
  type ModalDef,
  type RangeeDeFenetre,
  type SurfaceHorsPendingDef,
  type VerbesDeFenetre,
} from './modalArbiter';
import { fermetureHoteDeToutResoudre, maladresseCourante, stepInteraction } from './cascade';
import type { HostJet } from './slotsDeJet';
import { FLOW_VERBS, NOM_DU_VERBE_DE_JET, type FlowKey, type FlowVerbs } from './flowVerbs';
import { decidingSeat, detientLAutoriteDuJeu, ownsLocal, seatInfluences, withActingSeat } from './netOwnership';
import { siegeDe } from './sieges';
import { porteurParId } from './monde/combatants';
import { cadence, cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { beatHold } from './combatDirector';
import { programmer, enAttente, type Jeton } from './plateforme';
import { fateSaveOptions } from '../engine/fortune';
import { reglageDeLaQuantite, reglageDuChoix, type Reglage } from './reglages';
import { reglagesDuFlux, VERBE_DE_REGLAGE, type ArgumentsDuReglage } from './reglagesDuJet';
import { axesDeLaFenetre, VERBE_DE_CHOIX, type FenetreAChoix } from './choixDesFenetres';
import { VERBE_DE_VALIDATION } from './validationDeFenetre';

/** Une rangée d'une fenêtre réactive, vue par le pilote : son porteur, son état de jet, sa déclaration. */
type RangeeReactive = RangeeDeFenetre & { declared?: string };

/** Une FENÊTRE RÉACTIVE qu'une étape-jet ouvre en son sein : son flux de jet multi, ses rangées (`undefined` :
 *  fermée), et le drive d'auto-cadence qui la résout (`stepWindowDrive` ; absent : l'étape garde le sien). */
interface FenetreReactive { flux: FlowKey; rangees: (s: Jeu) => readonly RangeeReactive[] | undefined; drive?: readonly GesteDuJeu[] }

/** Les verbes généraux qu'offre un jet où la Psychologie se joue, le Test de scène et la bande (LDB 17 l.59) : leurs
 *  valeurs se règlent à `fenetreDeDetermination`. */
export const VERBES_DU_JET_PSY = ['depenserLaDetermination'] as const satisfies VerbesDeFenetre;

/** Le flux de jet (`FLOW_VERBS`) de chaque étape-jet de COMBAT : ses verbes (pose du dé, relance, Fortune…) et ses
 *  réglages (`REGLAGES_DU_JET`) s'ajoutent à son drive. Un flux multi déclare ses `rangees`, que ses verbes
 *  désignent par leur id (`pid`). `reactives` : les fenêtres que l'étape ouvre en son sein, dans l'ordre de la chaîne
 *  réelle (`resolveCastChain` : le Contre-sort précède l'opposition). `verbes` : les verbes généraux que l'étape offre.
 *  Record total : un `jet` neuf nomme son flux. */
export const FENETRE_DU_JET: Record<NonNullable<CascadeStep['jet']>, { flux: FlowKey; rangees?: (s: Jeu) => readonly RangeeDeFenetre[] | undefined; reactives?: readonly FenetreReactive[]; verbes?: VerbesDeFenetre }> = {
  attaque: { flux: 'attaque' },
  defense: { flux: 'defense' },
  maladresse: { flux: 'maladresse', rangees: (s) => { const m = maladresseCourante(s.pendingCascade); return m && [{ id: m.id, result: m.maladresse.result }]; } },
  incantation: {
    flux: 'incantation',
    reactives: [
      // Contre-sort : la fenêtre a une PHASE 1 de déclaration (#1042/#1059) — la cadence déclare les
      // rangées de CE siège (« contrer seul » = le geste que le joueur posait en lançant) avant de rouler.
      { flux: 'contreSort', rangees: (s) => s.pendingCounterspell?.participants, drive: [{ verbe: 'jetRegler', flux: 'contreSort', reglage: 'declaration', toutes: true, valeur: 'solo' }, { verbe: 'jetLancer', flux: 'contreSort' }, { verbe: 'jetValider', flux: 'contreSort' }] },
      { flux: 'opposition', rangees: (s) => s.pendingCastOpposition?.participants, drive: [{ verbe: 'jetLancer', flux: 'opposition' }, { verbe: 'jetValider', flux: 'opposition' }] },
    ],
  },
  test: { flux: 'test', verbes: VERBES_DU_JET_PSY },
  testEtendu: { flux: 'testEtendu', rangees: (s) => s.pendingExtendedTest?.rounds },
  desengagement: {
    flux: 'desengagement',
    reactives: [{ flux: 'fuite', rangees: (s) => s.pendingDisengage?.fuir?.participants.map((p) => ({ id: p.id, interactive: p.interactive, result: p.kind === 'backstab' ? p.result : p.jet })), drive: [{ verbe: 'jetLancer', flux: 'fuite' }, { verbe: 'jetValider', flux: 'fuite' }] }],
  },
  enfoncerLaPorte: { flux: 'enfoncerLaPorte', rangees: (s) => s.pendingForceDoor?.participants },
};

/** LA PAIRE DE GESTES d'une étape-jet : lancer puis valider, sur le flux de sa fenêtre (`FENETRE_DU_JET`). Le drive de
 *  `JET_AUTO` et le jeu d'office du socle (`jouerLaPaireDuJet`, #3892) la partagent. */
function paireDuJet(jet: HostJet): readonly GesteDuJeu[] {
  const { flux } = FENETRE_DU_JET[jet];
  return [{ verbe: 'jetLancer', flux }, { verbe: 'jetValider', flux }];
}

/** Joue un geste du jeu sur son flux, son réglage et sa valeur — le même appel pour la cadence (`driveSelf`) et le
 *  socle. */
function jouerLeGeste(get: Get, g: GesteDuJeu): void {
  const fn = get()[g.verbe] as undefined | ((flux?: FlowKey, reglage?: string, valeur?: string) => void);
  if (typeof fn === 'function') fn(g.flux, g.reglage, g.valeur);
}

/** Joue EN SYNCHRONE les gestes `drive` d'une fenêtre : ce qu'un humain fait sur elle, quand aucun ne la tient
 *  (`cascade.jouerLHoteDOffice`, #3892, #5042). */
export function jouerLeDrive(get: Get, drive: readonly GesteDuJeu[]): void {
  for (const g of drive) jouerLeGeste(get, g);
}

/** Les réglages que la DÉCISION de l'IA pose sur l'étape-jet `jet` de `porteurId` (`TourEnCours.reglages`, #5042) :
 *  rendus une fois, puis retirés du tour. */
export function prendreLesReglagesDeLaDecision(get: Get, jet: HostJet, porteurId: string | undefined): readonly ArgumentsDuReglage[] {
  const battle = get().battle;
  const tour = battle && porteurId ? tourEnCoursDe(battle, porteurId) : undefined;
  const gestes = tour?.reglages?.[jet];
  if (!tour?.reglages || !gestes) return [];
  const { [jet]: _pris, ...reste } = tour.reglages;
  tour.reglages = reste;
  return gestes;
}

/** La paire de gestes d'une étape-jet (`paireDuJet`), jouée d'office (`jouerLeDrive`). */
export function jouerLaPaireDuJet(get: Get, jet: HostJet): void {
  jouerLeDrive(get, paireDuJet(jet));
}

/**
 * Politique d'auto-résolution par TYPE de jet de cascade de COMBAT. `self` = jet propre piloté par son
 * flux bespoke (`drive` = roll → confirm, qui avance la cascade) ; `choice` = vrai choix laissé au joueur
 * en Rapide (Surincantation, menu de Désengagement) ou multi-participant rare (Test étendu, Enfoncer la
 * porte) — tranché par l'IA en Auto-combat (C4). Record total : ajouter un `jet` force une politique.
 */
export const JET_AUTO: Record<NonNullable<CascadeStep['jet']>, AutoPolicy> = {
  attaque: { mode: 'self', drive: paireDuJet('attaque') },
  defense: { mode: 'self', drive: paireDuJet('defense') },
  maladresse: { mode: 'self', drive: paireDuJet('maladresse') },
  test: { mode: 'self', drive: paireDuJet('test') },
  incantation: { mode: 'choice', autoDrive: paireDuJet('incantation') }, // Rapide : le joueur décide (surincantation) ; Auto-combat : l'IA incante et surincante (`aiOvercastPlan`)
  desengagement: { mode: 'choice', autoDrive: paireDuJet('desengagement') }, // Rapide : le joueur choisit (Fuir / Esquiver / sacrifier) ; Auto-combat : la décision de l'IA l'a réglé
  testEtendu: { mode: 'choice' },   // multi-participant (rare en combat)
  enfoncerLaPorte: { mode: 'choice' },  // multi groupOwner (rare en combat)
};

/** L'id de la rangée DUE (la première qui se joue et n'a pas de résultat), sinon de la première : le `pid` que la
 *  fenêtre rend. */
const idDeLaRangeeDue = (rangees: readonly RangeeDeFenetre[] | undefined): string | undefined =>
  (rangees?.find((r) => r.interactive !== false && !r.result) ?? rangees?.[0])?.id;

/** Les gestes nommés par les seuls verbes `verbes` (aucun ne vise un flux de jet). */
const nommes = (verbes: VerbesDeFenetre): GesteDuJeu[] => verbes.map((verbe) => ({ verbe }));

/** Les gestes d'un flux de jet : chacun de ses verbes de jet sur lui (`NOM_DU_VERBE_DE_JET`), clôture comprise, puis
 *  chacun de ses réglages (`jetRegler`, `REGLAGES_DU_JET`). */
const gestesDuFlux = (cle: FlowKey): GesteDuJeu[] => {
  const flux: FlowVerbs = FLOW_VERBS[cle];
  return [...flux.verbs.map((v) => ({ verbe: NOM_DU_VERBE_DE_JET[v], flux: cle })), ...reglagesDuFlux(cle).map((reglage) => ({ verbe: VERBE_DE_REGLAGE, flux: cle, reglage }))];
};

/** « Tout résoudre » : le jet sans rangée de la cascade, qui résout les étapes restantes et s'arrête sur un choix. */
export const TOUT_RESOUDRE: GesteDuJeu = { verbe: NOM_DU_VERBE_DE_JET.lancer, flux: 'cascade', toutes: true };

/** La navigation de la cascade : valider l'étape (la clôture de son flux), tout résoudre, terminer le bilan (sa sortie). */
export const NAVIGATION_DE_CASCADE: readonly GesteDuJeu[] = [{ verbe: NOM_DU_VERBE_DE_JET.valider, flux: 'cascade' }, TOUT_RESOUDRE, { verbe: 'fenetreFermer', fenetre: 'cascade' }];

/** Les gestes `gestes`, chacun une fois (`cleDuGeste`), dans leur premier ordre. */
const uniques = (gestes: readonly GesteDuJeu[]): GesteDuJeu[] => [...new Map(gestes.map((g) => [cleDuGeste(g), g])).values()];

/** L'id d'étape (`pid`) que prennent les verbes de l'étape courante. */
const idDEtape = (e: CascadeStep): string => e.id;
/** Le `pid` des verbes d'un flux de cascade : l'id de la rangée due quand il est porté par l'acteur (`pidIsActor`),
 *  sinon l'id de l'étape. */
const pidDuFlux = (cle: 'cascade' | 'cascadeEnBande') => (e: CascadeStep): string | undefined =>
  (FLOW_VERBS[cle].pidIsActor ? idDeLaRangeeDue(e.participants) : e.id);
/** L'interaction d'étape que joue le flux de cascade `cle` : son flux, ses verbes, lus à l'usage (`reglagesDuJet.ts` est
 *  dans un cycle d'imports avec ce module), puis les verbes généraux qu'elle offre (`verbes`), et leur `pid`. */
const joueePar = (cle: 'cascade' | 'cascadeEnBande', verbes: VerbesDeFenetre = AUCUN_VERBE_DE_JOUEUR) => ({ flux: cle, get gestes() { return [...gestesDuFlux(cle), ...nommes(verbes)]; }, pid: pidDuFlux(cle) });

/** L'interaction d'étape que règle le seul réglage `reglage` du flux `cascade`, sur l'étape (`pid`), d'après la lecture
 *  `lecture` ; lue à l'usage, comme `joueePar`. */
const regleePar = (reglage: 'choix' | 'quantite', lecture: (g: GesteDuJeu) => (e: CascadeStep) => Reglage) => {
  const geste = (): GesteDuJeu => ({ verbe: VERBE_DE_REGLAGE, flux: 'cascade', reglage });
  return { get gestes() { return [geste()]; }, pid: idDEtape, get reglage() { return lecture(geste()); } };
};

/** Les gestes d'une étape de cascade sans jet de COMBAT, par son interaction (`stepInteraction`), l'id qu'ils désignent
 *  (`pid`), le réglage de l'argument qui suit (`reglage` : les clés d'un choix, les bornes d'une quantité) et le flux de
 *  jet qui la joue (`flux`). Record total : une interaction neuve nomme ses gestes. */
export const VERBES_D_INTERACTION: Record<ReturnType<typeof stepInteraction>, { gestes: readonly GesteDuJeu[]; pid: (e: CascadeStep) => string | undefined; reglage?: (e: CascadeStep) => Reglage; flux?: FlowKey }> = {
  jet: joueePar('cascade'),
  batch: joueePar('cascadeEnBande', VERBES_DU_JET_PSY),
  table: { flux: 'cascadeTirage', get gestes() { return gestesDuFlux('cascadeTirage'); }, pid: idDEtape },
  de: { flux: 'cascadeTirage', get gestes() { return gestesDuFlux('cascadeTirage'); }, pid: idDEtape },
  quantite: regleePar('quantite', reglageDeLaQuantite),
  choix: regleePar('choix', reglageDuChoix),
  affichage: { gestes: AUCUN_VERBE_DE_JOUEUR, pid: () => undefined },
};

const gestesDuDrive = (pol: AutoPolicy): readonly GesteDuJeu[] => (pol.mode === 'self' ? pol.drive : pol.mode === 'choice' ? (pol.autoDrive ?? []) : []);

/** Le geste de l'issue `issue` d'une fenêtre qui la déclare : sa validation (`VERBE_DE_VALIDATION`) ou sa sortie
 *  (`fenetreFermer`), la fenêtre en argument. */
const issueDe = (def: ModalDef | HorsModalDef | SurfaceHorsPendingDef, issue: IssueDeFenetre): GesteDuJeu[] => {
  if (!def[issue]) return [];
  return [issue === 'validation' ? { verbe: VERBE_DE_VALIDATION, fenetre: def.key as FenetreAValider } : { verbe: 'fenetreFermer', fenetre: def.key as FenetreQuiSeFerme }];
};

/** Les gestes d'issue d'une fenêtre qui les déclare : sa validation, puis sa sortie (`issueDe`). */
const issuesDe = (def: ModalDef | HorsModalDef | SurfaceHorsPendingDef): GesteDuJeu[] => [...issueDe(def, 'validation'), ...issueDe(def, 'sortie')];

/** Le drive d'une situation hors modale ou d'une surface qui en déclare un : son issue (`HorsModalDef.drive`). */
const driveDeLIssue = (def: HorsModalDef | SurfaceHorsPendingDef): Pick<FenetreDuJeu, 'drive'> => (def.drive ? { drive: issueDe(def, def.drive) } : {});

/** Les choix d'une fenêtre (`fenetreChoisir`), un par axe que `ChoixDesFenetres` lui déclare. */
const choixDe = (cle: string): GesteDuJeu[] => axesDeLaFenetre(cle).map((axe) => ({ verbe: VERBE_DE_CHOIX, fenetre: cle as FenetreAChoix, axe }));

/** Les gestes qu'une fenêtre DÉCLARE : le drive (ou l'`autoDrive`) de sa politique, les gestes de ses `flux`, ses
 *  choix (`choixDe`), ses `verbes`, puis ses issues (`issuesDe`). */
export function gestesDeLaFenetre(def: ModalDef | HorsModalDef): readonly GesteDuJeu[] {
  const premiers = 'auto' in def ? gestesDuDrive(def.auto) : [];
  return uniques([...premiers, ...(def.flux ?? []).flatMap(gestesDuFlux), ...choixDe(def.key), ...nommes(def.verbes ?? []), ...issuesDe(def)]);
}

/** Les gestes d'une étape-jet de COMBAT : son drive (`JET_AUTO`), ou celui de la fenêtre réactive ouverte dans l'étape
 *  (`reactive`), puis les gestes de son flux (`FENETRE_DU_JET`), ceux du flux de la fenêtre réactive et les verbes
 *  généraux que l'étape offre. */
export function gestesDuJet(jet: NonNullable<CascadeStep['jet']>, reactive?: FenetreReactive): readonly GesteDuJeu[] {
  const { flux, verbes = AUCUN_VERBE_DE_JOUEUR } = FENETRE_DU_JET[jet];
  return uniques([...(reactive?.drive ?? gestesDuDrive(JET_AUTO[jet])), ...gestesDuFlux(flux), ...(reactive ? gestesDuFlux(reactive.flux) : []), ...nommes(verbes)]);
}

/** Les surfaces partagées hors `pending*` qui se valident ou se ferment (`issuesDe`) : celles que `fenetreDuJeu` rend. */
/** Les gestes d'une surface partagée : ses choix (`choixDe`), puis ses issues (`issuesDe`). */
export const gestesDeLaSurface = (def: SurfaceHorsPendingDef): GesteDuJeu[] => [...choixDe(def.key), ...issuesDe(def)];

export const SURFACES_A_ISSUE: readonly SurfaceHorsPendingDef<(typeof SURFACES_HORS_PENDING)[number]['key']>[] = (SURFACES_HORS_PENDING as readonly SurfaceHorsPendingDef<(typeof SURFACES_HORS_PENDING)[number]['key']>[]).filter((d) => d.validation || d.sortie);

/** Les clés que `fenetreDuJeu` peut rendre : chaque modale (`MODAL_DEFS`), chaque situation hors modale (`HORS_MODAL`),
 *  puis chaque surface partagée qui se valide ou se ferme (`SURFACES_A_ISSUE`). */
export const CLES_DE_FENETRE: readonly CleDeRegistre[] = [...MODAL_DEFS.map((d) => d.key), ...HORS_MODAL.map((d) => d.key), ...SURFACES_A_ISSUE.map((d) => d.key)];

/** La fenêtre qui tient la main : sa clé, son propriétaire, ses gestes, les flux de jet qui les jouent (`flux`, celui
 *  que sa politique résout en tête), l'id que ses gestes désignent (`pid` : l'étape de cascade courante, ou la rangée
 *  due d'une fenêtre à plusieurs jets ; `argumentsPosesDuGeste`), les gestes qui la résolvent sans choix du joueur
 *  (`drive` : ceux que sa politique enchaîne, `AutoPolicy`, le jet puis sa clôture ; ou l'issue qu'une situation hors
 *  modale ou une surface déclare, `driveDeLIssue`, que joue un hôte, jamais la cadence), et l'étape de cascade courante quand la cascade tient la main. */
export interface FenetreDuJeu {
  cle: CleDeRegistre;
  proprietaire: string | undefined;
  gestes: readonly GesteDuJeu[];
  flux: readonly FlowKey[];
  pid?: string;
  drive?: readonly GesteDuJeu[];
  etape?: CascadeStep;
}

/** La FENÊTRE qui tient la main (#2898), pour un hôte qui la nomme au joueur : la modale élue (la première entrée de
 *  `MODAL_DEFS` dont le `when` tient, comme `pickActiveModalKey`), son propriétaire, ses gestes DÉCLARÉS
 *  (`gestesDeLaFenetre`) et l'id de sa rangée due (`rangees`) ; pour la cascade, ceux de l'étape courante : l'étape-jet
 *  de combat, `gestesDuJet` et la rangée due de sa fenêtre réactive ou de son flux (`FENETRE_DU_JET`) ;
 *  toute autre étape et le bilan, les gestes de son interaction (`VERBES_D_INTERACTION`) puis la navigation de la
 *  cascade (`NAVIGATION_DE_CASCADE`), le flux de son interaction puis `cascade`, dont la clôture valide l'étape, et pour
 *  une interaction jouée par un flux de jet le drive « le jet, puis valider l'étape » ; sinon la première situation
 *  `HORS_MODAL` ouverte (`pendingOuvert`) qui tient la main, avec ses gestes déclarés ; sinon la première surface
 *  partagée qui se valide ou se ferme et tient la main (`SURFACES_A_ISSUE`), avec ses gestes (`gestesDeLaSurface`) ; l'une
 *  ou l'autre avec le drive de l'issue qu'elle déclare (`driveDeLIssue`). L'étape de cascade
 *  courante est rendue avec la cascade.
 *  `null` : rien ne tient la main. */
export function fenetreDuJeu(s: Jeu): FenetreDuJeu | null {
  const def = modaleActive(s);
  if (def) {
    const cle = def.key;
    const proprietaire = def.owner(s) ?? undefined;
    const pc = cle === 'cascade' ? s.pendingCascade : null;
    const avecPid = (pid: string | undefined) => (pid ? { pid } : {});
    if (!pc) return { cle, proprietaire, gestes: gestesDeLaFenetre(def), flux: def.flux ?? [], ...avecPid(idDeLaRangeeDue(def.rangees?.(s))), drive: gestesDuDrive(def.auto) };
    const etape = pc.participants[pc.cursor];
    if (etape?.jet) {
      const { flux, rangees, reactives = [] } = FENETRE_DU_JET[etape.jet];
      const reactive = reactives.find((w) => w.rangees(s));
      const gestes = gestesDuJet(etape.jet, reactive);
      return {
        cle,
        proprietaire,
        gestes: fermetureHoteDeToutResoudre(s, etape) ? [...gestes, TOUT_RESOUDRE] : gestes,
        flux: [...(reactive ? [reactive.flux] : []), flux],
        ...avecPid(idDeLaRangeeDue(reactive ? reactive.rangees(s) : rangees?.(s))),
        drive: reactive?.drive ?? gestesDuDrive(JET_AUTO[etape.jet]),
        etape,
      };
    }
    const parInteraction = etape ? VERBES_D_INTERACTION[stepInteraction(etape)] : null;
    const flux = parInteraction?.flux;
    return { cle, proprietaire, gestes: uniques([...(parInteraction?.gestes ?? []), ...NAVIGATION_DE_CASCADE]), flux: [...new Set<FlowKey>([...(flux ? [flux] : []), 'cascade'])], ...avecPid(etape && parInteraction?.pid(etape)), ...(flux ? { drive: [{ verbe: NOM_DU_VERBE_DE_JET.lancer, flux }, NAVIGATION_DE_CASCADE[0]] } : {}), ...(etape ? { etape } : {}) };
  }
  const hors = (HORS_MODAL as readonly HorsModalDef<(typeof HORS_MODAL)[number]['key']>[]).find((d) => d.tientLaMain && pendingOuvert(s[d.pendingKey]));
  if (hors) return { cle: hors.key, proprietaire: hors.owner(s), gestes: gestesDeLaFenetre(hors), flux: hors.flux ?? [], ...driveDeLIssue(hors) };
  const surface = SURFACES_A_ISSUE.find((d) => d.tientLaMain(s));
  return surface ? { cle: surface.key, proprietaire: undefined, gestes: gestesDeLaSurface(surface), flux: [], ...driveDeLIssue(surface) } : null;
}

/**
 * FENÊTRES RÉACTIVES à drive ouvertes DANS une étape-jet (`FENETRE_DU_JET[…].reactives`) et leur drive d'auto-cadence (#1030) :
 * celles de l'étape `jet:'incantation'` (Contre-sort #1028, opposition de cible #949), et la fuite du Désengagement (#5042). Le drive de l'ÉTAPE n'en traverse aucune :
 * `jetValider('incantation')` s'abstient sous Contre-sort (la Dissipation se résout AVANT, `LDB 46 l.156`) et
 * `jetValider('opposition')` refuse d'agréger tant qu'une rangée interactive n'a pas jeté — `autoDrive` y
 * re-tirait donc à vide (l'opposition allant jusqu'à se RÉOUVRIR à chaque passage, jets compris).
 * POLITIQUE du drive (pas une règle) : chaque rangée jouable ICI jette, puis « Appliquer » — les issues
 * restent tranchées par les agrégations canoniques (`jetValider('contreSort')` #1040, `jetValider('opposition')`),
 * et les rangées non surfacées par leurs chemins existants (`applyCounterspellFallback`, jets témoins
 * roulés à l'ouverture). ORDRE = celui de la chaîne réelle (`resolveCastChain`) : le Contre-sort
 * précède l'opposition (une incantation n'ouvre jamais la seconde tant que la première est posée).
 * Hors cadence auto, rien ne bouge : la fenêtre attend son joueur.
 */
const STEP_WINDOW_AUTO: readonly (FenetreReactive & { drive: readonly GesteDuJeu[] })[] = Object.values(FENETRE_DU_JET)
  .flatMap((f) => f.reactives ?? [])
  .filter((w): w is FenetreReactive & { drive: readonly GesteDuJeu[] } => !!w.drive);

/**
 * Drive de la fenêtre réactive OUVERTE, ou `ATTENDRE` quand ce siège n'a pas à la résoudre.
 * GARDE DE POSSESSION (#1005) : l'owner de l'étape `cast` partagée est `'*'` — vrai pour TOUS les
 * sièges — donc le propriétaire de l'étape ne désigne pas celui de chaque rangée. Un siège qui « appliquerait » une fenêtre dont
 * une rangée DUE appartient à un autre (le MJ, un autre joueur) la refermerait SANS son jet : sa
 * Dissipation/son Test opposé seraient forfaits. La fenêtre ne se drive donc que si TOUTE rangée
 * encore due est influençable ICI ; sinon elle ATTEND son siège, exactement comme en manuel — et le
 * pilote ne planifie AUCUN beat (pas de poll) : c'est le jet distant, appliqué par le réseau, qui
 * change l'état et re-déclenche le tick (`planifierLeTickAuto`).
 */
const ATTENDRE = 'attendre';
function stepWindowDrive(s: Jeu, siege: number): readonly GesteDuJeu[] | typeof ATTENDRE | null {
  for (const w of STEP_WINDOW_AUTO) {
    const rows = w.rangees(s);
    if (!rows) continue;
    // Rangée RÉGLÉE = jetée, PASSÉE (déclaration terminale : elle ne jettera pas) ou non surfacée.
    return rows.every((p) => p.result || p.declared === 'passer' || !p.interactive || seatInfluences(s, siege, p.id)) ? w.drive : ATTENDRE;
  }
  return null; // aucune fenêtre ouverte : l'étape garde son propre drive
}

/** Jeton anti-ré-entrance / double-advance, par état (`Get`) : chaque séquence lancée y pose le sien et invalide les
 *  précédentes. */
const sequenceCourante = new WeakMap<Get, object>();

/** Siège au nom duquel l'autorité résout la fenêtre, y compris celle d'un héros distant en Auto. */
function siegeDeLaCadence(s: Jeu): number | null {
  if (!detientLAutoriteDuJeu(s) || !cadenceAuto()) return null;
  const owner = modalOwnerOf(s);
  if (owner == null || owner === '*') return s.net.mySeat;
  const siege = siegeDe(s, owner);
  if (siege === s.net.mySeat || (cadenceAutoCombat() && porteurParId(s, owner)?.kind === 'heros')) return siege;
  return null;
}

/** Le contexte du siège ne couvre que le geste synchrone. */
function jouerPourLeSiege(s: Jeu, siege: number, jouer: () => void): void {
  if (decidingSeat(s) === siege) jouer();
  else withActingSeat(siege, jouer);
}

/** Enchaîne les gestes `drive` (roll → confirm…) sur des ticks espacés, chacun sur son flux, puis re-tick pour la suite. */
function driveSelf(get: Get, set: Set, siege: number, drive: readonly GesteDuJeu[], choix = false): void {
  const jeton = {};
  const mode = cadence();
  sequenceCourante.set(get, jeton);
  let i = 0;
  const step = () => {
    const s = get();
    if (sequenceCourante.get(get) !== jeton || cadence() !== mode || siegeDeLaCadence(s) !== siege) return;
    if (i >= drive.length) { tickCombatAuto(get, set); return; }
    const reactif = choix ? stepWindowDrive(s, siege) : null;
    if (reactif !== null && reactif !== drive) return;
    jouerPourLeSiege(s, siege, () => jouerLeGeste(get, drive[i++]));
    programmer(step, beatHold(get, 'autoResolve'));
  };
  step();
}

/** Auto-résout la cascade active : jet de COMBAT bespoke (JET_AUTO) ou jet générique nuit/voyage. */
function autoResolveCascade(get: Get, set: Set, siege: number): void {
  const pc = get().pendingCascade;
  if (!pc) return;
  if (pc.cursor >= pc.participants.length) {
    // BILAN : combat → fermer ; voyage/nuit/test → laisser le RÉSUMÉ au joueur (« Terminer »).
    if (pc.purpose === 'combat') jouerPourLeSiege(get(), siege, () => get().fenetreFermer('cascade'));
    return;
  }
  const cur = pc.participants[pc.cursor];
  if (cur.jet) {
    const jet = cur.jet;
    for (const reglage of prendreLesReglagesDeLaDecision(get, jet, cur.actorId)) jouerPourLeSiege(get(), siege, () => get().jetRegler(...reglage));
    const pol = JET_AUTO[jet];
    if (pol.mode === 'self') { driveSelf(get, set, siege, pol.drive); return; }
    // 'choice' (cast/disengage/…) : en Auto-combat, l'IA résout via `autoDrive` (incantation) ; en Rapide,
    // on LAISSE la modale au joueur (surincantation = vrai choix). Une fenêtre RÉACTIVE ouverte dans
    // l'étape prend la main sur son drive, et `ATTENDRE` = fenêtre d'un AUTRE siège : on ne touche à
    // RIEN et on ne planifie aucun beat (`STEP_WINDOW_AUTO`/`stepWindowDrive` ci-dessus).
    if (pol.mode === 'choice' && cadenceAutoCombat()) {
      const w = stepWindowDrive(get(), siege);
      if (w === ATTENDRE) return;
      const drive = w ?? pol.autoDrive;
      if (drive) driveSelf(get, set, siege, drive, true);
    }
    return;
  }
  // Étape GÉNÉRIQUE non-jet. Un CHOIX : laissé au joueur en Rapide. En Auto-combat, tranché via le DÉFAUT
  // authoré (`defaultChoice`, ex. déviation Critique → 'devier') ; SANS défaut authoré → laissé au joueur
  // (jamais de hang : `stepAutoResolved` ne masque pas une telle modale).
  if (stepInteraction(cur) === 'choix') {
    if (!cadenceAutoCombat()) return;
    if (cur.chosen == null) {
      if (cur.defaultChoice == null) return; // pas de défaut → décision au joueur (la modale reste visible)
      const choix = cur.defaultChoice;
      jouerPourLeSiege(get(), siege, () => get().jetRegler('cascade', 'choix', choix, cur.id));
    }
    // Combat : avancer d'UNE étape (comme le joueur) → les étapes-jet en aval (Maladresse…) gardent leur
    // driver bespoke au tick suivant, au lieu d'être écrasées par un « tout résoudre » global.
    if (pc.purpose === 'combat') {
      jouerPourLeSiege(get(), siege, () => get().jetValider('cascade'));
      programmer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve'));
      return;
    }
  }
  jouerPourLeSiege(get(), siege, () => get().jetLancer('cascade'));
  programmer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve')); // gérer le bilan / l'étape suivante
}

/** Une étape de cascade sera-t-elle auto-résolue ? (sert à MASQUER la modale, cf. `willAutoResolve`). */
function stepAutoResolved(s: Jeu, step: CascadeStep, siege: number): boolean {
  if (step.jet) {
    const pol = JET_AUTO[step.jet];
    if (pol.mode === 'self') return true;
    if (pol.mode !== 'choice' || !cadenceAutoCombat()) return false;
    const w = stepWindowDrive(s, siege);
    if (w === ATTENDRE) return false; // fenêtre d'un AUTRE siège : elle RESTE visible (elle n'est pas résolue ici)
    return !!(w ?? pol.autoDrive); // incantation en Auto
  }
  if (stepInteraction(step) === 'choix') return cadenceAutoCombat() && step.defaultChoice != null; // choix : auto SEULEMENT si un défaut est authoré (sinon décision au joueur, pas de hang)
  return true; // jet/affichage générique (nuit/voyage) → tout résoudre (`jetLancer('cascade')`)
}

/**
 * La modale ACTIVE va-t-elle être auto-résolue par le driver ? PURE (zéro effet) — lue par `ActiveModal`
 * pour NE PAS la rendre du tout (fini le flash de quelques ms en Rapide/Auto). On NE masque PAS : le BILAN
 * d'une cascade voyage/nuit (le joueur veut voir le résumé), ni un vrai choix laissé au joueur (surincantation
 * ou Destin en Rapide), ni les fenêtres que l'autorité laisse au joueur.
 */
export function willAutoResolve(s: Jeu): boolean {
  const siege = siegeDeLaCadence(s);
  if (siege === null) return false;
  const pol = autoPolicyOf(s);
  if (!pol) return false;
  switch (pol.mode) {
    case 'hostOnly': return false;
    case 'self': return true;
    case 'choice': return cadenceAutoCombat() && (pickActiveModalKey(s) === 'destin' || !!pol.autoDrive);
    case 'partial': {
      const pc = s.pendingCascade;
      if (!pc) return false;
      if (pc.cursor >= pc.participants.length) return pc.purpose === 'combat'; // bilan : combat masqué ; voyage/nuit MONTRÉ
      return stepAutoResolved(s, pc.participants[pc.cursor], siege);
    }
  }
}

/**
 * SIÈGE ATTENDU sur la modale prioritaire, vu de ce siège — `null` : aucun (solo, aucune modale, modale du
 * hub de voyage, modale que le pilote d'auto-cadence résout seul, modale à tous `'*'`, ou modale de ce
 * siège). Décision UNIQUE que lisent la puce de spectateur de la modale et la bande d'attente de la console.
 * Vit ici, avec `willAutoResolve` qu'elle compose : `netOwnership` est importé par ce module.
 */
export function spectatorSeatOfModal(s: Jeu): number | null {
  if (s.net.mode === 'local') return null;
  const key = pickActiveModalKey(s);
  if (!key) return null;
  if ((key === 'cascade' || key === 'repos') && voyageHubActive(s)) return null;
  if (willAutoResolve(s)) return null;
  const ownerId = modalOwnerOf(s);
  if (ownerId === '*' || ownerId === null || ownsLocal(s, ownerId)) return null;
  return siegeDe(s, ownerId);
}

/**
 * TICK du pilote d'auto-cadence. L'autorité joue en Rapide ou en Auto les fenêtres que
 * `siegeDeLaCadence` lui confie. Le Sauvetage par Destin fait partie des choix automatiques en Auto.
 */
export function tickCombatAuto(get: Get, set: Set): void {
  const s = get();
  const siege = siegeDeLaCadence(s);
  if (siege === null) return;
  const pol = autoPolicyOf(s);
  if (!pol) return;
  switch (pol.mode) {
    case 'hostOnly':
      return;
    case 'choice':
      // Auto-combat seul : le Sauvetage par Destin est dépensé automatiquement pour éviter la mort,
      // `eviter` s'il est offert (`fateSaveOptions`), sinon `survivre`. En Rapide, on NE touche PAS (la
      // modale reste — vrai choix du joueur).
      if (cadenceAutoCombat() && pickActiveModalKey(s) === 'destin' && s.pendingFateSave) {
        const destin = s.pendingFateSave;
        const eviter = fateSaveOptions(destin.source).includes('eviter');
        programmer(() => {
          const courant = get();
          if (courant.pendingFateSave !== destin || pickActiveModalKey(courant) !== 'destin'
            || siegeDeLaCadence(courant) !== siege || !cadenceAutoCombat()) return;
          jouerPourLeSiege(courant, siege, () => courant.fenetreChoisir('destin', 'issue', eviter ? 'eviter' : 'survivre'));
        }, beatHold(get, 'autoResolve'));
      }
      return;
    case 'partial':
      autoResolveCascade(get, set, siege);
      return;
    case 'self':
      driveSelf(get, set, siege, pol.drive);
      return;
  }
}

/** Le jeton du tick d'auto-cadence planifié, par état (`Get`) : celui d'une partie suspendue vit sur sa plateforme (#4862). */
const tickPlanifie = new WeakMap<Get, Jeton>();

/**
 * Planifie un tick d'auto-cadence après une écriture de l'autorité en Rapide ou Auto. Le jeton
 * coalesce les réveils hors du cycle de `set` tant que la plateforme le garde en attente.
 */
export function planifierLeTickAuto(get: Get, set: Set): void {
  const planifie = tickPlanifie.get(get);
  if (!detientLAutoriteDuJeu(get()) || !cadenceAuto() || (planifie !== undefined && enAttente(planifie))) return;
  tickPlanifie.set(get, programmer(() => tickCombatAuto(get, set), 0));
}
