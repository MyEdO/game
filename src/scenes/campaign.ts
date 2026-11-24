/** Les campagnes du jeu : chacune est un paquet commité, `src/scenes/<campagne>/<campagne>-projet.json` — celui de
 *  l'Arène est l'octet du `build()` de `scripts/arene/generate.mjs` (#1522, #1601) —, lu par `campagneDuPaquet`. */
import { campagneDuPaquet, type BuiltinCampaign } from '../noyau/index';
import areneProjet from './arene/arene-projet.json';
import loupEtSaumureProjet from './loup-et-saumure/loup-et-saumure-projet.json';
import bargeDuSelProjet from './barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from './diligence/diligence-projet.json';

/** « La Diligence » — chapitre 1 de L'Ennemi Intérieur : paquet éditeur portant SES scènes (la
 *  première étant l'entrée) et la carte du monde du chapitre. */
export const diligenceCampaign: BuiltinCampaign = campagneDuPaquet(diligenceProjet, 'diligence-projet.json');

/** Campagnes du jeu proposées au picker en plus de l'Arène. Ajouter une campagne étalon = un item ICI, jamais un
 *  chemin parallèle. */
export const builtinCampaigns: BuiltinCampaign[] = [
  campagneDuPaquet(loupEtSaumureProjet, 'loup-et-saumure-projet.json'),
  campagneDuPaquet(bargeDuSelProjet, 'barge-du-sel-projet.json'),
  diligenceCampaign,
];

/** L'Arène, sous la MÊME forme, pour la réutiliser partout où une liste homogène est nécessaire (#367 : « Ouvrir »
 *  de l'éditeur). */
export const areneCampaign: BuiltinCampaign = campagneDuPaquet(areneProjet, 'arene-projet.json');

/** Toutes les campagnes du jeu (Arène + `builtinCampaigns`), source unique pour tout listing
 *  homogène (bibliothèque de campagnes ET « Ouvrir » de l'éditeur, #367). */
export const allBuiltinCampaigns: BuiltinCampaign[] = [areneCampaign, ...builtinCampaigns];
