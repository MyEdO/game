/**
 * Migration #1463 (#3078) — une possession en texte libre qui nomme une arme ou une munition du
 * catalogue `trappings.json` devient sa référence. LDB 62 l.127, LDB 62 l.131. Une possession écrite en
 * prose VO devient sa forme VF imprimée : sa référence quand le catalogue la porte, sinon son texte VF.
 *
 * GESTES, chacun sur une possession EXACTE d'un hôte nommé :
 * - `element` : l'élément `avant` cède sa place, dans la liste, aux éléments de `apres` — l'arme par
 *   référence (`spec` = la précision imprimée, `qualityChoice` pour « au moins 1 Atout » ou « de
 *   qualité »), ses munitions par référence avec `count`, un choix « A ou B » en `choice` ; une munition
 *   nommée sans son arme devient celle de l'arme qu'elle accompagne, au `count` imprimé, sinon au lot du
 *   catalogue (`packSize`) ; une dotation gardée en texte perd un `count` que le livre n'imprime pas ;
 * - `liste` : la liste entière `avant` devient `apres`, celle du statbloc imprimé.
 *
 * ENTRÉES : écrites — `src/data/careerLevels.json`, `src/data/creatures.json`,
 * `src/scenes/diligence/diligence-projet.json` ; lues, quand un geste est à faire —
 * `src/data/trappings.json`, `src/data/vehicles.json`.
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : un hôte absent, une possession déjà en référence ou
 * révisée après la migration, est laissé tel quel.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; un id qu'un geste à
 * faire écrirait, absent de son catalogue.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final), le projet de campagne `JSON.stringify(doc, null, 1) + '\n'`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { porteLaTranche, remplacerLaFormeDAvant } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const serializeProjet = (value) => `${JSON.stringify(value, null, 1)}\n`;

const CARRIERES = 'src/data/careerLevels.json';
const CREATURES = 'src/data/creatures.json';
const DILIGENCE = 'src/scenes/diligence/diligence-projet.json';

/** Chaque fichier écrit, avec son formatage et l'accès à l'hôte `id`, porteur de `trappings`. */
const FICHIERS = {
  [CARRIERES]: { serialiser: serializeDataset, hote: (doc, id) => doc.find((e) => e?.id === id) },
  [CREATURES]: { serialiser: serializeDataset, hote: (doc, id) => doc.find((e) => e?.id === id) },
  [DILIGENCE]: {
    serialiser: serializeProjet,
    hote: (doc, id) => (doc.narratif?.presetsPnj ?? []).find((p) => p?.id === id)?.profil,
  },
};

/** Le catalogue de chaque clé de référence écrite. */
const CATALOGUES = { id: 'src/data/trappings.json', vehicleId: 'src/data/vehicles.json' };

const EPEE = { id: 'arme-simple' };
const ARBALETE_ET_10_CARREAUX = [{ id: 'arbalete' }, { id: 'carreau', count: { fixed: 10 } }];
const PISTOLET_ET_10_TIRS = [{ id: 'pistolet' }, { id: 'balle-et-poudre', count: { fixed: 10 } }];
const DIX_MUNITIONS = { text: 'Munition', count: { fixed: 10 } };
const DIX_BALLES = [{ id: 'balle-et-poudre', count: { fixed: 10 } }];

const GESTES = [
  // LDB 08 l.755
  { fichier: CARRIERES, hote: 'duelliste-1', avant: { text: 'Arme simple ou Rapière' }, apres: [{ choice: [{ id: 'arme-simple' }, { id: 'rapiere' }] }] },
  // LDB 08 l.771
  { fichier: CARRIERES, hote: 'duelliste-3', avant: { text: 'Fidèle main gauche' }, apres: [{ id: 'main-gauche', spec: 'Fidèle' }] },
  // LDB 08 l.1429
  { fichier: CARRIERES, hote: 'spadassin-3', avant: { text: 'Couteaux de lancer' }, apres: [{ id: 'couteau-de-lancer' }] },
  // LDB 08 l.1901
  { fichier: CARRIERES, hote: 'repurgateur-2', avant: { text: 'Epée plaquée argent' }, apres: [{ id: 'arme-simple', spec: 'plaquée argent' }] },
  // LDB 08 l.2517
  {
    fichier: CARRIERES,
    hote: 'batelier-2',
    liste: true,
    avant: [
      { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] },
      { text: 'Chapeau en cuir' },
      { id: 'veste-de-cuir' },
      { creatureId: 'cheval-de-monte' },
      { id: 'selle-et-harnais' },
      { id: 'corde' },
      { text: 'Epée plaquée argent' },
    ],
    apres: [{ id: 'corde' }, { vehicleId: 'barque-fluviale' }],
  },
  // ADE II 02 l.968
  {
    fichier: CARRIERES,
    hote: 'boucher-ogre-1',
    avant: { text: 'Arme simple (Couperet) ou Arme simple (Maillet)' },
    apres: [{ choice: [{ id: 'arme-simple', spec: 'Couperet' }, { id: 'arme-simple', spec: 'Maillet' }] }],
  },
  // ADE I 07 l.201
  {
    fichier: CARRIERES,
    hote: 'rodeur-fantome-2',
    avant: { text: 'Flèches fabriquées par le Personnage', count: { fixed: 10 } },
    apres: [{ id: 'fleche', spec: 'fabriquées par le Personnage', count: { fixed: 10 } }],
  },
  // ADE I 07 l.209
  { fichier: CARRIERES, hote: 'rodeur-fantome-3', avant: { text: 'Arc elfique avec au moins 1 Atout' }, apres: [{ id: 'arc-elfique', qualityChoice: true }] },
  // ADE I 07 l.217
  {
    fichier: CARRIERES,
    hote: 'rodeur-fantome-4',
    avant: { text: 'Flèche elfique antique (pour proie spéciale)' },
    apres: [{ id: 'fleche-elfique', spec: 'antique (pour proie spéciale)' }],
  },
  // AA 03 l.414
  { fichier: CARRIERES, hote: 'chevalier-panthere-2', avant: { text: 'Epée' }, apres: [EPEE] },
  // AA 02 l.173
  { fichier: CARRIERES, hote: 'archer-2', avant: { text: 'Epée' }, apres: [EPEE] },
  // MDG 09 l.692
  { fichier: CARRIERES, hote: 'pretre-marin-de-manann-2', avant: { text: 'Trident (considéré comme une lance)' }, apres: [{ id: 'lance', spec: 'Trident' }] },
  // VDM 10 l.80
  { fichier: CARRIERES, hote: 'pyromancien-2', avant: { text: 'Épée' }, apres: [EPEE] },
  // AA 02 l.501 ; Up in Arms 03 l.277-278
  { fichier: CARRIERES, hote: 'hallebardier-4', avant: { text: 'Epée de qualité' }, apres: [{ id: 'arme-simple', qualityChoice: true }] },
  // AA 04 l.147
  { fichier: CARRIERES, hote: 'cavalier-leger-4', avant: { text: 'Flamboyant Clothing' }, apres: [{ id: 'vetements', spec: 'flamboyants' }] },
  // AA 03 l.205
  { fichier: CARRIERES, hote: 'chevalier-errant-2', avant: { text: 'Personal Heraldry' }, apres: [{ text: 'Blason personnel' }] },
  // AA 03 l.213
  { fichier: CARRIERES, hote: 'chevalier-errant-3', avant: { text: 'Small Retinue of Followers' }, apres: [{ text: 'Petit contingent de suivants' }] },
  // AA 03 l.414 ; LDB 63 l.55
  { fichier: CARRIERES, hote: 'chevalier-panthere-2', avant: { text: 'Grand heaume with Bestiol Crest' }, apres: [{ id: 'heaume', spec: 'avec blason bestial' }] },
  // AA 02 l.163
  { fichier: CARRIERES, hote: 'archer-1', avant: { text: 'Pack' }, apres: [{ text: 'Paquetage' }] },
  { fichier: CARRIERES, hote: 'archer-1', avant: { text: 'Quiver' }, apres: [{ text: 'Carquois' }] },
  // AA 02 l.173
  { fichier: CARRIERES, hote: 'archer-2', avant: { text: 'Headgear' }, apres: [{ text: 'Couvre-chef' }] },
  // AA 02 l.251
  { fichier: CARRIERES, hote: 'arquebusier-2', avant: { text: 'Large Feathered Hat' }, apres: [{ id: 'chapeau', spec: 'grand, à plumes' }] },
  // AA 02 l.553
  { fichier: CARRIERES, hote: 'joueur-d-epee-2', avant: { text: 'Large Feathered Hat' }, apres: [{ id: 'chapeau', spec: 'grand, à plumes' }] },
  // AA 02 l.561
  {
    fichier: CARRIERES,
    hote: 'joueur-d-epee-3',
    avant: { text: 'Manual on the art of Zweihänder fighting' },
    apres: [{ text: "Manuel sur l'art de combattre à la zweihänder" }],
  },
  // AA 04 l.194
  { fichier: CARRIERES, hote: 'piquier-1', avant: { text: 'Uniform in Unit Colours' }, apres: [{ id: 'uniforme', spec: "aux couleurs de l'unité" }] },
  // AA 04 l.222
  { fichier: CARRIERES, hote: 'piquier-4', avant: { text: 'Banner-Bearer' }, apres: [{ text: 'Porte-étendard' }] },
  { fichier: CARRIERES, hote: 'piquier-4', avant: { text: 'Unit Banner' }, apres: [{ text: "Étendard de l'unité" }] },
  // AA 04 l.275
  { fichier: CARRIERES, hote: 'specialiste-de-siege-1', avant: { text: 'Pavise' }, apres: [{ id: 'pavois' }] },
  // AA 04 l.289
  { fichier: CARRIERES, hote: 'specialiste-de-siege-3', avant: { text: 'Books of Ballistics Tables' }, apres: [{ text: 'Livres de tableaux balistiques' }] },
  { fichier: CARRIERES, hote: 'specialiste-de-siege-3', avant: { text: 'Set of Six 60-second Fuses' }, apres: [{ text: 'Lot de six mèches durant 1 minute' }] },
  // AA 04 l.299
  {
    fichier: CARRIERES,
    hote: 'specialiste-de-siege-4',
    avant: { text: 'Pavilion Tent with Body Servant' },
    apres: [{ id: 'tente', spec: 'pavillon' }, { text: "Page porteur d'armes" }],
  },
  // AA 02 l.623
  { fichier: CARRIERES, hote: 'suiveur-de-camp-1', avant: { text: 'Bed Roll' }, apres: [{ id: 'sac-de-couchage' }] },
  { fichier: CARRIERES, hote: 'suiveur-de-camp-1', avant: { text: 'Pack' }, apres: [{ text: 'Paquetage' }] },
  // AA 02 l.643
  { fichier: CARRIERES, hote: 'suiveur-de-camp-4', avant: { text: 'Ring of Camp Followers' }, apres: [{ text: 'Cercle de suiveurs de camp' }] },
  // AA 02 l.411
  { fichier: CARRIERES, hote: 'cartographe-2', avant: { text: 'Theodolite' }, apres: [{ text: 'Théodolite' }] },
  // AA 02 l.427
  { fichier: CARRIERES, hote: 'cartographe-4', avant: { text: 'Quality Theodolite' }, apres: [{ text: 'Théodolite' }] },
  { fichier: CARRIERES, hote: 'cartographe-4', avant: { text: 'Study' }, apres: [{ text: 'Étude' }] },
  // AA 02 l.317
  { fichier: CARRIERES, hote: 'artilleur-1', avant: { text: 'Leather Apron' }, apres: [{ text: 'Tablier de cuir' }] },
  // AA 02 l.339
  { fichier: CARRIERES, hote: 'artilleur-4', avant: { text: 'Artillery piece' }, apres: [{ text: "Pièce d'artillerie" }] },
  { fichier: CARRIERES, hote: 'artilleur-4', avant: { text: 'Limber' }, apres: [{ text: 'Affût' }] },
  // MDG 09 l.682 ; LDB 62 l.127
  { fichier: CARRIERES, hote: 'pretre-marin-de-manann-1', avant: { text: 'Coutelas' }, apres: [{ id: 'arme-simple', spec: 'Coutelas' }] },
  // LDB 08 l.926 ; LDB 08 l.2448
  { fichier: CARRIERES, hote: 'intendant-3', avant: { text: 'Bâton cérémoniel de fonction' }, apres: [{ id: 'baton-de-combat', spec: 'cérémoniel de fonction' }] },
  // VDM 09 l.78 ; LDB 08 l.2448
  { fichier: CARRIERES, hote: 'spirite-1', avant: { text: 'Bâton de bois pétrifié' }, apres: [{ id: 'baton-de-combat', spec: 'bois pétrifié' }] },
  // LDB 08 l.1085 ; LDB 62 l.131
  { fichier: CARRIERES, hote: 'cavalier-2', avant: DIX_MUNITIONS, apres: DIX_BALLES },
  // LDB 08 l.1852 ; LDB 62 l.131
  { fichier: CARRIERES, hote: 'patrouilleur-routier-3', avant: DIX_MUNITIONS, apres: DIX_BALLES },
  // LDB 08 l.1860 ; LDB 62 l.131
  { fichier: CARRIERES, hote: 'patrouilleur-routier-4', avant: DIX_MUNITIONS, apres: DIX_BALLES },
  // LDB 08 l.2922 ; LDB 62 l.131
  { fichier: CARRIERES, hote: 'patrouilleur-fluvial-2', avant: DIX_MUNITIONS, apres: DIX_BALLES },
  // MDG 11 l.141-143 ; LDB 62 l.131
  { fichier: CARRIERES, hote: 'pretre-de-stromfels-4', avant: { text: 'Munitions', count: { fixed: 10 } }, apres: DIX_BALLES },
  // LDB 08 l.1600 ; LDB 62 l.131
  {
    fichier: CARRIERES,
    hote: 'cocher-2',
    avant: DIX_MUNITIONS,
    apres: [{ id: 'petites-munitions-et-poudre', count: { fixed: 10 } }],
  },
  // LDB 08 l.763 ; LDB 62 l.121, l.131
  {
    fichier: CARRIERES,
    hote: 'duelliste-2',
    liste: true,
    avant: [{ choice: [{ id: 'main-gauche' }, { id: 'brise-epee' }] }, { id: 'pistolet' }, { text: 'Poudre' }, { text: 'Munitions' }],
    apres: [{ choice: [{ id: 'main-gauche' }, { id: 'brise-epee' }] }, { id: 'pistolet' }, { id: 'balle-et-poudre', count: { fixed: 12 } }],
  },
  // AA 04 l.275 ; LDB 62 l.113
  { fichier: CARRIERES, hote: 'specialiste-de-siege-1', avant: { text: 'Munitions' }, apres: [{ id: 'carreau', count: { fixed: 12 } }] },
  // AA 04 l.289 ; LDB 62 l.121
  { fichier: CARRIERES, hote: 'specialiste-de-siege-3', avant: { text: 'Munitions' }, apres: [{ id: 'balle-et-poudre', count: { fixed: 12 } }] },
  // ADE I 07 l.156
  { fichier: CARRIERES, hote: 'patrouilleur-des-karak-2', avant: { text: 'Munitions', count: { fixed: 10 } }, apres: [{ text: 'Munitions' }] },
  // LDB 08 l.922
  {
    fichier: CARRIERES,
    hote: 'intendant-2',
    avant: { text: 'Arme simple ou Arc avec Flèche', count: { fixed: 10 } },
    apres: [{ text: 'Arme simple ou arc avec 10 flèches' }],
  },
  // LDB 08 l.1205
  {
    fichier: CARRIERES,
    hote: 'garde-3',
    avant: { text: 'Arme à deux mains ou hallebarde' },
    apres: [{ choice: [{ text: 'Arme à deux mains' }, { id: 'hallebarde' }] }],
  },
  // LDB 08 l.1256
  {
    fichier: CARRIERES,
    hote: 'gladiateur-2',
    avant: { text: 'Fléau ou Arme à deux mains' },
    apres: [{ choice: [{ id: 'fleau' }, { text: 'Arme à deux mains' }] }],
  },
  // ADE II 02 l.888
  {
    fichier: CARRIERES,
    hote: 'mangeur-d-hommes-2',
    avant: { text: 'Arme à deux mains ou Pistolet ogre' },
    apres: [{ choice: [{ text: 'Arme à deux mains' }, { id: 'pistolet-ogre' }] }],
  },

  // ZI 04 l.48
  {
    fichier: CREATURES,
    hote: 'l-abominable-halagrundsor',
    avant: { text: 'grosse chope lourdement renforcée (arme simple)' },
    apres: [{ id: 'arme-simple', spec: 'grosse chope lourdement renforcée' }],
  },
  // ZI 07 l.127
  {
    fichier: CREATURES,
    hote: 'cultiste-de-la-lune-imprevisible',
    avant: { text: "arc long avec des flèches à l'aspect sinistre" },
    apres: [{ id: 'arc-long' }, { id: 'fleche', spec: "à l'aspect sinistre" }],
  },
  // ADE II 01 l.245
  {
    fichier: CREATURES,
    hote: 'ugrik-legaree',
    liste: true,
    avant: [
      { id: 'massue-ogre', count: { fixed: 2 } },
      { text: "L'une des massues est faite d'une tête de boulet de canon (« Retour à l'envoyeur »)" },
      { id: 'pansiere-ogre' },
      { id: 'arc' },
      { id: 'fleche' },
      { text: '2d10 sous de cuivre' },
    ],
    apres: [
      { id: 'arme-simple', spec: 'massue à tête de boulet de canon' },
      { id: 'pansiere-ogre' },
      { id: 'arme-simple', spec: 'massue' },
      { id: 'arc' },
      { id: 'fleche', count: { fixed: 12 } },
      { text: '2d10 sous de cuivre' },
    ],
  },
  // MDG 16 l.407
  {
    fichier: CREATURES,
    hote: 'long-drong-silver',
    avant: { text: 'bandoulière avec 12 pistolets chargés' },
    apres: [{ text: 'bandoulière' }, { id: 'pistolet', spec: 'chargés', count: { fixed: 12 } }],
  },
  { fichier: CREATURES, hote: 'long-drong-silver', avant: { text: 'épée' }, apres: [EPEE] },
  { fichier: CREATURES, hote: 'long-drong-silver', avant: { text: 'poudre et munitions pour 24 tirs' }, apres: [{ id: 'balle-et-poudre', count: { fixed: 24 } }] },
  // MDG 16 l.499
  { fichier: CREATURES, hote: 'vrisk-gratte-le-fer', avant: { text: 'épée' }, apres: [EPEE] },
  // MDG 07 l.219
  { fichier: CREATURES, hote: 'olg-blodsalt', avant: { text: 'bouclier rouillé' }, apres: [{ id: 'bouclier', spec: 'rouillé' }] },
  { fichier: CREATURES, hote: 'olg-blodsalt', avant: { text: 'dague rouillée' }, apres: [{ id: 'dague', spec: 'rouillée' }] },

  // EDO 01 l.376
  {
    fichier: DILIGENCE,
    hote: 'edo-gustav-fondleburger',
    avant: { text: 'tromblon (habituellement sous le comptoir)' },
    apres: [{ id: 'tromblon', spec: 'habituellement sous le comptoir' }],
  },
  // EDO 02 l.264
  { fichier: DILIGENCE, hote: 'edo-knud-cratinx', avant: { text: 'épée' }, apres: [EPEE] },
  // EDO 02 l.284
  { fichier: DILIGENCE, hote: 'edo-magnus-pflaster', avant: { text: 'épée' }, apres: [EPEE] },
  { fichier: DILIGENCE, hote: 'edo-magnus-pflaster', avant: { text: 'pistolet (avec munitions pour 10 tirs)' }, apres: PISTOLET_ET_10_TIRS },
  // EDO 02 l.303
  { fichier: DILIGENCE, hote: 'edo-patrouilleurs-de-pflaster', avant: { text: 'arbalète (avec 10 carreaux)' }, apres: ARBALETE_ET_10_CARREAUX },
  { fichier: DILIGENCE, hote: 'edo-patrouilleurs-de-pflaster', avant: { text: 'épée' }, apres: [EPEE] },
  // EDOC 10 l.54 ; EDO 07 l.377
  { fichier: DILIGENCE, hote: 'edo-johann-hindersson', avant: { text: 'arbalète avec 10 carreaux' }, apres: ARBALETE_ET_10_CARREAUX },
  { fichier: DILIGENCE, hote: 'edo-johann-hindersson', avant: { text: 'gourdin' }, apres: [{ id: 'arme-simple', spec: 'gourdin' }] },
  // EDOC 10 l.95
  { fichier: DILIGENCE, hote: 'edo-aleanora-basfond', avant: { text: 'arbalète avec 10 carreaux' }, apres: ARBALETE_ET_10_CARREAUX },
  // EDOC 10 l.110
  { fichier: DILIGENCE, hote: 'edo-charlotte-samantha-maiers', avant: { text: 'épée' }, apres: [EPEE] },
  { fichier: DILIGENCE, hote: 'edo-charlotte-samantha-maiers', avant: { text: 'pistolet avec 10 balles' }, apres: PISTOLET_ET_10_TIRS },
  // EDOC 10 l.132
  { fichier: DILIGENCE, hote: 'edo-heinrich-steele', avant: { text: 'arbalète avec 10 carreaux' }, apres: ARBALETE_ET_10_CARREAUX },
  { fichier: DILIGENCE, hote: 'edo-heinrich-steele', avant: { text: 'épée' }, apres: [EPEE] },
  { fichier: DILIGENCE, hote: 'edo-heinrich-steele', avant: { text: 'pistolet avec 10 balles' }, apres: PISTOLET_ET_10_TIRS },
];

const fautes = [];
const docs = new Map();
for (const [rel, { serialiser }] of Object.entries(FICHIERS)) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serialiser(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte, serialiser });
}

/** Chaque référence écrite par un geste fait, branches `choice` comprises. */
const ecrites = [];
const releve = (refs) => {
  for (const r of refs) {
    if (Array.isArray(r.choice)) releve(r.choice);
    else ecrites.push(r);
  }
};
let gestes = 0;
for (const { fichier, hote, liste, avant, apres } of GESTES) {
  const porteur = FICHIERS[fichier].hote(docs.get(fichier).doc, hote);
  let fait = 0;
  if (!liste) fait = remplacerLaFormeDAvant(porteur?.trappings, avant, apres);
  else if (porteLaTranche(porteur, { trappings: avant })) {
    porteur.trappings = structuredClone(apres);
    fait = 1;
  }
  if (fait) releve(apres);
  gestes += fait;
}

for (const [cle, rel] of Object.entries(CATALOGUES)) {
  const attendus = new Set(ecrites.map((r) => r[cle]).filter((id) => id !== undefined));
  if (!attendus.size) continue;
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')).map((e) => e?.id));
  for (const id of attendus) if (!ids.has(id)) fautes.push(`${rel} : \`${id}\` absent du catalogue`);
}

if (fautes.length) {
  process.stderr.write(`ARRÊT — rien n'est écrit :\n${fautes.map((f) => `  ${f}`).join('\n')}\n`);
  process.exit(1);
}

for (const [rel, { doc, avant, serialiser }] of docs) {
  const apres = serialiser(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
process.stdout.write(gestes ? `${gestes} possession(s) réécrite(s).\n` : 'rien à faire.\n');
