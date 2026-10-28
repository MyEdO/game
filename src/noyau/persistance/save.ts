/**
 * LA SAUVEGARDE, sa forme et ses décisions (#3041, Jalon 5) : l'instantané de l'état du JEU (`EtatDeJeu`, jamais
 * l'état d'affichage d'un hôte), sa validation au format courant, son élagage, son chargement en état de jeu et le
 * refus de l'écrire. La procédure sur les emplacements d'un stockage : `state/saves.ts`.
 *
 * Snapshot ZÉRO-MAINTENANCE : toute clé de `etatInitialDuJeu()` entre dans la save, hors `HORS_SAVE` ; aucune liste
 * de champs tenue à la main. Les règles maison (`engine/policy`, hors état) voyagent à part dans `rules`.
 *
 * FORMAT (#2404, `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`, #3041) : `version` vaut
 * `FORMAT_SAVE`, dérivé du type `SaveGame` (`scripts/gen-formats.mjs`). Toute autre forme est refusée
 * (`parseSave`), sans migration. Une save au format courant qui nomme une règle ou un État hors du registre courant
 * se CHARGE, élaguée de ces seuls ids (`elaguerSave`, #1463 LD.1).
 */
import type { RuleValue } from '../../engine/policy';
import { etatInitialDuJeu, initialNet, type EtatDeJeu } from '../etat';
import { pruneSeatAssignments } from '../monde/seating';
import { reposerPaquetDeCampagne } from '../monde/registreDesScenes';
import { elaguerLePersiste, rienDElague, type RetraitsDElagage } from './elagage';
import { FORMAT_SAVE } from './formats.generated';

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
 * exclusion qui n'est pas ici n'existe pas. La même couture sert le snapshot coop (`state/netFlow.ts`).
 */
const HORS_SAVE = {
  // #767 · #766
  campaignNarratif: 'couche runtime de projet, re-dérivée de `campaignDoc` (`reposerPaquetDeCampagne`, registreDesScenes.ts)',
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
export const HOUSE_RULES_KEY = '__houseRules';

/** Joint les règles maison au snapshot coop (sous la clé réservée). */
export function packHouseRules(data: Record<string, unknown>, rules: Record<string, RuleValue>): Record<string, unknown> {
  return { ...data, [HOUSE_RULES_KEY]: rules };
}

/** Sépare les règles maison du reste du snapshot coop (clé réservée retirée de `game`). */
export function unpackHouseRules(data: Record<string, unknown>): { game: Record<string, unknown>; rules?: Record<string, RuleValue> } {
  const { [HOUSE_RULES_KEY]: rules, ...game } = data;
  return { game, rules: rules as Record<string, RuleValue> | undefined };
}

/** Validation de forme d'une save (format COURANT + data objet). */
function isValidSave(s: unknown): s is SaveGame {
  return !!s && typeof s === 'object'
    && (s as SaveGame).version === FORMAT_SAVE
    && typeof (s as SaveGame).savedAt === 'string'
    && !!(s as SaveGame).data && typeof (s as SaveGame).data === 'object';
}

/** Lit un document de save parsé : la version DOIT être `FORMAT_SAVE`. Toute autre forme rend `null`. */
export function parseSave(parsed: unknown): SaveGame | null {
  return isValidSave(parsed) ? parsed : null;
}

/** La save prête à charger : ses surcharges de règles et les États portés par son groupe, élagués de ce que le
 *  registre courant ne connaît plus (`elaguerLePersiste`), et les ids retirés, à nommer au joueur. */
export function elaguerSave(save: SaveGame): { save: SaveGame; retraits: RetraitsDElagage } {
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
 * Charge `lue` (au `FORMAT_SAVE`, `parseSave`) : élaguée (#1463 LD.1), posée sur l'état initial du jeu, écran
 * campagne. La session réseau est celle de l'hôte qui charge, jamais celle figée dans la save : `initialNet()`.
 * L'assise de la scène est élaguée de ce que CE groupe ne porte plus (`pruneSeatAssignments`) ; une scène sans assise
 * n'en gagne pas le champ. Le paquet de campagne ré-enregistre ses scènes et re-dérive `HORS_SAVE`
 * (`reposerPaquetDeCampagne`).
 */
export function chargerLaSave(lue: SaveGame): SaveChargee {
  const { save, retraits } = elaguerSave(lue);
  const data = save.data;
  const scene = data.scene?.seatAssignments
    ? { ...data.scene, seatAssignments: pruneSeatAssignments(data.scene, (data.party ?? []).length) }
    : data.scene;
  const etat: EtatDeJeu = {
    ...etatInitialDuJeu(),
    ...data,
    ...(scene ? { scene } : {}),
    screen: 'campaign',
    net: initialNet(),
    ...reposerPaquetDeCampagne(data.campaignDoc),
  };
  return { etat, regles: save.rules, retraits: rienDElague(retraits) ? null : retraits };
}

/** Pourquoi une save ne s'écrit pas : en combat (l'état tactique suspendu n'est pas un point de reprise sûr), ou
 *  demandée par un autre siège que celui de l'hôte (0, `NetState`), chez qui la save vit. */
export type RefusDeSauvegarde = 'combat' | 'invite';

/** La raison de ne pas écrire la save de `etat` à la demande du siège `siege`, `null` si elle s'écrit. */
export function refusDeSauvegarde(etat: Pick<EtatDeJeu, 'battle'>, siege: number): RefusDeSauvegarde | null {
  if (etat.battle) return 'combat';
  return siege === 0 ? null : 'invite';
}
