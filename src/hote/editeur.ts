/**
 * L'ÉDITEUR DE CARTE À L'ÉCRAN D'UN HÔTE (#3508) : ses zones et leurs éléments (`elements.ts`), lus de la session
 * d'édition du noyau (`SessionDEdition`). Les outils, les options de l'outil actif (pinceau, terrains, hauteurs, sorte
 * et structure d'une arête, étage rejoint et plan d'une volée, engin d'un emplacement de siège), les couches de la scène, l'historique, la presse,
 * l'enregistrement au dépôt, la case pointée et la sélection, l'inspecteur de l'entité, de l'entrée, de la zone ou de l'arête sélectionnée et le
 * calque de référence de la couche ; chaque geste porte le geste d'édition qu'il joue (`{ edition }`), prêt à envoyer. Ce que le
 * pointeur trace sur la carte en cours de geste, le tracé de la volée, l'arête sélectionnée, les zones de la couche et la poignée de la
 * sélection, vont à la surcouche (`surcoucheDeLEdition`),
 * que l'hôte pose sur le monde, et le calque de la couche, à l'affichage du calque (`calqueAffiche`), avec la planche
 * qu'il garde (`cheminDeLaPlanche`) et ce qu'il garde des calques (`memoireDesCalques`).
 */
import {
  calqueDeLaCouche, calquesAStocker, coinsDuCalque, planDuCalque, type CalquesStockes,
  capDeLEntite, capsOfferts, entiteDeLaSelection, fichesDePersonnage, nomDEntite, presetDuNarratif, props,
  assoirALaPlace, findVehicleById, labelEmplacement, lightTones, lumiereAllumee, PARTY_MAX, seatSlotsOf, siegeEngines, type SeatOccupant,
  DIFFICULTY_LABELS, FACES_D_ARETE, HAUTEURS, PINCEAUX, planDeLaVolee, areteDessinee, heightAt, libelleDeStructure, porteAuteur, sceneEditee, secretAuteur,
  segmentDeLaSelection, structureAppearances, structuresCrenelables, structuresDeLArete, crenellatedAt, terrainIds, terrainLabel, tileAt,
  effectZoneRect, ENTREES_DE_DOSSIER, isRoomZone, poigneeDeLaSelection, sameSel, sceneZoneTiles,
  type AreteDessinee, type BrouillonDArete, type Difficulty, type GesteDEdition, type PatchDArete, type PatchDeZone, type Scene, type Sel, type SessionDEdition,
  type WallPaint, ZONE_VARIANTS,
} from '../noyau/index';
import { pluriel, t } from '../i18n';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { estObjet } from './formes';
import { ligne, type Bouton, type Choix, type Formulaire, type Ligne } from './elements';

/** Les zones de l'éditeur, dans l'ordre où chacune montre ses éléments. */
export interface ZonesDeLEditeur {
  'editeur.titre': Ligne[];
  'editeur.outils': Choix[];
  'editeur.options': (Choix | Ligne | Bouton)[];
  'editeur.couches': (Choix | Bouton)[];
  'editeur.historique': Bouton[];
  'editeur.presse': Bouton[];
  'editeur.fichier': Bouton[];
  'editeur.pointee': Ligne[];
  'editeur.inspecteur': (Choix | Ligne | Bouton | Formulaire)[];
  'editeur.calque': (Choix | Ligne | Bouton)[];
}

/** Ce que l'éditeur repère sur la carte de la couche éditée : une entité (sa sorte, `kind`) ou une entrée, son id, sa
 *  case, son nom, et si elle est sélectionnée. */
export interface RepereDeLEdition {
  sorte: 'prop' | 'personnage' | 'heroStart' | 'entree';
  id: string;
  x: number;
  y: number;
  z: number;
  nom: string;
  choisi: boolean;
}

/** Les sortes de zone de l'éditeur : un déclencheur, une zone de repos, une pièce (`isRoomZone`), toute autre zone
 *  d'effet. */
export type SorteDeZone = 'declencheur' | 'repos' | 'piece' | 'zone';

/** Une zone de la couche éditée sur la carte : sa sorte, son nom, ses cases et si elle est sélectionnée. */
export interface ZoneDeLEdition {
  sorte: SorteDeZone;
  nom: string;
  cases: { x: number; y: number; z: number }[];
  choisi: boolean;
}

/** Les cases que le geste en cours trace sur la carte, chacune sur sa couche : le rectangle tiré, ou les cases que le
 *  pinceau a couvertes, que le monde ne montre qu'au relâché, puis le tracé de la volée ; l'arête sélectionnée, sur
 *  la couche éditée ; les repères et les zones de cette couche ; la case de la poignée qui redimensionne la sélection
 *  (`poigneeDeLaSelection`), `null` sans elle. */
export interface SurcoucheDeLEdition {
  cases: { x: number; y: number; z: number }[];
  arete: AreteDessinee | null;
  reperes: RepereDeLEdition[];
  zones: ZoneDeLEdition[];
  poignee: { x: number; y: number; z: number } | null;
}

/** Le calque de la couche éditée tel que l'hôte le pose sur le monde : la planche qu'il garde (`cheminDeLaPlanche`),
 *  ses quatre coins sur la carte (`coinsDuCalque`), son plan en mètres (`planDuCalque`), son opacité, et s'il passe
 *  au-dessus de la scène construite. */
export interface CalqueAffiche {
  image: string;
  coins: { x: number; y: number }[];
  plan: number;
  opacite: number;
  dessus: boolean;
}

/** Les sortes d'arête que pose l'outil murs. */
const PEINTURES: readonly WallPaint[] = ['wall', 'door', 'diagBack', 'diagFwd'];

const bouton = (id: string, libelle: string, edition: GesteDEdition, presse = false, refus: string | null = null): Bouton => ({
  type: 'bouton', id, libelle, jeu: { edition }, presse, focus: false, refus,
});

const choix = (id: string, libelle: string, valeurs: Bouton[], type: Choix['type'] = 'choix'): Choix => ({
  type, id, ton: 'neutre', libelle, focus: false, refus: null, valeurs,
});

/** Les options de la volée de la session `s` : l'étage qu'elle rejoint, son tracé, ses cotes si son plan tient, sinon,
 *  une case tracée, la raison du plan, en clair ; la poser (refusée avec cette raison) et effacer son tracé. */
function optionsDeLaVolee(s: SessionDEdition, toZ: number): (Choix | Ligne | Bouton)[] {
  const plan = planDeLaVolee(s)!;
  const etages = sceneEditee(s).layers.map((l) => l.z).sort((a, b) => a - b)
    .map((z) => bouton(`etage/${z}`, t('ecran.editeur.couche', { z }), { geste: 'outil', outil: { mode: 'stair', toZ: z } }, toZ === z));
  const arrondi = (m: number) => Math.round(m * 100) / 100;
  return [
    choix('etages', t('ecran.editeur.volee.etage'), etages),
    ligne('trace', t('ecran.editeur.volee.trace', { n: s.volee.length, s: pluriel(s.volee.length) })),
    ...(plan.ok ? [ligne('plan', t('ecran.editeur.volee.cotes', { de: arrondi(plan.from), a: arrondi(plan.to), cotes: plan.steps.map((p) => arrondi(p.height)).join(' · ') }))]
      : s.volee.length ? [ligne('plan', plan.reason)] : []),
    bouton('volee/poser', t('ecran.editeur.volee.poser'), { geste: 'poserVolee' }, false, plan.ok ? null : plan.reason),
    bouton('volee/effacer', t('ecran.editeur.volee.effacer'), { geste: 'effacerVolee' }, false, s.volee.length ? null : t('ecran.editeur.volee.vide')),
  ];
}

/** Les options de l'outil actif : la taille du pinceau (et le rectangle du terrain), puis les terrains, les hauteurs ou
 *  la structure du parapet, ou la gomme de sa marque ; la sorte et le matériau d'une arête ; la volée ; la sorte de
 *  zone à tracer ; le sens du pinceau d'emprise et sa fin. La gomme n'en a aucune : elle efface la chose de la case. */
function options(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const outil = s.outil;
  if (outil.mode === 'select' || outil.mode === 'erase' || outil.mode === 'entry' || (outil.mode === 'entity' && outil.kind === 'heroStart')) return [];
  if (outil.mode === 'stair') return optionsDeLaVolee(s, outil.toZ);
  if (outil.mode === 'zone') {
    return [choix('zones', t('ecran.editeur.zones'),
      ZONE_VARIANTS.map((zone) => bouton(`zone/${zone}`, t(`ecran.editeur.zone.${zone}`), { geste: 'outil', outil: { mode: 'zone', zone } }, outil.zone === zone)))];
  }
  if (outil.mode === 'zoneTiles') return [...emprise(outil.zoneId, outil), bouton('emprise/finir', t('ecran.editeur.zone.emprise.finir'), { geste: 'outil', outil: { mode: 'select' } })];
  if (outil.mode === 'emplacement') {
    return [choix('engins', t('ecran.editeur.engins'),
      siegeEngines().map((e) => bouton(`engin/${e.id}`, e.label, { geste: 'outil', outil: { mode: 'emplacement', trappingId: e.id } }, outil.trappingId === e.id)), 'liste')];
  }
  if (outil.mode === 'entity') {
    const kind = outil.kind;
    const offerts = kind === 'prop' ? props : fichesDePersonnage();
    return [choix(kind === 'prop' ? 'decors' : 'fiches', t(kind === 'prop' ? 'ecran.editeur.decors' : 'ecran.editeur.fiches'),
      offerts.map((o) => bouton(`${kind}/${o.id}`, o.label, { geste: 'outil', outil: { mode: 'entity', kind, ref: o.id } }, outil.ref === o.id)), 'liste')];
  }
  const pinceaux = PINCEAUX.map((n) => bouton(`pinceau/${n}`, t('ecran.editeur.pinceau.taille', { n }), { geste: 'pinceau', taille: n }, s.pinceau === n && !s.rectangle));
  if (outil.mode === 'tile') {
    const rectangle = bouton('pinceau/rectangle', t('ecran.editeur.pinceau.rectangle'), { geste: 'rectangle', actif: !s.rectangle }, s.rectangle);
    const terrains = terrainIds().map((id) => bouton(`terrain/${id}`, terrainLabel(id), { geste: 'outil', outil: { mode: 'tile', terrain: id } }, outil.terrain === id));
    return [choix('pinceau', t('ecran.editeur.pinceau'), [...pinceaux, rectangle]), choix('terrains', t('ecran.editeur.terrains'), terrains, 'liste')];
  }
  if (outil.mode === 'wall') {
    const peintures = PEINTURES.map((paint) => bouton(`arete/${paint}`, t(`ecran.editeur.arete.${paint}`), { geste: 'outil', outil: { mode: 'wall', paint } }, outil.paint === paint));
    const posables = structuresDeLArete(outil.paint);
    if (!posables.length) return [choix('aretes', t('ecran.editeur.aretes'), peintures)];
    const structuresDeLOutil = [
      bouton('structure/defaut', t('ecran.editeur.structure.defaut'), { geste: 'outil', outil: { mode: 'wall', paint: outil.paint } }, outil.structure === undefined),
      ...posables.map((st) => bouton(`structure/${st.id}`, st.label, { geste: 'outil', outil: { mode: 'wall', paint: outil.paint, structure: st.id } }, outil.structure === st.id)),
    ];
    return [choix('aretes', t('ecran.editeur.aretes'), peintures), choix('structures', t('ecran.editeur.structures'), structuresDeLOutil, 'liste')];
  }
  if (outil.mode === 'crenellated') {
    const parapets = [
      ...structuresCrenelables().map((st) => bouton(`crenelage/${st.id}`, st.label, { geste: 'outil', outil: { mode: 'crenellated', structure: st.id } }, outil.structure === st.id)),
      bouton('crenelage/gomme', t('ecran.editeur.crenelage.gomme'), { geste: 'outil', outil: { mode: 'crenellated', structure: null } }, outil.structure === null),
    ];
    return [choix('pinceau', t('ecran.editeur.pinceau'), pinceaux), choix('parapets', t('ecran.editeur.crenelage'), parapets, 'liste')];
  }
  const hauteurs = HAUTEURS.map((h) => bouton(`hauteur/${h.cle}`, `${t(`ecran.editeur.hauteur.${h.cle}`)} (${h.metres} m)`, { geste: 'outil', outil: { mode: 'height', metres: h.metres } }, outil.metres === h.metres));
  return [choix('pinceau', t('ecran.editeur.pinceau'), pinceaux), choix('hauteurs', t('ecran.editeur.hauteurs'), hauteurs)];
}

/** La ligne de l'arête sélectionnée de la session `s` : sa case, son côté, sa couche, sa sorte et sa structure. */
function ligneDeLArete(s: SessionDEdition): Ligne[] {
  const seg = segmentDeLaSelection(sceneEditee(s), s.sel);
  if (!seg) return [];
  const sorte = porteAuteur(seg) ? 'porte' : seg.window ? 'fenetre' : 'mur';
  const structure = libelleDeStructure(seg.structure) ?? t('ecran.editeur.structure.defaut');
  return [ligne('arete', t('ecran.editeur.areteChoisie', { x: seg.x, y: seg.y, cote: seg.side, z: seg.z ?? 0, sorte: t(`ecran.editeur.sorte.${sorte}`), structure }))];
}

/** Le nom de l'entité `ent` de la scène éditée de `s` : celui que l'auteur lui donne, celui de sa fiche
 *  (`nomDEntite`), ou sa sorte. */
const nomALEcran = (s: SessionDEdition, ent: Scene['entities'][number]): string =>
  nomDEntite(ent, presetDuNarratif(s.projet.narratif)) ?? t(`ecran.editeur.entite.${ent.kind}`);

/** L'entrée sélectionnée de la session `s` : son nom et sa case, `undefined` hors d'une entrée sélectionnée. */
function entreeDeLaSelection(s: SessionDEdition): { nom: string; x: number; y: number; z: number } | undefined {
  const pos = s.sel?.type === 'entry' ? sceneEditee(s).entryPoints?.[s.sel.id] : undefined;
  return pos && s.sel?.type === 'entry' ? { nom: s.sel.id, x: pos.x, y: pos.y, z: pos.z ?? 0 } : undefined;
}

/** La ligne de l'entité, de l'entrée ou de la zone sélectionnée de la session `s` : sa sorte, son nom, sa case (le
 *  rectangle d'une zone) et sa couche. */
function ligneDeLaSelection(s: SessionDEdition): Ligne[] {
  const ent = entiteDeLaSelection(sceneEditee(s), s.sel);
  if (ent) return [ligne('entite', t('ecran.editeur.entite', { sorte: t(`ecran.editeur.entite.${ent.kind}`), nom: nomALEcran(s, ent), x: ent.pos.x, y: ent.pos.y, z: ent.z ?? 0 }))];
  const entree = entreeDeLaSelection(s);
  if (entree) return [ligne('entree', t('ecran.editeur.entree', entree))];
  const zone = zonesLues(sceneEditee(s)).find((z) => sameSel(z.sel, s.sel));
  return zone ? [ligne('zone', t('ecran.editeur.zone.choisie', { sorte: t(`ecran.editeur.zone.sorte.${zone.sorte}`), nom: zone.nom, ...zone.rect, z: zone.z }))] : [];
}

/** Le formulaire qui nomme la sélection de la session `s` (`{ geste: 'nommer', nom }`), son champ prérempli de `nom`. */
const formulaireDuNom = (nom: string, optionnel: boolean): Formulaire => ({
  type: 'formulaire', id: 'nommer', libelle: t('ecran.editeur.entite.nommer'), verbe: 'nommer', focus: false, refus: null,
  champs: [{ type: 'saisieTexte', id: 'nommer/nom', ton: 'neutre', nom: 'nom', optionnel, libelle: t('ecran.editeur.entite.nom'), valeur: nom }],
});

/** Le formulaire qui change l'identifiant `id` de la zone d'effet sélectionnée. */
const formulaireDeLIdentifiant = (id: string): Formulaire => ({
  type: 'formulaire', id: 'identifier', libelle: t('ecran.editeur.zone.identifier'), verbe: 'identifier', focus: false, refus: null,
  champs: [{ type: 'saisieTexte', id: 'identifier/id', ton: 'neutre', nom: 'id', optionnel: false, libelle: t('ecran.editeur.zone.identifiant'), valeur: id }],
});

/** Par entrée des fiches commitées, son texte coupé au mot. */
const COURT_DE_L_ENTREE = new Map(ENTREES_DE_DOSSIER.map((e) => [e.id, coupeAuMot(e.libelle, 70)]));

/** Les entrées de fiche que couvre la zone (`couvre`), chacune retirée à sa pression, ou la ligne qui dit qu'il n'y en a
 *  aucune ; puis la liste des entrées des fiches commitées qu'elle ne couvre pas, chacune ajoutée à son choix. */
function couverture(couvre: readonly string[] | undefined, sur: (patch: PatchDeZone) => GesteDEdition): (Choix | Ligne)[] {
  const ids = couvre ?? [];
  const reste = (sans: string) => ids.filter((id) => id !== sans);
  return [
    ids.length
      ? choix('zone/couvre', t('ecran.editeur.zone.couvre'), ids.map((id) =>
        bouton(`zone/couvre/${id}`, `${id} — ${COURT_DE_L_ENTREE.get(id) ?? t('ecran.editeur.zone.couvre.introuvable')}`, sur({ couvre: reste(id).length ? reste(id) : null }), true)))
      : ligne('zone/couvre', t('ecran.editeur.zone.couvre.aucune')),
    choix('zone/couvre/ajouter', t('ecran.editeur.zone.couvre.ajouter'), ENTREES_DE_DOSSIER.filter((e) => !ids.includes(e.id)).map((e) =>
      bouton(`zone/couvre/ajouter/${e.id}`, `${e.id} — ${COURT_DE_L_ENTREE.get(e.id)}`, sur({ couvre: [...ids, e.id] }), false)), 'liste'),
  ];
}

/** La rangée des couches de la scène éditée de `s`, la couche `z` pressée, chacune jouant `jeu`. */
const choixDeLaCouche = (s: SessionDEdition, id: string, z: number, jeu: (z: number) => GesteDEdition): Choix =>
  choix(id, t('ecran.editeur.entite.couche'), sceneEditee(s).layers.map((l) => l.z).sort((a, b) => a - b)
    .map((c) => bouton(`${id}/${c}`, t('ecran.editeur.couche', { z: c }), jeu(c), c === z)));

/** L'inspecteur de l'entité sélectionnée de la session `s` : son nom ; le type d'un décor, la fiche d'un personnage du
 *  bestiaire ; son cap parmi ceux que son type admet ; sa couche ; la lumière et les places d'un décor ; le poste d'un
 *  emplacement de siège et l'équipage exposé d'une coque ; l'embuscade d'un personnage et ses rencontres ; la supprimer. */
function inspecteurDEntite(s: SessionDEdition, ent: Scene['entities'][number]): (Choix | Ligne | Bouton | Formulaire)[] {
  const fiches = fichesDePersonnage();
  const types = ent.kind === 'prop' ? props : ent.kind === 'personnage' && fiches.some((f) => f.id === ent.ref) ? fiches : [];
  const cap = capDeLEntite(ent);
  return [
    formulaireDuNom(ent.label ?? '', true),
    ...(types.length ? [choix('entite/type', t(ent.kind === 'prop' ? 'ecran.editeur.entite.type' : 'ecran.editeur.entite.fiche'),
      types.map((o) => bouton(`entite/type/${o.id}`, o.label, { geste: 'entite', patch: { ref: o.id } }, ent.ref === o.id)), 'liste')] : []),
    choix('entite/cap', t('ecran.editeur.entite.cap'), capsOfferts(ent).map((c) => bouton(`entite/cap/${c}`, t(`ecran.editeur.cap.${c}`), { geste: 'entite', patch: { facing: c } }, c === cap))),
    choixDeLaCouche(s, 'entite/couche', ent.z ?? 0, (z) => ({ geste: 'entite', patch: { z } })),
    ...(ent.kind === 'prop' ? [...lumiere(ent), ...places(s, ent)] : []),
    ...(ent.postes?.length ? poste(s, ent, ent.postes[0]) : []),
    ...(ent.postes?.length || (ent.ref && findVehicleById(ent.ref)?.hull)
      ? equipe(s, ent, 'equipage', ent.crewIds ?? [], (crewIds) => ({ geste: 'entite', patch: { crewIds } }))
      : []),
    ...(ent.kind === 'personnage' ? rencontres(s, ent) : []),
    bouton('entite/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' }),
  ];
}

/** Le pas du rayon d'une lumière, en mètres, et son plancher (`light.radiusM`). */
const PAS_DE_RAYON = 1;

/** La lumière du décor `ent` : l'allumer ou l'éteindre ; allumée, son rayon et son ton. */
function lumiere(ent: Scene['entities'][number]): (Choix | Ligne | Bouton)[] {
  const allumer = bouton('lumiere', t('ecran.editeur.lumiere'), { geste: 'entite', patch: { light: ent.light ? null : lumiereAllumee(ent) } }, !!ent.light);
  const l = ent.light;
  if (!l) return [allumer];
  const rayon = (r: number) => ({ geste: 'entite' as const, patch: { light: { ...l, radiusM: r } } });
  return [
    allumer,
    ligne('lumiere/rayon', t('ecran.editeur.lumiere.rayon', { m: l.radiusM })),
    bouton('lumiere/moins', t('ecran.editeur.lumiere.moins'), rayon(l.radiusM - PAS_DE_RAYON), false, l.radiusM - PAS_DE_RAYON < PAS_DE_RAYON ? t('ecran.editeur.lumiere.plancher') : null),
    bouton('lumiere/plus', t('ecran.editeur.lumiere.plus'), rayon(l.radiusM + PAS_DE_RAYON)),
    choix('lumiere/ton', t('ecran.editeur.lumiere.ton'), [
      bouton('lumiere/ton/herite', t('ecran.editeur.lumiere.ton.herite'), { geste: 'entite', patch: { light: { radiusM: l.radiusM } } }, l.tone === undefined),
      ...lightTones.map((ton) => bouton(`lumiere/ton/${ton.id}`, ton.label, { geste: 'entite', patch: { light: { ...l, tone: ton.id } } }, l.tone === ton.id)),
    ], 'liste'),
  ];
}

/** Les personnages de la scène éditée de `s` hors de l'entité `ent`. */
const personnagesHors = (s: SessionDEdition, ent: Scene['entities'][number]) =>
  sceneEditee(s).entities.filter((e) => e.kind === 'personnage' && e.id !== ent.id);

/** Le libellé de chaque équipe d'une entité, et sa consigne sans personnage à y mettre. */
const EQUIPES = {
  equipage: ['ecran.editeur.equipage', 'ecran.editeur.equipage.aucun'],
  'poste/servants': ['ecran.editeur.poste.servants', 'ecran.editeur.poste.servants.aucun'],
} as const;

/** L'équipe `ids` de l'entité `ent` de la session `s` sous l'id `id` : chaque personnage de la scène hors d'elle, pressé
 *  s'il en est, qui l'y ajoute à la fin ou l'en retire (`jeu`) ; sans personnage, la consigne d'en poser. */
function equipe(s: SessionDEdition, ent: Scene['entities'][number], id: keyof typeof EQUIPES, ids: readonly string[], jeu: (ids: string[]) => GesteDEdition): (Choix | Ligne)[] {
  const candidats = personnagesHors(s, ent);
  const [libelle, aucun] = EQUIPES[id];
  if (!candidats.length) return [ligne(id, t(aucun))];
  return [choix(id, t(libelle), candidats.map((c) => {
    const a = ids.includes(c.id);
    return bouton(`${id}/${c.id}`, nomALEcran(s, c), jeu(a ? ids.filter((i) => i !== c.id) : [...ids, c.id]), a);
  }))];
}

/** Les clés d'un occupant de place, sa nature en tête. */
const cleDeLOccupant = (o: SeatOccupant): string => (o.kind === 'party' ? `heros-${o.rang}` : o.entityId);

/** L'assise du décor `ent` de la session `s` : l'ouvrir au jeu ; chacune des places que son type porte, tenue par
 *  personne, par un personnage de la scène ou par un emplacement du groupe, chaque occupant refusé avec sa raison. */
function places(s: SessionDEdition, ent: Scene['entities'][number]): (Choix | Bouton)[] {
  const scene = sceneEditee(s);
  const slots = seatSlotsOf(scene, ent.id);
  if (!slots.length) return [];
  const tenues = scene.seatAssignments?.[ent.id] ?? {};
  const occupants: { occupant: SeatOccupant; nom: string }[] = [
    ...scene.entities.filter((e) => e.kind === 'personnage').map((e) => ({ occupant: { kind: 'entity' as const, entityId: e.id }, nom: nomALEcran(s, e) })),
    ...Array.from({ length: PARTY_MAX }, (_, i) => ({ occupant: { kind: 'party' as const, rang: i + 1 }, nom: labelEmplacement(i + 1) })),
  ];
  return [
    bouton('assise', t('ecran.editeur.assise'), { geste: 'entite', patch: { assise: !ent.usable?.assise } }, !!ent.usable?.assise),
    ...slots.map(({ slotId }) => {
      const tenant = tenues[slotId];
      const id = `place/${slotId}`;
      return choix(id, t('ecran.editeur.place', { place: slotId }), [
        bouton(`${id}/personne`, t('ecran.editeur.place.personne'), { geste: 'place', place: slotId, occupant: null }, !tenant),
        ...occupants.map(({ occupant, nom }) => {
          const tient = !!tenant && cleDeLOccupant(tenant) === cleDeLOccupant(occupant);
          const res = tient ? null : assoirALaPlace(scene, ent.id, slotId, occupant);
          return bouton(`${id}/${cleDeLOccupant(occupant)}`, nom, { geste: 'place', place: slotId, occupant }, tient,
            res && !res.ok ? t(`ecran.editeur.place.refus.${res.reason}`) : null);
        }),
      ], 'liste');
    }),
  ];
}

/** Les arcs d'un créneau directionnel, dans l'ordre horaire depuis la proue. */
const ARCS = ['proue', 'tribord', 'poupe', 'babord'] as const;

/** Le poste de l'emplacement de siège `ent` de la session `s` : son engin, son arc (omni ou l'un des quatre), ses
 *  servants, et parmi eux le chef de pièce, en tête. */
function poste(s: SessionDEdition, ent: Scene['entities'][number], p: NonNullable<Scene['entities'][number]['postes']>[number]): (Choix | Ligne)[] {
  const servants = p.crewIds ?? [];
  const parId = new Map(sceneEditee(s).entities.map((e) => [e.id, e]));
  const nom = (id: string) => { const e = parId.get(id); return e ? nomALEcran(s, e) : id; };
  return [
    choix('poste/engin', t('ecran.editeur.poste.engin'), siegeEngines().map((e) => bouton(`poste/engin/${e.id}`, e.label, { geste: 'poste', patch: { engin: e.id } }, p.trappingId === e.id)), 'liste'),
    choix('poste/arc', t('ecran.editeur.poste.arc'), [
      bouton('poste/arc/omni', t('ecran.editeur.poste.arc.omni'), { geste: 'poste', patch: { arc: null } }, !p.side),
      ...ARCS.map((a) => bouton(`poste/arc/${a}`, t(`ecran.editeur.poste.arc.${a}`), { geste: 'poste', patch: { arc: a } }, p.side === a)),
    ]),
    ...equipe(s, ent, 'poste/servants', servants, (ids) => ({ geste: 'poste', patch: { servants: ids } })),
    ...(servants.length ? [choix('poste/chef', t('ecran.editeur.poste.chef'), servants.map((id) =>
      bouton(`poste/chef/${id}`, nom(id), { geste: 'poste', patch: { servants: [id, ...servants.filter((i) => i !== id)] } }, servants[0] === id)))] : []),
  ];
}

/** L'embuscade du personnage `ent` de la session `s` et ses rencontres : dans chacune, enrôlé ou non, ennemi ou allié,
 *  piloté par l'IA s'il est allié ; l'enrôler dans une rencontre neuve. */
function rencontres(s: SessionDEdition, ent: Scene['entities'][number]): (Choix | Bouton)[] {
  return [
    bouton('embusque', t('ecran.editeur.embusque'), { geste: 'entite', patch: { embusque: !ent.combat?.hiddenUntilCombat } }, !!ent.combat?.hiddenUntilCombat),
    ...sceneEditee(s).encounters.map((enc) => {
      const m = enc.members?.find((mm) => mm.entityId === ent.id);
      const membre = (patch: Omit<Extract<GesteDEdition, { geste: 'membre' }>['patch'], 'rencontre'>): GesteDEdition => ({ geste: 'membre', patch: { rencontre: enc.id, ...patch } });
      const id = `rencontre/${enc.id}`;
      return choix(id, t('ecran.editeur.rencontre', { id: enc.id }), [
        bouton(`${id}/enrole`, t('ecran.editeur.rencontre.enrole'), membre({ enrole: !m }), !!m),
        ...(m ? [
          bouton(`${id}/ennemi`, t('ecran.editeur.rencontre.ennemi'), membre({ camp: 'enemy' }), m.side !== 'ally'),
          bouton(`${id}/allie`, t('ecran.editeur.rencontre.allie'), membre({ camp: 'ally' }), m.side === 'ally'),
        ] : []),
        ...(m?.side === 'ally' ? [bouton(`${id}/ia`, t('ecran.editeur.rencontre.ia'), membre({ ia: !m.ai }), !!m.ai)] : []),
      ]);
    }),
    bouton('rencontre/neuve', t('ecran.editeur.rencontre.neuve'), { geste: 'membre', patch: { rencontre: null, enrole: true } }),
  ];
}

/** L'inspecteur de l'entrée sélectionnée de la session `s` : son nom, sa couche ; la supprimer. */
function inspecteurDEntree(s: SessionDEdition, entree: { nom: string; z: number }): (Choix | Bouton | Formulaire)[] {
  return [
    formulaireDuNom(entree.nom, false),
    choixDeLaCouche(s, 'entree/couche', entree.z, (z) => ({ geste: 'entree', z })),
    bouton('entree/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' }),
  ];
}

/** Les lieux de repos qu'une zone de repos offre. */
const LIEUX = ['auberge', 'maison', 'camp'] as const;

type Rect = { x: number; y: number; w: number; h: number };

/** Les cases du rectangle `r`, ligne à ligne. */
const casesDuRect = (r: Rect): { x: number; y: number }[] =>
  Array.from({ length: r.w * r.h }, (_, i) => ({ x: r.x + (i % r.w), y: r.y + Math.floor(i / r.w) }));

/** Une zone de la scène telle que l'éditeur la lit : sa sélection, sa sorte, son nom (l'id d'un déclencheur, le
 *  libellé d'une zone d'effet), son rectangle, sa couche et ses cases (`sceneZoneTiles` d'une zone d'effet). */
interface ZoneLue {
  sel: Sel;
  sorte: SorteDeZone;
  nom: string;
  rect: Rect;
  z: number;
  cases: { x: number; y: number }[];
}

/** Les zones de la scène `scene` : ses déclencheurs, ses zones de repos, puis ses zones d'effet. */
function zonesLues(scene: Scene): ZoneLue[] {
  return [
    ...scene.triggers.map((tr) => ({ sel: { type: 'trigger' as const, id: tr.id }, sorte: 'declencheur' as const, nom: tr.id, rect: tr.rect, z: tr.rect.z ?? 0, cases: casesDuRect(tr.rect) })),
    ...(scene.restZones ?? []).map((r, idx) => ({
      sel: { type: 'restZone' as const, idx }, sorte: 'repos' as const, nom: t('ecran.editeur.zone.sorte.repos'), rect: r.rect, z: r.rect.z ?? 0, cases: casesDuRect(r.rect),
    })),
    ...(scene.effectZones ?? []).map((ez, idx) => ({
      sel: { type: 'effectZone' as const, idx }, sorte: isRoomZone(ez) ? 'piece' as const : 'zone' as const, nom: ez.label, rect: effectZoneRect(ez.area), z: ez.z ?? 0, cases: sceneZoneTiles(ez),
    })),
  ];
}

/** L'emprise au pinceau de la zone d'effet `zoneId` : y ajouter des cases, en retirer (l'outil d'emprise armé dans ce
 *  sens, pressé). */
function emprise(zoneId: string, outil: SessionDEdition['outil']): Choix[] {
  const sens = outil.mode === 'zoneTiles' && outil.zoneId === zoneId ? outil.paint : null;
  return [choix('emprise', t('ecran.editeur.zone.emprise'), (['add', 'remove'] as const).map((paint) =>
    bouton(`emprise/${paint}`, t(`ecran.editeur.zone.emprise.${paint}`), { geste: 'outil', outil: { mode: 'zoneTiles', zoneId, paint } }, sens === paint)))];
}

/** L'inspecteur de la zone sélectionnée `zone` de la session `s` : la poignée qui la redimensionne ; d'un déclencheur,
 *  son nom ; d'une zone d'effet, son nom, son identifiant, sa nature, sa forme, son emprise au pinceau et toute son aire
 *  rendue, si elle coupe la ligne de vue, si elle barre le passage, et les entrées de fiche qu'elle couvre ; sa couche ;
 *  d'un déclencheur, s'il ne joue qu'une fois et les entrées de fiche qu'il couvre ; d'une zone de repos, ses lieux et
 *  sa qualité ; la supprimer. */
function inspecteurDeZone(s: SessionDEdition, zone: ZoneLue): (Choix | Ligne | Bouton | Formulaire)[] {
  const scene = sceneEditee(s);
  const sur = (patch: PatchDeZone): GesteDEdition => ({ geste: 'zone', patch });
  const sel = zone.sel;
  const propre: (Choix | Ligne | Bouton | Formulaire)[] = [];
  if (sel?.type === 'effectZone') {
    const ez = scene.effectZones![sel.idx];
    propre.push(
      formulaireDuNom(ez.label, false),
      formulaireDeLIdentifiant(ez.id),
      choix('zone/nature', t('ecran.editeur.zone.nature'), ([null, 'interior', 'exterior'] as const).map((n) =>
        bouton(`zone/nature/${n ?? 'aucune'}`, t(`ecran.editeur.zone.nature.${n ?? 'aucune'}`), sur({ presentation: n }), (ez.presentation ?? null) === n))),
      choix('zone/forme', t('ecran.editeur.zone.forme'), (['rect', 'disc'] as const).map((f) =>
        bouton(`zone/forme/${f}`, t(`ecran.editeur.zone.forme.${f}`), sur({ forme: f }), ez.area.kind === f))),
      ...emprise(ez.id, s.outil),
      bouton('zone/pleine', t('ecran.editeur.zone.emprise.pleine'), sur({ pleine: true }), false, ez.tiles ? null : t('ecran.editeur.zone.emprise.dejaPleine')),
      bouton('zone/blocksLoS', t('ecran.editeur.zone.blocksLoS'), sur({ blocksLoS: !ez.blocksLoS }), !!ez.blocksLoS),
      bouton('zone/barrier', t('ecran.editeur.zone.barrier'), sur({ barrier: !ez.barrier }), !!ez.barrier),
      ...couverture(ez.couvre, sur),
    );
  }
  propre.push(choixDeLaCouche(s, 'zone/couche', zone.z, (z) => sur({ z })));
  if (sel?.type === 'trigger') {
    const declencheur = scene.triggers.find((tr) => tr.id === sel.id)!;
    propre.unshift(formulaireDuNom(declencheur.id, false));
    propre.push(bouton('zone/uneFois', t('ecran.editeur.zone.uneFois'), sur({ once: !declencheur.once }), !!declencheur.once), ...couverture(declencheur.couvre, sur));
  }
  if (sel?.type === 'restZone') {
    const repos = scene.restZones![sel.idx];
    propre.push(
      choix('zone/lieux', t('ecran.editeur.zone.lieux'), LIEUX.map((l) => bouton(`zone/lieux/${l}`, t(`ecran.editeur.zone.lieu.${l}`), sur({ lieux: { [l]: !repos.places[l] } }), !!repos.places[l]))),
      bouton('zone/pietre', t('ecran.editeur.zone.pietre'), sur({ pietre: repos.quality !== 'pietre' }), repos.quality === 'pietre'),
    );
  }
  return [ligne('zone/poignee', t('ecran.editeur.zone.poignee')), ...propre, bouton('zone/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' })];
}

/** Copier l'entité sélectionnée de la session `s`, la coller sur la case pointée, la dupliquer. */
function presse(s: SessionDEdition): Bouton[] {
  const choisie = entiteDeLaSelection(sceneEditee(s), s.sel) ? null : t('ecran.editeur.presse.aucune');
  const coller = !s.presse ? t('ecran.editeur.coller.vide') : s.pointee?.z !== s.z ? t('ecran.editeur.coller.horsCouche') : null;
  return [
    bouton('copier', t('ecran.editeur.copier'), { geste: 'copier' }, false, choisie),
    bouton('coller', t('ecran.editeur.coller'), { geste: 'coller' }, false, coller),
    bouton('dupliquer', t('ecran.editeur.dupliquer'), { geste: 'dupliquer' }, false, choisie),
  ];
}

/** Le pas des réglettes de l'allège et de la chute suspendue, en mètres, et leur plancher (`wallSegSchema`). */
const PAS_D_ALLEGE = 0.1;
const PAS_DE_SUSPENSION = 0.5;
const arrondi = (m: number) => Math.round(m * 100) / 100;

/** Le geste d'inspecteur qui écrit `patch` sur l'arête sélectionnée et, s'il est donné, pose le brouillon `brouillon`. */
const surLArete = (patch: PatchDArete | null, brouillon?: BrouillonDArete | null): GesteDEdition =>
  ({ geste: 'arete', ...(patch ? { patch } : {}), ...(brouillon !== undefined ? { brouillon } : {}) });

/** L'inspecteur de l'arête sélectionnée de la session `s` (vide sans elle) : cloison ou porte ; d'une porte, fermée au
 *  départ et secrète, la difficulté de Perception et la face d'où elle se découvre ; d'une cloison, fenêtre, volets
 *  clos, franchissable, la hauteur d'allège et la chute suspendue ; son matériau, son apparence, son escalade (échelle,
 *  paroi : difficulté, Grimpeur requis) ; la supprimer. Ce que le schéma exige sans valeur par défaut (la difficulté et
 *  la face d'une porte secrète, l'allège d'une croisée franchissable) attend au brouillon de la session, dit en alerte. */
function inspecteurDArete(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const seg = segmentDeLaSelection(sceneEditee(s), s.sel);
  if (!seg) return [];
  const brouillon = s.brouillon ?? {};
  const avec = (b: BrouillonDArete) => (Object.keys(b).length ? b : null);
  const sans = <K extends keyof BrouillonDArete>(...cles: K[]) => avec(Object.fromEntries(Object.entries(brouillon).filter(([k]) => !cles.includes(k as K))));
  const bascule = (id: 'fermee' | 'secrete' | 'fenetre' | 'volets' | 'franchissable' | 'grimpeur', presse: boolean, jeu: GesteDEdition, refus: string | null = null) => bouton(`arete/${id}`, t(`ecran.editeur.inspecteur.${id}`), jeu, presse, refus);
  const porte = porteAuteur(seg);
  const elements: (Choix | Ligne | Bouton)[] = [
    choix('arete/sorte', t('ecran.editeur.inspecteur.sorte'), [
      bouton('arete/cloison', t('ecran.editeur.arete.wall'), surLArete({ door: null, closed: null }), !porte),
      bouton('arete/porte', t('ecran.editeur.arete.door'), surLArete({ door: true, window: null, shuttered: null, crossable: null, allege: null, suspendu: null }, sans('crossable')), porte),
    ]),
  ];
  if (porte) {
    const secret = secretAuteur(seg) ?? brouillon.secret;
    elements.push(
      bascule('fermee', !!seg.closed, surLArete({ closed: seg.closed ? null : true }), secretAuteur(seg) ? t('ecran.editeur.inspecteur.fermee.secrete') : null),
      bascule('secrete', !!secret, secret ? surLArete(secretAuteur(seg) ? { secret: null } : null, sans('secret')) : surLArete(null, { ...brouillon, secret: {} })),
    );
    if (secret) {
      const choisir = (v: Partial<NonNullable<BrouillonDArete['secret']>>) => {
        const suite = { ...secret, ...v };
        return suite.difficulty && suite.face
          ? surLArete({ secret: { difficulty: suite.difficulty, face: suite.face }, closed: true }, sans('secret'))
          : surLArete(null, { ...brouillon, secret: suite });
      };
      elements.push(
        choix('arete/perception', t('ecran.editeur.inspecteur.perception'), (Object.entries(DIFFICULTY_LABELS) as [Difficulty, string][])
          .map(([d, libelle]) => bouton(`arete/perception/${d}`, libelle, choisir({ difficulty: d }), secret.difficulty === d)), 'liste'),
        choix('arete/face', t('ecran.editeur.inspecteur.face'), FACES_D_ARETE.map(([f, libelle]) => bouton(`arete/face/${f}`, libelle, choisir({ face: f }), secret.face === f))),
        ...(secret.difficulty && secret.face ? [] : [ligne('arete/secreteIncomplete', t('ecran.editeur.inspecteur.secrete.incomplete'), 'alerte')]),
      );
    }
  } else {
    elements.push(bascule('fenetre', !!seg.window, seg.window ? surLArete({ window: null }, sans('crossable')) : surLArete({ window: true })));
    if (seg.window) {
      const franchissable = !!(seg.crossable || brouillon.crossable);
      elements.push(
        bascule('volets', !!seg.shuttered, surLArete({ shuttered: seg.shuttered ? null : true })),
        bascule('franchissable', franchissable, franchissable ? surLArete(seg.crossable ? { crossable: null } : null, sans('crossable')) : surLArete(null, { ...brouillon, crossable: true })),
      );
      if (franchissable) {
        const allege = seg.allege;
        const poserLAllege = (m: number) => surLArete({ crossable: true, allege: arrondi(Math.max(0, m)) }, sans('crossable'));
        elements.push(
          allege === undefined
            ? ligne('arete/allege', t('ecran.editeur.inspecteur.allege.manquante'), 'alerte')
            : ligne('arete/allege', t('ecran.editeur.inspecteur.allege', { m: allege })),
          bouton('arete/allege/moins', t('ecran.editeur.inspecteur.moins', { pas: PAS_D_ALLEGE }), poserLAllege((allege ?? 0) - PAS_D_ALLEGE), false, allege ? null : t('ecran.editeur.inspecteur.auPlancher')),
          bouton('arete/allege/plus', t('ecran.editeur.inspecteur.plus', { pas: PAS_D_ALLEGE }), poserLAllege((allege ?? 0) + PAS_D_ALLEGE)),
        );
      }
      if (seg.crossable) {
        const suspendu = seg.suspendu;
        const poserLaChute = (m: number) => surLArete({ suspendu: arrondi(Math.max(PAS_DE_SUSPENSION, m)) });
        elements.push(
          ligne('arete/suspendu', suspendu === undefined ? t('ecran.editeur.inspecteur.suspendu.aucune') : t('ecran.editeur.inspecteur.suspendu', { m: suspendu })),
          bouton('arete/suspendu/aucune', t('ecran.editeur.inspecteur.aucune'), surLArete({ suspendu: null }), false, suspendu === undefined ? t('ecran.editeur.inspecteur.suspendu.aucune') : null),
          bouton('arete/suspendu/moins', t('ecran.editeur.inspecteur.moins', { pas: PAS_DE_SUSPENSION }), poserLaChute((suspendu ?? 0) - PAS_DE_SUSPENSION), false, suspendu !== undefined && suspendu > PAS_DE_SUSPENSION ? null : t('ecran.editeur.inspecteur.auPlancher')),
          bouton('arete/suspendu/plus', t('ecran.editeur.inspecteur.plus', { pas: PAS_DE_SUSPENSION }), poserLaChute(suspendu === undefined ? PAS_DE_SUSPENSION : suspendu + PAS_DE_SUSPENSION)),
        );
      }
    }
  }
  const climb = seg.climb;
  elements.push(
    choix('arete/structure', t('ecran.editeur.structures'), [
      bouton('arete/structure/defaut', t('ecran.editeur.structure.defaut'), surLArete({ structure: null }), seg.structure === undefined),
      ...structuresDeLArete(porte ? 'door' : 'wall').map((st) => bouton(`arete/structure/${st.id}`, st.label, surLArete({ structure: st.id }), seg.structure === st.id)),
    ], 'liste'),
    choix('arete/apparence', t('ecran.editeur.inspecteur.apparence'), [
      bouton('arete/apparence/derivee', t('ecran.editeur.inspecteur.apparence.derivee'), surLArete({ appearance: null }), seg.appearance === undefined),
      ...structureAppearances.map((a) => bouton(`arete/apparence/${a.id}`, a.label, surLArete({ appearance: a.id }), seg.appearance === a.id)),
    ], 'liste'),
    choix('arete/escalade', t('ecran.editeur.inspecteur.escalade'), [
      bouton('arete/escalade/non', t('ecran.editeur.inspecteur.escalade.non'), surLArete({ climb: null }), !climb),
      bouton('arete/escalade/echelle', t('ecran.editeur.inspecteur.escalade.echelle'), surLArete({ climb: { kind: 'ladder' } }), climb?.kind === 'ladder'),
      bouton('arete/escalade/paroi', t('ecran.editeur.inspecteur.escalade.paroi'), surLArete({ climb: { ...(climb?.kind === 'surface' ? climb : {}), kind: 'surface' } }), climb?.kind === 'surface'),
    ]),
  );
  if (climb?.kind === 'surface') {
    elements.push(
      choix('arete/escalade/difficulte', t('ecran.editeur.inspecteur.escalade.difficulte'), (Object.entries(DIFFICULTY_LABELS) as [Difficulty, string][])
        .map(([d, libelle]) => bouton(`arete/escalade/difficulte/${d}`, libelle, surLArete({ climb: { ...climb, difficulty: d } }), (climb.difficulty ?? 'intermediaire') === d)), 'liste'),
      bascule('grimpeur', !!climb.requiresGrimpeur, surLArete({ climb: { kind: 'surface', ...(climb.difficulty ? { difficulty: climb.difficulty } : {}), ...(climb.requiresGrimpeur ? {} : { requiresGrimpeur: true }) } })),
    );
  }
  elements.push(bouton('arete/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' }));
  return elements;
}

/** L'inspecteur de la sélection de la session `s` : de l'entité, de l'entrée, de la zone ou de l'arête sélectionnée ;
 *  vide sans elle. */
function inspecteur(s: SessionDEdition): (Choix | Ligne | Bouton | Formulaire)[] {
  const ent = entiteDeLaSelection(sceneEditee(s), s.sel);
  const entree = entreeDeLaSelection(s);
  const zone = zonesLues(sceneEditee(s)).find((z) => sameSel(z.sel, s.sel));
  return ent ? inspecteurDEntite(s, ent) : entree ? inspecteurDEntree(s, entree) : zone ? inspecteurDeZone(s, zone) : inspecteurDArete(s);
}

/** La ligne du parapet crénelé de la case pointée de la session `s`, sa structure ; aucune sans parapet. */
function ligneDuParapet(s: SessionDEdition): Ligne[] {
  const p = s.pointee;
  const parapet = p ? crenellatedAt(sceneEditee(s), p.x, p.y, p.z) : null;
  return parapet === null ? [] : [ligne('crenelage', t('ecran.editeur.pointee.crenelage', { structure: libelleDeStructure(parapet) ?? parapet }))];
}

/** Le pas de la réglette d'opacité du calque. */
const PAS_D_OPACITE = 0.1;

/** Le calque de référence de la couche éditée de la session `s` : sa couche ; la planche qui se charge, ou, sans
 *  calque, de quoi en charger une ; pendant le calage, l'étape à cliquer et l'abandon ; sinon, visible, au-dessus ou en
 *  dessous, l'opacité à la réglette, l'échelle de son calage, la rotation que le calage déduit, le calage (refusé au
 *  calque caché), remplacer la planche, retirer le calque. Des calques d'un autre format retirés à l'ouverture se
 *  disent en alerte. */
function zoneDuCalque(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const tete = [ligne('calque', t('ecran.editeur.calque', { z: s.z })), ...(s.ecartes ? [ligne('calque/ecartes', t('ecran.editeur.calque.ecartes'), 'alerte')] : [])];
  if (s.chargement) return [...tete, ligne('calque/chargement', t('ecran.editeur.calque.chargement'))];
  const calque = calqueDeLaCouche(s);
  const charger = bouton('calque/charger', t(calque ? 'ecran.editeur.calque.remplacer' : 'ecran.editeur.calque.charger'), { geste: 'planche' });
  if (!calque) return [...tete, ligne('calque/aucun', t('ecran.editeur.calque.aucun')), charger];
  if (s.calage.step !== 'idle') {
    return [...tete, ligne('calque/calage', t(`ecran.editeur.calque.calage.${s.calage.step}`)), bouton('calque/calage/annuler', t('ecran.editeur.calque.calage.annuler'), { geste: 'caler', actif: false })];
  }
  const regler = (reglage: { opacite?: number; visible?: boolean; dessus?: boolean; rotation?: boolean }): GesteDEdition => ({ geste: 'calque', reglage });
  const pas = Math.round(PAS_D_OPACITE * 100);
  return [
    ...tete,
    bouton('calque/visible', t('ecran.editeur.calque.visible'), regler({ visible: !calque.visible }), calque.visible),
    choix('calque/position', t('ecran.editeur.calque.position'), [
      bouton('calque/dessus', t('ecran.editeur.calque.dessus'), regler({ dessus: true }), calque.dessus),
      bouton('calque/dessous', t('ecran.editeur.calque.dessous'), regler({ dessus: false }), !calque.dessus),
    ]),
    ligne('calque/opacite', t('ecran.editeur.calque.opacite', { pourcent: Math.round(calque.opacite * 100) })),
    bouton('calque/opacite/moins', t('ecran.editeur.calque.moins', { pas }), regler({ opacite: arrondi(Math.max(0, calque.opacite - PAS_D_OPACITE)) }), false, calque.opacite > 0 ? null : t('ecran.editeur.inspecteur.auPlancher')),
    bouton('calque/opacite/plus', t('ecran.editeur.calque.plus', { pas }), regler({ opacite: arrondi(Math.min(1, calque.opacite + PAS_D_OPACITE)) }), false, calque.opacite < 1 ? null : t('ecran.editeur.calque.auMaximum')),
    ligne('calque/echelle', t('ecran.editeur.calque.echelle', { px: arrondi(1 / calque.calage.scale) })),
    bouton('calque/rotation', t('ecran.editeur.calque.rotation'), regler({ rotation: !calque.rotation }), calque.rotation),
    bouton('calque/caler', t('ecran.editeur.calque.caler'), { geste: 'caler', actif: true }, false, calque.visible ? null : t('ecran.editeur.calque.caler.cache')),
    charger,
    bouton('calque/retirer', t('ecran.editeur.calque.retirer'), { geste: 'retirerCalque' }),
  ];
}

/** La planche que l'hôte garde pour le calque de la couche `z` de la scène `sceneId` du projet `projetId`. */
export const cheminDeLaPlanche = (projetId: string, sceneId: string, z: number): string => `calques/${projetId}/${sceneId}/${z}`;

/** Le calque de la couche éditée de la session `s` à poser sur le monde, `null` sans lui ou caché. */
export function calqueAffiche(s: SessionDEdition): CalqueAffiche | null {
  const c = calqueDeLaCouche(s);
  return c?.visible
    ? { image: cheminDeLaPlanche(s.projet.id, s.sceneId, s.z), coins: coinsDuCalque(c), plan: planDuCalque(sceneEditee(s), s.z), opacite: c.opacite, dessus: c.dessus }
    : null;
}

/** Ce que l'hôte garde des calques après le geste qui mène de `avant` (`null` : l'ouverture) à `apres` : `null` s'ils
 *  n'ont pas changé ; sinon leur forme stockée, et les planches des calques retirés, à oublier. À l'ouverture, ils ne
 *  changent que retirés d'un autre format. */
export function memoireDesCalques(avant: SessionDEdition | null, apres: SessionDEdition): { calques: CalquesStockes; oublier: string[] } | null {
  if (avant ? apres.calques === avant.calques : !apres.ecartes) return null;
  const oublier = Object.entries(avant?.calques ?? {}).flatMap(([sceneId, couches]) =>
    Object.keys(couches).filter((z) => !apres.calques[sceneId]?.[z]).map((z) => cheminDeLaPlanche(apres.projet.id, sceneId, Number(z))));
  return { calques: calquesAStocker(apres.calques), oublier };
}

/** Pourquoi la session `s` ne s'enregistre pas : son projet vient du jeu, un enregistrement est en cours, ou la
 *  scène éditée est celle que le dépôt porte. */
function refusDEnregistrer(s: SessionDEdition): string | null {
  if (!s.depot) return t('ecran.editeur.enregistrer.horsDuDepot');
  if (s.depot.enCours) return t('ecran.editeur.enregistrer.enCours');
  return sceneEditee(s) === s.depot.enregistree ? t('ecran.editeur.rien.enregistrer') : null;
}

/** Les zones de l'éditeur de la session `s`. Le terrain s'ouvre sur le premier terrain, ou garde celui de l'outil. */
export function zonesDeLEditeur(s: SessionDEdition): ZonesDeLEditeur {
  const scene = sceneEditee(s);
  const terrain = s.outil.mode === 'tile' ? s.outil.terrain : terrainIds()[0];
  const outil = s.outil;
  const kindDeLOutil = (kind: 'prop' | 'personnage') => (outil.mode === 'entity' && outil.kind === kind ? outil.ref : undefined);
  const etages = scene.layers.map((l) => l.z).sort((a, b) => a - b);
  const outils = [
    bouton('outil/select', t('ecran.editeur.outil.select'), { geste: 'outil', outil: { mode: 'select' } }, s.outil.mode === 'select'),
    bouton('outil/tile', t('ecran.editeur.outil.tile'), { geste: 'outil', outil: { mode: 'tile', terrain } }, s.outil.mode === 'tile'),
    bouton('outil/height', t('ecran.editeur.outil.height'), { geste: 'outil', outil: { mode: 'height', metres: HAUTEURS[0].metres } }, s.outil.mode === 'height'),
    bouton('outil/wall', t('ecran.editeur.outil.wall'), { geste: 'outil', outil: { mode: 'wall', paint: 'wall' } }, s.outil.mode === 'wall'),
    bouton('outil/stair', t('ecran.editeur.outil.stair'), { geste: 'outil', outil: { mode: 'stair', toZ: etages.find((z) => z > s.z) ?? s.z } }, s.outil.mode === 'stair'),
    bouton('outil/crenellated', t('ecran.editeur.outil.crenellated'), { geste: 'outil', outil: { mode: 'crenellated', structure: structuresCrenelables()[0]?.id ?? null } }, s.outil.mode === 'crenellated'),
    bouton('outil/prop', t('ecran.editeur.outil.prop'), { geste: 'outil', outil: { mode: 'entity', kind: 'prop', ref: kindDeLOutil('prop') ?? props[0].id } }, kindDeLOutil('prop') !== undefined),
    bouton('outil/personnage', t('ecran.editeur.outil.personnage'), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: kindDeLOutil('personnage') ?? fichesDePersonnage()[0].id } }, kindDeLOutil('personnage') !== undefined),
    bouton('outil/emplacement', t('ecran.editeur.outil.emplacement'), { geste: 'outil', outil: { mode: 'emplacement', trappingId: outil.mode === 'emplacement' ? outil.trappingId : siegeEngines()[0].id } }, outil.mode === 'emplacement'),
    bouton('outil/heroStart', t('ecran.editeur.outil.heroStart'), { geste: 'outil', outil: { mode: 'entity', kind: 'heroStart' } }, s.outil.mode === 'entity' && s.outil.kind === 'heroStart'),
    bouton('outil/entry', t('ecran.editeur.outil.entry'), { geste: 'outil', outil: { mode: 'entry' } }, s.outil.mode === 'entry'),
    bouton('outil/zone', t('ecran.editeur.outil.zone'), { geste: 'outil', outil: { mode: 'zone', zone: outil.mode === 'zone' ? outil.zone : ZONE_VARIANTS[0] } }, outil.mode === 'zone'),
    bouton('outil/erase', t('ecran.editeur.outil.erase'), { geste: 'outil', outil: { mode: 'erase' } }, s.outil.mode === 'erase'),
  ];
  const couches = etages.map((z) => bouton(`couche/${z}`, t('ecran.editeur.couche', { z }), { geste: 'couche', z }, s.z === z));
  const p = s.pointee;
  return {
    'editeur.titre': [ligne('scene', scene.label || scene.id)],
    'editeur.outils': [choix('outils', t('ecran.editeur.outils'), outils)],
    'editeur.options': options(s),
    'editeur.couches': [
      choix('couches', t('ecran.editeur.couches'), couches),
      bouton('couche/ajouter', t('ecran.editeur.couche.ajouter'), { geste: 'ajouterCouche' }),
      bouton('couche/retirer', t('ecran.editeur.couche.retirer'), { geste: 'retirerCouche' }, false, s.z === 0 ? t('ecran.editeur.couche.rez') : null),
    ],
    'editeur.historique': [
      bouton('annuler', t('ecran.editeur.annuler'), { geste: 'annuler' }, false, s.historique.passe.length ? null : t('ecran.editeur.rien.annuler')),
      bouton('retablir', t('ecran.editeur.retablir'), { geste: 'retablir' }, false, s.historique.futur.length ? null : t('ecran.editeur.rien.retablir')),
    ],
    'editeur.presse': presse(s),
    'editeur.fichier': [bouton('enregistrer', t('ecran.editeur.enregistrer'), { geste: 'enregistrer' }, false, refusDEnregistrer(s))],
    'editeur.pointee': [
      ...(p ? [ligne('pointee', t('ecran.editeur.pointee', { x: p.x, y: p.y, z: p.z, terrain: terrainLabel(tileAt(scene, p.x, p.y, p.z)), hauteur: heightAt(scene, p.x, p.y, p.z) }))] : []),
      ...ligneDuParapet(s),
      ...ligneDeLArete(s),
      ...ligneDeLaSelection(s),
    ],
    'editeur.inspecteur': inspecteur(s),
    'editeur.calque': zoneDuCalque(s),
  };
}

/** Les repères de la couche éditée de la session `s` : ses entités, puis ses entrées. */
function reperes(s: SessionDEdition): RepereDeLEdition[] {
  const scene = sceneEditee(s);
  const choisi = (type: 'entity' | 'entry', id: string) => s.sel?.type === type && s.sel.id === id;
  return [
    ...scene.entities.filter((e) => (e.z ?? 0) === s.z)
      .map((e) => ({ sorte: e.kind, id: e.id, x: e.pos.x, y: e.pos.y, z: s.z, nom: nomALEcran(s, e), choisi: choisi('entity', e.id) })),
    ...Object.entries(scene.entryPoints ?? {}).filter(([, p]) => (p.z ?? 0) === s.z)
      .map(([id, p]) => ({ sorte: 'entree' as const, id, x: p.x, y: p.y, z: s.z, nom: id, choisi: choisi('entry', id) })),
  ];
}

/** La surcouche du geste en cours de la session `s`, sur sa couche éditée, ses repères, ses zones et la poignée de la
 *  sélection. */
export function surcoucheDeLEdition(s: SessionDEdition): SurcoucheDeLEdition {
  const scene = sceneEditee(s);
  const g = s.geste;
  const cases = g?.sorte === 'trait' ? g.trace : g?.sorte === 'rectangle' ? casesDuRect(g.rect) : [];
  const seg = segmentDeLaSelection(scene, s.sel);
  const poignee = poigneeDeLaSelection(scene, s.sel, s.z);
  const aLaCouche = (c: { x: number; y: number }) => ({ x: c.x, y: c.y, z: s.z });
  return {
    cases: [...cases, ...s.volee].map(aLaCouche),
    arete: seg ? areteDessinee(scene, seg) : null,
    reperes: reperes(s),
    zones: zonesLues(scene).filter((z) => z.z === s.z).map((z) => ({ sorte: z.sorte, nom: z.nom, cases: z.cases.map(aLaCouche), choisi: sameSel(z.sel, s.sel) })),
    poignee: poignee && aLaCouche(poignee),
  };
}

/** Le bouton des zones `z` qui joue le geste d'édition `edition`, un qui l'offre sans refus d'abord ; `undefined` si
 *  aucun ne le joue. */
export function boutonDeLEdition(z: ZonesDeLEditeur, edition: unknown): Bouton | undefined {
  const cle = jsonCanonique({ edition });
  const jouant = Object.values(z).flat().flatMap((e: Ligne | Choix | Bouton) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : []))
    .filter((b) => jsonCanonique(b.jeu) === cle);
  return jouant.find((b) => !b.refus) ?? jouant[0];
}

const estEntier = (v: unknown): v is number => Number.isInteger(v);
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Le geste du formulaire de l'inspecteur que portent les zones `z`, joué `{ type, args }` : celui qui nomme la
 *  sélection (`formulaireDuNom`), `{ geste: 'nommer', nom }`, le nom saisi, absent s'il est laissé vide ; celui qui change
 *  l'identifiant de la zone d'effet (`formulaireDeLIdentifiant`), `{ geste: 'identifier', id }` ; `undefined` si les zones
 *  ne portent pas ce formulaire ou si `args` n'est pas ce qu'il saisit. */
export function gesteDuFormulaire(z: ZonesDeLEditeur, jeu: unknown): Extract<GesteDEdition, { geste: 'nommer' | 'identifier' }> | undefined {
  if (!estObjet(jeu) || Object.keys(jeu).length !== 2 || (jeu.type !== 'nommer' && jeu.type !== 'identifier') || !Array.isArray(jeu.args)) return undefined;
  const [valeur, ...reste] = jeu.args as unknown[];
  const vide = valeur === undefined || valeur === null;
  if (reste.length || !(typeof valeur === 'string' || (vide && jeu.type === 'nommer'))) return undefined;
  if (!z['editeur.inspecteur'].some((e) => e.type === 'formulaire' && e.verbe === jeu.type)) return undefined;
  if (jeu.type === 'identifier') return { geste: 'identifier', id: valeur as string };
  return { geste: 'nommer', ...(typeof valeur === 'string' ? { nom: valeur } : {}) };
}

/** Si `g` est l'issue de l'écriture d'un enregistrement au dépôt : `{ geste: 'enregistrement', reussi }`, rien de plus. */
export function estLIssueDUnEnregistrement(g: unknown): g is Extract<GesteDEdition, { geste: 'enregistrement' }> {
  return estObjet(g) && g.geste === 'enregistrement' && typeof g.reussi === 'boolean' && Object.keys(g).length === 2;
}

/** Si `g` est l'issue du chargement d'une planche : `{ geste: 'chargement', image }`, `image` nulle ou
 *  `{ largeur, hauteur }` en pixels entiers positifs, rien de plus. */
export function estLIssueDUnChargement(g: unknown): g is Extract<GesteDEdition, { geste: 'chargement' }> {
  if (!estObjet(g) || g.geste !== 'chargement' || Object.keys(g).length !== 2 || !('image' in g)) return false;
  const { image } = g;
  return image === null || (estObjet(image) && Object.keys(image).length === 2 && [image.largeur, image.hauteur].every((n) => estEntier(n) && n > 0));
}

/** Si `g` est un geste du pointeur : `{ geste: 'appui' | 'glisse' | 'relache', point: { case: { x, y }, f: { x, y } } }`,
 *  la case en entiers, le point fractionnaire en nombres finis, rien de plus. */
export function estUnGesteDuPointeur(g: unknown): g is Extract<GesteDEdition, { point: unknown }> {
  if (!estObjet(g) || !['appui', 'glisse', 'relache'].includes(g.geste as string) || Object.keys(g).length !== 2 || !estObjet(g.point)) return false;
  const { point } = g;
  if (Object.keys(point).length !== 2 || !estObjet(point.case) || !estObjet(point.f)) return false;
  const { case: c, f } = point;
  return Object.keys(c).length === 2 && estEntier(c.x) && estEntier(c.y) && Object.keys(f).length === 2 && estNombre(f.x) && estNombre(f.y);
}
