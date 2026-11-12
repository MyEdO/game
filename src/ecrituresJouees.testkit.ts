/**
 * L'ALLER-RETOUR DE L'ÉDITEUR GODOT (#3606, garde #841) : les écritures que le formulaire tiré du schéma offre à
 * l'inspecteur d'une zone d'effet, d'un déclencheur et de son adresse de prose, d'un personnage, d'un dialogue, d'une rencontre, d'un décor et d'une coque, jouées comme la méthode `editer` du pont les joue
 * (`hotes/godot/pont/pont.ts`) : le jeu d'un élément des zones passé en JSON, validé par `gesteDuFormulaire` ou
 * `boutonDeLEdition`, puis joué par `editer` sur la session d'édition ; le document relu avant et après. Partagé par la garde (`src/scene-field-editability-guard.test.ts`) et par la copie de
 * mesure de #841 ; la garde décide de ce qu'une écriture crédite (`ecritureCreditee`).
 */
import { allBuiltinCampaigns, paquetDuJeu } from './scenes/campaign';
import { editer, ouvrirLEdition, sceneEditee, type GesteDEdition, type Scene, type Segment, type SessionDEdition } from './noyau/index';
import { FORMULAIRES, porteurDeLaSel, type SorteDePorteur } from './noyau/sceneEditLecture';
import { boutonDeLEdition, gesteDuFormulaire, inspecteurDeLaSession, zonesDeLEditeur, type ZonesDeLEditeur } from './hote/editeur';
import type { Bouton, Choix, Formulaire, Jeu, Ligne } from './hote/elements';
import type { Manifeste } from './data/source/chapitres';
import { estObjet } from './lib/objet.mjs';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vite.config.ts`
import { servirLaSource } from '../scripts/source/prose-source-plugin.mjs';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vite.config.ts`
import { cheminChapitre, lireChapitre } from '../scripts/source/lecteur-fs.mjs';
// @ts-expect-error - bibliothèque RAW ESM JS (pas de types) — même convention que `vite.config.ts`
import { sigleDe } from '../scripts/raw/_lib.mjs';

/** Une écriture jouée : le document avant et après, le chemin écrit depuis la scène, la valeur jouée et la saisie qui
 *  l'a portée (`bouton`, ou le type de la saisie d'un choix ou d'un formulaire). */
export interface EcritureJouee { avant: Scene; apres: Scene; chemin: (string | number)[]; valeur: unknown; saisie: string }

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

/** Le seul chapitre du `Source/` que sert l'hôte de l'aller-retour : le plus court du livre de base dont une table est
 *  titrée, où une cellule choisit sa table (`FragmentCellule.table`). */
const SOURCE = { book: 'livre-de-base', ch: '61' } as const;

/** Le corpus du `Source/` réduit au chapitre `SOURCE`, lu sur le disque du dépôt (`lecteur-fs.mjs`). */
const CORPUS = { livres: () => [SOURCE.book], chapitres: () => [SOURCE.ch], chemin: cheminChapitre, lire: lireChapitre, abbr: sigleDe };

/** Ce que l'hôte reçoit à la route `route` du `Source/` du `CORPUS`, servie comme `hotes/godot/servir.mjs` la sert
 *  (`servirLaSource`) : le manifeste, ou le texte d'un chapitre. */
function servi(route: string): string {
  let corps = '';
  servirLaSource(route, { setHeader: () => {}, end: (texte: string) => { corps = texte; } }, CORPUS);
  return corps;
}

/** La session `s` après le geste `g` (`editer`), le chapitre qu'elle se met à attendre servi (`servi`) et rendu comme
 *  l'hôte le rend, par le geste `chapitre` (`hotes/godot/pont/pont.ts`). */
function jouer(s: SessionDEdition, g: GesteDEdition): SessionDEdition {
  const suite = editer(s, g);
  const attendu = suite.chapitreEnAttente;
  return attendu ? editer(suite, { geste: 'chapitre', ...attendu, texte: servi(`/source/${attendu.book}/${attendu.ch}.md`) }) : suite;
}

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

/** Le geste d'édition que joue le jeu `jeu` des zones `zones` d'une session, toutes ou son inspecteur seul
 *  (`inspecteurDeLaSession`), passé en JSON comme le pont le reçoit ;
 *  `undefined` si les zones ne l'offrent pas. */
function gesteDuJeu(zones: Pick<ZonesDeLEditeur, 'editeur.inspecteur'> & Partial<ZonesDeLEditeur>, jeu: Jeu): GesteDEdition | undefined {
  const recu = JSON.parse(JSON.stringify(jeu)) as Record<string, unknown>;
  if ('edition' in recu) return boutonDeLEdition(zones, recu.edition) ? (recu.edition as GesteDEdition) : undefined;
  return gesteDuFormulaire(zones, recu);
}

/** La session `s` où joue le bouton d'id `id` de ses zones. */
function presser(s: SessionDEdition, id: string): SessionDEdition {
  const zones = zonesDeLEditeur(s);
  const b = Object.values(zones).flat().flatMap((e: Choix | Ligne | Bouton | Formulaire) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : [])).find((v) => v.id === id);
  const geste = b && gesteDuJeu(zones, b.jeu);
  if (!geste) throw new Error(`aucun bouton ${id} dans les zones de l’éditeur`);
  return jouer(s, geste);
}

/** La session `s` où la zone Logique ajoute un porteur de sorte `sorte` (`logique/<sorte>/ajouter`), sélectionné ;
 *  l'écriture de sa collection entière, le porteur neuf compris, avec son chemin depuis la scène, s'ajoute à `out`. */
function ajouter(s: SessionDEdition, sorte: SorteDePorteur, out: EcritureJouee[]): SessionDEdition {
  const avant = sceneEditee(s);
  const suite = presser(s, `logique/${sorte}/ajouter`);
  const porteur = porteurDeLaSel(suite.sel);
  const { collection } = FORMULAIRES[sorte];
  const porteurs: readonly { id: string }[] = sceneEditee(suite)[collection] ?? [];
  const rang = porteurs.findIndex((p) => p.id === porteur?.id);
  if (porteur?.sorte !== sorte || rang < 0) throw new Error(`la zone Logique n’a pas ajouté de porteur ${sorte}`);
  out.push({ avant, apres: sceneEditee(suite), chemin: [collection], valeur: porteurs, saisie: 'bouton' });
  return suite;
}

/** La session `s` où le formulaire d'id `id` de son inspecteur, qui change l'identifiant d'un élément d'un porteur
 *  (`identifier/<famille>/<élément>`), est joué sous l'identifiant `vers` ; l'écriture, avec son chemin depuis la
 *  scène, s'ajoute à `out`. */
function identifier(s: SessionDEdition, id: string, vers: string, out: EcritureJouee[]): SessionDEdition {
  const zones = { 'editeur.inspecteur': inspecteurDeLaSession(s) };
  const formulaire = zones['editeur.inspecteur'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === id);
  const designe = formulaire?.champs[0];
  const element = designe?.type === 'fixe' ? designe.valeur : undefined;
  const geste = element === undefined ? undefined : gesteDuFormulaire(zones, { type: 'identifier', args: [element, vers] });
  const porteur = porteurDeLaSel(s.sel);
  if (geste?.geste !== 'identifier' || !porteur) throw new Error(`aucun formulaire ${id} qui change un identifiant`);
  const avant = sceneEditee(s);
  const suite = jouer(s, geste);
  const { collection } = FORMULAIRES[porteur.sorte];
  const porteurs: readonly { id: string; nodes?: readonly { id: string }[] }[] = avant[collection] ?? [];
  const rang = porteurs.findIndex((p) => p.id === porteur.id);
  const noeud = porteurs[rang].nodes!.findIndex((n) => n.id === element);
  out.push({ avant, apres: sceneEditee(suite), chemin: [collection, rang, 'nodes', noeud, 'id'], valeur: vers, saisie: 'saisieTexte' });
  return suite;
}

/** La session `s` après le geste `valeur` `geste`, porté par la saisie `saisie` ; son écriture, avec son chemin depuis
 *  la scène, s'ajoute à `out` : celle du choix d'une variante de discriminant `discriminant`, son discriminant et chaque
 *  champ qu'elle pose et que la variante quittée ne portait pas. */
function consigner(s: SessionDEdition, geste: Extract<GesteDEdition, { geste: 'valeur' }>, saisie: string, discriminant: string | undefined, out: EcritureJouee[]): SessionDEdition {
  const avant = sceneEditee(s);
  const suite = jouer(s, geste);
  const { collection } = FORMULAIRES[geste.porteur.sorte];
  const porteurs: readonly { id: string }[] = avant[collection] ?? [];
  const rang = porteurs.findIndex((p) => p.id === geste.porteur.id);
  const quittee = geste.chemin.reduce<unknown>((o, pas) => (estObjet(o) || Array.isArray(o) ? (o as Record<Segment, unknown>)[pas] : undefined), porteurs[rang]);
  const variante = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur ? geste.valeur : undefined;
  const ecrits = variante
    ? Object.keys(variante).filter((cle) => cle === discriminant || !(estObjet(quittee) && cle in quittee)).map((cle) => ({ chemin: [...geste.chemin, cle], valeur: variante[cle] }))
    : [{ chemin: geste.chemin, valeur: geste.valeur }];
  for (const ecrit of ecrits) out.push({ avant, apres: sceneEditee(suite), chemin: [collection, rang, ...ecrit.chemin], valeur: ecrit.valeur, saisie });
  return suite;
}

/** La session `s` où chaque offre du geste `valeur` de son inspecteur est jouée une fois, celles qui emportent des champs
 *  après les autres, la plus profonde d'abord, jusqu'à ce qu'aucune ne reste ; le choix d'une autre variante rouvre les
 *  offres de ses champs ; seules jouent les offres dont l'id commence par `branche` (toutes, par défaut) ; chaque
 *  écriture consignée à `out` (`consigner`), le discriminant du choix d'une variante à l'id de son choix
 *  (`valeur/<chemin>/<discriminant>`). */
function jouerLInspecteur(depart: SessionDEdition, out: EcritureJouee[], branche = ''): SessionDEdition {
  let s = depart;
  const jouees = new Set<string>();
  for (let n = 0; n < GESTES_AU_PLUS; n++) {
    const zones = { 'editeur.inspecteur': inspecteurDeLaSession(s) };
    const restantes = offres(zones['editeur.inspecteur']).filter((o) => o.id.startsWith(branche) && !jouees.has(o.id));
    const offre = restantes.find((o) => !o.emporte) ?? restantes.reduce((a, o) => (o.chemin.length > a.chemin.length ? o : a), restantes[0]);
    if (!offre) return s;
    jouees.add(offre.id);
    // Une autre variante choisie rouvre les champs qu'elle porte, homonymes de ceux de la variante quittée.
    if (offre.emporte && offre.saisie === 'saisieChoix') {
      const sous = `valeur/${offre.chemin.join('/')}/`;
      for (const id of jouees) if (id !== offre.id && id.startsWith(sous)) jouees.delete(id);
    }
    const geste = gesteDuJeu(zones, offre.jeu);
    if (geste?.geste !== 'valeur') throw new Error(`l’offre ${offre.id} ne joue pas le geste valeur`);
    const discriminant = offre.emporte && offre.saisie === 'saisieChoix' ? offre.id.slice(`valeur/${geste.chemin.join('/')}/`.length) : undefined;
    s = consigner(s, geste, offre.saisie, discriminant, out);
  }
  throw new Error(`plus de ${GESTES_AU_PLUS} offres du geste valeur`);
}

/** Le choix d'id `id` de l'inspecteur des zones `zones`. */
function choixDeLInspecteur(zones: Pick<ZonesDeLEditeur, 'editeur.inspecteur'>, id: string): Choix {
  const choix = zones['editeur.inspecteur'].find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && e.id === id);
  if (!choix) throw new Error(`aucun choix ${id} dans l’inspecteur`);
  return choix;
}

/** Chaque variante du choix d'id `id` de l'inspecteur de la session `s`, choisie depuis `s` et consignée (`consigner`),
 *  les offres de sa seule branche jouées (`jouerLInspecteur`, l'id du choix sans son discriminant) : chaque branche
 *  d'une union (le `Flow`, #3606 M2b ; l'Effet de sa branche `effet` ; l'objectif de victoire d'une rencontre), dont
 *  l'inspecteur ne joue que la première variante non choisie, et qui en change en se jouant. */
function jouerLesVariantes(s: SessionDEdition, id: string, out: EcritureJouee[]): void {
  const branche = id.slice(0, id.lastIndexOf('/') + 1);
  const zones = { 'editeur.inspecteur': inspecteurDeLaSession(s) };
  for (const v of choixDeLInspecteur(zones, id).valeurs) {
    const geste = gesteDuJeu(zones, v.jeu);
    if (geste?.geste !== 'valeur') throw new Error(`la variante ${v.id} ne joue pas le geste valeur`);
    jouerLInspecteur(consigner(s, geste, 'saisieChoix', id.slice(branche.length), out), out, branche);
  }
}

/** La session `s` où le choix d'id `id` de son inspecteur vaut la première de ses valeurs qui satisfait `voulu`. */
function choisir(s: SessionDEdition, id: string, voulu: (valeur: unknown) => boolean): SessionDEdition {
  const v = choixDeLInspecteur({ 'editeur.inspecteur': inspecteurDeLaSession(s) }, id).valeurs.find((v) => 'type' in v.jeu && v.jeu.type === 'valeur' && voulu(v.jeu.args[2]));
  if (!v) throw new Error(`aucune valeur voulue au choix ${id}`);
  return v.presse ? s : presser(s, v.id);
}

/** Le chemin, sous l'inspecteur d'un déclencheur, de l'adresse de prose de l'Effet de son flux quand il écrit au
 *  journal, qui admet chaque genre de fragment. */
const ADRESSE = 'valeur/flow/effet/descRef';

/** Le déclencheur sélectionné de la session `s`, son flux à un Effet qui écrit au journal, l'adresse de prose de cet
 *  Effet composée sur le chapitre `SOURCE` : son inspecteur joué sous elle (`jouerLInspecteur`), qui choisit son livre,
 *  son chapitre, que l'hôte sert, et des blocs ; puis, sur ce chapitre, une cellule ajoutée, sa table, sa ligne et sa
 *  colonne choisies, et un fragment ajouté après elle. */
function jouerLAdresse(s: SessionDEdition, out: EcritureJouee[]): void {
  const effet = choisir(s, 'valeur/flow/kind', (v) => estObjet(v) && v.kind === 'effet');
  const journal = choisir(effet, 'valeur/flow/effet/type', (v) => estObjet(v) && v.type === 'journal');
  jouerLInspecteur(journal, out, `${ADRESSE}/`);
  const chapitre = choisir(choisir(journal, `${ADRESSE}/ajouter`, (v) => estObjet(v) && v.book === SOURCE.book), `${ADRESSE}/ch`, (v) => v === SOURCE.ch);
  const cellule = choisir(chapitre, `${ADRESSE}/parts/ajouter`, (v) => Array.isArray(v) && estObjet(v[0]) && v[0].kind === 'cellule');
  const posee = ['table', 'row', 'col'].reduce((c, cle) => jouerLInspecteur(c, out, `${ADRESSE}/parts/0/${cle}`), cellule);
  jouerLInspecteur(posee, out, `${ADRESSE}/parts/ajouter`);
}

/** Les fiches du Bestiaire des personnages posés : la Vouivre (ZI), dont les options portent des Traits facultatifs et
 *  une note « swap » qui octroie des Caractéristiques et une Compétence ; l'Ombre du fleuve, dont les Miracles de Taal
 *  ouvrent des sorts à choisir (`listesDeSorts`). */
const FICHES = ['vouivre-zoo-imperial', 'l-ombre-du-fleuve'] as const;

/** La fiche d'un personnage enrôlé dans une rencontre : son arme simple admet d'autres apparences que sa forme
 *  (`EntityAppearance.apparencesObjets`, #2948). */
const ENROLE = 'sergent-du-guet';

/** Le choix de l'objectif de victoire d'une rencontre, joué objectif par objectif (`jouerLesVariantes`). */
const VICTOIRE = 'valeur/victoryCondition/type';

/** Le second membre d'une rencontre fait monture, puis la monture que chevauche le premier, choisie parmi elles. */
const MONTURE = 'valeur/members/1/mount';
const CHEVAUCHEE = 'valeur/members/0/ridesEntityId';

/** La scène d'un projet du jeu qui déclare un dialogue, et la case libre où s'y pose un personnage de la première des
 *  `FICHES`, qui le choisit (`dialogueId`). */
const A_DIALOGUE = { campagne: 'loup-et-saumure', scene: 'ls-epilogue-salzenmund', case: { x: 4, y: 3 } } as const;

/** Le projet dont le narratif déclare des presets de PNJ (`presetsPnj`), qu'un personnage choisit (`presetId`). */
const PROJET_A_PRESETS = 'la-diligence';

/** Le type du décor posé dans une scène neuve du `PROJET_A_PRESETS`, dont les actions authorées s'écrivent
 *  (`usable.actions`). */
const DECOR = 'brasero';

/** Le choix de l'action ajoutée au `DECOR`, sa première prise ; puis celui de la branche de son flux, joué branche par
 *  branche (`jouerLesVariantes`). */
const ACTION_DU_DECOR = 'valeur/usable/ajouter';
const FLUX_DU_DECOR = 'valeur/usable/actions/0/flow/kind';

/** Le choix du type de l'Effet de la branche `effet` de ce flux, joué type par type (`jouerLesVariantes`). */
const EFFET_DU_DECOR = 'valeur/usable/actions/0/flow/effet/type';

/** La coque pirate de la scène d'embuscade de la barge du sel, à Améliorations d'instance et à postes dotés de leur
 *  coffre (MDG 12), et sa case. */
const COQUE = { campagne: 'barge-du-sel', scene: 'barge-du-sel-embuscade', case: { x: 18, y: 7 } } as const;

const point = (x: number, y: number) => ({ case: { x, y }, f: { x, y } });

/** La session `s` où l'outil actif clique la case `(x, y)`. */
const cliquer = (s: SessionDEdition, x: number, y: number): SessionDEdition => jouer(jouer(s, { geste: 'appui', point: point(x, y) }), { geste: 'relache', point: point(x, y) });

/** Les écritures jouées sur une zone d'effet neuve, un déclencheur neuf, puis l'adresse de prose de son Effet
 *  (`jouerLAdresse`), et un personnage de chacune des `FICHES` d'une scène neuve de la première campagne du jeu, ouverte
 *  avec le `Source/` servi (`SOURCE`), chacun posé à son outil (Zone, Personnage), un dialogue que la zone Logique y
 *  ajoute, son nœud ajouté renommé (`identifier`), une rencontre que la zone Logique y ajoute, où un personnage
 *  d'`ENROLE` et un de la première des `FICHES` s'enrôlent à leur inspecteur (`rencontres`, `{ geste: 'membre' }`), le
 *  second fait monture et chevauché par le premier (`MONTURE`, `CHEVAUCHEE`), puis chacun de ses objectifs de victoire
 *  (`VICTOIRE`) ; puis sur un personnage de la
 *  première des `FICHES` et un décor de type `DECOR` posés dans une scène neuve du `PROJET_A_PRESETS`, puis sur chaque
 *  branche du flux de l'action qu'il reçoit (`ACTION_DU_DECOR`, `FLUX_DU_DECOR`) et sur chaque type d'Effet de sa
 *  branche `effet` (`EFFET_DU_DECOR`), sur un personnage de
 *  la première des `FICHES` posé dans la scène `A_DIALOGUE`, et sur la coque
 *  `COQUE`, sélectionnée ; chacun
 *  joué à son inspecteur (`jouerLInspecteur`). */
export function ecrituresJouees(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  let s = presser(ouvrirLEdition(paquetDuJeu(allBuiltinCampaigns[0]), false, undefined, JSON.parse(servi('/source/manifest.json')) as Manifeste), 'scenes/ajouter');
  for (const [sorte, de, a] of [['effect', 2, 3], ['trigger', 0, 1]] as const) {
    s = presser(presser(s, 'outil/zone'), `zone/${sorte}`);
    s = jouerLInspecteur(jouer(jouer(s, { geste: 'appui', point: point(de, de) }), { geste: 'relache', point: point(a, a) }), out);
  }
  jouerLAdresse(s, out);
  FICHES.forEach((fiche, rang) => { s = jouerLInspecteur(cliquer(presser(presser(s, 'outil/personnage'), `personnage/${fiche}`), 5 + rang, 5), out); });
  s = identifier(jouerLInspecteur(ajouter(s, 'dialogue', out), out), 'identifier/noeud/n2', 'noeud-joue', out);
  s = ajouter(s, 'rencontre', out);
  const rencontre = porteurDeLaSel(s.sel)!.id;
  s = jouerLInspecteur(presser(cliquer(presser(presser(s, 'outil/personnage'), `personnage/${ENROLE}`), 5 + FICHES.length, 5), `rencontre/${rencontre}/enrole`), out);
  s = presser(cliquer(presser(presser(s, 'outil/personnage'), `personnage/${FICHES[0]}`), 6 + FICHES.length, 5), `rencontre/${rencontre}/enrole`);
  s = jouerLInspecteur(presser(s, `logique/rencontre/${rencontre}`), out);
  jouerLInspecteur(choisir(s, MONTURE, (v) => v === true), out, CHEVAUCHEE);
  jouerLesVariantes(s, VICTOIRE, out);
  const aPresets = allBuiltinCampaigns.find((c) => c.id === PROJET_A_PRESETS);
  if (!aPresets) throw new Error(`aucune campagne ${PROJET_A_PRESETS}`);
  const neuve = presser(ouvrirLEdition(paquetDuJeu(aPresets), false), 'scenes/ajouter');
  const pnj = jouerLInspecteur(cliquer(presser(presser(neuve, 'outil/personnage'), `personnage/${FICHES[0]}`), 5, 5), out);
  const decor = jouerLInspecteur(cliquer(presser(presser(pnj, 'outil/prop'), `prop/${DECOR}`), 3, 3), out);
  const action = presser(decor, choixDeLInspecteur({ 'editeur.inspecteur': inspecteurDeLaSession(decor) }, ACTION_DU_DECOR).valeurs[0].id);
  jouerLInspecteur(action, out);
  jouerLesVariantes(action, FLUX_DU_DECOR, out);
  jouerLesVariantes(choisir(action, FLUX_DU_DECOR, (v) => estObjet(v) && v.kind === 'effet'), EFFET_DU_DECOR, out);
  const aDialogue = allBuiltinCampaigns.find((c) => c.id === A_DIALOGUE.campagne);
  if (!aDialogue) throw new Error(`aucune campagne ${A_DIALOGUE.campagne}`);
  const dialogues = presser(presser(ouvrirLEdition(paquetDuJeu(aDialogue), false), `scenes/${A_DIALOGUE.scene}`), 'outil/personnage');
  jouerLInspecteur(cliquer(presser(dialogues, `personnage/${FICHES[0]}`), A_DIALOGUE.case.x, A_DIALOGUE.case.y), out);
  const campagne = allBuiltinCampaigns.find((c) => c.id === COQUE.campagne);
  if (!campagne) throw new Error(`aucune campagne ${COQUE.campagne}`);
  const barge = presser(presser(ouvrirLEdition(paquetDuJeu(campagne), false), `scenes/${COQUE.scene}`), 'outil/select');
  jouerLInspecteur(cliquer(barge, COQUE.case.x, COQUE.case.y), out);
  return out;
}
