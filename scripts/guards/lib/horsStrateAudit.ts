/**
 * AUDIT « quelles SIGNATURES d'objet ne sont portées par AUCUNE strate du lexique ? » en SITES
 * (#1463 L0, #1727 T0d) — la TRADUCTION en sites est UNIQUE, partagée par la garde
 * `src/data/structures-contrat.test.ts` et le régénérateur
 * `scripts/data/regen-hors-strate-stock.mts` : deux lectures divergentes du corpus laisseraient
 * l'une écrire ce que l'autre refuse.
 *
 * La MESURE vit dans `scripts/docs/lib/structures-scan.mts` (`scanDuCorpus`, champ
 * `scan.invisibles`), la MÊME primitive que `GARDE.primitive` nomme et que
 * `docs/structures-donnees.md` rend en table. Ce module n'en TRADUIT que la sortie en
 * `{ file, ref }`, la forme que `sitesEnEntrees` (`stock.mjs`) ordinalise en entrées
 * `{ fichier, ref, occurrence }`.
 *
 * Le `file` d'un site est le document à OUVRIR — c'est lui que la porte de plage
 * (`croissanceDesStocks`) voit, et il doit EXISTER sur le disque. Le scan key ses objets par
 * BASENAME (`nomDeDocument`), là où les documents de `src/scenes` vivent en
 * `src/scenes/<projet>/<projet>-projet.json` : le chemin se JOINT donc sur la liste de documents
 * que le scan porte déjà (`scan.documents`, posée par `listerDocuments`, champ `chemin` relatif à
 * la racine du dépôt, 126 documents pour 126 basenames distincts). Aucune heuristique de nom,
 * aucune racine devinée — un basename absent de cette liste LÈVE, nommément.
 */
import { depotDe, racineDe } from './gitPorte.mjs';
import { scanDuCorpus } from '../../docs/lib/structures-scan.mjs';
import type { Site } from './stock.mjs';

/** Une signature HORS STRATE telle que le scan la rend (`scan.invisibles`). */
export interface SignatureHorsStrate {
  dataset: string;
  champ: string;
  signature: string;
}

/** Un document tel que le scan le porte (`scan.documents`) : son basename et son CHEMIN réel. */
export interface DocumentScanne {
  nom: string;
  chemin: string;
}

/** Ce que l'audit rend : la mesure ET les documents qui la situent, lus d'un SEUL scan. */
export interface MesureHorsStrate {
  invisibles: readonly SignatureHorsStrate[];
  documents: readonly DocumentScanne[];
}

/**
 * Un SITE par signature hors strate : `{ file: '<chemin réel du document>', ref: '<champ> | <signature>' }`.
 * La `ref` porte les DEUX coordonnées que le document seul ne dit pas — le champ PORTEUR mesuré et
 * la signature de l'objet — parce que c'est ce couple que le lecteur cherche dans le fichier.
 * Fail-loud sur un basename inconnu : un stock qui nomme un fichier inexistant envoie son lecteur
 * dans le vide, et aucune garde ne le rattrape. PUR.
 */
export const sitesHorsStrate = (
  invisibles: readonly SignatureHorsStrate[],
  documents: readonly DocumentScanne[],
): Site[] => {
  const cheminParNom = new Map(documents.map((d) => [d.nom, d.chemin]));
  return invisibles.map((o) => {
    const chemin = cheminParNom.get(o.dataset);
    if (!chemin)
      throw new Error(
        `document hors de la liste du scan (\`listerDocuments\`, scripts/docs/lib/structures-scan.mts) : ${o.dataset}`,
      );
    return { file: chemin, ref: `${o.champ} | ${o.signature}` };
  });
};

/** La mesure du corpus réel, pour qui n'a pas déjà un scan sous la main (le régénérateur). */
export const auditHorsStrate = (root?: string): MesureHorsStrate => {
  const racine = root ?? racineDe(depotDe(process.cwd()));
  if (!racine) throw new Error(`racine du dépôt non résolue depuis ${process.cwd()}`);
  const { scan } = scanDuCorpus(racine);
  return { invisibles: scan.invisibles, documents: scan.documents };
};

/** Le MOTIF du volet, dernière phrase du refus de `refusDeCroissance` (`stock.mjs`). */
export const MOTIF_HORS_STRATE =
  'Une structure neuve se pose à la forme CIBLE du lexique (`structures-lexique.mts`) : elle entre '
  + "dans une strate, elle ne s'inscrit pas ici. Une paire périmée/neuve d'un MÊME dataset, sans un "
  + "octet de donnée changé, est le bruit d'instrument dit en tête du stock — se lire, pas s'entériner.";
