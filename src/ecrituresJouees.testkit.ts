/**
 * L'ALLER-RETOUR DE L'ÉDITEUR GODOT (#3606, garde #841) : les écritures que le formulaire tiré du schéma offre à
 * l'inspecteur d'une zone d'effet, d'un déclencheur, d'un personnage et d'une coque, jouées comme la méthode `editer` du pont les joue
 * (`hotes/godot/pont/pont.ts`) : le jeu d'un élément des zones passé en JSON, validé par `gesteDuFormulaire` ou
 * `boutonDeLEdition`, puis joué par `editer` sur la session d'édition ; le document relu avant et après. Partagé par la garde (`src/scene-field-editability-guard.test.ts`) et par la copie de
 * mesure de #841 ; la garde décide de ce qu'une écriture crédite (`ecritureCreditee`).
 */
import { allBuiltinCampaigns, paquetDuJeu } from './scenes/campaign';
import { editer, ouvrirLEdition, sceneEditee, type GesteDEdition, type Scene, type Segment, type SessionDEdition } from './noyau/index';
import type { SorteDePorteur } from './noyau/sceneEditLecture';
import { boutonDeLEdition, gesteDuFormulaire, zonesDeLEditeur } from './hote/editeur';
import type { Bouton, Choix, Formulaire, Jeu, Ligne } from './hote/elements';
import { estObjet } from './lib/objet.mjs';

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

/** Le geste d'édition que joue le jeu `jeu` des zones de la session `s`, passé en JSON comme le pont le reçoit ;
 *  `undefined` si les zones ne l'offrent pas. */
function gesteDuJeu(s: SessionDEdition, jeu: Jeu): GesteDEdition | undefined {
  const recu = JSON.parse(JSON.stringify(jeu)) as Record<string, unknown>;
  const zones = zonesDeLEditeur(s);
  if ('edition' in recu) return boutonDeLEdition(zones, recu.edition) ? (recu.edition as GesteDEdition) : undefined;
  return gesteDuFormulaire(zones, recu);
}

/** La session `s` où joue le bouton d'id `id` de ses zones. */
function presser(s: SessionDEdition, id: string): SessionDEdition {
  const b = Object.values(zonesDeLEditeur(s)).flat().flatMap((e: Choix | Ligne | Bouton | Formulaire) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : [])).find((v) => v.id === id);
  const geste = b && gesteDuJeu(s, b.jeu);
  if (!geste) throw new Error(`aucun bouton ${id} dans les zones de l’éditeur`);
  return editer(s, geste);
}

/** Les collections de la scène où vit le porteur de chaque sorte du geste `valeur`. */
const COLLECTION_DU_PORTEUR = { zone: 'effectZones', declencheur: 'triggers', entite: 'entities' } as const satisfies Record<SorteDePorteur, keyof Scene>;

/** La session `s` où chaque offre du geste `valeur` de son inspecteur est jouée une fois, celles qui emportent des champs
 *  après les autres, jusqu'à ce qu'aucune ne reste ; chaque écriture, avec son chemin depuis la scène, s'ajoute à
 *  `out` : le choix d'une variante écrit son discriminant (l'id de son choix, `valeur/<chemin>/<discriminant>`). */
function jouerLInspecteur(depart: SessionDEdition, out: EcritureJouee[]): SessionDEdition {
  let s = depart;
  const jouees = new Set<string>();
  for (let n = 0; n < GESTES_AU_PLUS; n++) {
    const restantes = offres(zonesDeLEditeur(s)['editeur.inspecteur']).filter((o) => !jouees.has(o.id));
    const offre = restantes.find((o) => !o.emporte) ?? restantes[0];
    if (!offre) return s;
    jouees.add(offre.id);
    const geste = gesteDuJeu(s, offre.jeu);
    if (geste?.geste !== 'valeur') throw new Error(`l’offre ${offre.id} ne joue pas le geste valeur`);
    const avant = sceneEditee(s);
    s = editer(s, geste);
    const collection = COLLECTION_DU_PORTEUR[geste.porteur.sorte];
    const porteurs: readonly { id: string }[] = avant[collection] ?? [];
    const rang = porteurs.findIndex((p) => p.id === geste.porteur.id);
    const discriminant = offre.emporte && offre.saisie === 'saisieChoix' ? offre.id.slice(`valeur/${geste.chemin.join('/')}/`.length) : undefined;
    const ecrit = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur
      ? { chemin: [...geste.chemin, discriminant], valeur: geste.valeur[discriminant] }
      : { chemin: geste.chemin, valeur: geste.valeur };
    out.push({ avant, apres: sceneEditee(s), chemin: [collection, rang, ...ecrit.chemin], valeur: ecrit.valeur, saisie: offre.saisie });
  }
  throw new Error(`plus de ${GESTES_AU_PLUS} offres du geste valeur`);
}

/** La fiche du Bestiaire du personnage posé : ses options portent des Traits facultatifs et une note « swap » qui octroie
 *  des Caractéristiques et une Compétence (Vouivre, ZI). */
const FICHE_A_OPTIONS = 'vouivre-zoo-imperial';

/** La coque pirate de la scène d'embuscade de la barge du sel, à Améliorations d'instance (MDG 12), et sa case. */
const COQUE = { campagne: 'barge-du-sel', scene: 'barge-du-sel-embuscade', case: { x: 18, y: 7 } } as const;

const point = (x: number, y: number) => ({ case: { x, y }, f: { x, y } });

/** La session `s` où l'outil actif clique la case `(x, y)`. */
const cliquer = (s: SessionDEdition, x: number, y: number): SessionDEdition => editer(editer(s, { geste: 'appui', point: point(x, y) }), { geste: 'relache', point: point(x, y) });

/** Les écritures jouées sur une zone d'effet neuve, un déclencheur neuf et un personnage de `FICHE_A_OPTIONS` d'une scène
 *  neuve de la première campagne du jeu, chacun posé à son outil (Zone, Personnage), puis sur la coque `COQUE`,
 *  sélectionnée ; chacun joué à son inspecteur (`jouerLInspecteur`). */
export function ecrituresJouees(): EcritureJouee[] {
  const out: EcritureJouee[] = [];
  let s = presser(ouvrirLEdition(paquetDuJeu(allBuiltinCampaigns[0]), false), 'scenes/ajouter');
  for (const [sorte, de, a] of [['effect', 2, 3], ['trigger', 0, 1]] as const) {
    s = presser(presser(s, 'outil/zone'), `zone/${sorte}`);
    s = jouerLInspecteur(editer(editer(s, { geste: 'appui', point: point(de, de) }), { geste: 'relache', point: point(a, a) }), out);
  }
  jouerLInspecteur(cliquer(presser(presser(s, 'outil/personnage'), `personnage/${FICHE_A_OPTIONS}`), 5, 5), out);
  const campagne = allBuiltinCampaigns.find((c) => c.id === COQUE.campagne);
  if (!campagne) throw new Error(`aucune campagne ${COQUE.campagne}`);
  const barge = presser(presser(ouvrirLEdition(paquetDuJeu(campagne), false), `scenes/${COQUE.scene}`), 'outil/select');
  jouerLInspecteur(cliquer(barge, COQUE.case.x, COQUE.case.y), out);
  return out;
}
