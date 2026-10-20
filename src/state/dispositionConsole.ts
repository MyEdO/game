/**
 * DISPOSITION DE LA CONSOLE — les cases se rendent PAR ADRESSE (spec HUD `docs/plans/2026-08-16-spec-hud-combat.md`
 * zone 6 : « la barre est ENTIÈREMENT ÉDITABLE, gauche comprise […] la déduction ne fait que
 * PRÉ-REMPLIR », zone 8 : « la touche suit la CASE »).
 *
 * UN SEUL MODÈLE pour les trois zones, nommées par leur FONCTION (arsenal, accès rapide, capacités)
 * et non par leur place à l'écran : la donnée du porteur ne dépend d'aucune mise en page. Le set au
 * poing n'est qu'une DIMENSION de l'adresse de l'arsenal, jamais une seconde structure.
 *
 * UNE ENTRÉE = (`actionId` du registre `src/data/actions.json`, `cle` de la case) — la clé est celle
 * que la console DÉCLARE pour l'alvéole (`sort-<spellId>`, `q-objet-<trappingId>`…, ou
 * `ActionDef.keys[0]`) : sans elle, « Boule de feu » et « Lumière » seraient la MÊME adresse (toutes
 * deux `cast-spell`). C'est une identité de MODÈLE : jamais un uid d'INSTANCE (consommer une potion
 * changerait l'uid et tuerait l'adresse), jamais un libellé.
 *
 * ZONE = OBJET CREUX (`Record<number, …>`), jamais un tableau à trous : le snapshot de partie passe
 * par `JSON.parse(JSON.stringify(data))` (`saves.ts`), qui rend un trou `undefined` en `null` — soit,
 * ici, « case VIDÉE ». Poser une case au rang 3 aurait donc vidé les rangs 0-2 au rechargement.
 * Clé ABSENTE = rang laissé au pré-remplissage déduit ; `null` = case vidée par le joueur.
 *
 * LECTURE et ÉCRITURE n'ont pas la même sévérité :
 *  • ÉCRITURE = porte UNIQUE et FAIL-FAST : id hors registre, rang hors borne, zone inconnue, arsenal
 *    sans set → `throw`. Rien d'invalide n'entre dans la donnée du porteur.
 *  • LECTURE = TOLÉRANTE : une save d'une autre version peut porter un id que ce binaire ne connaît
 *    plus ; l'entrée est ignorée (avertie une fois) et la case reste VIDE — la déduction ne la
 *    reprend pas, le joueur l'avait remplie.
 */
import { findActionById } from '../data/index';
import type { Combatant, DispositionConsole, EntreeBarre, ZoneBarre } from '../engine/types';


/** GÉOMÉTRIE IMMUABLE de la console — arbitrage utilisateur 2026-08-16 : « je ne veux pas que la
 *  taille de l'interface ou les boutons bougent ».
 *  Le contenu varie, le compte de cases JAMAIS : une case sans contenu se DESSINE vide.
 *  arsenal = 2×3 · accès rapide = 2×2 · capacités = 2×6. */
export const TAILLE_ZONE: Record<ZoneBarre, number> = { arsenal: 6, accesRapide: 4, capacites: 12 };

/** Touches imprimées dans les cases de la grille de CAPACITÉS, par POSITION (spec zone 8 : « 1-8 =
 *  cases de la grille visible » ; « touches des cases 9-12 à régler au volet clavier », spec l.83). */
export const TOUCHES_IMPRIMEES = 8;

/** L'adresse d'UNE case : sa zone, son rang, et — arsenal seulement — le SET au poing dont elle porte
 *  la disposition. */
export interface AdresseBarre {
  zone: ZoneBarre;
  index: number;
  /** `WeaponLoadout.id` — requis pour `zone: 'arsenal'`, ignoré ailleurs. */
  setId?: string;
}

const ZONES: ZoneBarre[] = ['arsenal', 'accesRapide', 'capacites'];

/** Ids déjà signalés à la lecture — un avertissement par id, pas un par rendu. */
const inconnusSignales = new Set<string>();

/** L'IDENTITÉ d'une entrée, en une clé comparable : c'est elle qui distingue deux cases de la MÊME
 *  action (deux sorts, deux armes à recharger, deux objets). */
export function cleEntree(e: EntreeBarre): string {
  return `${e.actionId} ${e.cle}`;
}

const memeEntree = (a: EntreeBarre, b: EntreeBarre) => cleEntree(a) === cleEntree(b);

function zoneValide(zone: ZoneBarre): void {
  if (!ZONES.includes(zone)) throw new Error(`disposition : zone inconnue « ${zone} »`);
}

/** PRÉ-REMPLISSAGE d'une zone : les entrées que la situation DÉDUIT, à la file, bornées à la zone —
 *  au-delà, le geste déduit ne paraît pas.
 *  FAIL-FAST : la déduction est du CODE, pas de la donnée de save — un id qu'aucune entrée du
 *  registre ne porte est un bug de la console, il se voit tout de suite. */
export function dispositionDeduite(zone: ZoneBarre, entrees: EntreeBarre[]): EntreeBarre[] {
  zoneValide(zone);
  const inconnu = entrees.find((e) => !findActionById(e.actionId));
  if (inconnu) throw new Error(`disposition déduite : « ${inconnu.actionId} » n'est pas une action du registre`);
  // L'ADRESSE EXIGE L'UNICITÉ : deux cases de même identité dans une même zone rendraient la même
  // alvéole deux fois et en perdraient une autre. C'est un bug de la console, pas une donnée.
  const vues = new Set<string>();
  for (const e of entrees) {
    const cle = cleEntree(e);
    if (vues.has(cle)) throw new Error(`disposition : deux cases de même identité dans la zone « ${zone} » (${cle})`);
    vues.add(cle);
  }
  return entrees.slice(0, TAILLE_ZONE[zone]);
}

/** Les rangs POSÉS par le porteur pour une zone (et, pour l'arsenal, pour SON set). */
function poseesDe(
  barre: DispositionConsole | undefined,
  zone: ZoneBarre,
  setId?: string,
): Record<number, EntreeBarre | null> | undefined {
  if (!barre) return undefined;
  if (zone === 'arsenal') return setId ? barre.arsenal?.[setId] : undefined;
  return zone === 'accesRapide' ? barre.accesRapide : barre.capacites;
}

/** CE QUE LA ZONE REND, case par case : le rang posé quand la clé existe (`null` compris — une case
 *  volontairement vidée le RESTE), sinon le pré-remplissage déduit.
 *  POSER = DÉPLACER : une entrée posée quelque part dans la zone quitte le pré-remplissage, elle ne
 *  s'y dédouble pas et n'y laisse pas de trou. */
export function resoudreDisposition(
  barre: DispositionConsole | undefined,
  zone: ZoneBarre,
  deduite: EntreeBarre[],
  setId?: string,
): (EntreeBarre | null)[] {
  zoneValide(zone);
  const rangs = Array.from({ length: TAILLE_ZONE[zone] }, (_, i) => i);
  const posees = poseesDe(barre, zone, setId);
  if (!posees) return rangs.map((i) => deduite[i] ?? null);

  const retenues = new Map<number, EntreeBarre | null>();
  const clesPosees = new Set<string>();
  for (const i of rangs) {
    if (!Object.prototype.hasOwnProperty.call(posees, i)) continue;
    const pose = posees[i];
    if (!pose) {
      retenues.set(i, null);
      continue;
    }
    if (!findActionById(pose.actionId)) {
      if (!inconnusSignales.has(pose.actionId)) {
        inconnusSignales.add(pose.actionId);
        console.warn(`disposition de console : action « ${pose.actionId} » inconnue du registre — case laissée vide`);
      }
      retenues.set(i, null);
      continue;
    }
    retenues.set(i, pose);
    clesPosees.add(cleEntree(pose));
  }
  const reste = deduite.filter((e) => !clesPosees.has(cleEntree(e)));
  let curseur = 0;
  return rangs.map((i) => (retenues.has(i) ? retenues.get(i)! : reste[curseur++] ?? null));
}

function verifierAdresse({ zone, index, setId }: AdresseBarre): void {
  zoneValide(zone);
  if (!Number.isInteger(index) || index < 0 || index >= TAILLE_ZONE[zone]) {
    throw new Error(`disposition : rang ${index} hors de la zone « ${zone} » (0…${TAILLE_ZONE[zone] - 1})`);
  }
  if (zone === 'arsenal' && !setId) throw new Error('disposition : l’arsenal s’adresse PAR SET (setId requis)');
}

/** PORTE UNIQUE D'ÉCRITURE de la disposition. Rend un porteur NEUF ; refuse (throw) tout ce qui ne
 *  s'adresserait à rien : id hors registre, rang hors borne, zone inconnue, arsenal sans set.
 *  POSER DÉPLACE : la même entrée déjà posée ailleurs dans la zone quitte son ancien rang. */
export function poserDansBarre(c: Combatant, adresse: AdresseBarre, entree: EntreeBarre | null): Combatant {
  verifierAdresse(adresse);
  if (entree && !findActionById(entree.actionId)) {
    throw new Error(`disposition : « ${entree.actionId} » n'est pas une action du registre`);
  }
  const { zone, index, setId } = adresse;
  const barre: DispositionConsole = { ...(c.barre ?? {}) };
  const actuels = poseesDe(barre, zone, setId) ?? {};
  const zoneMaj: Record<number, EntreeBarre | null> = {};
  for (const [rang, valeur] of Object.entries(actuels)) {
    if (entree && valeur && memeEntree(valeur, entree)) continue;
    zoneMaj[Number(rang)] = valeur;
  }
  zoneMaj[index] = entree;
  if (zone === 'arsenal') barre.arsenal = { ...(barre.arsenal ?? {}), [setId!]: zoneMaj };
  else if (zone === 'accesRapide') barre.accesRapide = zoneMaj;
  else barre.capacites = zoneMaj;
  return { ...c, barre };
}

/** VIDER une case : elle reste dessinée à sa place, la déduction ne la reprend pas. */
export function retirerDeBarre(c: Combatant, adresse: AdresseBarre): Combatant {
  return poserDansBarre(c, adresse, null);
}
