/**
 * Génère docs/hote-texte.md — l'hôte texte du noyau (#2898) : recetter une règle sans navigateur.
 * La part FACTUELLE est DÉRIVÉE du code, par l'AST TypeScript, fail-fast si une constante disparaît :
 *  - les commandes (`COMMANDES`, src/hoteTexte/cli.ts) ;
 *  - les bornes de sortie (`BORNES`, src/hoteTexte/vue.ts) ;
 *  - la provenance de chaque champ de la projection (`PROVENANCE`, src/hoteTexte/vue.ts) ;
 *  - les catégories d'erreur (`CategorieDErreur`), la version du format (`VERSION_DU_FORMAT`) et le plafond de
 *    reprises (`PLAFOND_DE_REPRISES`), src/hoteTexte/partieTexte.ts.
 * La part ÉDITORIALE (l'usage par un agent, le fichier de partie, la politique des jetons, les budgets de temps
 * mesurés) vit ICI, en dur — patron « éditorial EN DUR dans le générateur » de build-reprise.mjs.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-hote-texte.mjs
 */
import { readFileSync } from 'node:fs'
import { ast, typescript } from '../guards/lib/dialecte.mjs'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'

const OUTIL = 'build-hote-texte'
const OUT = 'docs/hote-texte.md'
const CLI = 'src/hoteTexte/cli.ts'
const VUE = 'src/hoteTexte/vue.ts'
const COEUR = 'src/hoteTexte/partieTexte.ts'

function abandon(msg) {
  throw new Error(`${OUTIL} — ${msg}`)
}

/** Les déclarations de premier niveau d'un fichier, par nom. */
function declarations(rel) {
  const ts = typescript()
  const sf = ast({ rel, text: readFileSync(rel, 'utf8') })
  const parNom = new Map()
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) parNom.set(d.name.text, d)
    if (ts.isTypeAliasDeclaration(st)) parNom.set(st.name.text, st)
  }
  return parNom
}

/** La valeur d'une expression LITTÉRALE (objet, tableau, chaîne, nombre, `as const`) ; toute autre forme abandonne. */
function litteral(noeud, ou) {
  const ts = typescript()
  if (ts.isAsExpression(noeud) || ts.isSatisfiesExpression(noeud) || ts.isParenthesizedExpression(noeud)) return litteral(noeud.expression, ou)
  if (ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud)) return noeud.text
  if (ts.isNumericLiteral(noeud)) return Number(noeud.text.replaceAll('_', ''))
  if (ts.isArrayLiteralExpression(noeud)) return noeud.elements.map((e) => litteral(e, ou))
  if (ts.isObjectLiteralExpression(noeud)) {
    return Object.fromEntries(noeud.properties.map((p) => {
      if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) abandon(`${ou} : propriété non littérale`)
      return [p.name.text, litteral(p.initializer, ou)]
    }))
  }
  return abandon(`${ou} : expression non littérale (${ts.SyntaxKind[noeud.kind]})`)
}

/** La valeur littérale de la constante `nom` de `rel`. */
function constante(rel, nom) {
  const d = declarations(rel).get(nom)
  if (!d?.initializer) abandon(`constante \`${nom}\` introuvable dans ${rel} (renommée/supprimée ?)`)
  return litteral(d.initializer, `${rel} \`${nom}\``)
}

/** Les membres chaîne de l'union `nom` de `rel`. */
function unionDeChaines(rel, nom) {
  const ts = typescript()
  const d = declarations(rel).get(nom)
  if (!d || !ts.isTypeAliasDeclaration(d) || !ts.isUnionTypeNode(d.type)) abandon(`union \`${nom}\` introuvable dans ${rel}`)
  return d.type.types.map((t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? t.literal.text : abandon(`${nom} : membre non chaîne`)))
}

/** Un entier, ses milliers séparés par une espace (sans locale : le rendu ne dépend pas de la machine). */
const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const cellule = (s) => String(s).replaceAll('|', '\\|')

/** Le cas de chaque catégorie d'erreur (prose fixe), vérifié contre l'union du code. */
const CAS_D_ERREUR = {
  validation: 'commande, option ou JSON illisible ; scénario, offre ou verbe inconnu ; intention hors de l’allowlist d’un siège ; verbe qui lève ; ligne du fichier qui ne se rejoue plus',
  permission: 'intention de siège refusée : le siège ne possède pas ce combattant',
  regle: 'barre non ouverte (`etatDeLaBarre`, avec sa raison) ; offre que l’énumérateur ne rend pas (gate de pertinence, aucun candidat) ; offre fermée (`actionGate`, avec sa raison)',
}

/** Les budgets de temps mesurés (prose fixe, datée) : le coût d'un appel et celui du rejeu par scénario. */
const BUDGETS_DE_TEMPS = [
  ['appel (chargement du module runner)', '9 à 10 s par appel, mesuré le 2026-10-21 sur 4 cœurs ; ticket #2912 (« Hôte texte : un chargement en moins d’une seconde par appel »)'],
  ['`pastilles-entite`, 8 gestes', '109 ms de rejeu, mesuré par le juge du lot B le 2026-10-21'],
  ['`siege-enceinte`, 50 gestes', '5,7 s de rejeu, mesuré par le juge du lot B le 2026-10-21'],
]

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const commandes = constante(CLI, 'COMMANDES')
  const bornes = constante(VUE, 'BORNES')
  const provenance = constante(VUE, 'PROVENANCE')
  const categories = unionDeChaines(COEUR, 'CategorieDErreur')
  const version = constante(COEUR, 'VERSION_DU_FORMAT')
  const plafond = constante(COEUR, 'PLAFOND_DE_REPRISES')
  const sansCas = categories.filter((c) => !CAS_D_ERREUR[c])
  if (sansCas.length) abandon(`catégorie(s) d'erreur sans cas décrit : ${sansCas.join(', ')}`)
  const enTrop = Object.keys(CAS_D_ERREUR).filter((c) => !categories.includes(c))
  if (enTrop.length) abandon(`cas décrit(s) pour une catégorie absente du code : ${enTrop.join(', ')}`)

  let out = `# Hôte texte : recetter une règle sans navigateur\n\n`
  out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-hote-texte.mjs\` (\`npm run docs:hote-texte\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Sources : \`COMMANDES\` (\`${CLI}\`), \`BORNES\` et \`PROVENANCE\` (\`${VUE}\`), \`CategorieDErreur\` (\`${COEUR}\`).\n\n`
  out += `L'hôte texte (#2898, « Hôte texte du noyau : une partie pilotable sans interface graphique, pour la recette par agent ») joue une partie du noyau en ligne de commande, sans store, sans écran et sans navigateur. Un agent y déroule un combat d'un scénario de test et confronte chaque nombre au livre ; la même partie se rejoue sous CI. Il n'importe que la surface du noyau (\`src/noyau/index.ts\`), les scénarios de test (\`src/scenes/\`) et les feuilles : la ligne \`hoteTexte\` de la table \`COUCHES\` (\`scripts/guards/lib/couches.mjs\`) le tient, sa porte vers le noyau comprise, et la garde \`src/noyau/surface-fermeture-guard.test.ts\` mesure que sa fermeture n'atteint ni \`state\`, ni \`ui\`, ni \`gameIso\`, ni \`web\`.\n\n`

  out += `**Périmètre mesuré / angles morts** — ce doc lit, par l'AST TypeScript, les constantes de l'hôte (commandes, bornes, provenance, catégories d'erreur, version, plafond de reprises). Il ne mesure NI que la vue respecte ses bornes (le test \`src/hoteTexte/bornes.hors-store.test.ts\` le fait), NI que chaque lecteur de la provenance est bien celui qu'appelle la projection (la table est écrite à côté de \`projeter\`), NI les budgets de temps, qui sont des mesures datées.\n\n`
  out += `## Usage par un agent\n\nUne commande par appel ; chaque appel rejoue le fichier de partie, puis répond.\n\n`
  out += '```bash\n'
  out += 'npm run -s hote-texte -- --partie <fichier.jsonl> nouvelle dome --graine 7\n'
  out += 'npm run -s hote-texte -- --partie <fichier.jsonl> jouer confirmRoundStart\n'
  out += 'npm run -s hote-texte -- --partie <fichier.jsonl> vue\n'
  out += 'npm run -s hote-texte -- --partie <fichier.jsonl> offre charge\n'
  out += 'npm run -s hote-texte -- --partie <fichier.jsonl> jouer battleClickEntity \'["enemy-enc-dome-1"]\'\n'
  out += '```\n\n'
  out += `| Commande | Rendu |\n|---|---|\n`
  for (const [forme, rendu] of commandes) out += `| \`${cellule(forme)}\` | ${cellule(rendu)} |\n`
  out += `\n\`--json\` vaut pour toutes les commandes : la sortie est la projection (\`Projection\`, \`${VUE}\`) et l'empreinte de l'état, bornée comme le texte, jamais les payloads bruts des événements. Une offre (\`offre\`) est une entrée de l'énumérateur du registre (\`offresDeLActif\`), celui que lit la barre de la console ; \`ctx\` porte les paramètres de la case (\`targetId\`, \`spellId\`, \`attackId\`…), \`offres <id>\` les montre. Un verbe brut (\`jouer\`) sert aux fenêtres (\`attackRoll\`, \`defenseConfirm\`…), à la cascade (\`cascadeNext\`, \`cascadeChoose\`), à la pause de Round (\`confirmRoundStart\`) et aux clics du champ (\`battleClickTile\`, \`battleClickEntity\`) ; la ligne « fenêtre » de la vue nomme les verbes de la fenêtre qui tient la main.\n\n`
  out += `Le clic implicite du champ suit le modèle du web : un premier \`battleClickEntity\` ou \`battleClickTile\` pose l'aperçu, le second le confirme. Une offre qui arme une intention (\`charge\`, \`course\`, \`attaque\`) se lit à la ligne « intention armée » de la vue ; le clic suivant la commet.\n\n`

  out += `## Le fichier de partie\n\nLe fichier JSONL est la vérité de la partie. Sa première ligne est l'en-tête, en version ${version} du format :\n\n`
  out += '```json\n'
  out += `{"version":${version},"scenario":"dome","graine":7,"regles":{},"cadence":"manuel","desFixes":false}\n`
  out += '```\n\n'
  out += `\`regles\` sont les règles maison chargées à la création de la partie ; les règles du scénario se posent ensuite, au lancement. Chaque ligne suivante est un geste appliqué : \`{"offre":"charge","ctx":{…}}\` ou \`{"type":"attackRoll","args":[],"siege":0}\`. Un geste en erreur ne s'écrit pas. Le fichier se relit, se copie et se tronque à la main : la partie est ce qu'il rejoue. Exemple committé, rejoué sous CI : \`src/hoteTexte/combat-dome.jsonl\`.\n\n`

  out += `## Les jetons\n\nLe noyau programme ses beats différés (tours de l'IA, tick de la cadence auto) par la plateforme de la partie. Après chaque appel, l'hôte reprend tous les jetons programmés, par échéance puis par ordre d'arrivée, sur une horloge virtuelle, jusqu'à ce qu'il n'en reste aucun ; ceux du lancement sont repris avant la première ligne. Une réponse dit combien de jetons ont été repris. Au-delà de ${milliers(plafond)} reprises après un même appel, l'hôte lève : la partie boucle.\n\n`

  out += `## Les erreurs\n\nUne erreur sort en \`erreur <catégorie> : <message>\` (en JSON : \`{"erreur":{"categorie","message"}}\`), avec le code de sortie 1, et le fichier reste intact.\n\n`
  out += `| Catégorie | Cas |\n|---|---|\n`
  for (const c of categories) out += `| \`${c}\` | ${cellule(CAS_D_ERREUR[c])} |\n`
  out += `\nUn geste appliqué que le noyau refuse au joueur pose un refus (\`refus\`) : la réponse le dit (« refus : … »), la vue garde le dernier, et le geste s'écrit. Un refus neuf se lit au changement de son \`nonce\`.\n\n`

  out += `## Provenance de la vue\n\nAucune règle ne se calcule dans l'hôte : chaque champ est un lecteur de la surface du noyau, ou un champ de l'état lu tel quel.\n\n`
  out += `| Champ | Lecteur |\n|---|---|\n`
  for (const [champ, lecteur] of provenance) out += `| \`${cellule(champ)}\` | ${cellule(lecteur)} |\n`

  out += `\n## Bornes\n\nToute ligne tient en ${bornes.largeur} caractères au plus ; au-delà de ses lignes, une sortie dit « +N lignes ». Les caractères au plus d'une sortie texte valent ses lignes × ${bornes.largeur + 1} (\`caracteresAuPlus\`).\n\n`
  out += `| Sortie | Lignes au plus |\n|---|---|\n`
  for (const [commande, n] of Object.entries(bornes.lignes)) out += `| \`${commande}\` | ${n} |\n`
  out += `\n- \`--json\` : ${milliers(bornes.json)} caractères au plus ; ses listes sont celles de la vue, comptées au-delà.\n`
  out += `- La vue liste l'actif, ses engagés, puis ${bornes.autresEnVue} autres combattants au plus, par distance ; ${bornes.offresEnVue} offres ouvertes au plus (une par action, ses candidats comptés) ; ${bornes.ciblesEnVue} cibles au plus.\n`
  out += `- Une réponse montre ${bornes.journalEnReponse} lignes de journal au plus, puis « +N lignes : \`journal --depuis k\` » ; un tour de l'IA tient en une ligne.\n`
  out += `- \`journal\`, \`carte\` et \`offres\` se lisent par pages de ${bornes.page}, \`--depuis k\`.\n\n`

  out += `## Budgets de temps\n\n| Mesure | Budget |\n|---|---|\n`
  for (const [mesure, budget] of BUDGETS_DE_TEMPS) out += `| ${mesure} | ${budget} |\n`
  out += `\nLa recette et la CI jouent un scénario bref.\n\n`

  out += `## Le chargement\n\n\`scripts/hote-texte.mjs\` charge, dans un seul graphe de modules, le gel du catalogue (\`src/data/overrides.ts\`) puis l'entrée de l'hôte (\`${CLI}\`), par \`runnerImport\` de Vite avec le greffon \`proseSource()\` : la porte de la suite du noyau (\`vitest.noyau.config.ts\`), où \`import.meta.env.DEV\` est vrai. Une partie par processus : les singletons de module du noyau (uids, intention locale, règles) n'admettent pas deux parties dans un même contexte JS.\n`

  return {
    out,
    path: OUT,
    staleMsg: `docs:hote-texte — ${OUT} est PÉRIMÉ (diverge de ${CLI}, ${VUE} ou ${COEUR}).`,
    rerunMsg: '  → relancer `npm run docs:hote-texte` (dérivé jamais commité, #2203).',
    okMsg: `docs:hote-texte — OK (${OUT} à jour, ${commandes.length} commandes)`,
    writeMsg: `${OUT} — ${commandes.length} commandes, ${provenance.length} champs, ${categories.length} catégories d'erreur.`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })
