/**
 * Génère docs/hote-texte.md — l'hôte texte du noyau (#2898) : une partie jouée par un serveur MCP, sans navigateur.
 * La part FACTUELLE est DÉRIVÉE du code, fail-fast si une constante disparaît :
 *  - les instructions du serveur, la description et le schéma de chaque outil (`INSTRUCTIONS`, `outils`,
 *    src/hoteTexte/outils.ts, importés : la même source que le serveur) ;
 *  - les bornes de sortie (`BORNES`, src/hoteTexte/vue.ts), par l'AST TypeScript ;
 *  - les catégories d'erreur (`CategorieDErreur`) et le plafond de reprises de l'horloge virtuelle
 *    (`PLAFOND_DE_REPRISES`), src/hote/partie.ts ; les cadences (`CADENCE_MODES`, src/engine/cadence.ts) ;
 *  - les verbes de la partie et la forme de leurs arguments, lus du type du noyau par le vérificateur
 *    (`verbesDeLaPartie`, scripts/docs/lib/verbesDeLaPartie.mjs), écrits par `parametresEcrits` (src/hote/formes.ts) :
 *    la même lecture que celle de la cible de code `src/hote/verbes.generated.ts` (scripts/gen-verbes.mjs), qui
 *    contrôle les arguments de `jouer`.
 * La part ÉDITORIALE (la provenance de chaque champ de la projection, le branchement, le fichier de partie, la politique
 * des jetons, les budgets de temps mesurés) vit ICI, en dur — patron « éditorial EN DUR dans le générateur » de
 * build-reprise.mjs. Aucun nom de verbe n'y est écrit : la table des verbes les dérive.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-hote-texte.mjs
 */
import { readFileSync } from 'node:fs'
import { ast, typescript } from '../guards/lib/dialecte.mjs'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'
import { verbesDeLaPartie } from './lib/verbesDeLaPartie.mjs'
import { parametresEcrits } from '../../src/hote/formes.ts'
import { DOSSIER_DES_PARTIES, GESTES_PAR_APPEL, INSTRUCTIONS, outils } from '../../src/hoteTexte/outils.ts'
import { z } from 'zod'

const OUTIL = 'build-hote-texte'
const OUT = 'docs/hote-texte.md'
const OUTILS = 'src/hoteTexte/outils.ts'
const CADENCE = 'src/engine/cadence.ts'
const VUE = 'src/hoteTexte/vue.ts'
const PROJECTION = 'src/hote/projection.ts'
const COMMUN = 'src/hote/partie.ts'

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

/** La PROVENANCE de chaque champ de la projection (`projeter`, src/hote/projection.ts) : le lecteur du noyau qui le rend. */
const PROVENANCE = [
  ['combat.round, combat.tour, combat.fin', 'battle.round, battle.turn, battle.over'],
  ['combat.actif', 'activeCombatant'],
  ['combat.actif.mouvement', 'mouvementDuTour (le restant et le total que la jauge de la console montre)'],
  ['combat.actif.action', 'battle.acted'],
  ['combat.voisins, carte : distance', 'combatDistance (empreinte et relief, comme le ciblage)'],
  ['combat.voisins, carte : engagé', 'Combatant.engagedWith'],
  ['fenetre', 'fenetreDuJeu (et stepInteraction pour l’étape de cascade)'],
  ['fenetre.verbes, fenetre.pid', 'fenetreDuJeu : le drive de la politique (JET_AUTO, MODAL_DEFS), les verbes du flux de jet (FLOW_VERBS) et ses réglages (FENETRE_DU_JET.reglages), ceux du flux réactif ouvert (FENETRE_DU_JET.reactives), ceux de l’interaction d’étape, les clôtures de la cascade ; pid = l’id de l’étape courante'],
  ['jets', 'jetsEnVue : les lignes de jet de la fenêtre (Test, table, dé), jetées ou à jeter, la gagnante et le DR net d’un Test opposé (netSL, le badge « DR net » du web)'],
  ['combat.apercu', 'battle.preview (l’aperçu du premier clic)'],
  ['cases', 'porteesDuTour (displayedReach, computeRunReach, intentReach : la surbrillance du champ)'],
  ['exploration.entites, carte hors combat', 'Scene.entities'],
  ['combat.barre', 'etatDeLaBarre (le verdict que lit la console)'],
  ['combat.offres', 'offresDeLActif (l’énumération que lit la console)'],
  ['combat.cibles', 'validTargets'],
  ['combat.finDeTourArmee', 'endTurnArmed'],
  ['exploration.gestes, offres hors combat', 'gestesDExploration (aretesUtilisables offertes comme à l’écran, atterrissagesDeSaut, déclencheurs à transition, exploreMovePlan écrit par gesteDuPas)'],
  ['exploration.etage, exploration.cap', 'partyPos.z, capDuGroupe'],
  ['jouer : levé', 'Jeu.localIntent, battle.preview, endTurnArmed, lus avant et après chaque geste'],
  ['erreur permission', 'quiTientLaMain, siegeDe'],
  ['fiche : armure', 'effectiveArmourAt, par LOCALISATIONS_DE_COUP'],
  ['refus', 'Jeu.refus (texte et nonce)'],
]

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
  validation: 'aucune partie de ce nom, ou aucune ouverte ; offre ou verbe inconnu (le refus nomme les verbes de la fenêtre et les voisins de nom) ; argument d’une forme fausse, en trop ou manquant (contrôlé contre le type du verbe) ; id que l’état ne désigne pas (le refus nomme les ids valides) ; champ du contexte d’une offre que ni elle ni ses candidats ne lisent ; intention hors de l’allowlist d’un siège ; verbe qui lève ; ligne du fichier qui ne se rejoue plus',
  permission: 'intention de siège refusée : le siège ne possède pas ce combattant ; partie tenue par un autre serveur de l’hôte (le refus nomme son processus)',
  regle: 'barre non ouverte (`etatDeLaBarre`, avec sa raison) ; offre que l’énumérateur ne rend pas (gate de pertinence, aucun candidat) ; offre fermée (`actionGate`, avec sa raison) ; geste sans effet : ni fait de la partie changé, ni suite programmée (avec le refus, la ligne de journal ou l’événement qu’il a reçus)',
}

/** Les budgets de temps mesurés (prose fixe, datée) : le coût d'un appel et celui du rejeu par scénario. */
const BUDGETS_DE_TEMPS = [
  ['chargement du serveur (module runner de Vite)', 'environ 8 s de processeur, une fois par session, mesuré le 2026-10-21 sur 4 cœurs'],
  ['appel d’outil, partie en mémoire', '3 à 150 ms, mesuré le 2026-10-21 (`fenetre-ecuries`, `dome`)'],
  ['`pastilles-entite`, 8 gestes', '109 ms de rejeu, mesuré par le juge du lot B le 2026-10-21'],
  ['`siege-enceinte`, 50 gestes', '5,7 s de rejeu, mesuré par le juge du lot B le 2026-10-21'],
]

/** Une valeur JSON Schema en une cellule : son type, ses valeurs énumérées, ses bornes. */
function typeEcrit(js) {
  if (js.enum) return js.enum.length > 8 ? `un de ${js.enum.length} ids` : js.enum.map((v) => JSON.stringify(v)).join(' | ')
  if (js.anyOf) return js.anyOf.map(typeEcrit).join(' ou ')
  if (js.type === 'array') return `tableau de ${js.items ? typeEcrit(js.items) : 'valeurs'}${js.maxItems ? ` (${js.minItems ?? 0} à ${js.maxItems})` : ''}`
  if (js.type === 'object') return js.properties ? `{${Object.keys(js.properties).map((k) => `${k}${js.required?.includes(k) ? '' : '?'}`).join(', ')}}` : 'objet'
  if (js.pattern) return `nom (${js.pattern})`
  return js.type ?? 'valeur'
}

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const bornes = constante(VUE, 'BORNES')
  const categories = unionDeChaines(COMMUN, 'CategorieDErreur')
  const plafond = constante(COMMUN, 'PLAFOND_DE_REPRISES')
  const cadences = constante(CADENCE, 'CADENCE_MODES')
  const definitions = outils({ scenarios: null, cadences })
  const verbes = verbesDeLaPartie()
  const sansCas = categories.filter((c) => !CAS_D_ERREUR[c])
  if (sansCas.length) abandon(`catégorie(s) d'erreur sans cas décrit : ${sansCas.join(', ')}`)
  const enTrop = Object.keys(CAS_D_ERREUR).filter((c) => !categories.includes(c))
  if (enTrop.length) abandon(`cas décrit(s) pour une catégorie absente du code : ${enTrop.join(', ')}`)

  let out = `# Hôte texte : le noyau joué par MCP, sans navigateur\n\n`
  out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-hote-texte.mjs\` (\`npm run docs:hote-texte\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Sources : \`INSTRUCTIONS\` et \`outils\` (\`${OUTILS}\`), \`BORNES\` (\`${VUE}\`), \`CategorieDErreur\` et \`PLAFOND_DE_REPRISES\` (\`${COMMUN}\`).\n\n`
  out += `L'hôte texte (#2898, « Hôte texte du noyau : une partie pilotable sans interface graphique, pour la recette par agent ») joue une partie du noyau sans store, sans écran et sans navigateur, servie par un serveur MCP sur stdio : un agent y déroule un scénario de test, et la même partie se rejoue sous CI. Il n'importe que la surface du noyau (\`src/noyau/index.ts\`), les scénarios de test (\`src/scenes/\`), le module commun des hôtes (\`src/hote/\` : contrôle des arguments, scénario par id, jetons, projection) et les feuilles : la ligne \`hoteTexte\` de la table \`COUCHES\` (\`scripts/guards/lib/couches.mjs\`) le tient, sa porte vers le noyau comprise : une zone qui survit à la bascule (\`survit\`), qui n'ouvre que des zones qui survivent et ne charge aucun paquet de l'hôte web ; sa fermeture n'atteint ni \`state\`, ni \`ui\`, ni \`gameIso\`, ni \`web\`. Il dérive du noyau tout ce qu'il nomme : les verbes et leurs arguments (\`ActionsDuNoyau\`), les fenêtres et leurs verbes (\`fenetreDuJeu\`) ; un verbe neuf du noyau se joue sans toucher à l'hôte, et la garde \`src/hote/derive-du-noyau.hors-store.test.ts\` refuse un verbe ou une fenêtre nommé en dur dans le code des hôtes.\n\n`
  out += `**Périmètre mesuré / angles morts** — ce doc lit les outils (importés de \`${OUTILS}\`) et, par l'AST TypeScript, les constantes de l'hôte (bornes, catégories d'erreur, plafond de reprises). Il ne mesure NI que la vue respecte ses bornes (le test \`src/hoteTexte/bornes.hors-store.test.ts\` le fait), NI que chaque lecteur de la provenance est bien celui qu'appelle la projection (la table est écrite dans ce générateur), NI les budgets de temps, qui sont des mesures datées.\n\n`

  out += `## Brancher le serveur\n\n\`.mcp.json\` déclare le serveur \`hote-texte\` (\`node scripts/hote-texte.mjs\`) aux sessions ouvertes dans le dépôt ; ses outils s'y appellent \`mcp__hote-texte__nouvelle\`, \`mcp__hote-texte__lire\` et \`mcp__hote-texte__jouer\`. Hors d'une session du dépôt : \`claude -p --mcp-config .mcp.json\`. Le serveur se charge une fois par session ; chaque appel joue ensuite sur la partie en mémoire.\n\n`
  out += `Les instructions que le serveur donne à l'ouverture :\n\n${INSTRUCTIONS.split('\n').map((l) => `> ${l}`).join('\n>\n')}\n\n`

  out += `## Les outils\n\n`
  for (const [nom, { description, schema }] of Object.entries(definitions)) {
    const js = z.toJSONSchema(z.object(schema))
    out += `### \`${nom}\`\n\n${description.split('\n').join('\n\n')}\n\n| Entrée | Forme | Rôle |\n|---|---|---|\n`
    for (const [cle, prop] of Object.entries(js.properties)) out += `| \`${cle}\`${js.required?.includes(cle) ? '' : '?'} | ${cellule(typeEcrit(prop))} | ${cellule(prop.description ?? '')} |\n`
    out += '\n'
  }
  out += `Une réponse est un texte borné (\`content\`), rien d'autre : un client MCP qui reçoit des données structurées les montre à l'agent à la place du texte, hors de ses bornes (mesuré le 2026-10-21 sur Claude Code 2.1.306). Le texte lit la projection (\`Projection\`, \`${PROJECTION}\`), jamais les payloads bruts des événements. Une réponse de \`jouer\` dit les gestes appliqués et les jetons repris, puis le journal de la suite, condensé, puis la vue d'après. Une offre (\`offre\`) est une entrée de l'énumérateur du registre (\`offresDeLActif\`), celui que lit la barre de la console ; \`ctx\` porte les paramètres de la case (\`targetId\`, \`spellId\`, \`attackId\`…), \`lire\` \`{"quoi":"offres","id":…}\` les montre. Un verbe sert aux fenêtres, à la cascade, à la pause de Round, aux clics du champ et à l'exploration : la ligne « verbes » de la vue donne la signature de ceux de la fenêtre qui tient la main, à chaque étape de cascade comprise, et l'id d'étape que leur paramètre \`pid\` attend. Le scénario se nomme par son id ; toutes ses scènes sont chargées au lancement.\n\n`
  out += `Le clic implicite du champ suit le modèle du web : un premier clic sur une case ou une entité pose l'aperçu, le second le confirme. Une offre qui arme une intention (une Charge, une Course) se lit à la ligne « intention armée » de la vue ; le clic suivant la commet. L'aperçu d'un premier clic se lit à la ligne « aperçu » ; \`lire\` \`{"quoi":"cases"}\` liste les cases que le champ peint au tour de l'actif, avec leur coût. Les jets de la fenêtre qui tient la main se lisent aux lignes « jet <flux> », en combat comme hors combat, avant comme après le dé : un Test donne le d100 sur la valeur cible, son DR et son verdict (« à jeter » avant le dé) ; une table, le d100, la valeur lue et sa ligne (« à tirer ») ; un dé, le naturel, le total et sa lecture ; un Test opposé tranché, la ligne gagnante et le DR net. Sous \`desFixes\`, un dé se pose APRÈS le jet, par le verbe de pose de la fenêtre.\n\n`

  out += `## Le fichier de partie\n\nUne partie est un fichier JSONL, \`${DOSSIER_DES_PARTIES}/<nom>.jsonl\` à la racine du dépôt (ignoré de git ; \`HOTE_TEXTE_PARTIES\` déplace le dossier). Il est la vérité de la partie. Sa première ligne est l'en-tête :\n\n`
  out += '```json\n'
  out += `{"scenario":"dome","graine":7,"regles":{},"cadence":"manuel","desFixes":false}\n`
  out += '```\n\n'
  out += `\`regles\` sont les règles maison chargées à la création de la partie ; les règles du scénario se posent ensuite, au lancement. Chaque ligne suivante est un geste appliqué : \`{"offre":"<id d’offre>","ctx":{…}}\`, ou un verbe \`{"type":"<verbe>","args":[…],"siege":0}\`. Un geste refusé ne s'écrit pas. Le fichier se relit, se copie et se tronque à la main : la partie est ce qu'il rejoue, et le serveur rejoue un fichier changé hors de lui. Un serveur tient la partie qu'il a ouverte (\`<nom>.verrou\`, son pid et sa naissance) : un second serveur se la voit refuser tant que le premier vit. Exemple committé, rejoué sous CI : \`src/hoteTexte/combat-dome.jsonl\`. Une partie neuve remet à zéro les séquences d'ids du moteur (\`src/engine/sequences.ts\`) : deux rejeux d'un fichier dans un même processus fabriquent les mêmes ids.\n\n`

  out += `## Les jetons\n\nLe noyau programme ses beats différés (tours de l'IA, tick de la cadence auto) par la plateforme de la partie. Après chaque geste, l'hôte reprend tous les jetons programmés, par échéance puis par ordre d'arrivée, sur l'horloge virtuelle du module commun des hôtes (\`horlogeVirtuelle\`, \`${COMMUN}\`, qui les numérote dans l'ordre d'arrivée par \`tenueDesJetons\`), jusqu'à ce qu'il n'en reste aucun ; ceux du lancement sont repris avant la première ligne. Une réponse dit combien de jetons ont été repris. Au-delà de ${milliers(plafond)} reprises après un même geste, l'hôte lève : la partie boucle.\n\n`

  out += `## Les erreurs\n\nUne entrée hors du schéma d'un outil est refusée par le serveur avant l'hôte (\`Input validation error\`). Une erreur de l'hôte sort en \`erreur <catégorie> : <message>\`, l'outil en erreur (\`isError\`), et le fichier reste intact. Dans une suite de \`jouer\`, les gestes d'avant le refusé restent appliqués et écrits ; la réponse dit « geste k/n refusé », puis la vue. Un geste refusé qui a touché l'état en mémoire (son refus, une mutation en place) fait rejouer la partie depuis son fichier.\n\n`
  out += `| Catégorie | Cas |\n|---|---|\n`
  for (const c of categories) out += `| \`${c}\` | ${cellule(CAS_D_ERREUR[c])} |\n`
  out += `\nUn geste qui ne change aucun fait de la partie et ne programme aucune suite (un jeton de la plateforme) est SANS EFFET : erreur \`regle\`, avec le refus, la ligne de journal ou l'événement informatif que le noyau lui a opposés (« Saut refusé : … », \`move_blocked\`). Un événement émis seul (\`move_blocked\`, un son) informe, il n'est pas un effet. Sous un coup ouvert (son jet en attente, \`coupFerme\`), un clic du champ est sans effet : le noyau le refuse, l'écran lit la même garde (\`combatantClickActs\`). Le pas du groupe va vers une case voisine à pied (\`pasDuGroupe\`), sinon « Pas refusé ». Le journal de la partie et le refus du geste disent, ils ne sont pas des faits : un geste qui ne change qu'eux est sans effet. Un geste qui change la partie ET pose un refus s'écrit ; la réponse dit le refus (« refus : … »), la vue garde le dernier, un refus neuf se lit au changement de son \`nonce\`.\n\n`

  out += `## Ce que la vue donne prêt à jouer\n\nLa fenêtre qui tient la main se lit en combat comme hors combat, avec la signature de ses verbes. En exploration, la vue donne la case du groupe, son étage quand la scène en a plusieurs, son cap, puis chaque geste que le groupe peut jouer depuis sa case (\`gestesDExploration\` : les arêtes qu'il borde, les sauts, les accès et les sorties de scène, rejoints pas à pas), chacun écrit en appel de \`jouer\` à coller tel quel ; ${bornes.gestesEnVue} au plus, \`lire\` \`{"quoi":"offres"}\` les liste tous. Une réponse de \`jouer\` dit ce que ses gestes ont levé : une intention armée, un aperçu du premier clic, une fin de tour armée. Un refus de permission nomme qui tient la main et son siège (\`quiTientLaMain\`, \`siegeDe\`).\n\n`
  out += `## Les verbes et leurs arguments\n\nLes arguments d'un verbe sont un tableau JSON, contrôlés contre le TYPE du verbe, celui que \`Partie.envoyer\` accepte (\`ActionsDuNoyau\`, \`src/noyau/actionsDuNoyau.ts\`), que la cible de code \`src/hote/verbes.generated.ts\` porte (\`npm run gen\`) : un argument d'une forme fausse, en trop ou manquant lève \`validation\`, avec la signature du verbe. Un point s'écrit \`{"x":3,"y":6}\`, jamais \`[3,6]\`. \`null\` omet un argument optionnel pour en poser un suivant. Un argument qui désigne un id (\`DESIGNATIONS\`, \`src/noyau/designations.ts\` : combattant, héros, scène, entité, étape, objet, porte) s'écrit par ce qu'il désigne (\`id de combattant\`) et se contrôle contre les ids de l'état ; une porte (\`RoomPortal\`) se désigne par son id : l'hôte complète l'objet, et la vue écrit ses gestes ainsi. \`lire\` \`{"quoi":"verbes","id":"<verbe>"}\` donne une signature. Dans la table, \`?\` marque un argument optionnel ; un objet montre ses champs au premier niveau, le nom de son type au-delà (une fiche entière, \`Combatant\` ou \`Scene\`, ne contrôle que d'être un objet ; un id de catalogue, que d'être une chaîne) ; \`pid\` est l'id de l'étape ou de la rangée que la ligne « verbes » de la vue donne. Une suite de \`jouer\` compte ${GESTES_PAR_APPEL} gestes au plus.\n\n`
  out += `| Verbe | Arguments |\n|---|---|\n`
  for (const [verbe, parametres] of Object.entries(verbes)) out += `| \`${verbe}\` | \`${cellule(parametresEcrits(parametres))}\` |\n`
  out += `\n## Provenance de la vue\n\nAucune règle ne se calcule dans l'hôte : chaque champ est un lecteur de la surface du noyau, ou un champ de l'état lu tel quel.\n\n`
  out += `| Champ | Lecteur |\n|---|---|\n`
  for (const [champ, lecteur] of PROVENANCE) out += `| \`${cellule(champ)}\` | ${cellule(lecteur)} |\n`

  out += `\n## Bornes\n\nToute ligne tient en ${bornes.largeur} caractères au plus ; au-delà de ses lignes, une sortie dit « +N lignes ». Les caractères au plus d'une sortie texte valent ses lignes × ${bornes.largeur + 1} (\`caracteresAuPlus\`).\n\n`
  out += `| Sortie | Lignes au plus |\n|---|---|\n`
  for (const [commande, n] of Object.entries(bornes.lignes)) out += `| \`${commande}\` | ${n} |\n`
  out += '\n'
  out += `- La vue liste l'actif, ses engagés, puis ${bornes.autresEnVue} autres combattants au plus, par distance ; ${bornes.offresEnVue} offres ouvertes au plus (une par action, ses candidats comptés) ; ${bornes.ciblesEnVue} cibles au plus.\n`
  out += `- Une réponse de \`jouer\` montre ${bornes.journalEnReponse} lignes de journal au plus, puis « +N lignes » et l'appel qui donne la suite ; un tour de l'IA tient en une ligne.\n`
  out += `- \`journal\`, \`carte\` et \`offres\` se lisent par pages de ${bornes.page}, \`depuis\` k ; \`cases\` par pages de ${bornes.cases} cases, ${bornes.casesParLigne} par ligne ; \`verbes\` par pages de ${bornes.verbesParPage} noms. Une entrée du journal plus haute que la page se lit seule, par ses lignes (\`ligne\` m). Une liste de verbes se replie sur plusieurs lignes ; une erreur est bornée comme toute sortie.\n\n`

  out += `## Budgets de temps\n\n| Mesure | Budget |\n|---|---|\n`
  for (const [mesure, budget] of BUDGETS_DE_TEMPS) out += `| ${mesure} | ${budget} |\n`
  out += `\nLa recette et la CI jouent un scénario bref.\n\n`

  out += `## Le chargement\n\n\`scripts/hote-texte.mjs\` charge, dans un seul graphe de modules, le gel du catalogue (\`src/data/overrides.ts\`) puis l'hôte (\`src/hoteTexte/serveur.ts\`), par \`runnerImport\` de Vite avec le greffon \`proseSource()\` : la porte de la suite du noyau (\`vitest.noyau.config.ts\`), où \`import.meta.env.DEV\` est vrai. Il inscrit les outils de \`${OUTILS}\` auprès du serveur MCP du SDK (\`@modelcontextprotocol/sdk\`), qui valide leurs entrées, et garde stdout au protocole : toute écriture de console part sur stderr. Une partie ouverte à la fois par serveur : les singletons de module du noyau (branchement, intention locale, règles) n'admettent pas deux parties dans un même contexte JS ; la partie précédente se ferme avant la suivante.\n`

  return {
    out,
    path: OUT,
    staleMsg: `docs:hote-texte — ${OUT} est PÉRIMÉ (diverge de ${OUTILS}, ${VUE} ou ${COMMUN}).`,
    rerunMsg: '  → relancer `npm run docs:hote-texte` (dérivé jamais commité, #2203).',
    okMsg: `docs:hote-texte — OK (${OUT} à jour, ${Object.keys(definitions).length} outils, ${Object.keys(verbes).length} verbes)`,
    writeMsg: `${OUT} — ${Object.keys(definitions).length} outils, ${Object.keys(verbes).length} verbes, ${PROVENANCE.length} champs, ${categories.length} catégories d'erreur.`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })
