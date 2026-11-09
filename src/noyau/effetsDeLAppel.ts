/**
 * LES EFFETS D'UN APPEL (#3771), que tout hôte du noyau rend tels quels : chaque coup, chaque incantation, chaque zone
 * d'effet (#3783) et chaque son que l'appel a émis sur le bus (`EVT.ANIM_ATTACK`, `EVT.ANIM_AOE`, `EVT.SFX`), son rendu
 * résolu au catalogue `rendus.json`. Le rendu d'une arme est celui de son objet, à défaut celui de son Groupe (`subType`) ;
 * celui d'un sort, celui de son Domaine ; une Prière a le sien ; celui d'une manœuvre de zone, le sien, celui d'un Souffle
 * celui de son Type. L'hôte ne décide rien : il dessine la phase et joue le son qu'il reçoit. Aucune conséquence de règle.
 */
import { breathTypes, domains, findDomainById, findRenduById, findSpellById, findTrappingById, findWeaponGroupById, lightTones, maneuvers, rendus, siegeEngines, type DomainData, type Projectile, type RenduDef, type VisuelDEffet } from '../data';
import { sonDEffet, sonsDEffet, type SonDEffet } from '../data/sons/registre';
import { castInfoIsPrayer } from '../engine/magic';
import type { Weapon } from '../engine/types';
import type { ChargeDAttaque, ChargeDeZone } from './bus';
import { sourceDuTon, type SourceDeLumiere } from './lumiereDeLaScene';
import type { Jeu } from './etat';
import { porteurParId } from './monde/combatants';
import { sceneMetresPerTile } from './monde/scene';
import { FLAME_LIFT_M } from './monde/vision';
import { discTiles } from './monde/zones';
import type { Evenement } from './partie';

/** Une phase rendue : le visuel que l'hôte dessine à son point, le son qu'il y joue. */
export interface PhaseRendue {
  visuel: VisuelDEffet | null;
  son: SonDEffet | null;
}

/** Le vol d'un projectile jusqu'à la cible : sa durée (s), à la vitesse de son rendu sur la distance des deux
 *  combattants, et la hauteur (m) de sa cloche. */
export interface TrajetRendu {
  projectile: Projectile;
  dureeS: number;
  hauteurM: number;
}

export type IssueDuCoup = 'touche' | 'critique' | 'pare' | 'manque';

/** Une case d'une zone d'effet : (x, y) et sa couche. */
export type CaseDeZone = ChargeDeZone['centre'];

/** Un coup porté de `de` à `vers` : la phase de départ à l'attaquant, le trajet du projectile, et la phase d'arrivée de
 *  son issue sur la cible (l'impact, le manque, ou la parade de l'arme qui a paré). Une incantation de `de` sur `vers`
 *  (`de` lui-même pour un sort sur soi), sa phase d'arrivée nulle quand elle échoue. Une zone d'effet que `de` pose sur
 *  `cases` autour de `centre` : sa phase de départ à l'auteur, le jet qui vole jusqu'au centre (aucun quand l'auteur
 *  en est le centre), puis la nappe sur chaque case. Un son de scène. */
export type Effet =
  | { quoi: 'coup'; de: string; vers: string; issue: IssueDuCoup; couleur: string; depart: PhaseRendue | null; trajet: TrajetRendu | null; arrivee: PhaseRendue | null }
  | { quoi: 'incantation'; de: string; vers: string; reussie: boolean; couleur: string; depart: PhaseRendue | null; arrivee: PhaseRendue | null }
  | { quoi: 'zone'; de: string; centre: CaseDeZone; cases: CaseDeZone[]; couleur: string; depart: PhaseRendue | null; trajet: TrajetRendu | null; nappe: PhaseRendue | null }
  | { quoi: 'son'; son: SonDEffet };

/** Les rendus de repli : une arme de mêlée, de tir, naturelle, sans rendu propre ni de Groupe ; un sort hors Domaine ;
 *  une Prière. */
const REPLI = { melee: 'arme-blanche', ranged: 'jet', naturelle: 'attaque-naturelle', sort: 'sort-arcane', priere: 'priere' } as const;

const catalogue = (id: string): RenduDef => findRenduById(id)!;

/** La phase d'un rendu, de visuel `visuel` et de son `s`, nulle sans l'un ni l'autre. */
const phase = (visuel: VisuelDEffet | undefined, s: { id: string } | undefined): PhaseRendue | null => (visuel || s ? { visuel: visuel ?? null, son: s ? sonDEffet(s.id) : null } : null);

const depart = (r: RenduDef): PhaseRendue | null => phase(r.departVisuel, r.departSon);

/** La phase d'arrivée du rendu `r` : son impact, ou son manque. */
const arriveeDe = (r: RenduDef, manque: boolean): PhaseRendue | null => (manque ? phase(r.manqueVisuel, r.manqueSon) : phase(r.impactVisuel, r.impactSon));

/** Le rendu de l'arme `w` : celui de son objet (un engin de siège), de son Groupe, à défaut le repli de sa sorte. */
function renduDeLArme(w: Weapon): RenduDef {
  const groupe = findWeaponGroupById(w.subType);
  const propre = findTrappingById(w.trappingId)?.rendu ?? (groupe?.kind === 'weapon' ? groupe.rendu : undefined);
  return catalogue(propre?.id ?? (w.natural ? REPLI.naturelle : REPLI[w.type]));
}

/** Le rendu d'un sort du Domaine `domaine` (aucun : hors Domaine) et sa teinte : celui du Domaine, teint à sa couleur. */
function renduDuDomaine(domaine: DomainData | undefined): { rendu: RenduDef; couleur: string } {
  const rendu = catalogue(domaine?.rendu?.id ?? REPLI.sort);
  return { rendu, couleur: domaine?.couleur ?? rendu.couleur };
}

/** Le rendu de la Prière et sa teinte. */
function renduDeLaPriere(): { rendu: RenduDef; couleur: string } {
  const rendu = catalogue(REPLI.priere);
  return { rendu, couleur: rendu.couleur };
}

/** Le rendu du sort d'id `id` et sa teinte : la Prière a le sien ; un Sort, celui de son Domaine. */
function renduDuSort(id: string): { rendu: RenduDef; couleur: string } {
  const sort = findSpellById(id);
  return sort && castInfoIsPrayer(sort) ? renduDeLaPriere() : renduDuDomaine(findDomainById(sort?.domainId));
}

/** La durée de vol (s) la plus courte, qu'un vol à bout portant garde visible. */
const VOL_MINIMAL_S = 0.08;

/** Le trajet du rendu `r` sur `distanceM` mètres, nul sans projectile. */
const trajet = (r: RenduDef, distanceM: number): TrajetRendu | null =>
  r.projectile ? { projectile: r.projectile, dureeS: Math.max(distanceM / r.vitesseMs!, VOL_MINIMAL_S), hauteurM: r.cloche! * distanceM } : null;

/** Le coup du rendu `rendu`, teint de `couleur`, de `de` à `vers` à `distanceM` mètres, à l'issue `issue` : sa phase
 *  d'arrivée est l'impact, le manque, ou la parade du rendu `parade` de l'arme qui a paré. */
function coup(rendu: RenduDef, couleur: string, issue: IssueDuCoup, de: string, vers: string, distanceM: number, parade: RenduDef | null): Effet {
  const arrivee = parade ? phase(parade.paradeVisuel, parade.paradeSon) : arriveeDe(rendu, issue === 'manque');
  return { quoi: 'coup', de, vers, issue, couleur, depart: depart(rendu), trajet: trajet(rendu, distanceM), arrivee };
}

/** L'incantation du rendu `rendu`, teinte de `couleur`, de `de` sur `vers`, sa phase d'arrivée nulle quand elle échoue. */
const incantation = (rendu: RenduDef, couleur: string, reussie: boolean, de: string, vers: string): Effet =>
  ({ quoi: 'incantation', de, vers, reussie, couleur, depart: depart(rendu), arrivee: reussie ? arriveeDe(rendu, false) : null });

/** La zone `z` du rendu `rendu`, teinte de `couleur`, dont l'auteur est à `distanceM` mètres du centre : sa nappe est
 *  la phase de zone du rendu, à défaut celle de son impact. */
function zone(rendu: RenduDef, couleur: string, z: ChargeDeZone, distanceM: number): Effet {
  return {
    quoi: 'zone', de: z.de, centre: z.centre, cases: z.tiles, couleur, depart: depart(rendu),
    trajet: distanceM > 0 ? trajet(rendu, distanceM) : null,
    nappe: phase(rendu.zoneVisuel ?? rendu.impactVisuel, rendu.zoneSon ?? rendu.impactSon),
  };
}

/** Le rendu de la zone `z` et sa teinte : celui de son sort, celui de sa manœuvre, à défaut le repli d'un sort hors
 *  Domaine. */
export function renduDeLaZone(z: ChargeDeZone): { rendu: RenduDef; couleur: string } {
  if (z.sort) return renduDuSort(z.sort);
  const rendu = catalogue(z.rendu ?? REPLI.sort);
  return { rendu, couleur: rendu.couleur };
}

/** L'effet de l'attaque `a`, entre deux combattants posés à `distanceM` mètres l'un de l'autre. */
function effetDeLAttaque(a: Exclude<ChargeDAttaque, { kind: 'creature' }>, distanceM: number): Effet {
  if (a.kind === 'spell') {
    const { rendu, couleur } = renduDuSort(a.spell);
    if (!a.projectile) return incantation(rendu, couleur, a.result.cast, a.from, a.to);
    const issue: IssueDuCoup = !a.result.hit ? 'manque' : (a.result.critiques ?? 0) > 0 ? 'critique' : 'touche';
    return coup(rendu, couleur, issue, a.from, a.to, distanceM, null);
  }
  const rendu = renduDeLArme(a.weapon);
  const pare = !a.result.hit && a.parryWeapon !== undefined;
  const issue: IssueDuCoup = a.result.hit ? (a.result.critical ? 'critique' : 'touche') : pare ? 'pare' : 'manque';
  return coup(rendu, rendu.couleur, issue, a.from, a.to, distanceM, pare ? renduDeLArme(a.parryWeapon!) : null);
}

/** Les mètres qui séparent les combattants `de` et `vers` de `etat` sur le plateau de sa scène, `null` quand l'un n'y est
 *  pas posé. */
function distanceDesCombattants(etat: Jeu, de: string, vers: string): number | null {
  const a = porteurParId(etat, de)?.pos;
  const b = porteurParId(etat, vers)?.pos;
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) * sceneMetresPerTile(etat.scene) : null;
}

/** Les effets des événements `evenements` d'un appel (`ResultatDeLAppel.evenements`) sur l'état `etat` qui le suit, dans
 *  leur ordre ; un coup, une incantation ou une zone dont un combattant n'est pas posé, ou l'attaque spéciale d'une
 *  créature sur elle-même, n'en rend aucun. */
export function effetsDeLAppel(etat: Jeu, evenements: readonly Evenement[]): Effet[] {
  return evenements.flatMap((e): Effet[] => {
    if (e.type !== 'emis') return [];
    if (e.evt === 'anim_attack') {
      if (e.payload.kind === 'creature') return [];
      const distanceM = distanceDesCombattants(etat, e.payload.from, e.payload.to);
      return distanceM === null ? [] : [effetDeLAttaque(e.payload, distanceM)];
    }
    if (e.evt === 'anim_aoe') {
      const auteur = porteurParId(etat, e.payload.de)?.pos;
      if (!auteur) return [];
      const { rendu, couleur } = renduDeLaZone(e.payload);
      const distanceM = Math.hypot(e.payload.centre.x - auteur.x, e.payload.centre.y - auteur.y) * sceneMetresPerTile(etat.scene);
      return [zone(rendu, couleur, e.payload, distanceM)];
    }
    if (e.evt === 'sfx') {
      const s = sonDEffet(e.payload.id);
      return s ? [{ quoi: 'son', son: s }] : [];
    }
    return [];
  });
}

/** Une variante de la vitrine : l'issue d'un coup, l'incantation réussie ou ratée d'un sort sans projectile, ou la zone
 *  d'un sort de zone. */
export type VarianteDeVitrine = 'touche' | 'manque' | 'pare' | 'incantation' | 'incantation-ratee' | 'zone';

/** Une entrée de la vitrine : un rendu d'arme, un Domaine ou la Prière, et l'effet de chacune de ses variantes. */
export interface EntreeDeVitrine {
  id: string;
  label: string;
  variantes: { variante: VarianteDeVitrine; effet: Effet }[];
}

/** Un effet de la vitrine, par l'id et le libellé de ce qu'il montre. */
export interface EffetDeVitrine {
  id: string;
  label: string;
  effet: Effet;
}

/** La vitrine des effets que le jeu joue (#3777), de l'auteur `de` à la cible `vers` posée à `distanceM` mètres, sur
 *  des cases de `metresParCase` mètres où l'auteur tient la case (0, 0) et la cible la case (`distanceM` /
 *  `metresParCase`, 0) : chaque rendu d'arme, chaque Domaine, le sort hors Domaine et la Prière, la zone de chaque
 *  manœuvre de zone et de chaque Type de Souffle (#3783), chaque son d'effet du registre, chaque ton de lumière posé au
 *  lieu de la cible, et l'attaque qui touche de chaque engin de siège, par son id d'objet. */
export interface VitrineDesEffets {
  de: string;
  vers: string;
  distanceM: number;
  metresParCase: number;
  armes: EntreeDeVitrine[];
  sorts: EntreeDeVitrine[];
  manoeuvres: EffetDeVitrine[];
  souffles: EffetDeVitrine[];
  sons: EffetDeVitrine[];
  lumieres: { id: string; label: string; source: SourceDeLumiere }[];
  attaques: Record<string, Effet>;
}

const AUTEUR_DE_LA_VITRINE = 'auteur';
const CIBLE_DE_LA_VITRINE = 'cible';
const DISTANCE_DE_LA_VITRINE_M = 12;
/** Le rayon (cases) d'une zone de la vitrine, et celui qu'éclaire une lumière de la vitrine. */
const RAYON_DE_ZONE_DE_LA_VITRINE = 1;
const RAYON_DE_LUMIERE_DE_LA_VITRINE = 5;

/** La zone de la vitrine que `de` pose autour de la case `centre`, au rendu de `origine` (`renduDeLaZone`), l'auteur à
 *  `distanceM` mètres du centre. */
function zoneDeLaVitrine(de: string, centre: CaseDeZone, origine: Pick<ChargeDeZone, 'sort' | 'rendu'>, distanceM: number): Effet {
  const z: ChargeDeZone = { de, centre, tiles: discTiles(centre, RAYON_DE_ZONE_DE_LA_VITRINE), ...origine };
  const { rendu, couleur } = renduDeLaZone(z);
  return zone(rendu, couleur, z, distanceM);
}

/** Les variantes d'un sort de rendu `rendu` teint de `couleur` : son trait qui touche ou manque, son incantation sans
 *  projectile, réussie ou ratée, et sa zone autour de la case `centre` de la cible. */
function variantesDuSort({ rendu, couleur }: { rendu: RenduDef; couleur: string }, de: string, vers: string, distanceM: number, centre: CaseDeZone): EntreeDeVitrine['variantes'] {
  return [
    { variante: 'touche', effet: coup(rendu, couleur, 'touche', de, vers, distanceM, null) },
    { variante: 'manque', effet: coup(rendu, couleur, 'manque', de, vers, distanceM, null) },
    { variante: 'incantation', effet: incantation(rendu, couleur, true, de, vers) },
    { variante: 'incantation-ratee', effet: incantation(rendu, couleur, false, de, vers) },
    { variante: 'zone', effet: zone(rendu, couleur, { de, centre, tiles: discTiles(centre, RAYON_DE_ZONE_DE_LA_VITRINE) }, distanceM) },
  ];
}

/** Les manœuvres qui posent une zone : autour du point visé (`zone`), ou autour de leur auteur. */
const CIBLAGES_DE_ZONE = new Set(['zone', 'allFoes', 'allAround']);

/** La vitrine des effets (`VitrineDesEffets`). Un rendu que porte un sort (un Domaine, le hors Domaine, la Prière), une
 *  manœuvre ou un Type de Souffle se montre parmi eux, jamais parmi les armes ; une arme montre sa parade quand son rendu
 *  en porte une. */
export function vitrineDesEffets(): VitrineDesEffets {
  const de = AUTEUR_DE_LA_VITRINE;
  const vers = CIBLE_DE_LA_VITRINE;
  const distanceM = DISTANCE_DE_LA_VITRINE_M;
  const metresParCase = sceneMetresPerTile(null);
  const caseDeLAuteur: CaseDeZone = { x: 0, y: 0 };
  const caseDeLaCible: CaseDeZone = { x: distanceM / metresParCase, y: 0 };
  const deZone = maneuvers.filter((m) => CIBLAGES_DE_ZONE.has(m.targeting));
  const pasDArme = new Set<string>([
    REPLI.sort, REPLI.priere,
    ...domains.flatMap((d) => (d.rendu ? [d.rendu.id] : [])),
    ...deZone.flatMap((m) => (m.rendu ? [m.rendu.id] : [])),
    ...breathTypes.map((b) => b.rendu.id),
  ]);
  const armes = rendus.filter((r) => !pasDArme.has(r.id)).map((r): EntreeDeVitrine => ({
    id: r.id,
    label: r.label,
    variantes: [
      { variante: 'touche', effet: coup(r, r.couleur, 'touche', de, vers, distanceM, null) },
      { variante: 'manque', effet: coup(r, r.couleur, 'manque', de, vers, distanceM, null) },
      ...(r.paradeVisuel || r.paradeSon ? [{ variante: 'pare' as const, effet: coup(r, r.couleur, 'pare', de, vers, distanceM, r) }] : []),
    ],
  }));
  const horsDomaine = catalogue(REPLI.sort);
  const priere = renduDeLaPriere();
  const sorts: EntreeDeVitrine[] = [
    ...domains.map((d) => ({ id: d.id, label: d.label, variantes: variantesDuSort(renduDuDomaine(d), de, vers, distanceM, caseDeLaCible) })),
    { id: horsDomaine.id, label: horsDomaine.label, variantes: variantesDuSort(renduDuDomaine(undefined), de, vers, distanceM, caseDeLaCible) },
    { id: priere.rendu.id, label: priere.rendu.label, variantes: variantesDuSort(priere, de, vers, distanceM, caseDeLaCible) },
  ];
  const manoeuvres = deZone.map((m): EffetDeVitrine => ({
    id: m.id,
    label: m.label,
    effet: m.targeting === 'zone'
      ? zoneDeLaVitrine(de, caseDeLaCible, { rendu: m.rendu?.id }, distanceM)
      : zoneDeLaVitrine(de, caseDeLAuteur, { rendu: m.rendu?.id }, 0),
  }));
  const souffles = breathTypes.map((b): EffetDeVitrine => ({ id: b.id, label: b.label, effet: zoneDeLaVitrine(de, caseDeLaCible, { rendu: b.rendu.id }, distanceM) }));
  const sons = sonsDEffet.map((d) => ({ id: d.id, label: d.label, effet: { quoi: 'son' as const, son: sonDEffet(d.id)! } }));
  const lumieres = lightTones.map((t) => ({
    id: t.id,
    label: t.label,
    source: sourceDuTon(t, { x: caseDeLaCible.x, y: caseDeLaCible.y, z: 0, hM: FLAME_LIFT_M }, RAYON_DE_LUMIERE_DE_LA_VITRINE),
  }));
  const attaques = Object.fromEntries(siegeEngines().map((t) => {
    const rendu = catalogue(t.rendu?.id ?? REPLI.ranged);
    return [t.id, coup(rendu, rendu.couleur, 'touche', de, vers, distanceM, null)];
  }));
  return { de, vers, distanceM, metresParCase, armes, sorts, manoeuvres, souffles, sons, lumieres, attaques };
}
