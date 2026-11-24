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
import { allBuiltinCampaigns } from './scenes/campaign';
import { paquetDuJeu } from './noyau/index';
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
import {
  accesDe,
  cleDeLElement,
  DOCUMENTS,
  FORMULAIRES,
  porteurDeLaSel,
  porteurDuProjet,
  porteursDuProjet,
  type SorteDePorteur,
} from './noyau/sceneEditLecture';
import { formeAuPoint } from './noyau/codex/editFields';
import { boutonDeLEdition, gesteDuFormulaire, inspecteurDeLaSession, zonesDeLEditeur, type ZonesDeLEditeur } from './hote/editeur';
import type { Bouton, Choix, Formulaire, Jeu, Ligne } from './hote/elements';
import { jeuDuFormulaire, marcher, type BancDuFormulaire } from './formulaireJoue.testkit';
import { psychologies } from './data';
import { ENTREES_DE_DOSSIER } from './data/dossiers';
import { ouverts } from './data/schemas/grammaire/descente';
import { auChemin, estObjet } from './lib/objet.mjs';
import { auditerLEditabilite, orphanFields, programmeDuPerimetre, RACINES, type EcritureJouee } from '../scripts/guards/lib/editabiliteDesChamps.mjs';
import { detenteur } from './lib/detenteur.testkit';
import { ecrituresDesOutilsDeScene } from './ecrituresDesOutilsDeScene.testkit';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vitest.config.ts`
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

/** Les zones d'une session réduites à son inspecteur (`inspecteurDeLaSession`), seul lu par le jeu de ses offres. */
type Inspecteur = Pick<ZonesDeLEditeur, 'editeur.inspecteur'>;
const inspecteur = (s: SessionDEdition, retraitDuPorteurLogique = true): Inspecteur =>
  ({ 'editeur.inspecteur': inspecteurDeLaSession(s, { retraitDuPorteurLogique }) });

/** Les offres d'une session du banc, dont la lecture ne change pas entre deux gestes. */
const inspecteursDesSessions = new WeakMap<SessionDEdition, Inspecteur>();

/** Les boutons des zones `zones` : chaque bouton, et chaque valeur d'un choix ou d'une liste. */
const boutonsDesZones = (zones: ZonesDeLEditeur) =>
  Object.values(zones).flat().flatMap((e: Choix | Ligne | Bouton | Formulaire) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : []));

/** La session `s` où joue le bouton d'id `id` de ses zones. */
function presser(s: SessionDEdition, id: string): SessionDEdition {
  const zones = zonesDeLEditeur(s);
  const b = boutonsDesZones(zones).find((v) => v.id === id);
  const geste = b && gesteDuJeu(zones, s, b.jeu);
  if (!geste) throw new Error(`aucun bouton ${id} dans les zones de l’éditeur`);
  return jouer(s, geste);
}

/** Le porteur de formulaire que désigne la sélection de la session `s`, sans elle le singulier du document ouvert (`porteurDeLaSel`). */
const porteurChoisi = (s: SessionDEdition) => porteurDeLaSel(s.sel, s.document, idDeLaSceneEditee(s));

/** Le document de la session `s` où vit un porteur de sorte `sorte` (`DOCUMENTS`, `accesDe`). */
const documentDu = (s: SessionDEdition, sorte: SorteDePorteur): unknown => DOCUMENTS[accesDe(sorte).document].lire(projetEdite(s), idDeLaSceneEditee(s));

/** Le porteur `porteur` de la session `s` (`porteurDuProjet`) : sa donnée et son chemin depuis son document. */
const porteurDu = (s: SessionDEdition, porteur: { sorte: SorteDePorteur; id: string }) => porteurDuProjet(accesDe(porteur.sorte), projetEdite(s), idDeLaSceneEditee(s), porteur.id);

/** Les porteurs de sorte `sorte` de la session `s` (`porteursDuProjet`). */
const porteursDe = (s: SessionDEdition, sorte: SorteDePorteur): readonly unknown[] => porteursDuProjet(accesDe(sorte), projetEdite(s), idDeLaSceneEditee(s));

/** Le porteur qu'écrit le jeu `jeu` d'un formulaire tiré du schéma : celui de son geste d'édition, ou le premier
 *  argument de son verbe `valeur` ; `undefined` d'un autre jeu. */
const porteurDuJeu = (jeu: Jeu): { sorte: SorteDePorteur; id: string } | undefined => {
  const porteur = 'edition' in jeu && 'porteur' in jeu.edition ? jeu.edition.porteur : 'args' in jeu && jeu.type === 'valeur' ? jeu.args[0] : undefined;
  return estObjet(porteur) && typeof porteur.sorte === 'string' && porteur.sorte in FORMULAIRES && typeof porteur.id === 'string' ? (porteur as { sorte: SorteDePorteur; id: string }) : undefined;
};

/** Le BANC de l'éditeur de scène (`BancDuFormulaire`) : l'inspecteur de la session (`inspecteur`), un jeu reçu en JSON
 *  validé par `boutonDeLEdition` ou `gesteDuFormulaire`, joué par `editer` (`jouer`) ; le porteur d'un geste `valeur`
 *  nommé par sa sorte, lu dans son document (`porteurDu`, `documentDu`) ; le schéma du porteur du jeu d'une offre
 *  (`porteurDuJeu`), celui de son formulaire (`FORMULAIRES`), et sa donnée. */
const BANC: BancDuFormulaire<SessionDEdition, Inspecteur & Partial<ZonesDeLEditeur>, GesteDEdition> = {
  zones: (s) => inspecteursDesSessions.get(s) ?? inspecteursDesSessions.set(s, inspecteur(s, s.document !== 'narratif')).get(s)!,
  elements: (z) => z['editeur.inspecteur'],
  deballe: (jeu) => ('edition' in jeu ? jeu.edition : undefined),
  geste: (zones, _s, recu) => ('edition' in recu ? (boutonDeLEdition(zones, recu.edition) ? recu.edition : undefined) : gesteDuFormulaire(zones, recu)),
  jouer,
  porteur: (s, g) => {
    const p = porteurDu(s, g.porteur);
    return p && { cle: g.porteur.sorte, ...p, noeud: FORMULAIRES[g.porteur.sorte].schema };
  },
  document: (s, g) => documentDu(s, g.porteur.sorte),
  schema: (s, jeu) => {
    const porteur = porteurDuJeu(jeu);
    const p = porteur && porteurDu(s, porteur);
    return p && { noeud: FORMULAIRES[porteur.sorte].schema, donnee: p.donnee };
  },
  explorerLesUnions: () => true,
};
const { jouerLInspecteur, ecrire, jouerLesVariantes, choix: choixDeLInspecteur, gesteDuJeu, gesteDuChoix, composerLAdresse } = jeuDuFormulaire(BANC);

/** La branche et la clé de collection qu'emploie le formulaire pour cette donnée. */
function avecModele(racine: keyof typeof RACINES, ecritures: EcritureJouee[]): EcritureJouee[] {
  const schema = DOCUMENTS[racine].schema;
  const points = new WeakMap<object, Map<string, { noeud: unknown; valeur: unknown }>>();
  function auPoint(document: unknown, chemin: readonly Segment[]) {
    if (!estObjet(document)) return undefined;
    const chemins = points.get(document) ?? new Map<string, { noeud: unknown; valeur: unknown }>();
    const cle = JSON.stringify(chemin);
    const lu = chemins.get(cle);
    if (lu) return lu;
    const point = { noeud: marcher(schema, document, chemin)?.noeud, valeur: auChemin(document, chemin) };
    chemins.set(cle, point);
    points.set(document, chemins);
    return point;
  }
  const modele: NonNullable<EcritureJouee['modele']> = {
    cleDeListe(document, chemin, element) {
      const point = auPoint(document, chemin);
      for (const n of ouverts([point?.noeud], point?.valeur)) {
        const cle = cleDeLElement(n, element);
        if (cle !== undefined) return cle;
      }
      return undefined;
    },
    forme(document, chemin) {
      const point = auPoint(document, chemin);
      return formeAuPoint(point?.noeud, point?.valeur)?.noeud;
    },
  };
  return ecritures.map((ecriture) => ({ ...ecriture, modele }));
}

/** La session `suite`, tirée de `s` par un outil ou un bouton qui crée un porteur de sorte `sorte`, sélectionné ;
 *  l'écriture de sa collection entière, avec son chemin depuis son document, s'ajoute à `out`. */
function cree(s: SessionDEdition, suite: SessionDEdition, sorte: SorteDePorteur, out: EcritureJouee[]): SessionDEdition {
  const porteur = porteurChoisi(suite);
  const neuf = porteur?.sorte === sorte ? porteurDu(suite, porteur) : undefined;
  if (!neuf) throw new Error(`aucun porteur ${sorte} créé`);
  out.push({
    avant: documentDu(s, sorte), apres: documentDu(suite, sorte), chemin: neuf.chemin.slice(0, -1),
    valeur: porteursDe(suite, sorte), saisie: 'bouton', mouvement: { geste: 'inserer', chemin: neuf.chemin },
  });
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
    return { donnee: auChemin(acc.donnee, sous), chemin: [...acc.chemin, ...sous] };
  }, { donnee, chemin: [] }).chemin;
  out.push({
    avant: documentDu(s, porteur.sorte), apres: documentDu(suite, porteur.sorte), chemin: [...chemin, ...element, 'id'],
    valeur: vers, saisie: 'saisieTexte', renommage: { avant: geste.element ?? porteur.id, apres: vers },
  });
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
  out.push({
    avant: documentDu(s, porteur.sorte), apres: documentDu(suite, porteur.sorte), chemin: [...avant.chemin, cle],
    valeur: nom, saisie: saisie.type, renommage: { avant: porteur.id, apres: nom },
  });
  return suite;
}

/** Les ids des formulaires de l'inspecteur de la session `s` qui changent un identifiant. */
const formulairesDIdentifiant = (s: SessionDEdition): string[] => inspecteur(s)['editeur.inspecteur'].filter((e) => e.type === 'formulaire' && e.verbe === 'identifier').map((e) => e.id);

/** La session `s` où chaque élément qu'un formulaire de son inspecteur renomme (`formulairesDIdentifiant`) est renommé
 *  (`identifier`) en son identifiant suffixé de `-joue`, du dernier au premier : l'élément qu'un parent adresse (la
 *  réponse, dans son nœud) se renomme avant lui. */
const identifierChaque = (s: SessionDEdition, out: EcritureJouee[]): SessionDEdition =>
  formulairesDIdentifiant(s).reverse().reduce((x, id) => identifier(x, id, `${id.slice(id.lastIndexOf('/') + 1)}-joue`, out), s);

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

/** L'Effet de ce flux qui porte une adresse de prose, composée (`composerLAdresse`). */
const PROSE_DU_DECOR = { effet: 'journal', adresse: 'valeur/usable/actions/0/flow/effet/descRef/' } as const;
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

/** L'ancre de la caraque à un cap qui tient dans la scène neuve de 20 × 15 cases. */
const NAVIRE_NEUF = { x: 8, y: 6 } as const;

/** La session `s` où l'outil navire pose un navire à la case `(x, y)`, sélectionné ; l'écriture de son entité, à son
 *  rang parmi les entités de la scène, s'ajoute à `out`. */
function poserUnNavire(s: SessionDEdition, x: number, y: number, out: EcritureJouee[]): SessionDEdition {
  const avant = sceneEditee(s);
  const outil = presser(presser(s, 'outil/navire'), 'navire/cap/E');
  const suite = jouer(outil, { geste: 'appui', point: point(x, y) });
  const porteur = porteurChoisi(suite);
  const apres = sceneEditee(suite);
  const rang = apres.entities.findIndex((e) => e.id === porteur?.id);
  if (porteur?.sorte !== 'entite' || rang < 0 || avant.entities.some((e) => e.id === porteur.id)) throw new Error('l’outil navire n’a pas posé de navire');
  out.push({ avant, apres, chemin: ['entities', rang], valeur: apres.entities[rang], saisie: 'bouton' });
  return suite;
}

/** La zone jouable que l'outil Zone trace dans la scène de la session `s`, de la case `(1, 1)` à la case `(2, 2)` ; son
 *  écriture, au chemin `zoneJouable` de la scène, s'ajoute à `out` (#4392). */
function tracerLaZoneJouable(s: SessionDEdition, out: EcritureJouee[]): void {
  const outil = presser(presser(s, 'outil/zone'), 'zone/jouable');
  const tracee = jouer(jouer(outil, { geste: 'appui', point: point(1, 1) }), { geste: 'relache', point: point(2, 2) });
  out.push({ avant: documentDu(s, 'scene'), apres: documentDu(tracee, 'scene'), chemin: ['zoneJouable'], valeur: sceneEditee(tracee).zoneJouable, saisie: 'bouton' });
}

/** Les écritures jouées sur l'inspecteur d'une scène neuve de la première campagne du jeu sans sélection, puis sur une zone d'effet neuve qui barre le passage, un déclencheur neuf (`ZONES`), la zone jouable tracée (`tracerLaZoneJouable`) et un personnage de chacune des `FICHES` d'une
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
  out.push(...ecrituresDesOutilsDeScene(s, { presser, cliquer, poserUnNavire }));
  jouerLInspecteur(s, out);
  for (const [sorte, de, a, boutons] of ZONES) {
    s = presser(presser(s, 'outil/zone'), `zone/${sorte}`);
    const zone = boutons.reduce(presser, jouer(jouer(s, { geste: 'appui', point: point(de, de) }), { geste: 'relache', point: point(a, a) }));
    if (sorte === 'effect') out.push(...jouerLesChargesEnContexte(zone, 'valeur/onCross/'));
    s = jouerLInspecteur(zone, out);
  }
  tracerLaZoneJouable(s, out);
  FICHES.forEach(([fiche, branches], rang) => { s = jouerLInspecteur(poserPersonnage(s, fiche, 5 + rang, 5), out, branches); });
  const dialogue = jouerLInspecteur(ajouter(s, 'dialogue', out), out);
  const avecUnNoeudDePlus = presser(dialogue, premierBouton(dialogue, 'valeur/nodes/ajouter'));
  const dialogueEdite = sceneEditee(avecUnNoeudDePlus).dialogues?.find((d) => d.id === selectionne(avecUnNoeudDePlus));
  ecrire(avecUnNoeudDePlus, gesteDuChoix(avecUnNoeudDePlus, 'valeur/start/id', (v) => v !== dialogueEdite?.start.id), 'saisieChoix', out);
  const repondu = choixDe(dialogue, REPONSE_AJOUTEE).reduce((x, id) => presser(x, choixDeLInspecteur(x, id).valeurs[0].id), dialogue);
  s = renommer(identifierChaque(repondu, out), out, DIALOGUE_RENOMME);
  s = ajouter(s, 'rencontre', out);
  const rencontre = selectionne(s);
  s = jouerLInspecteur(enroler(s, rencontre, ENROLE.fiche, 5 + FICHES.length, 5), out, ENROLE.branches);
  s = enroler(s, rencontre, FICHES[0][0], 6 + FICHES.length, 5);
  s = jouerLInspecteur(presser(s, `logique/rencontre/${rencontre}`), out);
  jouerLInspecteur(jouer(s, gesteDuChoix(s, MONTURE, (v) => v === true)), out, [CHEVAUCHEE]);
  jouerLesVariantes(s, VICTOIRE, out);
  const navire = poserUnNavire(s, NAVIRE_NEUF.x, NAVIRE_NEUF.y, out);
  const coqueAlliee = presser(presser(navire, `rencontre/${rencontre}/enrole`), `rencontre/${rencontre}/allie`);
  jouerLInspecteur(presser(coqueAlliee, `logique/rencontre/${rencontre}`), out, ['valeur/members/']);
  const pnj = jouerLInspecteur(poserPersonnage(sceneAPresets(), FICHES[0][0], 5, 5), out, BRANCHES_DU_PRESET);
  const decor = jouerLInspecteur(cliquer(presser(presser(pnj, 'outil/prop'), `prop/${DECOR}`), 3, 3), out);
  const action = presser(decor, choixDeLInspecteur(decor, ACTION_DU_DECOR).valeurs[0].id);
  jouerLInspecteur(action, out);
  identifier(action, inspecteur(action)['editeur.inspecteur'].find((e) => e.id.startsWith(ACTION_RENOMMEE.famille))!.id, ACTION_RENOMMEE.vers, out);
  jouerLesVariantes(action, FLUX_DU_DECOR, out);
  const effet = jouer(action, gesteDuChoix(action, FLUX_DU_DECOR, (v) => estObjet(v) && v.kind === 'effet'));
  jouerLesVariantes(effet, EFFET_DU_DECOR, out);
  composerLAdresse(jouerLInspecteur(jouer(effet, gesteDuChoix(effet, EFFET_DU_DECOR, (v) => estObjet(v) && v.type === PROSE_DU_DECOR.effet)), out, [PROSE_DU_DECOR.adresse]), PROSE_DU_DECOR.adresse, out);
  out.push(...ecrituresDesReferencesDeScene());
  jouerLInspecteur(personnageDuDialogue(), out, A_DIALOGUE.branches);
  jouerLInspecteur(coqueChoisie(), out, COQUE.branches);
  return avecModele('scene', out);
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
  return avecModele('scene', seuls.flatMap(([s, branches]) => {
    const out: EcritureJouee[] = [];
    jouerLInspecteur(s, out, branches);
    return out;
  }));
}

/** La session `s` où le bouton d'id `id` est pressé ; l'écriture du champ `champ` du porteur sélectionné, relu après,
 *  s'ajoute à `out`. */
function consigner(s: SessionDEdition, id: string, champ: Segment[], out: EcritureJouee[], variante?: string): SessionDEdition {
  const porteur = porteurChoisi(s)!;
  const suite = presser(s, id);
  const apres = porteurDu(suite, porteur)!;
  const valeur = auChemin(apres.donnee, champ);
  out.push({ avant: documentDu(s, porteur.sorte), apres: documentDu(suite, porteur.sorte), chemin: [...apres.chemin, ...champ], valeur, saisie: 'bouton', ...(variante ? { variante } : {}) });
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

/** Les références que l'inspecteur d'une scène ne peut offrir qu'en présence de leurs cibles dans le projet. */
function ecrituresDesReferencesDeScene(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  const etatHeros = presser(ajouter(narratifMisEnPlace(), 'etats', []), 'etat/forme/heros');
  const scene = presser(presser(etatHeros, 'document/scene'), 'scenes/ajouter');
  const personnage = poserPersonnage(scene, FICHES[0][0], 5, 5);
  const dialogue = ajouter(personnage, 'dialogue', []);
  const rencontres = ajouter(ajouter(dialogue, 'rencontre', []), 'rencontre', []);

  const decor = cliquer(presser(presser(rencontres, 'outil/prop'), `prop/${DECOR}`), 3, 3);
  const action = presser(decor, choixDeLInspecteur(decor, ACTION_DU_DECOR).valeurs[0].id);
  const flow = jouer(action, gesteDuChoix(action, FLUX_DU_DECOR, (v) => estObjet(v) && v.kind === 'effet'));
  const sousEffet = EFFET_DU_DECOR.slice(0, -'type'.length);
  const references = [
    ['poserEtat', ['etat', 'valeur']],
    ['designerHeros', ['etat']],
    ['startMassBattle', ['battle/sceneEncounters']],
    ['startDialogue', ['dialogue/id', 'speakerId']],
    ['revealClue', ['indiceId', 'stade']],
    ['discreditClue', ['indiceId']],
    ['startPursuit', ['encounter']],
  ] as const;
  for (const [type, chemins] of references) {
    const effet = jouer(flow, gesteDuChoix(flow, EFFET_DU_DECOR, (v) => estObjet(v) && v.type === type));
    jouerLInspecteur(effet, out, chemins.map((c) => sousEffet + c));
  }

  const outil = presser(presser(rencontres, 'outil/zone'), 'zone/effect');
  const zone = jouer(jouer(outil, { geste: 'appui', point: point(2, 2) }), { geste: 'relache', point: point(3, 3) });
  const avecOp = jouerLInspecteur(zone, out, ['valeur/onCross/ajouter']);
  const avecEtat = jouer(avecOp, gesteDuChoix(avecOp, 'valeur/onCross/0/op', (v) => estObjet(v) && v.op === 'condition'));
  const condition = 'valeur/onCross/0/lockedUntil/';
  const verrou = (kind: string) => jouer(avecEtat, gesteDuChoix(avecEtat, `${condition}kind`, (v) => estObjet(v) && v.kind === kind));
  jouerLInspecteur(verrou('etat'), out, [`${condition}etat`, `${condition}value`]);
  const herosMort = verrou('partyDead');
  const qui = gesteDuChoix(herosMort, `${condition}who/forme`, (v) => estObjet(v) && 'etat' in v);
  jouerLInspecteur(jouer(herosMort, qui), out, [`${condition}who/etat`]);
  return out;
}

/** Une clôture dont la condition lit la valeur d'un état énuméré réellement présent au narratif. */
function ecrituresDeLaCloture(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  const narratif = presser(presser(narratifMisEnPlace(), 'document/scene'), 'document/narratif');
  const cloture = jouerLInspecteur(narratif, out, ['valeur/cloture/ajouter']);
  const when = 'valeur/cloture/when/';
  const condition = gesteDuChoix(cloture, `${when}kind`, (v) => estObjet(v) && v.kind === 'etat');
  jouerLInspecteur(jouer(cloture, condition), out, [`${when}etat`, `${when}value`]);
  return out;
}

/** La péripétie ajoutée à une route, et le préfixe d'id de son premier Effet. */
const PERIL = { ajouter: 'valeur/perils/ajouter/', effets: 'valeur/perils/0/effects/ajouter', effet: 'valeur/perils/0/effects/0/' } as const;

/** Des écritures qui exigent un porteur déjà renseigné ou deux branches incompatibles de son formulaire. */
function jouerLesChargesEnContexte(s: SessionDEdition, ops: string): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  const op = `${ops}0/`;
  const avecOp = presser(s, premierBouton(s, `${ops}ajouter`));
  const choisir = (nom: string) => jouer(avecOp, gesteDuChoix(avecOp, `${op}op`, (v) => estObjet(v) && v.op === nom));

  const psy = choisir('beginPsych');
  const typesACible = new Set<string>(psychologies.filter((p) => p.cibles?.includes('groupe')).map((p) => p.id));
  const typePsy = gesteDuChoix(psy, `${op}type/id`, (v) => typeof v === 'string' && typesACible.has(v));
  jouerLInspecteur(jouer(psy, typePsy), out, [`${op}cible`]);

  const combat = choisir('combatEnMer');
  const adversaire = gesteDuChoix(combat, `${op}adversaire/id`, (v) => typeof v === 'string' && v !== '');
  jouerLInspecteur(ecrire(combat, adversaire, 'saisieChoix', out), out, [`${op}adversaire`]);

  const avecTexte = jouerLInspecteur(choisir('narrative'), out, [`${op}text`]);
  jouerLInspecteur(avecTexte, out, [`${op}adapteDe`]);

  const entrees = `${op}entries/`;
  const table = jouerLInspecteur(choisir('rollTable'), out, [`${entrees}ajouter`]);
  jouerLInspecteur(table, out, ['min', 'max', 'ops/ajouter'].map((champ) => `${entrees}0/${champ}`));

  const auToucher = `${op}onHitEffects/`;
  const arme = jouerLInspecteur(choisir('augmentWeapon'), out, [`${auToucher}ajouter`]);
  const effetDArme = `${auToucher}0/`;
  jouerLInspecteur(arme, out, ['trigger', 'on/', 'condition', 'attackType', 'coupCritique', 'optional'].map((champ) => effetDArme + champ));
  const flux = ecrire(arme, gesteDuChoix(arme, `${effetDArme}flow/kind`, (v) => estObjet(v) && v.kind === 'effet'), 'saisieChoix', out, 'kind');
  return [...out, ...ecrituresDeLaFeuilleDOperations(flux, `${effetDArme}flow/effet/`)];
}

/** La cible de chaque branche et les deux formes d'échéance d'une feuille d'opérations déjà ouverte. */
function ecrituresDeLaFeuilleDOperations(flux: SessionDEdition, charge: string): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  // L'échéance absolue et la durée sont exclusives. Chacune part de la même feuille sans échéance.
  for (const champ of ['heroId', 'label', 'untilTime', 'pendantJours']) jouerLInspecteur(flux, out, [charge + champ]);
  for (const champ of ['role', 'volontaires']) {
    const cible = gesteDuChoix(flux, `${charge}on/forme`, (v) => estObjet(v) && champ in v);
    jouerLInspecteur(ecrire(flux, cible, 'saisieChoix', out), out, [`${charge}on/${champ}`]);
  }
  return out;
}

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
  const lieuNeuf = cree(s, cliquer(presser(s, 'outil/lieu'), 85, 15), 'lieu', out);
  ecrire(lieuNeuf, gesteDuChoix(lieuNeuf, 'valeur/port/ajouter', (v) => estObjet(v) && typeof v.ref === 'string'), 'saisieChoix', out, 'ref');
  const relireLieu = (session: SessionDEdition) =>
    projetEdite(session).worldMap!.places.find((lieu) => lieu.id === selectionne(lieuNeuf))!;
  const choisirAmarrage = (session: SessionDEdition, valeur: 'simple' | 'cale-seche') =>
    ecrire(session, gesteDuChoix(session, 'valeur/amarrage', (v) => v === valeur), 'saisieChoix', out);
  const amarrage = choisirAmarrage(lieuNeuf, 'simple');
  expect(relireLieu(amarrage).amarrage).toBe('simple');
  const cale = choisirAmarrage(amarrage, 'cale-seche');
  const caleEditee = jouerLInspecteur(cale, out, ['valeur/constructeurDeBateaux', 'valeur/materiauxCaleSeche']);
  expect(relireLieu(caleEditee)).toMatchObject({ amarrage: 'cale-seche', constructeurDeBateaux: expect.any(Number), materiauxCaleSeche: expect.any(Boolean) });
  const sansCale = relireLieu(choisirAmarrage(caleEditee, 'simple'));
  expect(sansCale.amarrage).toBe('simple');
  expect(sansCale.constructeurDeBateaux).toBeUndefined();
  expect(sansCale.materiauxCaleSeche).toBeUndefined();
  const sansAmarrage = relireLieu(presser(caleEditee, 'valeur/amarrage/aucune'));
  expect(sansAmarrage.amarrage).toBeUndefined();
  expect(sansAmarrage.constructeurDeBateaux).toBeUndefined();
  expect(sansAmarrage.materiauxCaleSeche).toBeUndefined();
  s = jouerLInspecteur(lieuNeuf, out);
  const neuf = selectionne(s);
  s = jouerLInspecteur(ajouter(presser(s, 'outil/select'), 'lieu', out), out);
  s = presser(presser(s, `logique/lieu/${neuf}`), 'lieu/plan');
  const sansPoi = s;
  s = jouer(jouer(presser(s, 'outil/epingler'), { geste: 'appui', point: point(30, 40) }), { geste: 'relache', point: point(30, 40) });
  const lieu = porteurDu(s, { sorte: 'lieu', id: neuf })!;
  out.push({ avant: documentDu(sansPoi, 'lieu'), apres: documentDu(s, 'lieu'), chemin: [...lieu.chemin, 'poi'], valeur: (lieu.donnee as { poi?: unknown }).poi, saisie: 'bouton' });
  s = consigner(consigner(s, 'lieu/etablissement/ajouter/auberge', ['services'], out), 'lieu/etablissement/ajouter/auberge', ['services'], out);
  s = consigner(consigner(s, 'lieu/poi/cible/service/auberge', ['poi'], out), 'lieu/etablissement/auberge-2/retirer', ['services'], out);
  s = consigner(consigner(s, 'lieu/etablissement/auberge/offre/repas/retirer', ['services'], out), 'lieu/etablissement/auberge/offre/ajouter/repas', ['services'], out);
  const avecRefus = jouerLInspecteur(s, out, ['valeur/services/0/refus']);
  const restreint = ecrire(avecRefus, gesteDuChoix(avecRefus, 'valeur/services/0/when/kind', (v) => estObjet(v) && v.kind === 'always'), 'saisieChoix', out, 'kind');
  const refusSousCondition: EcritureJouee[] = [];
  jouerLInspecteur(restreint, refusSousCondition, ['valeur/services/0/refus']);
  out.push(...refusSousCondition);
  s = presser(jouerLInspecteur(presser(presser(s, 'outil/select'), `logique/lieu/${neuf}`), out), 'lieu/plan');
  const tiree = jouer(jouer(jouer(presser(s, 'outil/chemin'), { geste: 'appui', point: point(depart.pos.x, depart.pos.y) }), { geste: 'glisse', point: point(70, 20) }), { geste: 'relache', point: point(85, 15) });
  s = cree(s, tiree, 'route', out);
  s = ecrire(s, gesteDuChoix(s, 'valeur/modes/ajouter', (v) => v === 'diligence'), 'saisieChoix', out);
  jouerLInspecteur(s, out, ['valeur/modes/1/monter']);
  const peril = presser(s, premierBouton(s, PERIL.ajouter));
  const effet = presser(peril, premierBouton(peril, PERIL.effets));
  const souffle = jouer(effet, gesteDuChoix(effet, `${PERIL.effet}type`, (v) => estObjet(v) && v.type === 'zoneBlast'));
  jouerLInspecteur(souffle, out, [`${PERIL.effet}ops/`]);
  out.push(...jouerLesChargesEnContexte(souffle, `${PERIL.effet}ops/`));
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
  return avecModele('carte', out);
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

/** Le bouton qui ajoute un repère à l'identité d'un état, et le préfixe des boutons qui lui ajoutent une ligne. */
const REPERE_AJOUTE = 'valeur/forme/identite/reperes/ajouter';
const LIGNE_AJOUTEE = 'valeur/forme/identite/lignes/ajouter/';

/** Le nombre de lignes de l'identité du porteur sélectionné de la session `s`, aucune hors d'un état à identité. */
const lignesDeLIdentite = (s: SessionDEdition): number => {
  const porteur = porteurChoisi(s);
  const donnee = porteur && (porteurDu(s, porteur)?.donnee as { forme?: { identite?: { lignes: unknown[] } } } | undefined);
  return donnee?.forme?.identite?.lignes.length ?? 0;
};

/** La session `s` où l'identité de l'état sélectionné, dont le jeu de son inspecteur a retiré chaque ligne, en porte de
 *  nouveau une (`LIGNE_AJOUTEE`) : ses repères renommés et ajoutés réécrivent alors ses valeurs ; `s` sans elle. */
const avecUneLigne = (s: SessionDEdition): SessionDEdition =>
  lignesDeLIdentite(s) || !boutonsDe(s, LIGNE_AJOUTEE).length ? s : presser(s, premierBouton(s, LIGNE_AJOUTEE));

/** La session où un repère s'ajoute à l'identité. Le geste d'ajout couvre les valeurs de la ligne déjà portée. */
function repereSurLesLignes(s: SessionDEdition, out: EcritureJouee[]): SessionDEdition {
  const avecLigne = avecUneLigne(s);
  if (!lignesDeLIdentite(avecLigne)) throw new Error('l’identité de l’état ne porte aucune ligne où le repère neuf pose sa valeur');
  jouerLInspecteur(avecLigne, out, ['valeur/forme/identite/lignes/0/espece', 'valeur/forme/identite/lignes/0/sexe']);
  return consigner(avecLigne, REPERE_AJOUTE, ['forme', 'identite', 'lignes', 0, 'valeurs'], out);
}

/** Les écritures du narratif de la première campagne du jeu : chacun des `REGISTRES` ajouté à la zone Logique, joué à
 *  son inspecteur, une ligne d'identité reposée (`avecUneLigne`), chaque élément renommé (`identifierChaque`), puis lui-même (`renommer`) ; un indice d'une seconde affaire ; chaque forme de dotation d'un PNJ ; chaque forme d'état, sur
 *  l'identité d'un état à lignes, un repère ajouté (`repereSurLesLignes`) ; un
 *  second indice qui renvoie au premier ; un PNJ d'une créature de base armée (`ENROLE`), l'apparence de ses objets ;
 *  un objet et un écart de fiche, chacun renommé (`renommer`) ; les `UNIONS_DU_PNJ` et `UNIONS_DE_L_OBJET`, l'arme dérivée d'un objet et l'adresse de
 *  prose de sa description (`composerLAdresse`) ; puis le narratif singulier. Chacun joué à son inspecteur. */
export function ecrituresDuNarratif(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  let s = presser(premierProjet(), 'document/narratif');
  for (const registre of REGISTRES) {
    s = renommer(identifierChaque(avecUneLigne(jouerLInspecteur(ajouter(s, registre, out), out)), out), out, `${registre}-joue`);
  }
  jouerLInspecteur(ajouter(ajouter(s, 'affaires', []), 'indices', out), out, ['valeur/affaireId']);
  const avecProfil = presser(presser(s, `logique/presetsPnj/${(porteursDe(s, 'presetsPnj')[0] as { id: string }).id}`), 'valeur/profil/trappings/ajouter');
  for (const id of choixDe(avecProfil, /^valeur\/profil\/trappings\/\d+\/forme$/)) jouerLesVariantes(avecProfil, id, out);
  const enumere = consigner(ajouter(s, 'etats', out), 'etat/forme/enum', ['forme'], out, 'kind');
  const heros = consigner(enumere, 'etat/forme/heros', ['forme'], out, 'kind');
  const avecIdentite = jouerLInspecteur(heros, out, ['valeur/forme/identite/ajouter']);
  s = repereSurLesLignes(jouerLInspecteur(avecIdentite, out), out);
  jouerLInspecteur(enumere, out);
  s = jouerLInspecteur(ajouter(s, 'indices', out), out, ['valeur/refs']);
  const pnj = ajouter(s, 'presetsPnj', out);
  s = jouerLInspecteur(ecrire(pnj, gesteDuChoix(pnj, 'valeur/base/id', (v) => v === ENROLE.fiche), 'saisieChoix', out), out, ['valeur/apparence', 'valeur/profil']);
  for (const id of choixDe(s, /^valeur\/profil\/trappings\/\d+\/forme$/)) jouerLesVariantes(s, id, out);
  s = renommer(jouerLInspecteur(ajouter(s, 'objets', out), out), out, 'objets-joue');
  s = renommer(jouerLInspecteur(cree(s, presser(s, premierBouton(s, 'logique/ecart/ajouter/')), 'ecart', out), out), out);
  for (const { boutons, choix } of UNIONS_DU_PNJ) jouerLesVariantes(boutons.reduce(presser, ajouter(s, 'presetsPnj', out)), choix, out);
  const objet = ajouter(s, 'objets', out);
  for (const { boutons, choix } of UNIONS_DE_L_OBJET) jouerLesVariantes((boutons as readonly string[]).reduce(presser, objet), choix, out);
  const auToucher = presser(objet, 'valeur/onHitEffects/ajouter');
  const flux = jouer(auToucher, gesteDuChoix(auToucher, 'valeur/onHitEffects/0/flow/kind', (v) => estObjet(v) && v.kind === 'effet'));
  out.push(...ecrituresDeLaFeuilleDOperations(flux, 'valeur/onHitEffects/0/flow/effet/'));
  out.push(...jouerLesChargesEnContexte(flux, 'valeur/onHitEffects/0/flow/effet/ops/'));
  jouerLInspecteur(presser(objet, 'valeur/derivedWeapon/ajouter'), out, ['valeur/derivedWeapon/']);
  composerLAdresse(jouerLInspecteur(objet, out, ['valeur/descRef/']), 'valeur/descRef/', out);
  jouerLInspecteur(presser(presser(s, 'document/scene'), 'document/narratif'), out);
  out.push(...ecrituresDeLaCloture());
  return avecModele('narratif', out);
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
