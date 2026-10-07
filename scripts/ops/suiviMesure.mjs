// LA MESURE d'un suivi de vague (#2460) : `mesurer` de scripts/ops/board.mjs, sous PROFIL, sur la portée du
// suivi, écrite dans `<N>.mesure.json` sous le verrou de mesure `.<N>.mesure.verrou` (pris sans attente).
// Hors de `suivi.mjs` : le lecteur, le hook de session et les gardes ne chargent jamais `board.mjs` ; le CLI
// (`ops:suivi -- <N> --mesurer`) charge ce module à la demande.
//
// LE PROFIL. Chaque geste injectable de la mesure (`GESTES_DU_BOARD`, `inv`, `issues`) est
// chronométré ; le `reste` est le total moins leur somme.
import * as FS from 'node:fs'
import { join } from 'node:path'
import { etapeProfilee } from '../etape-profilee.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { prendreVerrou } from '../test/verrou.mjs'
import { GESTES_DU_BOARD, issuesDeGh, mesurer } from './board.mjs'
import { lignesDeLaMesure, lireMesure, porteeDe } from './suiviDonnee.mjs'
import { ecrireSuivi, lireLeSuivi, nomDeLaMesure, relire } from './suiviFichiers.mjs'
import { inventaire } from './worktrees.mjs'

/** Le verrou de la mesure EN COURS du suivi de l'épique `n`, pris sans attente pour toute sa durée. PURE. */
const nomDuVerrouDeMesure = (n) => `.${n}.mesure.verrou`

/**
 * `mesurer` sous PROFIL : chaque entrée de `GESTES_DU_BOARD`, `inv` et `issues` est enveloppée et
 * chronométrée ; `reste` = total − somme des gestes. Une exception de la mesure devient un refus.
 * @param {{gestes?: typeof GESTES_DU_BOARD, inv?: Function, issues?: Function,
 *   horloge?: () => number} & Record<string, unknown>} [params] le reste va à `mesurer`
 * @returns {{vu: ReturnType<typeof mesurer>, profil: {durees: Record<string, number>, total: number, reste: number}}}
 */
export function mesureProfilee({ gestes = GESTES_DU_BOARD, inv = inventaire, issues = issuesDeGh, horloge = () => performance.now(), annoncer = (texte) => process.stderr.write(texte), ...params } = {}) {
  const durees = tableTotale([...Object.keys(GESTES_DU_BOARD), 'inv', 'issues'], () => 0)
  const envelopper = (nom, geste) => (...args) => {
    return etapeProfilee(`[suivi] ${nom}`, () => geste(...args), { horloge, annoncer, mesurer: (ms) => { durees[nom] += ms } })
  }
  const enveloppes = tableTotale(Object.keys(GESTES_DU_BOARD), (nom) => envelopper(nom, gestes[nom]))
  const depart = horloge()
  let vu
  try {
    vu = mesurer({ ...params, gestes: enveloppes, inv: envelopper('inv', inv), issues: envelopper('issues', issues) })
  } catch (e) {
    vu = { ok: false, refus: e.message }
  }
  const total = horloge() - depart
  const somme = Object.values(durees).reduce((a, b) => a + b, 0)
  return { vu, profil: { durees, total, reste: total - somme } }
}

/** La ligne de profil. PURE. */
const ligneDeProfil = ({ durees, total, reste }) => `[suivi] profil (ms) : ${Object.entries(durees)
  .map(([nom, ms]) => `${nom} ${Math.round(ms)}`).join(' · ')} · total ${Math.round(total)} · reste ${reste.toFixed(1)}`

/**
 * La MESURE d'un suivi, sous le verrou de mesure `.<N>.mesure.verrou` pris SANS attente pour toute sa durée :
 * tenu par un processus vivant, la sortie est 0 et dit « déjà en cours », rien n'est lancé (deux sessions qui
 * demandent la même re-mesure n'en font qu'une). Sinon : portée (`porteeDe`), mesure profilée, écriture
 * atomique de `<N>.mesure.json` sous son verrou d'écriture ; chaque anomalie y garde le `vueDepuis` de la
 * mesure précédente lisible pour la même (genre, clé), la date de cette mesure sinon ; le suivi n'est
 * jamais écrit. Rend le code de sortie et les deux flux ; la mesure annonce ses gestes sur stderr.
 * @param {{numero: number, dossier: string, sansFetch?: boolean, json?: boolean, fs?: typeof FS,
 *   pid?: number, maintenant?: Date, mesure?: Record<string, unknown>}} params `mesure` va à `mesureProfilee`
 * @returns {{code: number, stdout: string, stderr: string}}
 */
export function mesurerLeSuivi({ numero, dossier, sansFetch = false, json = false, fs = FS, pid = process.pid, maintenant = new Date(), mesure = {} }) {
  const lu = lireLeSuivi({ dossier, epique: numero, lisibles: [], fs })
  if (!lu.suivi) return { code: 1, stdout: '', stderr: `[suivi] ${lu.alerte}\n` }
  const verrou = prendreVerrou({ chemin: join(dossier, nomDuVerrouDeMesure(numero)), libelle: `mesure du suivi #${numero}`, pid, commande: 'scripts/ops/suivi.mjs --mesurer', cwd: dossier, fs })
  if (verrou.etat !== 'pris') {
    const deja = `mesure du suivi #${numero} déjà en cours : rien n'est lancé`
    return { code: 0, stdout: `${json ? JSON.stringify({ epique: numero, dejaEnCours: true }) : `[suivi] ${deja}`}\n`, stderr: '' }
  }
  try {
    return mesurerSousVerrou({ numero, dossier, sansFetch, json, fs, pid, maintenant, mesure, suivi: lu.suivi })
  } finally {
    verrou.liberer()
  }
}

/** Le corps de `mesurerLeSuivi`, verrou de mesure tenu. */
function mesurerSousVerrou({ numero, dossier, sansFetch, json, fs, pid, maintenant, mesure, suivi }) {
  const portee = porteeDe(suivi)
  const cible = join(dossier, nomDeLaMesure(numero))
  const avant = relire(cible, fs)
  const precedente = lireMesure(avant)
  const vues = new Map((precedente?.ok ? precedente.mesure.anomalies : []).map((a) => [`${a.genre}\u0000${a.cle}`, a.vueDepuis]))
  const { vu, profil } = mesureProfilee({ ...mesure, portee, sansFetch, commandeSansFetch: `npm run ops:suivi -- ${numero} --mesurer --sans-fetch` })
  const date = maintenant.toISOString()
  const document = {
    version: 1, epique: numero, date, sansFetch, portee, ok: vu.ok, refus: vu.ok ? null : String(vu.refus),
    lignes: vu.ok ? vu.lignes : [], vivants: vu.ok ? vu.vivants : [],
    anomalies: vu.ok ? vu.anomalies.map((a) => ({ ...a, vueDepuis: vues.get(`${a.genre}\u0000${a.cle}`) ?? date })) : [],
    profil,
  }
  const ecrit = ecrireSuivi({ cible, contenu: `${JSON.stringify(document, null, 2)}\n`, attendu: avant, geste: 'la mesure', fs, pid })
  if (!ecrit.ok) return { code: 1, stdout: '', stderr: `[suivi] ${ecrit.refus}\n${vu.ok ? '' : `[suivi] mesure refusée : ${vu.refus}\n`}` }
  const rendu = json
    ? JSON.stringify(document)
    : [...lignesDeLaMesure({ epique: numero, mesure: lireMesure(relire(cible, fs)) }), ...document.anomalies.map((a) => `- ⚠ ${a.texte}`), ligneDeProfil(profil)].join('\n')
  return { code: vu.ok ? 0 : 1, stdout: `${rendu}\n`, stderr: '' }
}
