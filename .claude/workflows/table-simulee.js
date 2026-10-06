export const meta = {
  name: 'table-simulee',
  description: "Table papier SIMULÉE d'un chapitre de campagne, sur son DOSSIER : un lecteur prépare les 4 PJ du groupe prétiré canonique (sans rien savoir du chapitre), un autre désigne le sosie sur le dossier et la liste des PJ ; la fiche du MJ est tirée du dossier. Puis une partie de `maxEchanges` échanges au plus (défaut : 3 par beat du dossier ; chaque échange coûte ≈ 5 agents, 1 MJ + 4 joueurs), plafond que le MJ ignore — un MJ agent qui cite le livre ou déclare IMPRO, tire chaque jet par l'outil de dés du moteur et rend le sort de chaque déclencheur, quatre joueurs CLOISONNÉS à personas (dont deux adverses), que le MJ et les autres joueurs ne connaissent que par leur PJ —, enfin un juge classe chaque intention et chaque déclencheur non joué ou écarté, mesure les temps morts en beats, relève chaque secret que la narration du MJ a fui, et le script calcule le verdict et les besoins retenus. Toute sortie d'agent qui désigne un membre d'un ensemble fermé (PJ, déclencheur en attente, beat, persona, secret, échange, id du sosie) est contrainte par le SCHÉMA de son appel — enum, ou objet dont les clés sont exactement les membres qui doivent chacun recevoir une entrée —, jamais re-vérifiée par le script. Le verdict se DÉRIVE de `trous`, une liste par espèce : SIGNAL ou THÉÂTRE quand toutes sont vides, sinon la première espèce trouée le nomme — INTERROMPU (le MJ n'a rien rendu, à quelque échange que ce soit), PARTIE INCOMPLÈTE (un joueur sans rendu), PARTIE ANOMALE (sosie à id vide qui cite un passage, tirage hors suite, déclencheur non joué sans motif, secret fui par la narration du MJ), SANS ANALYSE (juge sans rendu) ; ARRÊT avant la partie. Rend le journal complet (base de rejeu), l'analyse, les déclencheurs non joués et écartés. args : { livre, chapitre, fichiers, dossier, seed, maxEchanges?, personas?, worktree, date } — `dossier` = l'OBJET de la fiche commitée du chapitre (`docs/dossiers/<livre>/<chapitre>.json`, schéma `ficheDeDossier`), chargé et gardé par le lanceur : `node scripts/raw/workflow-args.mjs table-simulee <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> --seed <graine>`.",
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

/** Le jeu de chaque persona — la clé est l'id passé en `args.personas`. */
const JEUX_DE_PERSONA = {
  'rôliste': 'ROLISTE : tu joues ton personnage — sa carrière, sa motivation, ses ambitions — et tu suis les accroches qui le concernent.',
  'fouineur': 'FOUINEUR : tu fouilles, tu interroges, tu soupçonnes — chaque PNJ ment peut-être, chaque lieu cache quelque chose.',
  'saboteur': "SABOTEUR : tu refuses l'accroche, tu mens aux autorités, tu t'en prends au mauvais PNJ — tu éprouves ce que le chapitre fait d'un groupe qui ne coopère pas.",
  'hors-cadre': "HORS-CADRE : tu quittes la zone, tu ignores l'enquête, tu poursuis tes propres buts — tu éprouves ce que le chapitre fait d'un groupe qui va ailleurs.",
}
/** Personas ADVERSES imposées à toute table (skill `adapter-une-campagne`, « Règles de lecture »). */
const PERSONAS_ADVERSES = ['saboteur', 'hors-cadre']
/** Catégories d'IMPRO du MJ — ids STABLES, communs au MJ et au juge. */
const CATEGORIES_IMPRO = ['veracite-rumeur', 'consequence-ouverte', 'rythme-deblocage', 'variante-pnj', 'encart-optionnel', 'hors-livre']
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
  ...manquesDuDossier(),
].filter(Boolean)
if (manquesDArgs.length) {
  log(`ARRÊT : ${manquesDArgs.length} argument(s) manquant(s) ou invalide(s) — ${manquesDArgs.join(' · ')}`)
  return { verdict: 'ARRÊT', manques: manquesDArgs, journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 0, mj: 0, joueurs: 0, analyse: 0, total: 0 }, date: DATE }
}
const MAX_ECHANGES = MAX_ECHANGES_EXPLICITE ?? ECHANGES_PAR_BEAT * DOSSIER.beats.length

/** Comment un agent de ce workflow EXÉCUTE : un agent de fond dont la commande attend une autorisation
 *  reste bloqué sans fin. */
const EXECUTION = `Toute commande passe par l'outil \`ctx_shell\`, son paramètre \`cwd\` = l'arbre ci-dessus : UNE commande simple par appel, sans changement de dossier, sans enchaînement ni pipe, sans redirection, sans variable d'environnement en tête ; UN SEUL appel \`ctx_shell\` par message, jamais plusieurs en parallèle. Une sonde est une commande (\`npx tsx -e "…"\`, \`git grep …\`), jamais un fichier écrit ; tout processus lancé est TUÉ avant ton rendu.`
/** Le cadre d'un agent qui ne lit PAS le livre : le lecteur des fiches des PJ, qui ne doit rien en savoir. */
const CADRE_ARBRE = `Arbre (chemin ABSOLU, à utiliser tel quel) : ${WORKTREE}
Date du jour : ${DATE}
LECTURE SEULE : tu n'écris AUCUN fichier, ni sous l'arbre ni ailleurs. Aucun git écrivain, aucune suite de tests, aucune gate.
${EXECUTION}`
const RENDU_AU_SCHEMA = `Ton rendu = l'objet du schéma, rien d'autre.`

const CADRE = `${CADRE_ARBRE} Toute référence au livre est NUE : \`${LIVRE} ${CHAPITRE} l.<ligne>\` (ligne du fichier Source/). Un numéro de ligne se prend sur une lecture BRUTE numérotée (\`grep -n\`, \`sed -n 'X,Yp'\`, \`ctx_read\` en mode \`raw\`), jamais sur une vue résumée ou compressée ; toute réf se vérifie en relisant la ligne citée avant d'être rendue. Une absence se prouve par une sonde et son périmètre, jamais par « je n'ai pas trouvé ».
${RENDU_AU_SCHEMA}`

const CHAPITRE_LU = `Chapitre : ${LIVRE} ${CHAPITRE} — fichiers Source/ (relatifs à l'arbre) : ${FICHIERS.join(' · ')}`

const REF = { type: 'object', additionalProperties: false, properties: { texte: { type: 'string' }, ref: { type: 'string' } }, required: ['texte', 'ref'] }

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

/** La résolution d'UNE intention, sous l'id du PJ qui l'a eue (schéma du MJ, à chaque échange). */
const RESOLUTION = {
  type: 'object', additionalProperties: false,
  properties: {
    source: { enum: ['livre', 'IMPRO'] },
    ref: { type: 'string' },
    categorie: { enum: ['', ...CATEGORIES_IMPRO] },
    resolution: { type: 'string' },
  },
  required: ['source', 'ref', 'categorie', 'resolution'],
}
/** Le sort d'UN déclencheur en attente, sous son id (schéma du MJ, à chaque échange). */
const SORT_DE_DECLENCHEUR = {
  type: 'object', additionalProperties: false,
  properties: { statut: { enum: STATUTS_DE_DECLENCHEUR }, motif: { type: 'string' } },
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

/** Le classement d'UNE intention, sous son échange puis la persona qui l'a eue (schéma du juge). */
const CLASSEMENT_D_INTENTION = {
  type: 'object', additionalProperties: false,
  properties: {
    classe: { enum: ['prevu', 'IMPRO', 'refuse', 'hors-livre'] },
    ref: { type: 'string' },
    categorie: { enum: ['', ...CATEGORIES_IMPRO] },
  },
  required: ['classe', 'ref', 'categorie'],
}
/** Le jugement d'UN déclencheur non joué ou écarté, sous son id (schéma du juge). */
const JUGEMENT_DE_DECLENCHEUR = {
  type: 'object', additionalProperties: false,
  properties: { manque: { type: 'boolean' }, constat: { type: 'string' }, ref: { type: 'string' } },
  required: ['manque', 'constat', 'ref'],
}
const BESOINS = {
  type: 'array',
  items: {
    type: 'object', additionalProperties: false,
    properties: { besoin: { type: 'string' }, personas: { type: 'array', uniqueItems: true, items: { enum: PERSONAS } }, ref: { type: 'string' } },
    required: ['besoin', 'personas', 'ref'],
  },
}
const SYNTHESE = {
  type: 'object', additionalProperties: false,
  properties: { markdown: { type: 'string' } },
  required: ['markdown'],
}

const COMMANDE_DES = 'npx tsx scripts/ops/table-des.mts'

// ── Préparation ──────────────────────────────────────────────────────────────────────────────
// Deux lecteurs en SÉQUENCE : l'auteur des fiches que les joueurs reçoivent ne voit ni le chapitre ni
// ses secrets (`EDO 02 l.40`) ; le lecteur du chapitre reçoit la liste des PJ, jamais leurs fiches.
const fichesPJ = await agent(`Tu PRÉPARES les personnages d'une table papier simulée : tu lis le dépôt, tu ne joues pas.
${CADRE_ARBRE}
${RENDU_AU_SCHEMA}

Rends les fiches des 4 PJ du GROUPE PRÉTIRÉ CANONIQUE du dépôt : \`makeShowcaseParty()\` (src/data/pregens.ts), sur les entrées de src/data/pregens.json. Construis-les par UNE sonde \`npx tsx -e "…"\`, sans fichier écrit, qui importe ce module de l'arbre : pour chaque héros, espèce, carrière, caractéristiques effectives (\`effectiveChar\`, src/engine/characteristics.ts), valeurs de Test de ses compétences (\`testValue\`, src/engine/skills.ts), talents, possessions, points de Destin/Résilience, motivation et ambitions. \`fiche\` = cette fiche en Markdown court, valeurs chiffrées comprises (les jets se tireront sur ces valeurs) : c'est le texte que le JOUEUR de ce héros reçoit, tel quel. \`id\` = l'id du héros ; \`nom\`, \`espece\`, \`carriere\` = ceux de sa fiche.
\`groupe.source\` = la source exacte du groupe (fonction, fichier:ligne, ids) ; \`groupe.commande\` = la commande de ta sonde.`,
  { label: 'fiches-pj', phase: 'Préparation', schema: PREPARATION_PJ, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })

if (!fichesPJ) {
  log('ARRÊT : les fiches des PJ n’ont rien rendu — aucune partie sans fiches des PJ.')
  return { verdict: 'ARRÊT', manques: ['fiches des PJ sans rendu'], journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 1, mj: 0, joueurs: 0, analyse: 0, total: 1 }, date: DATE }
}
/** Chaque joueur est keyé par l'id de son PJ : un id vide ou en double confondrait deux joueurs. */
const idsDesPJ = fichesPJ.pjs.map((pj) => pj.id)
const idsDePJInvalides = [
  ...fichesPJ.pjs.flatMap((pj, rang) => (pj.id.trim() ? [] : [`fiches des PJ — PJ ${rang + 1} (« ${pj.nom} ») sans id`])),
  ...[...new Set(idsDesPJ.filter((id, rang) => id.trim() && idsDesPJ.indexOf(id) !== rang))].map((id) => `fiches des PJ — id « ${id} » en double`),
]
if (idsDePJInvalides.length) {
  log(`ARRÊT : ${idsDePJInvalides.length} id(s) de PJ invalide(s) — ${idsDePJInvalides.join(' · ')} ; aucune partie sur des joueurs confondus.`)
  return { verdict: 'ARRÊT', manques: idsDePJInvalides, journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 1, mj: 0, joueurs: 0, analyse: 0, total: 1 }, date: DATE }
}

/** La fiche du MJ, TIRÉE du dossier de chapitre : le livre n'est relu que pour citer une ligne. */
const ficheMJ = Object.fromEntries(CHAMPS_DE_LA_FICHE.map((champ) => [champ, DOSSIER[champ]]))
const LISTE_DES_PJ = fichesPJ.pjs.map((pj) => ({ id: pj.id, nom: pj.nom, espece: pj.espece, carriere: pj.carriere }))
const choixDuSosie = await agent(`Tu PRÉPARES une table papier simulée : tu désignes, s'il y a lieu, le PJ SOSIE d'un PNJ. Tu lis, tu ne joues pas.
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
  })

if (!choixDuSosie) {
  log('ARRÊT : le choix du sosie n’a rien rendu — aucune partie sans ce choix.')
  return { verdict: 'ARRÊT', manques: ['choix du sosie sans rendu'], journal: null, analyse: null, ...SANS_DECLENCHEURS, agents: { preparation: 2, mj: 0, joueurs: 0, analyse: 0, total: 2 }, date: DATE }
}

const sosieRendu = choixDuSosie.sosie
const anomaliesDeSosie = !sosieRendu.id && sosieRendu.ref.trim() ? [`id vide avec ref « ${sosieRendu.ref} » : un passage cité sans PJ désigné`] : []
const sosie = sosieRendu.id ? sosieRendu : null
if (anomaliesDeSosie.length) log(`Préparation : anomalie de sosie — ${anomaliesDeSosie[0]} ; aucun PJ n’est marqué, le MJ ne reçoit aucun sosie.`)
const joueurs = PERSONAS.map((persona, rang) => ({ persona, pj: fichesPJ.pjs[rang], sosie: Boolean(sosie) && fichesPJ.pjs[rang].id === sosie.id }))

/** Les déclencheurs de la fiche, un par id : le lanceur ne projette qu'une fiche au schéma `ficheDeDossier`,
 *  dont les ids sont uniques. */
const DECLENCHEURS = ficheMJ.declencheurs
log(`Préparation : ${ficheMJ.beats.length} beats, ${ficheMJ.imperatifs.length} impératifs, ${DECLENCHEURS.length} déclencheur(s), tirés du dossier ; groupe ${fichesPJ.groupe.source} (sonde : ${fichesPJ.groupe.commande}). PJ par persona : ${joueurs.map((j) => `${j.persona} → ${j.pj.nom}${j.sosie ? ' (sosie)' : ''}`).join(', ')} ; sosie ${sosie ? sosie.id : 'aucun'} — ${sosieRendu.motif}.`)
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
/** Chaque joueur sans rendu, à son échange : un trou de la partie. */
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
  const mj = await agent(`Tu es le MJ d'une table papier SIMULÉE de ${LIVRE} ${CHAPITRE}.
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
- TOUT jet passe par l'outil de dés du moteur, jamais de tête : une commande par jet, lancée par \`ctx_shell\` avec \`cwd\` = l'arbre. Test simple :
  ${COMMANDE_DES} simple --seed "${SEED}" --tirage <n> --valeur <valeur de Test> --difficulte <id>
  Test opposé :
  ${COMMANDE_DES} oppose --seed "${SEED}" --tirage <n> --valeur <v> --difficulte <id> --valeur-oppose <v> --difficulte-oppose <id>
  Les ids de difficulté sont ceux de \`DIFFICULTY_LADDER\` (src/engine/tests.ts) — l'outil refuse un libellé. Les tirages de cet échange commencent à ${premierTirage} et se suivent sans trou : ${premierTirage}, ${premierTirage + 1}… Chaque commande lancée consomme son tirage, erreur comprise. Chaque jet se journalise dans \`jets\` : tirage, objet (qui teste quoi, pourquoi), commande EXACTE, sortie EXACTE.
- AVANT de résoudre les intentions, relis les déclencheurs en attente : tout déclencheur ÉCHU (sa condition est remplie, son délai est écoulé) se JOUE dans cette narration, que les joueurs l'aient cherché ou non. \`tour.declencheurs\` est un objet dont chaque clé est l'id NU d'un déclencheur EN ATTENTE (${enAttente.map((id) => `\`${id}\``).join(', ') || "aucune clé : l'objet est vide"}) ; sa valeur est son sort à cet échange : \`statut\` = \`joue\`, \`non-echu\` (\`motif\` = quelle condition manque) ou \`ecarte\` (\`motif\` = ce qui l'a rendu impossible). Un déclencheur JOUÉ ou ÉCARTÉ ne reçoit plus de sort.
- \`tour.narration\` = ce que les joueurs entendent, rien de la fiche privée qu'ils n'ont pas découvert. \`tour.etatPrive\` = ton nouveau résumé privé (où en est le chapitre, ce que chaque PNJ sait et veut, les fils ouverts). \`tour.beat\` = l'id du beat courant de la fiche. \`fin: true\` quand le chapitre est clos selon le livre.`,
    {
      label: `mj:${numero}`, phase: 'Partie', agentType: 'lecteur', model: 'sonnet', effort: 'medium',
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
    })
  agentsMJ += 1
  if (!mj) {
    interrompue = { echange: numero, cause: 'le MJ n’a rien rendu', intentionsNonResolues: intentions }
    log(`Échange ${numero} : le MJ n’a rien rendu — partie INTERROMPUE après ${echanges.length} échange(s) joué(s), ${intentions.length} intention(s) de joueur restée(s) sans résolution.`)
    break
  }
  const declencheursDeLEchange = enAttente.map((id) => ({ id, ...mj.tour.declencheurs[id] }))
  const anomaliesDeDeclencheurs = declencheursDeLEchange.filter((d) => d.statut !== 'joue' && !d.motif.trim()).map((d) => `déclencheur « ${d.id} » : statut « ${d.statut} » sans motif`)
  for (const d of declencheursDeLEchange) {
    if (d.statut === 'joue') etatDe.set(d.id, { etat: 'joue', echange: numero })
    else if (d.statut === 'ecarte') etatDe.set(d.id, { etat: 'ecarte', echange: numero, motif: d.motif })
    else etatDe.set(d.id, { etat: 'attente', dernierStatut: d.statut, motif: d.motif })
  }
  if (anomaliesDeDeclencheurs.length) log(`Échange ${numero} : ${anomaliesDeDeclencheurs.length} anomalie(s) de déclencheur — ${anomaliesDeDeclencheurs.join(' · ')}.`)
  const anomaliesDeTirage = []
  mj.jets.forEach((jet, rang) => {
    if (jet.tirage !== premierTirage + rang) anomaliesDeTirage.push(`jet ${rang + 1} : tirage ${jet.tirage}, attendu ${premierTirage + rang}`)
    if (!jet.commande.includes(`--seed "${SEED}"`) || !jet.commande.includes(`--tirage ${jet.tirage}`)) anomaliesDeTirage.push(`jet ${rang + 1} : commande sans --seed "${SEED}" ou sans --tirage ${jet.tirage}`)
  })
  tirageSuivant = mj.jets.reduce((m, jet) => Math.max(m, jet.tirage + 1), premierTirage + mj.jets.length)
  if (anomaliesDeTirage.length) log(`Échange ${numero} : ${anomaliesDeTirage.length} anomalie(s) de tirage — ${anomaliesDeTirage.join(' · ')}. Tirage suivant : ${tirageSuivant}.`)
  etatPrive = mj.tour.etatPrive
  echanges.push({
    numero, intentions, resolutions: intentions.map((i) => ({ persona: i.persona, pj: i.pj, intention: i.intention, ...mj.resolutions[i.pj] })), jets: mj.jets, anomaliesDeTirage, declencheurs: declencheursDeLEchange, anomaliesDeDeclencheurs,
    narration: mj.tour.narration, beat: mj.tour.beat, etatPrive: mj.tour.etatPrive, fin: mj.fin,
  })
  if (mj.fin) {
    fin = true
    break
  }
  if (numero === MAX_ECHANGES) break

  const recentsPourLesJoueurs = publicsRecents()
  const rendus = await parallel(joueurs.map((j, rang) => () => agent(`Tu JOUES un personnage à une table de jeu de rôle (Warhammer). Tu ne sais du monde que ce que la narration du MJ t'a dit.
Tu n'ouvres AUCUN fichier et tu ne lances AUCUNE commande : tu joues depuis ce message seul, jamais depuis le livre ni le dépôt.

TA PERSONA — ${JEUX_DE_PERSONA[j.persona]}

TA FICHE :
${j.pj.fiche}

TES NOTES PRIVÉES : ${notes[rang] || '(aucune)'}

CE QUE LE MJ A RACONTÉ (derniers échanges publics) :
${recentsPourLesJoueurs}

Rends \`jeu.intention\` : ce que ton personnage fait ou dit MAINTENANT, en une ou deux phrases à la première personne, fidèle à ta persona. Rends \`jeu.notes\` : tes notes privées mises à jour (soupçons, noms, plans), elles te seront rendues au prochain échange.`,
    { label: `joueur:${j.persona}:${numero}`, phase: 'Partie', schema: JOUEUR, agentType: 'joueur', model: 'sonnet', effort: 'low' })))
  agentsJoueurs += joueurs.length
  intentions = []
  rendus.forEach((r, rang) => {
    const j = joueurs[rang]
    if (!r) {
      log(`Échange ${numero} : le joueur ${j.persona} n’a rien rendu — aucune intention de sa part à cet échange.`)
      joueursSansRendu.push(`échange ${numero} : ${j.persona}`)
      return
    }
    notes[rang] = r.jeu.notes
    intentions.push({ persona: j.persona, pj: j.pj.id, intention: r.jeu.intention })
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
  preparation: { pjs: fichesPJ.pjs, groupe: fichesPJ.groupe, ficheMJ, sosie: sosieRendu, anomaliesDeSosie },
  joueurs: joueurs.map((j) => ({ persona: j.persona, pj: j.pj.id, nom: j.pj.nom, sosie: j.sosie })),
  echanges, notesFinales: joueurs.map((j, rang) => ({ persona: j.persona, pj: j.pj.id, notes: notes[rang] })), tiragesConsommes: tirageSuivant, fin, plafondAtteint, interrompue,
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
 *  SIGNAL ou THÉÂTRE ne se rend que si toutes sont vides. */
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
const analyse = await agent(`Tu ANALYSES une table papier simulée de ${LIVRE} ${CHAPITRE}. Relis le chapitre au Source/ : le journal dit ce qui s'est joué, le livre dit ce qui était prévu.
${CADRE}
${CHAPITRE_LU}

JOURNAL COMPLET :
${JSON.stringify(journal, null, 1)}

DÉCLENCHEURS NON JOUÉS OU ÉCARTÉS :
${JSON.stringify([...declencheursNonJoues, ...declencheursEcartes], null, 1)}

Rends :
- intentions : un objet dont chaque clé est le numéro d'un échange qui porte des intentions (${echangesClasses.map((n) => `\`${n}\``).join(', ') || "aucune clé : l'objet est vide"}), et sa valeur un objet dont chaque clé est la persona d'une intention de cet échange (\`echanges[].intentions[].persona\`) : chacune classée par toi, au livre, sans reprendre le classement du MJ : \`prevu\` (réf nue de la ligne qui la prévoit), \`IMPRO\` (le livre ne la prévoit pas et le MJ a dû improviser — \`categorie\` parmi ${CATEGORIES_IMPRO.join(', ')}), \`refuse\` (la fiction l'a refusée), \`hors-livre\` (elle sort du cadre du chapitre). \`ref: ''\` et \`categorie: ''\` quand ils ne s'appliquent pas.
- tempsMorts : chaque suite de BEATS du livre traversés sans décision de joueur (\`beats\` = ids des beats de la fiche du MJ, \`echanges\` = numéros des échanges concernés, constat). Un temps mort se mesure en beats, jamais en nombre d'échanges. ${journal.plafondAtteint ? `La partie s'est arrêtée au plafond de ${MAX_ECHANGES} échanges (\`plafondAtteint\`), chapitre non clos : un beat qu'elle n'a pas atteint n'est pas un temps mort.` : "La partie ne s'est pas arrêtée au plafond d'échanges (`plafondAtteint: false`)."}
- pistesRatees : indices et accroches du livre que la table n'a pas saisis, avec réf.
- declencheurs : un objet dont chaque clé est l'id d'un déclencheur de la liste ci-dessus (${aJuger.map((id) => `\`${id}\``).join(', ') || "aucune clé : l'objet est vide"}) : \`manque: true\` quand la partie jouée remplissait sa condition au livre et que le MJ ne l'a pas joué (ou l'a écarté à tort), \`false\` sinon ; \`constat\` dit pourquoi, \`ref\` = la réf nue qui le prouve.
- fuites : chaque narration du MJ qui révèle un secret de sa fiche (\`preparation.ficheMJ.secrets\`, par son id) sans que les joueurs aient trouvé d'indice (\`preparation.ficheMJ.indices\`) qui y mène : \`echange\` = son numéro, \`secret\` = l'id du secret, \`constat\` = ce que la narration révèle et pourquoi aucun indice trouvé n'y mène. Un test réussi sur une piste qu'aucun indice de la fiche ne couvre N'EST PAS un indice trouvé : la narration qui en tire un secret reste une fuite. Une fuite fausse la partie : les joueurs jouent ensuite sur une information volée.
- besoins : ce que le jeu devra offrir pour que ces intentions aboutissent, chacun avec les personas qui ont eu l'intention et la réf du livre qui la prévoit (\`''\` s'il ne la prévoit pas). Tu ne tries pas : le script retient.
- synthese.markdown : une synthèse courte.
Un jet du journal se vérifie en rejouant sa commande : l'outil est déterministe.`,
  {
    label: 'analyse', phase: 'Analyse', agentType: 'juge', model: 'opus', effort: 'high',
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
  })

const agents = { preparation: 2, mj: agentsMJ, joueurs: agentsJoueurs, analyse: 1, total: 3 + agentsMJ + agentsJoueurs }
if (!analyse) {
  log(`Analyse : le juge n’a rien rendu — le journal est rendu sans classement ; ${bilanDesDeclencheurs}.`)
  return { ...conclusion(trousDuRun({ analyseSansRendu: ['analyse'] }), null), journal, analyse: null, declencheursNonJoues, declencheursEcartes, agents, date: DATE }
}

/** Le classement du juge, remis à la forme du journal : une entrée par intention, une par déclencheur jugé. */
const intentionsClassees = echanges.flatMap((e) => e.intentions.map((i) => ({ echange: e.numero, persona: i.persona, intention: i.intention, ...analyse.intentions[e.numero][i.persona] })))
const declencheursJuges = aJuger.map((id) => ({ id, ...analyse.declencheurs[id] }))
const adverses = intentionsClassees.filter((i) => PERSONAS_ADVERSES.includes(i.persona) && (i.classe === 'refuse' || i.classe === 'hors-livre'))
const besoins = analyse.besoins.map((b) => ({ ...b, retenu: b.personas.length >= 2 || b.ref !== '' }))
const fuitesSourcees = analyse.fuites.map((f) => ({ ...f, ref: refDuSecret.get(f.secret) }))
const fuites = fuitesSourcees.map((f) => `échange ${f.echange} : secret « ${f.secret} » — ${f.constat} (${f.ref.join(' ; ')})`)
const manquesDuMJ = declencheursJuges.filter((d) => d.manque)
const { verdict, trous } = conclusion(trousDuRun({ fuites }), adverses.length ? 'SIGNAL' : 'THÉÂTRE')
log(`Analyse : ${verdict} — ${intentionsClassees.length} intention(s) classée(s), dont ${adverses.length} refusée(s) ou hors livre jouée(s) par les personas adverses (${PERSONAS_ADVERSES.join(', ')}) ; ${analyse.tempsMorts.length} temps mort(s) ; ${fuites.length} fuite(s) de secret ; ${bilanDesDeclencheurs}, dont ${manquesDuMJ.length} MANQUÉ(S) par le MJ ; besoins ${besoins.filter((b) => b.retenu).length} retenu(s) sur ${besoins.length} ; ${agents.total} agents joués (2 de préparation, ${agentsMJ} MJ, ${agentsJoueurs} joueurs, 1 juge).`)
const { synthese, ...classement } = analyse
return { verdict, trous, journal, analyse: { ...classement, intentions: intentionsClassees, declencheurs: declencheursJuges, fuites: fuitesSourcees, besoins, synthese_markdown: synthese.markdown }, declencheursNonJoues, declencheursEcartes, agents, date: DATE }
