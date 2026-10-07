// CLIQUET (node --test, sans réseau) — fermetures de ticket SANS solde versionné.
//
// La porte de solde (`scripts/git-hooks/porte-du-commit.mjs`) est en vigueur depuis f8e3e670f (2026-07-14) et pourtant 118 tickets
// fermés par message de commit depuis le 2026-08-01 n'ont AUCUN `.claude/soldes/<N>.md` suivi par
// git : le contrôle a été contourné à l'échelle (fermeture hors commit, message packé, arbre neuf).
// Le stock est figé NOMINATIVEMENT et ne peut que DÉCROÎTRE — un nom neuf est une fermeture qui vient
// d'échapper au garde. La grammaire lue est celle de `scripts/guards/lib/fermetures.mjs`.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { numerosFermes } from '../guards/lib/fermetures.mjs'
import { blocsDeJobs } from '../gates/gatesDeCi.mjs'
import { corpsRun } from '../gates/workflowsDuDepot.mjs'
import { gitDeLArbreReel } from '../test/gitDeBanc.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEPUIS = '2026-08-01'
/** Séparateur de messages posé par `--pretty=format:%B%x00` (un message contient des lignes vides). */
const SEPARATEUR_MESSAGES = '\0'

/** Stock MESURÉ le 2026-09-02 : tickets fermés depuis le 2026-08-01 sans solde suivi dans HEAD. */
const STOCK = [
  '1580', '1530', '1354', '1525', '1560', '1565', '1578', '1526', '1536', '1567', '1524', '1537',
  '1472', '1467', '1522', '1521', '1479', '1426', '1435', '1440', '1449', '1329', '1394', '1404',
  '1447', '1399', '1403', '1401', '1385', '1396', '1346', '1357', '1375', '1397', '1372', '1371',
  '1378', '1374', '1373', '1376', '1341', '1335', '1333', '1338', '1326', '1337', '1262', '1283',
  '1117', '1294', '1291', '1281', '1282', '1277', '1268', '1245', '1246', '1218', '1231', '1232',
  '1226', '1211', '1224', '1202', '1200', '1189', '1196', '1199', '1190', '1156', '1172', '1186',
  '1181', '1165', '1158', '1151', '1150', '1142', '1149', '1137', '1143', '1144', '1112', '1104',
  '1078', '1070', '945', '955', '956', '1072', '936', '1064', '1066', '1042', '1054', '1053',
  '1057', '1050', '1051', '1016', '1019', '1030', '1040', '1014', '1017', '1029', '1031', '1028',
  '1004', '1000', '1011', '1007', '1010', '1009', '1008', '1015', '1013', '1005',
]

const git = gitDeLArbreReel(RACINE)

/** ARRÊT NOMMÉ si le dépôt est un clone SUPERFICIEL : `git log --since` y est vide et les shas
 *  anciens absents — la mesure rendrait « rien à signaler » sur un dépôt qu'elle n'a pas lu.
 *  Jamais un `skip` vert : le défaut est dans le workflow, il doit se voir. */
function exigerHistoireComplete(git) {
  assert.equal(
    git('rev-parse', '--is-shallow-repository').trim(), 'false',
    'dépôt SUPERFICIEL : cette mesure lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
}

/** Tickets fermés par un message de commit depuis `DEPUIS` qui n'ont pas de solde SUIVI par git. */
function mesure() {
  exigerHistoireComplete(git)
  const suivis = new Set(
    git('ls-files', '.claude/soldes').split('\n').filter(Boolean)
      .map((p) => p.split('/').pop().replace(/\.md$/, '')),
  )
  const journal = git('log', `--since=${DEPUIS}`, '--pretty=format:%B%x00')
  const vus = new Set()
  const sans = []
  for (const message of journal.split(SEPARATEUR_MESSAGES)) {
    for (const n of numerosFermes(message)) {
      if (vus.has(n)) continue
      vus.add(n)
      if (!suivis.has(n)) sans.push(n)
    }
  }
  return sans
}

test('CLIQUET fermetures : aucune fermeture NEUVE sans son solde versionné', () => {
  const connus = new Set(STOCK)
  const neufs = mesure().filter((n) => !connus.has(n))
  assert.deepEqual(
    neufs, [],
    `tickets fermés hors stock et sans .claude/soldes/<N>.md suivi : ${neufs.map((n) => `#${n}`).join(' ')} — ` +
    'une fermeture porte son solde dans le commit qui la prononce.',
  )
})

test('CLIQUET fermetures : le stock DÉCROÎT, jamais l\'inverse', () => {
  const courant = new Set(mesure())
  const soldes = STOCK.filter((n) => !courant.has(n))
  assert.deepEqual(
    soldes, [],
    `fermetures désormais soldées — retirer ces entrées de STOCK dans le même commit : ${soldes.map((n) => `#${n}`).join(' ')}`,
  )
  assert.ok(courant.size <= STOCK.length, `stock en hausse : ${courant.size} > ${STOCK.length}`)
})

// ── Le workflow doit DONNER l'histoire que ces mesures lisent ─────────────────────────────────────
// `actions/checkout` clone à `depth 1` par défaut : `git log --since` y est vide et les shas anciens
// absents. Les deux mesures d'histoire s'arrêtent alors NOMMÉMENT — encore faut-il que la CI ne les
// mette pas dans cet état à chaque exécution.
// Mesuré PAR JOB : chaque job est un runner, avec SON clone.
test('CI : chaque job qui joue `test:hooks` demande l\'histoire COMPLÈTE', () => {
  const joueurs = []
  for (const nom of ['ci.yml', 'canari.yml']) {
    for (const { job, texte } of blocsDeJobs({ fichier: join(RACINE, '.github', 'workflows', nom) })) {
      if (!corpsRun(texte).some((l) => /\btest:hooks\b/.test(l))) continue
      joueurs.push(`${nom}/${job}`)
      assert.match(
        texte, /actions\/checkout@v\d+\s*\n\s*with:\s*\n\s*fetch-depth: 0/,
        `${nom} / job ${job} joue \`test:hooks\` sans \`fetch-depth: 0\` sur son \`actions/checkout\` — les mesures d'histoire y seraient muettes.`,
      )
    }
  }
  assert.ok(joueurs.some((j) => j.startsWith('ci.yml/')), 'aucun job de ci.yml ne joue `test:hooks` : cette garde ne mesure plus rien')
})
