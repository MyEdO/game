export const meta = {
  name: 'dossier-de-chapitre',
  description: "Dossier d'un chapitre de campagne, moitié LIVRE : des lentilles lisent le chapitre au Source/ en parallèle (impératifs, beats, points au MJ, indices, secrets, déclencheurs ; PNJ, lieux, textes ; mécanique et états ; matière des compagnons si fournis), puis un juge de complétude réfute et le script applique ses corrections. Rend la fiche CORRIGÉE au schéma `ficheDeDossier` (`src/data/source/dossier.ts`), avec ses `trous` et ses `corrections`. args : { livre, chapitre, fichiers, compagnons?, worktree, date, commit, familles } — `node scripts/raw/workflow-args.mjs dossier-de-chapitre <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> [--compagnons <ABBR>-<NN>,…]`. Verdict : DOSSIER sans trou, sinon LECTURE INCOMPLÈTE, DOSSIER SANS COMPLÉTUDE ou CORRECTIONS INAPPLICABLES ; ARRÊT si un argument manque : ni fiche ni trous. Seul DOSSIER s'écrit en fiche commitée (`node scripts/raw/workflow-args.mjs ecrire-fiche <rendu.json>`).",
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
 *  `entree` = la forme JSON d'une entrée, sans `id`, chaque attribut avec sa `description`. */
const FAMILLES = estObjet(input.familles) ? input.familles : {}
const NOMS_DE_FAMILLE = Object.keys(FAMILLES)
/** Une famille projetée a son préfixe, son minimum et la forme d'une entrée. */
const projetee = (p) => estObjet(p) && typeof p.prefixe === 'string' && p.prefixe !== '' && Number.isInteger(p.minimum)
  && estObjet(p.entree) && estObjet(p.entree.properties) && Array.isArray(p.entree.required)

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
- beats : DANS L'ORDRE DU LIVRE (le script les numérote dans cet ordre), \`mediasCandidats\` parmi ${valeursDe('beats', 'mediasCandidats')}.
- pointsAuMJ : typé parmi ${valeursDe('pointsAuMJ', 'type')}.`,
}
const LENTILLE_PNJ_LIEUX_TEXTES = {
  label: 'pnj-lieux-textes',
  familles: ['pnj', 'lieux', 'textes'],
  consigne: `LENTILLE — PNJ, LIEUX, TEXTES.
- textes : \`nature\` parmi ${valeursDe('textes', 'nature')} (fiche \`user-doctrine-regle-5-campagne-repliques-et-narration-maison\`).`,
}
const LENTILLE_MECANIQUE = {
  label: 'mecanique',
  familles: ['tests', 'rencontres', 'dureeEtDifficulte', 'recompenses', 'etats'],
  consigne: `LENTILLE — MÉCANIQUE.
- etats : \`sens\` parmi ${valeursDe('etats', 'sens')}, \`portee\` parmi ${valeursDe('etats', 'portee')}.`,
}
const LENTILLE_MATIERE_COMPAGNONS = {
  label: 'matiere-compagnons',
  familles: ['matiereCompagnons'],
  consigne: `LENTILLE — MATIÈRE DES COMPAGNONS. Lis INTÉGRALEMENT les chapitres de compagnon suivants : ${COMPAGNONS.join(' · ')}. Rends dans \`matiereCompagnons\` la matière que ce chapitre-ci peut y puiser (péages, PNJ et scénarios annexes, lieux, règles, rencontres…), chacune avec sa réf nue au compagnon.`,
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
Tes lectures passent par Read, Grep et Glob, chemins ABSOLUS sous l'arbre. Toute commande passe par l'outil \`ctx_shell\` s'il est disponible (poste), son paramètre \`cwd\` = l'arbre, sinon par l'outil Bash : UNE commande simple par appel, sans changement de dossier, sans enchaînement ni pipe, sans redirection, sans variable d'environnement en tête, chaque chemin ABSOLU sous l'arbre (le répertoire courant du shell n'est pas forcément l'arbre) ; UN SEUL appel shell par message, jamais plusieurs en parallèle. Une sonde est une commande (\`npx tsx -e "…"\`), jamais un fichier écrit ; tout processus lancé est TUÉ avant ton rendu.
Toute référence au livre est NUE, une réf entière par élément de \`ref\` : \`${LIVRE} ${CHAPITRE} l.<ligne>\` (ligne du fichier Source/ ; pour un compagnon, son sigle et son chapitre) ; dans un texte, une ligne ne s'écrit que dans une telle réf entière. Un numéro de ligne se prend sur une lecture BRUTE numérotée (\`Read\`, ou \`Grep\` avec ses numéros de ligne), jamais sur une vue résumée ou compressée ; toute réf se vérifie en relisant la ligne citée avant d'être rendue. Une absence se prouve par une recherche et son périmètre, jamais par « je n'ai pas trouvé ».
Chaque champ du schéma porte sa définition (\`description\`) : elle fait foi.
Ton rendu = l'objet du schéma, rien d'autre.`

const CHAPITRE_LU = `Chapitre : ${LIVRE} ${CHAPITRE} — fichiers Source/ (relatifs à l'arbre) : ${FICHIERS.join(' · ')}
Lis-les INTÉGRALEMENT, du début à la fin : un dossier se fonde sur le livre, jamais sur un résumé.`

// ── Schémas de lecture : la racine est LITTÉRALE, la forme de chaque entrée vient de `args` ────
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

// ── Lecture ──────────────────────────────────────────────────────────────────────────────────
/** Le prompt d'une lentille : sa consigne, puis le cadre commun. */
const promptDeLecture = (l) => `${l.consigne}\n\n${CADRE}\n${CHAPITRE_LU}\n\nTu lis SEUL : les autres lentilles ne te sont pas montrées. Chaque entrée porte sa réf nue ; tu ne poses aucun id, le script les numérote.`
/** Les lentilles qui JOUENT, chacune avec son site `agent(` : son schéma se lit à la forme, son rendu se
 *  keye au label de SA lentille, jamais au rang. Celle des compagnons ne joue que s'il y en a. */
const lecteurs = [
  [LENTILLE_IMPERATIFS_ET_BEATS, () => agent(promptDeLecture(LENTILLE_IMPERATIFS_ET_BEATS),
    { label: LENTILLE_IMPERATIFS_ET_BEATS.label, phase: 'Lecture', schema: IMPERATIFS_ET_BEATS, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })],
  [LENTILLE_PNJ_LIEUX_TEXTES, () => agent(promptDeLecture(LENTILLE_PNJ_LIEUX_TEXTES),
    { label: LENTILLE_PNJ_LIEUX_TEXTES.label, phase: 'Lecture', schema: PNJ_LIEUX_TEXTES, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })],
  [LENTILLE_MECANIQUE, () => agent(promptDeLecture(LENTILLE_MECANIQUE),
    { label: LENTILLE_MECANIQUE.label, phase: 'Lecture', schema: MECANIQUE, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })],
]
if (COMPAGNONS.length) {
  lecteurs.push([LENTILLE_MATIERE_COMPAGNONS, () => agent(promptDeLecture(LENTILLE_MATIERE_COMPAGNONS),
    { label: LENTILLE_MATIERE_COMPAGNONS.label, phase: 'Lecture', schema: MATIERE_COMPAGNONS, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })])
}
const LENTILLES = lecteurs.map(([l]) => l)
log(`Lecture : ${LENTILLES.length} lentilles (${LENTILLES.map((l) => l.label).join(', ')})${COMPAGNONS.length ? '' : ' — aucun compagnon fourni, la lentille des compagnons ne joue pas'}.`)

const lectures = await parallel(lecteurs.map(([l, lancer]) => () => capturer(lancer).then((appel) => ({ label: l.label, ...appel }))))
const parLentille = Object.fromEntries(lectures.filter((l) => l.rendu).map((l) => [l.label, l.rendu]))
const mortes = lectures.filter((l) => !l.rendu)
if (mortes.length) log(`Lecture : ${mortes.length} lentille(s) sans rendu — ${mortes.map((l) => `${l.label} (${l.cause})`).join(', ')} ; leurs familles MANQUENT à la fiche et le juge de complétude le sait.`)

/** La lentille qui lit chaque famille. */
const lentilleDe = Object.fromEntries(TOUTES_LES_LENTILLES.flatMap((l) => l.familles.map((f) => [f, l.label])))
/** L'id `<préfixe><rang>` d'une entrée NEUVE de la famille, posé par le script. */
const idSuivant = (famille, liste) => `${FAMILLES[famille].prefixe}${liste.length + 1}`
/** Les entrées de chaque famille, chacune sous son id — une lentille morte laisse ses familles vides. */
const entrees = Object.fromEntries(NOMS_DE_FAMILLE.map((f) => [f, []]))
for (const f of NOMS_DE_FAMILLE) {
  for (const e of (parLentille[lentilleDe[f]] || {})[f] || []) entrees[f].push({ id: idSuivant(f, entrees[f]), ...e })
}

// ── Complétude : schéma FERMÉ sur les ids de la fiche et la forme de chaque attribut (#2721) ─
/** Ce qu'un contenu faux corrige, par famille : TOUS les attributs de son entrée, chacun à sa forme, hors
 *  `ref` (réf fausse) — `id` n'est pas un attribut d'entrée, le script le pose. */
const ATTRIBUTS_CORRIGEABLES = Object.fromEntries(NOMS_DE_FAMILLE.map((f) => [f, Object.fromEntries(Object.entries(ENTREES[f].properties)
  .filter(([nom]) => nom !== 'ref'))]))
/** Les familles qui ont des entrées : seules elles se corrigent, chacune sous les ids que le script a posés. */
const FAMILLES_PEUPLEES = NOMS_DE_FAMILLE.filter((f) => entrees[f].length)
const idsDe = (famille) => ({ enum: entrees[famille].map((e) => e.id), description: `Un id de la famille ${famille} de la fiche.` })
/** Une réf fausse par famille peuplée : son id dans la famille, ses réfs à la forme des réfs de la famille. */
const BRANCHES_DE_REF_FAUSSE = FAMILLES_PEUPLEES.map((f) => ({
  type: 'object', additionalProperties: false,
  properties: { famille: { enum: [f] }, id: idsDe(f), ref: ENTREES[f].properties.ref, motif: { type: 'string', description: 'Ce que dit la ligne citée.' } },
  required: ['famille', 'id', 'ref', 'motif'],
}))
/** Un contenu faux par (famille peuplée, attribut) : la valeur à la forme de CET attribut. */
const BRANCHES_DE_CONTENU_FAUX = FAMILLES_PEUPLEES.flatMap((f) => Object.entries(ATTRIBUTS_CORRIGEABLES[f]).map(([attribut, forme]) => ({
  type: 'object', additionalProperties: false,
  properties: {
    famille: { enum: [f] }, id: idsDe(f), attribut: { enum: [attribut] }, valeur: forme,
    ref: { type: 'string', pattern: '\\S', description: 'La réf nue de la ligne qui prouve la valeur corrigée.' },
  },
  required: ['famille', 'id', 'attribut', 'valeur', 'ref'],
})))
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
      items: BRANCHES_DE_REF_FAUSSE.length ? { anyOf: BRANCHES_DE_REF_FAUSSE } : {},
      maxItems: BRANCHES_DE_REF_FAUSSE.length ? undefined : 0,
    },
    contenusFaux: {
      type: 'array',
      items: BRANCHES_DE_CONTENU_FAUX.length ? { anyOf: BRANCHES_DE_CONTENU_FAUX } : {},
      maxItems: BRANCHES_DE_CONTENU_FAUX.length ? undefined : 0,
    },
    synthese: {
      type: 'object', additionalProperties: false,
      properties: { markdown: { type: 'string' } },
      required: ['markdown'],
    },
  },
  required: ['oublis', 'refsFausses', 'contenusFaux', 'synthese'],
}

/** La cible d'une correction, nommée : une cible ne se corrige qu'une fois. */
const cibleDeRef = (r) => `réf fausse « ${r.famille}:${r.id} »`
const cibleDeContenu = (c) => `contenu faux « ${c.famille}:${c.id}.${c.attribut} »`
/** Les corrections d'un rendu du juge qui visent une cible qu'une correction précédente du même rendu vise déjà. */
const anomaliesDeCompletude = (rendu) => {
  const vues = new Set()
  const anomalies = []
  for (const cible of [...rendu.refsFausses.map(cibleDeRef), ...rendu.contenusFaux.map(cibleDeContenu)]) {
    if (vues.has(cible)) anomalies.push(`${cible} : cible déjà corrigée`)
    vues.add(cible)
  }
  return anomalies
}

const PROMPT_DE_COMPLETUDE = `Tu JUGES la complétude d'un dossier de chapitre. Relis le chapitre au Source/ par toi-même : la fiche ci-dessous est ce que tu RÉFUTES, jamais une source.
${CADRE}
${CHAPITRE_LU}
${COMPAGNONS.length ? `Compagnons puisés : ${COMPAGNONS.join(' · ')}` : 'Aucun compagnon fourni.'}
${mortes.length ? `Lentilles SANS rendu : ${mortes.map((l) => l.label).join(', ')} — leurs familles sont vides, relève ce qu'elles auraient dû porter.` : ''}

FICHE (chaque entrée porte son \`id\`, posé par le script) :
${JSON.stringify(entrees, null, 1)}

Tes corrections, le script les APPLIQUE à la fiche — chacune vise une famille et un id de la fiche, jamais un texte :
- \`oublis.<famille>\` : chaque entrée que le livre porte et que la fiche omet, COMPLÈTE, à la forme de sa famille ; le script pose son id.
- \`refsFausses\` : l'entrée (\`famille\`, \`id\`) dont une ligne citée ne dit pas ce qu'elle lui fait dire ; \`ref\` = ses réfs CORRIGÉES, entières, \`motif\` = ce que dit la ligne citée.
- \`contenusFaux\` : l'entrée (\`famille\`, \`id\`) dont un attribut dit autre chose que le livre, classement compris (statut d'un beat, type d'un point au MJ, nature d'un texte, sens et portée d'un état) ; \`attribut\` parmi ceux de sa famille — ${Object.entries(ATTRIBUTS_CORRIGEABLES).map(([famille, attributs]) => `${famille} : ${Object.keys(attributs).join(', ')}`).join(' ; ')} —, \`valeur\` = la valeur CORRIGÉE, entière et à la forme de l'attribut, \`ref\` = la réf nue qui la prouve.
Une cible (une réf, ou un attribut d'une entrée) ne se corrige qu'UNE fois.
Rends \`synthese.markdown\` : la fiche en une page — impératifs, beats et leurs médias candidats, états produits et lus, corrections.`

const completude = await appelValide(PROMPT_DE_COMPLETUDE, (prompt, essai) => agent(prompt,
  { label: essai ? `completude:renvoi${essai}` : 'completude', phase: 'Complétude', schema: COMPLETUDE, agentType: 'juge-de-source', model: 'opus', effort: 'high' }),
anomaliesDeCompletude)

// ── Application des corrections ──────────────────────────────────────────────────────────────
const corrections = []
/** L'entrée visée : le schéma du juge ne nomme que des ids de la fiche, uniques dans leur famille. */
const entreeVisee = (famille, id) => entrees[famille].find((e) => e.id === id)
if (completude.rendu) {
  const appliquees = new Set()
  const premiere = (cible) => {
    const neuve = !appliquees.has(cible)
    appliquees.add(cible)
    return neuve
  }
  for (const r of completude.rendu.refsFausses) {
    if (!premiere(cibleDeRef(r))) continue
    const e = entreeVisee(r.famille, r.id)
    corrections.push({ type: 'ref-fausse', famille: r.famille, id: r.id, avant: e.ref, apres: r.ref, motif: r.motif })
    e.ref = r.ref
  }
  for (const c of completude.rendu.contenusFaux) {
    if (!premiere(cibleDeContenu(c))) continue
    const e = entreeVisee(c.famille, c.id)
    corrections.push({ type: 'contenu-faux', famille: c.famille, id: c.id, attribut: c.attribut, avant: e[c.attribut], apres: c.valeur, ref: c.ref })
    e[c.attribut] = c.valeur
  }
  for (const f of NOMS_DE_FAMILLE) {
    for (const oubli of completude.rendu.oublis[f]) {
      const entree = { id: idSuivant(f, entrees[f]), ...oubli }
      entrees[f].push(entree)
      corrections.push({ type: 'oubli', famille: f, id: entree.id, entree })
    }
  }
}

const agents = { lecture: LENTILLES.length, completude: 1 + completude.renvois, total: LENTILLES.length + 1 + completude.renvois }
if (!completude.rendu) log(`Complétude : le juge n’a rien rendu (${completude.cause}) — la fiche est rendue SANS relecture de complétude.`)
if (completude.renvois) log(`Complétude : ${completude.renvois} renvoi(s) au juge pour correction(s) inapplicable(s) ; ${completude.anomalies.length} restée(s).`)
if (completude.anomalies.length) log(`Complétude : ${completude.anomalies.length} correction(s) INAPPLICABLE(S) — ${completude.anomalies.join(' · ')}.`)
log(`Fiche : ${NOMS_DE_FAMILLE.map((f) => `${entrees[f].length} ${f}`).join(', ')} ; ${corrections.length} correction(s) appliquée(s) (${['oubli', 'ref-fausse', 'contenu-faux'].map((t) => `${corrections.filter((c) => c.type === t).length} ${t}`).join(', ')}), ${completude.anomalies.length} inapplicable(s) ; ${agents.total} agents joués.`)
/** Les TROUS du run, par espèce, chacune sous le verdict qui la nomme, dans l'ordre où elles le priment :
 *  DOSSIER ne se rend que si toutes sont vides. Chaque trou d'agent nomme sa cause. */
const trous = [
  { espece: 'lentillesSansRendu', verdict: 'LECTURE INCOMPLÈTE', liste: mortes.map((l) => `${l.label} — ${l.cause}`) },
  { espece: 'completudeSansRendu', verdict: 'DOSSIER SANS COMPLÉTUDE', liste: completude.rendu ? [] : [`completude — ${completude.cause}`] },
  { espece: 'anomaliesDeCorrection', verdict: 'CORRECTIONS INAPPLICABLES', liste: completude.anomalies },
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
  synthese_markdown: completude.rendu ? completude.rendu.synthese.markdown : '',
  agents,
}
