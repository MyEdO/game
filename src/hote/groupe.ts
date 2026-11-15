/**
 * LA PARTIE HORS DE SA SCÈNE (#3009), commune aux hôtes du noyau : tant qu'aucune partie n'est en cours
 * (`partieEnCours`), chaque pré-tiré de la donnée en entité, avec le bouton qui le recrute, chaque héros du roster de
 * l'hôte en entité, avec le bouton qui le recrute et celui qui le retire du roster (`{ roster }`), et chaque campagne
 * du jeu (`allBuiltinCampaigns`) en entité, avec le bouton qui la lance (`{ lancer }`) ; à tout moment, ses gestes
 * (`partie.gestes`). Le noyau juge chaque refus.
 */
import { herosDuRosterOfferts, partieEnCours, pretiresOfferts, refusDeLancer, type Jeu as Partie } from '../noyau/index';
import { t } from '../i18n';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { allBuiltinCampaigns } from '../scenes/campaign';
import { ligne, type Bouton, type Entite, type Jeu, type Ligne } from './elements';
import type { RosterMontre } from './roster';

/**
 * @contrat Vue
 * Les zones de la partie hors de sa scène : son groupe à composer et la campagne à lancer, vides dès qu'elle est en
 * cours (`partieEnCours`, surface du noyau), et le geste qui la quitte.
 */
export interface ZonesDeLaPartie {
  /**
   * chaque pré-tiré de la donnée en entité (`pretiresOfferts`, surface du noyau) : son nom, son espèce et sa carrière,
   * et « Recruter », dont le `jeu` est l'intention du noyau qui le recrute, refusé avec sa raison (groupe plein, héros
   * déjà au groupe).
   */
  'groupe.pretires': Entite[];
  /**
   * chaque héros du roster de l'hôte en entité (`herosDuRosterOfferts`, surface du noyau) : son nom, son espèce et sa
   * carrière, « Recruter », dont le `jeu` `{ roster: { recruter } }` porte l'id de son héros, refusé avec la raison du
   * noyau (groupe plein, héros déjà au groupe), « Supprimer », dont le `jeu` `{ roster: { retirer } }` le retire du
   * roster, et « Exporter », dont le `jeu` `{ roster: { exporter } }` en demande le fichier (méthode `roster`).
   */
  'groupe.roster': Entite[];
  /** « Importer un personnage… », dont le `jeu` `{ roster: { importer: true } }` demande le choix d'un fichier d'export
   *  (méthode `roster`). */
  'groupe.import': Bouton[];
  /**
   * ce que le chargement du roster a retiré (`avisDuRoster` : un roster d'un autre format, des héros élagués de ce
   * que le jeu ne connaît plus), dit tant que la partie se compose.
   */
  'groupe.avis': Ligne[];
  /**
   * chaque campagne du jeu en entité : son nom, sa description, et « Lancer », dont le `jeu` `{ lancer }` porte l'id
   * que la méthode `lancer` reçoit, refusé avec la raison du noyau (`refusDeLancer` : chez un invité, groupe vide,
   * siège invité à pourvoir).
   */
  'groupe.campagnes': Entite[];
  /**
   * « Sauvegardes », dont le `jeu` `{ sauvegardes: true }` ouvre le panneau des sauvegardes (méthode `sauvegardes`),
   * « Options », dont le `jeu` `{ reglages: true }` ouvre le panneau des réglages (méthode `reglages`),
   * « Jouer en ligne », dont le `jeu` `{ salon: true }` ouvre le panneau du salon (méthode `salon`), puis
   * « Quitter la partie », dont le `jeu` `{ quitter: true }` appelle la méthode `quitter`.
   */
  'partie.gestes': Bouton[];
}

/** Un bouton d'une carte du groupe à composer. */
const bouton = (id: string, libelle: string, jeu: Jeu, refus: string | null): Bouton => ({ type: 'bouton', id, libelle, jeu, presse: false, focus: false, refus });

/** La carte d'un héros que le groupe recrute : son nom, son espèce et sa carrière, puis ses boutons. */
const carte = (id: string, h: { nom: string; espece: string | null; carriere: string | null }, boutons: Bouton[]): Entite => ({
  type: 'entite', id, ton: 'neutre', nom: h.nom, elements: [ligne('fiche', [h.espece, h.carriere].filter((x) => x !== null).join(t('ecran.separateur'))), ...boutons],
});

/** Les zones de la partie `etat` hors de sa scène : le geste qui ouvre ses sauvegardes, celui qui la quitte, et,
 *  avant son lancement, son groupe à composer, des pré-tirés et du roster `roster` de l'hôte, et la campagne à lancer. */
export function zonesDeLaPartie(etat: Pick<Partie, 'battle' | 'party' | 'net' | 'scene' | 'pendingCampaign'>, roster: RosterMontre): ZonesDeLaPartie {
  const gestes: Bouton[] = [
    { type: 'bouton', id: 'sauvegardes', libelle: t('ecran.partie.sauvegardes'), jeu: { sauvegardes: true }, presse: false, focus: false, refus: null },
    { type: 'bouton', id: 'reglages', libelle: t('ecran.partie.reglages'), jeu: { reglages: true }, presse: false, focus: false, refus: null },
    { type: 'bouton', id: 'salon', libelle: t('coop.title.local'), jeu: { salon: true }, presse: false, focus: false, refus: null },
    { type: 'bouton', id: 'quitter', libelle: t('ecran.partie.quitter'), jeu: { quitter: true }, presse: false, focus: false, refus: null },
  ];
  if (partieEnCours(etat)) return { 'groupe.pretires': [], 'groupe.roster': [], 'groupe.import': [], 'groupe.avis': [], 'groupe.campagnes': [], 'partie.gestes': gestes };
  const refus = refusDeLancer(etat);
  return {
    'partie.gestes': gestes,
    'groupe.pretires': pretiresOfferts(etat).map((p) => carte(`pretire/${p.id}`, p, [bouton(`recruter/${p.id}`, t('ecran.groupe.recruter'), p.recrutement, p.refus)])),
    'groupe.roster': herosDuRosterOfferts(etat, roster.heros).map((h) => carte(`roster/${h.id}`, h, [
      bouton(`recruter/${h.id}`, t('ecran.groupe.recruter'), { roster: { recruter: h.id } }, h.refus),
      bouton(`retirer/${h.id}`, t('picker.hero.delete'), { roster: { retirer: h.id } }, null),
      bouton(`exporter/${h.id}`, t('picker.hero.export'), { roster: { exporter: h.id } }, null),
    ])),
    'groupe.import': [bouton('importer', t('picker.import.btn'), { roster: { importer: true } }, null)],
    'groupe.avis': roster.avis === null ? [] : [ligne('roster', roster.avis, 'alerte')],
    'groupe.campagnes': allBuiltinCampaigns.map((c): Entite => ({
      type: 'entite', id: `campagne/${c.id}`, ton: 'neutre', nom: c.label, elements: [...(c.desc ? [ligne('desc', c.desc)] : []), bouton(`lancer/${c.id}`, t('ecran.groupe.lancer'), { lancer: c.id }, refus)],
    })),
  };
}

/** Le bouton des zones `groupe.roster` et `groupe.import` de `z` qui joue le geste du roster `roster`, égal en
 *  profondeur (`jsonCanonique`) ; `undefined` quand l'écran n'en offre aucun. */
export function boutonDuRoster(z: Pick<ZonesDeLaPartie, 'groupe.roster' | 'groupe.import'>, roster: unknown): Bouton | undefined {
  const cle = jsonCanonique({ roster });
  return [...z['groupe.import'], ...z['groupe.roster'].flatMap((e) => e.elements.filter((x): x is Bouton => x.type === 'bouton'))].find((b) => jsonCanonique(b.jeu) === cle);
}
