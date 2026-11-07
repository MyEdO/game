/**
 * LE LIEU EN VUE (#3534) — ce qu'un hôte montre de l'écran du lieu qui tient la main : le nom du lieu, chacun de ses
 * services (`placeServices`) et ce qu'on y fait, écrit en verbe du noyau avec ce qui le ferme maintenant, puis les
 * trajets qui en partent (`trajetsDepuis`). Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import { lieuDuGroupe, placeServiceMerchantId, placeServices, type MapPlace, type ResolvedPlaceService } from './worldMap';
import { trajetsDepuis, type TrajetEnVue } from './carteEnVue';
import { refusDEntrerAuPort } from './portFlow';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { fenetreDuJeu } from './combatAuto';
import { libelleOuAbsence } from '../data';
import { t } from '../i18n';

/** Ce qu'on fait à un service : son nom, son verbe, pourquoi il ne se joue pas maintenant (`null` : il se joue). */
export interface GesteDuService { id: string; libelle: string; geste: GesteDuNoyau; refus: string | null }

/** Un service du lieu et ce qu'on y fait. */
export interface ServiceEnVue { id: string; nom: string; gestes: GesteDuService[] }

/** L'écran du lieu : son nom, ses services, ses trajets. */
export interface LieuEnVue { nom: string; services: ServiceEnVue[]; trajets: TrajetEnVue[] }

/** Ce qu'on fait au service `svc` du lieu `ici` : y dormir et y recueillir des informations à l'auberge, y entrer
 *  ailleurs (le port, le marché, l'échoppe de son marchand) ; rien pour un service sans écran. */
function gestesDuService(s: Jeu, ici: MapPlace, svc: ResolvedPlaceService): GesteDuService[] {
  const entrer = (geste: GesteDuNoyau, refus: string | null = null): GesteDuService[] => [{ id: 'entrer', libelle: svc.enterLabel ?? t('lieu.entrer'), geste, refus }];
  if (svc.category === 'auberge') {
    const quality = sceneDuRegistre(ici.scene)?.rest?.quality;
    const dormir: GesteDuService[] = svc.rest
      ? [{ id: 'dormir', libelle: t('lieu.dormir'), geste: { verbe: 'ouvrirLeRepos', args: [{ places: svc.rest, lieu: libelleOuAbsence(ici, 'lieu', ici.id), ...(quality ? { quality } : {}) }] }, refus: null }]
      : [];
    return [...dormir, { id: 'informations', libelle: t('lieu.informations'), geste: { verbe: 'recueillirLesRumeurs', args: [] }, refus: null }];
  }
  if (svc.category === 'port' || svc.opensScreen === 'port') return entrer({ verbe: 'ouvrirLePort', args: [] }, refusDEntrerAuPort(s));
  if (svc.category === 'marche') return entrer({ verbe: 'ouvrirLeMarche', args: [] });
  if (svc.merchantArchetype) return entrer({ verbe: 'ouvrirLaBoutique', args: [placeServiceMerchantId(ici.id, svc.id), svc.merchantArchetype, ...(svc.backdrop ? [svc.backdrop] : [])] });
  return [];
}

/** L'écran du lieu qui tient la main (`fenetreDuJeu`) ; `null` : il ne tient pas la main. PUR. */
export function lieuEnVue(s: Jeu): LieuEnVue | null {
  const ici = fenetreDuJeu(s)?.cle === 'ecranDuLieu' ? lieuDuGroupe(s) : undefined;
  if (!s.worldMap || !ici) return null;
  const services = placeServices(ici, sceneDuRegistre(ici.scene))
    .map((svc): ServiceEnVue => ({ id: svc.id, nom: svc.label, gestes: gestesDuService(s, ici, svc) }))
    .filter((svc) => svc.gestes.length > 0);
  return { nom: ici.label, services, trajets: trajetsDepuis(s, s.worldMap, ici) };
}
