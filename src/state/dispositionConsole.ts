/**
 * DISPOSITION DE LA CONSOLE — les cases se rendent PAR ADRESSE (spec HUD `docs/plans/2026-08-16-spec-hud-combat.md`
 * zone 6, zone 8 : « la touche suit la CASE »), et la barre se MATÉRIALISE dans le porteur — fiche
 * `.claude/memory/user-arbitrage-barre-materialisee-et-sans-pages.md`.
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
 * UNE ZONE = ses RANGS (objet creux, jamais un tableau à trous : le snapshot de partie passe par
 * `JSON.parse(JSON.stringify(data))`, `saves.ts`, qui rendrait un trou `undefined` en `null`) et ses
 * entrées CONNUES (toute entrée déjà placée, matérialisée ou posée). Un rang sans entrée est LIBRE ;
 * une entrée de l'offre que la zone ne connaît pas y va (`materialiserZone`) ; une entrée
 * connue n'y revient jamais d'elle-même. Aucun rang ne se calcule depuis un autre : rien ne glisse.
 *
 * LECTURE et ÉCRITURE n'ont pas la même sévérité :
 *  • ÉCRITURE = FAIL-FAST, par l'unique écrivain `avecZone` : le geste (`poserDansBarre`) et la
 *    matérialisation (`materialiserPorteur`, offre validée par `offreDeZone`) ; id hors registre, rang
 *    hors borne, zone inconnue, arsenal sans set → `throw`. Rien d'invalide n'entre dans la donnée du porteur.
 *  • LECTURE = TOLÉRANTE : une save d'une autre version peut porter un id que ce binaire ne connaît
 *    plus ; l'entrée est ignorée (avertie une fois) et la case reste VIDE.
 */
import { findActionById } from '../data/index';
import type { Combatant, DispositionConsole, EntreeBarre, ZoneBarre, ZoneDisposee } from '../engine/types';

export type { DispositionConsole, EntreeBarre, ZoneBarre, ZoneDisposee } from '../engine/types';

/** GÉOMÉTRIE IMMUABLE de la console : docs/plans/2026-08-16-hud-combat.md:35-36.
 *  Le contenu varie, le compte de cases JAMAIS : une case sans contenu se DESSINE vide.
 *  arsenal = 2×3 · accès rapide = 2×2 · capacités = 2×6. */
export const TAILLE_ZONE: Record<ZoneBarre, number> = { arsenal: 6, accesRapide: 4, capacites: 12 };

/** Touches imprimées dans les cases de la grille de CAPACITÉS, par POSITION (spec zone 8 : « 1-8 =
 *  cases de la grille visible » ; « touches des cases 9-12 à régler au volet clavier », spec l.83). */
export const TOUCHES_IMPRIMEES = 8;

/** Clé d'ADRESSE de l'arsenal d'un porteur SANS set d'armes (statbloc de créature) : son arsenal se
 *  dispose comme celui d'un set, sous ce nom réservé. */
export const ARSENAL_SANS_SET = '(sans set)';

/** L'adresse d'UNE case : sa zone, son rang, et — arsenal seulement — le SET au poing dont elle porte
 *  la disposition. */
export interface AdresseBarre {
  zone: ZoneBarre;
  index: number;
  /** `WeaponLoadout.id`, ou `ARSENAL_SANS_SET` — requis pour `zone: 'arsenal'`, ignoré ailleurs. */
  setId?: string;
}

/** L'OFFRE d'une zone telle que la console la voit : ce que la situation du porteur y propose, dans
 *  l'ordre de lecture. C'est l'argument de la matérialisation. */
export interface OffreDeZone {
  zone: ZoneBarre;
  setId?: string;
  offre: EntreeBarre[];
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

function setRequis(zone: ZoneBarre, setId: string | undefined): void {
  if (zone === 'arsenal' && !setId) throw new Error('disposition : l’arsenal s’adresse PAR SET (setId requis)');
}

/** L'OFFRE d'une zone, validée. FAIL-FAST : l'offre est du CODE, pas de la donnée de save — un id
 *  qu'aucune entrée du registre ne porte, ou deux cases de même identité, sont un bug de la console. */
export function offreDeZone(zone: ZoneBarre, entrees: EntreeBarre[]): EntreeBarre[] {
  zoneValide(zone);
  const inconnu = entrees.find((e) => !findActionById(e.actionId));
  if (inconnu) throw new Error(`offre de console : « ${inconnu.actionId} » n'est pas une action du registre`);
  const vues = new Set<string>();
  for (const e of entrees) {
    const cle = cleEntree(e);
    if (vues.has(cle)) throw new Error(`disposition : deux cases de même identité dans la zone « ${zone} » (${cle})`);
    vues.add(cle);
  }
  return entrees;
}

/** La zone DISPOSÉE du porteur (et, pour l'arsenal, celle de SON set). */
function zoneDe(barre: DispositionConsole | undefined, zone: ZoneBarre, setId?: string): ZoneDisposee | undefined {
  zoneValide(zone);
  setRequis(zone, setId);
  if (zone === 'arsenal') return barre?.arsenal?.[setId!];
  return zone === 'accesRapide' ? barre?.accesRapide : barre?.capacites;
}

function avecZone(barre: DispositionConsole | undefined, zone: ZoneBarre, setId: string | undefined, z: ZoneDisposee): DispositionConsole {
  const out: DispositionConsole = { ...(barre ?? {}) };
  if (zone === 'arsenal') out.arsenal = { ...(out.arsenal ?? {}), [setId!]: z };
  else if (zone === 'accesRapide') out.accesRapide = z;
  else out.capacites = z;
  return out;
}

/** MATÉRIALISATION d'une zone — PURE et IDEMPOTENTE. Chaque entrée de l'offre que la zone ne CONNAÎT
 *  pas devient connue et va au premier rang libre, dans l'ordre de l'offre ; au-delà du dernier rang
 *  elle n'entre pas et reste à la liste complète, connue quand même : un trou laissé ensuite ne la
 *  rappelle pas. Rien d'autre ne bouge. Rend la zone REÇUE quand rien ne change. */
export function materialiserZone(zone: ZoneBarre, disposee: ZoneDisposee | undefined, offre: EntreeBarre[]): ZoneDisposee {
  zoneValide(zone);
  const base: ZoneDisposee = disposee ?? { rangs: {}, connues: [] };
  const connues = new Set(base.connues);
  const rangs = { ...base.rangs };
  let rang = 0;
  let nouvelles = 0;
  for (const e of offre) {
    if (connues.has(cleEntree(e))) continue;
    connues.add(cleEntree(e));
    nouvelles++;
    while (rang < TAILLE_ZONE[zone] && rangs[rang]) rang++;
    if (rang < TAILLE_ZONE[zone]) rangs[rang] = e;
  }
  return nouvelles ? { rangs, connues: [...connues] } : base;
}

/** CE QUE LA ZONE REND, case par case : la lecture de sa matérialisation. Un id que ce binaire ne
 *  connaît plus rend une case VIDE. */
export function resoudreDisposition(
  barre: DispositionConsole | undefined,
  zone: ZoneBarre,
  offre: EntreeBarre[],
  setId?: string,
): (EntreeBarre | null)[] {
  const { rangs } = materialiserZone(zone, zoneDe(barre, zone, setId), offre);
  return Array.from({ length: TAILLE_ZONE[zone] }, (_, i) => {
    const e = rangs[i];
    if (!e) return null;
    if (findActionById(e.actionId)) return e;
    if (!inconnusSignales.has(e.actionId)) {
      inconnusSignales.add(e.actionId);
      console.warn(`disposition de console : action « ${e.actionId} » inconnue du registre — case laissée vide`);
    }
    return null;
  });
}

function verifierAdresse({ zone, index, setId }: AdresseBarre): void {
  zoneValide(zone);
  if (!Number.isInteger(index) || index < 0 || index >= TAILLE_ZONE[zone]) {
    throw new Error(`disposition : rang ${index} hors de la zone « ${zone} » (0…${TAILLE_ZONE[zone] - 1})`);
  }
  setRequis(zone, setId);
}

/** PORTE UNIQUE D'ÉCRITURE de la disposition. Rend un porteur NEUF ; refuse (throw) tout ce qui ne
 *  s'adresserait à rien : id hors registre, rang hors borne, zone inconnue, arsenal sans set.
 *  POSER = DÉPLACER, sur case occupée = ÉCHANGER : l'entrée délogée prend l'ancien rang de l'entrée
 *  posée ; si celle-ci venait de la liste, la délogée retourne à la liste et reste connue. Un rang
 *  quitté sans échange devient un TROU. `null` = retirer : le rang devient un trou, l'entrée reste
 *  connue. */
export function poserDansBarre(c: Combatant, adresse: AdresseBarre, entree: EntreeBarre | null): Combatant {
  verifierAdresse(adresse);
  if (entree && !findActionById(entree.actionId)) {
    throw new Error(`disposition : « ${entree.actionId} » n'est pas une action du registre`);
  }
  const { zone, index, setId } = adresse;
  const avant = zoneDe(c.barre, zone, setId);
  const rangs = { ...(avant?.rangs ?? {}) };
  const connues = new Set(avant?.connues ?? []);
  if (entree) {
    const origine = Object.keys(rangs).map(Number).find((r) => {
      const v = rangs[r];
      return !!v && memeEntree(v, entree);
    });
    if (origine !== undefined && origine !== index) rangs[origine] = rangs[index] ?? null;
    connues.add(cleEntree(entree));
  }
  rangs[index] = entree;
  return { ...c, barre: avecZone(c.barre, zone, setId, { rangs, connues: [...connues] }) };
}

/** VIDER une case : elle reste dessinée à sa place, son entrée ne revient pas d'elle-même. */
export function retirerDeBarre(c: Combatant, adresse: AdresseBarre): Combatant {
  return poserDansBarre(c, adresse, null);
}

/** MATÉRIALISER la barre d'un porteur : la zone matérialisée s'écrit entière, rangs ET entrées connues
 *  sans rang, par `avecZone` — l'écrivain de `poserDansBarre`. FAIL-FAST par les mêmes gardes : l'offre
 *  passe `offreDeZone` (registre, identités), l'adresse `zoneDe` (zone, set). Rend le porteur REÇU quand
 *  rien ne change (idempotence des écritures). */
export function materialiserPorteur(c: Combatant, offres: readonly OffreDeZone[]): Combatant {
  let out = c;
  for (const { zone, setId, offre } of offres) {
    const avant = zoneDe(out.barre, zone, setId);
    const apres = materialiserZone(zone, avant, offreDeZone(zone, offre));
    if (apres === avant || (!avant && !apres.connues.length)) continue;
    out = { ...out, barre: avecZone(out.barre, zone, setId, apres) };
  }
  return out;
}
