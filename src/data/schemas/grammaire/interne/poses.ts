import { marquerConcept, marquerConceptDeClasse, type ClasseDePose, type Pose } from './concepts';
import {
  countSpecSchema,
  diceSpecSchema,
  fragmentBlocsSchema,
  fragmentCelluleSchema,
  moneyPartialSchema,
  moneySchema,
  plageOuverteSchema,
  plageSchema,
  prixSaisonnierSchema,
  profilDePropulsionSchema,
  profilDeVoileSchema,
  secondarySourceRefSchema,
  sinPointsSchema,
  sourceRefSchema,
  surchargePaletteSchema,
  weaponDamageSpecSchema,
} from '../valeurs';
import { CHAMPS_PROSE_DE_SCENE, PROSES_NOMMEES } from '../champs-prose-de-scene';
import { flowTestSchema } from '../mecanique';
import { marchandageDeBilletSchema, palierDeBilletSchema, provenanceDeValeurSchema, provenancesDeRouteSchema, routeBilletSchema } from '../route';
import {
  clotureSchema,
  designerHerosSchema,
  documentSchema,
  identiteSchema,
  ligneDIdentiteSchema,
  ouvertureSchema,
  poserEtatSchema,
  revealClueSchema,
  valeurDIdentiteSchema,
} from '../campagne';
import { specialSchema } from '../jeu-de-taverne';

/** La classe de produit `(fabrique, rôles, clés d'extra)`. */
const classe = (fabrique: string, roles: readonly string[], clesDExtra: readonly string[] = []): ClasseDePose => ({ fabrique, roles, clesDExtra });

/**
 * TABLE des poses de concept de la grammaire (#3012) : id → nœud ou classe de produit. Source
 * unique de `IdConceptPose`. Seuls les nœuds qu'un def atteint y sont posés (`posesPerdues`).
 */
const POSES_DE_GRAMMAIRE = {
  'palette-d-objet': surchargePaletteSchema,
  monnaie: moneySchema,
  'monnaie-partielle': moneyPartialSchema,
  'profil-de-propulsion': profilDePropulsionSchema,
  'profil-de-voile': profilDeVoileSchema,
  de: diceSpecSchema,
  adresse: classe('descRefSchemaDe', ['descRef']),
  'fragment-blocs': fragmentBlocsSchema,
  'fragment-cellule': fragmentCelluleSchema,
  'formule-somme': classe('optionsDeFormule', ['sum']),
  'formule-minimum': classe('optionsDeFormule', ['minimum']),
  'formule-tranche': classe('optionsDeFormule', ['parTranche']),
  'formule-peche': sinPointsSchema,
  source: sourceRefSchema,
  'source-secondaire': secondarySourceRefSchema,
  plage: plageSchema,
  'plage-ouverte': plageOuverteSchema,
  quantite: countSpecSchema,
  'degats-arme': weaponDamageSpecSchema,
  'condition-flag': classe('conditionDe', ['condition.flag']),
  'prose-nommee': classe('proseNommee', CHAMPS_PROSE_DE_SCENE.filter((chemin) => PROSES_NOMMEES[chemin].champ === 'texte')),
  reference: classe('objetDeRef', ['ref']),
  'reference-typee': classe('objetDeRef', ['refTypee']),
  'reference-a-specialisation': classe('noeudASpecialisation', ['specSeule', 'specOuChoix', 'specOuChoixFacultatifs']),
  'reference-chiffree': classe('noeudASpecialisation', ['specSeule', 'specOuChoix', 'specOuChoixFacultatifs'], ['value']),
  'tirage-parmi': classe('pick', ['of']),
  'tirage-sur-table': classe('pick', ['table'], ['table']),
  'trait-pose': classe('traitPose', ['pose'], ['value']),
  'prix-saisonnier': prixSaisonnierSchema,
  'palier-de-billet': palierDeBilletSchema,
  'billet-de-route': routeBilletSchema,
  'marchandage-de-billet': marchandageDeBilletSchema,
  'provenance-de-valeur': provenanceDeValeurSchema,
  'provenances-de-route': provenancesDeRouteSchema,
  'identite-de-heros': identiteSchema,
  'ligne-d-identite': ligneDIdentiteSchema,
  'valeur-d-identite': valeurDIdentiteSchema,
  ouverture: ouvertureSchema,
  cloture: clotureSchema,
  'effet-d-etat-poser': poserEtatSchema,
  'effet-d-etat-designer': designerHerosSchema,
  'effet-narratif-document': documentSchema,
  'effet-narratif-indice': revealClueSchema,
  'special-de-jeu': specialSchema,
  test: flowTestSchema,
};

export type IdConceptPose = keyof typeof POSES_DE_GRAMMAIRE;

function poser<I extends IdConceptPose>(table: Readonly<Record<I, Pose>>): void {
  for (const id in table) {
    const pose = table[id];
    if ('fabrique' in pose) marquerConceptDeClasse(id, pose);
    else marquerConcept(id, pose);
  }
}

poser(POSES_DE_GRAMMAIRE);
