/**
 * LA SAUVEGARDE, sa forme et ses décisions (#3041, Jalon 5) : l'instantané de l'état du JEU (`EtatDeJeu`, jamais
 * l'état d'affichage d'un hôte), sa validation au format courant, sa forme texte (lecture, export, import), son
 * élagage, son chargement en état de jeu et le refus de l'écrire. La procédure sur les emplacements d'un stockage : `hote/sauvegardes.ts`.
 *
 * Snapshot ZÉRO-MAINTENANCE : toute clé de `etatInitialDuJeu()` entre dans la save, hors `HORS_SAVE` ; aucune liste
 * de champs tenue à la main. Les règles maison (`engine/policy`, hors état) voyagent à part dans `rules`.
 *
 * FORMAT (#2404, `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`, #3041) : l'écriture prend
 * `FORMAT_SAVE`, dérivé du type `SaveGame` (`scripts/gen-formats.mjs`) ; la lecture n'admet que lui. Une save
 * qui nomme une règle, un État ou la Cible d'un Trait psychologique hors du registre courant se charge
 * élaguée de ces ids (`elaguerSave`, #1463 LD.1).
 */
import type { RuleValue } from '../../engine/policy';
import { weeklyCrewWageBrass } from '../../engine/crewMorale';
import { reecrireLesOps, walkFlow } from '../../engine/flowCore';
import { PORT_EVENTS } from '../../engine/seaVoyage';
import type { StakeRef } from '../../data';
import type { Flow } from '../../data/schemas/defs-scenes/effets';
import { etatInitialDuJeu, initialNet, type CampaignVessel, type EtatDeJeu } from '../etat';
import type { PendingCascade } from '../pendings';
import { bornerLesRegistresDuBord } from '../shipCrew';
import { opsDeRetourDEquipage } from '../navireOps';
import { pruneSeatAssignments } from '../monde/seating';
import { rencontreEngagee } from '../monde/combatants';
import { narratifDuPaquet } from '../monde/registreDesScenes';
import { elaguerLePersiste, rienDElague, type RetraitsDElagage } from './elagage';
import { FORMAT_SAVE } from './formats.generated';
import { exigerUnRefus, parseSceneDeProjet } from '../worldMap';
import { sceneEntitySchema } from '../../data/schemas/defs-scenes/scene';
import { EVT } from '../bus';
import type { Evenement } from '../partie';

export interface SaveMeta {
  version: string;
  /** ISO — horodatage réel de la sauvegarde (méta d'affichage). */
  savedAt: string;
  /** Étiquette du slot (nom de la scène courante). */
  sceneLabel: string;
  /** Horloge de jeu (minutes) au moment de la sauvegarde. */
  gameTime: number;
}

export interface SaveGame extends SaveMeta {
  data: DonneesDeSave;
  /** Surcharges de règles maison (`policy.ts`) actives à la sauvegarde. */
  rules: Record<string, RuleValue>;
}

/**
 * Les clés de `EtatDeJeu` qui ne partent PAS en save, une raison par clé. Le contrat du snapshot est POSITIF : une
 * exclusion qui n'est pas ici n'existe pas. La même couture sert l'instantané coop (`noyau/coop.ts`).
 */
const HORS_SAVE = {
  cadenceHote: 'cadence de table reçue dans la session coop',
  // #767 · #766
  campaignNarratif: 'couche runtime de projet, re-dérivée de `campaignDoc` (`narratifDuPaquet`, registreDesScenes.ts)',
} as const satisfies Partial<Record<keyof EtatDeJeu, string>>;

/** Le `data` d'une save : `EtatDeJeu` moins `HORS_SAVE`. */
export type DonneesDeSave = Omit<EtatDeJeu, keyof typeof HORS_SAVE>;

/** L'instantané de `etat` : ses clés de jeu (`etatInitialDuJeu`) hors `HORS_SAVE`, en copie JSON. */
export function snapshotSave(etat: EtatDeJeu, savedAt: string, rules: Readonly<Record<string, RuleValue>> = {}): SaveGame {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(etatInitialDuJeu()) as (keyof EtatDeJeu)[]) {
    if (k in HORS_SAVE) continue;
    const v = etat[k];
    data[k] = v === undefined ? null : v;
  }
  const copie = JSON.parse(JSON.stringify(data)) as DonneesDeSave;
  purgeFoldMemo(copie.pendingCascade);
  purgeFoldMemo(copie.suspendedCascades);
  return {
    version: FORMAT_SAVE,
    savedAt,
    sceneLabel: etat.scene?.label ?? etat.scene?.id ?? 'Sans scène',
    gameTime: etat.gameTime,
    data: copie,
    rules: { ...rules },
  };
}

/**
 * SECRET DES POSES — le mémo de pli d'une étape à table (`CascadeStep.foldMemo`, `cascade.tableStepResolved`) porte
 * les conséquences des dés EXPLORÉS PUIS ABANDONNÉS par le siège qui pose. Il ne quitte JAMAIS ce siège : ni dans la
 * sauvegarde, ni dans le snapshot coop, qui passe par `snapshotSave`. Un rechargement re-dérive le pli à la première
 * re-pose.
 */
function purgeFoldMemo(v: unknown): void {
  if (Array.isArray(v)) { for (const x of v) purgeFoldMemo(x); return; }
  if (!v || typeof v !== 'object') return;
  const o = v as Record<string, unknown>;
  delete o.foldMemo;
  for (const k of Object.keys(o)) purgeFoldMemo(o[k]);
}

/** Clé réservée du snapshot COOP qui transporte les règles maison (hors état). */
const HOUSE_RULES_KEY = '__houseRules';

/** Joint les règles maison au snapshot coop (sous la clé réservée). */
export function packHouseRules(data: Record<string, unknown>, rules: Record<string, RuleValue>): Record<string, unknown> {
  return { ...data, [HOUSE_RULES_KEY]: rules };
}

/** Sépare les règles maison du reste du snapshot coop (clé réservée retirée de `game`). */
export function unpackHouseRules(data: Record<string, unknown>): { game: Record<string, unknown>; rules?: Record<string, RuleValue> } {
  const { [HOUSE_RULES_KEY]: rules, ...game } = data;
  return { game, rules: rules as Record<string, RuleValue> | undefined };
}

/** Validation de l'enveloppe de sauvegarde à la lecture. */
function isValidSave(s: unknown): s is SaveGame {
  if (!s || typeof s !== 'object') return false;
  const { version, savedAt, data } = s as SaveGame;
  return version === FORMAT_SAVE
    && typeof savedAt === 'string'
    && !!data && typeof data === 'object';
}

/** Les métadonnées d'affichage de `save`. */
export function metaDeSave(save: SaveGame): SaveMeta {
  return { version: save.version, savedAt: save.savedAt, sceneLabel: save.sceneLabel, gameTime: save.gameTime };
}

/** CAUSE du rejet d'une sauvegarde — l'écran de chargement en fait un message DISTINCT : une save d'un
 *  autre format et un contenu illisible ne se disent pas d'un même mot. */
export const CAUSES_DE_REFUS_DE_SAVE = ['autreFormat', 'illisible', 'sceneInvalide'] as const;
export type ObsoleteCause = (typeof CAUSES_DE_REFUS_DE_SAVE)[number];

/** Un texte de save : la save au `FORMAT_SAVE`, ou la CAUSE de son refus. Source unique de la lecture d'un
 *  emplacement et de l'import. */
export function lireSave(brut: string): SaveGame | ObsoleteCause {
  let parsed: unknown;
  try {
    parsed = JSON.parse(brut);
  } catch {
    return 'illisible';
  }
  if (!isValidSave(parsed)) return 'autreFormat';
  if (scenesRefusees(parsed.data)) return 'sceneInvalide';
  return parsed;
}

/** Une scène de `data` (la courante, celles du paquet de campagne) est-elle refusée par la porte des scènes
 *  (`parseSceneDeProjet`), ou une entité qu'une instance de scène réinjecte (`SceneMutation.entitesChangees`) par la porte
 *  des entités (`sceneEntitySchema`) ? */
function scenesRefusees(data: DonneesDeSave): boolean {
  const scenes = [...(data.scene ? [data.scene] : []), ...(data.campaignDoc?.scenes ?? [])];
  const entites = Object.values(data.sceneInstances ?? {}).flatMap((m) => m.entitesChangees ?? []);
  if (!entites.every((e) => sceneEntitySchema.safeParse(e).success)) return true;
  try {
    for (const s of scenes) parseSceneDeProjet(s);
    return false;
  } catch (e) {
    exigerUnRefus(e);
    return true;
  }
}

/** L'export d'une save : JSON lisible (téléchargement, presse-papier). */
export function exporterLaSauvegarde(save: SaveGame): string {
  return JSON.stringify(save, null, 2);
}

/** La save prête à charger : ses surcharges de règles, les États et Traits psychologiques portés par son groupe, élagués de ce que le
 *  registre courant ne connaît plus (`elaguerLePersiste`), et les ids retirés, à nommer au joueur. */
function elaguerSave(save: SaveGame): { save: SaveGame; retraits: RetraitsDElagage } {
  const party = Array.isArray(save.data.party) ? save.data.party : undefined;
  const { regles, porteurs, retraits } = elaguerLePersiste({ regles: save.rules ?? {}, porteurs: party ?? [] });
  return { save: { ...save, rules: regles, data: party ? { ...save.data, party: porteurs } : save.data }, retraits };
}

/** Une save chargée : l'état de jeu à ouvrir (`creerPartie`), ses règles maison, et ce que l'élagage a retiré
 *  (`null` : rien). */
export interface SaveChargee {
  etat: EtatDeJeu;
  regles: Record<string, RuleValue>;
  retraits: RetraitsDElagage | null;
}

/**
 * Charge `lue` (au `FORMAT_SAVE`, `lireSave`) : élaguée (#1463 LD.1), posée sur l'état initial du jeu, écran
 * campagne. La session réseau est celle de l'hôte qui charge, jamais celle figée dans la save : `initialNet()`.
 * L'assise de la scène est élaguée de ce que CE groupe ne porte plus (`pruneSeatAssignments`) ; une scène sans assise
 * n'en gagne pas le champ. Le paquet de campagne re-dérive `HORS_SAVE` (`narratifDuPaquet`) ; ses scènes s'enregistrent
 * à l'ouverture de la partie sur l'état chargé (`ouvrirLeProprietaire`).
 */
export function chargerLaSave(lue: SaveGame): SaveChargee {
  const { save, retraits } = elaguerSave(lue);
  const data = save.data;
  const scene = data.scene?.seatAssignments
    ? { ...data.scene, seatAssignments: pruneSeatAssignments(data.scene, (data.party ?? []).length) }
    : data.scene;
  const vessel = data.vessel ? bornerLesRegistresDuBord(data.vessel) : null;
  const reprise = data.vessel && vessel && vessel !== data.vessel ? reprendreUnRetourDEquipageAncien(data, data.vessel, vessel) : {};
  const conseil = vessel && vessel !== data.vessel && data.pendingCouncil?.phase === 'choix'
    ? { ...data.pendingCouncil, wageBrass: weeklyCrewWageBrass(vessel.crew) }
    : data.pendingCouncil ?? null;
  const etat: EtatDeJeu = {
    ...etatInitialDuJeu(),
    ...data,
    ...reprise,
    ...(scene ? { scene } : {}),
    vessel,
    pendingCouncil: conseil,
    screen: 'campaign',
    net: initialNet(),
    ...narratifDuPaquet(data.campaignDoc),
  };
  return { etat, regles: save.rules, retraits: rienDElague(retraits) ? null : retraits };
}

function enjeuDeRetourDEquipage(enjeu: StakeRef | undefined): boolean {
  const cle = enjeu && 'key' in enjeu ? enjeu.key : undefined;
  return cle?.dataset === 'voyage' && cle.entryCategory === 'seaPortEvents'
    && PORT_EVENTS.some((evenement) => evenement.id === cle.entryId && !!evenement.liaisonEquipage);
}

function contientUnEnjeuDeRetourDEquipage(flow: Flow | undefined): boolean {
  let trouve = false;
  if (flow) walkFlow(flow, (n) => { if (n.kind === 'test' && enjeuDeRetourDEquipage(n.test.stake)) trouve = true; });
  return trouve;
}

/** MDG 15 l.245 */
function reprendreUnRetourDEquipageAncien(data: DonneesDeSave, avant: CampaignVessel, apres: CampaignVessel): Partial<DonneesDeSave> {
  const lier = (flow: Flow | undefined): Flow | undefined => flow && reecrireLesOps(flow, (o) =>
    o.op === 'equipage' && typeof o.delta === 'number' && o.delta > 0 && o.role === undefined
      ? opsDeRetourDEquipage(avant, apres, o.delta) : o);
  const reprendre = (cascade: PendingCascade): PendingCascade => ({
    ...cascade,
    participants: cascade.participants.map((etape) => {
      const meta = etape.meta;
      if (!meta || etape.kind !== 'choixDeFlux'
        || !(contientUnEnjeuDeRetourDEquipage(meta.choiceYes) || contientUnEnjeuDeRetourDEquipage(meta.choiceNo))) return etape;
      return { ...etape, meta: { ...meta, choiceYes: lier(meta.choiceYes), choiceNo: lier(meta.choiceNo) } };
    }),
  });
  const cascade = data.pendingCascade;
  const test = data.pendingTest;
  const courant = cascade?.participants[cascade.cursor];
  return {
    pendingCascade: cascade ? reprendre(cascade) : null,
    ...(data.suspendedCascades?.length ? { suspendedCascades: data.suspendedCascades.map(reprendre) } : {}),
    ...(test && enjeuDeRetourDEquipage(courant?.stake) ? { pendingTest: { ...test, onSuccess: lier(test.onSuccess) } } : {}),
  };
}

/** Si l'événement `e` d'un appel pose un point de reprise, que l'hôte garde à son emplacement automatique : l'arrivée
 *  du groupe dans une autre scène de la partie en cours. */
export const estUnPointDeReprise = (e: Evenement): boolean => e.type === 'emis' && e.evt === EVT.ARRIVEE_EN_SCENE && !e.payload.neuve;

/** Pourquoi une save ne s'écrit pas : en combat ou pendant une série d'attaques subies (`serieSubie`) — l'état
 *  tactique suspendu n'est pas un point de reprise sûr —, ou demandée par un autre siège que celui de l'hôte (0,
 *  `NetState`), chez qui la save vit. */
export type RefusDeSauvegarde = 'combat' | 'invite';

/** La raison de ne pas écrire la save de `etat` à la demande du siège `siege`, `null` si elle s'écrit. */
export function refusDeSauvegarde(etat: Pick<EtatDeJeu, 'battle' | 'serieSubie'>, siege: number): RefusDeSauvegarde | null {
  if (rencontreEngagee(etat)) return 'combat';
  return siege === 0 ? null : 'invite';
}

/** Si le point de reprise de `etat` se garde pour le siège `siege` : la partie d'une campagne lancée
 *  (`CampaignDoc.projet`), jamais celle d'un scénario de test ni d'un essai, et que rien ne refuse d'écrire
 *  (`refusDeSauvegarde`). */
export function pointDeRepriseAGarder(etat: Pick<EtatDeJeu, 'battle' | 'serieSubie' | 'campaignDoc'>, siege: number): boolean {
  return etat.campaignDoc?.projet != null && refusDeSauvegarde(etat, siege) === null;
}
