/**
 * L'ATELIER DU COMPENDIUM JOUÉ (#4020, garde #841) : pour chaque catégorie éditable (`CATEGORY_DATASET_DERIVE`,
 * `OBJECT_CATEGORY_DERIVE`), l'atelier d'une entrée neuve, puis de chaque entrée dont le cas diffère (`casDe`), ouvert
 * et joué comme la méthode `compendium` du pont le joue (`hotes/godot/pont/pont.ts`) : le jeu d'un élément des zones
 * passé en JSON, validé par `boutonDuCompendium` ou `gesteDuCompendium`, puis joué par `compendium` sur la session
 * seule, jamais enregistré ;
 * chaque offre du formulaire à toute profondeur, chaque variante comprise (`jeuDuFormulaire`), l'identité et le dé
 * d'en-tête. Le périmètre de chaque catégorie se tire du schéma de ses entrées (`perimetreDuNoeud`) ; la garde
 * (`garderLaTranche`, `src/compendium-field-editability-guard-<k>.test.ts`) exige que chacun de ses chemins soit
 * crédité par une écriture jouée, aux règles de #841 (`cheminsCreditesJoues`, `scripts/guards/lib/editabiliteDesChamps.mjs`).
 */
import { isDeepStrictEqual } from 'node:util';
import { readdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  boutonDuCompendium,
  gesteDuCompendium,
  zonesDuCompendium,
  type ZonesDuCompendium,
} from './hote/compendium';
import {
  atelierIdentifiable,
  categoryByKey,
  compendium,
  deDeLAtelier,
  estChampDAdresse,
  formulaireDeLAtelier,
  ouvrirLeCompendium,
  type GesteDuCompendium,
  type Segment,
  type SessionDuCompendium,
} from './noyau/index';
import {
  admetLAbsence,
  champsDeclares,
  elementDuNoeud,
  estTransparent,
  exigeParSonPorteur,
  identiteFigee,
  identiteTenue,
  recordDuNoeud,
} from './noyau/codex/editFields';
import { codexLookupById } from './noyau/codex/registry';
import { CLE_D_IDENTITE } from './noyau/codex/session';
import type { Jeu } from './hote/elements';
import {
  champDuChemin,
  CLE_DE_RECORD,
  clesDuRecord,
  formesConcretes,
  idDuChamp,
  idDuDiscriminant,
  jeuDuFormulaire,
  litteralFige,
  pasDeVariante,
  pasDuNoeud,
  RANG,
  rangDu,
  union,
  type BancDuFormulaire,
} from './formulaireJoue.testkit';
import { CATEGORY_DATASET_DERIVE, OBJECT_CATEGORY_DERIVE } from './data/schemas/exposition-derivee';
import { noeudDeLEntree, noeudsDesEntrees } from './data/schemas/validate';
import { coDescendre, defDe, noeudsAuChemin, ouverts } from './data/schemas/grammaire/descente';
import { adressesDe } from './noyau/edition/adresseDeProse';
import { datasetObject, entreesDuDataset, type DatasetKey } from './data/overrides';
import { editableDataset, editableObjectDataset } from './data/atelierDuCodex';
import { allBuiltinCampaigns } from './scenes/campaign';
import { auChemin, estObjet } from './lib/objet.mjs';
import { cheminsCreditesJoues, type EcritureJouee } from '../scripts/guards/lib/editabiliteDesChamps.mjs';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vite.config.ts`
import { CORPUS_DISQUE, manifesteDe, texteDuChapitre } from '../scripts/source/prose-source-plugin.mjs';

/** Les PANNES de la catégorie mesurée : chaque geste que la session lève, au lieu de l'écrire ou de le refuser, dit
 *  par son chemin et son message ; la session reste celle d'avant lui (`jouer`). */
let pannes: string[] = [];

/** La session `s` où le geste `geste` est joué, puis le chapitre qu'elle attend chargé du `Source/` versionné, comme
 *  l'hôte le sert (`GET source/<livre>/<ch>.md`, `texteDuChapitre`) ; `s` elle-même si le geste, ou l'atelier qu'il
 *  laisse (`atelierDe`), lève, sa panne consignée (`pannes`). */
function jouer(s: SessionDuCompendium, geste: GesteDuCompendium): SessionDuCompendium {
  let joue: SessionDuCompendium;
  try { joue = compendium(s, geste); atelierDe(joue); }
  catch (e) {
    pannes.push(`${'chemin' in geste && geste.chemin ? geste.chemin.join('/') : geste.geste} : ${(e as Error).message}`);
    return s;
  }
  const attendu = joue.source.chapitreEnAttente;
  return attendu ? compendium(joue, { geste: 'chapitre', book: attendu.book, ch: attendu.ch, texte: texteDuChapitre(attendu.book, attendu.ch) }) : joue;
}

/** Les zones du Compendium hors de son atelier, que le jeu de ses offres ne lit pas. */
const ZONES_SANS_ATELIER: Omit<ZonesDuCompendium, 'compendium.atelier'> = {
  'compendium.familles': [], 'compendium.categories': [], 'compendium.recherche': [], 'compendium.liste': [], 'compendium.fiche': [], 'compendium.etat': [],
};

/** La zone `compendium.atelier` de chaque session (`zonesDuCompendium`), une session ne changeant pas. */
const ateliersDesSessions = new WeakMap<SessionDuCompendium, ZonesDuCompendium['compendium.atelier']>();
const atelierDe = (s: SessionDuCompendium): ZonesDuCompendium['compendium.atelier'] =>
  ateliersDesSessions.get(s) ?? ateliersDesSessions.set(s, zonesDuCompendium(s)['compendium.atelier']).get(s)!;

/** Le nœud de l'entrée de l'atelier de chaque session (`noeudDeLEntree`), une session ne changeant pas. */
const noeudsDesSessions = new WeakMap<SessionDuCompendium, { n: unknown }>();
const noeudDeLAtelier = (s: SessionDuCompendium): unknown =>
  (noeudsDesSessions.get(s) ?? noeudsDesSessions.set(s, { n: noeudDeLEntree(editableDataset(s.atelier!.categorie) ?? OBJECT_CATEGORY_DERIVE[s.atelier!.categorie].ds, s.atelier!.entree) }).get(s)!).n;

/** Les valeurs scalaires que porte le corpus de chaque catégorie éditable (`CATEGORIES_EDITABLES`), chaque entrée d'un
 *  dataset-liste et la racine d'un dataset-objet, à chaque nœud de son schéma (`noeudDeLEntree`, `coDescendre`), et les
 *  clés de chaque record qu'il porte, au nœud du record (`recordDuNoeud`), sans doublon ; construites à la première
 *  lecture. */
let valeursDuCorpus: WeakMap<object, unknown[]> | undefined;
function indexDuCorpus(): WeakMap<object, unknown[]> {
  const index = new WeakMap<object, unknown[]>();
  const ajouter = (n: unknown, valeur: unknown): void => {
    const valeurs = index.get(n as object) ?? index.set(n as object, []).get(n as object)!;
    if (!valeurs.includes(valeur)) valeurs.push(valeur);
  };
  const indexer = (ds: string, donnee: object): void => coDescendre(noeudDeLEntree(ds, donnee), donnee, ({ noeuds, valeur }) => {
    if (estObjet(valeur)) for (const n of noeuds) if (recordDuNoeud(n)) for (const cle of Object.keys(valeur)) ajouter(n, cle);
    if (valeur === null || typeof valeur === 'object') return;
    for (const n of noeuds) ajouter(n, valeur);
  });
  for (const categorie of CATEGORIES_EDITABLES) {
    const ds = editableDataset(categorie);
    if (ds !== undefined) for (const e of entreesDuDataset(ds)) indexer(ds, e);
    else indexer(editableObjectDataset(categorie)!.ds, datasetObject(editableObjectDataset(categorie)!.ds));
  }
  return index;
}

/** Les EXEMPLAIRES du nœud de schéma `noeud` : les valeurs que le corpus porte à chacune des formes de sa fermeture
 *  (`ouverts`, `indexDuCorpus`). */
const exemplaires = (noeud: unknown): unknown[] => ouverts([noeud]).flatMap((n) => (valeursDuCorpus ??= indexDuCorpus()).get(n as object) ?? []);

/** Le BANC du Compendium (`BancDuFormulaire`) : ses zones réduites à son atelier (`zonesDuCompendium`), un jeu reçu
 *  en JSON validé par `boutonDuCompendium`, sans refus, ou `gesteDuCompendium`, joué par `compendium` (`jouer`) ; le
 *  porteur, l'entrée de l'atelier, nommé par sa catégorie, son propre document, et son schéma, le nœud de l'entrée
 *  (`noeudDeLAtelier`) ; ses exemplaires, ceux du corpus (`exemplaires`), qui le posent au régime fort. */
const BANC: BancDuFormulaire<SessionDuCompendium, ZonesDuCompendium, GesteDuCompendium> = {
  zones: (s) => ({ ...ZONES_SANS_ATELIER, 'compendium.atelier': atelierDe(s) }),
  elements: (z) => z['compendium.atelier'],
  deballe: (jeu) => ('compendium' in jeu ? jeu.compendium : undefined),
  geste: (z, s, recu) => {
    if (!('compendium' in recu)) return gesteDuCompendium(z, s, recu);
    const b = boutonDuCompendium(z, recu.compendium);
    return b && !b.refus ? recu.compendium : undefined;
  },
  jouer,
  porteur: (s) => s.atelier ? { cle: s.atelier.categorie, donnee: s.atelier.entree, chemin: [] } : undefined,
  document: (s) => s.atelier?.entree,
  schema: (s) => (s.atelier ? { noeud: noeudDeLAtelier(s), donnee: s.atelier.entree } : undefined),
  exemplaires,
};
const { jouerLInspecteur, gesteDuJeu, ecrire, composerLAdresse } = jeuDuFormulaire(BANC);

/** La session `s` où joue le jeu `jeu` d'un élément de ses zones, passé en JSON (`gesteDuJeu`) ; lève si ses zones ne
 *  l'offrent pas, ou si la session le refuse. */
function jouerLeJeu(s: SessionDuCompendium, jeu: Jeu): SessionDuCompendium {
  const geste = gesteDuJeu(zonesDuCompendium(s), s, jeu);
  if (!geste) throw new Error(`le jeu ${JSON.stringify(jeu)} n’est pas offert par les zones du Compendium`);
  const suite = jouer(s, geste);
  if (suite.refus !== null) throw new Error(`le Compendium refuse ${JSON.stringify(jeu)} : ${JSON.stringify(suite.refus)}`);
  return suite;
}

/** Le manifeste du `Source/` versionné, servi comme le pont le sert, et les paquets de campagne du jeu. */
const MANIFESTE = manifesteDe(CORPUS_DISQUE);
const PAQUETS = allBuiltinCampaigns.map((c) => ({ fichier: c.fichier, projet: c.paquet }));

/** L'atelier de la catégorie `categorie` : ouvert sur l'entrée `id` d'un dataset-liste, comme le pont s'ouvre sur une
 *  entrée, puis « Modifier » ; d'un dataset-objet, sa famille puis sa catégorie choisies, puis « Modifier » ; sans
 *  `id` d'un dataset-liste, « Nouvelle entrée ». */
function atelier(categorie: string, id?: string): SessionDuCompendium {
  const s = id === undefined
    ? [{ geste: 'famille', famille: categoryByKey(categorie)!.group }, { geste: 'categorie', categorie }].reduce((x, g) => jouerLeJeu(x, { compendium: g as GesteDuCompendium }), ouvrirLeCompendium(MANIFESTE, PAQUETS))
    : ouvrirLeCompendium(MANIFESTE, PAQUETS, { categorie, id });
  const geste: GesteDuCompendium = { geste: id === undefined && CATEGORY_DATASET_DERIVE[categorie] !== undefined ? 'creer' : 'modifier' };
  return jouerLeJeu(s, { compendium: geste });
}

// ─── Le périmètre tiré du schéma ────────────────────────────────────────────────────────────────────────────────────

/** La descente du nœud `noeud` porte-t-elle un champ du périmètre (`perimetreDuNoeud`) : un champ déclaré d'un objet,
 *  une clé posée d'un record (`clesDuRecord`), ou, sous l'une de ses variantes, ses éléments ou la valeur de ses clés
 *  ouvertes, l'un d'eux ? */
function porteDesChamps(noeud: unknown, vus = new Set<unknown>()): boolean {
  if (noeud === undefined || vus.has(noeud)) return false;
  vus.add(noeud);
  const u = union(noeud);
  if (u) return u.variantes.some((v) => porteDesChamps(v.noeud, vus));
  return formesConcretes(noeud).some((f) => {
    if (champsDeclares(f)) return true;
    const record = recordDuNoeud(f);
    if (record) return clesDuRecord(f).length > 0 || porteDesChamps(record.valeur, vus);
    return porteDesChamps(elementDuNoeud(f), vus);
  });
}

/** Le champ de nœud `noeud` est-il un conteneur hors liste qui laisse des champs sous lui : objet ou record en chacune
 *  de ses formes (`ouverts`), dont la descente porte un champ du périmètre (`porteDesChamps`) ? Un conteneur sans champ
 *  sous lui est le seul chemin qui l'écrit : il reste au périmètre. */
const conteneurHorsListe = (noeud: unknown): boolean => {
  const formes = ouverts([noeud]).filter((n) => !estTransparent(n));
  return formes.length > 0 && formes.every((n) => ['object', 'record'].includes(defDe(n)?.type ?? '')) && porteDesChamps(noeud);
};

/** Le champ de nœud `noeud` est-il un CONTENEUR REQUIS hors liste (`conteneurHorsListe`) : présent dans toute donnée
 *  valide, ni absent ni nul (`admetLAbsence`) ? Sa présence n'est pas un choix d'auteur, pas plus que celle d'un
 *  conteneur que chacun de ses porteurs exige (`exigeParSonPorteur`) : il sort du périmètre (`perimetreDuNoeud`), ses
 *  feuilles y restent. */
const conteneurRequis = (noeud: unknown): boolean => admetLAbsence(noeud) === false && conteneurHorsListe(noeud);

/** Le record de nœud `record` est-il TOTAL : chaque clé de son nœud de clé requise, l'objet vide refusé ? */
const recordTotal = (record: unknown): boolean => !(record as { safeParse(v: unknown): { success: boolean } }).safeParse({}).success;

/** Un champ du périmètre : son chemin abstrait, et s'il est un objet, une liste ou un record (`formesConcretes`). */
interface ChampDuPerimetre { chemin: string; conteneur: boolean }

/** Le PÉRIMÈTRE des nœuds `racines`, tiré de leur schéma par une descente en largeur d'abord, chaque forme concrète
 *  (`formesConcretes`) descendue une fois, sous le premier chemin qui l'atteint, le plus court : un schéma récursif
 *  s'arrête sur lui-même. Chaque champ (`idDuChamp`) d'un objet (`champsDeclares`), hors d'un champ requis d'une seule
 *  valeur littérale (`litteralFige`) qui n'est pas champ direct d'une variante d'union, d'un conteneur requis (`conteneurRequis`) et de
 *  l'identité qu'une liste tient figée par le code (`identiteFigee`), et chaque clé posée d'un record (`clesDuRecord`),
 *  hors de celles d'un record total (`recordTotal`) de conteneurs requis, nommé par son chemin abstrait : clés, `#` d'un
 *  rang, `*` d'une clé de record, `<discriminant=clé>`
 *  d'une variante d'union (`unionDuNoeud`). Une variante sans forme (une op de `OPS_NON_TYPEES`, saisie en JSON) ne
 *  déclare aucun champ. Les conteneurs requis qu'il écarte vont à `requis`, ceux qu'exige chaque porteur qui les
 *  traverse (`exigeParSonPorteur`) compris, chacune de leurs occurrences comptée. */
function perimetreDuNoeud(racines: readonly unknown[], requis: Map<string, ChampDuPerimetre>): Map<string, ChampDuPerimetre> {
  const out = new Map<string, ChampDuPerimetre>();
  const vus = new Set<unknown>();
  /** Les conteneurs (`conteneurHorsListe`) qu'une occurrence exige, et ceux qu'une occurrence laisse facultatifs. */
  const [exiges, libres] = [new Set<string>(), new Set<string>()];
  const file: { noeud: unknown; chemin: string[]; ancetres: readonly unknown[]; discriminants: readonly string[]; tenus?: Readonly<Record<string, string>>; figee?: string }[] = racines.map((noeud) => ({ noeud, chemin: [], ancetres: [], discriminants: [] }));
  for (let i = 0; i < file.length; i++) {
    const { noeud, chemin, ancetres, discriminants, tenus = {}, figee } = file[i];
    if (noeud === undefined) continue;
    const u = union(noeud);
    const lignee = [...ancetres, noeud];
    if (!u) {
      for (const forme of formesConcretes(noeud)) {
        for (const [cle, enfant] of champsDeclares(forme) ?? []) {
          if (conteneurHorsListe(enfant)) (exigeParSonPorteur((j) => [[...lignee, enfant][j]], chemin.length + 1) ? exiges : libres).add(tenus[cle] ?? idDuChamp(forme as object, cle));
        }
      }
    }
    if (vus.has(noeud)) continue;
    vus.add(noeud);
    if (u) {
      for (const v of u.variantes) {
        const ici = { noeud: v.noeud, chemin: [...chemin, pasDeVariante(u.discriminant, v.cle)], ancetres: lignee, discriminants: [...discriminants, u.discriminant], figee };
        file.push(u.discriminant ? { ...ici, tenus: { ...tenus, [u.discriminant]: idDuDiscriminant(u, v.cle) } } : { ...ici, tenus });
      }
      continue;
    }
    for (const forme of formesConcretes(noeud)) {
      if (forme !== noeud && vus.has(forme)) continue;
      vus.add(forme);
      const champs = champsDeclares(forme);
      if (champs) {
        for (const [cle, enfant] of champs) {
          const ici = [...chemin, cle];
          const id = tenus[cle] ?? idDuChamp(forme as object, cle);
          const vers = !discriminants.includes(cle) && conteneurRequis(enfant) ? requis : out;
          if (!vers.has(id) && cle !== figee && (discriminants.length > 0 || !litteralFige(enfant))) vers.set(id, { chemin: ici.join('.'), conteneur: formesConcretes(enfant).length > 0 });
          file.push({ noeud: enfant, chemin: ici, ancetres: lignee, discriminants: [] });
        }
        continue;
      }
      const element = elementDuNoeud(forme);
      if (element !== undefined) file.push({ noeud: element, chemin: [...chemin, RANG], ancetres: lignee, discriminants: [], ...(identiteFigee(forme) ? { figee: identiteTenue(forme, undefined)[0] } : {}) });
      const record = recordDuNoeud(forme);
      if (!record) continue;
      const vers = recordTotal(forme) && conteneurRequis(record.valeur) ? requis : out;
      for (const cle of clesDuRecord(forme)) if (!vers.has(idDuChamp(forme as object, cle))) vers.set(idDuChamp(forme as object, cle), { chemin: [...chemin, cle].join('.'), conteneur: formesConcretes(record.valeur).length > 0 });
      file.push({ noeud: record.valeur, chemin: [...chemin, CLE_DE_RECORD], ancetres: lignee, discriminants: [] });
    }
  }
  for (const id of exiges) {
    const champ = out.get(id);
    if (champ && !libres.has(id)) { requis.set(id, champ); out.delete(id); }
  }
  return out;
}

/** Les chemins, de champ en champ déclaré, des records du nœud `noeud` dont le nœud ne pose aucune clé
 *  (`clesDuRecord`) : ceux dont le contexte de l'atelier pose les clés (`FieldDesc.contexte`, `champsDuRecord`). */
const recordsAClesDuContexte = (() => {
  const lus = new WeakMap<object, Segment[][]>();
  return (noeud: unknown): Segment[][] => {
    const deja = lus.get(noeud as object);
    if (deja) return deja;
    const out: Segment[][] = [];
    const vus = new Set<unknown>();
    const file: { n: unknown; chemin: Segment[] }[] = [{ n: noeud, chemin: [] }];
    for (let ici = file.shift(); ici; ici = file.shift()) {
      for (const forme of formesConcretes(ici.n)) {
        if (vus.has(forme)) continue;
        vus.add(forme);
        const champs = champsDeclares(forme);
        if (champs) for (const [cle, enfant] of champs) file.push({ n: enfant, chemin: [...ici.chemin, cle] });
        else if (recordDuNoeud(forme) && !clesDuRecord(forme).length) out.push(ici.chemin);
      }
    }
    lus.set(noeud as object, out);
    return out;
  };
})();

/** La classe d'une offre du contexte qui pose plus d'un choix sous sa clé (`offresDuContexte`). */
const PLUSIEURS = ' plusieurs';

/** Les offres de l'atelier `s` à chaque record de son nœud `noeud` dont le contexte pose les clés
 *  (`recordsAClesDuContexte`) : pour chaque clé offerte, son record et si elle offre plus d'un choix sous elle. */
function offresDuContexte(s: SessionDuCompendium, noeud: unknown): string[] {
  const choix = formulaireDeLAtelier(s)?.champs.find((f) => f.contexte)?.contexte?.choix;
  if (!choix) return [];
  return recordsAClesDuContexte(noeud).flatMap((chemin) =>
    (choix(chemin) ?? []).filter((c) => c.refus === null).map((c) => `offre ${chemin.join('.')}${(choix([...chemin, String(c.valeur)])?.length ?? 0) > 1 ? PLUSIEURS : ' une'}`));
}

/** Le CAS de la donnée `donnee` de nœud `noeud`, ouverte à l'atelier `s` : chaque forme qu'elle porte, à toute
 *  profondeur, la variante courante de chaque union qu'elle traverse (`pasDuNoeud`), identifiée par son union et sa clé
 *  comme au périmètre (`perimetreDuNoeud`), son nœud même, et ce que l'atelier offre sans qu'elle le porte
 *  (`offresDuContexte`) ; puis les champs (`idDuChamp`) qu'elle porte. */
function casDe(noeud: unknown, donnee: unknown, s: () => SessionDuCompendium): { formes: Set<string>; champs: Set<string> } {
  const offres = recordsAClesDuContexte(noeud).length ? offresDuContexte(s(), noeud) : [];
  const formes = new Set([String(rangDu(noeud as object)), ...offres]);
  const champs = new Set<string>();
  const marcher = (n: unknown, v: unknown): void => {
    if (!estObjet(v) && !Array.isArray(v)) return;
    for (const [cle, sous] of Object.entries(v)) {
      const suite = pasDuNoeud(n, v, Array.isArray(v) ? Number(cle) : cle, formes);
      if (!suite) continue;
      if (suite.champ) champs.add(suite.champ);
      marcher(suite.noeud, sous);
    }
  };
  marcher(noeud, donnee);
  return { formes, champs };
}

// ─── Le banc de chaque catégorie ────────────────────────────────────────────────────────────────────────────────────

/** Le champ du dé d'en-tête de la table d'une catégorie (`enTete`), hors de son entrée, et son chemin. */
const DE_D_EN_TETE = 'en-tête#die';

/** Ce que mesure le banc d'une catégorie : son périmètre, chaque champ (`idDuChamp`) avec son chemin abstrait
 *  (`perimetreDuNoeud`), les conteneurs requis qu'il écarte (`conteneurRequis`), les champs que ses écritures jouées créditent, les ids des entrées jouées et les pannes de ses
 *  gestes (`pannes`), sans doublon. */
interface MesureDeLaCategorie { categorie: string; perimetre: Map<string, ChampDuPerimetre>; requis: Map<string, ChampDuPerimetre>; credites: Set<string>; issues: Map<string, Set<Issue>>; jouees: string[]; pannes: string[] }

/** L'issue d'une écriture jouée à son champ : écrite (le document a changé à son chemin), refusée (il n'a pas changé),
 *  ou saisie en JSON, qui ne crédite rien. */
type Issue = 'écrite' | 'refusée' | 'JSON';

/** L'issue de l'écriture `e` (`Issue`). */
const issueDe = (e: EcritureJouee): Issue =>
  e.saisie === 'saisieJson' ? 'JSON' : isDeepStrictEqual(auChemin(e.avant, e.chemin), auChemin(e.apres, e.chemin)) ? 'refusée' : 'écrite';

/** La cause mesurée d'un champ orphelin, des issues `issues` des écritures jouées à son chemin, et du chemin `sousJson`
 *  du champ qui le contient, offert en saisie JSON seule, s'il en est un. */
const causeDe = (champ: ChampDuPerimetre, issues: ReadonlySet<Issue> | undefined, sousJson: string | undefined): string =>
  issues?.has('écrite') ? 'écrite, non créditée (#841)' : issues?.has('refusée') ? 'écriture refusée par l’atelier' : issues?.has('JSON') ? 'offerte en saisie JSON seule'
    : sousJson !== undefined ? `sous ${sousJson}, offert en saisie JSON seule`
      : champ.conteneur ? 'conteneur qu’aucun geste joué ne pose entier' : 'aucune offre jouée ne l’écrit';

/** Les champs du périmètre de la mesure `m` qu'aucune écriture jouée ne crédite : chacun, son chemin abstrait et sa
 *  cause mesurée (`causeDe`), le champ qui le contient, conteneur requis compris, lu au préfixe de son chemin. */
function orphelinsDe(m: MesureDeLaCategorie): string[] {
  const enJson = new Set([...m.perimetre, ...m.requis].filter(([id]) => m.issues.get(id)?.has('JSON')).map(([, champ]) => champ.chemin));
  const sousJson = (chemin: string): string | undefined => {
    const pas = chemin.split('.');
    return pas.map((_, i) => pas.slice(0, i).join('.')).find((prefixe) => enJson.has(prefixe));
  };
  return [...m.perimetre].filter(([id]) => !m.credites.has(id)).map(([id, champ]) => `${champ.chemin} — ${causeDe(champ, m.issues.get(id), sousJson(champ.chemin))}`).sort();
}

/** Une entrée d'un dataset-liste qui peut ouvrir l'atelier : son id, son nœud (`noeudDeLEntree`), son cas (`casDe`) et
 *  la taille de son document, à laquelle coûte son atelier. */
interface EntreeAJouer { id: string; noeud: unknown; formes: Set<string>; champs: Set<string>; taille: number }

/** Les entrées du dataset-liste `ds` que le Compendium liste dans la catégorie `categorie` (`codexLookupById`). */
const entreesDe = (categorie: string, ds: DatasetKey): EntreeAJouer[] =>
  (entreesDuDataset(ds) as Record<string, unknown>[]).filter((x) => codexLookupById(categorie, x.id as string)).map((e) => {
    const noeud = noeudDeLEntree(ds, e);
    const s = () => compendium(ouvrirLeCompendium(MANIFESTE, PAQUETS, { categorie, id: e.id as string }), { geste: 'modifier' });
    return { id: e.id as string, noeud, ...casDe(noeud, e, s), taille: JSON.stringify(e).length };
  });

/** L'entrée de `entrees` au plus grand `gain` par caractère de son document ; `undefined` si aucune n'en a. */
function laPlusRentable(entrees: readonly EntreeAJouer[], gain: (e: EntreeAJouer) => number): EntreeAJouer | undefined {
  let meilleure: { e: EntreeAJouer; g: number } | undefined;
  for (const e of entrees) {
    const g = gain(e);
    if (g > 0 && (!meilleure || g / e.taille > meilleure.g / meilleure.e.taille)) meilleure = { e, g };
  }
  return meilleure?.e;
}

/** Les écritures de l'identité de l'entrée de l'atelier `s`, renommée `<id>-joue` au formulaire `identifier` ; `null`
 *  si le Compendium refuse son renommage (une entrée désignée). */
function identite(s: SessionDuCompendium): EcritureJouee | null {
  const avant = s.atelier!.entree;
  const vers = `${String(avant[CLE_D_IDENTITE])}-joue`;
  const geste = gesteDuJeu(zonesDuCompendium(s), s, { type: 'identifier', args: [vers] });
  const suite = geste && jouer(s, geste);
  if (!suite || suite.refus !== null) return null;
  return { avant, apres: suite.atelier!.entree, chemin: [CLE_D_IDENTITE], valeur: vers, saisie: 'saisieTexte' };
}

/** Les écritures de l'identité d'un élément neuf de chaque liste à clé de l'atelier `s`, d'entrée de nœud `noeud`, dont
 *  le champ d'identité (`champDuChemin`) n'est pas parmi les `identifiees` de la catégorie : « Ajouter » de la liste
 *  joué, puis le formulaire `identifier/<chemin>` de l'élément ajouté, que rien ne désigne, joué vers `<clé>-joue`. */
function identifierLesElements(s: SessionDuCompendium, noeud: unknown, identifiees: Set<string>, out: EcritureJouee[]): void {
  for (const f of zonesDuCompendium(s)['compendium.atelier']) {
    if (f.type !== 'formulaire' || f.verbe !== 'identifier' || f.champs[0]?.type !== 'fixe') continue;
    const liste = (f.champs[0].valeur as Segment[]).slice(0, -1);
    const element = auChemin(s.atelier!.entree, f.champs[0].valeur as Segment[]);
    const [cle] = noeudsAuChemin(noeud, s.atelier!.entree, liste).flatMap((n) => identiteTenue(n, element));
    const champ = champDuChemin(noeud, s.atelier!.entree, [...(f.champs[0].valeur as Segment[]), cle]);
    if (champ === undefined || identifiees.has(champ)) continue;
    const ajout = atelierDe(s).find((e) => e.id === `valeur/${liste.join('/')}/ajouter`);
    const jeu = ajout?.type === 'bouton' ? ajout.jeu : ajout?.type === 'choix' || ajout?.type === 'liste' ? ajout.valeurs[0]?.jeu : undefined;
    if (!jeu) continue;
    const ajoute = jouerLeJeu(s, jeu);
    const chemin = [...liste, (auChemin(ajoute.atelier!.entree, liste) as unknown[]).length - 1];
    const vers = `${cle}-joue`;
    const suite = jouerLeJeu(ajoute, { type: 'identifier', args: [chemin, vers] });
    identifiees.add(champ);
    out.push({ avant: ajoute.atelier!.entree, apres: suite.atelier!.entree, chemin: [...chemin, cle], valeur: vers, saisie: 'saisieTexte' });
  }
}

/** L'écriture du dé d'en-tête de la table de l'atelier `s`, s'il en porte un (`deDeLAtelier`) : son formulaire `enTete`
 *  joué, le dé relu avant et après. */
function enTete(s: SessionDuCompendium): EcritureJouee | null {
  const de = deDeLAtelier(s.atelier!);
  if (de === undefined) return null;
  const vers = { n: de.n, sides: de.sides + 1 };
  const suite = jouerLeJeu(s, { type: 'enTete', args: [vers.n, vers.sides] });
  return { avant: { die: de }, apres: { die: deDeLAtelier(suite.atelier!) }, chemin: ['die'], valeur: vers, saisie: 'saisieNombre' };
}

/** Les écritures de chaque adresse de prose de l'atelier `s`, d'entrée de nœud `noeud`, dont le champ
 *  (`champDuChemin`) n'est pas parmi les `composees` de la catégorie : chaque adresse absente qu'un choix « Ajouter »
 *  de son formulaire pose, posée à sa première valeur (`ecrire`), puis chaque adresse présente (`adressesDe`), composée
 *  (`composerLAdresse`). */
function composerLesAdresses(s: SessionDuCompendium, noeud: unknown, composees: Set<string>, out: EcritureJouee[]): void {
  let x = s;
  for (const e of zonesDuCompendium(s)['compendium.atelier']) {
    if ((e.type !== 'choix' && e.type !== 'liste') || !e.id.endsWith('/ajouter') || !e.valeurs.length) continue;
    const jeu = e.valeurs[0].jeu;
    const chemin = ('args' in jeu ? jeu.args[1] : []) as Segment[];
    if (!noeudsAuChemin(noeud, x.atelier!.entree, chemin).some(estChampDAdresse)) continue;
    const geste = gesteDuJeu(zonesDuCompendium(x), x, jeu);
    if (geste?.geste === 'valeur') x = ecrire(x, geste, 'saisieChoix', out);
  }
  for (const { chemin } of adressesDe(noeud, x.atelier!.entree)) {
    const champ = champDuChemin(noeud, x.atelier!.entree, chemin)!;
    if (composees.has(champ)) continue;
    composees.add(champ);
    composerLAdresse(x, `valeur/${chemin.join('/')}/`, out);
  }
}

/** Les écritures de chaque objet présent de l'atelier `s`, d'entrée de nœud `noeud`, que « Retirer », ou « Aucune » du
 *  choix de sa variante, retire ou vide, et que « Ajouter », ou ce choix, pose de nouveau, hors des éléments de liste,
 *  une fois par champ (`champDuChemin`) parmi les `reposes` de la catégorie : retiré, puis posé par son « Ajouter »,
 *  bouton ou première valeur de son choix, ou la première valeur du choix de sa variante (`ecrire`). Un retrait
 *  que l'atelier `s` refuse se rejoue dans l'atelier `rempli`, celui que l'inspecteur laisse (`jouerLInspecteur`), où
 *  le champ qui le permet est posé (la `maison` d'une `source`, `refuserSansProvenance`). */
function reposerLesObjets(s: SessionDuCompendium, rempli: SessionDuCompendium, noeud: unknown, reposes: Set<string>, out: EcritureJouee[]): void {
  const zones = BANC.zones(s);
  for (const e of zones['compendium.atelier']) {
    const aucune = e.id.endsWith('/aucune');
    if (e.type !== 'bouton' || (!aucune && !e.id.endsWith('/retirer'))) continue;
    const retrait = gesteDuJeu(zones, s, e.jeu);
    if (retrait?.geste !== 'valeur' || typeof retrait.chemin[retrait.chemin.length - 1] !== 'string' || !estObjet(auChemin(s.atelier!.entree, retrait.chemin))) continue;
    const champ = champDuChemin(noeud, s.atelier!.entree, retrait.chemin);
    if (champ === undefined || reposes.has(champ)) continue;
    reposes.add(champ);
    /** L'atelier `x` où le bouton de ce retrait est joué, `undefined` s'il ne l'offre pas ou le refuse. */
    const retirer = (x: SessionDuCompendium): SessionDuCompendium | undefined => {
      const z = BANC.zones(x);
      const bouton = z['compendium.atelier'].find((y) => y.id === e.id);
      const geste = bouton?.type === 'bouton' ? gesteDuJeu(z, x, bouton.jeu) : undefined;
      const suite = geste && jouer(x, geste);
      return suite && suite.refus === null ? suite : undefined;
    };
    const retire = retirer(s) ?? retirer(rempli);
    if (!retire) continue;
    const reposeur = aucune ? e.id.slice(0, -'/aucune'.length) : `valeur/${retrait.chemin.join('/')}/ajouter`;
    const ajout = BANC.zones(retire)['compendium.atelier'].find((x) => x.id === reposeur);
    const jeu = ajout?.type === 'bouton' ? ajout.jeu : ajout?.type === 'choix' || ajout?.type === 'liste' ? ajout.valeurs[0]?.jeu : undefined;
    const pose = jeu && gesteDuJeu(BANC.zones(retire), retire, jeu);
    if (pose?.geste === 'valeur') ecrire(retire, pose, ajout!.type === 'bouton' ? 'bouton' : 'saisieChoix', out);
  }
}

/** Les champs que créditent les écritures `ecritures` d'une entrée de nœud `noeud` (`cheminsCreditesJoues`,
 *  `champDuChemin`). */
const creditesPar = (noeud: unknown, ecritures: EcritureJouee[]): string[] =>
  cheminsCreditesJoues(ecritures).flatMap(({ apres, chemin }) => champDuChemin(noeud, apres, chemin) ?? []);

/** La mesure de la catégorie éditable `categorie` (`MesureDeLaCategorie`) : son périmètre, la réunion de ceux des cas de
 *  ses entrées (`noeudsDesEntrees`, ouverts), et le dé d'en-tête de sa table s'il en porte un ; une partie par
 *  catégorie. D'un dataset-liste, l'atelier d'une entrée neuve d'abord, joué sur le plus petit document ; puis l'atelier de chaque entrée dont le cas porte une offre à plusieurs choix (`PLUSIEURS`)
 *  qu'aucune entrée ouverte ne porte ; puis de chaque entrée dont le cas porte une forme qu'aucune entrée ouverte ne porte, la
 *  plus rentable d'abord (`laPlusRentable`), ensuite de chaque entrée qui porte un champ qu'aucune écriture n'a crédité
 *  ni saisi en JSON, une de plus par champ ; d'un dataset-objet, l'atelier de sa racine.
 *  Chaque atelier joué à toute profondeur (`jouerLInspecteur`), chacun de ses objets retiré puis posé de nouveau
 *  (`reposerLesObjets`), chacune de ses adresses de prose composée (`composerLesAdresses`), l'identité d'un élément
 *  neuf de chacune de ses listes à clé (`identifierLesElements`), puis l'identité d'une
 *  entrée que rien ne désigne (`identite`) si aucune n'est renommée ; et le dé d'en-tête (`enTete`). L'identité d'un
 *  atelier qu'`identifier` refuse (`atelierIdentifiable`) sort du périmètre. */
function mesurerLaCategorie(categorie: string): MesureDeLaCategorie {
  pannes = [];
  const ds = editableDataset(categorie);
  const racine = ds ?? OBJECT_CATEGORY_DERIVE[categorie].ds;
  const cas = ouverts(noeudsDesEntrees(racine)).filter((n) => defDe(n)?.type === 'object');
  const requis = new Map<string, ChampDuPerimetre>();
  const perimetre = perimetreDuNoeud(cas, requis);
  const identifiable = atelierIdentifiable(atelier(categorie).atelier!);
  if (!identifiable) for (const [id, champ] of perimetre) if (champ.chemin === CLE_D_IDENTITE) perimetre.delete(id);
  const credites = new Set<string>();
  let identifiee = !identifiable;
  const [composees, reposes, identifiees] = [new Set<string>(), new Set<string>(), new Set<string>()];
  const out: EcritureJouee[] = [];
  const issues = new Map<string, Set<Issue>>();
  const jouees: string[] = [];
  /** Les champs que créditent les écritures `ecritures` d'une entrée de nœud `noeud` (`creditesPar`), et l'issue de
   *  chacune à son champ (`issueDe`). */
  const consigner = (noeud: unknown, ecritures: EcritureJouee[]): void => {
    for (const p of creditesPar(noeud, ecritures)) credites.add(p);
    for (const e of ecritures) {
      const champ = champDuChemin(noeud, e.apres, e.chemin) ?? champDuChemin(noeud, e.avant, e.chemin);
      if (champ !== undefined) (issues.get(champ) ?? issues.set(champ, new Set()).get(champ)!).add(issueDe(e));
    }
  };
  /** L'atelier `s`, d'entrée de nœud `noeud`, joué. */
  const jouerLAtelier = (s: SessionDuCompendium, noeud: unknown): void => {
    const debut = out.length;
    reposerLesObjets(s, jouerLInspecteur(s, out), noeud, reposes, out);
    composerLesAdresses(s, noeud, composees, out);
    identifierLesElements(s, noeud, identifiees, out);
    const renommee = identifiee ? null : identite(s);
    if (renommee) { out.push(renommee); identifiee = true; }
    consigner(noeud, out.slice(debut));
  };
  if (ds === undefined) jouerLAtelier(atelier(categorie), cas[0]);
  else {
    const neuve = atelier(categorie);
    jouerLAtelier(neuve, noeudDeLEntree(ds, neuve.atelier!.entree));
    let entrees = entreesDe(categorie, ds);
    /** Les formes que portent les entrées ouvertes, et les champs que portent celles ouvertes pour un champ. */
    const [formes, repris] = [new Set<string>(), new Set<string>()];
    /** Chaque entrée de plus grand gain (`laPlusRentable`), ouverte tant qu'il en reste une, ce qu'elle porte (`porte`)
     *  consigné à `consignees`. */
    const ouvrirTantQue = (gain: (e: EntreeAJouer) => number, consignees: Set<string>, porte: (e: EntreeAJouer) => Set<string>): void => {
      for (let e = laPlusRentable(entrees, gain); e; e = laPlusRentable(entrees, gain)) {
        const ouverte = e;
        entrees = entrees.filter((x) => x !== ouverte);
        for (const v of porte(ouverte)) consignees.add(v);
        jouerLAtelier(atelier(categorie, ouverte.id), ouverte.noeud);
        jouees.push(ouverte.id);
      }
    };
    // La déduplication au champ de la partie tait le sous-arbre d'un conteneur déjà posé ailleurs : l'offre la plus riche se joue d'abord.
    ouvrirTantQue((e) => [...e.formes].filter((f) => f.endsWith(PLUSIEURS) && !formes.has(f)).length, formes, (e) => e.formes);
    ouvrirTantQue((e) => [...e.formes].filter((f) => !formes.has(f)).length, formes, (e) => e.formes);
    ouvrirTantQue((e) => [...e.champs].filter((c) => !repris.has(c) && !credites.has(c) && !issues.get(c)?.has('JSON')).length, repris, (e) => e.champs);
  }
  const de = enTete(atelier(categorie, jouees[0]));
  if (de) {
    perimetre.set(DE_D_EN_TETE, { chemin: DE_D_EN_TETE, conteneur: false });
    if (cheminsCreditesJoues([de]).length) credites.add(DE_D_EN_TETE);
  }
  return { categorie, perimetre, requis, credites, issues, jouees, pannes: [...new Set(pannes)] };
}

/** Les catégories éditables du Compendium : ses datasets-listes, puis ses datasets-objets. */
const CATEGORIES_EDITABLES: readonly string[] = [...Object.keys(CATEGORY_DATASET_DERIVE), ...Object.keys(OBJECT_CATEGORY_DERIVE)];

/** Le numéro de tranche du fichier de garde `fichier` (`compendium-field-editability-guard-<k>.test.ts`), `undefined`
 *  pour tout autre fichier. */
const numeroDeTranche = (fichier: string): number | undefined => {
  const [prefixe, suffixe] = ['compendium-field-editability-guard-', '.test.ts'];
  const k = fichier.startsWith(prefixe) && fichier.endsWith(suffixe) ? fichier.slice(prefixe.length, -suffixe.length) : '';
  return /^\d+$/.test(k) ? Number(k) : undefined;
};

/** Les numéros des fichiers de garde du Compendium, un par tranche, tirés de leur dossier, croissants : leur nombre
 *  fait celui des tranches, aucune catégorie n'étant tue quand un fichier part ou s'ajoute. */
const TRANCHES: readonly number[] = readdirSync(dirname(fileURLToPath(import.meta.url))).flatMap((f) => numeroDeTranche(f) ?? []).sort((a, b) => a - b);

/** La garde #841 du porteur COMPENDIUM du fichier de garde d'URL `url` : une catégorie éditable sur autant que de
 *  fichiers de garde (`TRANCHES`), à partir de celle du rang du fichier parmi eux. Chaque catégorie mesurée
 *  (`mesurerLaCategorie`) n'a aucun orphelin (`orphelinsDe`), aucune panne ; le rapport de la tranche (périmètre,
 *  crédités, orphelins) s'imprime en fin de fichier. */
export function garderLaTranche(url: string): void {
  const k = numeroDeTranche(basename(fileURLToPath(url)));
  const rang = k === undefined ? -1 : TRANCHES.indexOf(k);
  if (rang < 0) throw new Error(`${url} n’est pas un fichier de garde du Compendium`);
  describe(`#4020 — chaque champ du Compendium a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR (tranche ${k})`, () => garderLesCategories(rang));
}

/** Le délai de la mesure d'une catégorie (`mesurerLaCategorie`) : environ deux fois la plus longue mesurée, marge de la
 *  CI ; une catégorie qui le dépasse se nomme à son `it`. */
const DELAI_D_UNE_CATEGORIE = 600_000;

/** La garde des catégories éditables de rang `rang` modulo le nombre de tranches (`TRANCHES`). */
function garderLesCategories(rang: number): void {
  const mesures: MesureDeLaCategorie[] = [];
  afterAll(() => {
    const comptes = mesures.map((m) => ({ categorie: m.categorie, perimetre: m.perimetre.size, orphelins: orphelinsDe(m).length }));
    const total = comptes.reduce((t, c) => ({ categorie: 'TOTAL', perimetre: t.perimetre + c.perimetre, orphelins: t.orphelins + c.orphelins }), { categorie: 'TOTAL', perimetre: 0, orphelins: 0 });
    const ligne = (c: typeof total) => [c.categorie, c.perimetre, c.perimetre - c.orphelins, c.orphelins].join('\t');
    console.info(['catégorie\tpérimètre\tcrédités\torphelins', ...comptes.map(ligne), ligne(total)].join('\n'));
  });
  for (const categorie of CATEGORIES_EDITABLES.filter((_, i) => i % TRANCHES.length === rang)) {
    it(`aucun champ de ${categorie} n’est orphelin, aucun geste ne lève`, { timeout: DELAI_D_UNE_CATEGORIE }, () => {
      const m = mesurerLaCategorie(categorie);
      mesures.push(m);
      expect(m.perimetre.size, `périmètre de ${categorie} vide`).toBeGreaterThan(0);
      expect({ orphelins: orphelinsDe(m), pannes: m.pannes }, `entrées jouées : ${m.jouees.join(', ')}`).toEqual({ orphelins: [], pannes: [] });
    });
  }
}
