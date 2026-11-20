import { nommerChamps } from '../grammaire/meta';
/**
 * Schémas zod de la CARTE DU MONDE d'un projet (`src/noyau/worldMap.ts`) — lieux, routes, services.
 *
 * ORDRE DU SEAM : le schéma voit `places[].port` AVANT `resolvePortRef` (`parseProject`), donc
 * sous ses DEUX formes — la forme SPARSE par référence
 * (`{ ref, …surcharges }`, le catalogue `naval-ports.json` fournissant les défauts) et la forme
 * CONCRÈTE à plat (`PortProfile` complet), que documente `MapPlace.port`. Un port sans `ref` porte donc son
 * profil en entier.
 */
import { z } from 'zod';
import { proseNommee } from '../grammaire/prose';
import { champsDAcces, META_DE_L_ACCES, refuserLAccesMuet } from '../grammaire/acces';
import { effectSchema, waterExposureModeSchema } from './effets';
import { conditionCondCtxSchema } from '../grammaire/campagne';
import { enumNomme, idDIconeSchema, pointDuPlanSchema, qualiteDeReposSchema } from '../grammaire/valeurs';
import { offresDAubergeSchema } from '../grammaire/hebergement';
import { LIEUX_DE_LA_CARTE, ROUTES_DE_LA_CARTE, routeBilletSchema, provenancesDeRouteSchema, travelModeSchema } from '../grammaire/route';
import { idDe, recordDIds, ref, refs, type PorteeLocale } from '../grammaire/ref';
import { refuserLesIndividus } from '../grammaire/reference';
import { listeCle, marquerCollection, marqueDeRecord, ouvrirPortees } from '../grammaire/collection-cle';
import { listeSansCle } from '../grammaire/liste-sans-cle';
import { couvreSchema, PORTEES_DE_LA_SCENE, SCENES_DU_PROJET } from './communs';
import { findVehicleById } from '../../index';
import { signalDuPortSchema } from '../defs/naval-ports';

/** `WindDirection` (`engine/seaWeather.ts`) — cap dominant d'une route maritime (`MDG 13 l.262-270`). */
export const windDirectionSchema = enumNomme({ nord: 'Nord', sud: 'Sud', est: 'Est', ouest: 'Ouest' });

/** Libellé de chaque indice de Taille d'un lieu. MSRC 13 l.44-50 */
export const LIBELLES_DE_TAILLE: Readonly<Record<number, string>> = { 1: 'Hameau', 2: 'Village', 3: 'Ville', 4: 'Grande ville' };

/** Indice de Taille d'un lieu (`LIBELLES_DE_TAILLE`), MSRC 13 l.44-50 : un nœud pour ses deux porteurs, le port
 *  (`portProfileSchema`) et le lieu sans port (`mapPlaceSchema`). Le MDG n'imprime AUCUNE échelle : son Index des ports
 *  emploie celle-ci — mesuré 2026-09-01, 39/39 ports de `naval-ports.json` dans 1..4 ; `MDG 15 l.249`. */
export const tailleDuLieuSchema = z.number().int().min(1).max(4);

/** `PortProfile` (`engine/seaVoyage.ts`) en forme AUTHORÉE : SPARSE quand `ref` désigne une
 *  entrée de `naval-ports.json` (les champs présents sont des SURCHARGES locales), COMPLET sinon. */
export const portProfileSchema = nommerChamps(z
  .strictObject({
    ref: idDe('navalPort').optional(),
    taille: tailleDuLieuSchema.optional(),
    /** Indice de Richesse du Lieu, `MSRC 13 l.52-60` (1 à 5). Même mesure : 39/39 ports dans 1..5.
     *  Le domaine est FERMÉ aux deux bouts — c'est lui qui entre dans le tableau du Prix d'offre
     *  (`MDG 15 l.378-383`), dont la première bande commence à 1. */
    richesse: z.number().int().min(1).max(5).optional(),
    /** Colonne Production : ids de cargaison, `'commerce-mer'`/`'minimum-vital'` compris. */
    production: refs('cargo', { sousListe: 'mer' }).optional(),
    /** Colonne Surplus : id de cargaison → indice. */
    surplus: recordDIds('cargo', z.number(), 'mer').optional(),
    demande: recordDIds('cargo', z.number(), 'mer').optional(),
    /** Grand port cosmopolite (`MDG 15 l.343-349`). */
    cosmopolite: z.boolean().optional(),
    signal: signalDuPortSchema.optional(),
  })
  .superRefine((port, ctx) => {
    if (port.ref !== undefined) return;
    for (const champ of ['taille', 'richesse', 'production'] as const) {
      if (port[champ] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [champ],
          message: `port sans « ref » : le profil est authoré EN ENTIER, « ${champ} » manque.`,
        });
      }
    }
  }), { ref: { label: "référence" , texte: { regime: "technique"} }, taille: { label: "taille" }, richesse: { label: "richesse" }, production: { label: "production" , texte: { regime: "technique"} }, surplus: { label: "surplus" , texte: { regime: "technique"} }, demande: { label: "demande" , texte: { regime: "technique"} }, cosmopolite: { label: "cosmopolite" }, signal: { label: "signal du port" } });

/** `LandMarketProfile` (`engine/landCargo.ts`) sans sa Taille, que porte le lieu (`tailleDuLieu`) — indices de commerce
 *  terrestre/fluvial (`MSRC 13`). */
export const landMarketProfileSchema = nommerChamps(z.strictObject({
  /** Indice de Richesse, `MSRC 13 l.52-60` : la colonne n'imprime QUE 1 à 5 — « Misérable » y porte
   *  « - », donc aucun indice, et n'est pas authorable. Domaine FERMÉ : c'est la colonne d'entrée du
   *  tableau de la Mise à prix (`MSRC 13 l.150-156`), qui donne une ligne par indice de 1 à 5. */
  richesse: z.number().int().min(1).max(5),
  /** Colonne Produits : ids d'entrées de la voie `terre` de `cargoes.json` (marchandises ET marqueurs). */
  produits: refs('cargo', { sousListe: 'terre' }),
  demande: refs('cargo', { sousListe: 'terre' }).optional(),
  /** Le Lieu tire sa Richesse du COMMERCE (`MSRC 13 l.40-42`) — d100 de quantité inversé. */
  commerceRichesse: z.boolean().optional(),
  /** Régions à Vin/Eau-de-vie supérieurs (`MSRC 13 l.95`). */
  wineBonusEchelons: z.number().optional(),
  hostLine: z.string().optional(),
  backdrop: ref('fond').optional(),
}), { richesse: { label: "richesse" }, produits: { label: "produits" , texte: { regime: "technique"} }, demande: { label: "demande" , texte: { regime: "technique"} }, commerceRichesse: { label: "richesse commerciale" }, wineBonusEchelons: { label: "bonus du vin" }, hostLine: { label: "ligne d’accueil" , texte: { regime: "narration",horsContrat: { motif: "sans-saisie-campagne",preuve: "src/ui/editor/WorldMapPlacePanel.tsx:WorldMapPlacePanel"}} }, backdrop: { label: "fond" } });

/** Les établissements d'un lieu (`MapPlace.services`), que désigne hors du catalogue le point d'intérêt de son plan
 *  (`PlacePoi.service`) ; le lieu l'ouvre (`mapPlaceSchema`). #4277 */
export const SERVICES_DU_LIEU = { collection: 'services', catalogue: 'établissements du lieu' } as const satisfies PorteeLocale;

/** `PlaceService` — établissement d'un lieu (`id` stable, unique dans le lieu ; `kind` = id de `lieux-services.json`),
 *  hors port/marché qui portent leur schéma riche. `rest` = qualité et offres d'auberge d'un établissement
 *  d'hébergement ; `offres` absent : les offres du livre ; `when`/`refus` : son accès réservé (`champsDAcces`). #4277 */
export const placeServiceSchema = nommerChamps(z.strictObject({
  id: z.string(),
  kind: ref('serviceDeLieu'),
  label: z.string().optional(),
  rest: nommerChamps(z
    .strictObject({
      quality: qualiteDeReposSchema.optional(),
      offres: offresDAubergeSchema.optional(),
  }), { quality: { label: "qualité" }, offres: { label: "offres" } })
    .optional(),
  ...champsDAcces,
}).superRefine((service, ctx) => refuserLAccesMuet(service, ctx, 'un établissement')), { id: { label: "identifiant" , texte: { regime: "technique"} }, kind: { label: "type" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, rest: { label: "repos" }, ...META_DE_L_ACCES });

const libelleDuPoiSchema = z.string();

/** `PlacePoi` (#345) — marqueur de PLAN, cible EXCLUSIVE `sceneId`, nommée par son `label`, OU `service` (un service
 *  RÉSOLU du lieu : établissement déclaré, ou port/marché automatique du catalogue), nommé par ce service. #4277 */
export const placePoiSchema = nommerChamps(z
  .strictObject({
    id: z.string(),
    label: libelleDuPoiSchema.optional(),
    /** Coordonnées PLAN-LOCALES, indépendantes de `MapPlace.pos`. */
    pos: pointDuPlanSchema,
    icon: idDIconeSchema.optional(),
    sceneId: ref(SCENES_DU_PROJET).optional(),
    service: ref(idDe('serviceDeLieu', undefined, { portee: SERVICES_DU_LIEU, nue: true })).optional(),
  })
  .superRefine((poi, ctx) => {
    if ((poi.sceneId === undefined) === (poi.service === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'cible EXCLUSIVE — « sceneId » (transition) OU « service » (service résolu du lieu), jamais les deux ni aucun.',
      });
    }
    if (poi.sceneId !== undefined && !libelleDuPoiSchema.safeParse(poi.label).success) {
      ctx.addIssue({ code: 'custom', path: ['label'], message: 'un point d’intérêt qui mène à une scène porte son « label ».' });
    }
    if (poi.service !== undefined && 'label' in poi) {
      ctx.addIssue({ code: 'custom', path: ['label'], message: 'un point d’intérêt qui vise un service ne porte aucun « label » : il prend le nom du service.' });
    }
  }), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, pos: { label: "position" }, icon: { label: "icône" , texte: { regime: "technique"} }, sceneId: { label: "scène" , texte: { regime: "technique"} }, service: { label: "service" , texte: { regime: "technique"} } });

/** `MapPlace` — lieu posé sur la carte ; être dans `scene` = être à ce lieu. Sa Taille a UN porteur (`tailleDuLieu`) :
 *  son port, sinon `taille` ; un marché exige l'un des deux. MSRC 13 l.44-50 */
export const mapPlaceSchema = ouvrirPortees(proseNommee(nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Position sur la carte du monde. */
  pos: pointDuPlanSchema,
  scene: ref(SCENES_DU_PROJET),
  entry: z.string().optional(),
  /** Icône du médaillon (id du registre `src/data/icons`), défaut `navigation/point-d-entree`. */
  icon: idDIconeSchema.optional(),
  /** Taille d'un lieu SANS port ; absente : le lieu n'est pas une agglomération. */
  taille: tailleDuLieuSchema.optional(),
  port: portProfileSchema.optional(),
  market: landMarketProfileSchema.optional(),
  services: listeCle(placeServiceSchema, 'id').optional(),
  poi: listeCle(placePoiSchema, 'id').optional(),
  /** Bande d'ambiance du hub. */
  backdrop: ref('fond').optional(),
  /** EXISTENCE du lieu sur la carte (algèbre `Condition`, cf. `evalCondition`) — axe NŒUD du gating
   *  narratif : la destination n'apparaît qu'une fois révélée. Absente = toujours visible. */
  when: conditionCondCtxSchema.optional(),
  couvre: couvreSchema.optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, pos: { label: "position" }, scene: { label: "scène" , texte: { regime: "technique"} }, entry: { label: "entrée" , texte: { regime: "technique"} }, icon: { label: "icône" , texte: { regime: "technique"} }, taille: { label: "taille" }, port: { label: "port" }, market: { label: "marché" }, services: { label: "services" }, poi: { label: "points d’intérêt" }, backdrop: { label: "fond" }, when: { label: "condition" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} } }), 'worldMap.places[].prose').superRefine((lieu, ctx) => {
  if (lieu.taille !== undefined && lieu.port !== undefined)
    ctx.addIssue({ code: 'custom', path: ['taille'], message: 'un lieu à port tient sa taille de son port : « taille » ne s’y pose pas.' });
  if (lieu.market !== undefined && lieu.taille === undefined && lieu.port === undefined)
    ctx.addIssue({ code: 'custom', path: ['market'], message: 'un marché exige la taille du lieu : posez « taille », ou un port.' });
}), [SERVICES_DU_LIEU]);

/** `RoutePeril` — péripétie d'AUTEUR tirée chaque jour de voyage à `chancePct` %. Hors de toute scène, elle en ouvre
 *  les portées VIDES (`ouvrirPortees`, source `'vide'`) : aucune référence locale de la scène n'y résout. */
export const routePerilSchema = nommerChamps(ouvrirPortees(z.strictObject({
  label: z.string(),
  chancePct: z.number(),
  effects: listeSansCle(z.array(effectSchema)),
}).superRefine((peril, ctx) => refuserLesIndividus(peril.effects, ctx, 'une péripétie de route')), PORTEES_DE_LA_SCENE, 'vide'), { label: { label: "libellé" , texte: { regime: "designation"} }, chancePct: { label: "probabilité" }, effects: { label: "effets" } });

/** Une référence à un lieu de la carte (`ref(LIEUX_DE_LA_CARTE)`). */
type RefDeLieu = { id: string };

/** Fautes d'un billet contre SA route : véhicule à classes de passage offert sur la route, classes connues,
 *  `depuis` exigé sur une route à double sens et désignant une de ses extrémités. */
function fautesDuBillet(route: { a: RefDeLieu; b: RefDeLieu; from?: RefDeLieu; modes: string[] }, mode: string, billet: z.infer<typeof routeBilletSchema>): string[] {
  const travel = findVehicleById(mode)?.travel;
  if (!travel) return [`« ${mode} » n'est pas un véhicule à passage payant (\`vehicles.json\` sans \`travel\`).`];
  const fautes: string[] = [];
  if (!route.modes.includes(mode)) fautes.push(`le billet « ${mode} » est posé sur une route qui n'offre pas ce mode.`);
  const classes = new Set(travel.classes.map((c) => c.id));
  const posees = [billet.prix, ...(billet.marchandage?.paliers ?? []).map((p) => p.prix)].flatMap((p) => Object.keys(p));
  for (const c of new Set(posees)) if (!classes.has(c)) fautes.push(`classe « ${c} » inconnue du véhicule « ${mode} » (classes : ${[...classes].join(', ')}).`);
  if (route.from == null && billet.depuis == null) fautes.push('route à double sens : « depuis » doit dire de quel lieu part le billet.');
  const depuis = billet.depuis?.id;
  if (depuis != null && depuis !== route.a.id && depuis !== route.b.id) fautes.push(`« depuis » (« ${depuis} ») n'est pas une extrémité de la route.`);
  if (depuis != null && route.from != null && depuis !== route.from.id) fautes.push(`« depuis » (« ${depuis} ») contredit le sens unique de la route (« ${route.from.id} »).`);
  return fautes;
}

/** Valeurs de route dont la provenance se dit : posées, `perilDie` et `speed` l'exigent. */
const PROVENANCE_EXIGEE = { perilDie: 'du dé de péril', speed: 'de la vitesse' } as const;

/** `MapRoute` — route entre deux lieux, bidirectionnelle sauf `from` (sens unique d'initiation). */
export const mapRouteSchema = nommerChamps(z.strictObject({
  id: z.string(),
  a: ref(LIEUX_DE_LA_CARTE),
  b: ref(LIEUX_DE_LA_CARTE),
  from: ref(LIEUX_DE_LA_CARTE).optional(),
  /** Distance en kilomètres (`LDB 51 l.178`) — en MILLES sur une route `sea`. */
  km: z.number(),
  modes: z.array(travelModeSchema),
  /** Billet d'auteur par véhicule (`EDO 01 l.142`), posé sur la première route du trajet couvert. */
  billets: marquerCollection(recordDIds('vehicle', routeBilletSchema), marqueDeRecord()).optional(),
  /** Déplacement d'auteur par mode (`LDB 51 l.178`). À pied : force la vitesse. */
  speed: z.partialRecord(travelModeSchema, z.number(), { error: (iss) => (iss as { issues?: readonly { message: string }[] }).issues?.[0]?.message }).optional(),
  /** Seuil du d10 quotidien de péripétie (`LDB 51 l.208`) ; 0 = désactivé. */
  perilDie: z.number().optional(),
  perils: z.array(routePerilSchema).optional(),
  /** Cible du « Attaqués ! » ; `at` = ancrage DÉTERMINISTE en mer (fraction 0-1, défaut 0.5, #212). */
  ambush: nommerChamps(z
    .strictObject({ scene: ref(SCENES_DU_PROJET), entry: z.string().optional(), encounter: z.string(), at: z.number().optional() }), { scene: { label: "scène" , texte: { regime: "technique"} }, entry: { label: "entrée" , texte: { regime: "technique"} }, encounter: { label: "rencontre" , texte: { regime: "technique"} }, at: { label: "position" } })
    .optional(),
  /** Relais d'auberges en bord de route : la halte de NUIT propose l'auberge. */
  inns: z.boolean().optional(),
  /** Route MARITIME (`MDG 13-15`) : se voyage sur le navire de campagne, `km` en MILLES. */
  sea: z.boolean().optional(),
  seaHeading: windDirectionSchema.optional(),
  /** Route FLUVIALE JOUÉE (`MSRC 7`) : la descente se joue jour par jour en mode `barge`. */
  river: z.boolean().optional(),
  /** Périls de rivière tirés chaque jour (`MSRC 7 l.119-166`, `river-perils.json`). */
  riverPerils: z.array(nommerChamps(z.strictObject({ perilId: z.string(), chancePct: z.number() }), { perilId: { label: "péril" , texte: { regime: "technique"} }, chancePct: { label: "probabilité" } })).optional(),
  /** PRATICABILITÉ du trajet (`champsDAcces`) — axe ARÊTE du gating narratif, indépendant de `mapPlaceSchema.when`. */
  ...champsDAcces,
  /** Exposition HYDRIQUE de la descente (`MSRC 16 l.5-13`) — déclenche l'Effet `waterExposure`. */
  riverExposure: nommerChamps(z
    .strictObject({
      source: z.string().optional(),
      mode: waterExposureModeSchema,
      chancePct: z.number(),
    }), { source: { label: "source" , texte: { regime: "technique"} }, mode: { label: "mode"  }, chancePct: { label: "probabilité" } })
    .optional(),
  couvre: couvreSchema.optional(),
  provenances: provenancesDeRouteSchema.optional(),
})
  .superRefine((route, ctx) => {
    const posees = { perilDie: route.perilDie !== undefined, speed: Object.keys(route.speed ?? {}).length > 0 };
    for (const cle of Object.keys(PROVENANCE_EXIGEE) as (keyof typeof PROVENANCE_EXIGEE)[]) {
      if (posees[cle] && !route.provenances?.[cle]) {
        ctx.addIssue({ code: 'custom', path: ['provenances', cle], message: `provenance manquante : cite le livre et la page, ou dis la raison maison ${PROVENANCE_EXIGEE[cle]}.` });
      }
    }
    refuserLAccesMuet(route, ctx, 'un trajet');
    for (const [mode, billet] of Object.entries(route.billets ?? {}))
      for (const message of fautesDuBillet(route, mode, billet)) ctx.addIssue({ code: 'custom', path: ['billets', mode], message });
  }), { id: { label: "identifiant" , texte: { regime: "technique"} }, a: { label: "extrémité de départ" , texte: { regime: "technique"} }, b: { label: "extrémité d’arrivée" , texte: { regime: "technique"} }, from: { label: "provenance" , texte: { regime: "technique"} }, km: { label: "kilomètres" }, modes: { label: "modes" , texte: { regime: "technique"} }, billets: { label: "billets" , texte: { regime: "technique"} }, speed: { label: "vitesse" , texte: { regime: "technique"} }, perilDie: { label: "dé de péril" }, perils: { label: "périls" }, ambush: { label: "embuscade" }, inns: { label: "auberges" }, sea: { label: "mer" }, seaHeading: { label: "cap en mer"  }, river: { label: "fleuve" }, riverPerils: { label: "périls fluviaux" }, ...META_DE_L_ACCES, riverExposure: { label: "exposition fluviale" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} }, provenances: { label: "provenances" } });

/** `WorldMapParams` — réglages RAW de voyage au niveau CARTE, tous paramétrables. */
export const worldMapParamsSchema = nommerChamps(z.strictObject({
  /** Heures de voyage par jour sans Test (`LDB 51 l.195`, défaut 6). */
  hoursPerDay: z.number().optional(),
  /** Plafond de marche forcée en heures/jour (défaut 10). */
  forcedMaxHours: z.number().optional(),
  /** Seuil d10 de péripétie par défaut des routes (défaut 8, `LDB 51 l.208`). */
  perilDie: z.number().optional(),
}), { hoursPerDay: { label: "heures par jour" }, forcedMaxHours: { label: "durée forcée maximale" }, perilDie: { label: "dé de péril" } });

/** Parcours d'un billet : ses TRONÇONS couverts (`routeId>départ`, première route comprise) et les fautes
 *  de sa `suite` — chaque route porte le mode, part du lieu où arrive la précédente (dans son sens unique
 *  s'il y en a un), et n'est couverte qu'une fois. */
function parcoursDuBillet(
  routes: readonly { id: string; a: RefDeLieu; b: RefDeLieu; from?: RefDeLieu; modes: string[] }[],
  premiere: { id: string; a: RefDeLieu; b: RefDeLieu; from?: RefDeLieu },
  mode: string,
  billet: { suite?: string[]; depuis?: RefDeLieu },
): { fautes: string[]; troncons: string[] } {
  const depart = (premiere.from ?? billet.depuis)?.id;
  const fautes: string[] = [];
  if (depart == null) return { fautes, troncons: [] };
  const troncons = [`${premiere.id}>${depart}`];
  const vues = new Set([premiere.id]);
  let ici = depart === premiere.a.id ? premiere.b.id : premiere.a.id;
  for (const id of billet.suite ?? []) {
    const r = routes.find((x) => x.id === id);
    if (!r) break;
    if (vues.has(id)) fautes.push(`route « ${id} » couverte deux fois par le même billet.`);
    vues.add(id);
    if (!r.modes.includes(mode)) fautes.push(`route « ${id} » n'offre pas le mode « ${mode} ».`);
    if ((r.a.id !== ici && r.b.id !== ici) || (r.from != null && r.from.id !== ici)) {
      fautes.push(`route « ${id} » ne part pas de « ${ici} », où arrive la route précédente : la suite n'est pas contiguë.`);
      break;
    }
    troncons.push(`${id}>${ici}`);
    ici = r.a.id === ici ? r.b.id : r.a.id;
  }
  return { fautes, troncons };
}

/** `WorldMap` — graphe de LIEUX et de ROUTES au niveau PROJET, qui ouvre leurs portées. Un POI est unique
 *  dans son lieu (`listeCle`) ET sur la carte : le `superRefine` en pied refuse l'id qu'un AUTRE lieu porte déjà. */
export const worldMapSchema = nommerChamps(ouvrirPortees(z
  .strictObject({
    id: z.string(),
    label: z.string(),
    params: worldMapParamsSchema.optional(),
    /** Image de fond : présente ⇒ les lieux sont rendus à leurs `pos` EXACTS (aucun déchevauchement). */
    background: z.string().optional(),
    places: listeCle(mapPlaceSchema, 'id'),
    routes: listeCle(mapRouteSchema, 'id'),
  })
  .superRefine((carte, ctx) => {
    // Un tronçon (route, sens) n'est vendu que par UN billet d'un même véhicule.
    const billetDuTroncon = new Map<string, string>();
    carte.routes.forEach((route, i) => {
      for (const [mode, billet] of Object.entries(route.billets ?? {})) {
        const { fautes, troncons } = parcoursDuBillet(carte.routes, route, mode, billet);
        for (const message of fautes) ctx.addIssue({ code: 'custom', path: ['routes', i, 'billets', mode, 'suite'], message });
        for (const troncon of troncons) {
          const cle = `${mode}|${troncon}`;
          const deja = billetDuTroncon.get(cle);
          if (deja == null) billetDuTroncon.set(cle, route.id);
          else if (deja !== route.id) {
            const [id, depuis] = troncon.split('>');
            ctx.addIssue({ code: 'custom', path: ['routes', i, 'billets', mode], message: `route « ${id} » depuis « ${depuis} » couverte en « ${mode} » par deux billets (celui de « ${deja} » et celui de « ${route.id} ») : les billets se chevauchent.` });
          }
        }
      }
    });
    const lieuDuPoi = new Map<string, string>();
    carte.places.forEach((lieu, i) => {
      (lieu.poi ?? []).forEach((poi, j) => {
        const autre = lieuDuPoi.get(poi.id);
        if (autre !== undefined && autre !== lieu.id)
          ctx.addIssue({ code: 'custom', path: ['places', i, 'poi', j], message: `POI « ${poi.id} » déjà posé au lieu « ${autre} » : un id de POI est unique sur la carte.` });
        else lieuDuPoi.set(poi.id, lieu.id);
      });
    });
  }), [LIEUX_DE_LA_CARTE, ROUTES_DE_LA_CARTE]), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, params: { label: "paramètres" }, background: { label: "arrière-plan" , texte: { regime: "technique"} }, places: { label: "lieux" }, routes: { label: "routes" } });
