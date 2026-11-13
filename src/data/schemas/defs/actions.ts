/** LDB 13 l.106. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { blocageDeLivraison, foyerDeRegleSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'actions.json';
export const famille = 'entite';

/** RENDEUR d'accueil PAR DÉFAUT (spec §1a / §1c-bis / zone 4). Le placement joueur reste libre :
 *  ce champ dit d'où l'action NAÎT quand rien n'a été posé — et il nomme un rendeur RÉEL, mesuré au
 *  DOM par le contrat « surface ⇄ rendeur ». Correspondances :
 *   • `deduite-du-set` / `geste-d-etat` → la travée GAUCHE (`.cc-bay-left` : cases déduites du set,
 *     rubrique ACCÈS RAPIDE) ; `geste-d-etat` = la case G6bis (spec §1a) : ce que l'ÉTAT du porteur
 *     ouvre, pas ce que son arme offre ;
 *   • `grille` → la travée DROITE (`.cc-bay-right`), grille de capacités ;
 *   • `gouttiere-arche` → la GOUTTIÈRE de ressource de l'arche (`.cc-gutter`) : le geste adossé à la
 *     jauge qu'il défait (spec §1c) ;
 *   • `selecteur-de-sets` → la COLONNE de vignettes de sets (`.cc-sets`) : chaque vignette commute
 *     SON set ;
 *   • `coin-de-tour` → le coin de fin de tour (`.cc-corner`), isolé des deux travées ;
 *   • `bandeau-de-phase` → le bandeau `.cc-phase` HORS ciblage : la pause d'initiative de Round ;
 *   • `interlude` → le MÊME bandeau, pendant un ciblage par la carte : l'action s'affiche tant que
 *     le mode courant (`currentTargetingMode`) est celui de son `mode`, et SON geste est la
 *     SORTIE de ce ciblage. Elle exige donc `mode`, `run` et `exitSafe` ;
 *   • `pastille-etat` → la PASTILLE de l'État concerné dans la niche d'États (`StateChips`, slot
 *     `action`) : la réaction que cet État ouvre vit sur LUI (arbitrage HUD 2026-08-16) ;
 *   • `pastille-entite` → la pastille de l'ENTITÉ sur le champ (zone 4), hors console ;
 *   • `frise` → la frise d'initiative (`InitiativeStrip`), hors console ;
 *   • `geste-secondaire` → AUCUNE alvéole propre : l'action naît du GESTE SECONDAIRE de l'alvéole
 *     d'une AUTRE entrée, qu'elle nomme (`hote`) — clic droit, appui long, touche Menu, RB manette.
 *     Elle exige donc `hote` et `candidates` (la population qu'elle couvre : le geste n'est offert
 *     que sur les alvéoles dont le candidat en fait partie). Un seul geste offert = dispatch direct,
 *     plusieurs = panneau-paramètre ancré à l'alvéole hôte (`CombatConsole`). */
const surfaceSchema = z.enum([
  'deduite-du-set', 'geste-d-etat', 'grille', 'gouttiere-arche', 'selecteur-de-sets', 'coin-de-tour',
  'bandeau-de-phase', 'interlude', 'pastille-etat', 'pastille-entite', 'frise', 'geste-secondaire',
]);

/** Les PRÉDICATS d'offre qu'une action nomme (`gate`), implémentés par `ACTION_GATES` (`src/noyau/actionRegistry.ts`). */
export const GATES_D_ACTION = [
  'toujours', 'hors-verrou-d-etat', 'peut-agir', 'action-libre', 'action-libre-hors-frenesie', 'action-libre-hors-frenesie-fantassin',
  'mouvement-intact', 'mouvement-restant-fantassin', 'deplacement-annulable', 'charge-possible', 'mouvement-restant', 'desengagement',
  'course-possible', 'determination-en-reserve', 'attaque-libre-frenesie', 'pietinement-gratuit', 'set-commutable', 'etat-porte',
  'remede-atteignable', 'etat-recuperable-par-test', 'avantage-sous-plafond', 'tir-immobile-armable', 'tir-dans-le-tas-armable',
  'battement-cible-eligible', 'distraire-cible-eligible', 'sort-focalisable', 'coop', 'equipage-suffisant', 'navire-action',
  'arme-a-recharger', 'chanteur-disponible', 'pieces-au-navire', 'fantassin', 'pas-deja-en-joue', 'set-de-melee', 'tireur',
  'arme-de-repousse', 'engage', 'battement-connu', 'distraire-connu', 'frenesie-possible', 'equipe-a-aider', 'monte', 'poste-servi',
  'a-la-barre', 'navire', 'vehicule', 'pause-de-round',
] as const;
export type GateDAction = (typeof GATES_D_ACTION)[number];

/** Les SÉLECTEURS de candidats qu'une action nomme (`candidates`), implémentés par `ACTION_CANDIDATES`. */
export const SELECTEURS_D_ACTION = [
  'montures-adjacentes', 'pieces-servables', 'piece-poussable', 'cibles-soin', 'cibles-aspersion', 'sorts-dissipables',
  'sorts-a-dissiper', 'competences-avantage', 'attaques-de-trait', 'attaques-de-zone', 'sorts-du-heros', 'etats-retirables',
  'consommables', 'objets-portes', 'armes-a-distance', 'armes-a-recharge', 'munitions-compatibles', 'manoeuvres-sur-soi',
  'sets-d-armes', 'objets-au-sol',
] as const;
export type SelecteurDAction = (typeof SELECTEURS_D_ACTION)[number];

/** Les ENTRÉES d'offre qu'une action nomme (`run`), implémentées par `ENTREES_PAR_RUN` : chaque verbe de la barre
 *  (`VerbesDeLaBarre`, `src/noyau/actionsDuNoyau.ts`), puis les entrées hors de la barre. */
export const RUNS_D_ACTION = [
  'armerLIntention', 'armerLeMode', 'armerLAttaque', 'lancerLAttaqueDeZone', 'prendreLaVisee', 'rechargerLArme',
  'approvisionnerLArme', 'basculerLaRepousse', 'basculerLaPosture', 'aspergerDEau', 'prendreLaDefensive', 'rompreLEngagement',
  'gagnerLAvantage', 'seRemettreDeLEtat', 'seRelever', 'faireUnBattement', 'tenterDeDistraire', 'entrerEnFrenesie',
  'manoeuvrerSurSoi', 'monterEnSelle', 'mettrePiedATerre', 'servirLePoste', 'quitterLePoste', 'pousserLEngin', 'aiderLEquipe',
  'manoeuvrerLeNavire', 'chanterLaChanson', 'annulerLeDeplacement', 'terminerLeTour',
  'utiliserLObjet', 'poserLObjet', 'ramasserLObjet', 'incanterLeSort', 'focaliserLeSort', 'dissiperLeSort', 'prendreLaPanoplie',
  'immuniserALaPsychologie', 'ignorerLesCritiques', 'retirerUnEtat', 'lancerLeRound', 'leverLaMain', 'fermerLeBalayage',
  'renoncerALaSecondeFrappe', 'renoncerALaCarte', 'renoncerALaZone', 'desarmerLaBatterie', 'resterSurPlace',
] as const;
export type RunDAction = (typeof RUNS_D_ACTION)[number];

/** Les PORTÉES d'intention qu'une action nomme (`intent`), implémentées par `INTENT_REACH` (`src/noyau/localIntent.ts`). */
export const PORTEES_D_INTENTION = ['portee-mouvement', 'portee-course', 'portee-charge', 'portee-arme'] as const;
export type PorteeDIntention = (typeof PORTEES_D_INTENTION)[number];

/** Les modes ARMABLES de `battle.action` (`BattleState.action`) : le `mode` d'une action `armed`, et `teleportation`,
 *  armé par la résolution d'un sort de Téléportation (`combatFlow`), jamais par une case. */
export const MODES_ARMABLES = ['incantation', 'soins', 'dissipation', 'bordee', 'poussee', 'teleportation'] as const;
export type BattleActionMode = (typeof MODES_ARMABLES)[number];

/** Les MODES de ciblage qu'une action nomme (`mode`), implémentés par `TARGETING_MODES` (`src/noyau/targetingModes.ts`) :
 *  les modes armables, l'attaque par défaut, et les fenêtres qui détiennent le ciblage (`detenteurDuCiblage`). */
export const MODES_DE_CIBLAGE = [...MODES_ARMABLES, 'attaque', 'surincantation', 'frappeMortelle', 'deuxArmes', 'poseDeLaZone'] as const;
export type IdDeModeDeCiblage = (typeof MODES_DE_CIBLAGE)[number];

/** Ce que l'acte consomme dans l'économie du Tour. */
const coutActionSchema = z.enum(['action', 'mouvement', 'gratuit', 'aucun']);

/** Vue des champs que les deux raffinements lisent — le nœud pré-sceau est `ZodObject<ZodRawShape>`,
 *  son `v` arrive donc en `unknown`. */
type EntreeAction = {
  id: string;
  surface: z.infer<typeof surfaceSchema>;
  gate: GateDAction | GateDAction[];
  candidates?: SelecteurDAction;
  run?: RunDAction;
  intent?: PorteeDIntention;
  stance?: 'tirImmobile' | 'dansLeTas';
  blocked?: { ticket: string; raison: string };
  exitSafe?: boolean;
  role?: 'valide' | 'renonce';
  hote?: { id: string };
  mode?: IdDeModeDeCiblage;
  armed?: true;
};

const doc = document(
  'actions',
  famille,
  {
    surface: surfaceSchema,
    /** Id de PRÉDICAT enregistré dans `ACTION_GATES` (`src/noyau/actionRegistry.ts`), ou LISTE d'ids :
     *  ils se composent alors par l'ET séquentiel d'`actionGate` (toutes passent, sinon la première
     *  raison refusée est rendue). Une condition de plus sur une action = un id de plus ici. */
    gate: z.union([z.enum(GATES_D_ACTION), z.array(z.enum(GATES_D_ACTION)).min(2)]),
    /** Id de SÉLECTEUR impur enregistré dans `ACTION_CANDIDATES` (liste des cibles/objets offerts). */
    candidates: z.enum(SELECTEURS_D_ACTION).optional(),
    /** Id de l'ENTRÉE d'`ENTREES_PAR_RUN` (`src/noyau/actionRegistry.ts`) : le verbe qui joue l'offre et ses arguments,
     *  résolu au chargement du registre. Absent = `blocked`. */
    run: z.enum(RUNS_D_ACTION).optional(),
    /** Id de `TargetingMode` (`src/noyau/targetingModes.ts`) armé par cette action. */
    mode: z.enum(MODES_DE_CIBLAGE).optional(),
    /** Id de PORTÉE d'INTENTION (`INTENT_REACH`, `src/noyau/localIntent.ts`) : la case ARME le mode
     *  local qui peint cette portée sur le champ. Le clic qui suit reste le geste par défaut du grid,
     *  et dissout l'intention (spec zone 4). */
    intent: z.enum(PORTEES_D_INTENTION).optional(),
    /** L'action ARME son `mode` : il s'écrit dans `battle.action` (mode à bouton). */
    armed: z.literal(true).optional(),
    /** POSTURE de tir pré-armée basculée par cette action (`BattleState.stances`, champ du
     *  `PendingAttack` qu'elle pré-remplit) — exigée par le verbe `basculerLaPosture`. */
    stance: z.enum(['tirImmobile', 'dansLeTas']).optional(),
    coutAction: coutActionSchema,
    /** FOYER de la règle : l'entrée Codex qui la porte (jamais une phrase recomposée). */
    rule: foyerDeRegleSchema.optional(),

    keys: z.array(z.string()).optional(),
    /** Dette BLOQUANTE : l'action est déclarée mais aucun verbe ne la joue encore. */
    blocked: blocageDeLivraison.optional(),
    /** SORTIE D'INTERLUDE ATTEIGNABLE À ÉCHAP (`surface: 'interlude'` uniquement) : `false` = son
     *  geste COMMET quelque chose (un renoncement, un placement) — la touche d'annulation ne
     *  doit jamais le déclencher, seul le clic explicite le fait. `true` = la sortie ne perd rien
     *  (retour à la modale, désarmement d'un mode). */
    exitSafe: z.boolean().optional(),
    /** RÔLE SÉMANTIQUE de la sortie d'interlude (`surface: 'interlude'` uniquement, requis) : ce que
     *  le joueur FAIT en la prenant. `valide` = elle mène le geste à son terme (« Terminer »,
     *  « Valider », « Rester sur place ») ; `renonce` = elle abandonne ou revient en arrière
     *  (« Renoncer », « Retour », « Annuler »). C'est un rôle, PAS un style : la proéminence du
     *  bouton s'en DÉDUIT au rendu (même doctrine que `RollShell`), elle ne se déclare pas ici. */
    role: z.enum(['valide', 'renonce']).optional(),
    /** ENTRÉE HÔTE d'un geste secondaire (`surface: 'geste-secondaire'` uniquement, requis) : l'action
     *  dont l'alvéole porte le geste. Déclaré ICI pour qu'aucune console ne teste un id. */
    hote: ref('action').optional(),
    /** L'action FAIT NAÎTRE un panneau-paramètre (`PanneauParametre`) de SON alvéole : la surface qui
     *  la rend y pose l'ANCRE du panneau. Déclaré ICI pour qu'aucune console ne teste un id. */
    panneau: z.boolean().optional(),
  },
  {
    surface: { label: 'Surface d’accueil', hint: 'Zone de la console de combat où l’action naît par défaut' },
    gate: {
      label: 'Prédicat d’autorisation',
      hint: 'Identifiant (ou liste, toutes devant passer) qui autorise ou refuse l’action',
    },
    candidates: { label: 'Sélecteur de cibles/objets', hint: 'Identifiant du sélecteur qui liste ce que l’action propose' },
    run: {
      label: 'Geste d’exécution',
      hint: 'Identifiant de l’entrée qui déclare le verbe jouant l’action ; absent, l’action est en dette',
    },
    mode: { label: 'Mode de ciblage', hint: 'Identifiant du mode de ciblage armé par l’action' },
    intent: { label: 'Portée d’intention', hint: 'Identifiant de portée peinte sur le champ tant que l’action est armée' },
    armed: { label: 'Arme son mode', hint: 'Le mode de ciblage de l’action s’arme à son bouton' },
    stance: {
      label: 'Posture de tir pré-armée',
      hint: 'Posture basculée par cette action (tenir sa position/foncer dans la mêlée)',
    },
    coutAction: { label: 'Coût en Action', hint: 'Ce que l’acte consomme dans l’économie du Tour (Action/Mouvement/gratuit/aucun)' },
    rule: { label: 'Règle associée', hint: 'Entrée Codex qui porte la règle' },
    keys: {
      label: 'Clés historiques de surface',
      hint: 'Anciennes clés de case couvertes par cette action (liste décroissante, en transition)',
    },
    blocked: { label: 'Dette bloquante', hint: 'Action déclarée sans verbe qui la joue' },
    exitSafe: { label: 'Sortie sans perte', hint: 'La touche d’annulation peut déclencher cette sortie sans rien commettre' },
    role: { label: 'Rôle de la sortie', hint: 'Valide le geste, ou y renonce — la proéminence du bouton s’en déduit' },
    hote: { label: 'Action hôte', hint: 'Action dont l’alvéole porte ce geste secondaire' },
    panneau: { label: 'Ouvre un panneau-paramètre', hint: 'L’action fait naître un panneau ancré à sa propre alvéole' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "registre de ROUTAGE des actions de combat (id → icône, surface, gate/candidates/run, mode armé) : chaque entrée POINTE vers la fiche qui porte sa règle (`rule`, référence `{ id, type }` → règle/talent/état/qualité/compétence/caractéristique), elle n'en héberge aucune — aucun verbatim à exposer, la fiche l'est déjà.",
      },
    },
    edit: { none: 'registre de routage édité au fichier — absent de `CodexEdit.CATEGORY_DATASET`' },
  },
  {
    exiges: ['icon'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const a = v as EntreeAction;
    if (!a.run && !a.blocked) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : ni geste (run), ni dette déclarée (blocked)` });
    }
    if ((a.run === 'basculerLaPosture') !== !!a.stance) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : la bascule de posture et le champ stance vont ensemble (run basculerLaPosture ⇔ stance)` });
    }
    if (a.run && a.blocked) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : dette déclarée alors que l’action se joue (run)` });
    }
    if (a.surface === 'interlude' && (!a.mode || !a.run || a.exitSafe === undefined)) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : action d’interlude sans mode de ciblage, sans geste de sortie ou sans exitSafe` });
    }
    if (a.armed && !a.mode) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : action armée sans mode de ciblage (mode) — rien ne s’écrirait dans battle.action` });
    }
    if (a.armed && a.mode && !(MODES_ARMABLES as readonly string[]).includes(a.mode)) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : action armée sur le mode « ${a.mode} », qui n’est pas un mode armable de battle.action (${MODES_ARMABLES.join(', ')})` });
    }
    if (a.exitSafe !== undefined && a.surface !== 'interlude') {
      ctx.addIssue({ code: 'custom', message: `${a.id} : exitSafe hors d’une action d’interlude (aucune touche d’annulation ne la vise)` });
    }
    if (a.surface === 'interlude' && !a.role) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : sortie d’interlude sans role (valide/renonce) — sa proéminence ne peut pas se déduire` });
    }
    if (a.role && a.surface !== 'interlude') {
      ctx.addIssue({ code: 'custom', message: `${a.id} : role hors d’une action d’interlude (aucun bandeau de phase ne la rend)` });
    }
    if (a.surface === 'pastille-entite' && !a.candidates) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : pastille d'entité sans population portée (candidates) — aucune entité ne pourrait la porter` });
    }
    if (a.surface === 'geste-secondaire' && (!a.hote || !a.candidates)) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : geste secondaire sans entrée hôte (hote) ou sans population couverte (candidates)` });
    }
    if (a.hote && a.surface !== 'geste-secondaire') {
      ctx.addIssue({ code: 'custom', message: `${a.id} : hote hors d’un geste secondaire (aucune alvéole ne le porterait)` });
    }
      }),
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const actions = v as EntreeAction[];
        const par = new Map(actions.map((a) => [a.id, a]));
        for (const a of actions) {
          if (!a.hote) continue;
          const hote = par.get(a.hote.id);
          if (!hote) {
            ctx.addIssue({ code: 'custom', message: `${a.id} : hote « ${a.hote.id} » absent du registre` });
          } else if (hote.surface === 'geste-secondaire') {
            ctx.addIssue({ code: 'custom', message: `${a.id} : hote « ${a.hote.id} » est lui-même un geste secondaire (aucune alvéole au bout)` });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
