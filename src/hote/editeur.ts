/**
 * L'ÉDITEUR DE CARTE À L'ÉCRAN D'UN HÔTE (#3508) : ses zones et leurs éléments (`elements.ts`), lus de la session
 * d'édition du noyau (`SessionDEdition`). Les outils, les options de l'outil actif (pinceau, terrains, hauteurs, sorte
 * et structure d'une arête, étage rejoint et plan d'une volée), les couches de la scène, l'historique, l'enregistrement au dépôt, la case pointée et
 * l'arête sélectionnée, et l'inspecteur de cette arête ; chaque geste porte le geste d'édition qu'il joue (`{ edition }`), prêt à envoyer. Ce que le
 * pointeur trace sur la carte en cours de geste, le tracé de la volée et l'arête sélectionnée, vont à la surcouche (`surcoucheDeLEdition`),
 * que l'hôte pose sur le monde.
 */
import {
  DIFFICULTY_LABELS, FACES_D_ARETE, HAUTEURS, PINCEAUX, planDeLaVolee, areteDessinee, heightAt, libelleDeStructure, porteAuteur, sceneEditee, secretAuteur,
  segmentDeLaSelection, structureAppearances, structuresCrenelables, structuresDeLArete, crenellatedAt, terrainIds, terrainLabel, tileAt,
  type AreteDessinee, type BrouillonDArete, type Difficulty, type GesteDEdition, type PatchDArete, type SessionDEdition, type WallPaint,
} from '../noyau/index';
import { pluriel, t } from '../i18n';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { estObjet } from './formes';
import { ligne, type Bouton, type Choix, type Ligne } from './elements';

/** Les zones de l'éditeur, dans l'ordre où chacune montre ses éléments. */
export interface ZonesDeLEditeur {
  'editeur.titre': Ligne[];
  'editeur.outils': Choix[];
  'editeur.options': (Choix | Ligne | Bouton)[];
  'editeur.couches': (Choix | Bouton)[];
  'editeur.historique': Bouton[];
  'editeur.fichier': Bouton[];
  'editeur.pointee': Ligne[];
  'editeur.inspecteur': (Choix | Ligne | Bouton)[];
}

/** Les cases que le geste en cours trace sur la carte, chacune sur sa couche : le rectangle tiré, ou les cases que le
 *  pinceau a couvertes, que le monde ne montre qu'au relâché, puis le tracé de la volée ; et l'arête sélectionnée, sur
 *  la couche éditée. */
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
 *  la structure du parapet, ou la gomme de sa marque ; la sorte et le matériau d'une arête ; la volée. La gomme n'en a
 *  aucune : elle efface la chose de la case. */
function options(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const outil = s.outil;
  if (outil.mode === 'select' || outil.mode === 'erase') return [];
  if (outil.mode === 'stair') return optionsDeLaVolee(s, outil.toZ);
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
function inspecteur(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
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

/** La ligne du parapet crénelé de la case pointée de la session `s`, sa structure ; aucune sans parapet. */
function ligneDuParapet(s: SessionDEdition): Ligne[] {
  const p = s.pointee;
  const parapet = p ? crenellatedAt(sceneEditee(s), p.x, p.y, p.z) : null;
  return parapet === null ? [] : [ligne('crenelage', t('ecran.editeur.pointee.crenelage', { structure: libelleDeStructure(parapet) ?? parapet }))];
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
  const etages = scene.layers.map((l) => l.z).sort((a, b) => a - b);
  const outils = [
    bouton('outil/select', t('ecran.editeur.outil.select'), { geste: 'outil', outil: { mode: 'select' } }, s.outil.mode === 'select'),
    bouton('outil/tile', t('ecran.editeur.outil.tile'), { geste: 'outil', outil: { mode: 'tile', terrain } }, s.outil.mode === 'tile'),
    bouton('outil/height', t('ecran.editeur.outil.height'), { geste: 'outil', outil: { mode: 'height', metres: HAUTEURS[0].metres } }, s.outil.mode === 'height'),
    bouton('outil/wall', t('ecran.editeur.outil.wall'), { geste: 'outil', outil: { mode: 'wall', paint: 'wall' } }, s.outil.mode === 'wall'),
    bouton('outil/stair', t('ecran.editeur.outil.stair'), { geste: 'outil', outil: { mode: 'stair', toZ: etages.find((z) => z > s.z) ?? s.z } }, s.outil.mode === 'stair'),
    bouton('outil/crenellated', t('ecran.editeur.outil.crenellated'), { geste: 'outil', outil: { mode: 'crenellated', structure: structuresCrenelables()[0]?.id ?? null } }, s.outil.mode === 'crenellated'),
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
    'editeur.fichier': [bouton('enregistrer', t('ecran.editeur.enregistrer'), { geste: 'enregistrer' }, false, refusDEnregistrer(s))],
    'editeur.pointee': [
      ...(p ? [ligne('pointee', t('ecran.editeur.pointee', { x: p.x, y: p.y, z: p.z, terrain: terrainLabel(tileAt(scene, p.x, p.y, p.z)), hauteur: heightAt(scene, p.x, p.y, p.z) }))] : []),
      ...ligneDuParapet(s),
      ...ligneDeLArete(s),
    ],
    'editeur.inspecteur': inspecteur(s),
  };
}

/** La surcouche du geste en cours de la session `s`, sur sa couche éditée. */
export function surcoucheDeLEdition(s: SessionDEdition): SurcoucheDeLEdition {
  const g = s.geste;
  const cases = g?.sorte === 'trait' ? g.trace
    : g?.sorte === 'rectangle' ? Array.from({ length: g.rect.w * g.rect.h }, (_, i) => ({ x: g.rect.x + (i % g.rect.w), y: g.rect.y + Math.floor(i / g.rect.w) }))
    : [];
  const seg = segmentDeLaSelection(sceneEditee(s), s.sel);
  return { cases: [...cases, ...s.volee].map((c) => ({ x: c.x, y: c.y, z: s.z })), arete: seg ? areteDessinee(sceneEditee(s), seg) : null };
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
