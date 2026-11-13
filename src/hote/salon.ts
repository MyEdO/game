/**
 * LE SALON d'un hôte (#3009) : ce qu'un écran de salon montre et offre, en zones, pur de l'état de la partie, de
 * l'ouverture que l'hôte tient et de la présence d'un réseau. Le noyau offre chaque attribution de siège
 * (`siegesOfferts`) ; ce module n'en nomme aucun verbe.
 */
import { siegesDeLaTable, siegesOfferts, type Jeu as Partie } from '../noyau/index';
import { t } from '../i18n';
import { ligne, type Bouton, type Choix, type Formulaire, type Ligne, type Saisie } from './elements';

/** L'ouverture d'un salon que l'hôte tient : aucune, en cours (héberger ou rejoindre), ou échouée et son texte. */
export type OuvertureDuSalon = null | { enCours: 'heberger' | 'rejoindre' } | { echec: string };

/** Les zones du salon. */
export interface ZonesDuSalon {
  /** en session, le code de la room, chaque siège de la table (son nom, « (vous) », « reconnexion »), et chez un invité
   *  l'état de son lien ; hors session, l'ouverture en cours ou le texte de son échec. */
  'salon.etat': Ligne[];
  /** hors session et sans ouverture en cours, « Héberger » (`verbe` `heberger`, champ `nom`) et « Rejoindre »
   *  (`verbe` `rejoindre`, champs `code`, `nom`), chacun refusé avec sa raison ; sinon « Quitter le salon », dont le
   *  `jeu` est `{ salon: 'quitter' }`. */
  'salon.gestes': (Formulaire | Bouton)[];
  /** une rangée par attribution de siège offerte (`siegesOfferts`, surface du noyau), une valeur par siège, pressée
   *  quand il la tient déjà, dont le `jeu` est l'intention du noyau qui l'attribue. */
  'salon.sieges': Choix[];
}

/** Une saisie de texte du formulaire `verbe`. */
const champ = (verbe: string, nom: string, libelle: string): Saisie => ({ type: 'saisieTexte', id: `${verbe}/${nom}`, ton: 'neutre', nom, optionnel: false, libelle, valeur: '' });

/** Un formulaire du salon. */
const formulaire = (verbe: string, libelle: string, refus: string | null, champs: Saisie[]): Formulaire => ({ type: 'formulaire', id: verbe, libelle, verbe, focus: false, refus, champs });

/** L'état du lien d'un invité. */
function lienDeLInvite(net: Partie['net']): Ligne {
  if (net.hoteAbsent) return ligne('lien', t('coop.invite.attente.hoteAbsent'), 'alerte');
  if (net.connection === 'reconnexion') return ligne('lien', t('coop.invite.attente.reconnexion'), 'alerte');
  return ligne('lien', t('coop.invite.attente.defaut'));
}

/** Les zones du salon de la partie `etat` (`null` : aucune partie ouverte), pendant l'ouverture `ouverture`, l'hôte
 *  ayant un réseau ou non (`reseau`). */
export function zonesDuSalon(etat: Pick<Partie, 'net' | 'party'> | null, ouverture: OuvertureDuSalon, reseau: boolean): ZonesDuSalon {
  const net = etat?.net ?? null;
  const enSession = net !== null && net.mode !== 'local';
  const enCours = ouverture !== null && 'enCours' in ouverture;
  const etatDuSalon: Ligne[] = enSession
    ? [
      ligne('code', t('ecran.salon.code', { code: net.roomCode ?? '' })),
      ...siegesDeLaTable(net).map(({ seat, nom, moi, absent }) => ligne(`siege/${seat}`, `${nom}${moi ? t('party.slot.you') : ''}${absent ? t('ecran.salon.absent') : ''}`, absent ? 'alerte' : 'neutre')),
      ...(net.mode === 'invite' ? [lienDeLInvite(net)] : []),
    ]
    : ouverture === null ? []
    : 'enCours' in ouverture ? [ligne('ouverture', t(ouverture.enCours === 'heberger' ? 'ecran.salon.enCours.heberger' : 'ecran.salon.enCours.rejoindre'))]
    : [ligne('ouverture', ouverture.echec, 'echec')];
  const sansReseau = reseau ? null : t('ecran.salon.refus.sansReseau');
  const gestes: (Formulaire | Bouton)[] = enSession || enCours
    ? [{ type: 'bouton', id: 'quitter', libelle: t('ecran.salon.quitter'), jeu: { salon: 'quitter' }, presse: false, focus: false, refus: null }]
    : [
      formulaire('heberger', t('coop.hote.bouton'), sansReseau ?? (etat === null ? t('ecran.salon.refus.sansPartie') : null), [champ('heberger', 'nom', t('coop.name.label'))]),
      formulaire('rejoindre', t('coop.join.btn'), sansReseau ?? (etat === null ? null : t('ecran.salon.refus.partieOuverte')), [
        champ('rejoindre', 'code', t('ecran.salon.champ.code')),
        champ('rejoindre', 'nom', t('coop.name.label')),
      ]),
    ];
  return {
    'salon.etat': etatDuSalon,
    'salon.gestes': gestes,
    'salon.sieges': etat === null ? [] : siegesOfferts(etat).map((o): Choix => ({
      type: 'choix', id: o.id, ton: 'neutre', libelle: o.nom, focus: false, refus: null,
      valeurs: o.choix.map((c): Bouton => ({ type: 'bouton', id: `${o.id}/${c.siege ?? 'ia'}`, libelle: c.nom, jeu: c.intention, presse: c.tenu, focus: false, refus: null })),
    })),
  };
}
