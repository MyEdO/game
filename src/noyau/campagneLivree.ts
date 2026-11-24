/** Une campagne livrée : un paquet commité (`{<identité>, scenes, worldMap, narratif}`, `src/data/schemas/defs-scenes/projet.ts`)
 *  qu'un projet remet. À l'import, son IDENTITÉ est validée à la racine du paquet selon le schéma de projet
 *  (`campagneDuPaquet`) ; la jouer ou l'ouvrir dans l'éditeur fait passer le paquet entier par `parseProject` AU GESTE
 *  (#1692), comme une entrée de bibliothèque (`campagneDUneEntree`). */
import { z } from 'zod';
import type { IconId } from '../data/icons';
import { parseProject, ProjetRefuse, type ProjectDoc, type ProjectIdentite } from './worldMap';
import { campagneDuDocument, type CampagneLancee } from './persistance/bibliotheque';
import { projetDoc } from '../data/schemas/defs-scenes/projet';
import { enfantsDe } from '../data/schemas/grammaire/descente';
import { refuserSansProvenance } from '../data/schemas/grammaire/document';
import { metaDesChamps, nommerChamps } from '../data/schemas/grammaire/meta';
import { refineProse } from '../data/schemas/grammaire/prose';
import { noeudObjet, rapportDeFautes, validerFormeVivante } from '../data/schemas/validate';
import { tableTotale } from '../lib/tableTotale';

/** Le paquet d'une campagne livrée tel que commité, NON PARSÉ : seul le compte de ses scènes se lit
 *  sans la porte (liste de la bibliothèque, comme `SavedProject.project.scenes`). */
interface PaquetDuJeu {
  readonly scenes: readonly unknown[];
}

/** Une campagne livrée (embarquée au build, pas dans le localStorage) : son identité et son paquet. #211 */
export interface BuiltinCampaign extends ProjectIdentite {
  /** L'icône est REQUISE sur une campagne exposée au picker (l'enveloppe la pose optionnelle). */
  icon: IconId;
  paquet: PaquetDuJeu;
  /** Nom du fichier du paquet (`diligence-projet.json`), tel que la liste du projet le déclare. */
  fichier: string;
}

/** Le paquet d'une campagne livrée passé par la porte `parseProject`, AU GESTE : un refus lève
 *  `ProjetRefuse`, laissé à l'appelant. Sa première scène est l'entrée. */
export function paquetDuJeu(c: BuiltinCampaign): Omit<ProjectDoc, 'schema'> {
  return parseProject(structuredClone(c.paquet)); // #2097
}

/** La campagne LANCÉE depuis une campagne livrée (`campagneDuDocument`) : son paquet passe la porte à l'appel
 *  (`paquetDuJeu`), l'`id` est celui de la campagne, l'entrée sa première scène. */
export function campagneDuJeu(c: BuiltinCampaign): CampagneLancee {
  const doc = paquetDuJeu(c);
  return campagneDuDocument(doc, c.id, doc.scenes[0].id);
}

const CLES_IDENTITE_DU_PAQUET = [
  'type', 'id', 'label', 'icon', 'versionContenu', 'desc', 'auteur', 'source', 'maison', 'descRef',
] as const satisfies readonly (keyof ProjectIdentite | 'descRef')[];

const noeudProjet = noeudObjet(projetDoc.schema);
if (!(noeudProjet instanceof z.ZodObject)) throw new Error('Le schéma du projet ne porte aucun objet racine.');
const enfantsDuProjet = enfantsDe(noeudProjet);
const metaDuProjet = metaDesChamps(noeudProjet, { exigees: true });
const noeudsDIdentite = tableTotale(CLES_IDENTITE_DU_PAQUET, cle => {
  const noeud = enfantsDuProjet.find(enfant => enfant.cle === cle)?.noeud;
  if (!(noeud instanceof z.ZodType)) throw new Error(`Le schéma du projet ne porte pas le champ « ${cle} ».`);
  return noeud;
});
const identiteDuPaquetSchema = nommerChamps(
  z.strictObject({ ...noeudsDIdentite, icon: noeudsDIdentite.icon.nonoptional() })
    .superRefine((valeur, ctx) => refuserSansProvenance(valeur, ctx, 'de l’entrée'))
    .superRefine(refineProse({ type: projetDoc.type, exigeProse: projetDoc.exiges.includes('desc') })),
  tableTotale(CLES_IDENTITE_DU_PAQUET, cle => metaDuProjet[cle]),
);

/** La campagne livrée du paquet `paquet`, commité sous le nom `fichier` : à l'import, seuls les nœuds d'identité du
 *  projet sont validés, un refus lève `ProjetRefuse` qui nomme `fichier`. L'adresse de la description sert au contrôle
 *  de la prose et le paquet original est conservé pour la lecture au geste. */
export function campagneDuPaquet(paquet: PaquetDuJeu & Readonly<Record<string, unknown>>, fichier: string): BuiltinCampaign {
  const projection: Partial<Record<(typeof CLES_IDENTITE_DU_PAQUET)[number], unknown>> = {};
  for (const cle of CLES_IDENTITE_DU_PAQUET) {
    const valeur = paquet[cle];
    if (valeur !== undefined) projection[cle] = valeur;
  }
  const refus = validerFormeVivante(identiteDuPaquetSchema, projection);
  if (refus) throw new ProjetRefuse(refus.cause, refus.fautes, rapportDeFautes(fichier, refus.fautes));

  const { descRef: _descRef, ...identite } = projection as ProjectIdentite & { icon: IconId; descRef?: unknown };
  return { ...identite, paquet, fichier };
}
