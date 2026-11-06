/**
 * L'ÉDITEUR DE CARTE À L'ÉCRAN D'UN HÔTE (#3508) : ses zones et leurs éléments (`elements.ts`), lus de la session
 * d'édition du noyau (`SessionDEdition`). Les outils, les options de l'outil actif (pinceau, terrains, hauteurs, sorte
 * et structure d'une arête), les couches de la scène, l'historique, l'enregistrement au dépôt, la case pointée et
 * l'arête sélectionnée ; chaque geste porte le geste d'édition qu'il joue (`{ edition }`), prêt à envoyer. Ce que le
 * pointeur trace sur la carte en cours de geste, et l'arête sélectionnée, vont à la surcouche (`surcoucheDeLEdition`),
 * que l'hôte pose sur le monde.
 */
import { HAUTEURS, PINCEAUX, areteDessinee, heightAt, libelleDeStructure, porteAuteur, sceneEditee, segmentDeLaSelection, structuresDeLArete, terrainIds, terrainLabel, tileAt, type AreteDessinee, type GesteDEdition, type SessionDEdition, type WallPaint } from '../noyau/index';
import { t } from '../i18n';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { estObjet } from './formes';
import { ligne, type Bouton, type Choix, type Ligne } from './elements';

/** Les zones de l'éditeur, dans l'ordre où chacune montre ses éléments. */
export interface ZonesDeLEditeur {
  'editeur.titre': Ligne[];
  'editeur.outils': Choix[];
  'editeur.options': Choix[];
  'editeur.couches': (Choix | Bouton)[];
  'editeur.historique': Bouton[];
  'editeur.fichier': Bouton[];
  'editeur.pointee': Ligne[];
}

/** Les cases que le geste en cours trace sur la carte, chacune sur sa couche : le rectangle tiré, ou les cases que le
 *  pinceau a couvertes, que le monde ne montre qu'au relâché ; et l'arête sélectionnée, sur la couche éditée. */
export interface SurcoucheDeLEdition {
  cases: { x: number; y: number; z: number }[];
  arete: AreteDessinee | null;
}

/** Les sortes d'arête que pose l'outil murs. */
const PEINTURES: readonly WallPaint[] = ['wall', 'door', 'diagBack', 'diagFwd'];

const bouton = (id: string, libelle: string, edition: GesteDEdition, presse = false, refus: string | null = null): Bouton => ({
  type: 'bouton', id, libelle, jeu: { edition }, presse, focus: false, refus,
});

const choix = (id: string, libelle: string, valeurs: Bouton[], type: Choix['type'] = 'choix'): Choix => ({
  type, id, ton: 'neutre', libelle, focus: false, refus: null, valeurs,
});

/** Les options de l'outil actif : la taille du pinceau (et le rectangle du terrain), puis les terrains ou les hauteurs. */
function options(s: SessionDEdition): Choix[] {
  const outil = s.outil;
  if (outil.mode === 'select') return [];
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
  const outils = [
    bouton('outil/select', t('ecran.editeur.outil.select'), { geste: 'outil', outil: { mode: 'select' } }, s.outil.mode === 'select'),
    bouton('outil/tile', t('ecran.editeur.outil.tile'), { geste: 'outil', outil: { mode: 'tile', terrain } }, s.outil.mode === 'tile'),
    bouton('outil/height', t('ecran.editeur.outil.height'), { geste: 'outil', outil: { mode: 'height', metres: HAUTEURS[0].metres } }, s.outil.mode === 'height'),
    bouton('outil/wall', t('ecran.editeur.outil.wall'), { geste: 'outil', outil: { mode: 'wall', paint: 'wall' } }, s.outil.mode === 'wall'),
  ];
  const couches = scene.layers.map((l) => l.z).sort((a, b) => a - b).map((z) => bouton(`couche/${z}`, t('ecran.editeur.couche', { z }), { geste: 'couche', z }, s.z === z));
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
    'editeur.fichier': [bouton('enregistrer', t('ecran.editeur.enregistrer'), { geste: 'enregistrer' }, false, refusDEnregistrer(s))],
    'editeur.pointee': [
      ...(p ? [ligne('pointee', t('ecran.editeur.pointee', { x: p.x, y: p.y, z: p.z, terrain: terrainLabel(tileAt(scene, p.x, p.y, p.z)), hauteur: heightAt(scene, p.x, p.y, p.z) }))] : []),
      ...ligneDeLArete(s),
    ],
  };
}

/** La surcouche du geste en cours de la session `s`, sur sa couche éditée. */
export function surcoucheDeLEdition(s: SessionDEdition): SurcoucheDeLEdition {
  const g = s.geste;
  const cases = g?.sorte === 'trait' ? g.trace
    : g?.sorte === 'rectangle' ? Array.from({ length: g.rect.w * g.rect.h }, (_, i) => ({ x: g.rect.x + (i % g.rect.w), y: g.rect.y + Math.floor(i / g.rect.w) }))
    : [];
  const seg = segmentDeLaSelection(sceneEditee(s), s.sel);
  return { cases: cases.map((c) => ({ x: c.x, y: c.y, z: s.z })), arete: seg ? areteDessinee(sceneEditee(s), seg) : null };
}

/** Le bouton des zones `z` qui joue le geste d'édition `edition`, `undefined` si aucun ne le joue. */
export function boutonDeLEdition(z: ZonesDeLEditeur, edition: unknown): Bouton | undefined {
  const cle = jsonCanonique({ edition });
  return Object.values(z).flat().flatMap((e: Ligne | Choix | Bouton) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : []))
    .find((b) => jsonCanonique(b.jeu) === cle);
}

const estEntier = (v: unknown): v is number => Number.isInteger(v);
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Si `g` est l'issue de l'écriture d'un enregistrement au dépôt : `{ geste: 'enregistrement', reussi }`, rien de plus. */
export function estLIssueDUnEnregistrement(g: unknown): g is Extract<GesteDEdition, { geste: 'enregistrement' }> {
  return estObjet(g) && g.geste === 'enregistrement' && typeof g.reussi === 'boolean' && Object.keys(g).length === 2;
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
