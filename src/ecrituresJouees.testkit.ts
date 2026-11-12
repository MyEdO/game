/**
 * L'ALLER-RETOUR DE L'ÉDITEUR GODOT (#3606, garde #841) : les écritures que le formulaire tiré du schéma offre à
 * l'inspecteur d'une zone d'effet, d'un déclencheur, d'un personnage, d'un décor et d'une coque, jouées comme la méthode `editer` du pont les joue
 * (`hotes/godot/pont/pont.ts`) : le jeu d'un élément des zones passé en JSON, validé par `gesteDuFormulaire` ou
 * `boutonDeLEdition`, puis joué par `editer` sur la session d'édition ; le document relu avant et après. Partagé par la garde (`src/scene-field-editability-guard.test.ts`) et par la copie de
 * mesure de #841 ; la garde décide de ce qu'une écriture crédite (`ecritureCreditee`).
 */
import { allBuiltinCampaigns, paquetDuJeu } from './scenes/campaign';
import { editer, ouvrirLEdition, sceneEditee, type GesteDEdition, type Scene, type Segment, type SessionDEdition } from './noyau/index';
import type { SorteDePorteur } from './noyau/sceneEditLecture';
import { boutonDeLEdition, gesteDuFormulaire, zonesDeLEditeur, type ZonesDeLEditeur } from './hote/editeur';
import type { Bouton, Choix, Formulaire, Jeu, Ligne } from './hote/elements';
import { estObjet } from './lib/objet.mjs';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vite.config.ts`
import { CORPUS_DISQUE, manifesteDe, texteDuChapitre } from '../scripts/source/prose-source-plugin.mjs';

/** La session `s` où le geste `geste` est joué, puis le chapitre qu'elle attend chargé du `Source/` versionné, comme
 *  l'hôte le sert (`GET source/<livre>/<ch>.md`, `texteDuChapitre`). */
function jouer(s: SessionDEdition, geste: GesteDEdition): SessionDEdition {
  const joue = editer(s, geste);
  const attendu = joue.chapitreEnAttente;
  return attendu ? editer(joue, { geste: 'chapitre', book: attendu.book, ch: attendu.ch, texte: texteDuChapitre(attendu.book, attendu.ch) }) : joue;
}

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

/** Le geste d'édition que joue le jeu `jeu` des zones `zones` d'une session, passé en JSON comme le pont le reçoit ;
 *  `undefined` si les zones ne l'offrent pas. */
function gesteDuJeu(zones: ZonesDeLEditeur, jeu: Jeu): GesteDEdition | undefined {
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

/** Les collections de la scène où vit le porteur de chaque sorte du geste `valeur`. */
const COLLECTION_DU_PORTEUR = { zone: 'effectZones', declencheur: 'triggers', entite: 'entities' } as const satisfies Record<SorteDePorteur, keyof Scene>;

/** La FORME d'une valeur : ses clés, pour un objet ; sinon son type. */
const forme = (v: unknown): string => (Array.isArray(v) ? '[]' : estObjet(v) ? Object.keys(v).sort().join(',') : typeof v);

/** L'EMPREINTE de l'écriture `geste` portée par la saisie `saisie` sur la session `s` : la sorte de son porteur, son
 *  chemin aux rangs effacés, la forme du porteur et de chaque objet que le chemin traverse, celle de la valeur jouée.
 *  Deux écritures de même empreinte écrivent les mêmes champs du même type : la seconde ne s'ajoute à rien. */
function empreinte(s: SessionDEdition, geste: Extract<GesteDEdition, { geste: 'valeur' }>, saisie: string): string {
  const porteurs: readonly unknown[] = sceneEditee(s)[COLLECTION_DU_PORTEUR[geste.porteur.sorte]] ?? [];
  let v: unknown = porteurs.find((p) => estObjet(p) && p.id === geste.porteur.id);
  const formes = [forme(v)];
  for (const pas of geste.chemin.slice(0, -1)) {
    v = estObjet(v) || Array.isArray(v) ? (v as Record<string | number, unknown>)[pas] : undefined;
    formes.push(forme(v));
  }
  return JSON.stringify([geste.porteur.sorte, geste.chemin.map((p) => (typeof p === 'number' ? '#' : p)), saisie, formes, forme(geste.valeur)]);
}

/** Les empreintes déjà jouées de chaque partie (`ecrituresJouees`), par son `out`. */
const empreintesJouees = new WeakMap<EcritureJouee[], Set<string>>();

/** La session `s` où chaque offre du geste `valeur` de son inspecteur est jouée une fois, celles qui emportent des champs
 *  après les autres, la plus profonde d'abord, jusqu'à ce qu'aucune ne reste ; le choix d'une autre variante rouvre les
 *  offres de ses champs ; seules jouent les offres dont l'id commence par l'une des `branches` (toutes, par défaut) ;
 *  chaque écriture, avec son chemin depuis la scène, s'ajoute à `out` : le choix d'une variante écrit son discriminant
 *  (l'id de son choix, `valeur/<chemin>/<discriminant>`). Une offre dont l'empreinte (`empreinte`) a déjà été jouée dans
 *  la partie ne s'y ajoute pas ; elle se joue encore si sa valeur est un objet ou une liste, qui ouvre les offres de
 *  ses champs. */
function jouerLInspecteur(depart: SessionDEdition, out: EcritureJouee[], branches: readonly string[] = ['']): SessionDEdition {
  let s = depart;
  const jouees = new Set<string>();
  const deja = empreintesJouees.get(out) ?? empreintesJouees.set(out, new Set()).get(out)!;
  for (let n = 0; n < GESTES_AU_PLUS; n++) {
    const zones = zonesDeLEditeur(s);
    const restantes = offres(zones['editeur.inspecteur']).filter((o) => branches.some((b) => o.id.startsWith(b)));
    for (;;) {
      const libres = restantes.filter((o) => !jouees.has(o.id));
      const offre = libres.find((o) => !o.emporte) ?? libres.reduce((a, o) => (o.chemin.length > a.chemin.length ? o : a), libres[0]);
      if (!offre) return s;
      jouees.add(offre.id);
      const geste = gesteDuJeu(zones, offre.jeu);
      if (geste?.geste !== 'valeur') throw new Error(`l’offre ${offre.id} ne joue pas le geste valeur`);
      const cle = empreinte(s, geste, offre.saisie);
      const neuve = !deja.has(cle);
      if (!neuve && !estObjet(geste.valeur) && !Array.isArray(geste.valeur)) continue;
      deja.add(cle);
      // Une autre variante choisie rouvre les champs qu'elle porte, homonymes de ceux de la variante quittée.
      if (offre.emporte && offre.saisie === 'saisieChoix') {
        const sous = `valeur/${offre.chemin.join('/')}/`;
        for (const id of jouees) if (id !== offre.id && id.startsWith(sous)) jouees.delete(id);
      }
      const discriminant = offre.emporte && offre.saisie === 'saisieChoix' ? offre.id.slice(`valeur/${geste.chemin.join('/')}/`.length) : undefined;
      s = neuve ? ecrire(s, geste, offre.saisie, out, discriminant) : jouer(s, geste);
      break;
    }
  }
  throw new Error(`plus de ${GESTES_AU_PLUS} offres du geste valeur`);
}

/** La session `s` où le geste `valeur` `geste` est joué (`jouer`), son écriture, avec son chemin depuis la scène et la
 *  saisie `saisie` qui l'a portée, ajoutée à `out` : sous le seul `discriminant` quand elle choisit une variante qui le
 *  porte. */
function ecrire(s: SessionDEdition, geste: Extract<GesteDEdition, { geste: 'valeur' }>, saisie: string, out: EcritureJouee[], discriminant?: string): SessionDEdition {
  const avant = sceneEditee(s);
  const apres = jouer(s, geste);
  const collection = COLLECTION_DU_PORTEUR[geste.porteur.sorte];
  const porteurs: readonly { id: string }[] = avant[collection] ?? [];
  const rang = porteurs.findIndex((p) => p.id === geste.porteur.id);
  const ecrit = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur
    ? { chemin: [...geste.chemin, discriminant], valeur: geste.valeur[discriminant] }
    : { chemin: geste.chemin, valeur: geste.valeur };
  out.push({ avant, apres: sceneEditee(apres), chemin: [collection, rang, ...ecrit.chemin], valeur: ecrit.valeur, saisie });
  return apres;
}

/** Le choix d'id `id` de l'inspecteur des zones `zones`. */
function choixDeLInspecteur(zones: ZonesDeLEditeur, id: string): Choix {
  const choix = zones['editeur.inspecteur'].find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && e.id === id);
  if (!choix) throw new Error(`aucun choix ${id} dans l’inspecteur`);
  return choix;
}

/** Le geste `valeur` du choix d'id `id` de l'inspecteur de la session `s` dont la valeur satisfait `voulue`. */
function gesteDuChoix(s: SessionDEdition, id: string, voulue: (valeur: unknown) => boolean): Extract<GesteDEdition, { geste: 'valeur' }> {
  const zones = zonesDeLEditeur(s);
  const b = choixDeLInspecteur(zones, id).valeurs.find((v) => 'args' in v.jeu && v.jeu.type === 'valeur' && voulue(v.jeu.args[2]));
  const geste = b && gesteDuJeu(zones, b.jeu);
  if (geste?.geste !== 'valeur') throw new Error(`aucune valeur voulue au choix ${id}`);
  return geste;
}

/** Chaque valeur du choix d'id `id` de l'inspecteur de la session `s`, choisie depuis `s` et notée sous son
 *  discriminant (`ecrire`, comme `jouerLInspecteur`), les
 *  offres de sa seule branche jouées (`jouerLInspecteur`, l'id du choix sans son dernier pas) : chaque branche d'une union
 *  (le `Flow`, #3606 M2b ; l'Effet de sa branche `effet`), dont l'inspecteur ne joue que la première valeur non choisie,
 *  et qui en change en se jouant. */
function jouerLesVariantes(s: SessionDEdition, id: string, out: EcritureJouee[]): void {
  const branche = id.slice(0, id.lastIndexOf('/') + 1);
  const zones = zonesDeLEditeur(s);
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

/** La fiche d'un personnage enrôlé dans une rencontre neuve : son arme simple admet d'autres apparences que sa forme
 *  (`EntityAppearance.apparencesObjets`, #2948). */
const ENROLE = { fiche: 'sergent-du-guet', branches: ['valeur/appearance/ajouter', 'valeur/appearance/apparencesObjets'] } as const;

/** La scène d'un projet du jeu qui déclare un dialogue, et la case libre où s'y pose un personnage de la première des
 *  `FICHES`, qui le choisit (`dialogueId`). */
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

/** L'Effet de ce flux qui porte une adresse de prose, composée (`jouerLInspecteur`) ; puis, l'adresse portée sur le
 *  `CHAPITRE_A_TABLE`, une cellule neuve qui désigne sa table, chacune scellée par l'écriture. */
const PROSE_DU_DECOR = { effet: 'journal', adresse: 'valeur/usable/actions/0/flow/effet/descRef/' } as const;
const estCellule = (v: unknown): boolean => {
  const dernier: unknown = Array.isArray(v) ? v[v.length - 1] : undefined;
  return estObjet(dernier) && dernier.kind === 'cellule';
};

/** La coque pirate de la scène d'embuscade de la barge du sel, à Améliorations d'instance et à postes dotés de leur
 *  coffre (MDG 12), sa case, et les branches de navire qu'elle seule écrit. */
const COQUE = { campagne: 'barge-du-sel', scene: 'barge-du-sel-embuscade', case: { x: 18, y: 7 }, branches: ['valeur/vehicule', 'valeur/upgrades', 'valeur/postes'] } as const;

const point = (x: number, y: number) => ({ case: { x, y }, f: { x, y } });

/** La session `s` où l'outil actif clique la case `(x, y)`. */
const cliquer = (s: SessionDEdition, x: number, y: number): SessionDEdition => jouer(jouer(s, { geste: 'appui', point: point(x, y) }), { geste: 'relache', point: point(x, y) });

/** La session `s` où un personnage de la fiche `fiche` est posé à la case `(x, y)`, à l'outil Personnage. */
const poserPersonnage = (s: SessionDEdition, fiche: string, x: number, y: number): SessionDEdition => cliquer(presser(presser(s, 'outil/personnage'), `personnage/${fiche}`), x, y);

/** Le paquet du projet du jeu d'id `id`. */
function projetDuJeu(id: string): ReturnType<typeof paquetDuJeu> {
  const c = allBuiltinCampaigns.find((x) => x.id === id);
  if (!c) throw new Error(`aucune campagne ${id}`);
  return paquetDuJeu(c);
}

/** Une scène neuve du `PROJET_A_PRESETS`, le manifeste du `Source/` servi. */
const sceneAPresets = (): SessionDEdition => presser(ouvrirLEdition(projetDuJeu(PROJET_A_PRESETS), false, undefined, manifesteDe(CORPUS_DISQUE)), 'scenes/ajouter');

/** Le personnage posé dans la scène `A_DIALOGUE`. */
const personnageDuDialogue = (): SessionDEdition => poserPersonnage(presser(ouvrirLEdition(projetDuJeu(A_DIALOGUE.campagne), false), `scenes/${A_DIALOGUE.scene}`), FICHES[0][0], A_DIALOGUE.case.x, A_DIALOGUE.case.y);

/** La `COQUE`, sélectionnée. */
const coqueChoisie = (): SessionDEdition => cliquer(presser(presser(ouvrirLEdition(projetDuJeu(COQUE.campagne), false), `scenes/${COQUE.scene}`), 'outil/select'), COQUE.case.x, COQUE.case.y);

/** Les écritures jouées sur une zone d'effet neuve, un déclencheur neuf et un personnage de chacune des `FICHES` d'une
 *  scène neuve de la première campagne du jeu, chacun posé à son outil (Zone, Personnage), et un personnage d'`ENROLE`
 *  enrôlé dans une rencontre neuve ; puis sur un personnage de la
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
  let s = presser(ouvrirLEdition(paquetDuJeu(allBuiltinCampaigns[0]), false), 'scenes/ajouter');
  for (const [sorte, de, a] of [['effect', 2, 3], ['trigger', 0, 1]] as const) {
    s = presser(presser(s, 'outil/zone'), `zone/${sorte}`);
    s = jouerLInspecteur(jouer(jouer(s, { geste: 'appui', point: point(de, de) }), { geste: 'relache', point: point(a, a) }), out);
  }
  FICHES.forEach(([fiche, branches], rang) => { s = jouerLInspecteur(poserPersonnage(s, fiche, 5 + rang, 5), out, branches); });
  s = jouerLInspecteur(presser(poserPersonnage(s, ENROLE.fiche, 5 + FICHES.length, 5), 'rencontre/neuve'), out, ENROLE.branches);
  const pnj = jouerLInspecteur(poserPersonnage(sceneAPresets(), FICHES[0][0], 5, 5), out, BRANCHES_DU_PRESET);
  const decor = jouerLInspecteur(cliquer(presser(presser(pnj, 'outil/prop'), `prop/${DECOR}`), 3, 3), out);
  const action = presser(decor, choixDeLInspecteur(zonesDeLEditeur(decor), ACTION_DU_DECOR).valeurs[0].id);
  jouerLInspecteur(action, out);
  jouerLesVariantes(action, FLUX_DU_DECOR, out);
  const effet = jouer(action, gesteDuChoix(action, FLUX_DU_DECOR, (v) => estObjet(v) && v.kind === 'effet'));
  jouerLesVariantes(effet, EFFET_DU_DECOR, out);
  const composee = jouerLInspecteur(jouer(effet, gesteDuChoix(effet, EFFET_DU_DECOR, (v) => estObjet(v) && v.type === PROSE_DU_DECOR.effet)), out, [PROSE_DU_DECOR.adresse]);
  const livre = jouer(composee, gesteDuChoix(composee, `${PROSE_DU_DECOR.adresse}book`, (v) => v === CHAPITRE_A_TABLE.book));
  const adresse = jouer(livre, gesteDuChoix(livre, `${PROSE_DU_DECOR.adresse}ch`, (v) => v === CHAPITRE_A_TABLE.ch));
  const ajout = gesteDuChoix(adresse, `${PROSE_DU_DECOR.adresse}parts/ajouter`, estCellule);
  const rang = (ajout.valeur as unknown[]).length - 1;
  const cellule = ecrire(adresse, ajout, 'saisieChoix', out);
  ecrire(cellule, gesteDuChoix(cellule, `${PROSE_DU_DECOR.adresse}parts/${rang}/table`, () => true), 'saisieChoix', out);
  jouerLInspecteur(personnageDuDialogue(), out, A_DIALOGUE.branches);
  jouerLInspecteur(coqueChoisie(), out, COQUE.branches);
  return out;
}

/** Les écritures de chaque porteur joué à ses branches (`FICHES`, `ENROLE`, `BRANCHES_DU_PRESET`, `A_DIALOGUE`, `COQUE`),
 *  SEUL : posé dans une scène où rien n'est joué avant lui, sa partie à lui. Ce qu'elles créditent, `ecrituresJouees` le
 *  crédite déjà, ou une écriture sautée par empreinte cachait une offre. */
export function ecrituresDesPorteursSeuls(): EcritureJouee[] {
  const arene = presser(ouvrirLEdition(paquetDuJeu(allBuiltinCampaigns[0]), false), 'scenes/ajouter');
  const seuls: [SessionDEdition, readonly string[]][] = [
    ...FICHES.map(([fiche, branches]): [SessionDEdition, readonly string[]] => [poserPersonnage(arene, fiche, 5, 5), branches]),
    [presser(poserPersonnage(arene, ENROLE.fiche, 5, 5), 'rencontre/neuve'), ENROLE.branches],
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
