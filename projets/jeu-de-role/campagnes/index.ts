/** Les campagnes du jeu de rôle : chacune est un paquet commité, `campagnes/<campagne>/<campagne>-projet.json` — un
 *  paquet généré est l'octet du `build()` de son `generate.mjs` voisin (#1522, #1601) —, lu par `campagneDuPaquet`. */
import { campagneDuPaquet, type BuiltinCampaign } from '../../../src/noyau/index';
import areneProjet from './arene/arene-projet.json';
import loupEtSaumureProjet from './loup-et-saumure/loup-et-saumure-projet.json';
import bargeDuSelProjet from './barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from './diligence/diligence-projet.json';

/** « La Diligence » — chapitre 1 de L'Ennemi Intérieur : paquet éditeur portant SES scènes (la
 *  première étant l'entrée) et la carte du monde du chapitre. */
export const diligenceCampaign: BuiltinCampaign = campagneDuPaquet(diligenceProjet, 'diligence-projet.json');

/** L'Arène, la campagne vitrine. */
export const areneCampaign: BuiltinCampaign = campagneDuPaquet(areneProjet, 'arene-projet.json');

/** Les campagnes du jeu, dans l'ordre de la bibliothèque et de « Ouvrir » de l'éditeur (#367). Ajouter une campagne =
 *  un item ICI, jamais un chemin parallèle. */
export const campagnes: readonly BuiltinCampaign[] = [
  areneCampaign,
  campagneDuPaquet(loupEtSaumureProjet, 'loup-et-saumure-projet.json'),
  campagneDuPaquet(bargeDuSelProjet, 'barge-du-sel-projet.json'),
  diligenceCampaign,
];
