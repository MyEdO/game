/**
 * Schéma de `actions.json` — REGISTRE UNIQUE des actions de combat (spec HUD, « Zone 12 »).
 * Une entrée = un acte OFFERT au joueur pendant un combat, avec son identité STABLE (sans préfixe
 * de position), son affichage (`label`/`icon`), sa RÈGLE (`rule`/`ruleCategory` → Codex), son COÛT,
 * sa surface d'accueil par défaut, et les IDS de code qui l'exécutent (`gate`/`candidates`/`run`/
 * `mode`/`armed`, tous résolus par `src/state/actionRegistry.ts` — jamais de code en JSON).
 *
 * COÛTS — guideline RAW (`LDB 13 l.106`, verbatim : « C'est le MJ qui va décider ce qui vous coûtera
 * votre Action, et ce que vous pouvez faire au cours d'un Round. On part en général du principe que
 * si un acte nécessite un Test, c'est que c'est une Action plutôt qu'une Action gratuite. ») : elle
 * sert de DÉFAUT de remplissage. Tout coût qui n'en découle pas et qu'aucun verbatim ne porte porte
 * sa RAISON en clair dans `maison` (champ d'enveloppe, #1467 L1b).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'actions.json';
export const famille = 'entite';

/** RENDEUR d'accueil PAR DÉFAUT (spec §1a / §1c-bis / zone 4). Le placement joueur reste libre :
 *  ce champ dit d'où l'action NAÎT quand rien n'a été posé — et il nomme un rendeur RÉEL, mesuré au
 *  DOM par le contrat « surface ⇄ rendeur » (`src/ui/CombatConsole.test.tsx`). Correspondances :
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
 *     le mode courant (`currentTargetingMode`) est celui de son `mode`, et SON dispatcher est la
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

/** Ce que l'acte consomme dans l'économie du Tour. */
const coutActionSchema = z.enum(['action', 'mouvement', 'gratuit', 'aucun']);

/** Vue des champs que les deux raffinements lisent — le nœud pré-sceau est `ZodObject<ZodRawShape>`,
 *  son `v` arrive donc en `unknown`. */
type EntreeAction = {
  id: string;
  surface: z.infer<typeof surfaceSchema>;
  gate: string | string[];
  candidates?: string;
  run?: string;
  intent?: string;
  stance?: 'heldGround' | 'intoCrowd';
  rule?: string;
  ruleCategory?: string;
  blocked?: { ticket: string; raison: string };
  exitSafe?: boolean;
  role?: 'valide' | 'renonce';
  hote?: string;
  mode?: string;
};

const doc = document(
  'actions',
  famille,
  {
    surface: surfaceSchema,
    /** Id de PRÉDICAT enregistré dans `ACTION_GATES` (`src/state/actionRegistry.ts`), ou LISTE d'ids :
     *  ils se composent alors par l'ET séquentiel d'`actionGate` (toutes passent, sinon la première
     *  raison refusée est rendue). Une condition de plus sur une action = un id de plus ici. */
    gate: z.union([z.string(), z.array(z.string()).min(2)]),
    /** Id de SÉLECTEUR impur enregistré dans `ACTION_CANDIDATES` (liste des cibles/objets offerts). */
    candidates: z.string().optional(),
    /** Id de DISPATCHER enregistré dans `ACTION_RUN` (méthode `battle*` du store). Absent = `blocked`. */
    run: z.string().optional(),
    /** Id de `TargetingMode` EXISTANT (`src/state/targetingModes.ts`) armé par cette action. */
    mode: z.string().optional(),
    /** Id de PORTÉE d'INTENTION (`INTENT_REACH`, `src/state/localIntent.ts`) : la case ARME le mode
     *  local qui peint cette portée sur le champ. Le clic qui suit reste le geste par défaut du grid,
     *  et dissout l'intention (spec zone 4). */
    intent: z.string().optional(),
    /** Valeur écrite dans `battle.action` quand l'action est ARMÉE (mode à bouton). */
    armed: z.string().optional(),
    /** POSTURE de tir pré-armée basculée par cette action (`BattleState.stances`, champ du
     *  `PendingAttack` qu'elle pré-remplit) — exigée par le dispatcher `battleToggleStance`. */
    stance: z.enum(['heldGround', 'intoCrowd']).optional(),
    coutAction: coutActionSchema,
    /** FOYER de la règle : id de l'entrée Codex qui la porte (jamais une phrase recomposée). */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'`, `'talents'`, `'etats'`…) — exigée avec `rule`. */
    ruleCategory: z.string().optional(),
    /** Clés de SURFACE historiques (cases `CombatConsole`) couvertes par cette
     *  action, tant que les espaces d'ids sont forkés. Une clé template (`sort-${id}`) se déclare
     *  par son PRÉFIXE littéral. Liste DÉCROISSANTE : le lot branchements remplace ces clés par
     *  l'id d'action lui-même. Consommée par `src/state/action-atteignabilite.test.ts`. */
    keys: z.array(z.string()).optional(),
    /** Dette BLOQUANTE : l'action est déclarée mais aucun dispatcher ne l'exécute encore. */
    blocked: z.strictObject({ ticket: z.string(), raison: z.string() }).optional(),
    /** SORTIE D'INTERLUDE ATTEIGNABLE À ÉCHAP (`surface: 'interlude'` uniquement) : `false` = son
     *  dispatcher COMMET quelque chose (un renoncement, un placement) — la touche d'annulation ne
     *  doit jamais le déclencher, seul le clic explicite le fait. `true` = la sortie ne perd rien
     *  (retour à la modale, désarmement d'un mode). */
    exitSafe: z.boolean().optional(),
    /** RÔLE SÉMANTIQUE de la sortie d'interlude (`surface: 'interlude'` uniquement, requis) : ce que
     *  le joueur FAIT en la prenant. `valide` = elle mène le geste à son terme (« Terminer »,
     *  « Valider », « Rester sur place ») ; `renonce` = elle abandonne ou revient en arrière
     *  (« Renoncer », « Retour », « Annuler »). C'est un rôle, PAS un style : la proéminence du
     *  bouton s'en DÉDUIT au rendu (même doctrine que `RollShell`), elle ne se déclare pas ici. */
    role: z.enum(['valide', 'renonce']).optional(),
    /** ENTRÉE HÔTE d'un geste secondaire (`surface: 'geste-secondaire'` uniquement, requis) : l'id de
     *  l'action dont l'alvéole porte le geste. Déclaré ICI pour qu'aucune console ne teste un id. */
    hote: z.string().optional(),
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
      label: 'Dispatcher d’exécution',
      hint: 'Identifiant de la méthode qui exécute l’action ; absent, l’action est en dette',
    },
    mode: { label: 'Mode de ciblage', hint: 'Identifiant du mode de ciblage armé par l’action' },
    intent: { label: 'Portée d’intention', hint: 'Identifiant de portée peinte sur le champ tant que l’action est armée' },
    armed: { label: 'Valeur d’armement', hint: 'Valeur écrite quand l’action est armée (mode à bouton)' },
    stance: {
      label: 'Posture de tir pré-armée',
      hint: 'Posture basculée par cette action (tenir sa position/foncer dans la mêlée)',
    },
    coutAction: { label: 'Coût en Action', hint: 'Ce que l’acte consomme dans l’économie du Tour (Action/Mouvement/gratuit/aucun)' },
    rule: { label: 'Règle associée', hint: 'Identifiant de l’entrée Codex qui porte la règle' },
    ruleCategory: { label: 'Catégorie de la règle' },
    keys: {
      label: 'Clés historiques de surface',
      hint: 'Anciennes clés de case couvertes par cette action (liste décroissante, en transition)',
    },
    blocked: { label: 'Dette bloquante', hint: 'Action déclarée sans dispatcher qui l’exécute' },
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
          "registre de ROUTAGE des actions de combat (id → icône, surface, gate/candidates/run, mode armé) : chaque entrée POINTE vers la fiche qui porte sa règle (`rule`+`ruleCategory` → regles/talents/etats/qualities/skills), elle n'en héberge aucune — aucun verbatim à exposer, la fiche l'est déjà.",
      },
    },
    edit: { none: 'registre de routage édité au fichier — absent de `CodexEdit.CATEGORY_DATASET`' },
  },
  {
    exiges: ['icon'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const a = v as EntreeAction;
    if (a.rule && !a.ruleCategory) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : rule sans ruleCategory` });
    }
    if (!a.run && !a.intent && !a.blocked) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : ni dispatcher (run), ni intention (intent), ni dette déclarée (blocked)` });
    }
    if ((a.run === 'battleToggleStance') !== !!a.stance) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : la bascule de posture et le champ stance vont ensemble (run battleToggleStance ⇔ stance)` });
    }
    if ((a.run || a.intent) && a.blocked) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : dette déclarée alors que l’action s’exécute (run) ou s’arme (intent)` });
    }
    if (a.surface === 'interlude' && (!a.mode || !a.run || a.exitSafe === undefined)) {
      ctx.addIssue({ code: 'custom', message: `${a.id} : action d’interlude sans mode de ciblage, sans dispatcher de sortie ou sans exitSafe` });
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
          const hote = par.get(a.hote);
          if (!hote) {
            ctx.addIssue({ code: 'custom', message: `${a.id} : hote « ${a.hote} » absent du registre` });
          } else if (hote.surface === 'geste-secondaire') {
            ctx.addIssue({ code: 'custom', message: `${a.id} : hote « ${a.hote} » est lui-même un geste secondaire (aucune alvéole au bout)` });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
