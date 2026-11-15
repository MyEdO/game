/**
 * L'ALLER-RETOUR DE L'ÉDITEUR GODOT (#3606, garde #841, #4234) : un banc par racine de `RACINES` — la scène
 * (`ecrituresJouees`, `ecrituresDesPorteursSeuls`), la carte du monde (`ecrituresDeLaCarte`) et le narratif
 * (`ecrituresDuNarratif`) —, chacun la liste des écritures que les zones de l'éditeur offrent, jouées comme la méthode
 * `editer` du pont les joue (`hotes/godot/pont/pont.ts`) : le jeu d'un élément des zones passé en JSON, validé par
 * `gesteDuFormulaire` ou `boutonDeLEdition`, puis joué par `editer` sur la session d'édition ; le document relu avant et
 * après. La garde décide de ce qu'une écriture crédite (`scripts/guards/lib/editabiliteDesChamps.mjs`) ; `garderLaRacine`
 * en pilote l'audit, une fois par racine (`src/{scene,carte,narratif}-field-editability-guard.test.ts`).
 */
import { fileURLToPath } from 'node:url';
import { it, expect } from 'vitest';
import { allBuiltinCampaigns, paquetDuJeu } from './scenes/campaign';
import {
  editer,
  idDeLaSceneEditee,
  ouvrirLEdition,
  projetEdite,
  sceneEditee,
  type GesteDEdition,
  type Segment,
  type SessionDEdition,
} from './noyau/index';
import { accesDe, DOCUMENTS, porteurDeLaSel, porteurDuProjet, porteursDuProjet, type SorteDePorteur } from './noyau/sceneEditLecture';
import { boutonDeLEdition, gesteDuFormulaire, inspecteurDeLaSession, zonesDeLEditeur, type ZonesDeLEditeur } from './hote/editeur';
import type { Bouton, Choix, Formulaire, Jeu, Ligne } from './hote/elements';
import { ENTREES_DE_DOSSIER } from './data/dossiers';
import { estObjet } from './lib/objet.mjs';
import { auditerLEditabilite, orphanFields, programmeDuPerimetre, RACINES, type EcritureJouee } from '../scripts/guards/lib/editabiliteDesChamps.mjs';
import { detenteur } from './lib/detenteur.testkit';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vite.config.ts`
import { CORPUS_DISQUE, manifesteDe, texteDuChapitre } from '../scripts/source/prose-source-plugin.mjs';

/** La session `s` où le geste `geste` est joué, puis le chapitre qu'elle attend chargé du `Source/` versionné, comme
 *  l'hôte le sert (`GET source/<livre>/<ch>.md`, `texteDuChapitre`). */
function jouer(s: SessionDEdition, geste: GesteDEdition): SessionDEdition {
  const joue = editer(s, geste);
  const attendu = joue.source.chapitreEnAttente;
  return attendu ? editer(joue, { geste: 'chapitre', book: attendu.book, ch: attendu.ch, texte: texteDuChapitre(attendu.book, attendu.ch) }) : joue;
}

/** La session d'édition du paquet `paquet`, ouverte comme le pont l'ouvre (`hotes/godot/pont/pont.ts`, méthode
 *  `ouvrir`) : le manifeste du `Source/` versionné et les entrées de dossier servis. */
const ouvrir = (paquet: ReturnType<typeof paquetDuJeu>): SessionDEdition =>
  ouvrirLEdition(paquet, false, undefined, manifesteDe(CORPUS_DISQUE), ENTREES_DE_DOSSIER.map((e) => e.id));

/** Ce qu'un élément de l'inspecteur offre de jouer au geste `valeur` : son id, le jeu de l'élément, sa saisie, le chemin
 *  qu'il écrit, et s'il emporte des champs (`emporte` : le retrait d'un élément de liste, son déplacement, le choix
 *  d'une autre variante d'union), à jouer après ceux qu'il emporte. */
interface Offre { id: string; jeu: Jeu; saisie: string; chemin: Segment[]; emporte: boolean }

/** Le chemin `chemin` redescend-il dans une clé qu'il a déjà traversée : un schéma récursif (le Trait conféré d'un
 *  Trait), qui se joue à son premier niveau ? */
const recursif = (chemin: readonly Segment[]): boolean => {
  const cles = chemin.filter((p) => typeof p === 'string');
  return new Set(cles).size < cles.length;
};

/** Au plus autant de gestes joués : la boucle se termine même si un formulaire en ouvrait sans fin. */
const GESTES_AU_PLUS = 400;

/** La valeur à jouer dans la saisie `s` d'un formulaire `valeur` : un nombre autre que le courant, dans ses bornes ; un
 *  texte ; une liste vide pour du JSON. */
function valeurSaisie(s: Formulaire['champs'][number]): unknown {
  switch (s.type) {
    case 'saisieNombre': return s.valeur + s.pas <= s.max ? s.valeur + s.pas : s.valeur - s.pas;
    case 'saisieTexte':
    case 'saisieMultiligne': return 'texte joué';
    default: return [];
  }
}

/** Les offres du geste `valeur` des éléments `elements` : un bouton qui pose une valeur (« Ajouter »), qui emporte des
 *  champs s'il retire ou déplace un élément de liste ; la première valeur non pressée d'un choix, qui emporte des
 *  champs si elle choisit une variante (son id n'est pas celui de son chemin) ; un formulaire, sa saisie remplie
 *  (`valeurSaisie`) ; hors d'un chemin récursif (`recursif`). Un retrait (« Retirer », « Aucune ») ne pose aucune valeur
 *  et ne s'offre pas. */
function offres(elements: readonly (Choix | Ligne | Bouton | Formulaire)[]): Offre[] {
  return elements.flatMap((e): Offre[] => {
    if (e.type === 'bouton') {
      const edition = 'edition' in e.jeu ? (e.jeu.edition as GesteDEdition) : undefined;
      return edition?.geste === 'valeur' && 'valeur' in edition ? [{ id: e.id, jeu: e.jeu, saisie: 'bouton', chemin: edition.chemin, emporte: /\/(retirer|monter)$/.test(e.id) }] : [];
    }
    if (e.type === 'choix' || e.type === 'liste') {
      const b = e.valeurs.find((v) => !v.presse && 'type' in v.jeu && v.jeu.type === 'valeur');
      const chemin = (b && 'args' in b.jeu ? b.jeu.args[1] : []) as Segment[];
      return b ? [{ id: e.id, jeu: b.jeu, saisie: 'saisieChoix', chemin, emporte: e.id !== `valeur/${chemin.join('/')}` }] : [];
    }
    if (e.type !== 'formulaire' || e.verbe !== 'valeur') return [];
    const [porteur, chemin, saisie] = e.champs;
    if (porteur.type !== 'fixe' || chemin.type !== 'fixe' || !saisie) return [];
    return [{ id: e.id, jeu: { type: 'valeur', args: [porteur.valeur, chemin.valeur, valeurSaisie(saisie)] }, saisie: saisie.type, chemin: chemin.valeur as Segment[], emporte: false }];
  }).filter((o) => !recursif(o.chemin));
}

/** Les zones d'une session réduites à son inspecteur (`inspecteurDeLaSession`), seul lu par le jeu de ses offres. */
type Inspecteur = Pick<ZonesDeLEditeur, 'editeur.inspecteur'>;
const inspecteur = (s: SessionDEdition): Inspecteur => ({ 'editeur.inspecteur': inspecteurDeLaSession(s) });

/** Le geste d'édition que joue le jeu `jeu` des zones `zones` d'une session, toutes ou son inspecteur seul
 *  (`inspecteur`), passé en JSON comme le pont le reçoit ; `undefined` si les zones ne l'offrent pas. */
function gesteDuJeu(zones: Inspecteur & Partial<ZonesDeLEditeur>, jeu: Jeu): GesteDEdition | undefined {
  const recu = JSON.parse(JSON.stringify(jeu)) as Record<string, unknown>;
  if ('edition' in recu) return boutonDeLEdition(zones, recu.edition) ? (recu.edition as GesteDEdition) : undefined;
  return gesteDuFormulaire(zones, recu);
}

/** Les boutons des zones `zones` : chaque bouton, et chaque valeur d'un choix ou d'une liste. */
const boutonsDesZones = (zones: ZonesDeLEditeur) =>
  Object.values(zones).flat().flatMap((e: Choix | Ligne | Bouton | Formulaire) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : []));

/** La session `s` où joue le bouton d'id `id` de ses zones. */
function presser(s: SessionDEdition, id: string): SessionDEdition {
  const zones = zonesDeLEditeur(s);
  const b = boutonsDesZones(zones).find((v) => v.id === id);
  const geste = b && gesteDuJeu(zones, b.jeu);
  if (!geste) throw new Error(`aucun bouton ${id} dans les zones de l’éditeur`);
  return jouer(s, geste);
}

/** La FORME d'une valeur : ses clés, pour un objet, chacun des `discriminants` avec sa valeur ; sinon son type. */
const forme = (v: unknown, discriminants: ReadonlySet<string>): string =>
  Array.isArray(v) ? '[]' : estObjet(v) ? Object.keys(v).sort().map((k) => (discriminants.has(k) ? `${k}=${JSON.stringify(v[k])}` : k)).join(',') : typeof v;

/** L'EMPREINTE de l'écriture `geste` portée par la saisie `saisie` sur la session `s` : la sorte de son porteur, son
 *  chemin aux rangs effacés, la forme du porteur et de chaque objet que le chemin traverse, celle de la valeur jouée,
 *  sous les `discriminants` des variantes déjà choisies dans la partie. Deux écritures de même empreinte écrivent les
 *  mêmes champs de la même variante : la seconde ne s'ajoute à rien. */
function empreinte(s: SessionDEdition, geste: Extract<GesteDEdition, { geste: 'valeur' }>, saisie: string, discriminants: ReadonlySet<string>): string {
  let v: unknown = porteurDu(s, geste.porteur)?.donnee;
  const formes = [forme(v, discriminants)];
  for (const pas of geste.chemin.slice(0, -1)) {
    v = estObjet(v) || Array.isArray(v) ? (v as Record<string | number, unknown>)[pas] : undefined;
    formes.push(forme(v, discriminants));
  }
  return JSON.stringify([geste.porteur.sorte, geste.chemin.map((p) => (typeof p === 'number' ? '#' : p)), saisie, formes, forme(geste.valeur, discriminants)]);
}

/** Le porteur de formulaire que désigne la sélection de la session `s`, sans elle le singulier du document ouvert (`porteurDeLaSel`). */
const porteurChoisi = (s: SessionDEdition) => porteurDeLaSel(s.sel, s.document, idDeLaSceneEditee(s));

/** Le document de la session `s` où vit un porteur de sorte `sorte` (`DOCUMENTS`, `accesDe`). */
const documentDu = (s: SessionDEdition, sorte: SorteDePorteur): unknown => DOCUMENTS[accesDe(sorte).document].lire(projetEdite(s), idDeLaSceneEditee(s));

/** Le porteur `porteur` de la session `s` (`porteurDuProjet`) : sa donnée et son chemin depuis son document. */
const porteurDu = (s: SessionDEdition, porteur: { sorte: SorteDePorteur; id: string }) => porteurDuProjet(accesDe(porteur.sorte), projetEdite(s), idDeLaSceneEditee(s), porteur.id);

/** Les porteurs de sorte `sorte` de la session `s` (`porteursDuProjet`). */
const porteursDe = (s: SessionDEdition, sorte: SorteDePorteur): readonly unknown[] => porteursDuProjet(accesDe(sorte), projetEdite(s), idDeLaSceneEditee(s));

/** Les empreintes déjà jouées de chaque partie (`ecrituresJouees`), par son `out`. */
const empreintesJouees = new WeakMap<EcritureJouee[], Set<string>>();

/** Les clés des discriminants des variantes choisies dans chaque partie (`ecrire`), par son `out`. */
const discriminantsJoues = new WeakMap<EcritureJouee[], Set<string>>();
const discriminantsDe = (out: EcritureJouee[]): Set<string> => discriminantsJoues.get(out) ?? discriminantsJoues.set(out, new Set()).get(out)!;

/** La session `s` où chaque offre du geste `valeur` de son inspecteur est jouée une fois, celles qui emportent des champs
 *  après les autres, la plus profonde d'abord, jusqu'à ce qu'aucune ne reste ; le choix d'une autre variante rouvre les
 *  offres de ses champs ; seules jouent les offres dont l'id commence par l'une des `branches` (toutes, par défaut) ;
 *  chaque écriture s'ajoute à `out` (`ecrire`), le discriminant du choix d'une variante à l'id de son choix
 *  (`valeur/<chemin>/<discriminant>`). Une offre dont l'empreinte (`empreinte`, sous son propre discriminant s'il est une
 *  clé de sa valeur) a déjà été jouée dans la partie ne s'y ajoute pas ; elle se joue encore si sa valeur est un objet ou une liste, qui ouvre les offres de
 *  ses champs. */
function jouerLInspecteur(depart: SessionDEdition, out: EcritureJouee[], branches: readonly string[] = ['']): SessionDEdition {
  let s = depart;
  const jouees = new Set<string>();
  const deja = empreintesJouees.get(out) ?? empreintesJouees.set(out, new Set()).get(out)!;
  for (let n = 0; n < GESTES_AU_PLUS; n++) {
    const zones = inspecteur(s);
    const restantes = offres(zones['editeur.inspecteur']).filter((o) => branches.some((b) => o.id.startsWith(b)));
    for (;;) {
      const libres = restantes.filter((o) => !jouees.has(o.id));
      const offre = libres.find((o) => !o.emporte) ?? libres.reduce((a, o) => (o.chemin.length > a.chemin.length ? o : a), libres[0]);
      if (!offre) return s;
      jouees.add(offre.id);
      const geste = gesteDuJeu(zones, offre.jeu);
      if (geste?.geste !== 'valeur') throw new Error(`l’offre ${offre.id} ne joue pas le geste valeur`);
      const discriminant = offre.emporte && offre.saisie === 'saisieChoix' ? offre.id.slice(`valeur/${geste.chemin.join('/')}/`.length) : undefined;
      const propre = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur;
      const cle = empreinte(s, geste, offre.saisie, propre ? new Set([...discriminantsDe(out), discriminant]) : discriminantsDe(out));
      const neuve = !deja.has(cle);
      if (!neuve && !estObjet(geste.valeur) && !Array.isArray(geste.valeur)) continue;
      deja.add(cle);
      // Une autre variante choisie rouvre les champs qu'elle porte, homonymes de ceux de la variante quittée.
      if (offre.emporte && offre.saisie === 'saisieChoix') {
        const sous = `valeur/${offre.chemin.join('/')}/`;
        for (const id of jouees) if (id !== offre.id && id.startsWith(sous)) jouees.delete(id);
      }
      s = neuve ? ecrire(s, geste, offre.saisie, out, discriminant) : jouer(s, geste);
      break;
    }
  }
  throw new Error(`plus de ${GESTES_AU_PLUS} offres du geste valeur`);
}

/** La session `s` où le geste `valeur` `geste` est joué (`jouer`), son écriture, avec son chemin depuis le document de son
 *  porteur et la
 *  saisie `saisie` qui l'a portée, ajoutée à `out` : celle du choix d'une variante qui porte le `discriminant`, marquée
 *  de sa `variante`, sur une variante quittée, son discriminant et chaque champ qu'elle pose et que la variante quittée
 *  ne portait pas ; sur un champ absent, la variante entière, qui pose le champ. */
function ecrire(s: SessionDEdition, geste: Extract<GesteDEdition, { geste: 'valeur' }>, saisie: string, out: EcritureJouee[], discriminant?: string): SessionDEdition {
  const suite = jouer(s, geste);
  const avant = documentDu(s, geste.porteur.sorte);
  const apres = documentDu(suite, geste.porteur.sorte);
  const porteur = porteurDu(s, geste.porteur)!;
  const quittee = geste.chemin.reduce<unknown>((o, pas) => (estObjet(o) || Array.isArray(o) ? (o as Record<Segment, unknown>)[pas] : undefined), porteur.donnee);
  const variante = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur ? geste.valeur : undefined;
  const ecrits = variante && estObjet(quittee)
    ? Object.keys(variante).filter((cle) => cle === discriminant || !(estObjet(quittee) && cle in quittee)).map((cle) => ({ chemin: [...geste.chemin, cle], valeur: variante[cle] }))
    : [{ chemin: geste.chemin, valeur: geste.valeur }];
  if (variante) discriminantsDe(out).add(discriminant!);
  for (const ecrit of ecrits) out.push({ avant, apres, chemin: [...porteur.chemin, ...ecrit.chemin], valeur: ecrit.valeur, saisie, ...(variante ? { variante: discriminant } : {}) });
  return suite;
}

/** La session `suite`, tirée de `s` par un outil ou un bouton qui crée un porteur de sorte `sorte`, sélectionné ;
 *  l'écriture de sa collection entière, avec son chemin depuis son document, s'ajoute à `out`. */
function cree(s: SessionDEdition, suite: SessionDEdition, sorte: SorteDePorteur, out: EcritureJouee[]): SessionDEdition {
  const porteur = porteurChoisi(suite);
  const neuf = porteur?.sorte === sorte ? porteurDu(suite, porteur) : undefined;
  if (!neuf) throw new Error(`aucun porteur ${sorte} créé`);
  out.push({ avant: documentDu(s, sorte), apres: documentDu(suite, sorte), chemin: neuf.chemin.slice(0, -1), valeur: porteursDe(suite, sorte), saisie: 'bouton' });
  return suite;
}

/** La session `s` où la zone Logique ajoute un porteur de sorte `sorte` (`logique/<sorte>/ajouter`, `cree`). */
const ajouter = (s: SessionDEdition, sorte: SorteDePorteur, out: EcritureJouee[]): SessionDEdition => cree(s, presser(s, `logique/${sorte}/ajouter`), sorte, out);

/** Le chemin, dans la donnée `donnee`, de l'élément de liste d'identifiant `id`, le premier en profondeur. */
function cheminDeLElement(donnee: unknown, id: string): Segment[] | undefined {
  if (Array.isArray(donnee)) {
    const rang = donnee.findIndex((e) => estObjet(e) && e.id === id);
    if (rang >= 0) return [rang];
  }
  if (!estObjet(donnee) && !Array.isArray(donnee)) return undefined;
  for (const [cle, v] of Object.entries(donnee)) {
    const sous = cheminDeLElement(v, id);
    if (sous) return [Array.isArray(donnee) ? Number(cle) : cle, ...sous];
  }
  return undefined;
}

/** La session `s` où le formulaire d'id `id` de son inspecteur, qui change l'identifiant du porteur sélectionné ou du
 *  porteur singulier du document ouvert (`identifier`), ou d'un élément de ce porteur désigné par ses saisies fixes,
 *  son parent puis lui (`identifier/<famille>/[<parent>/]<élément>`), est joué sous l'identifiant `vers`, ses saisies
 *  fixes dans leur ordre ; l'écriture, avec son chemin depuis le document du porteur, descendu de saisie fixe en saisie
 *  fixe jusqu'à l'élément (`cheminDeLElement`), s'ajoute à `out`. */
function identifier(s: SessionDEdition, id: string, vers: string, out: EcritureJouee[]): SessionDEdition {
  const zones = inspecteur(s);
  const formulaire = zones['editeur.inspecteur'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === id);
  const fixes = (formulaire?.champs ?? []).flatMap((c) => (c.type === 'fixe' ? [String(c.valeur)] : []));
  const geste = formulaire && gesteDuFormulaire(zones, { type: 'identifier', args: [...fixes, vers] });
  const porteur = porteurChoisi(s);
  if (geste?.geste !== 'identifier' || !porteur) throw new Error(`aucun formulaire ${id} qui change un identifiant`);
  const suite = jouer(s, geste);
  const { donnee, chemin } = porteurDu(s, porteur)!;
  const element = fixes.reduce<{ donnee: unknown; chemin: Segment[] }>((acc, fixe) => {
    const sous = cheminDeLElement(acc.donnee, fixe)!;
    return { donnee: sous.reduce<unknown>((o, pas) => (o as Record<Segment, unknown>)[pas], acc.donnee), chemin: [...acc.chemin, ...sous] };
  }, { donnee, chemin: [] }).chemin;
  out.push({ avant: documentDu(s, porteur.sorte), apres: documentDu(suite, porteur.sorte), chemin: [...chemin, ...element, 'id'], valeur: vers, saisie: 'saisieTexte' });
  return suite;
}

/** La session `s` où le formulaire `nommer` de son inspecteur renomme le porteur sélectionné, d'une sorte que son nom
 *  identifie (`ECRITURES_DES_PORTEURS[sorte].renommer`) : en `vers` s'il se saisit, en la première valeur non pressée
 *  qu'il offre s'il se choisit ; l'écriture de la clé qui porte son identifiant, portée par la saisie du formulaire,
 *  s'ajoute à `out`. */
function renommer(s: SessionDEdition, out: EcritureJouee[], vers?: string): SessionDEdition {
  const zones = inspecteur(s);
  const saisie = zones['editeur.inspecteur'].find((e): e is Formulaire => e.type === 'formulaire' && e.verbe === 'nommer')?.champs[0];
  const nom = saisie?.type === 'saisieChoix' ? saisie.valeurs.find((v) => !v.presse)?.valeur : vers;
  const geste = gesteDuFormulaire(zones, { type: 'nommer', args: [nom] });
  const porteur = porteurChoisi(s);
  const avant = porteur && porteurDu(s, porteur);
  if (geste?.geste !== 'nommer' || !saisie || typeof nom !== 'string' || !porteur || !avant) throw new Error('aucun formulaire nommer sur un porteur sélectionné');
  const suite = jouer(s, geste);
  const [ancien, neuf] = [avant.donnee, porteurDu(suite, { sorte: porteur.sorte, id: nom })?.donnee] as unknown[];
  const cle = estObjet(ancien) && estObjet(neuf) ? Object.keys(neuf).find((k) => neuf[k] === nom && ancien[k] === porteur.id) : undefined;
  if (cle === undefined) throw new Error(`le formulaire nommer n’a pas renommé ${porteur.id} en ${nom}`);
  out.push({ avant: documentDu(s, porteur.sorte), apres: documentDu(suite, porteur.sorte), chemin: [...avant.chemin, cle], valeur: nom, saisie: saisie.type });
  return suite;
}

/** Les ids des formulaires de l'inspecteur de la session `s` qui changent un identifiant. */
const formulairesDIdentifiant = (s: SessionDEdition): string[] => inspecteur(s)['editeur.inspecteur'].filter((e) => e.type === 'formulaire' && e.verbe === 'identifier').map((e) => e.id);

/** La session `s` où chaque élément qu'un formulaire de son inspecteur renomme (`formulairesDIdentifiant`) est renommé
 *  (`identifier`) en son identifiant suffixé de `-joue`, du dernier au premier : l'élément qu'un parent adresse (la
 *  réponse, dans son nœud) se renomme avant lui. */
const identifierChaque = (s: SessionDEdition, out: EcritureJouee[]): SessionDEdition =>
  formulairesDIdentifiant(s).reverse().reduce((x, id) => identifier(x, id, `${id.slice(id.lastIndexOf('/') + 1)}-joue`, out), s);

/** Le choix d'id `id` de l'inspecteur des zones `zones`. */
function choixDeLInspecteur(zones: Inspecteur, id: string): Choix {
  const choix = zones['editeur.inspecteur'].find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && e.id === id);
  if (!choix) throw new Error(`aucun choix ${id} dans l’inspecteur`);
  return choix;
}

/** Le geste `valeur` du choix d'id `id` de l'inspecteur de la session `s` dont la valeur satisfait `voulue`. */
function gesteDuChoix(s: SessionDEdition, id: string, voulue: (valeur: unknown) => boolean): Extract<GesteDEdition, { geste: 'valeur' }> {
  const zones = inspecteur(s);
  const b = choixDeLInspecteur(zones, id).valeurs.find((v) => 'args' in v.jeu && v.jeu.type === 'valeur' && voulue(v.jeu.args[2]));
  const geste = b && gesteDuJeu(zones, b.jeu);
  if (geste?.geste !== 'valeur') throw new Error(`aucune valeur voulue au choix ${id}`);
  return geste;
}

/** Chaque valeur du choix d'id `id` de l'inspecteur de la session `s`, choisie depuis `s` et consignée sous son
 *  discriminant (`ecrire`, comme `jouerLInspecteur`), les
 *  offres de sa seule branche jouées (`jouerLInspecteur`, l'id du choix sans son dernier pas) : chaque branche d'une union
 *  (le `Flow`, #3606 M2b ; l'Effet de sa branche `effet` ; l'objectif de victoire d'une rencontre), dont l'inspecteur ne
 *  joue que la première valeur non choisie, et qui en change en se jouant. */
function jouerLesVariantes(s: SessionDEdition, id: string, out: EcritureJouee[]): void {
  const branche = id.slice(0, id.lastIndexOf('/') + 1);
  const zones = inspecteur(s);
  for (const v of choixDeLInspecteur(zones, id).valeurs) {
    const geste = gesteDuJeu(zones, v.jeu);
    if (geste?.geste !== 'valeur') throw new Error(`la variante ${v.id} ne joue pas le geste valeur`);
    jouerLInspecteur(ecrire(s, geste, 'saisieChoix', out, id.slice(`valeur/${geste.chemin.join('/')}/`.length)), out, [branche]);
  }
}

/** Les fiches du Bestiaire des personnages posés, chacune jouée aux branches de son inspecteur qu'elle seule écrit : la
 *  Vouivre (ZI), dont les options portent des Traits facultatifs et une note « swap » qui octroie des Caractéristiques
 *  et une Compétence, à tout son inspecteur ; l'Ombre du fleuve, dont les Miracles de Taal ouvrent des sorts à choisir
 *  (`listesDeSorts`), à son profil de combat et à ses sorts. Le reste de son inspecteur rejouerait celui de la Vouivre ;
 *  chaque porteur joué seul n'ajoute rien à l'audit (`ecrituresDesPorteursSeuls`). */
const FICHES = [['vouivre-zoo-imperial', ['']], ['l-ombre-du-fleuve', ['valeur/combat/ajouter', 'valeur/combat/spells']]] as const;

/** La fiche d'un personnage enrôlé dans une rencontre que la zone Logique ajoute : son arme simple admet d'autres
 *  apparences que sa forme (`EntityAppearance.apparencesObjets`, #2948). */
const ENROLE = { fiche: 'sergent-du-guet', branches: ['valeur/appearance/ajouter', 'valeur/appearance/apparencesObjets'] } as const;

/** Les zones tracées à l'outil Zone, chacune par sa sorte, de la case `(de, de)` à la case `(a, a)`, et les boutons de
 *  son inspecteur pressés avant son jeu : la zone d'effet barre le passage (`zone/barrier`). */
const ZONES = [['effect', 2, 3, ['zone/barrier']], ['trigger', 0, 1, []]] as const;

/** Le dialogue que la zone Logique ajoute, renommé (`renommer`) après chacun de ses éléments (`identifierChaque`). */
const DIALOGUE_RENOMME = 'dialogue-joue';

/** Les choix qui ajoutent une réponse à chaque nœud de ce dialogue, leur première prise pressée avant de renommer ses
 *  éléments : le jeu de son inspecteur finit par retirer ce qu'il a ajouté. */
const REPONSE_AJOUTEE = /^valeur\/nodes\/\d+\/choices\/ajouter$/;

/** L'action ajoutée au `DECOR`, renommée (`identifier`). */
const ACTION_RENOMMEE = { famille: 'identifier/action/', vers: 'action-jouee' } as const;

/** Le choix de l'objectif de victoire d'une rencontre, joué objectif par objectif (`jouerLesVariantes`). */
const VICTOIRE = 'valeur/victoryCondition/type';

/** Le second membre d'une rencontre fait monture, puis la monture que chevauche le premier, choisie parmi elles. */
const MONTURE = 'valeur/members/1/mount';
const CHEVAUCHEE = 'valeur/members/0/ridesEntityId';

/** La scène d'un projet du jeu qui déclare un dialogue, et la case libre où s'y pose un personnage de la première des
 *  `FICHES`, qui choisit l'un de ses dialogues, puis l'autre (`dialogueId`). */
const A_DIALOGUE = { campagne: 'loup-et-saumure', scene: 'ls-epilogue-salzenmund', case: { x: 4, y: 3 }, branches: ['valeur/dialogueId'] } as const;

/** Le projet dont le narratif déclare des presets de PNJ (`presetsPnj`), qu'un personnage choisit (`presetId`). */
const PROJET_A_PRESETS = 'la-diligence';
const BRANCHES_DU_PRESET = ['valeur/presetId'];

/** Le type du décor posé dans une scène neuve du `PROJET_A_PRESETS`, dont les actions authorées s'écrivent
 *  (`usable.actions`). */
const DECOR = 'brasero';

/** Le choix de l'action ajoutée au `DECOR`, sa première prise ; puis celui de la branche de son flux, joué branche par
 *  branche (`jouerLesVariantes`). */
const ACTION_DU_DECOR = 'valeur/usable/ajouter';
const FLUX_DU_DECOR = 'valeur/usable/actions/0/flow/kind';

/** Le choix du type de l'Effet de la branche `effet` de ce flux, joué type par type (`jouerLesVariantes`). */
const EFFET_DU_DECOR = 'valeur/usable/actions/0/flow/effet/type';

/** Un chapitre du `Source/` versionné dont la première section à table porte une table titrée : le chapitre 13 du
 *  Livre de base (« Localisation »), où une cellule se désigne avec sa table. */
const CHAPITRE_A_TABLE = { book: 'livre-de-base', ch: '13' } as const;

/** Un chapitre du `Source/` versionné où une section à table revient (`secOcc`) : les « Armures » du chapitre 63 du
 *  Livre de base. */
const CHAPITRE_A_OCCURRENCES = { book: 'livre-de-base', ch: '63', sec: 'armures' } as const;

/** L'Effet de ce flux qui porte une adresse de prose, composée (`composerLAdresse`). */
const PROSE_DU_DECOR = { effet: 'journal', adresse: 'valeur/usable/actions/0/flow/effet/descRef/' } as const;
const estCellule = (v: unknown): boolean => {
  const dernier: unknown = Array.isArray(v) ? v[v.length - 1] : undefined;
  return estObjet(dernier) && dernier.kind === 'cellule';
};

/** Le geste d'une valeur du choix d'id `id` de l'inspecteur de la session `s` autre que sa valeur pressée. */
function uneAutreValeur(s: SessionDEdition, id: string): Extract<GesteDEdition, { geste: 'valeur' }> {
  const pressee = choixDeLInspecteur(inspecteur(s), id).valeurs.find((v) => v.presse);
  return gesteDuChoix(s, id, (v) => !pressee || !('args' in pressee.jeu) || !Object.is(v, pressee.jeu.args[2]));
}

/** La session `s` où l'adresse de prose au préfixe d'id `adresse` (`…/descRef/`) porte le livre et le chapitre de
 *  `chapitre`, chacun choisi à son choix. */
const surLeChapitre = (s: SessionDEdition, adresse: string, chapitre: { book: string; ch: string }): SessionDEdition =>
  (['book', 'ch'] as const).reduce((x, cle) => jouer(x, gesteDuChoix(x, `${adresse}${cle}`, (v) => v === chapitre[cle])), s);

/** Les écritures de l'adresse de prose au préfixe d'id `adresse` de la session `s`, chacune choisie parmi les valeurs que
 *  son inspecteur offre (`ecrire`) : sur le `CHAPITRE_A_TABLE`, une cellule neuve, une autre ligne, une autre colonne, sa
 *  table, le genre blocs puis de nouveau cellule (`kind`), puis le reste de ses offres (`jouerLInspecteur`) ; sur le
 *  `CHAPITRE_A_OCCURRENCES`, un fragment neuf de chaque genre porté sur sa section, puis sur une autre occurrence de
 *  celle-ci (`secOcc`). Chaque fragment est scellé par l'écriture. */
function composerLAdresse(s: SessionDEdition, adresse: string, out: EcritureJouee[]): void {
  const parts = `${adresse}parts/`;
  const neuf = (x: SessionDEdition, genre: (v: unknown) => boolean): [SessionDEdition, string] => {
    const ajout = gesteDuChoix(x, `${parts}ajouter`, genre);
    return [ecrire(x, ajout, 'saisieChoix', out), `${parts}${(ajout.valeur as unknown[]).length - 1}/`];
  };
  const [cellule, fragment] = neuf(surLeChapitre(s, adresse, CHAPITRE_A_TABLE), estCellule);
  const genre = (kind: string) => (x: SessionDEdition) => ecrire(x, gesteDuChoix(x, `${fragment}kind`, (v) => estObjet(v) && v.kind === kind), 'saisieChoix', out, 'kind');
  const composee = ['row', 'col', 'table'].reduce((x, cle) => ecrire(x, uneAutreValeur(x, `${fragment}${cle}`), 'saisieChoix', out), cellule);
  jouerLInspecteur(genre('cellule')(genre('blocs')(composee)), out, [parts]);
  const occurrences = surLeChapitre(s, adresse, CHAPITRE_A_OCCURRENCES);
  for (const genreNeuf of [estCellule, (v: unknown) => !estCellule(v)]) {
    const [x, f] = neuf(occurrences, genreNeuf);
    const surLaSection = ecrire(x, gesteDuChoix(x, `${f}sec`, (v) => v === CHAPITRE_A_OCCURRENCES.sec), 'saisieChoix', out);
    ecrire(surLaSection, uneAutreValeur(surLaSection, `${f}secOcc`), 'saisieChoix', out);
  }
}

/** La coque pirate de la scène d'embuscade de la barge du sel, à Améliorations d'instance et à postes dotés de leur
 *  coffre (MDG 12), sa case, et les branches de navire qu'elle seule écrit. */
const COQUE = { campagne: 'barge-du-sel', scene: 'barge-du-sel-embuscade', case: { x: 18, y: 7 }, branches: ['valeur/vehicule', 'valeur/upgrades', 'valeur/postes'] } as const;

const point = (x: number, y: number) => ({ case: { x, y }, f: { x, y } });

/** La session `s` où l'outil actif clique la case `(x, y)`. */
const cliquer = (s: SessionDEdition, x: number, y: number): SessionDEdition => jouer(jouer(s, { geste: 'appui', point: point(x, y) }), { geste: 'relache', point: point(x, y) });

/** La session `s` où un personnage de la fiche `fiche` est posé à la case `(x, y)`, à l'outil Personnage. */
const poserPersonnage = (s: SessionDEdition, fiche: string, x: number, y: number): SessionDEdition => cliquer(presser(presser(s, 'outil/personnage'), `personnage/${fiche}`), x, y);

/** La session `s` où un personnage de la fiche `fiche`, posé à la case `(x, y)`, s'enrôle à son inspecteur dans la
 *  rencontre d'id `rencontre` (`rencontre/<id>/enrole`). */
const enroler = (s: SessionDEdition, rencontre: string, fiche: string, x: number, y: number): SessionDEdition => presser(poserPersonnage(s, fiche, x, y), `rencontre/${rencontre}/enrole`);

/** L'id du porteur sélectionné de la session `s`. */
const selectionne = (s: SessionDEdition): string => porteurChoisi(s)!.id;

/** La session du projet du jeu d'id `id` (`ouvrir`). */
function projetDuJeu(id: string): SessionDEdition {
  const c = allBuiltinCampaigns.find((x) => x.id === id);
  if (!c) throw new Error(`aucune campagne ${id}`);
  return ouvrir(paquetDuJeu(c));
}

/** La session de la première campagne du jeu (`ouvrir`). */
const premierProjet = (): SessionDEdition => ouvrir(paquetDuJeu(allBuiltinCampaigns[0]));

/** Une scène neuve du `PROJET_A_PRESETS`. */
const sceneAPresets = (): SessionDEdition => presser(projetDuJeu(PROJET_A_PRESETS), 'scenes/ajouter');

/** Le personnage posé dans la scène `A_DIALOGUE`, où la zone Logique ajoute un second dialogue. */
const personnageDuDialogue = (): SessionDEdition => poserPersonnage(ajouter(presser(projetDuJeu(A_DIALOGUE.campagne), `scenes/${A_DIALOGUE.scene}`), 'dialogue', []), FICHES[0][0], A_DIALOGUE.case.x, A_DIALOGUE.case.y);

/** La `COQUE`, sélectionnée. */
const coqueChoisie = (): SessionDEdition => cliquer(presser(presser(projetDuJeu(COQUE.campagne), `scenes/${COQUE.scene}`), 'outil/select'), COQUE.case.x, COQUE.case.y);

/** La case de la scène neuve de la première campagne du jeu, à l'échelle des ponts, où l'outil navire pose un navire
 *  neuf. */
const NAVIRE_NEUF = { x: 2, y: 6 } as const;

/** La session `s` où l'outil navire pose un navire à la case `(x, y)`, sélectionné ; l'écriture de son entité, à son
 *  rang parmi les entités de la scène, s'ajoute à `out`. */
function poserUnNavire(s: SessionDEdition, x: number, y: number, out: EcritureJouee[]): SessionDEdition {
  const avant = sceneEditee(s);
  const suite = jouer(presser(s, 'outil/navire'), { geste: 'appui', point: point(x, y) });
  const porteur = porteurChoisi(suite);
  const apres = sceneEditee(suite);
  const rang = apres.entities.findIndex((e) => e.id === porteur?.id);
  if (porteur?.sorte !== 'entite' || rang < 0 || avant.entities.some((e) => e.id === porteur.id)) throw new Error('l’outil navire n’a pas posé de navire');
  out.push({ avant, apres, chemin: ['entities', rang], valeur: apres.entities[rang], saisie: 'bouton' });
  return suite;
}

/** Les écritures jouées sur l'inspecteur d'une scène neuve de la première campagne du jeu sans sélection, puis sur une zone d'effet neuve qui barre le passage, un déclencheur neuf (`ZONES`) et un personnage de chacune des `FICHES` d'une
 *  scène neuve de la première campagne du jeu, le manifeste du `Source/` servi, chacun posé à son outil (Zone,
 *  Personnage), un dialogue que la zone Logique y ajoute, dont l'adresse de prose d'un nœud se compose, une réponse ajoutée à chaque nœud (`REPONSE_AJOUTEE`), puis chacun de ses nœuds et de leurs réponses renommé (`identifierChaque`), une rencontre que la zone Logique y ajoute, où un
 *  personnage d'`ENROLE` et un de la première des `FICHES` s'enrôlent (`enroler`), le second fait monture et chevauché
 *  par le premier (`MONTURE`, `CHEVAUCHEE`), puis chacun de ses objectifs de victoire (`VICTOIRE`), et un navire que
 *  l'outil navire y pose (`NAVIRE_NEUF`) ; puis sur un
 *  personnage de la
 *  première des `FICHES` et un décor de type `DECOR` posés dans une scène neuve du `PROJET_A_PRESETS`, puis sur chaque
 *  branche du flux de l'action qu'il reçoit (`ACTION_DU_DECOR`, `FLUX_DU_DECOR`) et sur chaque type d'Effet de sa
 *  branche `effet` (`EFFET_DU_DECOR`), puis sur l'adresse de prose de l'un d'eux et sa cellule (`PROSE_DU_DECOR`),
 *  sur un personnage de
 *  la première des `FICHES` posé dans la scène `A_DIALOGUE`, et sur la coque
 *  `COQUE`, sélectionnée ; chacun
 *  joué à son inspecteur (`jouerLInspecteur`), aux seules branches que donne sa constante (`FICHES`, `ENROLE`,
 *  `BRANCHES_DU_PRESET`, `A_DIALOGUE`, `COQUE`), une écriture d'empreinte déjà jouée dans la partie ne s'y ajoutant pas. */
export function ecrituresJouees(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  let s = presser(premierProjet(), 'scenes/ajouter');
  jouerLInspecteur(s, out);
  for (const [sorte, de, a, boutons] of ZONES) {
    s = presser(presser(s, 'outil/zone'), `zone/${sorte}`);
    s = jouerLInspecteur(boutons.reduce(presser, jouer(jouer(s, { geste: 'appui', point: point(de, de) }), { geste: 'relache', point: point(a, a) })), out);
  }
  FICHES.forEach(([fiche, branches], rang) => { s = jouerLInspecteur(poserPersonnage(s, fiche, 5 + rang, 5), out, branches); });
  const dialogue = jouerLInspecteur(ajouter(s, 'dialogue', out), out);
  const repondu = choixDe(dialogue, REPONSE_AJOUTEE).reduce((x, id) => presser(x, choixDeLInspecteur(inspecteur(x), id).valeurs[0].id), dialogue);
  s = renommer(identifierChaque(repondu, out), out, DIALOGUE_RENOMME);
  s = ajouter(s, 'rencontre', out);
  const rencontre = selectionne(s);
  s = jouerLInspecteur(enroler(s, rencontre, ENROLE.fiche, 5 + FICHES.length, 5), out, ENROLE.branches);
  s = enroler(s, rencontre, FICHES[0][0], 6 + FICHES.length, 5);
  s = jouerLInspecteur(presser(s, `logique/rencontre/${rencontre}`), out);
  jouerLInspecteur(jouer(s, gesteDuChoix(s, MONTURE, (v) => v === true)), out, [CHEVAUCHEE]);
  jouerLesVariantes(s, VICTOIRE, out);
  poserUnNavire(s, NAVIRE_NEUF.x, NAVIRE_NEUF.y, out);
  const pnj = jouerLInspecteur(poserPersonnage(sceneAPresets(), FICHES[0][0], 5, 5), out, BRANCHES_DU_PRESET);
  const decor = jouerLInspecteur(cliquer(presser(presser(pnj, 'outil/prop'), `prop/${DECOR}`), 3, 3), out);
  const action = presser(decor, choixDeLInspecteur(inspecteur(decor), ACTION_DU_DECOR).valeurs[0].id);
  jouerLInspecteur(action, out);
  identifier(action, inspecteur(action)['editeur.inspecteur'].find((e) => e.id.startsWith(ACTION_RENOMMEE.famille))!.id, ACTION_RENOMMEE.vers, out);
  jouerLesVariantes(action, FLUX_DU_DECOR, out);
  const effet = jouer(action, gesteDuChoix(action, FLUX_DU_DECOR, (v) => estObjet(v) && v.kind === 'effet'));
  jouerLesVariantes(effet, EFFET_DU_DECOR, out);
  composerLAdresse(jouerLInspecteur(jouer(effet, gesteDuChoix(effet, EFFET_DU_DECOR, (v) => estObjet(v) && v.type === PROSE_DU_DECOR.effet)), out, [PROSE_DU_DECOR.adresse]), PROSE_DU_DECOR.adresse, out);
  jouerLInspecteur(personnageDuDialogue(), out, A_DIALOGUE.branches);
  jouerLInspecteur(coqueChoisie(), out, COQUE.branches);
  return out;
}

/** Les écritures de chaque porteur joué à ses branches (`FICHES`, `ENROLE`, `BRANCHES_DU_PRESET`, `A_DIALOGUE`, `COQUE`),
 *  SEUL : posé dans une scène où rien n'est joué avant lui, sa partie à lui. Ce qu'elles créditent, `ecrituresJouees` le
 *  crédite déjà, ou une écriture sautée par empreinte cachait une offre. */
export function ecrituresDesPorteursSeuls(): EcritureJouee[] {
  const arene = presser(premierProjet(), 'scenes/ajouter');
  const aRencontre = ajouter(arene, 'rencontre', []);
  const seuls: [SessionDEdition, readonly string[]][] = [
    ...FICHES.map(([fiche, branches]): [SessionDEdition, readonly string[]] => [poserPersonnage(arene, fiche, 5, 5), branches]),
    [enroler(aRencontre, selectionne(aRencontre), ENROLE.fiche, 5, 5), ENROLE.branches],
    [poserPersonnage(sceneAPresets(), FICHES[0][0], 5, 5), BRANCHES_DU_PRESET],
    [personnageDuDialogue(), A_DIALOGUE.branches],
    [coqueChoisie(), COQUE.branches],
  ];
  return seuls.flatMap(([s, branches]) => {
    const out: EcritureJouee[] = [];
    jouerLInspecteur(s, out, branches);
    return out;
  });
}

/** La session `s` où le bouton d'id `id` est pressé ; l'écriture du champ `champ` du porteur sélectionné, relu après,
 *  s'ajoute à `out`. */
function consigner(s: SessionDEdition, id: string, champ: Segment[], out: EcritureJouee[]): SessionDEdition {
  const porteur = porteurChoisi(s)!;
  const suite = presser(s, id);
  const apres = porteurDu(suite, porteur)!;
  const valeur = champ.reduce<unknown>((o, pas) => (estObjet(o) || Array.isArray(o) ? (o as Record<Segment, unknown>)[pas] : undefined), apres.donnee);
  out.push({ avant: documentDu(s, porteur.sorte), apres: documentDu(suite, porteur.sorte), chemin: [...apres.chemin, ...champ], valeur, saisie: 'bouton' });
  return suite;
}

/** Les ids des boutons des zones de la session `s` qui commencent par `prefixe`. */
const boutonsDe = (s: SessionDEdition, prefixe: string): string[] => boutonsDesZones(zonesDeLEditeur(s)).map((b) => b.id).filter((id) => id.startsWith(prefixe));

/** Le premier bouton des zones de la session `s` dont l'id commence par `prefixe`. */
function premierBouton(s: SessionDEdition, prefixe: string): string {
  const id = boutonsDe(s, prefixe)[0];
  if (!id) throw new Error(`aucun bouton ${prefixe}… dans les zones de l’éditeur`);
  return id;
}

/** Le narratif de la première campagne du jeu, mis en place pour que les Effets qui le désignent offrent leurs
 *  valeurs : une affaire, un indice à deux stades et un second indice, un état énuméré à deux valeurs, un PNJ. */
function narratifMisEnPlace(): SessionDEdition {
  const indices = ajouter(presser(ajouter(ajouter(presser(premierProjet(), 'document/narratif'), 'affaires', []), 'indices', []), 'valeur/stades/ajouter'), 'indices', []);
  const etat = presser(ajouter(indices, 'etats', []), 'etat/forme/enum');
  return ajouter(presser(etat, premierBouton(etat, 'valeur/forme/valeurs/ajouter')), 'presetsPnj', []);
}

/** La péripétie ajoutée à une route, et le préfixe d'id de son premier Effet. */
const PERIL = { ajouter: 'valeur/perils/ajouter/0', effets: 'valeur/perils/0/effects/ajouter', effet: 'valeur/perils/0/effects/0/' } as const;

/** Les écritures de la carte du monde de la première campagne du jeu, son narratif mis en place (`narratifMisEnPlace`) :
 *  la carte renommée (`identifierChaque`) ; l'inspecteur de la carte ; un lieu posé à l'outil Lieu et un ajouté à la zone Logique, un point d'intérêt épinglé à
 *  son plan, deux auberges ajoutées au lieu, le point tourné vers la première, la seconde retirée, leur nom et leur repos joués à l'inspecteur ; une route tirée à l'outil Chemin, un mode de transport, une péripétie dont le premier Effet joue chacun de
 *  ses types (`jouerLesVariantes`), chaque forme d'enjeu d'un Test étendu, l'adresse de prose d'un journal
 *  (`composerLAdresse`) ; une embuscade sur une scène à points d'entrée, chaque sens de la route ; une route que la
 *  zone Logique relie depuis un lieu ; la carte retirée puis rouverte. Chacun joué à son inspecteur (`jouerLInspecteur`). */
export function ecrituresDeLaCarte(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  const carte = presser(narratifMisEnPlace(), 'document/carte');
  identifierChaque(carte, out);
  let s = jouerLInspecteur(carte, out);
  const depart = projetEdite(s).worldMap!.places[0];
  s = jouerLInspecteur(cree(s, cliquer(presser(s, 'outil/lieu'), 85, 15), 'lieu', out), out);
  const neuf = selectionne(s);
  s = jouerLInspecteur(ajouter(presser(s, 'outil/select'), 'lieu', out), out);
  s = presser(presser(s, `logique/lieu/${neuf}`), 'lieu/plan');
  const sansPoi = s;
  s = jouer(jouer(presser(s, 'outil/epingler'), { geste: 'appui', point: point(30, 40) }), { geste: 'relache', point: point(30, 40) });
  const lieu = porteurDu(s, { sorte: 'lieu', id: neuf })!;
  out.push({ avant: documentDu(sansPoi, 'lieu'), apres: documentDu(s, 'lieu'), chemin: [...lieu.chemin, 'poi'], valeur: (lieu.donnee as { poi?: unknown }).poi, saisie: 'bouton' });
  s = consigner(consigner(s, 'lieu/etablissement/ajouter/auberge', ['services'], out), 'lieu/etablissement/ajouter/auberge', ['services'], out);
  s = consigner(consigner(s, 'lieu/poi/cible/service/auberge', ['poi'], out), 'lieu/etablissement/auberge-2/retirer', ['services'], out);
  s = presser(jouerLInspecteur(presser(presser(s, 'outil/select'), `logique/lieu/${neuf}`), out), 'lieu/plan');
  const tiree = jouer(jouer(jouer(presser(s, 'outil/chemin'), { geste: 'appui', point: point(depart.pos.x, depart.pos.y) }), { geste: 'glisse', point: point(70, 20) }), { geste: 'relache', point: point(85, 15) });
  s = cree(s, tiree, 'route', out);
  s = ecrire(s, gesteDuChoix(s, 'valeur/modes/ajouter', (v) => Array.isArray(v) && v.includes('diligence')), 'saisieChoix', out);
  const effet = presser(presser(s, PERIL.ajouter), premierBouton(presser(s, PERIL.ajouter), PERIL.effets));
  jouerLesVariantes(effet, `${PERIL.effet}type`, out);
  const etendu = jouer(effet, gesteDuChoix(effet, `${PERIL.effet}type`, (v) => estObjet(v) && v.type === 'extendedTest'));
  jouerLesVariantes(etendu, `${PERIL.effet}stake/forme`, out);
  const journal = jouer(effet, gesteDuChoix(effet, `${PERIL.effet}type`, (v) => estObjet(v) && v.type === 'journal'));
  composerLAdresse(jouerLInspecteur(journal, out, [`${PERIL.effet}descRef/`]), `${PERIL.effet}descRef/`, out);
  s = jouerLInspecteur(s, out);
  const aEntrees = (v: unknown) => Object.keys(projetEdite(s).scenes.find((sc) => sc.id === v)?.entryPoints ?? {}).length > 0;
  s = jouerLInspecteur(ecrire(s, gesteDuChoix(s, 'valeur/ambush/scene/id', aEntrees), 'saisieChoix', out), out, ['valeur/ambush/entry']);
  for (const id of boutonsDe(s, 'route/sens/').filter((id) => id !== 'route/sens/deux')) s = consigner(s, id, ['from'], out);
  s = presser(presser(s, 'outil/select'), `logique/lieu/${depart.id}`);
  s = jouerLInspecteur(cree(s, presser(s, premierBouton(s, 'logique/route/ajouter/')), 'route', out), out);
  const retiree = presser(presser(presser(presser(s, 'outil/select'), 'document/scene'), 'document/carte'), 'carte/retirer');
  const rouverte = presser(retiree, 'document/carte');
  out.push({ avant: documentDu(retiree, 'carte'), apres: documentDu(rouverte, 'carte'), chemin: [], valeur: documentDu(rouverte, 'carte'), saisie: 'bouton' });
  return out;
}

/** Les registres du narratif, chacun ajouté à la zone Logique et joué à son inspecteur. */
const REGISTRES = ['affaires', 'documents', 'presetsPnj', 'indices', 'etats'] as const;

/** Les choix d'union d'un PNJ et d'un objet du narratif, chacun joué variante par variante (`jouerLesVariantes`) après
 *  les boutons qui l'offrent : l'option d'un profil (« swap »), la forme d'une dotation de lot, la portée d'une arme et
 *  celle d'une munition, la cible d'un effet au toucher. */
const UNIONS_DU_PNJ = [
  { boutons: ['valeur/profil/ajouter', 'valeur/profil/optionals/ajouter'], choix: 'valeur/profil/optionals/0/note' },
  { boutons: ['valeur/profil/ajouter', 'valeur/profil/trappings/ajouter', 'valeur/profil/trappings/0/of/ajouter'], choix: 'valeur/profil/trappings/0/of/0/forme' },
] as const;
const UNIONS_DE_L_OBJET = [
  { boutons: [], choix: 'valeur/range/forme' },
  { boutons: [], choix: 'valeur/ammoRangeMod/forme' },
  { boutons: ['valeur/onHitEffects/ajouter'], choix: 'valeur/onHitEffects/0/on/forme' },
] as const;

/** Les ids des choix de l'inspecteur de la session `s` qui satisfont `motif`. */
const choixDe = (s: SessionDEdition, motif: RegExp): string[] => inspecteur(s)['editeur.inspecteur'].filter((e) => (e.type === 'choix' || e.type === 'liste') && motif.test(e.id)).map((e) => e.id);

/** Le bouton qui ajoute un repère à l'identité d'un état. */
const REPERE_AJOUTE = 'valeur/forme/identite/reperes/ajouter';

/** La session `s` où un repère s'ajoute à l'identité de l'état sélectionné, qui porte déjà une ligne : l'écriture de ses
 *  lignes, dont chacune gagne la valeur du repère neuf (`etatCouvert`), s'ajoute à `out` (`consigner`). */
function repereSurLesLignes(s: SessionDEdition, out: EcritureJouee[]): SessionDEdition {
  const etat = porteurDu(s, porteurChoisi(s)!)!.donnee as { forme: { identite?: { lignes: unknown[] } } };
  if (!etat.forme.identite?.lignes.length) throw new Error('l’identité de l’état ne porte aucune ligne où le repère neuf pose sa valeur');
  return consigner(s, REPERE_AJOUTE, ['forme', 'identite', 'lignes'], out);
}

/** Les écritures du narratif de la première campagne du jeu : chacun des `REGISTRES` ajouté à la zone Logique, joué à
 *  son inspecteur, chaque élément renommé (`identifierChaque`), puis lui-même (`renommer`) ; un indice d'une seconde affaire ; chaque forme de dotation d'un PNJ ; chaque forme d'état, sur
 *  l'identité d'un état à lignes, un repère ajouté (`repereSurLesLignes`) ; un
 *  second indice qui renvoie au premier ; un PNJ d'une créature de base armée (`ENROLE`), l'apparence de ses objets ;
 *  un objet et un écart de fiche, chacun renommé (`renommer`) ; les `UNIONS_DU_PNJ` et `UNIONS_DE_L_OBJET`, l'arme dérivée d'un objet et l'adresse de
 *  prose de sa description (`composerLAdresse`) ; puis le narratif singulier. Chacun joué à son inspecteur. */
export function ecrituresDuNarratif(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  let s = presser(premierProjet(), 'document/narratif');
  for (const registre of REGISTRES) {
    s = renommer(identifierChaque(jouerLInspecteur(ajouter(s, registre, out), out), out), out, `${registre}-joue`);
  }
  jouerLInspecteur(ajouter(ajouter(s, 'affaires', []), 'indices', out), out, ['valeur/affaireId']);
  const avecProfil = presser(presser(s, `logique/presetsPnj/${(porteursDe(s, 'presetsPnj')[0] as { id: string }).id}`), 'valeur/profil/trappings/ajouter');
  for (const id of choixDe(avecProfil, /^valeur\/profil\/trappings\/\d+\/forme$/)) jouerLesVariantes(avecProfil, id, out);
  for (const id of boutonsDe(s, 'etat/forme/')) {
    s = jouerLInspecteur(consigner(ajouter(s, 'etats', out), id, ['forme'], out), out);
    if (boutonsDe(s, REPERE_AJOUTE).length) s = repereSurLesLignes(s, out);
  }
  s = jouerLInspecteur(ajouter(s, 'indices', out), out, ['valeur/refs']);
  const pnj = ajouter(s, 'presetsPnj', out);
  s = jouerLInspecteur(ecrire(pnj, gesteDuChoix(pnj, 'valeur/base/id', (v) => v === ENROLE.fiche), 'saisieChoix', out), out, ['valeur/apparence', 'valeur/profil']);
  for (const id of choixDe(s, /^valeur\/profil\/trappings\/\d+\/forme$/)) jouerLesVariantes(s, id, out);
  s = renommer(jouerLInspecteur(ajouter(s, 'objets', out), out), out, 'objets-joue');
  s = renommer(jouerLInspecteur(cree(s, presser(s, premierBouton(s, 'logique/ecart/ajouter/')), 'ecart', out), out), out);
  for (const { boutons, choix } of UNIONS_DU_PNJ) jouerLesVariantes(boutons.reduce(presser, ajouter(s, 'presetsPnj', out)), choix, out);
  const objet = ajouter(s, 'objets', out);
  for (const { boutons, choix } of UNIONS_DE_L_OBJET) jouerLesVariantes((boutons as readonly string[]).reduce(presser, objet), choix, out);
  jouerLInspecteur(presser(objet, 'valeur/derivedWeapon/ajouter'), out, ['valeur/derivedWeapon/']);
  composerLAdresse(jouerLInspecteur(objet, out, ['valeur/descRef/']), 'valeur/descRef/', out);
  jouerLInspecteur(presser(presser(s, 'document/scene'), 'document/narratif'), out);
  return out;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** La GARDE #841 de la racine `racine` de `RACINES`, à appeler dans le `describe` de son fichier : l'audit du dépôt, les
 *  écritures du banc `banc` comprises, sans aucun orphelin, et son périmètre d'au moins `plancher` champs, chaque cas
 *  borné à `delai` ms. Rend le programme du périmètre, les écritures et l'audit, partagés avec les autres cas du
 *  fichier. */
export function garderLaRacine(racine: keyof typeof RACINES, banc: () => EcritureJouee[], { plancher, delai }: { plancher: number; delai: number }) {
  const perimetre = detenteur(() => programmeDuPerimetre(ROOT, Object.values(RACINES)), (session) => session.dispose());
  const ecritures = detenteur(banc);
  const audit = detenteur(() => auditerLEditabilite(ROOT, perimetre(), { racine: RACINES[racine], ecrituresJouees: ecritures() }));
  it(`aucun champ de la racine ${racine} n’est orphelin`, { timeout: delai }, () => {
    const orphelins = orphanFields(audit());
    // Rendu en TEXTE : l'échec NOMME les champs et leur `fichier:ligne`.
    const detail = orphelins.map((r) => `${r.id} (${r.at}) — écrivains : ${r.pipeline.join(', ') || 'AUCUN'}`).join('\n');
    expect(orphelins.map((r) => r.id), detail).toEqual([]);
  });
  it(`le périmètre de la racine ${racine} ne s’effondre pas`, { timeout: delai }, () => {
    expect(audit().length, 'périmètre effondré').toBeGreaterThanOrEqual(plancher);
  });
  return { perimetre, ecritures, audit };
}
