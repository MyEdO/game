/**
 * LES OUTILS DE L'HÔTE TEXTE (#2898 lot D) : le serveur MCP de l'hôte (`scripts/hote-texte.mjs`) en sert trois,
 * `nouvelle`, `lire` et `jouer`, décrits ici une seule fois : les instructions du serveur, la description de chaque outil
 * et le schéma de ses entrées. Module feuille (zod seul) : le lanceur les inscrit, le doc (`npm run docs:hote-texte`) les
 * écrit, et les valeurs que le noyau énumère (scénarios, cadences) y entrent par `outils`, jamais recopiées.
 */
import { z } from 'zod';

/** Ce que `lire` sait rendre, une lecture par valeur de `quoi`. */
export const LECTURES = ['vue', 'offres', 'carte', 'cases', 'fiche', 'journal', 'verbes'] as const;
export type Lecture = (typeof LECTURES)[number];

/** Les gestes d'un appel de `jouer`, au plus. */
export const GESTES_PAR_APPEL = 40;

/** Le dossier des parties, à la racine du dépôt (ignoré de git) : une partie est un fichier `<nom>.jsonl`. */
export const DOSSIER_DES_PARTIES = '.hote-texte';

/** Le nom d'une partie : son fichier dans `DOSSIER_DES_PARTIES`, sans extension. */
export const NOM_DE_PARTIE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** Les noms des trois outils. */
export type NomDOutil = 'nouvelle' | 'lire' | 'jouer';

/** Un appel écrit tel qu'un agent le passe : `lire {"quoi":"journal","depuis":40}`. Les renvois des sorties l'emploient. */
export const appelEcrit = (outil: NomDOutil, args: Record<string, unknown> = {}): string => {
  const presents = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
  return `\`${outil}${Object.keys(presents).length ? ` ${JSON.stringify(presents)}` : ''}\``;
};

/** Les instructions du serveur, données une fois à l'ouverture de la session MCP. */
export const INSTRUCTIONS = [
  'Hôte texte du jeu (noyau de règles Warhammer, sans écran) : une partie d’un scénario de test se joue par trois outils.',
  `\`nouvelle\` commence une partie et la nomme ; \`lire\` la regarde sans la changer ; \`jouer\` y applique une suite de gestes. Chaque réponse finit par la vue : ce qui tient la main, ses verbes avec leur signature, les offres de l’actif.`,
  `Une partie est un fichier JSONL, ${DOSSIER_DES_PARTIES}/<nom>.jsonl à la racine du dépôt : son en-tête, puis un geste appliqué par ligne. Le fichier est la vérité ; un geste refusé ne s’y écrit pas. Il se copie et se tronque à la main, la partie est ce qu’il rejoue.`,
  'Une erreur dit sa catégorie : validation (un argument faux), permission (un siège qui ne tient pas la main, une partie tenue par un autre serveur), regle (un geste que le jeu refuse ou qui ne change rien).',
].join('\n');

/** Les valeurs énumérées que le noyau fournit : les ids de scénario (`null` : une chaîne, pour le doc) et les cadences. */
export interface Enumerations {
  scenarios: readonly string[] | null;
  cadences: readonly string[];
}

const enumere = (valeurs: readonly string[] | null) => (valeurs?.length ? z.enum(valeurs as [string, ...string[]]) : z.string());

const nomDePartie = (description: string) => z.string().regex(NOM_DE_PARTIE).describe(description);
const PARTIE_LUE = nomDePartie('le nom de la partie ; par défaut, la dernière ouverte par ce serveur').optional();

/** Les trois outils : la description (but, entrées, exemple, limites, frontière avec les deux autres) et le schéma. */
export function outils({ scenarios, cadences }: Enumerations) {
  return {
    nouvelle: {
      description: [
        `Commence une partie neuve d’un scénario de test, nommée \`partie\` : écrit l’en-tête de ${DOSSIER_DES_PARTIES}/<partie>.jsonl (il remplace une partie de ce nom) et rend la vue.`,
        '`scenario` : un id de la liste. `graine` : la graine des dés (1 par défaut). `cadence` : manuel par défaut, chaque jet attend son verbe.',
        '`desFixes` : chaque dé se pose à la main, APRÈS le jet, par le verbe de pose que la ligne « verbes » de la vue nomme. `regles` : les règles maison, {id: valeur}.',
        'Exemple : {"partie":"dome-1","scenario":"dome","graine":7}.',
        'Ne sert pas à reprendre une partie : une partie existante se lit par `lire` et se joue par `jouer`, qui la rejouent depuis son fichier.',
      ].join('\n'),
      schema: {
        partie: nomDePartie('le nom de la partie : minuscules, chiffres, - et _'),
        scenario: enumere(scenarios).describe('id du scénario de test'),
        graine: z.number().int().optional().describe('graine des dés, 1 par défaut'),
        cadence: enumere(cadences).optional().describe('cadence des jets, manuel par défaut'),
        desFixes: z.boolean().optional().describe('vrai : chaque dé se pose à la main après le jet'),
        regles: z.record(z.string(), z.unknown()).optional().describe('règles maison {id: valeur}'),
      },
    },
    lire: {
      description: [
        'Lit la partie sans la changer : rien ne s’écrit. `quoi` choisit la lecture :',
        'vue (l’actif, la fenêtre qui tient la main et la signature de ses verbes, le jet en attente, les offres, les cibles ; en exploration, le groupe et les portails) ;',
        'offres (les offres ouvertes de l’actif ; `toutes` : les fermées avec leur raison ; `id` : les candidats d’une action et leur ctx) ;',
        'carte (les combattants, l’actif d’abord ; en exploration, les entités de la scène) ; cases (les cases atteignables au tour de l’actif, avec leur coût) ;',
        'fiche (la fiche du combattant `id`) ; journal (ses dernières lignes ; `depuis` k ; `ligne` m pour une entrée longue) ;',
        'verbes (la signature du verbe `id`, ou les verbes dont le nom contient `id` ; sans partie).',
        'Toute liste se lit par pages, `depuis` k ; une sortie dit l’appel qui donne la suite.',
        'Exemples : {"quoi":"vue"} ; {"quoi":"offres","id":"charge"} ; {"quoi":"verbes","id":"Roll"}.',
        'Pour agir, `jouer` ; pour commencer, `nouvelle`.',
      ].join('\n'),
      schema: {
        quoi: z.enum(LECTURES).describe('la lecture'),
        partie: PARTIE_LUE,
        id: z.string().optional().describe('offres : une action ; fiche : un combattant ; verbes : un verbe, ou un morceau de nom'),
        depuis: z.number().int().min(0).optional().describe('le rang du premier élément de la page'),
        ligne: z.number().int().min(0).optional().describe('journal : la première ligne d’une entrée plus haute que la page'),
        toutes: z.boolean().optional().describe('offres : les fermées aussi, avec leur raison'),
      },
    },
    jouer: {
      description: [
        'Joue une SUITE de gestes sur la partie, dans l’ordre ; chaque geste appliqué s’écrit au fichier. Un geste est :',
        '- une offre de la barre de l’actif, {"offre":"charge","ctx":{…}} (ids : ligne « offres » de la vue ; candidats et ctx : `lire` {"quoi":"offres","id":…}) ;',
        '- un verbe du noyau, {"verbe":"<nom>","args":[…],"siege":0} : la ligne « verbes » de la vue donne la signature de ceux de la fenêtre qui tient la main, et l’id d’étape (pid) qu’ils attendent ; tout autre verbe du noyau se joue aussi (`lire` {"quoi":"verbes","id":"<morceau>"}).',
        '`args` est le tableau des arguments, contrôlé contre le type du verbe : un point s’écrit {"x":3,"y":6}, `null` saute un argument optionnel, une porte se désigne par son id. `siege` joue au nom d’un siège.',
        `Le premier geste refusé arrête la suite : rien de lui ne s’écrit, la réponse dit combien sont passés, et pourquoi. Une seule vue à la fin. Au plus ${GESTES_PAR_APPEL} gestes.`,
        'Exemple, une Charge puis le jet de la fenêtre, son dé posé à 11, et sa confirmation : {"gestes":[{"offre":"charge"},{"verbe":"<jet>"},{"verbe":"<pose du dé>","args":[11]},{"verbe":"<confirmation>"}]}, chaque nom lu à la ligne « verbes ».',
        'Pour lire sans agir, `lire`.',
      ].join('\n'),
      schema: {
        gestes: z.array(z.union([
          z.object({ offre: z.string().min(1), ctx: z.record(z.string(), z.unknown()).optional() }).strict(),
          z.object({ verbe: z.string().min(1), args: z.array(z.unknown()).optional(), siege: z.number().int().optional() }).strict(),
        ])).min(1).max(GESTES_PAR_APPEL).describe('les gestes, joués dans l’ordre'),
        partie: PARTIE_LUE,
      },
    },
  } as const satisfies Record<NomDOutil, { description: string; schema: z.ZodRawShape }>;
}
