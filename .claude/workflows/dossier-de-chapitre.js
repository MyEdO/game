export const meta = {
  name: 'dossier-de-chapitre',
  description: "Dossier d'un chapitre de campagne, moitié LIVRE : lentilles de lecture aux travaux DIFFÉRENTS, en parallèle, chacune au Source/ (impératifs, beats, points au MJ, indices, secrets et déclencheurs ; PNJ, lieux, textes ; mécanique et états ; matière des compagnons si fournis), puis un juge de complétude qui relit le chapitre et réfute, dont le script APPLIQUE les corrections (oublis, réfs fausses, contenus faux, chacune visée par famille et id) : la fiche rendue est la fiche CORRIGÉE, et `corrections` la trace de ce qui a été appliqué. Le rendu est une fiche au schéma `ficheDeDossier` (`src/data/source/dossier.ts`) : `lecture: { date, commit }` puis les familles en premier niveau, chaque entrée sous l'id `<préfixe><rang>` que le script pose. Familles, préfixes et formes d'entrée ENTRENT par `args`, projetés de `ficheDeDossier` par le lanceur. args : { livre, chapitre, fichiers, compagnons?, worktree, date, commit, familles } — `node scripts/raw/workflow-args.mjs dossier-de-chapitre <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> [--compagnons <ABBR>-<NN>,…]`. Le verdict se DÉRIVE de `trous`, une liste par espèce : DOSSIER quand toutes sont vides, sinon la première espèce trouée le nomme — LECTURE INCOMPLÈTE (`lentillesSansRendu`), DOSSIER SANS COMPLÉTUDE (`completudeSansRendu`), CORRECTIONS INAPPLICABLES (`anomaliesDeCorrection` : une correction vise une cible inconnue ou déjà corrigée, un attribut hors de sa famille ou une valeur hors de sa forme). ARRÊT (argument manquant) : ni fiche ni trous. Seul DOSSIER s'écrit en fiche commitée (`node scripts/raw/workflow-args.mjs ecrire-fiche <rendu.json>`).",
  whenToUse: "Avant de découper, maquetter ou produire un chapitre (méthode de #665, étape 3) : établir ce que le LIVRE exige. Son rendu au verdict DOSSIER s'écrit en fiche commitée `docs/dossiers/<ABBR>/<NN>.json` par le lanceur ; la table simulée du même chapitre en tire la fiche du MJ, et le paquet de campagne la cite (`couvre`, `ecartes`).",
  phases: [
    { title: 'Lecture', detail: 'lentilles indépendantes, chacune relit le chapitre au Source/' },
    { title: 'Complétude', detail: 'un juge relit le chapitre et réfute oublis, réfs fausses, contenus faux ; le script les applique à la fiche' },
  ],
}

// args parfois STRINGIFIÉ par le harnais → parse défensif.
const input = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})
const enListe = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String)
const estObjet = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const LIVRE = String(input.livre || '')
const CHAPITRE = String(input.chapitre || '')
const FICHIERS = enListe(input.fichiers)
const COMPAGNONS = enListe(input.compagnons)
const WORKTREE = String(input.worktree || '')
const DATE = String(input.date || '')
const COMMIT = String(input.commit || '')
/** Les familles de la fiche (`ficheDeDossier`), projetées par le lanceur : `{ <famille>: { prefixe, minimum, entree } }`,
 *  `entree` = la forme JSON d'une entrée, sans `id`. */
const FAMILLES = estObjet(input.familles) ? input.familles : {}
const NOMS_DE_FAMILLE = Object.keys(FAMILLES)
/** Une famille projetée a son préfixe, son minimum et la forme d'une entrée. */
const projetee = (p) => estObjet(p) && typeof p.prefixe === 'string' && p.prefixe !== '' && Number.isInteger(p.minimum)
  && estObjet(p.entree) && estObjet(p.entree.properties) && Array.isArray(p.entree.required)

// ── Lentilles ────────────────────────────────────────────────────────────────────────────────
/** Les valeurs d'un attribut énuméré d'une famille, dites dans une consigne. */
const valeursDe = (famille, attribut) => {
  const forme = FAMILLES[famille]?.entree?.properties?.[attribut]
  return (forme?.enum ?? forme?.items?.enum ?? []).join(', ')
}
const LENTILLE_IMPERATIFS_ET_BEATS = {
  label: 'imperatifs-et-beats',
  familles: ['imperatifs', 'beats', 'pointsAuMJ', 'indices', 'secrets', 'declencheurs'],
  consigne: `LENTILLE — IMPÉRATIFS, BEATS, INDICES, SECRETS ET DÉCLENCHEURS.
- imperatifs : ce que le livre rend indispensable (éléments clés, indices à trouver, « doivent absolument », contraintes posées pour la suite de la campagne).
- beats : la suite des scènes du chapitre DANS L'ORDRE DU LIVRE (le script les numérote dans cet ordre). \`statut\` TEL QUE LE LIVRE LE DIT — \`obligatoire\` ou \`optionnel\` —, et \`preuveDuStatut\` cite le passage qui le dit ; un beat que le livre ne qualifie pas est \`non-qualifie\`, et sa preuve le dit. \`mediasCandidats\` : TOUS les médias plausibles parmi ${valeursDe('beats', 'mediasCandidats')}, chacun une fois — tu listes, tu ne tranches pas.
- pointsAuMJ : chaque passage que le livre laisse à la décision du MJ (« à vous de décider », « si vous le désirez », alternatives, encarts), typé parmi ${valeursDe('pointsAuMJ', 'type')}.
- indices et secrets : ce que le MJ sait et que les joueurs peuvent découvrir.
- declencheurs : chaque événement que le livre fait arriver à l'INITIATIVE d'un PNJ ou du monde, sans action des joueurs (« s'ils l'ignorent, il s'approche de leur table au bout d'une demi-heure »), l'événement, et sa \`condition\` ou son délai tel que le livre l'écrit.`,
}
const LENTILLE_PNJ_LIEUX_TEXTES = {
  label: 'pnj-lieux-textes',
  familles: ['pnj', 'lieux', 'textes'],
  consigne: `LENTILLE — PNJ, LIEUX, TEXTES.
- pnj : chaque PNJ nommé ou décrit, son rôle dans le chapitre, sa motivation telle que le livre la donne.
- lieux : chaque lieu où une scène peut se jouer.
- textes : chaque texte que le jeu devra montrer, sa \`nature\` parmi ${valeursDe('textes', 'nature')}. \`document-verbatim\` = le livre en donne le texte (lettre, affiche, aide de jeu) : il se recopie tel quel. \`motivation-a-authorer\` = le livre ne donne qu'une intention ou une motivation de PNJ : la réplique s'authore. \`narration-a-reformuler\` = une description ou une narration destinée au MJ, que le jeu reformule en texte lu à l'écran (fiche \`user-doctrine-regle-5-campagne-repliques-et-narration-maison\`).`,
}
const LENTILLE_MECANIQUE = {
  label: 'mecanique',
  familles: ['tests', 'rencontres', 'dureeEtDifficulte', 'recompenses', 'etats'],
  consigne: `LENTILLE — MÉCANIQUE.
- tests : chaque Test que le livre demande ou propose, la compétence ou caractéristique, la difficulté TELLE QUE LE LIVRE L'ÉCRIT.
- rencontres : chaque combat ou opposition, adversaires et effectifs.
- dureeEtDifficulte : ce que le livre dit de la durée et de la difficulté visées (séances, jours de jeu, dangerosité).
- recompenses : points d'expérience, argent, objets, relations gagnées.
- etats : chaque état que le chapitre PRODUIT (décision, fin, drapeau que la suite lit) ou LIT (hérité d'un chapitre ou d'un tome antérieur) — \`sens\` parmi ${valeursDe('etats', 'sens')} —, sa \`portee\` parmi ${valeursDe('etats', 'portee')}.`,
}
const LENTILLE_MATIERE_COMPAGNONS = {
  label: 'matiere-compagnons',
  familles: ['matiereCompagnons'],
  consigne: `LENTILLE — MATIÈRE DES COMPAGNONS. Lis INTÉGRALEMENT les chapitres de compagnon suivants : ${COMPAGNONS.join(' · ')}. Rends dans \`matiereCompagnons\` la matière que ce chapitre-ci peut y puiser (péages, PNJ et scénarios annexes, lieux, règles, rencontres…), chacune avec sa \`categorie\` (un mot : peage, pnj, scenario-annexe, lieu, regle, rencontre…), \`pourCeChapitre\` = où elle s'insère dans le chapitre (beat, lieu ou réf du chapitre), et sa réf nue au compagnon.`,
}
/** Toutes les lentilles : chaque famille de la fiche est lue par UNE d'elles. */
const TOUTES_LES_LENTILLES = [LENTILLE_IMPERATIFS_ET_BEATS, LENTILLE_PNJ_LIEUX_TEXTES, LENTILLE_MECANIQUE, LENTILLE_MATIERE_COMPAGNONS]
const FAMILLES_LUES = TOUTES_LES_LENTILLES.flatMap((l) => l.familles)

const manquesDArgs = [
  LIVRE ? null : 'args.livre — sigle du livre (ex. EDO)',
  CHAPITRE ? null : 'args.chapitre — numéro du chapitre (ex. 01)',
  FICHIERS.length ? null : 'args.fichiers — chemins Source/ du chapitre',
  WORKTREE ? null : 'args.worktree — chemin ABSOLU de l’arbre lu',
  DATE ? null : 'args.date — AAAA-MM-JJ (aucune horloge dans un script : la reprise doit rendre le même run)',
  COMMIT ? null : 'args.commit — la tête de l’arbre lu (`lecture.commit` de la fiche)',
  ...FAMILLES_LUES.filter((f) => !projetee(FAMILLES[f])).map((f) => `args.familles.${f} — famille lue par une lentille, sans projection { prefixe, minimum, entree } de \`ficheDeDossier\``),
  ...NOMS_DE_FAMILLE.filter((f) => !FAMILLES_LUES.includes(f)).map((f) => `args.familles.${f} — famille de la fiche qu’aucune lentille ne lit`),
].filter(Boolean)
if (manquesDArgs.length) {
  log(`ARRÊT : ${manquesDArgs.length} argument(s) manquant(s) — ${manquesDArgs.join(' · ')} ; lanceur : node scripts/raw/workflow-args.mjs dossier-de-chapitre <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ>`)
  return { verdict: 'ARRÊT', manques: manquesDArgs, livre: LIVRE, chapitre: CHAPITRE, trous: null, corrections: [], synthese_markdown: '', agents: { lecture: 0, completude: 0, total: 0 } }
}

/** La forme d'une entrée et le minimum d'entrées, par famille. */
const ENTREES = Object.fromEntries(NOMS_DE_FAMILLE.map((f) => [f, FAMILLES[f].entree]))
const MINIMA = Object.fromEntries(NOMS_DE_FAMILLE.map((f) => [f, FAMILLES[f].minimum]))

const CADRE = `Arbre (chemin ABSOLU, à utiliser tel quel) : ${WORKTREE}
Date du jour : ${DATE}
LECTURE SEULE : tu n'écris AUCUN fichier, ni sous l'arbre ni ailleurs. Aucun git écrivain, aucune suite de tests, aucune gate.
Toute commande passe par l'outil \`ctx_shell\`, son paramètre \`cwd\` = l'arbre ci-dessus : UNE commande simple par appel, sans changement de dossier, sans enchaînement ni pipe, sans redirection, sans variable d'environnement en tête ; UN SEUL appel \`ctx_shell\` par message, jamais plusieurs en parallèle. Une sonde est une commande (\`git grep …\`, \`npx tsx -e "…"\`), jamais un fichier écrit ; tout processus lancé est TUÉ avant ton rendu.
Toute référence au livre est NUE, une réf entière par élément de \`ref\` : \`${LIVRE} ${CHAPITRE} l.<ligne>\` (ligne du fichier Source/ ; pour un compagnon, son sigle et son chapitre) ; dans un texte, une ligne ne s'écrit que dans une telle réf entière. Un numéro de ligne se prend sur une lecture BRUTE numérotée (\`grep -n\`, \`sed -n 'X,Yp'\`, \`ctx_read\` en mode \`raw\`), jamais sur une vue résumée ou compressée ; toute réf se vérifie en relisant la ligne citée avant d'être rendue. Une absence se prouve par une sonde et son périmètre, jamais par « je n'ai pas trouvé ».
Ton rendu = l'objet du schéma, rien d'autre.`

const CHAPITRE_LU = `Chapitre : ${LIVRE} ${CHAPITRE} — fichiers Source/ (relatifs à l'arbre) : ${FICHIERS.join(' · ')}
Lis-les INTÉGRALEMENT, du début à la fin : un dossier se fonde sur le livre, jamais sur un résumé.`

// ── Schémas : la racine est LITTÉRALE, la forme de chaque entrée vient de `args` ───────────────
const IMPERATIFS_ET_BEATS = {
  type: 'object', additionalProperties: false,
  properties: {
    imperatifs: { type: 'array', minItems: MINIMA.imperatifs, items: ENTREES.imperatifs },
    beats: { type: 'array', minItems: MINIMA.beats, items: ENTREES.beats },
    pointsAuMJ: { type: 'array', minItems: MINIMA.pointsAuMJ, items: ENTREES.pointsAuMJ },
    indices: { type: 'array', minItems: MINIMA.indices, items: ENTREES.indices },
    secrets: { type: 'array', minItems: MINIMA.secrets, items: ENTREES.secrets },
    declencheurs: { type: 'array', minItems: MINIMA.declencheurs, items: ENTREES.declencheurs },
  },
  required: ['imperatifs', 'beats', 'pointsAuMJ', 'indices', 'secrets', 'declencheurs'],
}
const PNJ_LIEUX_TEXTES = {
  type: 'object', additionalProperties: false,
  properties: {
    pnj: { type: 'array', minItems: MINIMA.pnj, items: ENTREES.pnj },
    lieux: { type: 'array', minItems: MINIMA.lieux, items: ENTREES.lieux },
    textes: { type: 'array', minItems: MINIMA.textes, items: ENTREES.textes },
  },
  required: ['pnj', 'lieux', 'textes'],
}
const MECANIQUE = {
  type: 'object', additionalProperties: false,
  properties: {
    tests: { type: 'array', minItems: MINIMA.tests, items: ENTREES.tests },
    rencontres: { type: 'array', minItems: MINIMA.rencontres, items: ENTREES.rencontres },
    dureeEtDifficulte: { type: 'array', minItems: MINIMA.dureeEtDifficulte, items: ENTREES.dureeEtDifficulte },
    recompenses: { type: 'array', minItems: MINIMA.recompenses, items: ENTREES.recompenses },
    etats: { type: 'array', minItems: MINIMA.etats, items: ENTREES.etats },
  },
  required: ['tests', 'rencontres', 'dureeEtDifficulte', 'recompenses', 'etats'],
}
const MATIERE_COMPAGNONS = {
  type: 'object', additionalProperties: false,
  properties: {
    matiereCompagnons: { type: 'array', minItems: MINIMA.matiereCompagnons, items: ENTREES.matiereCompagnons },
  },
  required: ['matiereCompagnons'],
}

/** Ce qu'un contenu faux corrige, par famille : TOUS les attributs de son entrée, chacun à sa forme, hors
 *  `ref` (réf fausse) — `id` n'est pas un attribut d'entrée, le script le pose. */
const ATTRIBUTS_CORRIGEABLES = Object.fromEntries(NOMS_DE_FAMILLE.map((f) => [f, Object.fromEntries(Object.entries(ENTREES[f].properties)
  .filter(([nom]) => nom !== 'ref'))]))
/** Les formes distinctes d'une liste de formes. */
const distinctes = (formes) => [...new Map(formes.map((forme) => [JSON.stringify(forme), forme])).values()]
/** Les formes que peut prendre la valeur d'un contenu faux, et celles d'une réf corrigée. */
const FORMES_CORRIGEABLES = distinctes(Object.values(ATTRIBUTS_CORRIGEABLES).flatMap((attributs) => Object.values(attributs)))
const FORMES_DE_REF = distinctes(NOMS_DE_FAMILLE.map((f) => ENTREES[f].properties.ref).filter(Boolean))
/** Les mots-clés de forme que `conforme` lit : une forme qui en porte un autre ne valide rien. */
const MOTS_CLES_LUS = new Set(['type', 'enum', 'items', 'minItems', 'uniqueItems', 'minLength'])
/** Une valeur conforme à la forme de son attribut. Une correction n'efface jamais un attribut : un texte
 *  vide ou blanc n'est pas conforme. */
const conforme = (valeur, forme) => {
  if (!estObjet(forme) || Object.keys(forme).some((cle) => !MOTS_CLES_LUS.has(cle))) return false
  if (forme.enum) return forme.enum.includes(valeur)
  if (forme.type === 'array') {
    return Array.isArray(valeur) && valeur.length >= (forme.minItems ?? 0) && valeur.every((v) => conforme(v, forme.items))
      && (!forme.uniqueItems || new Set(valeur.map((v) => JSON.stringify(v))).size === valeur.length)
  }
  if (forme.type === 'string') return typeof valeur === 'string' && valeur.trim() !== '' && valeur.length >= (forme.minLength ?? 0)
  if (forme.type === 'number') return typeof valeur === 'number' && Number.isFinite(valeur)
  if (forme.type === 'boolean') return typeof valeur === 'boolean'
  return false
}

const COMPLETUDE = {
  type: 'object', additionalProperties: false,
  properties: {
    oublis: {
      type: 'object', additionalProperties: false,
      properties: Object.fromEntries(NOMS_DE_FAMILLE.map((f) => [f, { type: 'array', items: ENTREES[f] }])),
      required: NOMS_DE_FAMILLE,
    },
    refsFausses: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { famille: { enum: NOMS_DE_FAMILLE }, id: { type: 'string' }, ref: { anyOf: FORMES_DE_REF }, motif: { type: 'string' } },
        required: ['famille', 'id', 'ref', 'motif'],
      },
    },
    contenusFaux: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          famille: { enum: NOMS_DE_FAMILLE },
          id: { type: 'string' },
          attribut: { enum: [...new Set(Object.values(ATTRIBUTS_CORRIGEABLES).flatMap((attributs) => Object.keys(attributs)))] },
          valeur: { anyOf: FORMES_CORRIGEABLES },
          ref: { type: 'string' },
        },
        required: ['famille', 'id', 'attribut', 'valeur', 'ref'],
      },
    },
    synthese: {
      type: 'object', additionalProperties: false,
      properties: { markdown: { type: 'string' } },
      required: ['markdown'],
    },
  },
  required: ['oublis', 'refsFausses', 'contenusFaux', 'synthese'],
}

// ── Lecture ──────────────────────────────────────────────────────────────────────────────────
/** Le prompt d'une lentille : sa consigne, puis le cadre commun. */
const promptDeLecture = (l) => `${l.consigne}\n\n${CADRE}\n${CHAPITRE_LU}\n\nTu lis SEUL : les autres lentilles ne te sont pas montrées. Chaque entrée porte sa réf nue ; tu ne poses aucun id, le script les numérote.`
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
if (mortes.length) log(`Lecture : ${mortes.length} lentille(s) sans rendu — ${mortes.join(', ')} ; leurs familles MANQUENT à la fiche et le juge de complétude le sait.`)

/** La lentille qui lit chaque famille. */
const lentilleDe = Object.fromEntries(TOUTES_LES_LENTILLES.flatMap((l) => l.familles.map((f) => [f, l.label])))
/** L'id `<préfixe><rang>` d'une entrée NEUVE de la famille, posé par le script. */
const idSuivant = (famille, liste) => `${FAMILLES[famille].prefixe}${liste.length + 1}`
/** Les entrées de chaque famille, chacune sous son id — une lentille morte laisse ses familles vides. */
const entrees = Object.fromEntries(NOMS_DE_FAMILLE.map((f) => [f, []]))
for (const f of NOMS_DE_FAMILLE) {
  for (const e of (parLentille[lentilleDe[f]] || {})[f] || []) entrees[f].push({ id: idSuivant(f, entrees[f]), ...e })
}

// ── Complétude ───────────────────────────────────────────────────────────────────────────────
const completude = await agent(`Tu JUGES la complétude d'un dossier de chapitre. Relis le chapitre au Source/ par toi-même : la fiche ci-dessous est ce que tu RÉFUTES, jamais une source.
${CADRE}
${CHAPITRE_LU}
${COMPAGNONS.length ? `Compagnons puisés : ${COMPAGNONS.join(' · ')}` : 'Aucun compagnon fourni.'}
${mortes.length ? `Lentilles SANS rendu : ${mortes.join(', ')} — leurs familles sont vides, relève ce qu'elles auraient dû porter.` : ''}

FICHE (chaque entrée porte son \`id\`, posé par le script) :
${JSON.stringify(entrees, null, 1)}

Tes corrections, le script les APPLIQUE à la fiche — chacune vise une famille et un id, jamais un texte :
- \`oublis.<famille>\` : chaque entrée que le livre porte et que la fiche omet, COMPLÈTE, à la forme de sa famille ; le script pose son id.
- \`refsFausses\` : l'entrée (\`famille\`, \`id\`) dont une ligne citée ne dit pas ce qu'elle lui fait dire ; \`ref\` = ses réfs CORRIGÉES, entières, \`motif\` = ce que dit la ligne citée.
- \`contenusFaux\` : l'entrée (\`famille\`, \`id\`) dont un attribut dit autre chose que le livre, classement compris (statut d'un beat, type d'un point au MJ, nature d'un texte, sens et portée d'un état) ; \`attribut\` parmi ceux de sa famille — ${Object.entries(ATTRIBUTS_CORRIGEABLES).map(([famille, attributs]) => `${famille} : ${Object.keys(attributs).join(', ')}`).join(' ; ')} —, \`valeur\` = la valeur CORRIGÉE, entière et à la forme de l'attribut dans la fiche, \`ref\` = la réf nue qui la prouve.
Une correction dont la cible n'existe pas, dont l'attribut n'est pas celui de sa famille ou dont la valeur n'a pas sa forme, ou qui corrige une seconde fois la même cible, ne s'applique pas : elle rend la fiche INAPPLICABLE.
Rends \`synthese.markdown\` : la fiche en une page — impératifs, beats et leurs médias candidats, états produits et lus, corrections.`,
  { label: 'completude', phase: 'Complétude', schema: COMPLETUDE, agentType: 'juge', model: 'opus', effort: 'medium' })

// ── Application des corrections ──────────────────────────────────────────────────────────────
const corrections = []
const anomaliesDeCorrection = []
/** L'entrée qu'une correction vise, ou `null` et l'anomalie qui la nomme. Les ids sont posés par le
 *  script : uniques dans leur famille. */
const cibleDe = (famille, id, quoi) => {
  const trouvee = (entrees[famille] ?? []).find((e) => e.id === id)
  if (!trouvee) anomaliesDeCorrection.push(`${quoi} « ${famille}:${id} » : cible inconnue`)
  return trouvee ?? null
}
/** Une cible ne se corrige qu'une fois : la seconde correction du juge le contredit, elle se nomme et ne
 *  s'applique pas. `cible` = type, famille, id (et attribut pour un contenu). */
const dejaCorrigees = new Set()
const premiereCorrection = (cible, quoi, nom) => {
  if (!dejaCorrigees.has(cible)) {
    dejaCorrigees.add(cible)
    return true
  }
  anomaliesDeCorrection.push(`${quoi} « ${nom} » : cible déjà corrigée`)
  return false
}
if (completude) {
  for (const r of completude.refsFausses) {
    const formeDeRef = ENTREES[r.famille]?.properties.ref
    if (!conforme(r.ref, formeDeRef)) {
      anomaliesDeCorrection.push(`réf fausse « ${r.famille}:${r.id} » : réf ${JSON.stringify(r.ref)} hors de la forme ${JSON.stringify(formeDeRef)}`)
      continue
    }
    const e = cibleDe(r.famille, r.id, 'réf fausse')
    if (!e || !premiereCorrection(`ref-fausse|${r.famille}|${r.id}`, 'réf fausse', `${r.famille}:${r.id}`)) continue
    corrections.push({ type: 'ref-fausse', famille: r.famille, id: r.id, avant: e.ref, apres: r.ref, motif: r.motif })
    e.ref = r.ref
  }
  for (const c of completude.contenusFaux) {
    const permis = ATTRIBUTS_CORRIGEABLES[c.famille] ?? {}
    if (!Object.hasOwn(permis, c.attribut)) {
      anomaliesDeCorrection.push(`contenu faux « ${c.famille}:${c.id} » : attribut « ${c.attribut} » hors des attributs corrigeables de la famille (${Object.keys(permis).join(', ')})`)
      continue
    }
    if (!conforme(c.valeur, permis[c.attribut])) {
      anomaliesDeCorrection.push(`contenu faux « ${c.famille}:${c.id}.${c.attribut} » : valeur ${JSON.stringify(c.valeur)} hors de la forme de l’attribut ${JSON.stringify(permis[c.attribut])}`)
      continue
    }
    const e = cibleDe(c.famille, c.id, 'contenu faux')
    if (!e || !premiereCorrection(`contenu-faux|${c.famille}|${c.id}|${c.attribut}`, 'contenu faux', `${c.famille}:${c.id}.${c.attribut}`)) continue
    corrections.push({ type: 'contenu-faux', famille: c.famille, id: c.id, attribut: c.attribut, avant: e[c.attribut], apres: c.valeur, ref: c.ref })
    e[c.attribut] = c.valeur
  }
  for (const f of NOMS_DE_FAMILLE) {
    for (const oubli of completude.oublis[f]) {
      const entree = { id: idSuivant(f, entrees[f]), ...oubli }
      entrees[f].push(entree)
      corrections.push({ type: 'oubli', famille: f, id: entree.id, entree })
    }
  }
}

const agents = { lecture: LENTILLES.length, completude: 1, total: LENTILLES.length + 1 }
if (!completude) log('Complétude : le juge n’a rien rendu — la fiche est rendue SANS relecture de complétude.')
if (anomaliesDeCorrection.length) log(`Complétude : ${anomaliesDeCorrection.length} correction(s) INAPPLICABLE(S) — ${anomaliesDeCorrection.join(' · ')}.`)
log(`Fiche : ${NOMS_DE_FAMILLE.map((f) => `${entrees[f].length} ${f}`).join(', ')} ; ${corrections.length} correction(s) appliquée(s) (${['oubli', 'ref-fausse', 'contenu-faux'].map((t) => `${corrections.filter((c) => c.type === t).length} ${t}`).join(', ')}), ${anomaliesDeCorrection.length} inapplicable(s) ; ${agents.total} agents joués.`)
/** Les TROUS du run, par espèce, chacune sous le verdict qui la nomme, dans l'ordre où elles le priment :
 *  DOSSIER ne se rend que si toutes sont vides. */
const trous = [
  { espece: 'lentillesSansRendu', verdict: 'LECTURE INCOMPLÈTE', liste: mortes },
  { espece: 'completudeSansRendu', verdict: 'DOSSIER SANS COMPLÉTUDE', liste: completude ? [] : ['completude'] },
  { espece: 'anomaliesDeCorrection', verdict: 'CORRECTIONS INAPPLICABLES', liste: anomaliesDeCorrection },
]
const verdict = (trous.find((t) => t.liste.length) ?? { verdict: 'DOSSIER' }).verdict
if (verdict !== 'DOSSIER') log(`Dossier : ${verdict} — trous : ${trous.filter((t) => t.liste.length).map((t) => `${t.espece} (${t.liste.join(', ')})`).join(' · ')}.`)
return {
  verdict,
  livre: LIVRE,
  chapitre: CHAPITRE,
  lecture: { date: DATE, commit: COMMIT },
  ...entrees,
  trous: Object.fromEntries(trous.map((t) => [t.espece, t.liste])),
  corrections,
  synthese_markdown: completude ? completude.synthese.markdown : '',
  agents,
}
