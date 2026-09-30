export const meta = {
  name: 'dossier-de-chapitre',
  description: "Dossier d'un chapitre de campagne : lentilles de lecture aux travaux DIFFÉRENTS, en parallèle, chacune au Source/ (impératifs, beats, indices, secrets et déclencheurs ; PNJ, lieux, textes ; mécanique et états ; matière des compagnons si fournis), puis confrontation de chaque besoin au code d'`origin/main` (existe / partiel / manque, preuve fichier:ligne ou sonde d'absence), enfin un juge de complétude qui relit le chapitre et réfute, dont le script APPLIQUE les corrections (oublis, réfs fausses, contenus faux, classements faux, chacune visée par champ et id) : le dossier rendu est le dossier CORRIGÉ, et `corrections` la trace de ce qui a été appliqué. Tout besoin NÉ d'un oubli, ou dont la famille, le texte ou la réf a changé sans classement de ce besoin par le juge, est confronté APRÈS application ; un besoin qui reste `non-confronte` (lot sans rendu, que `lotsSansRendu` nomme, ou verdict absent) fait tomber le verdict. args : { livre, chapitre, fichiers, compagnons?, worktree, date }. Le verdict se DÉRIVE de `trous`, une liste par espèce : DOSSIER quand toutes sont vides, sinon la première espèce trouée le nomme — LECTURE INVALIDE (`anomaliesDeLecture` : un id de beat ou de déclencheur vide ou en double à la lecture), LECTURE INCOMPLÈTE (`lentillesSansRendu`), DOSSIER SANS COMPLÉTUDE (`completudeSansRendu`), CORRECTIONS INAPPLICABLES (`anomaliesDeCorrection` : une correction vise une cible inconnue, ambiguë, déjà prise ou déjà corrigée, un attribut hors de son champ ou une valeur hors de sa forme), CONFRONTATION INCOMPLÈTE (`lotsSansRendu`, `besoinsNonConfrontes`). ARRÊT (argument manquant) rend les mêmes clés, vides. Seul DOSSIER arme une table.",
  whenToUse: "Avant de découper, maquetter ou produire un chapitre (méthode de #665, étape 3) : établir ce que le LIVRE exige et ce que le dépôt porte déjà. Son rendu au verdict DOSSIER est l'argument `dossier` d'une table simulée du même chapitre, qui en tire la fiche du MJ ; il se lit avant toute décision de média.",
  phases: [
    { title: 'Lecture', detail: 'lentilles indépendantes, chacune relit le chapitre au Source/' },
    { title: 'Confrontation', detail: "chaque besoin confronté au code d'origin/main, par lots ; après application des corrections, les besoins nés ou changés le sont à nouveau" },
    { title: 'Complétude', detail: 'un juge relit le chapitre et réfute oublis, réfs fausses, contenus faux, classements faux ; le script les applique au dossier' },
  ],
}

// args parfois STRINGIFIÉ par le harnais → parse défensif.
const input = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})
const enListe = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String)
const LIVRE = String(input.livre || '')
const CHAPITRE = String(input.chapitre || '')
const FICHIERS = enListe(input.fichiers)
const COMPAGNONS = enListe(input.compagnons)
const WORKTREE = String(input.worktree || '')
const DATE = String(input.date || '')

/** Médias candidats d'un beat — le dossier les LISTE, il ne tranche pas. */
const MEDIAS = ['scene-jouee', 'dialogue', 'interlude', 'resume', 'coupe']
/** Types d'un point laissé au MJ — ids STABLES. Liste PROPRE aux points au MJ : un passage du livre n'est
 *  jamais `hors-livre`, catégorie de l'IMPRO de `table-simulee.js` seule. */
const TYPES_POINT_AU_MJ = ['veracite-rumeur', 'consequence-ouverte', 'rythme-deblocage', 'variante-pnj', 'encart-optionnel']
/** Statut d'un beat TEL QUE LE LIVRE LE DIT ; `non-qualifie` quand il ne le dit pas. */
const STATUTS_DE_BEAT = ['obligatoire', 'optionnel', 'non-qualifie']
/** Nature d'un texte que le jeu devra montrer. */
const NATURES_DE_TEXTE = ['document-verbatim', 'motivation-a-authorer', 'narration-a-reformuler']
/** Sens et portée d'un état du chapitre. */
const SENS_D_ETAT = ['produit', 'lu']
const PORTEES_D_ETAT = ['chapitre', 'campagne']
/** Verdict de confrontation d'un besoin au code. */
const STATUTS_DE_CONFRONTATION = ['existe', 'partiel', 'manque']
/** Besoins confrontés par agent de confrontation. */
const BESOINS_PAR_LOT = 25
/** La forme UNIQUE du retour, vide : un ARRÊT la porte telle quelle, le nominal la remplit. Un ARRÊT n'a
 *  mesuré aucun trou : `trous` y vaut `null`. */
const DOSSIER_VIDE = {
  imperatifs: [], beats: [], pointsAuMJ: [], indices: [], secrets: [], declencheurs: [], pnj: [],
  besoins: [], etats: [], dureeEtDifficulte: [], matiereCompagnons: [],
  trous: null, commitsConfrontes: [], corrections: [], synthese_markdown: '',
}

const manquesDArgs = [
  LIVRE ? null : 'args.livre — sigle du livre (ex. EDO)',
  CHAPITRE ? null : 'args.chapitre — numéro du chapitre (ex. 01)',
  FICHIERS.length ? null : 'args.fichiers — chemins Source/ du chapitre',
  WORKTREE ? null : 'args.worktree — chemin ABSOLU de l’arbre dont `origin/main` est confronté',
  DATE ? null : 'args.date — AAAA-MM-JJ (aucune horloge dans un script : la reprise doit rendre le même run)',
].filter(Boolean)
if (manquesDArgs.length) {
  log(`ARRÊT : ${manquesDArgs.length} argument(s) manquant(s) — ${manquesDArgs.join(' · ')}`)
  return { verdict: 'ARRÊT', manques: manquesDArgs, livre: LIVRE, chapitre: CHAPITRE, ...DOSSIER_VIDE, agents: { lecture: 0, confrontation: 0, completude: 0, total: 0 }, date: DATE }
}

const CADRE = `Arbre (chemin ABSOLU, à utiliser tel quel) : ${WORKTREE}
Date du jour : ${DATE}
LECTURE SEULE : tu n'écris AUCUN fichier, ni sous l'arbre ni ailleurs. Aucun git écrivain, aucune suite de tests, aucune gate.
Toute commande passe par l'outil \`ctx_shell\`, son paramètre \`cwd\` = l'arbre ci-dessus : UNE commande simple par appel, sans changement de dossier, sans enchaînement ni pipe, sans redirection, sans variable d'environnement en tête ; UN SEUL appel \`ctx_shell\` par message, jamais plusieurs en parallèle. Une sonde est une commande (\`git grep …\`, \`npx tsx -e "…"\`), jamais un fichier écrit ; tout processus lancé est TUÉ avant ton rendu.
Toute référence au livre est NUE : \`${LIVRE} ${CHAPITRE} l.<ligne>\` (ligne du fichier Source/ ; pour un compagnon, son sigle et son chapitre). Un numéro de ligne se prend sur une lecture BRUTE numérotée (\`grep -n\`, \`sed -n 'X,Yp'\`, \`ctx_read\` en mode \`raw\`), jamais sur une vue résumée ou compressée ; toute réf se vérifie en relisant la ligne citée avant d'être rendue. Une absence se prouve par une sonde et son périmètre, jamais par « je n'ai pas trouvé ».
Ton rendu = l'objet du schéma, rien d'autre.`

const CHAPITRE_LU = `Chapitre : ${LIVRE} ${CHAPITRE} — fichiers Source/ (relatifs à l'arbre) : ${FICHIERS.join(' · ')}
Lis-les INTÉGRALEMENT, du début à la fin : un dossier se fonde sur le livre, jamais sur un résumé.`

const REF = { type: 'object', additionalProperties: false, properties: { texte: { type: 'string' }, ref: { type: 'string' } }, required: ['texte', 'ref'] }

/** La forme d'UNE entrée de chaque champ-liste : source unique, partagée par le schéma de sa lentille
 *  et par les oublis du juge de complétude (`CHAMPS`). */
const ENTREE_BEAT = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' },
    titre: { type: 'string' },
    ref: { type: 'string' },
    statut: { enum: STATUTS_DE_BEAT },
    preuveDuStatut: { type: 'string' },
    mediasCandidats: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: MEDIAS } },
  },
  required: ['id', 'titre', 'ref', 'statut', 'preuveDuStatut', 'mediasCandidats'],
}
const ENTREE_POINT_AU_MJ = {
  type: 'object', additionalProperties: false,
  properties: { texte: { type: 'string' }, ref: { type: 'string' }, type: { enum: TYPES_POINT_AU_MJ } },
  required: ['texte', 'ref', 'type'],
}
const ENTREE_DECLENCHEUR = {
  type: 'object', additionalProperties: false,
  properties: { id: { type: 'string' }, evenement: { type: 'string' }, condition: { type: 'string' }, ref: { type: 'string' } },
  required: ['id', 'evenement', 'condition', 'ref'],
}
const ENTREE_PNJ = {
  type: 'object', additionalProperties: false,
  properties: { nom: { type: 'string' }, role: { type: 'string' }, motivation: { type: 'string' }, ref: { type: 'string' } },
  required: ['nom', 'role', 'motivation', 'ref'],
}
const ENTREE_TEXTE = {
  type: 'object', additionalProperties: false,
  properties: { texte: { type: 'string' }, nature: { enum: NATURES_DE_TEXTE }, ref: { type: 'string' } },
  required: ['texte', 'nature', 'ref'],
}
const ENTREE_TEST = {
  type: 'object', additionalProperties: false,
  properties: { texte: { type: 'string' }, competence: { type: 'string' }, difficulte: { type: 'string' }, ref: { type: 'string' } },
  required: ['texte', 'competence', 'difficulte', 'ref'],
}
const ENTREE_ETAT = {
  type: 'object', additionalProperties: false,
  properties: { texte: { type: 'string' }, sens: { enum: SENS_D_ETAT }, portee: { enum: PORTEES_D_ETAT }, ref: { type: 'string' } },
  required: ['texte', 'sens', 'portee', 'ref'],
}
const ENTREE_MATIERE = {
  type: 'object', additionalProperties: false,
  properties: { texte: { type: 'string' }, categorie: { type: 'string' }, pourCeChapitre: { type: 'string' }, ref: { type: 'string' } },
  required: ['texte', 'categorie', 'pourCeChapitre', 'ref'],
}

const IMPERATIFS_ET_BEATS = {
  type: 'object', additionalProperties: false,
  properties: {
    imperatifs: { type: 'array', items: REF },
    beats: { type: 'array', minItems: 1, items: ENTREE_BEAT },
    pointsAuMJ: { type: 'array', items: ENTREE_POINT_AU_MJ },
    indices: { type: 'array', items: REF },
    secrets: { type: 'array', items: REF },
    declencheurs: { type: 'array', items: ENTREE_DECLENCHEUR },
  },
  required: ['imperatifs', 'beats', 'pointsAuMJ', 'indices', 'secrets', 'declencheurs'],
}

const PNJ_LIEUX_TEXTES = {
  type: 'object', additionalProperties: false,
  properties: {
    pnj: { type: 'array', items: ENTREE_PNJ },
    lieux: { type: 'array', items: REF },
    textes: { type: 'array', items: ENTREE_TEXTE },
  },
  required: ['pnj', 'lieux', 'textes'],
}

const MECANIQUE = {
  type: 'object', additionalProperties: false,
  properties: {
    tests: { type: 'array', items: ENTREE_TEST },
    rencontres: { type: 'array', items: REF },
    dureeEtDifficulte: { type: 'array', items: REF },
    recompenses: { type: 'array', items: REF },
    etats: { type: 'array', items: ENTREE_ETAT },
  },
  required: ['tests', 'rencontres', 'dureeEtDifficulte', 'recompenses', 'etats'],
}

const MATIERE_COMPAGNONS = {
  type: 'object', additionalProperties: false,
  properties: {
    matiere: { type: 'array', items: ENTREE_MATIERE },
  },
  required: ['matiere'],
}

const CONFRONTATION = {
  type: 'object', additionalProperties: false,
  properties: {
    origine: {
      type: 'object', additionalProperties: false,
      properties: { commit: { type: 'string' } },
      required: ['commit'],
    },
    verdicts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { id: { type: 'string' }, statut: { enum: STATUTS_DE_CONFRONTATION }, preuve: { type: 'string' } },
        required: ['id', 'statut', 'preuve'],
      },
    },
  },
  required: ['origine', 'verdicts'],
}

/** Les champs-listes que rendent les lentilles, chacun avec la forme d'une entrée (`items`) et sa clé
 *  dans le rendu de sa lentille (`cle`).
 *  Chaque entrée porte un `id` : le sien quand la lentille le rend (`prefixe: ''` — beats, déclencheurs),
 *  sinon `<prefixe><rang>` posé par le script. Le juge de complétude corrige par (champ, id). */
const CHAMPS = [
  { champ: 'imperatifs', lentille: 'imperatifs-et-beats', items: REF, cle: 'imperatifs', prefixe: 'imp' },
  { champ: 'beats', lentille: 'imperatifs-et-beats', items: ENTREE_BEAT, cle: 'beats', prefixe: '' },
  { champ: 'pointsAuMJ', lentille: 'imperatifs-et-beats', items: ENTREE_POINT_AU_MJ, cle: 'pointsAuMJ', prefixe: 'mj' },
  { champ: 'indices', lentille: 'imperatifs-et-beats', items: REF, cle: 'indices', prefixe: 'ind' },
  { champ: 'secrets', lentille: 'imperatifs-et-beats', items: REF, cle: 'secrets', prefixe: 'sec' },
  { champ: 'declencheurs', lentille: 'imperatifs-et-beats', items: ENTREE_DECLENCHEUR, cle: 'declencheurs', prefixe: '' },
  { champ: 'pnj', lentille: 'pnj-lieux-textes', items: ENTREE_PNJ, cle: 'pnj', prefixe: 'pnj' },
  { champ: 'lieux', lentille: 'pnj-lieux-textes', items: REF, cle: 'lieux', prefixe: 'lieu' },
  { champ: 'textes', lentille: 'pnj-lieux-textes', items: ENTREE_TEXTE, cle: 'textes', prefixe: 'txt' },
  { champ: 'tests', lentille: 'mecanique', items: ENTREE_TEST, cle: 'tests', prefixe: 'test' },
  { champ: 'rencontres', lentille: 'mecanique', items: REF, cle: 'rencontres', prefixe: 'renc' },
  { champ: 'dureeEtDifficulte', lentille: 'mecanique', items: REF, cle: 'dureeEtDifficulte', prefixe: 'dur' },
  { champ: 'recompenses', lentille: 'mecanique', items: REF, cle: 'recompenses', prefixe: 'rec' },
  { champ: 'etats', lentille: 'mecanique', items: ENTREE_ETAT, cle: 'etats', prefixe: 'etat' },
  { champ: 'matiereCompagnons', lentille: 'matiere-compagnons', items: ENTREE_MATIERE, cle: 'matiere', prefixe: 'comp' },
]
const NOMS_DE_CHAMP = CHAMPS.map((c) => c.champ)
/** Ce qu'un classement faux corrige, par champ : les attributs qui CLASSENT une entrée, à leur forme. */
const CLASSEMENTS = {
  beats: { statut: { enum: STATUTS_DE_BEAT }, preuveDuStatut: { type: 'string' } },
  pointsAuMJ: { type: { enum: TYPES_POINT_AU_MJ } },
  textes: { nature: { enum: NATURES_DE_TEXTE } },
  etats: { sens: { enum: SENS_D_ETAT }, portee: { enum: PORTEES_D_ETAT } },
  besoins: { statut: { enum: STATUTS_DE_CONFRONTATION }, preuve: { type: 'string' } },
}
/** Ce qu'un contenu faux corrige, par champ : TOUS les attributs de son entrée, chacun à sa forme (`ENTREE_*`),
 *  hors `id`, hors `ref` (réf fausse) et hors les attributs d'un classement. */
const ATTRIBUTS_CORRIGEABLES = Object.fromEntries(CHAMPS.map((c) => [c.champ, Object.fromEntries(Object.entries(c.items.properties)
  .filter(([nom]) => nom !== 'id' && nom !== 'ref' && !Object.hasOwn(CLASSEMENTS[c.champ] ?? {}, nom)))]))
/** Les formes distinctes des attributs corrigeables : celles que peut prendre la valeur d'un contenu faux. */
const FORMES_CORRIGEABLES = [...new Map(Object.values(ATTRIBUTS_CORRIGEABLES).flatMap((attributs) => Object.values(attributs))
  .map((forme) => [JSON.stringify(forme), forme])).values()]
/** Les mots-clés de forme que `conforme` lit : une forme qui en porte un autre ne valide rien. */
const MOTS_CLES_LUS = new Set(['type', 'enum', 'items', 'minItems', 'uniqueItems'])
/** Une valeur conforme à la forme de son attribut. Une correction n'efface jamais un attribut : un texte
 *  vide ou blanc n'est pas conforme. */
const conforme = (valeur, forme) => {
  if (Object.keys(forme).some((cle) => !MOTS_CLES_LUS.has(cle))) return false
  if (forme.enum) return forme.enum.includes(valeur)
  if (forme.type === 'array') {
    return Array.isArray(valeur) && valeur.length >= (forme.minItems ?? 0) && valeur.every((v) => conforme(v, forme.items))
      && (!forme.uniqueItems || new Set(valeur.map((v) => JSON.stringify(v))).size === valeur.length)
  }
  if (forme.type === 'string') return typeof valeur === 'string' && valeur.trim() !== ''
  if (forme.type === 'number') return typeof valeur === 'number' && Number.isFinite(valeur)
  if (forme.type === 'boolean') return typeof valeur === 'boolean'
  return false
}

const COMPLETUDE = {
  type: 'object', additionalProperties: false,
  properties: {
    oublis: {
      type: 'object', additionalProperties: false,
      properties: Object.fromEntries(CHAMPS.map((c) => [c.champ, { type: 'array', items: c.items }])),
      required: NOMS_DE_CHAMP,
    },
    refsFausses: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { champ: { enum: NOMS_DE_CHAMP }, id: { type: 'string' }, ref: { type: 'string' }, motif: { type: 'string' } },
        required: ['champ', 'id', 'ref', 'motif'],
      },
    },
    contenusFaux: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          champ: { enum: NOMS_DE_CHAMP },
          id: { type: 'string' },
          attribut: { enum: [...new Set(Object.values(ATTRIBUTS_CORRIGEABLES).flatMap((attributs) => Object.keys(attributs)))] },
          valeur: { anyOf: FORMES_CORRIGEABLES },
          ref: { type: 'string' },
        },
        required: ['champ', 'id', 'attribut', 'valeur', 'ref'],
      },
    },
    classementsFaux: {
      type: 'object', additionalProperties: false,
      properties: Object.fromEntries(Object.entries(CLASSEMENTS).map(([champ, attributs]) => [champ, {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { id: { type: 'string' }, ...attributs, ref: { type: 'string' } },
          required: ['id', ...Object.keys(attributs), 'ref'],
        },
      }])),
      required: Object.keys(CLASSEMENTS),
    },
    synthese: {
      type: 'object', additionalProperties: false,
      properties: { markdown: { type: 'string' } },
      required: ['markdown'],
    },
  },
  required: ['oublis', 'refsFausses', 'contenusFaux', 'classementsFaux', 'synthese'],
}

// ── Lecture ──────────────────────────────────────────────────────────────────────────────────
const LENTILLE_IMPERATIFS_ET_BEATS = {
  label: 'imperatifs-et-beats',
  consigne: `LENTILLE — IMPÉRATIFS, BEATS, INDICES, SECRETS ET DÉCLENCHEURS.
- imperatifs : ce que le livre rend indispensable (éléments clés, indices à trouver, « doivent absolument », contraintes posées pour la suite de la campagne), chacun avec sa réf nue.
- beats : la suite des scènes du chapitre dans l'ordre du livre, id stable court (b1, b2…). \`statut\` TEL QUE LE LIVRE LE DIT — \`obligatoire\` ou \`optionnel\` —, et \`preuveDuStatut\` cite le passage qui le dit ; un beat que le livre ne qualifie pas est \`non-qualifie\`, et sa preuve le dit. \`mediasCandidats\` : TOUS les médias plausibles parmi ${MEDIAS.join(', ')} — tu listes, tu ne tranches pas.
- pointsAuMJ : chaque passage que le livre laisse à la décision du MJ (« à vous de décider », « si vous le désirez », alternatives, encarts), typé parmi ${TYPES_POINT_AU_MJ.join(', ')}.
- indices et secrets : ce que le MJ sait et que les joueurs peuvent découvrir, chacun avec sa réf nue.
- declencheurs : chaque événement que le livre fait arriver à l'INITIATIVE d'un PNJ ou du monde, sans action des joueurs (« s'ils l'ignorent, il s'approche de leur table au bout d'une demi-heure »), avec un id stable court et UNIQUE (d1, d2…), l'événement, sa \`condition\` ou son délai tel que le livre l'écrit, et sa réf nue.`,
}
const LENTILLE_PNJ_LIEUX_TEXTES = {
  label: 'pnj-lieux-textes',
  consigne: `LENTILLE — PNJ, LIEUX, TEXTES.
- pnj : chaque PNJ nommé ou décrit, son rôle dans le chapitre, sa motivation telle que le livre la donne, sa réf.
- lieux : chaque lieu où une scène peut se jouer, avec réf.
- textes : chaque texte que le jeu devra montrer. \`document-verbatim\` = le livre en donne le texte (lettre, affiche, aide de jeu) : il se recopie tel quel. \`motivation-a-authorer\` = le livre ne donne qu'une intention ou une motivation de PNJ : la réplique s'authore. \`narration-a-reformuler\` = une description ou une narration destinée au MJ, que le jeu reformule en texte lu à l'écran (fiche \`user-doctrine-regle-5-campagne-repliques-et-narration-maison\`).`,
}
const LENTILLE_MECANIQUE = {
  label: 'mecanique',
  consigne: `LENTILLE — MÉCANIQUE.
- tests : chaque Test que le livre demande ou propose, la compétence ou caractéristique, la difficulté TELLE QUE LE LIVRE L'ÉCRIT, sa réf.
- rencontres : chaque combat ou opposition, adversaires et effectifs, réf.
- dureeEtDifficulte : ce que le livre dit de la durée et de la difficulté visées (séances, jours de jeu, dangerosité), réf.
- recompenses : points d'expérience, argent, objets, relations gagnées, réf.
- etats : chaque état que le chapitre PRODUIT (décision, fin, drapeau que la suite lit) ou LIT (hérité d'un chapitre ou d'un tome antérieur), sa portée (chapitre ou campagne), réf.`,
}
const LENTILLE_MATIERE_COMPAGNONS = {
  label: 'matiere-compagnons',
  consigne: `LENTILLE — MATIÈRE DES COMPAGNONS. Lis INTÉGRALEMENT les chapitres de compagnon suivants : ${COMPAGNONS.join(' · ')}. Rends la matière que ce chapitre-ci peut y puiser (péages, PNJ et scénarios annexes, lieux, règles, rencontres…), chacune avec sa \`categorie\` (un mot : peage, pnj, scenario-annexe, lieu, regle, rencontre…), \`pourCeChapitre\` = où elle s'insère dans le chapitre (beat, lieu ou réf du chapitre), et sa réf nue au compagnon.`,
}
/** Le prompt d'une lentille : sa consigne, puis le cadre commun. */
const promptDeLecture = (l) => `${l.consigne}\n\n${CADRE}\n${CHAPITRE_LU}\n\nTu lis SEUL : les autres lentilles ne te sont pas montrées. Chaque entrée porte sa réf nue.`
/** Les lentilles qui JOUENT : un site `agent(` par lentille, dont le schéma se lit à la forme et dont le
 *  rendu se keye au label de SA lentille, jamais au rang. Celle des compagnons ne joue que s'il y en a. */
const LENTILLES = [LENTILLE_IMPERATIFS_ET_BEATS, LENTILLE_PNJ_LIEUX_TEXTES, LENTILLE_MECANIQUE]
const lecteurs = [
  () => agent(promptDeLecture(LENTILLE_IMPERATIFS_ET_BEATS),
    { label: LENTILLE_IMPERATIFS_ET_BEATS.label, phase: 'Lecture', schema: IMPERATIFS_ET_BEATS, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })
    .then((r) => [LENTILLE_IMPERATIFS_ET_BEATS.label, r]),
  () => agent(promptDeLecture(LENTILLE_PNJ_LIEUX_TEXTES),
    { label: LENTILLE_PNJ_LIEUX_TEXTES.label, phase: 'Lecture', schema: PNJ_LIEUX_TEXTES, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })
    .then((r) => [LENTILLE_PNJ_LIEUX_TEXTES.label, r]),
  () => agent(promptDeLecture(LENTILLE_MECANIQUE),
    { label: LENTILLE_MECANIQUE.label, phase: 'Lecture', schema: MECANIQUE, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })
    .then((r) => [LENTILLE_MECANIQUE.label, r]),
]
if (COMPAGNONS.length) {
  LENTILLES.push(LENTILLE_MATIERE_COMPAGNONS)
  lecteurs.push(() => agent(promptDeLecture(LENTILLE_MATIERE_COMPAGNONS),
    { label: LENTILLE_MATIERE_COMPAGNONS.label, phase: 'Lecture', schema: MATIERE_COMPAGNONS, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })
    .then((r) => [LENTILLE_MATIERE_COMPAGNONS.label, r]))
}
log(`Lecture : ${LENTILLES.length} lentilles (${LENTILLES.map((l) => l.label).join(', ')})${COMPAGNONS.length ? '' : ' — aucun compagnon fourni, la lentille des compagnons ne joue pas'}.`)

const lectures = await parallel(lecteurs)
const parLentille = Object.fromEntries(lectures.filter(Boolean))
const mortes = LENTILLES.filter((l) => !parLentille[l.label]).map((l) => l.label)
if (mortes.length) log(`Lecture : ${mortes.length} lentille(s) sans rendu — ${mortes.join(', ')} ; leurs besoins MANQUENT au dossier et le juge de complétude le sait.`)

/** Les entrées de chaque champ, chacune sous son id — une lentille morte laisse ses champs vides. */
const entrees = Object.fromEntries(CHAMPS.map((c) => [c.champ, ((parLentille[c.lentille] || {})[c.cle] || [])
  .map((e, rang) => (c.prefixe ? { id: `${c.prefixe}${rang + 1}`, ...e } : { ...e }))]))
/** Les ids que la LENTILLE pose (`prefixe: ''`) : toute correction s'y keye, un id vide ou en double ne
 *  désigne plus une entrée. */
const anomaliesDeLecture = CHAMPS.filter((c) => !c.prefixe).flatMap((c) => {
  const ids = entrees[c.champ].map((e) => String(e.id ?? ''))
  const vides = ids.filter((id) => !id.trim()).length
  return [
    ...(vides ? [`${c.champ} : ${vides} entrée(s) sans id`] : []),
    ...[...new Set(ids.filter((id, rang) => id.trim() && ids.indexOf(id) !== rang))].map((id) => `${c.champ} : id « ${id} » en double`),
  ]
})
if (anomaliesDeLecture.length) log(`Lecture : ${anomaliesDeLecture.length} anomalie(s) d’id — ${anomaliesDeLecture.join(' · ')} ; le dossier ne peut pas armer de table.`)

/** Ce que le jeu devra PORTER, par champ : la famille et le texte d'un besoin se DÉRIVENT de son entrée,
 *  sa réf est celle de l'entrée — une correction de l'entrée corrige son besoin. */
const BESOIN_DE = [
  ['pnj', (x) => ({ famille: 'pnj', texte: `${x.nom} — ${x.role}` })],
  ['lieux', (x) => ({ famille: 'lieu', texte: x.texte })],
  ['textes', (x) => ({ famille: `texte:${x.nature}`, texte: x.texte })],
  ['tests', (x) => ({ famille: 'test', texte: `${x.texte} (${x.competence}, ${x.difficulte})` })],
  ['rencontres', (x) => ({ famille: 'rencontre', texte: x.texte })],
  ['recompenses', (x) => ({ famille: 'recompense', texte: x.texte })],
  ['etats', (x) => ({ famille: `etat:${x.sens}:${x.portee}`, texte: x.texte })],
  ['pointsAuMJ', (x) => ({ famille: `point-au-mj:${x.type}`, texte: x.texte })],
  ['declencheurs', (x) => ({ famille: 'declencheur', texte: `${x.evenement} — condition : ${x.condition}` })],
  ['matiereCompagnons', (x) => ({ famille: `compagnon:${x.categorie}`, texte: x.texte })],
]
/** L'id `B<n>` d'un besoin reste celui de son entrée, d'une dérivation à l'autre. */
const idDuBesoin = new Map()
const besoinsDesEntrees = () => BESOIN_DE.flatMap(([champ, derive]) => entrees[champ].map((x) => {
  if (!idDuBesoin.has(x)) idDuBesoin.set(x, `B${idDuBesoin.size + 1}`)
  return { id: idDuBesoin.get(x), origine: `${champ}:${x.id}`, ...derive(x), ref: x.ref }
}))
const besoins = besoinsDesEntrees()
/** Des besoins en lots de `BESOINS_PAR_LOT` au plus : un agent de confrontation par lot. */
const enLots = (liste) => {
  const lotsDeLaListe = []
  for (let i = 0; i < liste.length; i += BESOINS_PAR_LOT) lotsDeLaListe.push(liste.slice(i, i + BESOINS_PAR_LOT))
  return lotsDeLaListe
}
const lots = enLots(besoins)
log(`Confrontation : ${besoins.length} besoin(s) en ${lots.length} lot(s) de ${BESOINS_PAR_LOT} au plus.`)

// ── Confrontation ────────────────────────────────────────────────────────────────────────────
/** Le prompt d'un lot de confrontation ; `quel` le situe (« lot 2/3 », « après corrections, lot 1/1 »). Le lot
 *  ferme le prompt. */
const promptDeConfrontation = (lot, quel) => `Tu CONFRONTES des besoins d'un chapitre de campagne au code du dépôt, tel qu'il est sur \`origin/main\` — jamais l'arbre de travail.
${CADRE}
Lis le code par \`git grep -n <motif> origin/main -- <chemins>\` et \`git show origin/main:<fichier>\`, lancés dans l'arbre ; rends dans \`origine.commit\` le hash de \`git rev-parse origin/main\`.
Où chercher : les données (src/data, dont pregens.json, creatures.json, careers.json), les paquets de campagne (src/scenes), le moteur (src/engine : docs/index-moteur.md et docs/vocabulaire-mecanique.md indexent ses coutures), les états de campagne et le schéma de Scène (src/state).
Pour CHAQUE besoin, un verdict apparié par son \`id\` : \`existe\` (le dépôt le porte : preuve \`origin/main:fichier:ligne\`), \`partiel\` (preuve de ce qui existe + ce qui manque), \`manque\` (preuve = la sonde d'absence : commande exacte, motifs cherchés, chemins couverts).

BESOINS (${quel}) :
${JSON.stringify(lot, null, 1)}`
/** Les verdicts qu'un lot rend pour SES besoins : un id hors du lot ne classe rien. */
const verdictsDuLot = (lot, rendu) => {
  const ids = new Set(lot.map((b) => b.id))
  return rendu ? rendu.verdicts.filter((v) => ids.has(v.id)).map((v) => [v.id, { statut: v.statut, preuve: v.preuve }]) : []
}
const confrontations = await parallel(lots.map((lot, rang) => () => agent(promptDeConfrontation(lot, `lot ${rang + 1}/${lots.length}`),
  { label: `confrontation:${rang + 1}`, phase: 'Confrontation', schema: CONFRONTATION, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })))
/** Le verdict de confrontation de chaque besoin, par id — un classement faux du juge le remplace. */
const verdictsParId = new Map(lots.flatMap((lot, rang) => verdictsDuLot(lot, confrontations[rang])))
const besoinsConfrontes = () => besoinsDesEntrees().map((b) => ({ ...b, ...(verdictsParId.get(b.id) ?? { statut: 'non-confronte', preuve: '' }) }))
const nonConfrontesALaLecture = besoinsConfrontes().filter((b) => b.statut === 'non-confronte')
if (nonConfrontesALaLecture.length) log(`Confrontation : ${nonConfrontesALaLecture.length} besoin(s) NON CONFRONTÉ(S) (lot mort ou verdict absent) — ${nonConfrontesALaLecture.map((b) => b.id).join(', ')}.`)

/** Le dossier tel que le portent ses entrées : lieux, textes, tests, rencontres et récompenses n'y vivent
 *  que dans leurs besoins. */
const dossierCourant = () => ({
  imperatifs: entrees.imperatifs,
  beats: entrees.beats,
  pointsAuMJ: entrees.pointsAuMJ,
  indices: entrees.indices,
  secrets: entrees.secrets,
  declencheurs: entrees.declencheurs,
  pnj: entrees.pnj,
  besoins: besoinsConfrontes(),
  etats: entrees.etats,
  matiereCompagnons: entrees.matiereCompagnons,
  dureeEtDifficulte: entrees.dureeEtDifficulte,
})

// ── Complétude ───────────────────────────────────────────────────────────────────────────────
const completude = await agent(`Tu JUGES la complétude d'un dossier de chapitre. Relis le chapitre au Source/ par toi-même : le dossier ci-dessous est ce que tu RÉFUTES, jamais une source.
${CADRE}
${CHAPITRE_LU}
${COMPAGNONS.length ? `Compagnons puisés : ${COMPAGNONS.join(' · ')}` : 'Aucun compagnon fourni.'}
${mortes.length ? `Lentilles SANS rendu : ${mortes.join(', ')} — leur part du dossier est vide, relève ce qu'elle aurait dû porter.` : ''}

DOSSIER (chaque entrée porte son \`id\` ; un besoin porte le sien, \`B<n>\`, et \`origine\` = \`<champ>:<id>\` de l'entrée dont il dérive — lieux, textes, tests, rencontres et récompenses ne vivent que dans leurs besoins) :
${JSON.stringify(dossierCourant(), null, 1)}

Tes corrections, le script les APPLIQUE au dossier — chacune vise un champ et un id, jamais un texte :
- \`oublis.<champ>\` : chaque entrée que le livre porte et que le dossier omet (impératif, beat, point au MJ, indice, secret, déclencheur, PNJ, lieu, texte, test, rencontre, durée ou difficulté, récompense, état, matière de compagnon), COMPLÈTE, à la forme du champ. Un beat ou un déclencheur porte un id NEUF ; ailleurs, le script pose l'id. Un besoin omis s'ajoute par l'entrée de son champ.
- \`refsFausses\` : l'entrée (\`champ\`, \`id\`) dont la ligne citée ne dit pas ce qu'elle lui fait dire ; \`ref\` = la réf CORRIGÉE, \`motif\` = ce que dit la ligne citée.
- \`contenusFaux\` : l'entrée (\`champ\`, \`id\`) dont un attribut dit autre chose que le livre ; \`attribut\` parmi ceux de son champ — ${Object.entries(ATTRIBUTS_CORRIGEABLES).map(([champ, attributs]) => `${champ} : ${Object.keys(attributs).join(', ')}`).join(' ; ')} —, \`valeur\` = la valeur CORRIGÉE, entière et à la forme de l'attribut dans le dossier, \`ref\` = la réf nue qui la prouve.
- \`classementsFaux.<champ>\` : l'entrée (\`id\`) et son classement CORRIGÉ — statut d'un beat et sa preuve, type d'un point au MJ, nature d'un texte (\`id\` pris dans l'\`origine\` de son besoin), sens et portée d'un état, verdict de confrontation d'un besoin (\`B<n>\`) et sa preuve ; \`ref\` = la réf nue qui prouve ta correction.
Une correction dont la cible n'existe pas, dont l'id de beat ou de déclencheur est déjà pris, dont l'attribut n'est pas celui de son champ ou dont la valeur n'a pas sa forme, ou qui corrige une seconde fois la même cible, ne s'applique pas : elle rend le dossier INAPPLICABLE. Un besoin dont ta correction change la famille, le texte ou la réf, et que tu ne classes pas toi-même, est confronté à nouveau après application, comme tout besoin né d'un oubli. Une confrontation se vérifie sur \`origin/main\` (\`git show origin/main:<fichier>\`, lancé dans l'arbre), jamais sur l'arbre de travail.
Rends \`synthese.markdown\` : le dossier en une page — impératifs, beats et leurs médias candidats, besoins par statut, états produits et lus, corrections.`,
  { label: 'completude', phase: 'Complétude', schema: COMPLETUDE, agentType: 'juge', model: 'opus', effort: 'medium' })

// ── Application des corrections ──────────────────────────────────────────────────────────────
const corrections = []
const anomaliesDeCorrection = []
/** L'entrée UNIQUE qu'une correction vise, ou `null` et l'anomalie qui la nomme. */
const cibleDe = (liste, champ, id, quoi) => {
  const trouvees = liste.filter((e) => e.id === id)
  if (trouvees.length === 1) return trouvees[0]
  anomaliesDeCorrection.push(`${quoi} « ${champ}:${id} » : ${trouvees.length ? `${trouvees.length} entrées portent cet id` : 'cible inconnue'}`)
  return null
}
/** Une cible ne se corrige qu'une fois : la seconde correction du juge le contredit, elle se nomme et ne
 *  s'applique pas. `cible` = type, champ, id (et attribut pour un contenu). */
const dejaCorrigees = new Set()
const premiereCorrection = (cible, quoi, nom) => {
  if (!dejaCorrigees.has(cible)) {
    dejaCorrigees.add(cible)
    return true
  }
  anomaliesDeCorrection.push(`${quoi} « ${nom} » : cible déjà corrigée`)
  return false
}
/** Chaque besoin tel que la confrontation l'a vu : famille, texte et réf, par id. */
const besoinsAvantCorrections = new Map(besoinsDesEntrees().map((b) => [b.id, b]))
/** Les besoins dont le juge a lui-même corrigé le verdict de confrontation. */
const classesParLeJuge = new Set()
if (completude) {
  for (const r of completude.refsFausses) {
    const e = cibleDe(entrees[r.champ], r.champ, r.id, 'réf fausse')
    if (!e || !premiereCorrection(`ref-fausse|${r.champ}|${r.id}`, 'réf fausse', `${r.champ}:${r.id}`)) continue
    corrections.push({ type: 'ref-fausse', champ: r.champ, id: r.id, avant: e.ref, apres: r.ref, motif: r.motif })
    e.ref = r.ref
  }
  for (const c of completude.contenusFaux) {
    const permis = ATTRIBUTS_CORRIGEABLES[c.champ] ?? {}
    if (!Object.hasOwn(permis, c.attribut)) {
      anomaliesDeCorrection.push(`contenu faux « ${c.champ}:${c.id} » : attribut « ${c.attribut} » hors des attributs corrigeables du champ (${Object.keys(permis).join(', ')})`)
      continue
    }
    if (!conforme(c.valeur, permis[c.attribut])) {
      anomaliesDeCorrection.push(`contenu faux « ${c.champ}:${c.id}.${c.attribut} » : valeur ${JSON.stringify(c.valeur)} hors de la forme de l’attribut ${JSON.stringify(permis[c.attribut])}`)
      continue
    }
    const e = cibleDe(entrees[c.champ], c.champ, c.id, 'contenu faux')
    if (!e || !premiereCorrection(`contenu-faux|${c.champ}|${c.id}|${c.attribut}`, 'contenu faux', `${c.champ}:${c.id}.${c.attribut}`)) continue
    corrections.push({ type: 'contenu-faux', champ: c.champ, id: c.id, attribut: c.attribut, avant: e[c.attribut], apres: c.valeur, ref: c.ref })
    e[c.attribut] = c.valeur
  }
  for (const [champ, attributs] of Object.entries(CLASSEMENTS)) {
    const noms = Object.keys(attributs)
    for (const c of completude.classementsFaux[champ]) {
      const apres = Object.fromEntries(noms.map((n) => [n, c[n]]))
      if (champ === 'besoins') {
        const b = cibleDe(besoinsConfrontes(), champ, c.id, 'classement faux')
        if (!b || !premiereCorrection(`classement-faux|${champ}|${c.id}`, 'classement faux', `${champ}:${c.id}`)) continue
        corrections.push({ type: 'classement-faux', champ, id: c.id, avant: { statut: b.statut, preuve: b.preuve }, apres, ref: c.ref })
        verdictsParId.set(c.id, apres)
        classesParLeJuge.add(c.id)
        continue
      }
      const e = cibleDe(entrees[champ], champ, c.id, 'classement faux')
      if (!e || !premiereCorrection(`classement-faux|${champ}|${c.id}`, 'classement faux', `${champ}:${c.id}`)) continue
      corrections.push({ type: 'classement-faux', champ, id: c.id, avant: Object.fromEntries(noms.map((n) => [n, e[n]])), apres, ref: c.ref })
      Object.assign(e, apres)
    }
  }
  for (const c of CHAMPS) {
    for (const oubli of completude.oublis[c.champ]) {
      if (!c.prefixe && !String(oubli.id).trim()) {
        anomaliesDeCorrection.push(`oubli « ${c.champ} » sans id`)
        continue
      }
      if (!c.prefixe && entrees[c.champ].some((e) => e.id === oubli.id)) {
        anomaliesDeCorrection.push(`oubli « ${c.champ}:${oubli.id} » : id déjà porté par une entrée du dossier`)
        continue
      }
      const entree = c.prefixe ? { id: `${c.prefixe}${entrees[c.champ].length + 1}`, ...oubli } : { ...oubli }
      entrees[c.champ].push(entree)
      corrections.push({ type: 'oubli', champ: c.champ, id: entree.id, entree })
    }
  }
}

// ── Confrontation après corrections ────────────────────────────────────────────────────────────
/** Tout besoin NÉ d'un oubli, ou dont la famille, le texte ou la réf a changé sans que le juge l'ait classé :
 *  son verdict, s'il en a un, jugeait un autre besoin. */
const aReconfronter = besoinsDesEntrees().filter((b) => {
  const avant = besoinsAvantCorrections.get(b.id)
  if (!avant) return true
  return !classesParLeJuge.has(b.id) && (avant.famille !== b.famille || avant.texte !== b.texte || avant.ref !== b.ref)
})
for (const b of aReconfronter) verdictsParId.delete(b.id)
const lotsApres = enLots(aReconfronter)
if (aReconfronter.length) log(`Confrontation après corrections : ${aReconfronter.length} besoin(s) né(s) d’un oubli ou changé(s) — ${aReconfronter.map((b) => b.id).join(', ')} — en ${lotsApres.length} lot(s).`)
const reconfrontations = await parallel(lotsApres.map((lot, rang) => () => agent(promptDeConfrontation(lot, `après corrections, lot ${rang + 1}/${lotsApres.length}`),
  { label: `reconfrontation:${rang + 1}`, phase: 'Confrontation', schema: CONFRONTATION, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })))
for (const [id, verdict] of lotsApres.flatMap((lot, rang) => verdictsDuLot(lot, reconfrontations[rang]))) verdictsParId.set(id, verdict)
const commits = [...new Set([...confrontations, ...reconfrontations].filter(Boolean).map((c) => c.origine.commit))]
/** Les lots de confrontation qui n'ont rien rendu : leurs besoins restent `non-confronte`. */
const lotsSansRendu = [
  ...lots.flatMap((_, rang) => (confrontations[rang] ? [] : [`confrontation:${rang + 1}`])),
  ...lotsApres.flatMap((_, rang) => (reconfrontations[rang] ? [] : [`reconfrontation:${rang + 1}`])),
]
if (commits.length > 1) log(`Confrontation : les lots ont lu ${commits.length} commits d'origin/main différents (${commits.join(', ')}) — origin/main a bougé pendant le run.`)

const agents = { lecture: LENTILLES.length, confrontation: lots.length + lotsApres.length, completude: 1, total: LENTILLES.length + lots.length + lotsApres.length + 1 }
if (!completude) log('Complétude : le juge n’a rien rendu — le dossier est rendu SANS relecture de complétude.')
if (anomaliesDeCorrection.length) log(`Complétude : ${anomaliesDeCorrection.length} correction(s) INAPPLICABLE(S) — ${anomaliesDeCorrection.join(' · ')}.`)
const dossier = dossierCourant()
const parStatut = (s) => dossier.besoins.filter((b) => b.statut === s).length
log(`Dossier : ${dossier.imperatifs.length} impératif(s), ${dossier.beats.length} beat(s), ${dossier.besoins.length} besoin(s) — ${parStatut('existe')} existe, ${parStatut('partiel')} partiel, ${parStatut('manque')} manque, ${parStatut('non-confronte')} non confronté(s) ; ${corrections.length} correction(s) appliquée(s) (${['oubli', 'ref-fausse', 'contenu-faux', 'classement-faux'].map((t) => `${corrections.filter((c) => c.type === t).length} ${t}`).join(', ')}), ${anomaliesDeCorrection.length} inapplicable(s) ; ${agents.total} agents joués.`)
const nonConfrontes = dossier.besoins.filter((b) => b.statut === 'non-confronte').map((b) => b.id)
if (nonConfrontes.length) log(`Dossier : CONFRONTATION INCOMPLÈTE — ${nonConfrontes.length} besoin(s) non confronté(s) (${nonConfrontes.join(', ')}) ; lot(s) sans rendu : ${lotsSansRendu.join(', ') || 'aucun, verdict(s) absent(s) d’un lot rendu'}.`)
/** Les TROUS du dossier, par espèce, chacune sous le verdict qui la nomme, dans l'ordre où elles le priment :
 *  DOSSIER ne se rend que si toutes sont vides. */
const trous = [
  { espece: 'anomaliesDeLecture', verdict: 'LECTURE INVALIDE', liste: anomaliesDeLecture },
  { espece: 'lentillesSansRendu', verdict: 'LECTURE INCOMPLÈTE', liste: mortes },
  { espece: 'completudeSansRendu', verdict: 'DOSSIER SANS COMPLÉTUDE', liste: completude ? [] : ['completude'] },
  { espece: 'anomaliesDeCorrection', verdict: 'CORRECTIONS INAPPLICABLES', liste: anomaliesDeCorrection },
  { espece: 'lotsSansRendu', verdict: 'CONFRONTATION INCOMPLÈTE', liste: lotsSansRendu },
  { espece: 'besoinsNonConfrontes', verdict: 'CONFRONTATION INCOMPLÈTE', liste: nonConfrontes },
]
const verdict = (trous.find((t) => t.liste.length) ?? { verdict: 'DOSSIER' }).verdict
if (verdict !== 'DOSSIER') log(`Dossier : ${verdict} — trous : ${trous.filter((t) => t.liste.length).map((t) => `${t.espece} (${t.liste.join(', ')})`).join(' · ')}.`)
return {
  verdict,
  livre: LIVRE,
  chapitre: CHAPITRE,
  ...dossier,
  trous: Object.fromEntries(trous.map((t) => [t.espece, t.liste])),
  commitsConfrontes: commits,
  corrections,
  synthese_markdown: completude ? completude.synthese.markdown : '',
  agents,
  date: DATE,
}
