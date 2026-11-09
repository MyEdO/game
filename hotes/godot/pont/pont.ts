/**
 * LE PONT DE L'HÔTE GODOT (#2928, contrat `CONTRAT.md`) : le transport JSON entre Godot et le noyau. Une méthode reçoit
 * au plus une chaîne JSON et rend toujours une chaîne JSON, `{ ok: true, … }` ou `{ ok: false, erreur }` ; elle ne lève
 * jamais. Le pont ne porte aucune règle : un geste passe par le module commun des hôtes (`src/hote/`), la vue est faite
 * des lecteurs du noyau, les jetons programmés sont tenus par numéro et rejoués quand Godot les rend. Le panneau que
 * l'écran tient ouvert, un seul à la fois (la fiche d'un combattant en statbloc, la création d'un héros), est un état
 * du pont, que les méthodes `fiche` et `creation` posent, jamais de la partie ; seul
 * l'engagement du héros créé la touche, et l'Effet de scène qui demande un héros neuf
 * (`demandeUnHeros`) ouvre la création comme « Nouveau héros ». Les modèles servis (`modeles`) sont un état du pont
 * aussi, que l'atelier et le combat lisent : chaque combattant dessiné se compose sur la base comme une composition de
 * l'atelier (`composerSurLaBase`).
 */
import { CLIC_DU_CHAMP, brouillonDeLaPartie, cataloguesDeComposition, ficheDuPorteur, editer, intentionDEngagement, ouvrirLEdition, projetDuDepot, essaiDeLaScene, texteAEnregistrer, pagesDeCreation, sceneEditee, FIRE_ARCS, ficheDEntite, libelleDuBord, lireApparenceDAuteur, lireComposition, lireSurchargesDEmblemes, siegeEngines, vehiculeDuCombattant, type FireArc, lumiereDeLaScene, effetsDeLAppel, vitrineDesEffets, type Effet, type VitrineDesEffets, meteoDuRegard, aretesDeLaCouche, naviresDeLaScene, stationsDuNavire, type EmprisesDesCases, type NavireDeLaScene, type StationDeNavire, casesDuGroupe, plateauDeLaScene, regardDuJeu, REGARDS, volumeDuRegard, type Regard, porteeDeComposition, presetDeComposition, couronnesDuMonde, toitsDuMonde, volumeDuMonde, type Composition, type GesteDEdition, type Scene, type SessionDEdition, type LectureAuSchema, type LigneDuJournal, type LumiereDeLaScene, type ProjectDoc, type Programme, type ResultatDeLAppel, type VehiculeDuCombattant, type EmblemeResolu } from '../../../src/noyau/index';
import { ErreurDeGeste, nouvelEntete, nouvellesEntrees, ouvrirLaPartie, ouvrirLeLancement, valider, type CategorieDErreur, type PartieOuverte } from '../../../src/hote/partie';
import { envoyerLIntention, gesteDuVerbe, intentionDuGeste, SANS_PISTE } from '../../../src/hote/geste';
import { casesAtteignables, projeter, type BornesDeLaProjection, type CaseAtteignable, type Projection } from '../../../src/hote/projection';
import { estObjet } from '../../../src/lib/objet.mjs';
import { fenetreADessiner } from '../../../src/hote/gestes';
import { lignesDuJournal, zonesDeLEcran, type ZonesDeLaSuite, type ZonesDeLEcran } from '../../../src/hote/ecran';
import { ameliorationsMontables, ameliorationsMontees, emblemeMonte, modelesDeLAtelier, noeudsCaches, postesEnVigueur, postesMontes, type AmeliorationMontee, type ModelesDeLAtelier, type PosteMonte } from './atelier';
import { composerSurLaBase, paletteDesCouleurs, type CompositionSurLaBase } from './composition';
import { estListeDeChaines } from '../asset/attache';
import type { TableDeClips } from '../asset/clips';
import { type CreationOuverte, type GesteDeLaCreation, type PanneauDeLHote } from '../../../src/hote/elements';
import { apresLaCreation, boutonDeLaCreation } from '../../../src/hote/creation';
import { boutonDeLEdition, calqueAffiche, cheminDeLaPlanche, estLIssueDUnChargement, gesteDuFormulaire, estLIssueDUnEnregistrement, estUnGesteDuPointeur, memoireDesCalques, refusDeLaValeurDit, surcoucheDeLEdition, zonesDeLEditeur } from '../../../src/hote/editeur';
import { allBuiltinCampaigns, paquetDuJeu } from '../../../src/scenes/campaign';
import { zonesDesScenarios } from '../../../src/hote/scenarios';

/** Le service `persisterLeHeros` du pont : il ne persiste aucun héros, l'hôte Godot n'a pas de stockage (#3041). */
const sansRoster = (): void => {};

/** La catégorie d'une erreur du pont : celle d'un geste, ou `interne` pour une levée qu'aucun contrôle n'attendait. */
export type CategorieDuPont = CategorieDErreur | 'interne';

/** Une réponse du pont, avant sa mise en JSON. */
type Reponse = ({ ok: true } & Record<string, unknown>) | { ok: false; erreur: { categorie: CategorieDuPont; message: string } };

/** Une erreur de la page (`error`, `unhandledrejection`), relevée entre deux appels de `erreursGlobales`. */
interface ErreurGlobale {
  message: string;
  source: string | null;
}

/** Les corps du combat (`VueDuPont.corps`). */
export interface CorpsDuCombat {
  /** null : les corps sont composés ; sinon pourquoi aucun ne l'est : aucun `modeles` appelé, ou un nombre de bases
   *  servies différent de un (`base-ambigue`). */
  refus: string | null;
  /** Par id de combattant dessiné (`combat.voisins.liste`, sinon `exploration.heros`) : la base et la composition de sa
   *  portée sur elle (`composerSurLaBase`), `null` si sa portée est `null` (corps sans base de ce plan) ou sous refus. */
  combattants: Record<string, (CompositionSurLaBase & { base: string }) | null>;
  /** Par id de combattant dessiné qui est un véhicule ou un engin (`CombattantProjete.vehicule`) dont un élément
   *  `vehicule` est servi : son corps (`corpsDuVehicule`), quelles que soient les bases servies. */
  vehicules: Record<string, CorpsDuVehicule>;
  /** Par id de pose de chaque navire de la scène (`naviresDeLaScene`) dont un élément `vehicule` est servi : son corps
   *  (`corpsDuVehicule`), le point de la scène sous l'origine de son modèle et la hauteur de cette origine. */
  navires: Record<string, NavireServi>;
}

/** Un navire de la scène servi (#3686) : son corps, où se pose l'origine de son modèle (`NavireDeLaScene`), et où se
 *  tient l'occupant de chaque case de ses ponts que son modèle rogne (`stationsDuNavire`, des `cases` du manifeste de
 *  son élément, #3767). */
export interface NavireServi extends Pick<NavireDeLaScene, 'centre'> {
  corps: CorpsDuVehicule;
  stations: StationDeNavire[];
}

/** Le corps d'un véhicule servi (#2987) : l'élément `vehicule` qui dessine sa fiche (`ModelesDeLAtelier.vehicules`), le
 *  côté de son empreinte, sa taille, son cap, sa palette (`paletteDesCouleurs`), son emblème si l'élément porte une surface
 *  `blason` (`emblemeMonte`), les pièces montées à ses postes (`postesMontes`), celles de ses Améliorations
 *  (`ameliorationsMontees`), les nœuds qu'elles cachent (`noeudsCaches`) et la table rôle → clip de l'élément (`clips` de
 *  son manifeste, vide sans clips). */
export interface CorpsDuVehicule {
  element: string;
  empreinte: number;
  taille: VehiculeDuCombattant['taille'];
  cap: VehiculeDuCombattant['cap'];
  palette: Record<string, string>;
  embleme?: EmblemeResolu;
  postes: PosteMonte[];
  ameliorations: AmeliorationMontee[];
  caches: string[];
  clips: TableDeClips;
}

/** Le corps du véhicule `vehicule` (`vehiculeDuCombattant`) sur les modèles servis `servis`, `null` si aucun élément
 *  `vehicule` de sa fiche n'est servi. Le combat (`corpsDe`) et l'atelier (`vehicule`) le composent tous deux ici. */
function corpsDuVehicule(vehicule: VehiculeDuCombattant, servis: { manifestes: Record<string, unknown>; modeles: ModelesDeLAtelier }): CorpsDuVehicule | null {
  const element = servis.modeles.vehicules[vehicule.definition];
  if (!element) return null;
  const palette = paletteDesCouleurs(vehicule.couleurs);
  const manifeste = servis.manifestes[element];
  const postes = postesMontes(manifeste, vehicule.ameliorations, vehicule.postes, servis.modeles.vehicules, palette);
  const ameliorations = ameliorationsMontees(manifeste, vehicule.ameliorations, postes, servis.modeles.ameliorations, servis.manifestes);
  const caches = noeudsCaches(manifeste, vehicule.ameliorations, ameliorations, servis.manifestes);
  const clips = estObjet(manifeste) && estObjet(manifeste.clips) ? manifeste.clips as TableDeClips : {};
  return { element, empreinte: vehicule.empreinte, taille: vehicule.taille, cap: vehicule.cap, palette, ...emblemeMonte(vehicule.embleme, manifeste), postes, ameliorations, caches, clips };
}

/** Une place d'un bord du véhicule de l'atelier : son bord, son rang parmi les places de ce bord (compté de 0), son libellé
 *  (`libelleDuBord`, puis le rang compté de 1) et la fiche de la pièce qui s'y monte (`null` : aucune). */
export interface PlaceDuVehicule {
  bord: FireArc;
  rang: number;
  label: string;
  piece: string | null;
}

/** Le véhicule de l'atelier (`vehicule`) : son corps, les places de ses bords dans ses postes en vigueur
 *  (`postesEnVigueur`), dans l'ordre de `FIRE_ARCS`, les fiches servies qui se montent à un poste, ses Améliorations, et
 *  celles qu'il peut monter (`montables`, `ameliorationsMontables`). */
export interface VehiculeDeLAtelier {
  vehicule: CorpsDuVehicule;
  places: PlaceDuVehicule[];
  pieces: string[];
  ameliorations: readonly string[];
  montables: string[];
}

/** La vue : la projection commune (`projeter`), les corps de ses combattants (`CorpsDuCombat`), la disposition de la
 *  fenêtre qui tient la main (`FenetreADessiner.disposition`, `null` sans fenêtre), chaque zone de l'écran et ses
 *  éléments (`zonesDeLEcran`, le panneau ouvert compris), les cases
 *  atteignables au tour de l'actif (`casesAtteignables`), le plateau de la scène (`plateauDeLaScene`), le verbe du clic
 *  du champ (`CLIC_DU_CHAMP`, la barre de l'actif ouverte, ou en exploration quand rien ne tient la main ; `null`
 *  sinon), et l'id du
 *  combattant que chaque case porte, par `"x,y,z"`. */
export interface VueDuPont {
  projection: Projection;
  corps: CorpsDuCombat;
  disposition: string | null;
  zones: ZonesDeLEcran;
  cases: CaseAtteignable[];
  plateau: ReturnType<typeof plateauDeLaScene> | null;
  lumiere: LumiereDeLaScene | null;
  champ: typeof CLIC_DU_CHAMP | null;
  occupants: Record<string, string>;
}

/** Ce qu'un appel qui touche la partie rend : la vue d'après, les jetons qu'il a programmés, ses lignes de journal
 *  (`journal`, que le plateau anime) et ce qu'il ajoute à l'écran (`zones` : les lignes du journal, `lignesDuJournal`). */
export interface Suite {
  vue: VueDuPont;
  programmes: Programme[];
  journal: LigneDuJournal[];
  zones: ZonesDeLaSuite;
  effets: Effet[];
}

/** Le clic du champ sur le combattant `id`, comme Godot le joue (`combat.gd`) : le verbe de `champ`, la case où
 *  `occupants` le tient, puis l'id ; `null` quand le champ ne se clique pas ou que le combattant n'a pas de case. */
export function clicDuCombattant(vue: VueDuPont, id: string): { type: typeof CLIC_DU_CHAMP; args: [{ x: number; y: number; z?: number }, string] } | null {
  const cle = Object.keys(vue.occupants).find((k) => vue.occupants[k] === id);
  if (!vue.champ || !cle) return null;
  const [x, y, z] = cle.split(',').map(Number);
  return { type: vue.champ, args: [z ? { x, y, z } : { x, y }, id] };
}

/** L'événement du noyau qui demande la création d'un héros neuf (`EVT.HEROS_A_CREER`, `src/noyau/bus.ts`). */
const demandeUnHeros = (e: ResultatDeLAppel['evenements'][number]): boolean => e.type === 'emis' && e.evt === 'heros_a_creer';

/** Godot dessine tout : aucune liste de la projection n'est bornée. */
export const SANS_BORNE: BornesDeLaProjection = { autres: Infinity, offres: Infinity, cibles: Infinity, gestes: Infinity, entites: Infinity };

/** Les clés de l'entrée d'un geste : celles d'une suite, ou celles d'un verbe (`Geste`). */
const clesDuGeste = (e: Record<string, unknown>): readonly string[] => ('suite' in e ? ['suite'] : ['type', 'args', 'siege']);

/** La valeur de `lu`, le champ `champ` de l'entrée de `methode` lu par le noyau ; refusée en `validation`, chaque faute à
 *  son chemin. */
function valeurLue<T>(methode: string, champ: string, lu: LectureAuSchema<T>): T {
  if (lu.ok) return lu.valeur;
  throw new ErreurDeGeste('validation', `${methode} : ${champ}, ${lu.fautes.map(({ chemin, message }) => `${chemin.join('.') || '(racine)'} : ${message}`).join(' ; ')}`);
}

/** La composition `brut` de `methode`, lue par le noyau (`lireComposition`). */
const compositionDe = (methode: string, brut: unknown): Composition => valeurLue(methode, 'composition', lireComposition(brut));

/** L'entrée d'une méthode : l'objet JSON de `json` (aucune entrée, ou `null` : `{}`), dont chaque clé est l'une de ses
 *  `cles`. */
function entreeDe(methode: string, json: string | null | undefined, cles: readonly string[] | ((e: Record<string, unknown>) => readonly string[])): Record<string, unknown> {
  if (json == null) return {};
  let entree: unknown;
  try {
    entree = JSON.parse(json);
  } catch {
    throw new ErreurDeGeste('validation', `${methode} : entrée JSON illisible`);
  }
  valider(estObjet(entree), `${methode} : l’entrée est un objet JSON`);
  const e = entree as Record<string, unknown>;
  const admises = typeof cles === 'function' ? cles(e) : cles;
  const enTrop = Object.keys(e).filter((k) => !admises.includes(k));
  valider(!enTrop.length, `${methode} : ${enTrop.join(', ')} hors de l’entrée (${admises.length ? `clés : ${admises.join(', ')}` : 'aucune clé'})`);
  return e;
}

/** Le projet de la campagne `id` que porte `texte`, le texte que le dépôt sert (`servir.mjs`, `depot/<id>`) : du JSON,
 *  que la porte prouve (`projetDuDepot`), de cet `id`. */
function projetServi(id: string, texte: unknown): ProjectDoc {
  valider(typeof texte === 'string', 'editer : projet, le texte du projet que sert le dépôt');
  let lu: unknown;
  try {
    lu = JSON.parse(texte as string);
  } catch {
    throw new ErreurDeGeste('validation', 'editer : projet, JSON illisible');
  }
  const passe = projetDuDepot(lu);
  if (!passe.ok) throw new ErreurDeGeste('validation', `editer : ${passe.refus}`);
  valider(passe.valeur.id === id, `editer : projet, le projet ${passe.valeur.id} au lieu de ${id}`);
  return passe.valeur;
}

/** Les calques que l'hôte garde, lus de leur texte `texte` ; `null`, que la session tient pour d'un autre format, s'il
 *  n'est pas du JSON. */
function calquesGardes(texte: string): unknown {
  try {
    return JSON.parse(texte);
  } catch {
    return null;
  }
}

/** Le pont : ses méthodes, chacune appelée par `appeler`. */
export function creerPont() {
  let ouverte: (PartieOuverte & { graine: number; pas: number; lignes: number; jour: number | null; panneau: PanneauDeLHote; brouillons: number; regard: Regard }) | null = null;
  const erreurs: ErreurGlobale[] = [];
  /** Les manifestes et les modèles du dernier `modeles`, que `composer` et les corps de la vue lisent. */
  let modeles: { manifestes: Record<string, unknown>; modeles: ModelesDeLAtelier } | null = null;
  /** La session de l'éditeur de carte (`editer`), et la scène et la couche du dernier monde qu'elle a rendu. */
  let edition: { session: SessionDEdition; monde: { scene: Scene; z: number } } | null = null;
  /** Ce qui construit le lancement de la dernière scène mise à l'essai par l'éditeur, que `demarrer { essai }` ouvre. */
  let essai: Parameters<typeof ouvrirLeLancement>[1] | null = null;

  const demarree = () => {
    if (!ouverte) throw new ErreurDeGeste('validation', 'aucune partie : demarrer d’abord');
    return ouverte;
  };

  /** Les corps des combattants dessinés de `projection`, chacun sa portée composée sur l'unique base servie, leurs
   *  véhicules servis, hors des navires de `scene`, et les navires servis de `scene`. */
  const corpsDe = (projection: Projection, scene: Scene | null): CorpsDuCombat => {
    const dessines = projection.combat?.voisins.liste ?? projection.exploration?.heros ?? [];
    const navires = scene ? naviresDeLaScene(scene) : [];
    const bases = modeles?.modeles.bases ?? [];
    const refus = !modeles
      ? '[sans-modeles] aucun modeles appelé'
      : bases.length !== 1 ? `[base-ambigue] ${bases.length} base(s) servie(s)${bases.length ? ` (${bases.map((b) => b.id).join(', ')})` : ''}, une attendue` : null;
    const base = refus === null ? bases[0] : null;
    return {
      refus,
      combattants: Object.fromEntries(dessines.map(({ id, portee }) => [id, base && portee ? { base: base.id, ...composerSurLaBase(base, modeles!.manifestes, portee) } : null])),
      vehicules: Object.fromEntries(dessines.flatMap(({ id, vehicule }) => {
        const corps = vehicule && modeles && !navires.some((n) => n.id === id) && corpsDuVehicule(vehicule, modeles);
        return corps ? [[id, corps]] : [];
      })),
      navires: Object.fromEntries(navires.flatMap(({ id, vehicule, centre }) => {
        const corps = modeles && corpsDuVehicule(vehicule, modeles);
        if (!modeles || !corps) return [];
        const manifeste = modeles.manifestes[corps.element];
        const emprises = estObjet(manifeste) && estObjet(manifeste.cases) ? manifeste.cases as EmprisesDesCases : {};
        return [[id, { corps, centre, stations: stationsDuNavire(scene!, id, emprises) }]];
      })),
    };
  };

  const vueDe = (o: NonNullable<typeof ouverte>): VueDuPont => {
    const etat = o.partie.etat();
    const projection = projeter(etat, o.pas, o.lignes, SANS_BORNE);
    const combat = projection.combat;
    const fenetre = fenetreADessiner(etat);
    return {
      projection,
      corps: corpsDe(projection, etat.scene),
      disposition: fenetre?.disposition ?? null,
      zones: zonesDeLEcran(etat, projection, fenetre, o.panneau),
      cases: casesAtteignables(etat),
      plateau: etat.scene ? plateauDeLaScene(etat.scene, casesDuGroupe(etat), regardDuJeu(o.regard, !!etat.battle)) : null,
      lumiere: etat.scene ? lumiereDeLaScene({ ...etat, scene: etat.scene }, regardDuJeu(o.regard, !!etat.battle)) : null,
      champ: (combat ? combat.barre.forme === 'ouverte' : projection.exploration && !fenetre) ? CLIC_DU_CHAMP : null,
      occupants: Object.fromEntries((combat?.voisins.liste ?? []).flatMap((c) => (c.pos && !c.horsCombat ? [[`${c.pos[0]},${c.pos[1]},${c.pos[2]}`, c.id]] : []))),
    };
  };

  /** La création que le panneau ouvert tient, `null` sous un autre panneau ou sans panneau. */
  const creationOuverte = (o: NonNullable<typeof ouverte>): CreationOuverte | null => (o.panneau && 'creation' in o.panneau ? o.panneau.creation : null);

  /** Le panneau `cle` fermé : sans panneau s'il est celui ouvert, l'autre panneau laissé ouvert sinon. */
  const fermerLePanneau = (o: NonNullable<typeof ouverte>, cle: 'fiche' | 'creation'): void => {
    if (o.panneau && cle in o.panneau) o.panneau = null;
  };

  /** Ouvre la création sur un brouillon neuf, à sa première page, à la place du panneau ouvert. */
  const ouvrirLaCreation = (o: NonNullable<typeof ouverte>): void => {
    o.panneau = { creation: { brouillon: brouillonDeLaPartie(o.graine, o.brouillons++), page: pagesDeCreation()[0] } };
  };

  /** La suite de `resultat` ; un héros neuf demandé (`demandeUnHeros`) ouvre la création, sauf déjà ouverte. */
  const suite = (o: NonNullable<typeof ouverte>, resultat: ResultatDeLAppel): Suite => {
    if (!creationOuverte(o) && resultat.evenements.some(demandeUnHeros)) ouvrirLaCreation(o);
    const programmes = o.jetons.programmes(resultat);
    const { lignes, jour } = lignesDuJournal(o.partie.etat(), o.lignes, resultat.journal, o.jour);
    const zones = { 'journal.lignes': lignes };
    o.lignes += resultat.journal.length;
    o.jour = jour;
    return { vue: vueDe(o), programmes, journal: resultat.journal, zones, effets: effetsDeLAppel(o.partie.etat(), resultat.evenements) };
  };

  /** Une suite sans jeton ni journal : la vue d'un état du pont changé, la partie intacte. */
  const sansJeton = (o: NonNullable<typeof ouverte>): Suite => ({ vue: vueDe(o), programmes: [], journal: [], zones: { 'journal.lignes': [] }, effets: [] });

  /** Un geste joué : un verbe et ses arguments, celui qu'une offre déclare compris. Le refus que le verbe dit (`refus`,
   *  celui de son geste, `refusDuGeste` pour un verbe de la barre) est une erreur de règle, avec sa raison. */
  const jouerUnGeste = (o: NonNullable<typeof ouverte>, e: Record<string, unknown>): ResultatDeLAppel => {
    const etat = o.partie.etat();
    const intention = intentionDuGeste(etat, gesteDuVerbe(etat, e as { type: unknown }, SANS_PISTE));
    const refusAvant = etat.refus;
    const resultat = envoyerLIntention(o.partie, intention);
    const refus = o.partie.etat().refus;
    if (refus && refus !== refusAvant) throw new ErreurDeGeste('regle', `${intention.type} : ${refus.texte}`);
    o.pas++;
    return resultat;
  };

  const methodes: Record<string, (json?: string | null) => object> = {
    demarrer(json) {
      const e = entreeDe('demarrer', json, (e) => ('essai' in e ? ['essai', 'graine'] : ['scenario', 'graine']));
      valider(!ouverte, 'demarrer : une partie par page, déjà démarrée ; recharger la page pour en commencer une autre');
      let o: PartieOuverte;
      let graine: number;
      if ('essai' in e) {
        valider(e.essai === true && essai, 'demarrer : essai, aucune scène mise à l’essai par editer');
        const entrees = nouvellesEntrees({ graine: e.graine as number | undefined });
        o = ouvrirLeLancement(entrees, essai!, sansRoster);
        graine = entrees.graine;
      } else {
        valider(typeof e.scenario === 'string', 'demarrer : scenario, l’id d’un scénario de test');
        const entete = nouvelEntete(e.scenario as string, { graine: e.graine as number | undefined });
        o = ouvrirLaPartie(entete, sansRoster);
        graine = entete.graine;
      }
      ouverte = { ...o, graine, pas: 0, lignes: 0, jour: null, panneau: null, brouillons: 0, regard: 'tactique' };
      return suite(ouverte, o.lancement);
    },
    scenarios(json) {
      entreeDe('scenarios', json, []);
      return { zones: zonesDesScenarios() };
    },
    vue(json) {
      entreeDe('vue', json, []);
      return { vue: vueDe(demarree()) };
    },
    monde(json) {
      entreeDe('monde', json, []);
      const o = demarree();
      const etat = o.partie.etat();
      const scene = etat.scene;
      const regard = regardDuJeu(o.regard, !!etat.battle);
      return { monde: scene ? volumeDuRegard(scene, casesDuGroupe(etat), regard) : null, toits: scene ? toitsDuMonde(scene) : [], couronnes: scene ? couronnesDuMonde(scene) : [], meteo: scene ? meteoDuRegard(scene, regard) : null };
    },
    jouer(json) {
      const o = demarree();
      const e = entreeDe('jouer', json, clesDuGeste);
      if (!('suite' in e)) return suite(o, jouerUnGeste(o, e));
      valider(Array.isArray(e.suite) && e.suite.length > 0 && e.suite.every(estObjet), 'jouer : suite, une liste non vide de verbes { type, args }');
      const [premier, ...reste] = e.suite as Record<string, unknown>[];
      const resultats = [jouerUnGeste(o, premier)];
      for (const g of reste) {
        if (fenetreADessiner(o.partie.etat())) break;
        resultats.push(jouerUnGeste(o, g));
      }
      return suite(o, { issue: resultats[resultats.length - 1].issue, evenements: resultats.flatMap((r) => r.evenements), journal: resultats.flatMap((r) => r.journal) });
    },
    regarder(json) {
      const o = demarree();
      const e = entreeDe('regarder', json, ['regard']);
      valider(REGARDS.includes(e.regard as Regard), `regarder : regard, l’un de ${REGARDS.join(', ')}`);
      o.regard = e.regard as Regard;
      return sansJeton(o);
    },
    fiche(json) {
      const o = demarree();
      const e = entreeDe('fiche', json, ['fiche']);
      const f = e.fiche as Record<string, unknown> | null | undefined;
      const etat = o.partie.etat();
      const porteurs = [...new Set([...(etat.battle?.combatants ?? []), ...etat.party].map((c) => c.id))].filter((id) => ficheDuPorteur(etat, id));
      valider(f === null || (estObjet(f) && Object.keys(f).every((k) => k === 'porteur' || k === 'objet') && porteurs.includes(f.porteur as string)),
        `fiche : fiche, null ou { porteur, objet? } : l’id d’un combattant à fiche (${porteurs.join(', ')})`);
      if (f && f.objet !== undefined) {
        const objets = ficheDuPorteur(etat, f.porteur as string)!.possessions.map((p) => p.uid);
        valider(objets.includes(f.objet as string), `fiche : objet, l’uid d’une possession de la fiche (${objets.join(', ') || 'aucune'})`);
      }
      if (f === null) fermerLePanneau(o, 'fiche');
      else o.panneau = { fiche: { porteur: f!.porteur as string, ...(f!.objet === undefined ? {} : { objet: f!.objet as string }) } };
      return sansJeton(o);
    },
    creation(json) {
      const o = demarree();
      const e = entreeDe('creation', json, ['creation']);
      const b = boutonDeLaCreation(vueDe(o).zones, e.creation);
      valider(b, 'creation : creation, un geste de la création que l’écran offre (`{ creation }` d’un bouton des zones groupe.gestes et creation.*)');
      if (b!.refus) throw new ErreurDeGeste('regle', `creation : ${b!.refus}`);
      const g = e.creation as GesteDeLaCreation | null;
      if (g === null) fermerLePanneau(o, 'creation');
      else if (g.geste === 'ouvrir') ouvrirLaCreation(o);
      else if (g.geste === 'engager') {
        const resultat = envoyerLIntention(o.partie, intentionDEngagement(creationOuverte(o)!.brouillon));
        fermerLePanneau(o, 'creation');
        o.pas++;
        return suite(o, resultat);
      } else o.panneau = { creation: apresLaCreation(creationOuverte(o)!, g) };
      return sansJeton(o);
    },
    reprendre(json) {
      const o = demarree();
      const e = entreeDe('reprendre', json, ['jeton']);
      valider(Number.isInteger(e.jeton), 'reprendre : jeton, le numéro d’un jeton programmé');
      return suite(o, o.jetons.reprendre(e.jeton as number));
    },
    modeles(json) {
      const e = entreeDe('modeles', json, ['manifestes', 'osDesRigides']);
      valider(estObjet(e.manifestes), 'modeles : manifestes, un objet id de modèle → manifeste');
      valider(estObjet(e.osDesRigides) && Object.values(e.osDesRigides).every(estListeDeChaines), 'modeles : osDesRigides, un objet id de modèle → os de ses meshes rigides');
      const manifestes = e.manifestes as Record<string, unknown>;
      modeles = { manifestes, modeles: modelesDeLAtelier(manifestes, e.osDesRigides as Record<string, string[]>) };
      return modeles.modeles;
    },
    composer(json) {
      const e = entreeDe('composer', json, ['base', 'composition', 'emblemes']);
      valider(modeles !== null, 'composer : aucun modèle, appeler modeles d’abord');
      const base = modeles!.modeles.bases.find((b) => b.id === e.base);
      valider(base !== undefined, `composer : base, l’id d’une base servie par modeles (${modeles!.modeles.bases.map((b) => b.id).join(', ') || 'aucune'})`);
      const emblemes = valeurLue('composer', 'emblemes', lireSurchargesDEmblemes(e.emblemes === undefined ? {} : e.emblemes));
      return composerSurLaBase(base!, modeles!.manifestes, porteeDeComposition(compositionDe('composer', e.composition)), emblemes);
    },
    vehicule(json): VehiculeDeLAtelier {
      const e = entreeDe('vehicule', json, ['definition', 'postes', 'ameliorations', 'couleurs', 'embleme']);
      valider(modeles !== null, 'vehicule : aucun modèle, appeler modeles d’abord');
      const servis = modeles!;
      const fiches = Object.keys(servis.modeles.vehicules);
      valider(typeof e.definition === 'string' && fiches.includes(e.definition), `vehicule : definition, la fiche d’un véhicule servi par modeles (${fiches.join(', ') || 'aucune'})`);
      const pieces = fiches.filter((d) => siegeEngines().some((t) => t.id === d));
      const postes = e.postes ?? [];
      valider(Array.isArray(postes) && postes.every((p) => estObjet(p) && Object.keys(p).sort().join() === 'bord,definition' && pieces.includes(p.definition as string) && FIRE_ARCS.includes(p.bord as FireArc)),
        `vehicule : postes, une liste de { definition, bord } : une pièce servie (${pieces.join(', ') || 'aucune'}) à un bord (${FIRE_ARCS.join(', ')})`);
      const offertes = Object.keys(servis.modeles.ameliorations);
      const ameliorations = e.ameliorations ?? [];
      valider(estListeDeChaines(ameliorations) && ameliorations.every((a) => offertes.includes(a)), `vehicule : ameliorations, une liste d’Améliorations servies par modeles (${offertes.join(', ') || 'aucune'})`);
      const appearance = valeurLue('vehicule', 'apparence', lireApparenceDAuteur(Object.fromEntries(Object.entries({ couleurs: e.couleurs, embleme: e.embleme }).filter(([, v]) => v !== undefined))));
      const fiche = ficheDEntite({
        id: 'atelier', kind: 'personnage', ref: e.definition as string, pos: { x: 0, y: 0 }, appearance,
        postes: (postes as { definition: string; bord: FireArc }[]).map(({ definition, bord }) => ({ trappingId: definition, side: bord })),
        upgrades: (ameliorations as string[]).map((id) => ({ id })),
      }, () => undefined);
      const vehicule = vehiculeDuCombattant(fiche, undefined)!;
      const manifeste = servis.manifestes[servis.modeles.vehicules[vehicule.definition]];
      const enVigueur = postesEnVigueur(manifeste, vehicule.ameliorations) ?? {};
      return {
        vehicule: corpsDuVehicule(vehicule, servis)!,
        places: FIRE_ARCS.flatMap((bord) => {
          const montees = vehicule.postes.filter((p) => p.bord === bord);
          return (enVigueur[bord] ?? []).map((_, rang) => ({ bord, rang, label: `${libelleDuBord(bord)} ${rang + 1}`, piece: montees[rang]?.definition ?? null }));
        }),
        pieces,
        ameliorations: vehicule.ameliorations,
        montables: ameliorationsMontables(manifeste, offertes),
      };
    },
    catalogues(json) {
      entreeDe('catalogues', json, []);
      return cataloguesDeComposition();
    },
    vitrine(json): VitrineDesEffets {
      entreeDe('vitrine', json, []);
      return vitrineDesEffets();
    },
    presetDeComposition(json) {
      const e = entreeDe('presetDeComposition', json, ['composition', 'preset']);
      const composition = compositionDe('presetDeComposition', e.composition);
      valider(e.preset === undefined || typeof e.preset === 'string', 'presetDeComposition : preset, l’id d’un preset de catalogues');
      const rendu = presetDeComposition(composition, e.preset as string | undefined);
      if (!rendu.ok) throw new ErreurDeGeste('validation', `presetDeComposition : preset, l’id d’un preset de catalogues (${rendu.presets.join(', ')})`);
      return rendu;
    },
    editer(json) {
      const e = entreeDe('editer', json, (e) => ('ouvrir' in e ? ['ouvrir', 'projet', 'calques'] : 'type' in e ? ['type', 'args'] : ['edition']));
      const avant = 'ouvrir' in e ? null : edition?.session ?? null;
      let session: SessionDEdition;
      let depot: { id: string; texte: string } | null = null;
      if ('ouvrir' in e) {
        const campagne = allBuiltinCampaigns.find((c) => c.id === e.ouvrir);
        valider(campagne !== undefined, `editer : ouvrir, l’id d’une campagne du jeu (${allBuiltinCampaigns.map((c) => c.id).join(', ')})`);
        valider(e.calques === undefined || typeof e.calques === 'string', 'editer : calques, le texte des calques que l’hôte garde');
        const gardes = e.calques === undefined ? undefined : calquesGardes(e.calques as string);
        session = e.projet === undefined ? ouvrirLEdition(paquetDuJeu(campagne!), false, gardes) : ouvrirLEdition(projetServi(campagne!.id, e.projet), true, gardes);
      } else {
        valider(edition !== null, 'editer : aucune carte ouverte, editer { ouvrir } d’abord');
        const s = edition!.session;
        const nomme = 'type' in e ? gesteDuFormulaire(zonesDeLEditeur(s), e) : undefined;
        if ('type' in e) valider(nomme, 'editer : un formulaire des zones editeur.*, { type: nommer | identifier | decrire | drapeau, args: [texte] } ou { type: valeur, args: [porteur, chemin, valeur?] }');
        else if (estLIssueDUnEnregistrement(e.edition)) valider(s.depot?.enCours, 'editer : aucun enregistrement en cours');
        else if (estLIssueDUnChargement(e.edition)) valider(s.chargement, 'editer : aucun chargement de planche en cours');
        else if (!estUnGesteDuPointeur(e.edition)) {
          const b = boutonDeLEdition(zonesDeLEditeur(s), e.edition);
          valider(b, 'editer : edition, un geste du pointeur ({ geste: appui | glisse | relache, point: { case: { x, y }, f: { x, y } } }, la case en entiers), l’issue d’un enregistrement ({ geste: enregistrement, reussi }), celle d’un chargement de planche ({ geste: chargement, image: { largeur, hauteur } | null }) ou le geste `{ edition }` d’un bouton des zones editeur.*');
          if (b!.refus) throw new ErreurDeGeste('regle', `editer : ${b!.refus}`);
        }
        const geste = nomme ?? (e.edition as GesteDEdition);
        const refusDeValeur = geste.geste === 'valeur' ? refusDeLaValeurDit(s, geste) : null;
        if (refusDeValeur) throw new ErreurDeGeste('regle', `editer : ${refusDeValeur}`);
        if (geste.geste === 'enregistrer') {
          const passe = texteAEnregistrer(s);
          if (!passe.ok) throw new ErreurDeGeste('regle', `editer : ${passe.refus}`);
          depot = { id: s.projet.id, texte: passe.valeur };
        }
        if (geste.geste === 'tester') {
          const lance = essaiDeLaScene(s);
          if (!lance.ok) throw new ErreurDeGeste('regle', `editer : ${lance.refus}`);
          essai = lance.valeur;
        }
        session = editer(s, geste);
      }
      const scene = sceneEditee(session);
      const neuf = !edition || 'ouvrir' in e || (session.geste === null && (scene !== edition.monde.scene || session.z !== edition.monde.z));
      edition = { session, monde: neuf ? { scene, z: session.z } : edition!.monde };
      const memoire = memoireDesCalques(avant, session);
      const charge = session.chargement && !avant?.chargement ? session.chargement : null;
      return {
        vue: { zones: zonesDeLEditeur(session), couche: session.z },
        surcouche: surcoucheDeLEdition(session),
        calque: calqueAffiche(session),
        ...(neuf ? { monde: volumeDuMonde(scene, session.z), aretes: aretesDeLaCouche(scene, session.z) } : {}),
        ...(depot ? { depot } : {}),
        ...('edition' in e && (e.edition as GesteDEdition).geste === 'tester' ? { essai: true } : {}),
        ...(charge ? { planche: { image: cheminDeLaPlanche(session.projet.id, charge.sceneId, charge.z) } } : {}),
        ...(memoire ? { memoire } : {}),
      };
    },
    erreursGlobales(json) {
      entreeDe('erreursGlobales', json, []);
      return { erreurs: erreurs.splice(0) };
    },
  };

  const page = globalThis as { addEventListener?: (type: string, ecouteur: (ev: unknown) => void) => void };
  page.addEventListener?.('error', (ev) => {
    const e = ev as { message?: string; filename?: string; lineno?: number };
    erreurs.push({ message: e.message ?? String(ev), source: e.filename ? `${e.filename}:${e.lineno ?? 0}` : null });
  });
  page.addEventListener?.('unhandledrejection', (ev) => {
    const raison = (ev as { reason?: unknown }).reason;
    erreurs.push({ message: raison instanceof Error ? raison.message : String(raison), source: 'unhandledrejection' });
  });

  /** Appelle la méthode `methode` sur l'entrée `json` : la réponse en JSON, jamais une levée. */
  function appeler(methode: string, json?: string | null): string {
    try {
      const faire = Object.prototype.hasOwnProperty.call(methodes, methode) ? methodes[methode] : null;
      if (!faire) throw new ErreurDeGeste('validation', `méthode inconnue : ${String(methode)} (méthodes : ${Object.keys(methodes).join(', ')})`);
      return JSON.stringify({ ok: true, ...faire(json) } satisfies Reponse);
    } catch (erreur) {
      const reponse: Reponse = erreur instanceof ErreurDeGeste
        ? { ok: false, erreur: { categorie: erreur.categorie, message: erreur.message } }
        : { ok: false, erreur: { categorie: 'interne', message: erreur instanceof Error ? erreur.message : String(erreur) } };
      return JSON.stringify(reponse);
    }
  }

  /** Ferme la partie ouverte : le noyau n'en tient qu'une par processus, et un hôte sans page à recharger (la sonde qui
   *  fige un scénario après l'autre) la rend avant d'en démarrer une autre sur un pont neuf. */
  function fermer(): void {
    demarree().partie.fermer();
    ouverte = null;
  }

  return { appeler, fermer };
}

/** Le pont que la page expose à Godot. */
export type Pont = ReturnType<typeof creerPont>;
