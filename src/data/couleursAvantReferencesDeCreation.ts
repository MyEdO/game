import type { RaceKey } from './schemas/grammaire/valeurs';
import couleurs from './historique/couleurs-avant-3917.json';

/** Colonnes d'espèce à ad649c27f. */
export const COLONNES_AVANT_REFERENCES_DE_CREATION: ReadonlyMap<string, RaceKey> = new Map([
  ['humains-reiklander', 'humain'],
  ['humains-middenheim', 'humain'],
  ['humains-middenland', 'humain'],
  ['humains-nordland', 'humain'],
  ['humains-tileens', 'humain'],
  ['humains-bjornling-norse', 'humain'],
  ['humains-sarl-norse', 'humain'],
  ['humains-skaeling-norse', 'humain'],
  ['halflings', 'halfling'],
  ['halflings-cendreplaine', 'halfling'],
  ['halflings-basseronce', 'halfling'],
  ['halflings-tuilecaramel', 'halfling'],
  ['halflings-piedfoin', 'halfling'],
  ['halflings-piedpaille', 'halfling'],
  ['halflings-piedfoin-piedpaille', 'halfling'],
  ['halflings-pochegaree', 'halfling'],
  ['halflings-havrebas', 'halfling'],
  ['halflings-rumster', 'halfling'],
  ['halflings-bordecharde', 'halfling'],
  ['halflings-pavederonces', 'halfling'],
  ['halflings-fraisedebois', 'halfling'],
  ['nains', 'nain'],
  ['nains-norse', 'nain'],
  ['gnomes', 'gnome'],
  ['ogres', 'ogre'],
  ['hauts-elfes', 'haut-elfe'],
  ['elfes-sylvains', 'elfe-sylvain'],
]);

type RangeeHistorique = { readonly id: string; readonly color: Readonly<Partial<Record<RaceKey, string>>> };

/** Cellules des tables à ad649c27f, pour les personnages écrits avant #3917. */
export const COULEURS_AVANT_REFERENCES_DE_CREATION: Readonly<Record<'eyes' | 'hairs', readonly RangeeHistorique[]>> = couleurs;
