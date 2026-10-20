import { nommerChamps } from '../grammaire/meta';
/**
 * Schémas zod de la CARTE DU MONDE d'un projet (`src/noyau/worldMap.ts`) — lieux, routes, services.
 *
 * ORDRE DU SEAM : le schéma voit `places[].port` AVANT `resolvePortRef` (`parseProject`), donc
 * sous ses DEUX formes documentées (`worldMap.ts:181-183`) — la forme SPARSE par référence
 * (`{ ref, lighthouse }`, le catalogue `naval-ports.json` fournissant les défauts) et la forme
 * CONCRÈTE à plat (`PortProfile` complet). Un port sans `ref` porte donc son profil en entier.
 */
import { z } from 'zod';
import { proseNommee } from '../grammaire/prose';
import { effectSchema, waterExposureModeSchema } from './effets';
import { conditionSchema } from '../grammaire/mecanique';
import { enumNomme, sourceRefSchema } from '../grammaire/valeurs';
import { refuserSansProvenance } from '../grammaire/document';
import { idDe } from '../grammaire/ref';
import { listeCle, marquerCollection, marqueDeRecord } from '../grammaire/collection-cle';
import { couvreSchema } from './communs';
import { findVehicleById } from '../../index';
import type { Condition } from '../../../engine/flowCore';

/** `TravelMode` (`engine/travel.ts`) — `'pied'`/`'monture'` ou id de `vehicles.json`. */
export const travelModeSchema = z.string();
export const refusRouteSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'worldMap.routes[].refus.texte');
/** `WindDirection` (`engine/seaWeather.ts`) — cap dominant d'une route maritime (`MDG 13 l.262-270`). */
export const windDirectionSchema = enumNomme({ nord: 'Nord', sud: 'Sud', est: 'Est', ouest: 'Ouest' });

/** `PortProfile` (`engine/seaVoyage.ts:217`) en forme AUTHORÉE : SPARSE quand `ref` désigne une
 *  entrée de `naval-ports.json` (les champs présents sont des SURCHARGES locales), COMPLET sinon.
 *  `lighthouse` (hors catalogue) : un phare veille sur l'approche (`MDG 13 l.333-351`). */
export const portProfileSchema = nommerChamps(z
  .strictObject({
    ref: idDe('navalPort').optional(),
    /** Indice de Taille du Lieu. Le MDG n'imprime AUCUNE échelle : c'est celle de `MSRC 13 l.44-50`
     *  (1 Hameau … 4 Grande ville) que son Index des ports emploie — mesuré 2026-09-01, 39/39 ports de
     *  `naval-ports.json` dans 1..4, et `MDG 15 l.249` nomme « hameau ou petit village (Taille 1 ou 2) ». */
    taille: z.number().int().min(1).max(4).optional(),
    /** Indice de Richesse du Lieu, `MSRC 13 l.52-60` (1 à 5). Même mesure : 39/39 ports dans 1..5.
     *  Le domaine est FERMÉ aux deux bouts — c'est lui qui entre dans le tableau du Prix d'offre
     *  (`MDG 15 l.378-383`), dont la première bande commence à 1. */
    richesse: z.number().int().min(1).max(5).optional(),
    /** Colonne Production : ids de cargaison, `'commerce'`/`'minimum-vital'` compris. */
    production: z.array(z.string()).optional(),
    /** Colonne Surplus : id de cargaison → indice. */
    surplus: z.record(z.string(), z.number()).optional(),
    demande: z.record(z.string(), z.number()).optional(),
    /** Grand port cosmopolite (`MDG 15 l.343-349`). */
    cosmopolite: z.boolean().optional(),
    lighthouse: z.boolean().optional(),
  })
  .superRefine((port, ctx) => {
    if (port.ref !== undefined) return;
    for (const champ of ['taille', 'richesse', 'production'] as const) {
      if (port[champ] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [champ],
          message: `port sans « ref » : le profil est authoré EN ENTIER, « ${champ} » manque (forme concrète, worldMap.ts:181-183).`,
        });
      }
    }
  }), { ref: { label: "référence" , texte: { regime: "technique"} }, taille: { label: "taille" }, richesse: { label: "richesse" }, production: { label: "production" , texte: { regime: "technique"} }, surplus: { label: "surplus" , texte: { regime: "technique"} }, demande: { label: "demande" , texte: { regime: "technique"} }, cosmopolite: { label: "cosmopolite" }, lighthouse: { label: "phare" } });

/** `LandMarketProfile` (`engine/landCargo.ts:62`) — indices de commerce terrestre/fluvial (`MSRC 13`). */
export const landMarketProfileSchema = nommerChamps(z.strictObject({
  /** Indice de Taille de la communauté (1 Hameau … 4 Grande ville, `MSRC 13 l.44-50`). */
  taille: z.number().int().min(1).max(4),
  /** Indice de Richesse, `MSRC 13 l.52-60` : la colonne n'imprime QUE 1 à 5 — « Misérable » y porte
   *  « - », donc aucun indice, et n'est pas authorable. Domaine FERMÉ : c'est la colonne d'entrée du
   *  tableau de la Mise à prix (`MSRC 13 l.150-156`), qui donne une ligne par indice de 1 à 5. */
  richesse: z.number().int().min(1).max(5),
  /** Colonne Produits : ids d'entrées de `land-cargo.json` (marchandises ET marqueurs). */
  produits: z.array(z.string()),
  demande: z.array(z.string()).optional(),
  /** Le Lieu tire sa Richesse du COMMERCE (`MSRC 13 l.40-42`) — d100 de quantité inversé. */
  commerceRichesse: z.boolean().optional(),
  /** Régions à Vin/Eau-de-vie supérieurs (`MSRC 13 l.95`). */
  wineBonusEchelons: z.number().optional(),
  hostLine: z.string().optional(),
  backdrop: z.string().optional(),
}), { taille: { label: "taille" }, richesse: { label: "richesse" }, produits: { label: "produits" , texte: { regime: "technique"} }, demande: { label: "demande" , texte: { regime: "technique"} }, commerceRichesse: { label: "richesse commerciale" }, wineBonusEchelons: { label: "bonus du vin" }, hostLine: { label: "ligne d’accueil" , texte: { regime: "narration",horsContrat: { motif: "sans-saisie-campagne",preuve: "src/ui/editor/WorldMapPlacePanel.tsx:WorldMapPlacePanel"}} }, backdrop: { label: "fond" , texte: { regime: "technique"} } });

/** `PlaceService` — service extensible d'un lieu (`kind` = id de `lieux-services.json`), hors
 *  port/marché qui portent leur schéma riche. `rest` = offre de couchage PROPRE au lieu. */
export const placeServiceSchema = nommerChamps(z.strictObject({
  kind: z.string(),
  label: z.string().optional(),
  rest: nommerChamps(z
    .strictObject({
      auberge: z.boolean().optional(),
      maison: z.boolean().optional(),
      camp: z.boolean().optional(),
      bord: z.boolean().optional(),
  }), { auberge: { label: "auberge" }, maison: { label: "chez soi" }, camp: { label: "camp" }, bord: { label: "bord" } })
    .optional(),
}), { kind: { label: "type" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, rest: { label: "repos" } });

/** `PlacePoi` (#345) — marqueur de PLAN, cible EXCLUSIVE `sceneId` OU `serviceKind`. */
export const placePoiSchema = nommerChamps(z
  .strictObject({
    id: z.string(),
    label: z.string(),
    /** Coordonnées PLAN-LOCALES 0-100, indépendantes de `MapPlace.pos`. */
    pos: nommerChamps(z.strictObject({ x: z.number(), y: z.number() }), { x: { label: "abscisse" }, y: { label: "ordonnée" } }),
    icon: z.string().optional(),
    sceneId: z.string().optional(),
    serviceKind: z.string().optional(),
  })
  .superRefine((poi, ctx) => {
    if ((poi.sceneId === undefined) === (poi.serviceKind === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'cible EXCLUSIVE — « sceneId » (transition) OU « serviceKind » (service résolu du lieu), jamais les deux ni aucun.',
      });
    }
  }), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, pos: { label: "position" }, icon: { label: "icône" , texte: { regime: "technique"} }, sceneId: { label: "scène" , texte: { regime: "technique"} }, serviceKind: { label: "type de service" , texte: { regime: "technique"} } });

/**
 * Kinds de `Condition` réellement ÉVALUABLES avec le contexte de la CARTE (`condCtx`,
 * `src/noyau/bourseFlow.ts` : `flags`, `etats`, `gameTime`, `party`, `money`). Les autres kinds lisent
 * `target`/`caster`/`sl`/`location`/état de combat — absents ici, et `evalCondition`
 * (`src/engine/flowCore.ts`) les rend alors FAUX : un lieu disparaîtrait de la carte, ou un trajet
 * se fermerait, EN SILENCE et sans qu'aucune donnée ne soit fautive. Le sous-ensemble se vérifie
 * kind par kind dans `evalCondition` ; tout kind non listé est REFUSÉ à l'authoring (fail-fast).
 * Exporté : les panneaux de carte du studio en DÉRIVENT l'offre de leur `ConditionEditor`
 * (prop `kinds`), au lieu d'une seconde liste recopiée dans l'UI.
 */
export const CONDITION_KINDS_CARTE: ReadonlySet<Condition['kind']> = new Set<Condition['kind']>([
  'always', 'flag', 'etat', 'time', 'hasItem', 'money', 'partyDead',
  'skill', 'career', 'species', 'status',
  'all', 'any', 'not',
]);

/** Kinds hors portée rencontrés dans une `Condition` authored (récursif : `all`/`any`/`not`). */
function kindsHorsCarte(cond: unknown, out: Set<string> = new Set()): Set<string> {
  if (!cond || typeof cond !== 'object') return out;
  const c = cond as { kind?: unknown; of?: unknown };
  // La Condition arrive ICI encore NON VALIDÉE (`unknown`) : son `kind` est une chaîne quelconque.
  if (typeof c.kind === 'string' && !(CONDITION_KINDS_CARTE as ReadonlySet<string>).has(c.kind)) out.add(c.kind);
  if (Array.isArray(c.of)) for (const sub of c.of) kindsHorsCarte(sub, out);
  else if (c.of) kindsHorsCarte(c.of, out);
  return out;
}

/** `Condition` d'un `when` évalué au contexte HORS COMBAT (`condCtx`) — l'algèbre complète,
 *  restreinte aux kinds évaluables là : le `when` d'un lieu/trajet de carte, et celui de la CLÔTURE
 *  d'un chapitre (#717), qui passe par le MÊME `condCtx`. */
export const conditionCondCtxSchema = conditionSchema.superRefine((cond, ctx) => {
  const hors = [...kindsHorsCarte(cond)];
  if (hors.length) {
    ctx.addIssue({
      code: 'custom',
      message:
        `Condition : « ${hors.join(' », « ')} » n'est pas évaluable au contexte hors combat ` +
        `(drapeaux, états de campagne, horloge, groupe, bourse — « condCtx », src/noyau/bourseFlow.ts) : la Condition serait ` +
        `FAUSSE en silence. Kinds admis : ${[...CONDITION_KINDS_CARTE].join(', ')}.`,
    });
  }
});

/** `MapPlace` — lieu posé sur la carte ; être dans `scene` = être à ce lieu. */
export const mapPlaceSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Position sur la carte en % du canvas (0-100). */
  pos: nommerChamps(z.strictObject({ x: z.number(), y: z.number() }), { x: { label: "abscisse" }, y: { label: "ordonnée" } }),
  /** Scène liée (id du registre de scènes du projet). */
  scene: z.string(),
  entry: z.string().optional(),
  /** Icône du médaillon (id du registre `src/ui/icons`), défaut `nav/entry-point`. */
  icon: z.string().optional(),
  port: portProfileSchema.optional(),
  market: landMarketProfileSchema.optional(),
  services: z.array(placeServiceSchema).optional(),
  poi: listeCle(placePoiSchema, 'id').optional(),
  /** Bande d'ambiance du hub (id du registre `src/ui/backdrops`). */
  backdrop: z.string().optional(),
  /** EXISTENCE du lieu sur la carte (algèbre `Condition`, cf. `evalCondition`) — axe NŒUD du gating
   *  narratif : la destination n'apparaît qu'une fois révélée. Absente = toujours visible. */
  when: conditionCondCtxSchema.optional(),
  couvre: couvreSchema.optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, pos: { label: "position" }, scene: { label: "scène" , texte: { regime: "technique"} }, entry: { label: "entrée" , texte: { regime: "technique"} }, icon: { label: "icône" , texte: { regime: "technique"} }, port: { label: "port" }, market: { label: "marché" }, services: { label: "services" }, poi: { label: "points d’intérêt" }, backdrop: { label: "fond" , texte: { regime: "technique"} }, when: { label: "condition" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} } });

/** `RoutePeril` — péripétie d'AUTEUR tirée chaque jour de voyage à `chancePct` %. */
export const routePerilSchema = nommerChamps(z.strictObject({
  label: z.string(),
  chancePct: z.number(),
  effects: z.array(effectSchema),
}), { label: { label: "libellé" , texte: { regime: "designation"} }, chancePct: { label: "probabilité" }, effects: { label: "effets" } });

/** Prix d'un passage par classe du véhicule (`vehicles.json` `travel.classes[].id`), en sous par passager. */
const prixParClasseSchema = marquerCollection(z.record(z.string(), z.number().int().min(0)), marqueDeRecord());

/** `PalierDeBillet` (`engine/travel.ts`) — prix d'un billet marchandé, à partir de `drMin` de DR net gagné. */
export const palierDeBilletSchema = nommerChamps(z.strictObject({
  drMin: z.number().int().min(0),
  prix: prixParClasseSchema,
}), { drMin: { label: "DR net minimal" }, prix: { label: "prix par classe" , texte: { regime: "technique"} } });

/** `RouteBillet` (`noyau/worldMap.ts`) — billet d'auteur d'un passage payant (`EDO 01 l.142`). La
 *  contiguïté de `suite` se valide à la carte (`worldMapSchema`), les classes et `depuis` à la route. */
export const routeBilletSchema = nommerChamps(z.strictObject({
  prix: prixParClasseSchema,
  suite: z.array(z.string()).optional(),
  depuis: z.string().optional(),
  marchandage: nommerChamps(z.strictObject({
    presetId: z.string(),
    paliers: z.array(palierDeBilletSchema).optional(),
  }), { presetId: { label: "vendeur (preset PNJ)" , texte: { regime: "technique"} }, paliers: { label: "paliers" } }).optional(),
  source: sourceRefSchema.optional(),
  maison: z.string().min(1).optional(),
})
  .superRefine((billet, ctx) => refuserSansProvenance(billet, ctx, 'du billet')), { prix: { label: "prix par classe" , texte: { regime: "technique"} }, suite: { label: "routes suivantes couvertes" , texte: { regime: "technique"} }, depuis: { label: "lieu de départ" , texte: { regime: "technique"} }, marchandage: { label: "marchandage" }, source: { label: "source" }, maison: { label: "maison" , texte: { regime: "technique"} } });

/** Fautes d'un billet contre SA route : véhicule à classes de passage offert sur la route, classes connues,
 *  `depuis` exigé sur une route à double sens et désignant une de ses extrémités. */
function fautesDuBillet(route: { a: string; b: string; from?: string; modes: string[] }, mode: string, billet: z.infer<typeof routeBilletSchema>): string[] {
  const travel = findVehicleById(mode)?.travel;
  if (!travel) return [`« ${mode} » n'est pas un véhicule à passage payant (\`vehicles.json\` sans \`travel\`).`];
  const fautes: string[] = [];
  if (!route.modes.includes(mode)) fautes.push(`le billet « ${mode} » est posé sur une route qui n'offre pas ce mode.`);
  const classes = new Set(travel.classes.map((c) => c.id));
  const posees = [billet.prix, ...(billet.marchandage?.paliers ?? []).map((p) => p.prix)].flatMap((p) => Object.keys(p));
  for (const c of new Set(posees)) if (!classes.has(c)) fautes.push(`classe « ${c} » inconnue du véhicule « ${mode} » (classes : ${[...classes].join(', ')}).`);
  if (route.from == null && billet.depuis == null) fautes.push('route à double sens : « depuis » doit dire de quel lieu part le billet.');
  if (billet.depuis != null && billet.depuis !== route.a && billet.depuis !== route.b) fautes.push(`« depuis » (« ${billet.depuis} ») n'est pas une extrémité de la route.`);
  if (billet.depuis != null && route.from != null && billet.depuis !== route.from) fautes.push(`« depuis » (« ${billet.depuis} ») contredit le sens unique de la route (« ${route.from} »).`);
  return fautes;
}

/** Provenance d'une VALEUR d'auteur de route : `source` ou `maison`, jamais ni l'un ni l'autre. */
export const provenanceDeValeurSchema = nommerChamps(z.strictObject({
  source: sourceRefSchema.optional(),
  maison: z.string().min(1).optional(),
})
  .superRefine((p, ctx) => refuserSansProvenance(p, ctx, 'de la valeur')), { source: { label: "source" }, maison: { label: "maison" , texte: { regime: "technique"} } });

/** Valeurs de route dont la provenance se dit : posées, `perilDie` et `speed` l'exigent. */
const PROVENANCE_EXIGEE = { perilDie: 'du dé de péril', speed: 'de la vitesse' } as const;

/** `MapRoute` — route entre deux lieux, bidirectionnelle sauf `from` (sens unique d'initiation). */
export const mapRouteSchema = nommerChamps(z.strictObject({
  id: z.string(),
  a: z.string(),
  b: z.string(),
  from: z.string().optional(),
  /** Distance en kilomètres (`LDB 51 l.178`) — en MILLES sur une route `sea`. */
  km: z.number(),
  modes: z.array(travelModeSchema),
  /** Billet d'auteur par véhicule (`EDO 01 l.142`), posé sur la première route du trajet couvert. */
  billets: marquerCollection(z.record(z.string(), routeBilletSchema), marqueDeRecord()).optional(),
  /** Déplacement d'auteur par mode (`LDB 51 l.178`). À pied : force la vitesse. */
  speed: z.record(z.string(), z.number()).optional(),
  /** Seuil du d10 quotidien de péripétie (`LDB 51 l.208`) ; 0 = désactivé. */
  perilDie: z.number().optional(),
  perils: z.array(routePerilSchema).optional(),
  /** Cible du « Attaqués ! » ; `at` = ancrage DÉTERMINISTE en mer (fraction 0-1, défaut 0.5, #212). */
  ambush: nommerChamps(z
    .strictObject({ scene: z.string(), entry: z.string().optional(), encounter: z.string(), at: z.number().optional() }), { scene: { label: "scène" , texte: { regime: "technique"} }, entry: { label: "entrée" , texte: { regime: "technique"} }, encounter: { label: "rencontre" , texte: { regime: "technique"} }, at: { label: "position" } })
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
  /** PRATICABILITÉ du trajet (algèbre `Condition`, cf. `evalCondition`) — axe ARÊTE du gating
   *  narratif, indépendant de `mapPlaceSchema.when`. Absente = toujours praticable. */
  when: conditionCondCtxSchema.optional(),
  /** Raison JOUEUR de l'indisponibilité, rendue par `GatedAction` en infobulle — EXIGÉE dès que
   *  `when` est posé (superRefine ci-dessous) : un trajet fermé MUET est un cul-de-sac inexplicable. */
  refus: refusRouteSchema.optional(),
  /** Exposition HYDRIQUE de la descente (`MSRC 16 l.5-13`) — déclenche l'Effet `waterExposure`. */
  riverExposure: nommerChamps(z
    .strictObject({
      source: z.string().optional(),
      mode: waterExposureModeSchema,
      chancePct: z.number(),
    }), { source: { label: "source" , texte: { regime: "technique"} }, mode: { label: "mode"  }, chancePct: { label: "probabilité" } })
    .optional(),
  couvre: couvreSchema.optional(),
  /** Provenance de chaque valeur d'auteur (`refuserSansProvenance`). */
  provenances: nommerChamps(z.strictObject({
    perilDie: provenanceDeValeurSchema.optional(),
    speed: provenanceDeValeurSchema.optional(),
    km: provenanceDeValeurSchema.optional(),
  }), { perilDie: { label: "dé de péril" }, speed: { label: "vitesse" }, km: { label: "kilomètres" } }).optional(),
})
  .superRefine((route, ctx) => {
    const posees = { perilDie: route.perilDie !== undefined, speed: Object.values(route.speed ?? {}).some((v) => v !== undefined) };
    for (const cle of Object.keys(PROVENANCE_EXIGEE) as (keyof typeof PROVENANCE_EXIGEE)[]) {
      if (posees[cle] && !route.provenances?.[cle]) {
        ctx.addIssue({ code: 'custom', path: ['provenances', cle], message: `provenance manquante : cite le livre et la page, ou dis la raison maison ${PROVENANCE_EXIGEE[cle]}.` });
      }
    }
    if (route.when !== undefined && !route.refus?.texte.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: "« when » posé sans « refus » — un trajet fermable doit dire au JOUEUR pourquoi il l'est (infobulle « GatedAction »).",
      });
    }
    for (const [mode, billet] of Object.entries(route.billets ?? {}))
      for (const message of fautesDuBillet(route, mode, billet)) ctx.addIssue({ code: 'custom', path: ['billets', mode], message });
  }), { id: { label: "identifiant" , texte: { regime: "technique"} }, a: { label: "extrémité de départ" , texte: { regime: "technique"} }, b: { label: "extrémité d’arrivée" , texte: { regime: "technique"} }, from: { label: "provenance" , texte: { regime: "technique"} }, km: { label: "kilomètres" }, modes: { label: "modes" , texte: { regime: "technique"} }, billets: { label: "billets" , texte: { regime: "technique"} }, speed: { label: "vitesse" , texte: { regime: "technique"} }, perilDie: { label: "dé de péril" }, perils: { label: "périls" }, ambush: { label: "embuscade" }, inns: { label: "auberges" }, sea: { label: "mer" }, seaHeading: { label: "cap en mer"  }, river: { label: "fleuve" }, riverPerils: { label: "périls fluviaux" }, when: { label: "condition" }, refus: { label: "refus" }, riverExposure: { label: "exposition fluviale" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} }, provenances: { label: "provenances" } });

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
 *  de sa `suite` — chaque route existe, porte le mode, part du lieu où arrive la précédente (dans son
 *  sens unique s'il y en a un), et n'est couverte qu'une fois. */
function parcoursDuBillet(
  routes: readonly { id: string; a: string; b: string; from?: string; modes: string[] }[],
  premiere: { id: string; a: string; b: string; from?: string },
  mode: string,
  billet: { suite?: string[]; depuis?: string },
): { fautes: string[]; troncons: string[] } {
  const depart = premiere.from ?? billet.depuis;
  const fautes: string[] = [];
  if (depart == null) return { fautes, troncons: [] };
  const troncons = [`${premiere.id}>${depart}`];
  const vues = new Set([premiere.id]);
  let ici = depart === premiere.a ? premiere.b : premiere.a;
  for (const id of billet.suite ?? []) {
    const r = routes.find((x) => x.id === id);
    if (!r) { fautes.push(`route « ${id} » inconnue de la carte.`); break; }
    if (vues.has(id)) fautes.push(`route « ${id} » couverte deux fois par le même billet.`);
    vues.add(id);
    if (!r.modes.includes(mode)) fautes.push(`route « ${id} » n'offre pas le mode « ${mode} ».`);
    if ((r.a !== ici && r.b !== ici) || (r.from != null && r.from !== ici)) {
      fautes.push(`route « ${id} » ne part pas de « ${ici} », où arrive la route précédente : la suite n'est pas contiguë.`);
      break;
    }
    troncons.push(`${id}>${ici}`);
    ici = r.a === ici ? r.b : r.a;
  }
  return { fautes, troncons };
}

/** `WorldMap` — graphe de LIEUX et de ROUTES au niveau PROJET. Un POI est unique dans son lieu
 *  (`listeCle`) ET sur la carte : le `superRefine` en pied refuse l'id qu'un AUTRE lieu porte déjà. */
export const worldMapSchema = nommerChamps(z
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
  }), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, params: { label: "paramètres" }, background: { label: "arrière-plan" , texte: { regime: "technique"} }, places: { label: "lieux" }, routes: { label: "routes" } });
