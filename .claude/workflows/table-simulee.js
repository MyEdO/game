export const meta = {
  name: 'table-simulee',
  description: "Table papier SIMULÉE d'un chapitre de campagne, sur son DOSSIER : un lecteur prépare les 4 PJ du groupe prétiré canonique (sans rien savoir du chapitre), un autre désigne le sosie sur le dossier et la liste des PJ ; la fiche du MJ est tirée du dossier. Puis une partie de `maxEchanges` échanges au plus (défaut : 3 par beat du dossier ; chaque échange coûte ≈ 5 agents, 1 MJ + 4 joueurs), plafond que le MJ ignore — un MJ agent qui cite le livre ou déclare IMPRO, tire chaque jet par l'outil de dés du moteur et rend le sort de chaque déclencheur, quatre joueurs CLOISONNÉS à personas (dont deux adverses), que le MJ et les autres joueurs ne connaissent que par leur PJ —, enfin un juge classe chaque intention et chaque déclencheur non joué ou écarté sur le journal PROJETÉ de la partie (ses sorties, ni l'état privé du MJ ni son classement), mesure les temps morts en beats, relève chaque secret que la narration du MJ a fui, et le script calcule le verdict et les besoins retenus. Toute sortie d'agent qui désigne un membre d'un ensemble fermé (PJ, déclencheur en attente, beat, persona, secret, échange, id du sosie, catégorie d'IMPRO selon la source) est contrainte par le SCHÉMA de son appel — enum, branche par cas, ou objet dont les clés sont exactement les membres qui doivent chacun recevoir une entrée —, jamais re-vérifiée par le script. En préparation, un agent qui échoue (fiches des PJ, sosie) ARRÊTE le run, sa cause aux `manques` ; en partie et à l'analyse, il ne le coupe pas : sa cause entre aux `trous`, le journal garde les échanges joués. Un rendu du MJ anomal (tirage hors suite, déclencheur non joué sans motif) lui est RENVOYÉ (prompt d'origine, sortie fautive, anomalies précises), 2 fois au plus ; un renvoi sans rendu nomme sa cause au journal de l'échange. Le verdict se DÉRIVE de `trous`, une liste par espèce : SIGNAL ou THÉÂTRE quand toutes sont vides, sinon la première espèce trouée le nomme — INTERROMPU (le MJ n'a rien rendu, à quelque échange que ce soit), PARTIE INCOMPLÈTE (un joueur sans rendu), PARTIE ANOMALE (sosie à id vide qui cite un passage, tirage hors suite ou déclencheur non joué sans motif restés après les renvois, secret fui par la narration du MJ), SANS ANALYSE (juge sans rendu) ; ARRÊT avant la partie. Rend le journal complet (base de rejeu), l'analyse, les déclencheurs non joués et écartés. args : { livre, chapitre, fichiers, dossier, typeDePointAuMJ, seed, maxEchanges?, personas?, worktree, date } — `dossier` = l'OBJET de la fiche commitée du chapitre (`docs/dossiers/<livre>/<chapitre>.json`, schéma `ficheDeDossier`), chargé et gardé par le lanceur ; `typeDePointAuMJ` = la forme projetée du type d'un point au MJ, dont les catégories d'IMPRO dérivent : `node scripts/raw/workflow-args.mjs table-simulee <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> --seed <graine>`.",
  whenToUse: "Sur un chapitre à forte ambiguïté (méthode de #665, étape 4), APRÈS la fiche commitée de son dossier de chapitre, qu'elle consomme : pour mesurer ce que des joueurs FONT du chapitre — intentions prévues, improvisées, refusées, hors livre — avant d'en décider les médias et les besoins. Le verdict THÉÂTRE dit que les personas adverses n'ont pas joué : le run ne prouve rien.",
  phases: [
    { title: 'Préparation', detail: 'fiches des 4 PJ au groupe canonique, puis sosie désigné sur le dossier et la liste des PJ — le lecteur des fiches des PJ ne voit pas le chapitre ; la fiche du MJ vient du dossier' },
    { title: 'Partie', detail: 'boucle MJ puis joueurs cloisonnés en parallèle, dés tirés par le moteur' },
    { title: 'Analyse', detail: 'intentions et déclencheurs classés, temps morts en beats, fuites de secret ; verdict et besoins retenus calculés par le script' },
  ],
}

// args parfois STRINGIFIÉ par le harnais → parse défensif.
const input = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})
const LIVRE = String(input.livre || '')
const CHAPITRE = String(input.chapitre || '')
const FICHIERS = (Array.isArray(input.fichiers) ? input.fichiers : input.fichiers ? [input.fichiers] : []).map(String)
const SEED = input.seed === undefined || input.seed === null ? '' : String(input.seed)
const MAX_ECHANGES_EXPLICITE = input.maxEchanges === undefined || input.maxEchanges === null ? null : typeof input.maxEchanges === 'number' || typeof input.maxEchanges === 'string' ? Number(input.maxEchanges) : NaN
const PERSONAS = Array.isArray(input.personas) ? input.personas.map(String) : ['rôliste', 'fouineur', 'saboteur', 'hors-cadre']
const WORKTREE = String(input.worktree || '')
const DATE = String(input.date || '')
const DOSSIER = input.dossier && typeof input.dossier === 'object' ? input.dossier : null
/** La forme projetée du `type` d'un point au MJ (`ficheDeDossier`, src/data/source/dossier.ts) : `{ enum, description }`. */
const TYPE_DE_POINT_AU_MJ = input.typeDePointAuMJ && typeof input.typeDePointAuMJ === 'object' && Array.isArray(input.typeDePointAuMJ.enum) ? input.typeDePointAuMJ : null

/** Le jeu de chaque persona — la clé est l'id passé en `args.personas`. */
const JEUX_DE_PERSONA = {
  'rôliste': 'ROLISTE : tu joues ton personnage — sa carrière, sa motivation, ses ambitions — et tu suis les accroches qui le concernent.',
  'fouineur': 'FOUINEUR : tu fouilles, tu interroges, tu soupçonnes — chaque PNJ ment peut-être, chaque lieu cache quelque chose.',
  'saboteur': "SABOTEUR : tu refuses l'accroche, tu mens aux autorités, tu t'en prends au mauvais PNJ — tu éprouves ce que le chapitre fait d'un groupe qui ne coopère pas.",
  'hors-cadre': "HORS-CADRE : tu quittes la zone, tu ignores l'enquête, tu poursuis tes propres buts — tu éprouves ce que le chapitre fait d'un groupe qui va ailleurs.",
}
/** Personas ADVERSES imposées à toute table (skill `adapter-une-campagne`, « Règles de lecture »). */
const PERSONAS_ADVERSES = ['saboteur', 'hors-cadre']
/** Catégories d'IMPRO du MJ — ids STABLES, communs au MJ et au juge : ce que le livre laisse au MJ (les types
 *  d'un point au MJ du dossier), ou ce dont il ne dit rien. */
const CATEGORIES_IMPRO = [...(TYPE_DE_POINT_AU_MJ?.enum ?? []), 'hors-livre']
const CATEGORIE_IMPRO = {
  enum: CATEGORIES_IMPRO,
  description: `${TYPE_DE_POINT_AU_MJ?.description ?? ''} \`hors-livre\` = le livre ne dit rien de la situation : ni passage, ni point laissé au MJ.`,
}
/** Fenêtre des échanges publics passés au MJ et aux joueurs ; le reste vit dans leurs résumés et notes. */
const DERNIERS_ECHANGES = 3
/** Plafond par beat du dossier quand `args.maxEchanges` est absent. Mesure #1993 (EDO 01, 2026-09-29) : ≈2 échanges
 *  par beat atteint, MJ sans plafond ; 3 laisse la marge d'un beat qui en prend beaucoup plus. */
const ECHANGES_PAR_BEAT = 3
/** Ce que la fiche du MJ tire de la fiche de dossier du chapitre (`ficheDeDossier`, `src/data/source/dossier.ts`). */
const CHAMPS_DE_LA_FICHE = ['imperatifs', 'beats', 'pnj', 'indices', 'secrets', 'pointsAuMJ', 'declencheurs']
/** Le lanceur qui projette `args`, dont la fiche du chapitre. */
const LANCEUR = 'node scripts/raw/workflow-args.mjs table-simulee <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> --seed <graine>'
/** Les déclencheurs d'une partie qui n'a pas eu lieu : la forme du retour ne change pas. */
const SANS_DECLENCHEURS = { declencheursNonJoues: [], declencheursEcartes: [] }

/** Ce qui manque au dossier reçu pour armer la table — vide quand il l'arme. */
function manquesDuDossier() {
  if (!DOSSIER) return [`args.dossier — l'objet de la fiche commitée du chapitre (docs/dossiers/<livre>/<chapitre>.json, la fiche du MJ en est tirée) : ${LANCEUR}`]
  const manques = []
  for (const champ of CHAMPS_DE_LA_FICHE) if (!Array.isArray(DOSSIER[champ])) manques.push(`args.dossier.${champ} absent — la fiche du chapitre vient du lanceur : ${LANCEUR}`)
  if (Array.isArray(DOSSIER.beats) && !DOSSIER.beats.length) manques.push('args.dossier.beats vide — le MJ ne joue pas un chapitre sans beats')
  return manques
}

const manquesDArgs = [
  LIVRE ? null : 'args.livre — sigle du livre (ex. EDO)',
  CHAPITRE ? null : 'args.chapitre — numéro du chapitre (ex. 01)',
  FICHIERS.length ? null : 'args.fichiers — chemins Source/ du chapitre',
  SEED ? null : 'args.seed — graine de l’outil de dés (rejouable)',
  MAX_ECHANGES_EXPLICITE === null || (Number.isInteger(MAX_ECHANGES_EXPLICITE) && MAX_ECHANGES_EXPLICITE >= 1) ? null : `args.maxEchanges — entier ≥ 1 (reçu « ${input.maxEchanges} »)`,
  PERSONAS.length === 4 ? null : `args.personas — exactement 4, un par PJ (reçu ${PERSONAS.length})`,
  ...PERSONAS.filter((p) => !JEUX_DE_PERSONA[p]).map((p) => `args.personas — « ${p} » inconnue (connues : ${Object.keys(JEUX_DE_PERSONA).join(', ')})`),
  ...PERSONAS_ADVERSES.filter((p) => !PERSONAS.includes(p)).map((p) => `args.personas — « ${p} » absente : les personas adverses ${PERSONAS_ADVERSES.join(' et ')} sont imposées`),
  ...[...new Set(PERSONAS.filter((p, rang) => PERSONAS.indexOf(p) !== rang))].map((p) => `args.personas — « ${p} » en double : une persona par joueur`),
  WORKTREE ? null : 'args.worktree — chemin ABSOLU de l’arbre où l’outil de dés et le Source/ se lisent',
  DATE ? null : 'args.date — AAAA-MM-JJ (aucune horloge dans un script : la reprise doit rendre le même run)',
  TYPE_DE_POINT_AU_MJ?.enum.length ? null : `args.typeDePointAuMJ — la forme projetée du \`type\` d’un point au MJ (\`ficheDeDossier\`), d’où dérivent les catégories d’IMPRO : ${LANCEUR}`,
  ...manquesDuDossier(),
].filter(Boolean)
if (manquesDArgs.length) {
  log(`ARRÊT : ${manquesDArgs.length} argument(s) manquant(s) ou invalide(s) — ${manquesDArgs.join(' · ')}`)
  return { verdict: 'ARRÊT', manques: manquesDArgs, journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 0, mj: 0, joueurs: 0, analyse: 0, total: 0 }, date: DATE }
}
const MAX_ECHANGES = MAX_ECHANGES_EXPLICITE ?? ECHANGES_PAR_BEAT * DOSSIER.beats.length

// ── Appels d'agent : un échec se NOMME, une sortie anomale se RENVOIE (#2721) ─────────────────────
/** L'appel `lancer()`, qui ne lève jamais : `{ rendu, cause: null }`, ou `{ rendu: null, cause }` — l'erreur
 *  levée (schéma non tenu après les essais du harnais, erreur d'API) ou l'absence de rendu. */
const capturer = async (lancer) => {
  try {
    const rendu = await lancer()
    return rendu ? { rendu, cause: null } : { rendu: null, cause: 'rien rendu' }
  } catch (erreur) {
    return { rendu: null, cause: `échec : ${erreur?.message ?? String(erreur)}` }
  }
}
/** Renvois d'une sortie anomale à son agent, au plus. */
const ESSAIS_DE_CORRECTION = 2
/** Le prompt d'un renvoi : le prompt d'origine, la sortie fautive, chaque anomalie précise. */
const renvoiDeCorrection = (prompt, rendu, anomalies) => `${prompt}

SORTIE À CORRIGER — ta sortie précédente à ce même message :
${JSON.stringify(rendu, null, 1)}

ANOMALIES (chacune se corrige ; le reste de la sortie se garde) :
${anomalies.map((a) => `- ${a}`).join('\n')}
Rends la sortie ENTIÈRE, corrigée.`
/** `lancer(prompt, essai)` (essai 0 = l'appel, puis chaque renvoi), validé par `anomaliesDe(rendu)` : une
 *  sortie anomale est renvoyée `ESSAIS_DE_CORRECTION` fois au plus. Rend le dernier rendu, ses anomalies
 *  restantes, la cause d'un premier appel sans rendu, et le nombre de renvois joués ; un renvoi sans rendu
 *  garde le rendu précédent et nomme sa cause parmi les anomalies. */
const appelValide = async (prompt, lancer, anomaliesDe) => {
  const premier = await capturer(() => lancer(prompt, 0))
  let { rendu } = premier
  let anomalies = rendu ? anomaliesDe(rendu) : []
  let renvois = 0
  while (rendu && anomalies.length && renvois < ESSAIS_DE_CORRECTION) {
    renvois += 1
    const corrige = await capturer(() => lancer(renvoiDeCorrection(prompt, rendu, anomalies), renvois))
    if (!corrige.rendu) {
      anomalies = [...anomalies, `renvoi ${renvois} sans rendu — ${corrige.cause}`]
      break
    }
    rendu = corrige.rendu
    anomalies = anomaliesDe(rendu)
  }
  return { rendu, cause: premier.cause, anomalies, renvois }
}

/** L'outil de dés du moteur, par son chemin ABSOLU dans l'arbre : le répertoire courant du shell n'est pas forcément l'arbre. */
const COMMANDE_DES = `npx tsx ${WORKTREE}/scripts/ops/table-des.mts`
/** Comment un agent de ce workflow EXÉCUTE : un agent de fond dont la commande attend une autorisation
 *  reste bloqué sans fin. */
const EXECUTION = `Tes lectures passent par Read, Grep et Glob, chemins ABSOLUS sous l'arbre. Toute commande passe par l'outil \`ctx_shell\` s'il est disponible (poste), son paramètre \`cwd\` = l'arbre, sinon par l'outil Bash : UNE commande simple par appel, sans changement de dossier, sans enchaînement ni pipe, sans redirection, sans variable d'environnement en tête, chaque chemin ABSOLU sous l'arbre (le répertoire courant du shell n'est pas forcément l'arbre) ; UN SEUL appel shell par message, jamais plusieurs en parallèle. Une sonde est une commande (\`npx tsx -e "…"\`), jamais un fichier écrit ; tout processus lancé est TUÉ avant ton rendu.`
/** Le cadre d'un agent qui ne lit PAS le livre : le lecteur des fiches des PJ, qui ne doit rien en savoir. */
const CADRE_ARBRE = `Arbre (chemin ABSOLU, à utiliser tel quel) : ${WORKTREE}
Date du jour : ${DATE}
LECTURE SEULE : tu n'écris AUCUN fichier, ni sous l'arbre ni ailleurs. Aucun git écrivain, aucune suite de tests, aucune gate.
${EXECUTION}`
const RENDU_AU_SCHEMA = `Chaque champ du schéma porte sa définition (\`description\`) : elle fait foi. Ton rendu = l'objet du schéma, rien d'autre.`

const CADRE = `${CADRE_ARBRE} Toute référence au livre est NUE : \`${LIVRE} ${CHAPITRE} l.<ligne>\` (ligne du fichier Source/). Un numéro de ligne se prend sur une lecture BRUTE numérotée (\`Read\`, ou \`Grep\` avec ses numéros de ligne), jamais sur une vue résumée ou compressée ; toute réf se vérifie en relisant la ligne citée avant d'être rendue. Une absence se prouve par une recherche et son périmètre, jamais par « je n'ai pas trouvé ».
${RENDU_AU_SCHEMA}`

const CHAPITRE_LU = `Chapitre : ${LIVRE} ${CHAPITRE} — fichiers Source/ (relatifs à l'arbre) : ${FICHIERS.join(' · ')}`

/** Une réf nue au livre : jamais un texte blanc. */
const REF_NUE = { type: 'string', pattern: '\\S', description: `Réf NUE au livre : \`${LIVRE} ${CHAPITRE} l.<ligne>\`.` }
/** Le texte vide : ce qui ne s'applique pas. */
const VIDE = { enum: [''] }
const REF = { type: 'object', additionalProperties: false, properties: { texte: { type: 'string' }, ref: REF_NUE }, required: ['texte', 'ref'] }

const PREPARATION_PJ = {
  type: 'object', additionalProperties: false,
  properties: {
    pjs: {
      type: 'array', minItems: 4, maxItems: 4,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nom: { type: 'string' },
          espece: { type: 'string' },
          carriere: { type: 'string' },
          fiche: { type: 'string' },
        },
        required: ['id', 'nom', 'espece', 'carriere', 'fiche'],
      },
    },
    groupe: {
      type: 'object', additionalProperties: false,
      properties: { source: { type: 'string' }, commande: { type: 'string' } },
      required: ['source', 'commande'],
    },
  },
  required: ['pjs', 'groupe'],
}

/** Les propriétés d'un objet dont chaque clé est un membre de `cles` — le schéma qui les porte les exige
 *  TOUTES (`required: cles`) et n'en admet aucune autre (`additionalProperties: false`). */
const proprietesPar = (cles, forme) => Object.fromEntries(cles.map((cle) => [cle, forme(cle)]))

/** Sort d'un déclencheur du livre à un échange : `joue` (l'événement arrive dans la narration), `non-echu`
 *  (sa condition ou son délai n'est pas atteint), `ecarte` (la fiction l'a rendu impossible). */
const STATUTS_DE_DECLENCHEUR = ['joue', 'non-echu', 'ecarte']

/** La résolution d'UNE intention, sous l'id du PJ qui l'a eue (schéma du MJ, à chaque échange) : une
 *  branche par source, chacune avec SA réf et SA catégorie. */
const RESOLUTION_DITE = { type: 'string', description: "Ce qui arrive à l'intention, tel que les joueurs l'entendent." }
const RESOLUTION = {
  anyOf: [
    {
      type: 'object', additionalProperties: false,
      properties: { source: { enum: ['livre'] }, ref: { ...REF_NUE, description: 'La réf nue de la ligne qui prévoit cette résolution.' }, categorie: VIDE, resolution: RESOLUTION_DITE },
      required: ['source', 'ref', 'categorie', 'resolution'],
    },
    {
      type: 'object', additionalProperties: false,
      properties: { source: { enum: ['IMPRO'] }, ref: VIDE, categorie: CATEGORIE_IMPRO, resolution: RESOLUTION_DITE },
      required: ['source', 'ref', 'categorie', 'resolution'],
    },
  ],
}
/** Le sort d'UN déclencheur en attente, sous son id (schéma du MJ, à chaque échange). */
const SORT_DE_DECLENCHEUR = {
  type: 'object', additionalProperties: false,
  properties: {
    statut: { enum: STATUTS_DE_DECLENCHEUR, description: "`joue` = l'événement arrive dans cette narration ; `non-echu` = sa condition ou son délai n'est pas atteint ; `ecarte` = la fiction l'a rendu impossible." },
    motif: { type: 'string', description: "Pour `non-echu`, la condition qui manque ; pour `ecarte`, ce qui l'a rendu impossible." },
  },
  required: ['statut', 'motif'],
}
const JETS = {
  type: 'array',
  items: {
    type: 'object', additionalProperties: false,
    properties: { tirage: { type: 'integer' }, objet: { type: 'string' }, commande: { type: 'string' }, sortie: { type: 'string' } },
    required: ['tirage', 'objet', 'commande', 'sortie'],
  },
}

const JOUEUR = {
  type: 'object', additionalProperties: false,
  properties: {
    jeu: {
      type: 'object', additionalProperties: false,
      properties: { intention: { type: 'string' }, notes: { type: 'string' } },
      required: ['intention', 'notes'],
    },
  },
  required: ['jeu'],
}

/** Le classement d'UNE intention, sous son échange puis la persona qui l'a eue (schéma du juge) : une
 *  branche par classe, chacune avec SA réf et SA catégorie. */
const CLASSEMENT_D_INTENTION = {
  anyOf: [
    {
      type: 'object', additionalProperties: false,
      properties: { classe: { enum: ['prevu'] }, ref: { ...REF_NUE, description: 'La réf nue de la ligne qui prévoit cette intention.' }, categorie: VIDE },
      required: ['classe', 'ref', 'categorie'],
    },
    {
      type: 'object', additionalProperties: false,
      properties: { classe: { enum: ['IMPRO'], description: "Le livre ne la prévoit pas : le MJ a dû improviser." }, ref: VIDE, categorie: CATEGORIE_IMPRO },
      required: ['classe', 'ref', 'categorie'],
    },
    {
      type: 'object', additionalProperties: false,
      properties: { classe: { enum: ['refuse', 'hors-livre'], description: '`refuse` = la fiction l’a refusée ; `hors-livre` = elle sort du cadre du chapitre.' }, ref: VIDE, categorie: VIDE },
      required: ['classe', 'ref', 'categorie'],
    },
  ],
}
/** Le jugement d'UN déclencheur non joué ou écarté, sous son id (schéma du juge). */
const JUGEMENT_DE_DECLENCHEUR = {
  type: 'object', additionalProperties: false,
  properties: {
    manque: { type: 'boolean', description: 'Vrai quand la partie jouée remplissait sa condition au livre et que le MJ ne l’a pas joué, ou l’a écarté à tort.' },
    constat: { type: 'string' },
    ref: REF_NUE,
  },
  required: ['manque', 'constat', 'ref'],
}
const BESOINS = {
  type: 'array',
  items: {
    type: 'object', additionalProperties: false,
    properties: {
      besoin: { type: 'string' },
      personas: { type: 'array', uniqueItems: true, items: { enum: PERSONAS } },
      ref: { type: 'string', description: "La réf nue de la ligne qui prévoit l'intention, ou '' si le livre ne la prévoit pas." },
    },
    required: ['besoin', 'personas', 'ref'],
  },
}
const SYNTHESE = {
  type: 'object', additionalProperties: false,
  properties: { markdown: { type: 'string' } },
  required: ['markdown'],
}

// ── Préparation ──────────────────────────────────────────────────────────────────────────────
// Deux lecteurs en SÉQUENCE : l'auteur des fiches que les joueurs reçoivent ne voit ni le chapitre ni
// ses secrets (`EDO 02 l.40`) ; le lecteur du chapitre reçoit la liste des PJ, jamais leurs fiches.
const fichesPJ = await capturer(() => agent(`Tu PRÉPARES les personnages d'une table papier simulée : tu lis le dépôt, tu ne joues pas.
${CADRE_ARBRE}
${RENDU_AU_SCHEMA}

Rends les fiches des 4 PJ du GROUPE PRÉTIRÉ CANONIQUE du dépôt : \`makeShowcaseParty()\` (src/data/pregens.ts), sur les entrées de src/data/pregens.json. Construis-les par UNE sonde \`npx tsx -e "…"\`, sans fichier écrit, qui importe ce module de l'arbre par son chemin ABSOLU : pour chaque héros, espèce, carrière, caractéristiques effectives (\`effectiveChar\`, src/engine/characteristics.ts), valeurs de Test de ses compétences (\`testValue\`, src/engine/skills.ts), talents, possessions, points de Destin/Résilience, motivation et ambitions. \`fiche\` = cette fiche en Markdown court, valeurs chiffrées comprises (les jets se tireront sur ces valeurs) : c'est le texte que le JOUEUR de ce héros reçoit, tel quel. \`id\` = l'id du héros ; \`nom\`, \`espece\`, \`carriere\` = ceux de sa fiche.
\`groupe.source\` = la source exacte du groupe (fonction, fichier:ligne, ids) ; \`groupe.commande\` = la commande de ta sonde.`,
  { label: 'fiches-pj', phase: 'Préparation', schema: PREPARATION_PJ, agentType: 'lecteur', model: 'sonnet', effort: 'medium' }))

if (!fichesPJ.rendu) {
  log(`ARRÊT : les fiches des PJ n’ont rien rendu (${fichesPJ.cause}) — aucune partie sans fiches des PJ.`)
  return { verdict: 'ARRÊT', manques: [`fiches des PJ sans rendu — ${fichesPJ.cause}`], journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 1, mj: 0, joueurs: 0, analyse: 0, total: 1 }, date: DATE }
}
const { pjs: PJS, groupe: GROUPE } = fichesPJ.rendu
/** Chaque joueur est keyé par l'id de son PJ : un id vide ou en double confondrait deux joueurs. */
const idsDesPJ = PJS.map((pj) => pj.id)
const idsDePJInvalides = [
  ...PJS.flatMap((pj, rang) => (pj.id.trim() ? [] : [`fiches des PJ — PJ ${rang + 1} (« ${pj.nom} ») sans id`])),
  ...[...new Set(idsDesPJ.filter((id, rang) => id.trim() && idsDesPJ.indexOf(id) !== rang))].map((id) => `fiches des PJ — id « ${id} » en double`),
]
if (idsDePJInvalides.length) {
  log(`ARRÊT : ${idsDePJInvalides.length} id(s) de PJ invalide(s) — ${idsDePJInvalides.join(' · ')} ; aucune partie sur des joueurs confondus.`)
  return { verdict: 'ARRÊT', manques: idsDePJInvalides, journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 1, mj: 0, joueurs: 0, analyse: 0, total: 1 }, date: DATE }
}

/** La fiche du MJ, TIRÉE du dossier de chapitre : le livre n'est relu que pour citer une ligne. */
const ficheMJ = Object.fromEntries(CHAMPS_DE_LA_FICHE.map((champ) => [champ, DOSSIER[champ]]))
const LISTE_DES_PJ = PJS.map((pj) => ({ id: pj.id, nom: pj.nom, espece: pj.espece, carriere: pj.carriere }))
const choixDuSosie = await capturer(() => agent(`Tu PRÉPARES une table papier simulée : tu désignes, s'il y a lieu, le PJ SOSIE d'un PNJ. Tu lis, tu ne joues pas.
${CADRE}
${CHAPITRE_LU}

DOSSIER DU CHAPITRE (impératifs, beats, PNJ, indices, secrets) :
${JSON.stringify({ imperatifs: ficheMJ.imperatifs, beats: ficheMJ.beats, pnj: ficheMJ.pnj, indices: ficheMJ.indices, secrets: ficheMJ.secrets }, null, 1)}

Les PJ de la table (id, nom, espèce, carrière) :
${JSON.stringify(LISTE_DES_PJ, null, 1)}

Si le chapitre exige qu'un PJ ressemble à un PNJ (le sosie de Kastor Lieberung, \`EDO 02 l.40\`), désigne dans \`sosie\` le PJ que le livre désigne ou, à défaut, celui dont la carrière s'en rapproche le plus : \`id\` = son id NU dans la liste ci-dessus, \`ref\` = la réf nue du passage qui le désigne (relis-le au Source/). Sans sosie, \`id\` = '' et \`ref\` = ''. \`motif\` est toujours renseigné : pourquoi ce PJ, ou pourquoi aucun.`,
  {
    label: 'sosie', phase: 'Préparation', agentType: 'lecteur', model: 'sonnet', effort: 'medium',
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        sosie: {
          type: 'object', additionalProperties: false,
          properties: { id: { enum: ['', ...idsDesPJ] }, ref: { type: 'string' }, motif: { type: 'string' } },
          required: ['id', 'ref', 'motif'],
        },
      },
      required: ['sosie'],
    },
  }))

if (!choixDuSosie.rendu) {
  log(`ARRÊT : le choix du sosie n’a rien rendu (${choixDuSosie.cause}) — aucune partie sans ce choix.`)
  return { verdict: 'ARRÊT', manques: [`choix du sosie sans rendu — ${choixDuSosie.cause}`], journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 2, mj: 0, joueurs: 0, analyse: 0, total: 2 }, date: DATE }
}

const sosieRendu = choixDuSosie.rendu.sosie
const anomaliesDeSosie = !sosieRendu.id && sosieRendu.ref.trim() ? [`id vide avec ref « ${sosieRendu.ref} » : un passage cité sans PJ désigné`] : []
const sosie = sosieRendu.id ? sosieRendu : null
if (anomaliesDeSosie.length) log(`Préparation : anomalie de sosie — ${anomaliesDeSosie[0]} ; aucun PJ n’est marqué, le MJ ne reçoit aucun sosie.`)
const joueurs = PERSONAS.map((persona, rang) => ({ persona, pj: PJS[rang], sosie: Boolean(sosie) && PJS[rang].id === sosie.id }))

/** Les déclencheurs de la fiche, un par id : le lanceur ne projette qu'une fiche au schéma `ficheDeDossier`,
 *  dont les ids sont uniques. */
const DECLENCHEURS = ficheMJ.declencheurs
log(`Préparation : ${ficheMJ.beats.length} beats, ${ficheMJ.imperatifs.length} impératifs, ${DECLENCHEURS.length} déclencheur(s), tirés du dossier ; groupe ${GROUPE.source} (sonde : ${GROUPE.commande}). PJ par persona : ${joueurs.map((j) => `${j.persona} → ${j.pj.nom}${j.sosie ? ' (sosie)' : ''}`).join(', ')} ; sosie ${sosie ? sosie.id : 'aucun'} — ${sosieRendu.motif}.`)
log(`Partie : ${MAX_ECHANGES} échanges au plus ; MJ et joueurs reçoivent les ${DERNIERS_ECHANGES} derniers échanges publics, le reste vit dans le résumé privé du MJ et les notes de chaque joueur.`)

// ── Partie ───────────────────────────────────────────────────────────────────────────────────
/** Le MJ et les joueurs ne connaissent un joueur que par son PJ : sa persona ne sert qu'au journal et au juge. */
const designationDe = new Map(joueurs.map((j) => [j.pj.id, `${j.pj.nom} (${j.pj.id})`]))
const FICHES_PJ = joueurs.map((j) => `### ${designationDe.get(j.pj.id)}${j.sosie ? ' — SOSIE (secret du MJ)' : ''}\n${j.pj.fiche}`).join('\n\n')
/** La fiche privée du MJ : ses déclencheurs lui arrivent à part, avec leur état. */
const ficheSansDeclencheurs = Object.fromEntries(Object.entries(ficheMJ).filter(([champ]) => champ !== 'declencheurs'))
/** Les ids des beats de la fiche : le seul ensemble où le MJ nomme son beat courant, et le juge ses temps morts. */
const IDS_DES_BEATS = ficheMJ.beats.map((b) => b.id)
/** L'état de CHAQUE déclencheur, par id : `attente` (dernier sort rendu : `aucun` ou `non-echu`),
 *  `joue` à un échange, `ecarte` à un échange avec son motif. Joué ou écarté, il ne reçoit plus de sort. */
const etatDe = new Map(DECLENCHEURS.map((d) => [d.id, { etat: 'attente', dernierStatut: 'aucun', motif: '' }]))
const libelleDEtat = (e) => (e.etat === 'joue' ? `JOUÉ à l'échange ${e.echange}` : e.etat === 'ecarte' ? `ÉCARTÉ à l'échange ${e.echange} — ${e.motif}` : 'en attente')
const etatDesDeclencheurs = () => DECLENCHEURS.map((d) => `- ${d.id} — ${d.evenement} — condition : ${d.condition} (${d.ref.join(' ; ')}) — ${libelleDEtat(etatDe.get(d.id))}`).join('\n') || '(aucun)'
const echanges = []
/** Notes privées par RANG de joueur : deux joueurs ne partagent jamais leurs notes. */
const notes = joueurs.map(() => '')
let etatPrive = ''
let intentions = []
let tirageSuivant = 0
let fin = false
let interrompue = null
let agentsMJ = 0
let agentsJoueurs = 0
/** Chaque joueur sans rendu, à son échange et avec sa cause : un trou de la partie. */
const joueursSansRendu = []

const publicsRecents = () => echanges.slice(-DERNIERS_ECHANGES).map((e) =>
  `— Échange ${e.numero}\nIntentions : ${e.intentions.map((i) => `${designationDe.get(i.pj)} : ${i.intention}`).join(' | ') || '(ouverture)'}\nNarration : ${e.narration}`,
).join('\n\n')

for (let numero = 1; numero <= MAX_ECHANGES; numero += 1) {
  const premierTirage = tirageSuivant
  const recentsPourLeMJ = publicsRecents()
  const declencheursPourLeMJ = etatDesDeclencheurs()
  const pjsAResoudre = intentions.map((i) => i.pj)
  const enAttente = DECLENCHEURS.filter((d) => etatDe.get(d.id).etat === 'attente').map((d) => d.id)
  const promptDuMJ = `Tu es le MJ d'une table papier SIMULÉE de ${LIVRE} ${CHAPITRE}.
${CADRE}
${CHAPITRE_LU}
Tu peux relire le chapitre au Source/ pour citer la ligne exacte.

FICHE DU MJ (privée, tirée de la fiche commitée du dossier du chapitre) :
${JSON.stringify({ ...ficheSansDeclencheurs, ...(sosie ? { sosie } : {}) }, null, 1)}

DÉCLENCHEURS DU LIVRE (événements à l'initiative d'un PNJ ou du monde) :
${declencheursPourLeMJ}

FICHES DES PJ :
${FICHES_PJ}

TON RÉSUMÉ D'ÉTAT PRIVÉ de l'échange précédent : ${etatPrive || '(aucun : ouverture du chapitre)'}

DERNIERS ÉCHANGES PUBLICS :
${recentsPourLeMJ || '(aucun)'}

INTENTIONS DES JOUEURS À RÉSOUDRE :
${intentions.map((i) => `- ${designationDe.get(i.pj)} : ${i.intention}`).join('\n') || "(aucune : ouvre le chapitre tel que le livre l'ouvre)"}

Règles de ta table :
- \`resolutions\` est un objet dont chaque clé est l'id NU d'un PJ qui a une intention ci-dessus (${pjsAResoudre.map((pj) => `\`${pj}\``).join(', ') || "aucune clé : l'objet est vide"}), jamais sa désignation « Nom (id) » ; sa valeur est LA résolution de cette intention : \`source: 'livre'\` avec la réf nue de la ligne qui la prévoit, ou \`source: 'IMPRO'\` avec \`ref: ''\` et une \`categorie\` parmi ${CATEGORIES_IMPRO.join(', ')} (\`categorie: ''\` quand la source est le livre). Tu ne refuses jamais en silence : un refus de la fiction se résout et se dit.
- TOUT jet passe par l'outil de dés du moteur, jamais de tête : une commande par jet, lancée par \`ctx_shell\` (poste) ou Bash. Test simple :
  ${COMMANDE_DES} simple --seed "${SEED}" --tirage <n> --valeur <valeur de Test> --difficulte <id>
  Test opposé :
  ${COMMANDE_DES} oppose --seed "${SEED}" --tirage <n> --valeur <v> --difficulte <id> --valeur-oppose <v> --difficulte-oppose <id>
  Les ids de difficulté sont ceux de \`DIFFICULTY_LADDER\` (src/engine/tests.ts) — l'outil refuse un libellé. Les tirages de cet échange commencent à ${premierTirage} et se suivent sans trou : ${premierTirage}, ${premierTirage + 1}… Chaque commande lancée consomme son tirage, erreur comprise. Chaque jet se journalise dans \`jets\` : tirage, objet (qui teste quoi, pourquoi), commande EXACTE, sortie EXACTE.
- AVANT de résoudre les intentions, relis les déclencheurs en attente : tout déclencheur ÉCHU (sa condition est remplie, son délai est écoulé) se JOUE dans cette narration, que les joueurs l'aient cherché ou non. \`tour.declencheurs\` est un objet dont chaque clé est l'id NU d'un déclencheur EN ATTENTE (${enAttente.map((id) => `\`${id}\``).join(', ') || "aucune clé : l'objet est vide"}) ; sa valeur est son sort à cet échange : \`statut\` = \`joue\`, \`non-echu\` (\`motif\` = quelle condition manque) ou \`ecarte\` (\`motif\` = ce qui l'a rendu impossible). Un déclencheur JOUÉ ou ÉCARTÉ ne reçoit plus de sort.
- \`tour.narration\` = ce que les joueurs entendent, rien de la fiche privée qu'ils n'ont pas découvert. \`tour.etatPrive\` = ton nouveau résumé privé (où en est le chapitre, ce que chaque PNJ sait et veut, les fils ouverts). \`tour.beat\` = l'id du beat courant de la fiche. \`fin: true\` quand le chapitre est clos selon le livre.`
  /** Les tirages d'un rendu du MJ hors de la suite de cet échange, ou sans la graine et le tirage dans leur commande. */
  const anomaliesDeTirageDe = (rendu) => rendu.jets.flatMap((jet, rang) => [
    ...(jet.tirage === premierTirage + rang ? [] : [`jet ${rang + 1} : tirage ${jet.tirage}, attendu ${premierTirage + rang} — relance sa commande au tirage ${premierTirage + rang} ; la résolution et la narration qui dépendent de ce jet suivent sa nouvelle sortie`]),
    ...(jet.commande.includes(`--seed "${SEED}"`) && new RegExp(`--tirage ${jet.tirage}(?!\\d)`).test(jet.commande) ? [] : [`jet ${rang + 1} : commande sans --seed "${SEED}" ou sans --tirage ${jet.tirage}`]),
  ])
  /** Les déclencheurs d'un rendu du MJ non joués sans motif. */
  const anomaliesDeDeclencheursDe = (rendu) => enAttente.filter((id) => rendu.tour.declencheurs[id].statut !== 'joue' && !rendu.tour.declencheurs[id].motif.trim())
    .map((id) => `déclencheur « ${id} » : statut « ${rendu.tour.declencheurs[id].statut} » sans motif`)
  const appelDuMJ = await appelValide(promptDuMJ, (prompt, essai) => agent(prompt,
    {
      label: essai ? `mj:${numero}:renvoi${essai}` : `mj:${numero}`, phase: 'Partie', agentType: 'mj-de-table', model: 'sonnet', effort: 'medium',
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          resolutions: { type: 'object', additionalProperties: false, properties: proprietesPar(pjsAResoudre, () => RESOLUTION), required: pjsAResoudre },
          jets: JETS,
          tour: {
            type: 'object', additionalProperties: false,
            properties: {
              narration: { type: 'string' },
              etatPrive: { type: 'string' },
              beat: { enum: IDS_DES_BEATS },
              declencheurs: { type: 'object', additionalProperties: false, properties: proprietesPar(enAttente, () => SORT_DE_DECLENCHEUR), required: enAttente },
            },
            required: ['narration', 'etatPrive', 'beat', 'declencheurs'],
          },
          fin: { type: 'boolean' },
        },
        required: ['resolutions', 'jets', 'tour', 'fin'],
      },
    }),
  (rendu) => [...anomaliesDeTirageDe(rendu), ...anomaliesDeDeclencheursDe(rendu)])
  agentsMJ += 1 + appelDuMJ.renvois
  const mj = appelDuMJ.rendu
  if (!mj) {
    interrompue = { echange: numero, cause: `MJ — ${appelDuMJ.cause}`, intentionsNonResolues: intentions }
    log(`Échange ${numero} : le MJ n’a rien rendu (${appelDuMJ.cause}) — partie INTERROMPUE après ${echanges.length} échange(s) joué(s), ${intentions.length} intention(s) de joueur restée(s) sans résolution.`)
    break
  }
  if (appelDuMJ.renvois) log(`Échange ${numero} : ${appelDuMJ.renvois} renvoi(s) au MJ pour anomalie(s) ; ${appelDuMJ.anomalies.length} restée(s).`)
  /** Ce que les renvois ont perdu : un renvoi sans rendu, et sa cause. */
  const anomaliesDeRenvoi = appelDuMJ.anomalies.filter((a) => !anomaliesDeTirageDe(mj).includes(a) && !anomaliesDeDeclencheursDe(mj).includes(a))
  const declencheursDeLEchange = enAttente.map((id) => ({ id, ...mj.tour.declencheurs[id] }))
  const anomaliesDeDeclencheurs = anomaliesDeDeclencheursDe(mj)
  for (const d of declencheursDeLEchange) {
    if (d.statut === 'joue') etatDe.set(d.id, { etat: 'joue', echange: numero })
    else if (d.statut === 'ecarte') etatDe.set(d.id, { etat: 'ecarte', echange: numero, motif: d.motif })
    else etatDe.set(d.id, { etat: 'attente', dernierStatut: d.statut, motif: d.motif })
  }
  if (anomaliesDeDeclencheurs.length) log(`Échange ${numero} : ${anomaliesDeDeclencheurs.length} anomalie(s) de déclencheur — ${anomaliesDeDeclencheurs.join(' · ')}.`)
  const anomaliesDeTirage = anomaliesDeTirageDe(mj)
  tirageSuivant = mj.jets.reduce((m, jet) => Math.max(m, jet.tirage + 1), premierTirage + mj.jets.length)
  if (anomaliesDeTirage.length) log(`Échange ${numero} : ${anomaliesDeTirage.length} anomalie(s) de tirage — ${anomaliesDeTirage.join(' · ')}. Tirage suivant : ${tirageSuivant}.`)
  etatPrive = mj.tour.etatPrive
  echanges.push({
    numero, intentions, resolutions: intentions.map((i) => ({ persona: i.persona, pj: i.pj, intention: i.intention, ...mj.resolutions[i.pj] })), jets: mj.jets, anomaliesDeTirage, declencheurs: declencheursDeLEchange, anomaliesDeDeclencheurs,
    renvois: appelDuMJ.renvois, anomaliesDeRenvoi, narration: mj.tour.narration, beat: mj.tour.beat, etatPrive: mj.tour.etatPrive, fin: mj.fin,
  })
  if (mj.fin) {
    fin = true
    break
  }
  if (numero === MAX_ECHANGES) break

  const recentsPourLesJoueurs = publicsRecents()
  const rendus = await parallel(joueurs.map((j, rang) => () => capturer(() => agent(`Tu JOUES un personnage à une table de jeu de rôle (Warhammer). Tu ne sais du monde que ce que la narration du MJ t'a dit.
Tu n'ouvres AUCUN fichier et tu ne lances AUCUNE commande : tu joues depuis ce message seul, jamais depuis le livre ni le dépôt.

TA PERSONA — ${JEUX_DE_PERSONA[j.persona]}

TA FICHE :
${j.pj.fiche}

TES NOTES PRIVÉES : ${notes[rang] || '(aucune)'}

CE QUE LE MJ A RACONTÉ (derniers échanges publics) :
${recentsPourLesJoueurs}

Rends \`jeu.intention\` : ce que ton personnage fait ou dit MAINTENANT, en une ou deux phrases à la première personne, fidèle à ta persona. Rends \`jeu.notes\` : tes notes privées mises à jour (soupçons, noms, plans), elles te seront rendues au prochain échange.`,
    { label: `joueur:${j.persona}:${numero}`, phase: 'Partie', schema: JOUEUR, agentType: 'joueur', model: 'sonnet', effort: 'low' }))))
  agentsJoueurs += joueurs.length
  intentions = []
  rendus.forEach((r, rang) => {
    const j = joueurs[rang]
    if (!r.rendu) {
      log(`Échange ${numero} : le joueur ${j.persona} n’a rien rendu (${r.cause}) — aucune intention de sa part à cet échange.`)
      joueursSansRendu.push(`échange ${numero} : ${j.persona} — ${r.cause}`)
      return
    }
    notes[rang] = r.rendu.jeu.notes
    intentions.push({ persona: j.persona, pj: j.pj.id, intention: r.rendu.jeu.intention })
  })
  if (joueursSansRendu.length) {
    log(`Partie arrêtée à l’échange ${numero} : un joueur sans rendu fixe déjà le verdict PARTIE INCOMPLÈTE.`)
    break
  }
}
const plafondAtteint = !fin && !interrompue && echanges.length === MAX_ECHANGES
if (plafondAtteint) log(`Partie : plafond de ${MAX_ECHANGES} échanges atteint SANS fin de chapitre (dernier beat : ${echanges[echanges.length - 1].beat}).`)

const journal = {
  livre: LIVRE, chapitre: CHAPITRE, fichiers: FICHIERS, seed: SEED, maxEchanges: MAX_ECHANGES,
  preparation: { pjs: PJS, groupe: GROUPE, ficheMJ, sosie: sosieRendu, anomaliesDeSosie },
  joueurs: joueurs.map((j) => ({ persona: j.persona, pj: j.pj.id, nom: j.pj.nom, sosie: j.sosie })),
  echanges, notesFinales: joueurs.map((j, rang) => ({ persona: j.persona, pj: j.pj.id, notes: notes[rang] })), tiragesConsommes: tirageSuivant, fin, plafondAtteint, interrompue,
}
/** Ce que le juge reçoit de la partie : ses SORTIES — intentions, résolutions dites, jets, sorts des
 *  déclencheurs, narration, beat — jamais l'état privé du MJ, son classement de ses propres résolutions ni
 *  les notes privées des joueurs (#2721 : le relecteur ne voit que la sortie). */
const journalDuJuge = {
  livre: LIVRE, chapitre: CHAPITRE, maxEchanges: MAX_ECHANGES,
  preparation: { pjs: PJS, ficheMJ, sosie: sosieRendu },
  joueurs: journal.joueurs,
  echanges: echanges.map((e) => ({
    numero: e.numero, intentions: e.intentions, resolutions: e.resolutions.map((r) => ({ persona: r.persona, pj: r.pj, resolution: r.resolution })),
    jets: e.jets, declencheurs: e.declencheurs.map((d) => ({ id: d.id, statut: d.statut })), narration: e.narration, beat: e.beat, fin: e.fin,
  })),
  fin, plafondAtteint, interrompue,
}

/** Ce que la partie n'a pas joué du livre : rendu, journalisé, et jugé par une rubrique de l'analyse. */
const declencheursNonJoues = DECLENCHEURS.filter((d) => etatDe.get(d.id).etat === 'attente')
  .map((d) => ({ id: d.id, evenement: d.evenement, ref: d.ref, dernierStatut: etatDe.get(d.id).dernierStatut, motif: etatDe.get(d.id).motif }))
const declencheursEcartes = DECLENCHEURS.filter((d) => etatDe.get(d.id).etat === 'ecarte')
  .map((d) => ({ id: d.id, evenement: d.evenement, ref: d.ref, echange: etatDe.get(d.id).echange, motif: etatDe.get(d.id).motif }))
const bilanDesDeclencheurs = `déclencheurs : ${declencheursNonJoues.length} NON JOUÉ(S)${declencheursNonJoues.length ? ` (${declencheursNonJoues.map((d) => `${d.id} ${d.ref.join(' ; ')}, dernier sort ${d.dernierStatut}`).join(' ; ')})` : ''}, ${declencheursEcartes.length} ÉCARTÉ(S)${declencheursEcartes.length ? ` (${declencheursEcartes.map((d) => `${d.id} à l'échange ${d.echange} — ${d.motif}`).join(' ; ')})` : ''}`

/** Les anomalies d'une espèce, sur toute la partie, chacune à son échange. */
const anomaliesDesEchanges = (espece) => echanges.flatMap((e) => e[espece].map((a) => `échange ${e.numero} : ${a}`))
/** Les TROUS du run, par espèce, chacune sous le verdict qui la nomme, dans l'ordre où elles le priment :
 *  SIGNAL ou THÉÂTRE ne se rend que si toutes sont vides. Chaque trou d'agent nomme sa cause. */
const trousDuRun = ({ fuites = [], analyseSansRendu = [] } = {}) => [
  { espece: 'interruption', verdict: 'INTERROMPU', liste: interrompue ? [`échange ${interrompue.echange} : ${interrompue.cause}, ${interrompue.intentionsNonResolues.length} intention(s) sans résolution`] : [] },
  { espece: 'joueursSansRendu', verdict: 'PARTIE INCOMPLÈTE', liste: joueursSansRendu },
  { espece: 'anomaliesDeSosie', verdict: 'PARTIE ANOMALE', liste: anomaliesDeSosie },
  { espece: 'anomaliesDeTirage', verdict: 'PARTIE ANOMALE', liste: anomaliesDesEchanges('anomaliesDeTirage') },
  { espece: 'anomaliesDeDeclencheurs', verdict: 'PARTIE ANOMALE', liste: anomaliesDesEchanges('anomaliesDeDeclencheurs') },
  { espece: 'fuites', verdict: 'PARTIE ANOMALE', liste: fuites },
  { espece: 'analyseSansRendu', verdict: 'SANS ANALYSE', liste: analyseSansRendu },
]
/** Le verdict et les trous d'un run : `succes` ne se rend que sur une liste de trous vide. */
const conclusion = (trous, succes) => {
  const troues = trous.filter((t) => t.liste.length)
  if (troues.length) log(`Verdict ${troues[0].verdict} — trous : ${troues.map((t) => `${t.espece} (${t.liste.join(' · ')})`).join(' ; ')}.`)
  return { verdict: troues.length ? troues[0].verdict : succes, trous: Object.fromEntries(trous.map((t) => [t.espece, t.liste])) }
}

if (!echanges.length) {
  const agentsSansAnalyse = { preparation: 2, mj: agentsMJ, joueurs: agentsJoueurs, analyse: 0, total: 2 + agentsMJ + agentsJoueurs }
  log(`Analyse : aucune — la partie est INTERROMPUE avant son premier échange (${interrompue.cause}) ; ${bilanDesDeclencheurs}.`)
  return { ...conclusion(trousDuRun(), null), journal, analyse: null, declencheursNonJoues, declencheursEcartes, agents: agentsSansAnalyse, date: DATE }
}

// ── Analyse ──────────────────────────────────────────────────────────────────────────────────
/** Les ensembles que le juge désigne : chaque intention du journal sous (échange, persona), chaque
 *  déclencheur non joué ou écarté, les échanges joués, les secrets de la fiche du MJ. */
const personasParEchange = new Map(echanges.filter((e) => e.intentions.length).map((e) => [String(e.numero), e.intentions.map((i) => i.persona)]))
const echangesClasses = [...personasParEchange.keys()]
const aJuger = [...declencheursNonJoues, ...declencheursEcartes].map((d) => d.id)
const NUMEROS_D_ECHANGE = echanges.map((e) => e.numero)
const IDS_DES_SECRETS = ficheMJ.secrets.map((s) => s.id)
/** La réf de chaque secret de la fiche, par id : le juge nomme le secret, le script en porte la réf. */
const refDuSecret = new Map(ficheMJ.secrets.map((s) => [s.id, s.ref]))
const analyse = await capturer(() => agent(`Tu ANALYSES une table papier simulée de ${LIVRE} ${CHAPITRE}. Relis le chapitre au Source/ : le journal dit ce qui s'est joué, le livre dit ce qui était prévu.
${CADRE}
${CHAPITRE_LU}

JOURNAL DE LA PARTIE (ses sorties ; ni l'état privé du MJ, ni son classement de ses résolutions, ni ses motifs) :
${JSON.stringify(journalDuJuge, null, 1)}

DÉCLENCHEURS NON JOUÉS OU ÉCARTÉS :
${JSON.stringify([...declencheursNonJoues.map(({ id, evenement, ref }) => ({ id, evenement, ref })), ...declencheursEcartes.map(({ id, evenement, ref, echange }) => ({ id, evenement, ref, echange }))], null, 1)}

Rends :
- intentions : un objet dont chaque clé est le numéro d'un échange qui porte des intentions (${echangesClasses.map((n) => `\`${n}\``).join(', ') || "aucune clé : l'objet est vide"}), et sa valeur un objet dont chaque clé est la persona d'une intention de cet échange (\`echanges[].intentions[].persona\`) : chacune classée par toi, au livre : \`prevu\` (réf nue de la ligne qui la prévoit), \`IMPRO\` (le livre ne la prévoit pas et le MJ a dû improviser — \`categorie\` parmi ${CATEGORIES_IMPRO.join(', ')}), \`refuse\` (la fiction l'a refusée), \`hors-livre\` (elle sort du cadre du chapitre). \`ref: ''\` et \`categorie: ''\` quand ils ne s'appliquent pas.
- tempsMorts : chaque suite de BEATS du livre traversés sans décision de joueur (\`beats\` = ids des beats de la fiche du MJ, \`echanges\` = numéros des échanges concernés, constat). Un temps mort se mesure en beats, jamais en nombre d'échanges. ${plafondAtteint ? `La partie s'est arrêtée au plafond de ${MAX_ECHANGES} échanges (\`plafondAtteint\`), chapitre non clos : un beat qu'elle n'a pas atteint n'est pas un temps mort.` : "La partie ne s'est pas arrêtée au plafond d'échanges (`plafondAtteint: false`)."}
- pistesRatees : indices et accroches du livre que la table n'a pas saisis, avec réf.
- declencheurs : un objet dont chaque clé est l'id d'un déclencheur de la liste ci-dessus (${aJuger.map((id) => `\`${id}\``).join(', ') || "aucune clé : l'objet est vide"}) : \`manque: true\` quand la partie jouée remplissait sa condition au livre et que le MJ ne l'a pas joué (ou l'a écarté à tort), \`false\` sinon ; \`constat\` dit pourquoi, \`ref\` = la réf nue qui le prouve.
- fuites : chaque narration du MJ qui révèle un secret de sa fiche (\`preparation.ficheMJ.secrets\`, par son id) sans que les joueurs aient trouvé d'indice (\`preparation.ficheMJ.indices\`) qui y mène : \`echange\` = son numéro, \`secret\` = l'id du secret, \`constat\` = ce que la narration révèle et pourquoi aucun indice trouvé n'y mène. Un test réussi sur une piste qu'aucun indice de la fiche ne couvre N'EST PAS un indice trouvé : la narration qui en tire un secret reste une fuite. Une fuite fausse la partie : les joueurs jouent ensuite sur une information volée.
- besoins : ce que le jeu devra offrir pour que ces intentions aboutissent, chacun avec les personas qui ont eu l'intention et la réf du livre qui la prévoit (\`''\` s'il ne la prévoit pas). Tu ne tries pas : le script retient.
- synthese.markdown : une synthèse courte.
Un jet du journal se vérifie en rejouant sa commande : l'outil est déterministe.`,
  {
    label: 'analyse', phase: 'Analyse', agentType: 'juge-de-source', model: 'opus', effort: 'high',
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        intentions: {
          type: 'object', additionalProperties: false,
          properties: proprietesPar(echangesClasses, (numero) => ({
            type: 'object', additionalProperties: false,
            properties: proprietesPar(personasParEchange.get(numero), () => CLASSEMENT_D_INTENTION),
            required: personasParEchange.get(numero),
          })),
          required: echangesClasses,
        },
        tempsMorts: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            properties: { beats: { type: 'array', items: { enum: IDS_DES_BEATS } }, echanges: { type: 'array', items: { enum: NUMEROS_D_ECHANGE } }, constat: { type: 'string' } },
            required: ['beats', 'echanges', 'constat'],
          },
        },
        pistesRatees: { type: 'array', items: REF },
        declencheurs: { type: 'object', additionalProperties: false, properties: proprietesPar(aJuger, () => JUGEMENT_DE_DECLENCHEUR), required: aJuger },
        fuites: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            properties: { echange: { enum: NUMEROS_D_ECHANGE }, secret: { enum: IDS_DES_SECRETS }, constat: { type: 'string' } },
            required: ['echange', 'secret', 'constat'],
          },
        },
        besoins: BESOINS,
        synthese: SYNTHESE,
      },
      required: ['intentions', 'tempsMorts', 'pistesRatees', 'declencheurs', 'fuites', 'besoins', 'synthese'],
    },
  }))

const agents = { preparation: 2, mj: agentsMJ, joueurs: agentsJoueurs, analyse: 1, total: 3 + agentsMJ + agentsJoueurs }
if (!analyse.rendu) {
  log(`Analyse : le juge n’a rien rendu (${analyse.cause}) — le journal est rendu sans classement ; ${bilanDesDeclencheurs}.`)
  return { ...conclusion(trousDuRun({ analyseSansRendu: [`analyse — ${analyse.cause}`] }), null), journal, analyse: null, declencheursNonJoues, declencheursEcartes, agents, date: DATE }
}

/** Le classement du juge, remis à la forme du journal : une entrée par intention, une par déclencheur jugé. */
const classement = analyse.rendu
const intentionsClassees = echanges.flatMap((e) => e.intentions.map((i) => ({ echange: e.numero, persona: i.persona, intention: i.intention, ...classement.intentions[e.numero][i.persona] })))
const declencheursJuges = aJuger.map((id) => ({ id, ...classement.declencheurs[id] }))
const adverses = intentionsClassees.filter((i) => PERSONAS_ADVERSES.includes(i.persona) && (i.classe === 'refuse' || i.classe === 'hors-livre'))
const besoins = classement.besoins.map((b) => ({ ...b, retenu: b.personas.length >= 2 || b.ref !== '' }))
const fuitesSourcees = classement.fuites.map((f) => ({ ...f, ref: refDuSecret.get(f.secret) }))
const fuites = fuitesSourcees.map((f) => `échange ${f.echange} : secret « ${f.secret} » — ${f.constat} (${f.ref.join(' ; ')})`)
const manquesDuMJ = declencheursJuges.filter((d) => d.manque)
const { verdict, trous } = conclusion(trousDuRun({ fuites }), adverses.length ? 'SIGNAL' : 'THÉÂTRE')
log(`Analyse : ${verdict} — ${intentionsClassees.length} intention(s) classée(s), dont ${adverses.length} refusée(s) ou hors livre jouée(s) par les personas adverses (${PERSONAS_ADVERSES.join(', ')}) ; ${classement.tempsMorts.length} temps mort(s) ; ${fuites.length} fuite(s) de secret ; ${bilanDesDeclencheurs}, dont ${manquesDuMJ.length} MANQUÉ(S) par le MJ ; besoins ${besoins.filter((b) => b.retenu).length} retenu(s) sur ${besoins.length} ; ${agents.total} agents joués (2 de préparation, ${agentsMJ} MJ, ${agentsJoueurs} joueurs, 1 juge).`)
const { synthese, ...reste } = classement
return { verdict, trous, journal, analyse: { ...reste, intentions: intentionsClassees, declencheurs: declencheursJuges, fuites: fuitesSourcees, besoins, synthese_markdown: synthese.markdown }, declencheursNonJoues, declencheursEcartes, agents, date: DATE }
