/**
 * LES EFFETS D'UN APPEL (#3771), que tout hôte du noyau rend tels quels : chaque coup, chaque incantation, chaque zone
 * d'effet (#3783) et chaque son que l'appel a émis sur le bus (`EVT.ANIM_ATTACK`, `EVT.ANIM_AOE`, `EVT.SFX`), son rendu
 * résolu au catalogue `rendus.json` ; les flottants d'un coup, d'une incantation et du bus (`EVT.ANIM_FLOAT`), le chemin
 * (#3822) et les pas d'un déplacement, le heurt d'un pas refusé, le gong de la victoire et les dés du joueur (#3825). Le rendu d'une arme est celui de son objet, à défaut celui de son Groupe (`subType`) ;
 * celui d'un sort, celui de son Domaine ; une Prière a le sien ; celui d'une manœuvre de zone, le sien, celui d'un Souffle
 * celui de son Type. L'hôte ne décide rien : il dessine la phase et joue le son qu'il reçoit. Aucune conséquence de règle.
 */
import { allMusicDefs } from '../data/sons/musique';
import { breathTypes, conditionLabel, domains, etats, findDomainById, findRenduById, findSpellById, findTrappingById, findWeaponGroupById, lightTones, maneuvers, rendus, siegeEngines, type DomainData, type ManeuverDef, type Projectile, type RenduDef, type VisuelDEffet } from '../data';
import { sonDEffet, sonsDEffet, type SonDEffet } from '../data/sons/registre';
import { castInfoIsPrayer } from '../engine/magic';
import type { Weapon } from '../engine/types';
import { t as tr } from '../i18n';
import type { ChargeDAttaque, ChargeDeZone, ChargesDuBus } from './bus';
import { sourceDuTon, type SourceDeLumiere } from './lumiereDeLaScene';
import type { Jeu } from './etat';
import { porteurParId } from './monde/combatants';
import { musiqueDeLaSelection, type MusiqueDeLaPartie } from './musiqueDeLaPartie';
import { marquesDesEtats, type MarqueDEtat } from './marquesDesEtats';
import { hauteurDe, sceneMetresPerTile } from './monde/scene';
import { FLAME_LIFT_M } from './monde/vision';
import { discTiles, type BattleZone } from './monde/zones';
import { campOf } from '../engine/relations';
import { inBattleId } from './monde/combatants';
import { caseDeZoneEnVue, caseEnVue, corpsEnVue, porteurEnVue } from './visionDuGroupe';
import type { Evenement } from './partie';

/**
 * `suite.effets` (`Effet[]`, `src/noyau/effetsDeLAppel.ts`) est ce que l'appel a joué en coups, incantations, zones,
 * flottants et sons, chacun son rendu résolu au catalogue éditable `src/data/rendus.json` : Godot dessine et joue ce qu'il reçoit,
 * sans rien décider.
 * @contrat Effets
 */
export type Effet =
  /**
   * Un `coup` (une arme, une attaque naturelle, un Projectile magique) va du combattant `de` au combattant `vers` : la
   * phase `depart` joue à l'attaquant (`de`, `depart` et `trajet` valent `null` quand l'attaquant est hors de la vue du
   * groupe : seule l'arrivée se joue), le projectile du `trajet` (`null` en mêlée) vole jusqu'à la cible en `dureeS`
   * secondes, sa cloche haute de `hauteurM` mètres à mi-vol (la vitesse et la cloche de son rendu sur la distance des
   * deux combattants, bornée par un vol le plus court), puis la phase `arrivee` de son `issue` joue sur la cible :
   * l'impact d'une touche ou d'un critique, le manque, ou la parade de l'arme qui a paré. Le rendu d'une arme est celui
   * de son objet (un engin de siège, `trappings.json › rendu`), à défaut celui de son Groupe (`weaponGroups.json ›
   * rendu`) ; celui d'un sort, celui de son Domaine (`domains.json › rendu`), teint de sa `couleur` ; une Prière a le
   * sien.
   */
  | { quoi: 'coup'; de: string | null; vers: string; issue: IssueDuCoup; couleur: string; depart: PhaseRendue | null; trajet: TrajetRendu | null; arrivee: PhaseRendue | null; flottants: Flottant[] }
  /**
   * Une `incantation` (un sort sans projectile : bénédiction, soin, sort sur soi, où `vers` vaut `de`) joue son
   * `depart` au lanceur, puis, `reussie`, son `arrivee` sur sa cible ; `de` et `depart` valent `null` quand le lanceur
   * est hors de la vue du groupe.
   */
  | { quoi: 'incantation'; de: string | null; vers: string; reussie: boolean; couleur: string; depart: PhaseRendue | null; arrivee: PhaseRendue | null; flottants: Flottant[] }
  /**
   * Une `zone` (un sort de zone, un souffle, une manœuvre de zone, #3783) part de l'auteur `de` : la phase `depart` y
   * joue, le projectile du `trajet` (`null` quand la zone se centre sur l'auteur) vole jusqu'à la case `centre`, puis
   * la phase `nappe` pose son visuel sur chacune des `cases` et joue son son au centre. Son rendu est celui de son sort
   * (le Domaine, teint de sa couleur), sinon celui de la manœuvre (`maneuvers.json › rendu`), le souffle d'une créature
   * prenant celui de son Type de Souffle (`breath-types.json › rendu`) ; sa `nappe` est le `zoneVisuel` et le `zoneSon`
   * du rendu, à défaut son impact. Godot reçoit le lieu de chaque case sous la clé `x,y,z` (`Effets.cle_de_case`).
   * Ses `cases` sont celles que le groupe voit ; `de`, `depart` et `trajet` valent `null` quand l'auteur est hors de vue.
   */
  | { quoi: 'zone'; de: string | null; centre: CaseDEffet; cases: CaseDEffet[]; couleur: string; depart: PhaseRendue | null; trajet: TrajetRendu | null; nappe: PhaseRendue | null }
  /**
   * Les `flottants` d'un coup ou d'une incantation montent de la cible à son arrivée, l'un après l'autre : les Blessures
   * perdues (`-N`, à la teinte du critique sur un critique), « Encaissé » sans Blessure, « Paré / Esquivé » ou « Raté »
   * sur un manque, « ✦ hors de combat » quand la cible tombe, « Incantation ratée » ; un `flottant` du bus (l'événement
   * `anim_float` : un soin, une déviation, un État) monte du combattant `sur`, à défaut de la case `case`, comme le nom
   * d'un État gagné pendant l'appel (`etatGagne`, #3834) au-dessus de son porteur. Son texte
   * vient des messages du jeu (`src/i18n`), sa `couleur` de `TEINTE_DU_FLOTTANT` ; un flottant `critique` s'écrit plus
   * grand.
   */
  | { quoi: 'flottant'; sur: string | null; case: CaseDEffet | null; flottant: Flottant }
  /**
   * Un `son` joue partout, `fois` fois à `ecartS` secondes d'écart : un son de scène (l'Effet de scène `playSfx`), les
   * pas d'un déplacement (un par deux cases, quatre au plus), le heurt d'un pas refusé, le gong d'une victoire, les dés
   * d'un jet que l'hôte lance ou relance (`jetLancer`, `jetRelancer`) ; leurs ids sont `SONS_DE_LA_PARTIE`.
   */
  | { quoi: 'son'; son: SonDEffet; fois: number; ecartS: number }
  /**
   * Un `deplacement` (#3822, l'événement `anim_move`) est le chemin que le combattant `qui` a parcouru, en exploration
   * comme en combat, sauts, escalades et changements de couche compris : chacune de ses `cases` (`CaseDuChemin`, sa
   * couche `z` toujours dite), de celle qu'il quitte à celle où la vue le pose, et les `metres` qui la séparent de la
   * précédente, la distance de leurs sols (0 pour la première). Un déplacement d'une seule case n'en rend aucun. Godot
   * fait parcourir à son combattant le lieu de chaque case (`Monde.lieu`, station d'un navire comprise), en ligne droite
   * de l'une à l'autre, tourné à l'horizontale vers celle qu'il gagne, chaque pas au clip `walk` et en `metres` divisés
   * par la vitesse au sol de sa base (`vitesseAuSol`, section « Atelier 3D ») multipliée par `echelleDeVitesse` de son
   * gabarit, en `DUREE_DEPLACEMENT_S` sans base posée. Le chemin d'un combattant hors du camp du groupe n'en garde que
   * la fin que le groupe voit case à case.
   */
  | { quoi: 'deplacement'; qui: string; cases: CaseDuChemin[] };

/**
 * Une phase rendue : le visuel que l'hôte dessine à son point, le son qu'il y joue.
 * @contrat Effets
 */
export interface PhaseRendue {
  /** le visuel que l'hôte dessine à son point (`VisuelDEffet` : `src/data/schemas/defs/effets.ts`). */
  visuel: VisuelDEffet | null;
  /** le son qu'il y joue. */
  son: SonDEffet | null;
}

/**
 * Le vol d'un projectile jusqu'à la cible.
 * @contrat Effets
 */
export interface TrajetRendu {
  /** le projectile qui vole. */
  projectile: Projectile;
  /** sa durée (s), à la vitesse de son rendu sur la distance des deux combattants. */
  dureeS: number;
  /** la hauteur (m) de sa cloche. */
  hauteurM: number;
}

export type IssueDuCoup = 'touche' | 'critique' | 'pare' | 'manque';

/** Une case d'un effet : (x, y) et sa couche. */
export type CaseDEffet = ChargeDeZone['centre'];

/** Un effet tel que `effetsEmis` le rend, avant la vue du groupe (`aLaVueDuGroupe`) : son auteur `de` toujours nommé. */
type EffetEmis = Exclude<Effet, { de: string | null }> | (Extract<Effet, { de: string | null }> & { de: string });

/** Une case du chemin d'un déplacement, et les mètres qui la séparent de la précédente : la distance de leurs sols
 *  (`hauteurDe`), 0 pour la première. */
export type CaseDuChemin = CaseDEffet & { metres: number };

/** Le genre d'un flottant : celui d'un retour du bus (`EVT.ANIM_FLOAT`), ou l'issue d'un coup (`encaisse`, `defense` : paré
 *  ou esquivé, `horsDeCombat`). */
export type GenreDeFlottant = ChargesDuBus['anim_float']['kind'] | 'encaisse' | 'defense' | 'horsDeCombat';

/** La teinte du flottant de chaque genre. */
export const TEINTE_DU_FLOTTANT: Record<GenreDeFlottant, string> = {
  blessures: '#ff5a5a', encaisse: '#b8b8c0', rate: '#b8b8c0', defense: '#6fb6ff', horsDeCombat: '#ff3030', soin: '#6fce8e', etat: '#e0b050',
};
/** La teinte du flottant des Blessures d'un Coup Critique. */
export const TEINTE_DU_CRITIQUE = '#ffd166';

/**
 * Un texte qui flotte au-dessus d'un combattant ou d'une case, à la teinte de son genre ; `critique` le grossit.
 * @contrat Effets
 */
export interface Flottant {
  /** son genre (`GenreDeFlottant`) : celui d'un retour du bus, ou l'issue d'un coup. */
  genre: GenreDeFlottant;
  /** le texte qui flotte. */
  texte: string;
  /** la teinte de son genre (`TEINTE_DU_FLOTTANT`), celle du critique (`TEINTE_DU_CRITIQUE`) sur un critique. */
  couleur: string;
  /** grossit le texte : les Blessures d'un Coup Critique. */
  critique: boolean;
}

/** Le son de chaque retour de la partie, par son id au registre (`src/data/sons/defs/`) : un pas, le heurt d'un pas
 *  refusé, la victoire, les dés que le joueur lance. */
export const SONS_DE_LA_PARTIE = { pas: 'pas', heurt: 'heurt', victoire: 'gong-victoire', des: 'des' } as const;

/** Les pas d'un déplacement : un par `CASES_PAR_PAS` cases de son chemin, entre un et `PAS_MAX`, `ECART_DES_PAS_S`
 *  secondes l'un après l'autre. */
const CASES_PAR_PAS = 2;
const PAS_MAX = 4;
const ECART_DES_PAS_S = 0.22;

/** Le déplacement de `qui` sur `chemin`, sur des cases de `metresParCase` mètres dont `sol` rend la hauteur (m). */
const deplacement = (qui: string, chemin: readonly CaseDEffet[], metresParCase: number, sol: (c: CaseDEffet) => number): EffetEmis => ({
  quoi: 'deplacement',
  qui,
  cases: chemin.map((c, i) => ({
    x: c.x, y: c.y, z: c.z ?? 0,
    metres: i === 0 ? 0 : Math.hypot((c.x - chemin[i - 1].x) * metresParCase, (c.y - chemin[i - 1].y) * metresParCase, sol(c) - sol(chemin[i - 1])),
  })),
});

/** Le son d'id `id` (`SONS_DE_LA_PARTIE`) joué `fois` fois, `ecartS` secondes l'un après l'autre. */
const son = (id: string, fois = 1, ecartS = 0): EffetEmis => ({ quoi: 'son', son: sonDEffet(id)!, fois, ecartS });

/** Le flottant de genre `genre` qui dit `texte`, à la teinte du critique pour les Blessures d'un Coup Critique. */
const flottant = (genre: GenreDeFlottant, texte: string, critique = false): Flottant =>
  ({ genre, texte, couleur: critique ? TEINTE_DU_CRITIQUE : TEINTE_DU_FLOTTANT[genre], critique });

/** Ce qu'une touche rend lisible : touchée, ses Blessures (ou encaissée sans Blessure), hors de combat ; manquée, paré
 *  ou esquivé quand la cible s'est défendue, raté sinon. */
interface BilanDeTouche {
  hit?: boolean;
  woundsLost?: number;
  defenderDefeated?: boolean;
}

/** Les flottants de la touche `r` : `critique` d'un Coup Critique, `defendue` quand la cible s'est défendue. */
function flottantsDeLaTouche(r: BilanDeTouche, critique: boolean, defendue: boolean): Flottant[] {
  if (!r.hit) return [defendue ? flottant('defense', tr('fx.pareOuEsquive')) : flottant('rate', tr('fx.rate'))];
  return [
    (r.woundsLost ?? 0) > 0 ? flottant('blessures', tr('fx.blessures', { n: r.woundsLost! }), critique) : flottant('encaisse', tr('fx.encaisse')),
    ...(r.defenderDefeated ? [flottant('horsDeCombat', tr('fx.horsDeCombat'))] : []),
  ];
}

/** Le flottant d'une incantation ratée. */
const incantationRatee = (): Flottant => flottant('rate', tr('fx.incantationRatee'));

/** Les rendus de repli : une arme de mêlée, de tir, naturelle, sans rendu propre ni de Groupe ; un sort hors Domaine ;
 *  une Prière. */
const REPLI = { melee: 'arme-blanche', distance: 'jet', naturelle: 'attaque-naturelle', sort: 'sort-arcane', priere: 'priere' } as const;

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
  return sort && castInfoIsPrayer(sort) ? renduDeLaPriere() : renduDuDomaine(findDomainById(sort?.domainId?.id));
}

/** La durée de vol (s) la plus courte, qu'un vol à bout portant garde visible. */
const VOL_MINIMAL_S = 0.08;

/** Le trajet du rendu `r` sur `distanceM` mètres, nul sans projectile. */
const trajet = (r: RenduDef, distanceM: number): TrajetRendu | null =>
  r.projectile ? { projectile: r.projectile, dureeS: Math.max(distanceM / r.vitesseMs!, VOL_MINIMAL_S), hauteurM: r.cloche! * distanceM } : null;

/** Le coup du rendu `rendu`, teint de `couleur`, de `de` à `vers` à `distanceM` mètres, à l'issue `issue`, aux
 *  flottants `flottants` : sa phase d'arrivée est l'impact, le manque, ou la parade du rendu `parade` de l'arme qui a
 *  paré. */
function coup(rendu: RenduDef, couleur: string, issue: IssueDuCoup, de: string, vers: string, distanceM: number, parade: RenduDef | null, flottants: Flottant[]): EffetEmis {
  const arrivee = parade ? phase(parade.paradeVisuel, parade.paradeSon) : arriveeDe(rendu, issue === 'manque');
  return { quoi: 'coup', de, vers, issue, couleur, depart: depart(rendu), trajet: trajet(rendu, distanceM), arrivee, flottants };
}

/** L'incantation du rendu `rendu`, teinte de `couleur`, de `de` sur `vers`, sa phase d'arrivée nulle et son flottant dit
 *  quand elle échoue. */
const incantation = (rendu: RenduDef, couleur: string, reussie: boolean, de: string, vers: string): EffetEmis =>
  ({ quoi: 'incantation', de, vers, reussie, couleur, depart: depart(rendu), arrivee: reussie ? arriveeDe(rendu, false) : null, flottants: reussie ? [] : [incantationRatee()] });

/** La zone `z` du rendu `rendu`, teinte de `couleur`, dont l'auteur est à `distanceM` mètres du centre : sa nappe est
 *  la phase de zone du rendu, à défaut celle de son impact. */
function zone(rendu: RenduDef, couleur: string, z: ChargeDeZone, distanceM: number): EffetEmis {
  return {
    quoi: 'zone', de: z.de, centre: z.centre, cases: z.tiles, couleur, depart: depart(rendu),
    trajet: distanceM > 0 ? trajet(rendu, distanceM) : null,
    nappe: phase(rendu.zoneVisuel ?? rendu.impactVisuel, rendu.zoneSon ?? rendu.impactSon),
  };
}

/** Le rendu de la zone `z` et sa teinte : celui de son sort, celui de sa manœuvre, à défaut le repli d'un sort hors
 *  Domaine. */
export function renduDeLaZone(z: Pick<ChargeDeZone, 'sort' | 'rendu'>): { rendu: RenduDef; couleur: string } {
  if (z.sort) return renduDuSort(z.sort);
  const rendu = catalogue(z.rendu ?? REPLI.sort);
  return { rendu, couleur: rendu.couleur };
}

/**
 * Une zone qui dure (`vue.zonesQuiDurent`, `zonesQuiDurentEnVue`, `battle.zones`, #3834) se voit tant qu'elle dure : celle d'un sort au rendu
 * de son Domaine, la fumée d'un Souffle au rendu de son Type, une zone de scène à son `rendu` ; sans rendu, elle ne se
 * voit pas.
 * @contrat Effets
 */
export interface ZoneQuiDure {
  /** la nomme d'une vue à l'autre, celle de la zone entière : une zone déjà posée reste posée. */
  cle: string;
  /** ses cases que le groupe voit (`caseDeZoneEnVue`), chacune à sa couche ; une zone sans aucune n'est pas servie. */
  cases: CaseDEffet[];
  /** celle de ses `cases` la plus proche de leur barycentre, où joue sa `boucle`. */
  centre: CaseDEffet;
  /** sa teinte `#rrggbb`. */
  couleur: string;
  /** le visuel posé en continu sur chacune de ses cases (`zoneVisuel` de son rendu, à défaut son impact). */
  visuel: VisuelDEffet | null;
  /** le son qu'elle joue en boucle (`rendus.json › zoneBoucle`) ; `null` : aucun. */
  boucle: SonDEffet | null;
}

/** Le rendu de la zone persistante `z` et sa teinte : le sien (une zone de scène, la fumée d'un Souffle), celui de son
 *  sort ; `null` sans l'un ni l'autre, une zone qui ne se voit pas. */
function renduDeLaZoneQuiDure(z: BattleZone): { rendu: RenduDef; couleur: string } | null {
  if (z.rendu) return renduDeLaZone({ rendu: z.rendu.id });
  return z.source?.kind === 'sort' ? renduDuSort(z.source.id) : null;
}

/** La case des cases `cases` la plus proche de leur barycentre. */
function caseCentrale(cases: readonly CaseDEffet[]): CaseDEffet {
  const mx = cases.reduce((a, c) => a + c.x, 0) / cases.length;
  const my = cases.reduce((a, c) => a + c.y, 0) / cases.length;
  return cases.reduce((m, c) => (Math.hypot(c.x - mx, c.y - my) < Math.hypot(m.x - mx, m.y - my) ? c : m));
}

/** Les zones qui durent de `etat` (`battle.zones`) telles que le groupe les voit (`caseDeZoneEnVue`) : `vue.zonesQuiDurent`. */
export function zonesQuiDurentEnVue(etat: Jeu): ZoneQuiDure[] {
  return zonesQuiDurent(etat.battle?.zones ?? [], caseDeZoneEnVue(etat));
}

/** Celles des zones persistantes `zones` (`battle.zones`) qui se voient, chacune à son rendu, réduite à ses cases que
 *  `montree` montre : la nappe de son rendu (son visuel de zone, à défaut celui de son impact) et son son de zone qui
 *  dure. Sa clé se lit sur la zone entière. */
function zonesQuiDurent(zones: readonly BattleZone[], montree: (c: CaseDEffet) => boolean): ZoneQuiDure[] {
  const vues = new Map<string, number>();
  return zones.flatMap((z): ZoneQuiDure[] => {
    const r = renduDeLaZoneQuiDure(z);
    if (!r || !z.tiles.length) return [];
    const milieu = caseCentrale(z.tiles);
    const base = `${z.id ?? z.rendu?.id ?? z.source?.id}@${milieu.x},${milieu.y},${milieu.z ?? 0}`;
    const rang = vues.get(base) ?? 0;
    vues.set(base, rang + 1);
    const cases = z.tiles.filter(montree);
    if (!cases.length) return [];
    return [{
      cle: rang ? `${base}#${rang}` : base, cases, centre: caseCentrale(cases), couleur: r.couleur,
      visuel: r.rendu.zoneVisuel ?? r.rendu.impactVisuel ?? null,
      boucle: r.rendu.zoneBoucle ? sonDEffet(r.rendu.zoneBoucle.id) : null,
    }];
  });
}

/** L'effet de l'attaque `a`, entre deux combattants posés à `distanceM` mètres l'un de l'autre. */
function effetDeLAttaque(a: Exclude<ChargeDAttaque, { kind: 'creature' }>, distanceM: number): EffetEmis {
  if (a.kind === 'spell') {
    const { rendu, couleur } = renduDuSort(a.spell);
    if (!a.projectile) return incantation(rendu, couleur, a.result.cast, a.from, a.to);
    const issue: IssueDuCoup = !a.result.hit ? 'manque' : (a.result.critiques ?? 0) > 0 ? 'critique' : 'touche';
    const flottants = a.result.cast ? flottantsDeLaTouche(a.result, issue === 'critique', false) : [incantationRatee()];
    return coup(rendu, couleur, issue, a.from, a.to, distanceM, null, flottants);
  }
  const rendu = renduDeLArme(a.weapon);
  const pare = !a.result.hit && a.parryWeapon !== undefined;
  const issue: IssueDuCoup = a.result.hit ? (a.result.critical ? 'critique' : 'touche') : pare ? 'pare' : 'manque';
  const flottants = flottantsDeLaTouche(a.result, issue === 'critique', a.defense !== 'aucune');
  return coup(rendu, rendu.couleur, issue, a.from, a.to, distanceM, pare ? renduDeLArme(a.parryWeapon!) : null, flottants);
}

/** Les mètres qui séparent les combattants `de` et `vers` de `etat` sur le plateau de sa scène, `null` quand l'un n'y est
 *  pas posé. */
function distanceDesCombattants(etat: Jeu, de: string, vers: string): number | null {
  const a = porteurParId(etat, de)?.pos;
  const b = porteurParId(etat, vers)?.pos;
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) * sceneMetresPerTile(etat.scene) : null;
}

/**
 * - Un coup, une incantation ou une zone dont un combattant n'est pas posé sur le plateau, ou l'attaque spéciale d'une
 *   créature sur elle-même, ne rend aucun effet.
 * - Ce que le groupe ne voit pas ne se montre pas (`src/noyau/visionDuGroupe.ts`) : un coup ou une incantation sur une
 *   cible hors de vue, un flottant sur un combattant hors de vue ou sur une case que le groupe ne voit pas, une zone
 *   dont il ne voit aucune case, le déplacement d'un combattant qui finit hors de vue ne rendent aucun effet. Une zone
 *   qui coupe la vue se montre entière dès que le groupe en voit le bord (`caseDeZoneEnVue`).
 * - `couleur` (`#rrggbb`) teint les visuels qui prennent la teinte de l'effet. Un son nomme ses variantes, des noms nus
 *   que Godot lit sous `res://sons/` et joue l'une à son tour (`Effets.variante_du_son`), le dossier épinglé des sons
 *   (`projet/sons/provenance.json`, `hotes/godot/asset/epingles.ts`), et son `volume` propre (0..1).
 * @contrat Effets
 */
/** Les effets des événements `evenements` d'un appel (`ResultatDeLAppel.evenements`) sur l'état `etat` qui le suit, dans
 *  leur ordre, chacun tel que le groupe le voit (`aLaVueDuGroupe`). */
export function effetsDeLAppel(etat: Jeu, evenements: readonly Evenement[]): Effet[] {
  return effetsEmis(etat, evenements).flatMap((e) => aLaVueDuGroupe(etat, e));
}

/** Les effets des événements `evenements` sur l'état `etat`, dans leur ordre ; un coup, une incantation ou une zone dont
 *  un combattant n'est pas posé, ou l'attaque spéciale d'une créature sur elle-même, n'en rend aucun. Un déplacement
 *  rend son chemin quand il quitte sa case, puis ses pas ; un pas refusé son heurt, la victoire son gong, les dés du
 *  joueur (`EVT.DICE_ROLL`) leur son ; un État gagné, son flottant sur son porteur. */
function effetsEmis(etat: Jeu, evenements: readonly Evenement[]): EffetEmis[] {
  return evenements.flatMap((e): EffetEmis[] => {
    if (e.type === 'etatGagne') return [{ quoi: 'flottant', sur: e.porteur, case: null, flottant: flottant('etat', conditionLabel(e.etat)) }];
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
    if (e.evt === 'anim_float') return [{ quoi: 'flottant', sur: e.payload.to ?? null, case: e.payload.pos ?? null, flottant: flottant(e.payload.kind, e.payload.text) }];
    if (e.evt === 'anim_move') {
      const { scene } = etat;
      const parcours = scene && e.payload.path.length > 1 ? [deplacement(e.payload.id, e.payload.path, sceneMetresPerTile(scene), (c) => hauteurDe(scene, c))] : [];
      return [...parcours, son(SONS_DE_LA_PARTIE.pas, Math.min(PAS_MAX, Math.max(1, Math.floor(e.payload.path.length / CASES_PAR_PAS))), ECART_DES_PAS_S)];
    }
    if (e.evt === 'move_blocked') return [son(SONS_DE_LA_PARTIE.heurt)];
    if (e.evt === 'battle_over') return e.payload.victory ? [son(SONS_DE_LA_PARTIE.victoire)] : [];
    if (e.evt === 'dice_roll') return [son(SONS_DE_LA_PARTIE.des)];
    if (e.evt === 'sfx') return sonDEffet(e.payload.id) ? [son(e.payload.id)] : [];
    return [];
  });
}

/** L'effet `e` tel que le groupe le voit sur `etat` (#3950) : sans lui quand sa cible, son porteur ou toutes ses cases
 *  (d'une zone : `caseDeZoneEnVue`) sont hors de vue ; sans auteur (`de`, son départ et son trajet) quand l'auteur l'est ; le chemin d'un combattant
 *  hors du camp du groupe réduit à la fin où son corps, ancré à chaque case, est vu (`corpsEnVue`), la première à 0 m.
 *  Un son se rend tel quel. */
function aLaVueDuGroupe(etat: Jeu, e: EffetEmis): Effet[] {
  const enVue = (id: string) => porteurEnVue(etat, id);
  if (e.quoi === 'coup') {
    if (!enVue(e.vers)) return [];
    return [enVue(e.de) ? e : { ...e, de: null, depart: null, trajet: null }];
  }
  if (e.quoi === 'incantation') {
    if (!enVue(e.vers)) return [];
    return [enVue(e.de) ? e : { ...e, de: null, depart: null }];
  }
  if (e.quoi === 'zone') {
    const cases = e.cases.filter(caseDeZoneEnVue(etat));
    if (!cases.length) return [];
    const auteur = enVue(e.de) ? {} : { de: null, depart: null, trajet: null };
    return [{ ...e, ...auteur, cases }];
  }
  if (e.quoi === 'flottant') {
    if (e.sur !== null) return enVue(e.sur) ? [e] : [];
    return e.case === null || caseEnVue(etat, e.case) ? [e] : [];
  }
  if (e.quoi === 'deplacement') {
    if (!enVue(e.qui)) return [];
    const qui = inBattleId(etat.battle, e.qui);
    if (!qui || campOf(qui) === 'groupe') return [e];
    let debut = e.cases.length;
    while (debut > 0 && corpsEnVue(etat, qui, e.cases[debut - 1])) debut--;
    const fin = e.cases.slice(debut);
    return fin.length < 2 ? [] : [{ ...e, cases: fin.map((c, i) => (i === 0 ? { ...c, metres: 0 } : c)) }];
  }
  return [e];
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

/**
 * La vitrine (`vitrine`, #3777) donne à l'atelier chaque effet que le jeu joue, de l'auteur `de`, en case (0, 0), à la
 * cible `vers` posée à `distanceM` mètres, des cases de `metresParCase` mètres, chacun résolu comme en combat :
 * @contrat Effets
 */
export interface VitrineDesEffets {
  /** l'auteur, en case (0, 0). */
  de: string;
  /** la cible, en case (`distanceM` / `metresParCase`, 0). */
  vers: string;
  /** les mètres qui séparent l'auteur de la cible. */
  distanceM: number;
  /** les mètres du côté d'une case. */
  metresParCase: number;
  /**
   * chaque rendu d'arme (`{ id, label, variantes }`), ses variantes `touche`, `manque`, et `pare` quand son rendu porte
   * une parade ;
   */
  armes: EntreeDeVitrine[];
  /**
   * chaque Domaine, le sort hors Domaine et la Prière, leurs variantes `touche` et `manque` (le trait) puis
   * `incantation` et `incantation-ratee` (sans projectile), puis `zone`, centrée sur la case de la cible ; un rendu de
   * sort ne se montre jamais parmi les armes ;
   */
  sorts: EntreeDeVitrine[];
  /**
   * chaque manœuvre de zone (`{ id, label, effet }`), centrée sur la cible si elle vise une zone, sinon sur l'auteur ;
   */
  manoeuvres: EffetDeVitrine[];
  /** chaque Type de Souffle, sa zone centrée sur la cible ; aucun rendu de zone ne se montre parmi les armes ; */
  souffles: EffetDeVitrine[];
  /** chaque son d'effet du registre (`{ id, label, effet }`), musique exclue ; */
  sons: EffetDeVitrine[];
  /** chaque ton de lumière (`{ id, label, source }`), sa source posée au lieu de la cible (section « Lumière ») ; */
  lumieres: { id: string; label: string; source: SourceDeLumiere }[];
  /**
   * par id d'objet, le coup qui touche de chaque engin de siège, résolu par le rendu de son objet, celui que l'atelier
   * joue quand l'engin posé attaque ;
   */
  attaques: Record<string, Effet>;
  /** chaque genre de flottant et le critique (`{ id, label, effet }`), un `flottant` sur la cible ; */
  flottants: EffetDeVitrine[];
  /** chaque musique du registre (`{ id, label, musique }`, `musique` comme `vue.musique`, section « Musique ») ; */
  musiques: { id: string; label: string; musique: MusiqueDeLaPartie }[];
  /** chaque rendu qu'une zone qui dure peut porter (`{ id, label, zone }`), sa zone posée autour de la cible (#3834) ; */
  zonesQuiDurent: { id: string; label: string; zone: ZoneQuiDure }[];
  /** chaque État (`{ id, label, marque }`), sa marque à la valeur 1, comme `vue.marques` (#3834) ; */
  marques: { id: string; label: string; marque: MarqueDEtat }[];
  /**
   * le déplacement de l'auteur sur un chemin qui tourne depuis sa case, que la base posée parcourt à « Parcourir un
   * chemin » (onglet Animation).
   */
  deplacement: Effet;
}

const AUTEUR_DE_LA_VITRINE = 'auteur';
const CIBLE_DE_LA_VITRINE = 'cible';
const DISTANCE_DE_LA_VITRINE_M = 12;
/** Le rayon (cases) d'une zone de la vitrine, et celui qu'éclaire une lumière de la vitrine. */
const RAYON_DE_ZONE_DE_LA_VITRINE = 1;
const RAYON_DE_LUMIERE_DE_LA_VITRINE = 5;
/** Les Blessures et le soin que montrent les flottants de la vitrine. */
const BLESSURES_DE_LA_VITRINE = 3;
/** Le chemin que l'auteur de la vitrine parcourt depuis sa case, sur le sol plat de la vitrine. */
const CHEMIN_DE_LA_VITRINE: readonly CaseDEffet[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }];

/** Les flottants de la touche de la vitrine à l'issue `issue`. */
const flottantsDeLaVitrine = (issue: IssueDuCoup): Flottant[] =>
  flottantsDeLaTouche({ hit: issue === 'touche' || issue === 'critique', woundsLost: BLESSURES_DE_LA_VITRINE }, issue === 'critique', issue === 'pare');

/** La zone de la vitrine que `de` pose autour de la case `centre`, au rendu de `origine` (`renduDeLaZone`), l'auteur à
 *  `distanceM` mètres du centre. */
function zoneDeLaVitrine(de: string, centre: CaseDEffet, origine: Pick<ChargeDeZone, 'sort' | 'rendu'>, distanceM: number): Effet {
  const z: ChargeDeZone = { de, centre, tiles: discTiles(centre, RAYON_DE_ZONE_DE_LA_VITRINE), ...origine };
  const { rendu, couleur } = renduDeLaZone(z);
  return zone(rendu, couleur, z, distanceM);
}

/** Les variantes d'un sort de rendu `rendu` teint de `couleur` : son trait qui touche ou manque, son incantation sans
 *  projectile, réussie ou ratée, et sa zone autour de la case `centre` de la cible. */
function variantesDuSort({ rendu, couleur }: { rendu: RenduDef; couleur: string }, de: string, vers: string, distanceM: number, centre: CaseDEffet): EntreeDeVitrine['variantes'] {
  return [
    { variante: 'touche', effet: coup(rendu, couleur, 'touche', de, vers, distanceM, null, flottantsDeLaVitrine('touche')) },
    { variante: 'manque', effet: coup(rendu, couleur, 'manque', de, vers, distanceM, null, flottantsDeLaVitrine('manque')) },
    { variante: 'incantation', effet: incantation(rendu, couleur, true, de, vers) },
    { variante: 'incantation-ratee', effet: incantation(rendu, couleur, false, de, vers) },
    { variante: 'zone', effet: zone(rendu, couleur, { de, centre, tiles: discTiles(centre, RAYON_DE_ZONE_DE_LA_VITRINE) }, distanceM) },
  ];
}

/** Les manœuvres qui posent une zone : autour du point visé (`zone`), ou autour de leur auteur. */
const CIBLAGES_DE_ZONE = new Set<ManeuverDef['ciblage']>(['zone', 'adversairesAutour', 'toutAutour']);

/** La vitrine des effets (`VitrineDesEffets`). Un rendu que porte un sort (un Domaine, le hors Domaine, la Prière), une
 *  manœuvre ou un Type de Souffle se montre parmi eux, jamais parmi les armes ; une arme montre sa parade quand son rendu
 *  en porte une. */
export function vitrineDesEffets(): VitrineDesEffets {
  const de = AUTEUR_DE_LA_VITRINE;
  const vers = CIBLE_DE_LA_VITRINE;
  const distanceM = DISTANCE_DE_LA_VITRINE_M;
  const metresParCase = sceneMetresPerTile(null);
  const caseDeLAuteur: CaseDEffet = { x: 0, y: 0 };
  const caseDeLaCible: CaseDEffet = { x: distanceM / metresParCase, y: 0 };
  const deZone = maneuvers.filter((m) => CIBLAGES_DE_ZONE.has(m.ciblage));
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
      { variante: 'touche', effet: coup(r, r.couleur, 'touche', de, vers, distanceM, null, flottantsDeLaVitrine('touche')) },
      { variante: 'manque', effet: coup(r, r.couleur, 'manque', de, vers, distanceM, null, flottantsDeLaVitrine('manque')) },
      ...(r.paradeVisuel || r.paradeSon ? [{ variante: 'pare' as const, effet: coup(r, r.couleur, 'pare', de, vers, distanceM, r, flottantsDeLaVitrine('pare')) }] : []),
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
    effet: m.ciblage === 'zone'
      ? zoneDeLaVitrine(de, caseDeLaCible, { rendu: m.rendu?.id }, distanceM)
      : zoneDeLaVitrine(de, caseDeLAuteur, { rendu: m.rendu?.id }, 0),
  }));
  const souffles = breathTypes.map((b): EffetDeVitrine => ({ id: b.id, label: b.label, effet: zoneDeLaVitrine(de, caseDeLaCible, { rendu: b.rendu.id }, distanceM) }));
  const sons = sonsDEffet.map((d): EffetDeVitrine => ({ id: d.id, label: d.label, effet: son(d.id) }));
  const lumieres = lightTones.map((t) => ({
    id: t.id,
    label: t.label,
    source: sourceDuTon(t, { cle: t.id, x: caseDeLaCible.x, y: caseDeLaCible.y, z: 0, hM: FLAME_LIFT_M }, RAYON_DE_LUMIERE_DE_LA_VITRINE),
  }));
  const attaques = Object.fromEntries(siegeEngines().map((t) => {
    const rendu = catalogue(t.rendu?.id ?? REPLI.distance);
    return [t.id, coup(rendu, rendu.couleur, 'touche', de, vers, distanceM, null, flottantsDeLaVitrine('touche'))];
  }));
  const echantillons: [string, Flottant][] = [
    ['blessures', flottant('blessures', tr('fx.blessures', { n: BLESSURES_DE_LA_VITRINE }))],
    ['critique', flottant('blessures', tr('fx.blessures', { n: BLESSURES_DE_LA_VITRINE }), true)],
    ['encaisse', flottant('encaisse', tr('fx.encaisse'))],
    ['rate', flottant('rate', tr('fx.rate'))],
    ['defense', flottant('defense', tr('fx.pareOuEsquive'))],
    ['horsDeCombat', flottant('horsDeCombat', tr('fx.horsDeCombat'))],
    ['soin', flottant('soin', tr('fx.soin', { n: BLESSURES_DE_LA_VITRINE }))],
    ['etat', flottant('etat', etats[0].label)],
  ];
  const flottants = echantillons.map(([id, f]): EffetDeVitrine => ({ id, label: f.texte, effet: { quoi: 'flottant', sur: vers, case: null, flottant: f } }));
  const musiques = allMusicDefs().map((d) => ({ id: d.id, label: d.label, musique: musiqueDeLaSelection({ def: d.id })! }));
  const casesDeLaZone = discTiles(caseDeLaCible, RAYON_DE_ZONE_DE_LA_VITRINE);
  const zones = rendus.filter((r) => r.zoneVisuel ?? r.impactVisuel).map((r) => ({
    id: r.id,
    label: r.label,
    zone: zonesQuiDurent([{ label: r.label, tiles: casesDeLaZone, rounds: 1, rendu: { id: r.id } }], () => true)[0],
  }));
  const marques = etats.map((e) => ({ id: e.id, label: e.label, marque: marquesDesEtats([{ id: e.id, valeur: 1 }])[0] }));
  return { de, vers, distanceM, metresParCase, armes, sorts, manoeuvres, souffles, sons, lumieres, attaques, flottants, musiques, zonesQuiDurent: zones, marques, deplacement: deplacement(de, CHEMIN_DE_LA_VITRINE, metresParCase, () => 0) };
}
