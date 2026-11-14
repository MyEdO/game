/**
 * LE LIEU EN VUE (#3534) — ce qu'un hôte montre de l'écran du lieu qui tient la main : le nom du lieu, sa description
 * dite aux identités en vigueur (`nommer`), sa place sur le plan de la carte (`planDepuis`) et le geste qui l'ouvre,
 * chacun de ses services (`placeServices`), son icône, son fond,
 * le boniment de son hôte et ce qu'on y fait, écrit en verbe du noyau avec ce qui le ferme maintenant, les points
 * d'intérêt de son plan qui mènent à une scène et le choix d'y entrer (`entreesDuLieu`, #3611), puis les trajets qui en partent
 * (`trajetsDepuis`). Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import { lieuDuGroupe, placeServices, serviceIcon, type ResolvedPlaceService } from './worldMap';
import { planDepuis, trajetsDepuis, type PlanDeLaCarte, type TrajetEnVue } from './carteEnVue';
import { refusDEntrerAuPort } from './portFlow';
import { entreesDuLieu, refusDEntrerAuPoint } from './lieuFlow';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { identitesResolues, nommer } from './monde/identites';
import { fenetreDuJeu } from './combatAuto';
import { VERBE_DE_CHOIX } from './choixDesFenetres';
import { t } from '../i18n';

/** Ce qu'on fait à un service : son nom, son verbe, pourquoi il ne se joue pas maintenant (`null` : il se joue). */
export interface GesteDuService { id: string; libelle: string; geste: GesteDuNoyau; refus: string | null }

/** Un service du lieu et ce qu'on y fait ; l'id de son icône (`serviceIcon`), celui de son fond d'ambiance et le
 *  boniment de son hôte, quand il en a. */
export interface ServiceEnVue { id: string; nom: string; icone: string; fond: string | null; accueil: string | null; gestes: GesteDuService[] }

/** Un point d'intérêt du plan du lieu qui mène à une scène, et le geste d'y entrer. */
export interface PointDInteretEnVue { id: string; nom: string; geste: GesteDuService }

/** L'écran du lieu : son nom, sa description, quand il en a une, le plan de la carte vu d'ici et le geste qui ouvre
 *  la carte, ses services, ses points d'intérêt, ses trajets. */
export interface LieuEnVue { nom: string; prose: string | null; plan: PlanDeLaCarte; carte: GesteDuService; services: ServiceEnVue[]; pointsDInteret: PointDInteretEnVue[]; trajets: TrajetEnVue[] }

/** Ce qu'on fait au service `svc` du lieu : y dormir et y recueillir des informations à l'auberge, y entrer
 *  ailleurs (le port, le marché, l'échoppe de son marchand) ; rien pour un service sans écran. */
function gestesDuService(s: Jeu, svc: ResolvedPlaceService): GesteDuService[] {
  const entrer = (geste: GesteDuNoyau, refus: string | null = null): GesteDuService[] => [{ id: 'entrer', libelle: svc.enterLabel ?? t('lieu.entrer'), geste, refus }];
  if (svc.category === 'auberge') {
    const dormir: GesteDuService[] = svc.rest ? [{ id: 'dormir', libelle: t('lieu.dormir'), geste: { verbe: 'ouvrirLeRepos', args: [] }, refus: null }] : [];
    return [...dormir, { id: 'informations', libelle: t('lieu.informations'), geste: { verbe: 'recueillirLesRumeurs', args: [] }, refus: null }];
  }
  if (svc.category === 'port' || svc.opensScreen === 'port') return entrer({ verbe: 'ouvrirLePort', args: [] }, refusDEntrerAuPort(s));
  if (svc.category === 'marche') return entrer({ verbe: 'ouvrirLeMarche', args: [] });
  if (svc.merchantArchetype) return entrer({ verbe: 'ouvrirLaBoutique', args: [svc.id] });
  return [];
}

/** L'écran du lieu qui tient la main (`fenetreDuJeu`) ; `null` : il ne tient pas la main. PUR. */
export function lieuEnVue(s: Jeu): LieuEnVue | null {
  const ici = fenetreDuJeu(s)?.cle === 'ecranDuLieu' ? lieuDuGroupe(s) : undefined;
  if (!s.worldMap || !ici) return null;
  const services = placeServices(ici, sceneDuRegistre(ici.scene.id))
    .map((svc): ServiceEnVue => ({
      id: svc.id, nom: svc.label, icone: serviceIcon(svc), fond: svc.backdrop ?? null, accueil: svc.hostLine ?? null,
      gestes: gestesDuService(s, svc),
    }))
    .filter((svc) => svc.gestes.length > 0);
  const pointsDInteret = entreesDuLieu(s).map((p): PointDInteretEnVue => ({
    id: p.id, nom: p.label,
    geste: { id: 'entrer', libelle: t('lieu.entrer'), geste: { verbe: VERBE_DE_CHOIX, args: ['ecranDuLieu', 'entrer', p.id] }, refus: refusDEntrerAuPoint(s, p) },
  }));
  const carte: GesteDuService = { id: 'carte', libelle: t('lieu.carte'), geste: { verbe: 'ouvrirLaCarte', args: [] }, refus: null };
  const trajets = trajetsDepuis(s, s.worldMap, ici);
  const prose = ici.prose ? nommer(ici.prose, identitesResolues(s)) : null;
  return { nom: ici.label, prose, plan: planDepuis(s, s.worldMap, ici, trajets), carte, services, pointsDInteret, trajets };
}
