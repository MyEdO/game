/**
 * Pilote d'AUTO-CADENCE (« Cadence de combat » Rapide / Auto-combat) — brique FEUILLE.
 *
 * `tickCombatAuto` regarde la modale ACTIVE (`pickActiveModalKey`) et, si le mode l'autorise et qu'elle
 * est pilotée LOCALEMENT, la résout en enchaînant ses résolveurs de store — SANS jamais toucher aux
 * actions d'influence (`reroll`/`forceSuccess`/`darkPact`/`bonusSL`) → « zéro dépense » par construction.
 *
 * Deux couches de politique (cf. critique : la granularité réelle des jets de combat est l'étape de
 * cascade, pas une clé modale) :
 *  - `MODAL_DEFS.auto` (modalArbiter) pour les modales STANDALONE (frénésie, course, focalisation, Destin…) ;
 *  - `JET_AUTO` (ici) pour les étapes-JET de la `cascade` de COMBAT (attaque/défense/… bespoke) — leur
 *    résolution passe par leur propre flux (`jetRoll(flux)`→`jetConfirm(flux)`, qui fait avancer la cascade), PAS par le
 *    résolveur générique `cascadeResolveAll` (réservé aux jets de NUIT/VOYAGE, qui ont un `target`).
 *
 * Module FEUILLE : n'importe RIEN de `combatFlow` ; tout passe par `get().xxx`. INERT tant que la chaîne
 * de reprise (C3/C4) ne l'appelle pas — `cadenceAuto()` est faux par défaut (mode « manuel »).
 */
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { CascadeStep } from './pendings';
import { pickActiveModalKey, modalOwnerOf, autoPolicyOf, modaleActive, pendingOuvert, HORS_MODAL, MODAL_DEFS, AUCUN_VERBE_DE_JOUEUR, cleDuGeste, type AutoPolicy, type FenetreQuiSeFerme, type GesteDuJeu, type HorsModalDef, type ModalDef, type RangeeDeFenetre, type VerbesDeFenetre } from './modalArbiter';
import { maladresseCourante, stepInteraction } from './cascade';
import { FLOW_VERBS, NOM_DU_VERBE_DE_JET, type FlowKey, type FlowVerbs } from './flowVerbs';
import { influencesLocally } from './netOwnership';
import { seatOwns } from './sieges';
import { cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { beatHold } from './combatDirector';
import { programmer, enAttente, type Jeton } from './plateforme';
import { fateSaveOptions } from '../engine/fortune';
import { sequence } from '../engine/sequences';
import { REGLAGES_DE_L_ATTAQUE, REGLAGES_DE_LA_DEFENSE, reglageDeLaQuantite, reglageDuChoix, type Reglage } from './reglages';

/**
 * Politique d'auto-résolution par TYPE de jet de cascade de COMBAT. `self` = jet propre piloté par son
 * flux bespoke (`drive` = roll → confirm, qui avance la cascade) ; `choice` = vrai choix laissé au joueur
 * en Rapide (Surincantation, menu de Désengagement) ou multi-participant rare (Test étendu, Enfoncer la
 * porte) — tranché par l'IA en Auto-combat (C4). Record total : ajouter un `jet` force une politique.
 */
export const JET_AUTO: Record<NonNullable<CascadeStep['jet']>, AutoPolicy> = {
  attack: { mode: 'self', drive: [{ verbe: 'jetRoll', flux: 'attack' }, { verbe: 'jetConfirm', flux: 'attack' }] },
  defense: { mode: 'self', drive: [{ verbe: 'jetRoll', flux: 'defense' }, { verbe: 'jetConfirm', flux: 'defense' }] },
  fumble: { mode: 'self', drive: [{ verbe: 'jetRoll', flux: 'fumble' }, { verbe: 'jetConfirm', flux: 'fumble' }] },
  test: { mode: 'self', drive: [{ verbe: 'jetRoll', flux: 'test' }, { verbe: 'jetConfirm', flux: 'test' }] },
  cast: { mode: 'choice', autoDrive: [{ verbe: 'jetRoll', flux: 'cast' }, { verbe: 'jetConfirm', flux: 'cast' }] }, // Rapide : le joueur décide (surincantation) ; Auto-combat : l'IA incante (sans surincanter)
  disengage: { mode: 'choice' },  // menu d'options (Fuir / Esquiver) — initié par le joueur, n'arrive pas en Auto
  extended: { mode: 'choice' },   // multi-participant (rare en combat)
  forceDoor: { mode: 'choice' },  // multi groupOwner (rare en combat)
};

/** Une rangée d'une fenêtre réactive, vue par le pilote : son porteur, son état de jet, sa déclaration. */
type RangeeReactive = RangeeDeFenetre & { declared?: string };

/** Une FENÊTRE RÉACTIVE qu'une étape-jet ouvre en son sein : son flux de jet multi, ses rangées (`undefined` :
 *  fermée), et le drive d'auto-cadence qui la résout (`stepWindowDrive` ; absent : l'étape garde le sien). */
interface FenetreReactive { flux: FlowKey; rangees: (s: Jeu) => readonly RangeeReactive[] | undefined; drive?: readonly GesteDuJeu[] }

/** Le flux de jet (`FLOW_VERBS`) de chaque étape-jet de COMBAT : ses verbes (pose du dé, relance, Fortune…)
 *  s'ajoutent à son drive. Un flux multi déclare ses `rangees`, que ses verbes
 *  désignent par leur id (`pid`). `reglages` : les actions `<flux>Set…` qui règlent le jet en attente, verbes de la
 *  fenêtre comme les autres. `reactives` : les fenêtres que l'étape ouvre en son sein, dans l'ordre de la chaîne
 *  réelle (`resolveCastChain` : le Contre-sort précède l'opposition). Record total : un `jet` neuf nomme son flux. */
export const FENETRE_DU_JET: Record<NonNullable<CascadeStep['jet']>, { flux: FlowKey; rangees?: (s: Jeu) => readonly RangeeDeFenetre[] | undefined; reglages?: readonly (keyof ActionsDuNoyau)[]; reactives?: readonly FenetreReactive[] }> = {
  attack: { flux: 'attack', reglages: REGLAGES_DE_L_ATTAQUE },
  defense: { flux: 'defense', reglages: REGLAGES_DE_LA_DEFENSE },
  fumble: { flux: 'fumble', rangees: (s) => { const m = maladresseCourante(s.pendingCascade); return m && [{ id: m.id, result: m.fumble.result }]; } },
  cast: {
    flux: 'cast',
    reglages: ['castSetCritChoice', 'castSetConjureForm', 'castSetDiscreet', 'castSetChosenTableRolls'],
    reactives: [
      // Contre-sort : la fenêtre a une PHASE 1 de déclaration (#1042/#1059) — la cadence déclare les
      // rangées de CE siège (« contrer seul » = le geste que le joueur posait en lançant) avant de rouler.
      { flux: 'counterspell', rangees: (s) => s.pendingCounterspell?.participants, drive: [{ verbe: 'counterspellDeclareAll' }, { verbe: 'jetRoll', flux: 'counterspell' }, { verbe: 'jetConfirm', flux: 'counterspell' }] },
      { flux: 'opposition', rangees: (s) => s.pendingCastOpposition?.participants, drive: [{ verbe: 'jetRoll', flux: 'opposition' }, { verbe: 'jetConfirm', flux: 'opposition' }] },
    ],
  },
  test: { flux: 'test', reglages: ['testSetActor'] },
  extended: { flux: 'extendedTest', rangees: (s) => s.pendingExtendedTest?.rounds },
  disengage: {
    flux: 'disengage',
    reactives: [{ flux: 'flee', rangees: (s) => s.pendingDisengage?.fuir?.participants.map((p) => ({ id: p.id, interactive: p.interactive, result: p.kind === 'backstab' ? p.result : p.jet })) }],
  },
  forceDoor: { flux: 'forceDoor', rangees: (s) => s.pendingForceDoor?.participants },
};

/** L'id de la rangée DUE (la première qui se joue et n'a pas de résultat), sinon de la première : le `pid` que la
 *  fenêtre rend. */
const idDeLaRangeeDue = (rangees: readonly RangeeDeFenetre[] | undefined): string | undefined =>
  (rangees?.find((r) => r.interactive !== false && !r.result) ?? rangees?.[0])?.id;

/** Les gestes nommés par les seuls verbes `verbes` (aucun ne vise un flux de jet). */
const nommes = (verbes: VerbesDeFenetre): GesteDuJeu[] => verbes.map((verbe) => ({ verbe }));

/** Les gestes d'un flux de jet : chacun de ses verbes de jet sur lui (`NOM_DU_VERBE_DE_JET`), clôture comprise. */
const gestesDuFlux = (cle: FlowKey): GesteDuJeu[] => {
  const flux: FlowVerbs = FLOW_VERBS[cle];
  return flux.verbs.map((v) => ({ verbe: NOM_DU_VERBE_DE_JET[v], flux: cle }));
};

/** La navigation de la cascade, jugée sur sa clôture : valider l'étape, tout résoudre, terminer le bilan (sa sortie). */
export const NAVIGATION_DE_CASCADE: readonly GesteDuJeu[] = [{ verbe: 'cascadeNext' }, { verbe: 'cascadeResolveAll' }, { verbe: 'fenetreFermer', fenetre: 'cascade' }];

/** Les gestes `gestes`, chacun une fois (`cleDuGeste`), dans leur premier ordre. */
const uniques = (gestes: readonly GesteDuJeu[]): GesteDuJeu[] => [...new Map(gestes.map((g) => [cleDuGeste(g), g])).values()];

/** L'id d'étape (`pid`) que prennent les verbes de l'étape courante. */
const idDEtape = (e: CascadeStep): string => e.id;
/** Le `pid` des verbes d'un flux de cascade : l'id de la rangée due quand il est porté par l'acteur (`pidIsActor`),
 *  sinon l'id de l'étape. */
const pidDuFlux = (cle: 'cascade' | 'cascadeBatch') => (e: CascadeStep): string | undefined =>
  (FLOW_VERBS[cle].pidIsActor ? idDeLaRangeeDue(e.participants) : e.id);
/** L'interaction d'étape que joue le flux de cascade `cle` : son flux, ses verbes et leur `pid`. */
const joueePar = (cle: 'cascade' | 'cascadeBatch') => ({ flux: cle, gestes: gestesDuFlux(cle), pid: pidDuFlux(cle) });

/** L'interaction d'étape que règle le seul verbe `verbe`, qui prend l'id d'étape puis l'argument que `lecture` règle. */
const regleePar = (verbe: keyof ActionsDuNoyau, lecture: (v: keyof ActionsDuNoyau) => (e: CascadeStep) => Reglage) =>
  ({ gestes: nommes([verbe]), pid: idDEtape, reglage: lecture(verbe) });

/** Les gestes d'une étape de cascade sans jet de COMBAT, par son interaction (`stepInteraction`), l'id qu'ils désignent
 *  (`pid`), le réglage de l'argument qui suit (`reglage` : les clés d'un choix, les bornes d'une quantité) et le flux de
 *  jet qui la joue (`flux`). Record total : une interaction neuve nomme ses gestes. */
export const VERBES_D_INTERACTION: Record<ReturnType<typeof stepInteraction>, { gestes: readonly GesteDuJeu[]; pid: (e: CascadeStep) => string | undefined; reglage?: (e: CascadeStep) => Reglage; flux?: FlowKey }> = {
  jet: joueePar('cascade'),
  batch: joueePar('cascadeBatch'),
  table: { flux: 'cascadeTirage', gestes: gestesDuFlux('cascadeTirage'), pid: idDEtape },
  de: { flux: 'cascadeTirage', gestes: gestesDuFlux('cascadeTirage'), pid: idDEtape },
  quantite: regleePar('cascadeAmount', reglageDeLaQuantite),
  choix: regleePar('cascadeChoose', reglageDuChoix),
  affichage: { gestes: AUCUN_VERBE_DE_JOUEUR, pid: () => undefined },
};

const gestesDuDrive = (pol: AutoPolicy): readonly GesteDuJeu[] => (pol.mode === 'self' ? pol.drive : pol.mode === 'choice' ? (pol.autoDrive ?? []) : []);

/** Le geste de sortie d'une fenêtre qui déclare la sienne (`sortie`) : `fenetreFermer`, la fenêtre en argument. */
const sortieDe = (def: ModalDef | HorsModalDef): GesteDuJeu[] => (def.sortie ? [{ verbe: 'fenetreFermer', fenetre: def.key as FenetreQuiSeFerme }] : []);

/** Les gestes qu'une fenêtre DÉCLARE : le drive (ou l'`autoDrive`) de sa politique ou ses `intents`, les gestes de ses
 *  `flux`, ses `verbes`, puis sa sortie. */
export function gestesDeLaFenetre(def: ModalDef | HorsModalDef): readonly GesteDuJeu[] {
  const premiers = 'auto' in def ? gestesDuDrive(def.auto) : nommes(def.intents ?? []);
  return uniques([...premiers, ...(def.flux ?? []).flatMap(gestesDuFlux), ...nommes(def.verbes ?? []), ...sortieDe(def)]);
}

/** Les gestes d'une étape-jet de COMBAT : son drive (`JET_AUTO`), ou celui de la fenêtre réactive ouverte dans l'étape
 *  (`reactive`), puis les gestes de son flux, ceux du flux de la fenêtre réactive, et ses réglages (`FENETRE_DU_JET`). */
export function gestesDuJet(jet: NonNullable<CascadeStep['jet']>, reactive?: FenetreReactive): readonly GesteDuJeu[] {
  const { flux, reglages = [] } = FENETRE_DU_JET[jet];
  return uniques([...(reactive?.drive ?? gestesDuDrive(JET_AUTO[jet])), ...gestesDuFlux(flux), ...(reactive ? gestesDuFlux(reactive.flux) : []), ...nommes(reglages)]);
}

/** Les clés que `fenetreDuJeu` peut rendre : chaque modale (`MODAL_DEFS`), puis chaque situation hors modale (`HORS_MODAL`). */
export const CLES_DE_FENETRE: readonly string[] = [...MODAL_DEFS.map((d) => d.key), ...HORS_MODAL.map((d) => d.key)];

/** La fenêtre qui tient la main : sa clé, son propriétaire, ses gestes, les flux de jet qui les jouent (`flux`, celui
 *  que sa politique résout en tête), l'id que ses gestes désignent (`pid` : l'étape de cascade courante, ou la rangée
 *  due d'une fenêtre à plusieurs jets ; `argumentsPosesDuGeste`), les gestes que sa politique enchaîne pour la résoudre
 *  (`drive`, `AutoPolicy` : le jet, puis sa clôture), et l'étape de cascade courante quand la cascade tient la main. */
export interface FenetreDuJeu {
  cle: string;
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
 *  toute autre étape et le bilan, les gestes de son interaction (`VERBES_D_INTERACTION`) puis les clôtures de la
 *  cascade (`NAVIGATION_DE_CASCADE`), et pour une interaction jouée par un flux de jet le drive « le jet, puis valider
 *  l'étape » ; sinon la première situation `HORS_MODAL` ouverte (`pendingOuvert`)
 *  qui tient la main, avec ses gestes déclarés. L'étape de cascade courante est rendue avec la cascade.
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
      return { cle, proprietaire, gestes: gestesDuJet(etape.jet, reactive), flux: [...(reactive ? [reactive.flux] : []), flux], ...avecPid(idDeLaRangeeDue(reactive ? reactive.rangees(s) : rangees?.(s))), drive: reactive?.drive ?? gestesDuDrive(JET_AUTO[etape.jet]), etape };
    }
    const parInteraction = etape ? VERBES_D_INTERACTION[stepInteraction(etape)] : null;
    const flux = parInteraction?.flux;
    return { cle, proprietaire, gestes: uniques([...(parInteraction?.gestes ?? []), ...NAVIGATION_DE_CASCADE]), flux: flux ? [flux] : [], ...avecPid(etape && parInteraction?.pid(etape)), ...(flux ? { drive: [{ verbe: NOM_DU_VERBE_DE_JET.roll, flux }, { verbe: 'cascadeNext' }] } : {}), ...(etape ? { etape } : {}) };
  }
  const hors = (HORS_MODAL as readonly HorsModalDef[]).find((d) => d.tientLaMain && pendingOuvert(s[d.pendingKey]));
  return hors ? { cle: hors.key, proprietaire: hors.owner(s), gestes: gestesDeLaFenetre(hors), flux: hors.flux ?? [] } : null;
}

/**
 * FENÊTRES RÉACTIVES à drive ouvertes DANS l'étape `jet:'cast'` (Contre-sort #1028, opposition de cible #949,
 * `FENETRE_DU_JET.cast.reactives`) et leur drive d'auto-cadence (#1030). Le drive de l'ÉTAPE ne peut traverser ni l'une ni l'autre :
 * `jetConfirm('cast')` s'abstient sous Contre-sort (la Dissipation se résout AVANT, `LDB 46 l.156`) et
 * `jetConfirm('opposition')` refuse d'agréger tant qu'une rangée interactive n'a pas jeté — `autoDrive` y
 * re-tirait donc à vide (l'opposition allant jusqu'à se RÉOUVRIR à chaque passage, jets compris).
 * POLITIQUE du drive (pas une règle) : chaque rangée jouable ICI jette, puis « Appliquer » — les issues
 * restent tranchées par les agrégations canoniques (`jetConfirm('counterspell')` #1040, `jetConfirm('opposition')`),
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
 * sièges — donc `ownerLocal` ne dit RIEN de la fenêtre. Un siège qui « appliquerait » une fenêtre dont
 * une rangée DUE appartient à un autre (le MJ, un autre joueur) la refermerait SANS son jet : sa
 * Dissipation/son Test opposé seraient forfaits. La fenêtre ne se drive donc que si TOUTE rangée
 * encore due est influençable ICI ; sinon elle ATTEND son siège, exactement comme en manuel — et le
 * pilote ne planifie AUCUN beat (pas de poll) : c'est le jet distant, appliqué par le réseau, qui
 * change l'état et re-déclenche le tick (`planifierLeTickAuto`).
 */
const ATTENDRE = 'attendre';
function stepWindowDrive(s: Jeu): readonly GesteDuJeu[] | typeof ATTENDRE | null {
  for (const w of STEP_WINDOW_AUTO) {
    const rows = w.rangees(s);
    if (!rows) continue;
    // Rangée RÉGLÉE = jetée, PASSÉE (déclaration terminale : elle ne jettera pas) ou non surfacée.
    return rows.every((p) => p.result || p.declared === 'pass' || !p.interactive || influencesLocally(s, p.id)) ? w.drive : ATTENDRE;
  }
  return null; // aucune fenêtre ouverte : l'étape garde son propre drive
}

/** Jeton anti-ré-entrance / double-advance : chaque séquence lancée invalide les précédentes. */
const generations = sequence();

/**
 * Le SIÈGE LOCAL possède-t-il la modale active ? MÊME routage que la validation d'intent
 * (`seatOwns`/`intentAllowedFor`) : un ennemi/une étape MONDE appartient au siège MJ (`gmSeat`) quand il
 * existe, jamais « à l'hôte par défaut » — sinon l'hôte auto-résout en Rapide une fenêtre dont le MJ
 * tient la main. Solo (`net` par défaut : mySeat 0, aucun ownership, pas de MJ) : inchangé, tout est à
 * soi. `null`/`'*'` = aucun concerné / moment partagé → résolu localement, comme avant.
 */
function ownerLocal(s: Jeu): boolean {
  const owner = modalOwnerOf(s);
  if (owner == null || owner === '*') return true; // hôte / moment partagé (résolu par l'hôte)
  return seatOwns(s, s.net.mySeat, owner);
}

/** Enchaîne les gestes `drive` (roll → confirm…) sur des ticks espacés, chacun sur son flux, puis re-tick pour la suite. */
function driveSelf(get: Get, set: Set, drive: readonly GesteDuJeu[]): void {
  const myGen = generations.suivant();
  let i = 0;
  const step = () => {
    if (myGen !== generations.courant()) return;                 // supersédé par un tick plus récent
    if (!ownerLocal(get())) return;
    if (i >= drive.length) { tickCombatAuto(get, set); return; } // séquence finie → continuer (étape/modale suivante)
    const g = drive[i++];
    const fn = get()[g.verbe] as undefined | ((flux?: FlowKey) => void);
    if (typeof fn === 'function') fn(g.flux);  // roll() idempotent, puis confirm() (ferme/avance)
    programmer(step, beatHold(get, 'autoResolve'));
  };
  step();
}

/** Auto-résout la cascade active : jet de COMBAT bespoke (JET_AUTO) ou jet générique nuit/voyage. */
function autoResolveCascade(get: Get, set: Set): void {
  const pc = get().pendingCascade;
  if (!pc) return;
  if (pc.cursor >= pc.participants.length) {
    // BILAN : combat → fermer ; voyage/nuit/test → laisser le RÉSUMÉ au joueur (« Terminer »).
    if (pc.purpose === 'combat') get().fenetreFermer('cascade');
    return;
  }
  const cur = pc.participants[pc.cursor];
  if (cur.jet) {
    const pol = JET_AUTO[cur.jet];
    if (pol.mode === 'self') { driveSelf(get, set, pol.drive); return; }
    // 'choice' (cast/disengage/…) : en Auto-combat, l'IA résout via `autoDrive` (incantation) ; en Rapide,
    // on LAISSE la modale au joueur (surincantation = vrai choix). Une fenêtre RÉACTIVE ouverte dans
    // l'étape prend la main sur son drive, et `ATTENDRE` = fenêtre d'un AUTRE siège : on ne touche à
    // RIEN et on ne planifie aucun beat (`STEP_WINDOW_AUTO`/`stepWindowDrive` ci-dessus).
    if (pol.mode === 'choice' && cadenceAutoCombat()) {
      const w = stepWindowDrive(get());
      if (w === ATTENDRE) return;
      const drive = w ?? pol.autoDrive;
      if (drive) driveSelf(get, set, drive);
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
      get().cascadeChoose(cur.id, cur.defaultChoice);
    }
    // Combat : avancer d'UNE étape (comme le joueur) → les étapes-jet en aval (Maladresse…) gardent leur
    // driver bespoke au tick suivant, au lieu d'être écrasées par un `cascadeResolveAll` global.
    if (pc.purpose === 'combat') { get().cascadeNext(); programmer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve')); return; }
  }
  get().cascadeResolveAll();
  programmer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve')); // gérer le bilan / l'étape suivante
}

/** Une étape de cascade sera-t-elle auto-résolue ? (sert à MASQUER la modale, cf. `willAutoResolve`). */
function stepAutoResolved(s: Jeu, step: CascadeStep): boolean {
  if (step.jet) {
    const pol = JET_AUTO[step.jet];
    if (pol.mode === 'self') return true;
    if (pol.mode !== 'choice' || !cadenceAutoCombat()) return false;
    const w = stepWindowDrive(s);
    if (w === ATTENDRE) return false; // fenêtre d'un AUTRE siège : elle RESTE visible (elle n'est pas résolue ici)
    return !!(w ?? pol.autoDrive); // incantation en Auto
  }
  if (stepInteraction(step) === 'choix') return cadenceAutoCombat() && step.defaultChoice != null; // choix : auto SEULEMENT si un défaut est authoré (sinon décision au joueur, pas de hang)
  return true; // jet/affichage générique (nuit/voyage) → cascadeResolveAll
}

/**
 * La modale ACTIVE va-t-elle être auto-résolue par le driver ? PURE (zéro effet) — lue par `ActiveModal`
 * pour NE PAS la rendre du tout (fini le flash de quelques ms en Rapide/Auto). On NE masque PAS : le BILAN
 * d'une cascade voyage/nuit (le joueur veut voir le résumé), ni un vrai choix laissé au joueur (surincantation
 * ou Destin en Rapide), ni la modale d'un combattant non piloté localement (coop).
 */
export function willAutoResolve(s: Jeu): boolean {
  if (!cadenceAuto() || !ownerLocal(s)) return false;
  const pol = autoPolicyOf(s);
  if (!pol) return false;
  switch (pol.mode) {
    case 'hostOnly': return false;
    case 'self': return true;
    case 'choice': return cadenceAutoCombat() && (pickActiveModalKey(s) === 'fateSave' || !!pol.autoDrive);
    case 'partial': {
      const pc = s.pendingCascade;
      if (!pc) return false;
      if (pc.cursor >= pc.participants.length) return pc.purpose === 'combat'; // bilan : combat masqué ; voyage/nuit MONTRÉ
      return stepAutoResolved(s, pc.participants[pc.cursor]);
    }
  }
}

/**
 * TICK du pilote d'auto-cadence. Appelé depuis la chaîne de reprise GARDÉE (C3/C4) — JAMAIS un pilote
 * async parallèle. No-op hors Rapide/Auto, sur une modale non pilotée localement, ou `hostOnly`/`choice`
 * (le `choice` en Auto-combat est tranché par `runActorAI` / la politique Destin — C4).
 */
export function tickCombatAuto(get: Get, set: Set): void {
  if (!cadenceAuto()) return;
  const s = get();
  if (!ownerLocal(s)) return;
  const pol = autoPolicyOf(s);
  if (!pol) return;
  switch (pol.mode) {
    case 'hostOnly':
      return;
    case 'choice':
      // Auto-combat seul : le Sauvetage par Destin est dépensé automatiquement pour éviter la mort,
      // `negate` s'il est offert (`fateSaveOptions`), sinon `survive`. En Rapide, on NE touche PAS (la
      // modale reste — vrai choix du joueur).
      if (cadenceAutoCombat() && pickActiveModalKey(s) === 'fateSave' && s.pendingFateSave) {
        const negate = fateSaveOptions(s.pendingFateSave.source).includes('negate');
        programmer(() => (negate ? get().fateNegate() : get().fateSurvive()), beatHold(get, 'autoResolve'));
      }
      return;
    case 'partial':
      autoResolveCascade(get, set);
      return;
    case 'self':
      driveSelf(get, set, pol.drive);
      return;
  }
}

/**
 * Planifie un tick d'auto-cadence après un changement d'état : rien en mode manuel (défaut, zéro
 * overhead), sinon UN tick hors du cycle de `set`, coalescé sur son jeton tant que la plateforme le dit
 * en attente : un tick annulé par l'hôte n'en bloque aucun autre. L'hôte l'appelle à chaque écriture
 * (`initCombatAuto`, `src/state/store.ts`).
 */
let tickPlanifie: Jeton | null = null;
export function planifierLeTickAuto(get: Get, set: Set): void {
  if (!cadenceAuto() || (tickPlanifie !== null && enAttente(tickPlanifie))) return;
  tickPlanifie = programmer(() => tickCombatAuto(get, set), 0);
}
