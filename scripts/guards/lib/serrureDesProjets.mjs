// LA SERRURE DE LA PORTE DES PROJETS (#5037) : les passerelles de lecture du dépôt (`lister.mjs`, `sourceCorpus.mjs`)
// la consultent AVANT tout mémo, et refusent un chemin du dossier `projets/` de CE dépôt que ne couvre aucune passe.
// Une passe ne se frappe que par le sceau, que la serrure ne remet qu'au module de la porte (`porteDesProjets.mjs`) :
// un lecteur de projet importe donc la porte, et « qui lit les projets » est la clôture d'imports qui l'atteint
// (`clotureDImports`, `importGraph.mjs`). Les passerelles importent la serrure, jamais la porte : leur importeur n'entre
// pas dans cette clôture.
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const DEPOT = join(ICI, '..', '..', '..');
const DOSSIER_DES_PROJETS = join(DEPOT, 'projets');
const MODULE_DE_LA_PORTE = join(ICI, 'porteDesProjets.mjs');

/** Les passes frappées par le sceau ; une passe est un objet gelé `{ lit: 'tous' } | { lit: 'projet', projet } |
 *  { lit: 'suffixe', suffixe }`. @type {WeakSet<object>} */
const PASSES = new WeakSet();

/** Frappe une passe de lecture `lecture`. */
const sceller = (lecture) => {
  const passe = Object.freeze({ ...lecture });
  PASSES.add(passe);
  return passe;
};

/** Le sceau des passes, remis au seul module de la porte, qui se nomme par son `import.meta.url`. */
export function sceauDeLaPorte(urlDuModule) {
  if (fileURLToPath(urlDuModule) !== MODULE_DE_LA_PORTE) throw new Error(`sceauDeLaPorte : le sceau ne se remet qu'à ${relative(DEPOT, MODULE_DE_LA_PORTE)}`);
  return sceller;
}

/** Le chemin absolu `abs` relatif au dépôt, en POSIX. */
const relDuDepot = (abs) => relative(DEPOT, abs).split(sep).join('/');

/** La passe `porte` admet-elle la lecture du chemin `rel` (POSIX, depuis le dépôt) ? */
function admet(porte, rel) {
  if (!PASSES.has(porte)) return false;
  if (porte.lit === 'tous') return true;
  if (!(rel === 'projets' || rel.startsWith('projets/'))) return false;
  if (porte.lit === 'suffixe') return true;
  const dossier = `projets/${porte.projet}`;
  return rel === dossier || rel.startsWith(`${dossier}/`);
}

/**
 * Refuse que `passerelle` lise `abs` (absolu) sans passe qui l'admette, quand `abs` est le dossier des projets, un
 * chemin sous lui, ou, sous `ancetres`, un de ses ancêtres (une lecture récursive qui y descendra).
 * @param {string} abs @param {object | undefined} porte @param {string} passerelle
 * @param {{ ancetres?: boolean }} [options]
 */
export function exigerLaPorte(abs, porte, passerelle, { ancetres = false } = {}) {
  const sous = abs === DOSSIER_DES_PROJETS || abs.startsWith(DOSSIER_DES_PROJETS + sep);
  const ancetre = ancetres && DOSSIER_DES_PROJETS.startsWith(abs.endsWith(sep) ? abs : abs + sep);
  if (!sous && !ancetre) return;
  const rel = relDuDepot(abs);
  if (admet(porte, rel)) return;
  throw new Error(`${passerelle} : « ${rel || '.'} » couvre projets/ sans passe qui l'admette — un lecteur de projet passe par la porte (scripts/guards/lib/porteDesProjets.mjs, #5037)`);
}
