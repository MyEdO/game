/**
 * L'interface de Grisefosse : l'état de l'interface (l'écran ouvert, le héros servi, le carton), le routage des gestes
 * par délégation des clics (`data-a`), et un rendu complet par geste. Un carton ouvert ne laisse passer que ses gestes. Les écrans vivent sous `./ui` : les lieux
 * (hameau, expédition), les services du hameau, la fiche du héros, le rejeu du combat, tous au gabarit commun
 * (`./ui/ecran`) et montés sur les pièces du kit (`./ui/pieces`).
 */
import * as J from './jeu';
import type { Vignette } from './vignettes';
import { DEGRADES_DES_FIGURINES } from './figures';
import { poserLesTextures } from './kit';
import { ajusterLaScene, choisirLaTaille, type Taille } from './ui/ecran';
import { panneauDeService, type Emplacement } from './ui/services';
import { ajusterLesTableaux, ecranDeLExpedition, ecranDuHameau, NOM_DE_SALLE, recitEnCarton, recommencerEnCarton, renierEnCarton, reglagesEnCarton, VIGNETTE_DE_SALLE, type ChoixDeSalle } from './ui/lieux';
import { ecranDuHeros, type Onglet } from './ui/fiche';
import { gloserDans, installerLesSurvols } from './ui/bulles';
import { cliquerDansLeRejeu, fermerLeRejeu, mettreALEchelle, ouvrirLeRejeu, rejeuOuvert } from './ui/rejeu';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
type Panneau = { type: 'batiment'; id: J.IdBatiment } | { type: 'heros'; id: string; onglet: Onglet | null } | { type: 'depart'; dest: string; choix: Set<string> } | { type: 'chronique' };
let etat: J.Etat = J.charger() ?? J.nouvellePartie(Date.now() % 100000);
let panneau: Panneau | null = null;
type Recit = { type: 'recit'; recit: J.RecitDeSalle; ruban: string; vignette: Vignette; surTitre: string; terrain: string };
/** Un « Je te renie ! » en attente : le carton bloque la salle ; `suite` reprend le récit une fois le choix tranché. */
type Renier = { type: 'renier'; choix: NonNullable<J.RecitDeSalle['renier']>; suite: (r: J.RecitDeSalle) => void; ruban: string; vignette: Vignette; surTitre: string };
let ouvert: Recit | Renier | { type: 'reset' } | { type: 'reglages' } | null = null;
/** Le héros que servent la forge, l'hospice et la salle d'armes. */
let client: string | null = null;
/** L'emplacement ouvert à la forge. */
let emplacement: Emplacement = 'main';
let congediement: string | null = null;
/** L'action de la salle ouverte qui attend son héros (son soigneur, puis son blessé) au socle. */
let choixDAction: ChoixDeSalle | null = null;
let panoramaCentre = false;

function toast(msg: string | null) {
  if (!msg) return;
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(Number(t.dataset.h));
  t.dataset.h = String(window.setTimeout(() => (t.hidden = true), 2800));
}

function agir(f: () => string | null | void) {
  const err = f();
  J.sauver(etat);
  rendre();
  if (err) toast(err);
}

/** Le récit `r` d'une salle : un « Je te renie ! » en attente ouvre d'abord son carton (`renierEnCarton`), dont le choix
 *  reprend le récit ; sinon `suite`. */
function derouler(r: J.RecitDeSalle, o: Omit<Renier, 'type' | 'choix' | 'suite'>, suite: (r: J.RecitDeSalle) => void) {
  if (!r.renier) return suite(r);
  ouvert = { type: 'renier', choix: r.renier, suite: (fini) => derouler(fini, o, suite), ...o };
  rendre();
}

/** Joue l'action choisie dans la salle ouverte (`J.agirDansLaSalle`) et raconte son récit en carton ; son refus, en
 *  toast. La salle, sa route et son rang se lisent avant l'action, qui peut ramener le groupe au hameau. */
function raconterLAction(action: J.ActionDeSalle, herosId?: string, patientId?: string) {
  const x = etat.expedition!;
  const type = x.salles[x.index].type;
  const terrain = x.destination;
  const route = `${J.destinationCourante(etat)!.nom} · salle ${x.index + 1} sur ${x.salles.length}`;
  const joue = J.agirDansLaSalle(etat, action, herosId, patientId);
  if (typeof joue === 'string') return toast(joue);
  choixDAction = null;
  derouler(joue, { ruban: NOM_DE_SALLE[type], vignette: VIGNETTE_DE_SALLE[type], surTitre: route }, (r) => {
    ouvert = null;
    J.sauver(etat);
    const montrer = () => { ouvert = { type: 'recit', recit: r, ruban: NOM_DE_SALLE[type], vignette: VIGNETTE_DE_SALLE[type], surTitre: J.salleAChoisir(etat) ? route : `${route} franchie`, terrain }; rendre(); };
    if (!r.combat) return montrer();
    rendre();
    ouvrirLeRejeu(r.combat, '', montrer, terrain, etat.roster);
  });
}

/** La fiche ouverte, plein écran ; ou le panneau du service ouvert, posé sur le hameau. */
const ficheOuverte = (): string => (panneau?.type === 'heros' ? ecranDuHeros({ e: etat, congediement }, panneau.id, panneau.onglet) : '');
function serviceOuvert() {
  if (!panneau || panneau.type === 'heros') return null;
  const ctx = { e: etat, client, emplacement, dest: panneau.type === 'depart' ? panneau.dest : null, choix: panneau.type === 'depart' ? panneau.choix : new Set<string>(), congediement };
  return panneauDeService(ctx, panneau.type === 'batiment' ? panneau.id : panneau.type);
}

// ─── Écrans ─────────────────────────────────────────────────────────────────────────────────────────────────

const vueDuCarton = (): string => (!ouvert ? '' : ouvert.type === 'reset' ? recommencerEnCarton() : ouvert.type === 'reglages' ? reglagesEnCarton()
  : ouvert.type === 'renier' ? renierEnCarton(ouvert.choix.nom, ouvert) : recitEnCarton(ouvert.recit, ouvert, J.herosDuGroupe(etat)));

function rendre() {
  const avant = document.querySelector<HTMLElement>('.panorama')?.scrollLeft;
  $('#jeu').innerHTML = etat.expedition ? ecranDeLExpedition(etat, ficheOuverte(), vueDuCarton(), choixDAction) : ecranDuHameau(etat, ficheOuverte(), serviceOuvert(), vueDuCarton());
  const pano = document.querySelector<HTMLElement>('.panorama');
  if (pano) {
    if (avant != null && panoramaCentre) pano.scrollLeft = avant;
    else { pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) * 0.42; panoramaCentre = true; }
  }
  ajusterLaScene();
  ajusterLesTableaux();
  gloserDans($('#jeu'));
}

// ─── Gestes ─────────────────────────────────────────────────────────────────────────────────────────────────

const basculer = (p: Panneau) => {
  const meme = !!panneau && panneau.type === p.type && (!('id' in p) || ('id' in panneau && panneau.id === p.id));
  panneau = meme ? null : p;
  congediement = null;
  rendre();
};

document.addEventListener('click', (ev) => {
  const cible = ev.target as Element;
  if (cliquerDansLeRejeu(cible)) return;
  const el = cible.closest<HTMLElement>('[data-a]');
  if (!el || (el as HTMLButtonElement).disabled || (ouvert && !el.closest('.carton'))) return;
  const { a, id = '', i, k } = el.dataset;
  switch (a) {
    case 'batiment': if (el.dataset.client) client = el.dataset.client; panneau = { type: 'batiment', id: id as J.IdBatiment }; congediement = null; return rendre();
    case 'heros': return basculer({ type: 'heros', id, onglet: (k as Onglet | undefined) ?? null });
    case 'onglet': if (panneau?.type === 'heros') panneau = { ...panneau, onglet: k as Onglet }; return rendre();
    case 'chronique': panneau = { type: 'chronique' }; return rendre();
    case 'ouvrir-depart': panneau = { type: 'batiment', id: 'cartographe' }; return rendre();
    case 'fermer-panneau': panneau = null; congediement = null; return rendre();
    case 'ameliorer': return agir(() => J.ameliorer(etat, id as J.IdBatiment));
    case 'recruter': return agir(() => J.recruter(etat, Number(i)));
    case 'soigner': client = id; return agir(() => J.soignerAuTemple(etat, id));
    case 'sequelle': client = id; return agir(() => J.guerirUneSequelle(etat, id));
    case 'hospice': client = id; return agir(() => J.confierALHospice(etat, id, k as J.ActeDHospice));
    case 'chambre': client = id; return agir(() => J.prendreUneChambre(etat, id));
    case 'client': client = id; return rendre();
    case 'emplacement': emplacement = k as Emplacement; return rendre();
    case 'arme': return agir(() => J.acheterUneArme(etat, id, k!));
    case 'armure': return agir(() => J.acheterUneArmure(etat, id, k!));
    case 'provision': client = id; return agir(() => J.acheterUneProvision(etat, id, k!));
    case 'carac': return agir(() => J.acheter(etat, id, { genre: 'carac', id: k! }));
    case 'sort': return agir(() => J.acheter(etat, id, { genre: 'sort', id: k! }));
    case 'niveau': return agir(() => J.acheter(etat, id, { genre: 'niveau' }));
    case 'competence': case 'talent': {
      const h = etat.roster.find((x) => x.c.id === id);
      const o = h && J.offresDeCarriere(h);
      const ref = o && (a === 'competence' ? o.competences : o.talents)[Number(i)]?.ref;
      return ref ? agir(() => J.acheter(etat, id, { genre: a, ref })) : undefined;
    }
    case 'utiliser': { const ligne = J.utiliserUneProvision(etat, id, k!); J.sauver(etat); rendre(); return toast(ligne); }
    case 'prier': { const ligne = J.prier(etat, id, k!); J.sauver(etat); rendre(); return toast(ligne); }
    case 'congedier': congediement = id; return rendre();
    case 'congedier-non': congediement = null; return rendre();
    case 'congedier-ok': congediement = null; if (panneau?.type === 'heros') panneau = null; if (client === id) client = null; return agir(() => J.congedier(etat, id));
    case 'preparer': {
      // Le groupe proposé : les quatre héros disponibles les moins blessés.
      const etat_ = (h: J.Heros) => h.c.wounds.current / Math.max(1, h.c.wounds.max);
      const proposes = etat.roster.filter(J.disponible).sort((a, b) => etat_(b) - etat_(a)).slice(0, J.TAILLE_DU_GROUPE);
      panneau = { type: 'depart', dest: id, choix: new Set(proposes.map((h) => h.c.id)) };
      return rendre();
    }
    case 'choisir': {
      if (panneau?.type !== 'depart') return;
      if (panneau.choix.has(id)) panneau.choix.delete(id);
      else if (panneau.choix.size >= J.TAILLE_DU_GROUPE) return toast('Quatre héros au plus : laissez d’abord quelqu’un au hameau.');
      else panneau.choix.add(id);
      return rendre();
    }
    case 'partir': {
      if (panneau?.type !== 'depart') return;
      const p = panneau;
      panneau = null;
      return agir(() => J.partir(etat, p.dest, [...p.choix]));
    }
    case 'avancer': {
      if (!etat.expedition) return;
      panneau = null;
      const x = etat.expedition;
      const terrain = x.destination;
      const type = x.salles[x.index].type;
      const surTitre = `${J.destinationCourante(etat)!.nom} · salle ${x.index + 1} sur ${x.salles.length} franchie`;
      const joue = J.avancer(etat);
      if (!joue) { J.sauver(etat); choixDAction = null; return rendre(); }
      return derouler(joue, { ruban: NOM_DE_SALLE[type], vignette: VIGNETTE_DE_SALLE[type], surTitre }, (recit) => {
        ouvert = null;
        J.sauver(etat);
        const montrer = () => { ouvert = { type: 'recit', recit, ruban: NOM_DE_SALLE[type], vignette: VIGNETTE_DE_SALLE[type], surTitre, terrain }; rendre(); };
        if (!recit.combat) return montrer();
        rendre();
        // Une victoire se clôt à son issue, qui dit le butin ; une mort, une déroute, une retraite ou le maître vaincu se
        // racontent ensuite au carton.
        const raconter = !!recit.fin || recit.lignes.length > 1;
        ouvrirLeRejeu(recit.combat, recit.fin ? '' : recit.lignes[0], raconter ? montrer : rendre, terrain, etat.roster);
      });
    }
    case 'action': {
      const action = k as J.ActionDeSalle;
      if (action === 'passer' || action === 'reposer') return raconterLAction(action);
      choixDAction = choixDAction?.action === action ? null : { action };
      return rendre();
    }
    case 'tenter': {
      if (!choixDAction || !id) return;
      if (choixDAction.action !== 'soigner') return raconterLAction(choixDAction.action, id);
      if (choixDAction.soigneur) return raconterLAction('soigner', choixDAction.soigneur, id);
      choixDAction = { action: 'soigner', soigneur: id };
      return rendre();
    }
    case 'revoir': {
      if (ouvert?.type !== 'recit' || !ouvert.recit.combat) return;
      const m = ouvert;
      ouvert = null; rendre();
      return ouvrirLeRejeu(m.recit.combat!, '', () => { ouvert = m; rendre(); }, m.terrain, etat.roster);
    }
    case 'rentrer': {
      if (!etat.expedition) return;
      panneau = null;
      const terrain = etat.expedition.destination;
      const surTitre = J.destinationCourante(etat)!.nom;
      const lignes = J.rentrer(etat, false);
      J.sauver(etat);
      ouvert = { type: 'recit', recit: { titre: 'Retour au hameau', lignes }, ruban: 'Retour', vignette: 'retour', surTitre, terrain };
      return rendre();
    }
    case 'attendre': return agir(() => J.attendreUneSemaine(etat));
    case 'fermer': ouvert = null; return rendre();
    case 'renier': { if (ouvert?.type !== 'renier') return; const { choix, suite } = ouvert; return suite(choix.trancher(k === 'oui')); }
    case 'reset': ouvert = { type: 'reset' }; return rendre();
    case 'reglages': ouvert = { type: 'reglages' }; return rendre();
    case 'taille': choisirLaTaille(k as Taille); mettreALEchelle(); return rendre();
    case 'reset-ok': J.effacer(); etat = J.nouvellePartie(Date.now() % 100000); ouvert = null; panneau = null; congediement = null; return agir(() => null);
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (rejeuOuvert()) return fermerLeRejeu();
  if (ouvert?.type === 'reset' || ouvert?.type === 'reglages') { ouvert = null; return rendre(); }
  if (panneau) { panneau = null; rendre(); }
});

window.addEventListener('resize', () => {
  mettreALEchelle();
  ajusterLaScene();
  ajusterLesTableaux();
  const pano = document.querySelector<HTMLElement>('.panorama');
  if (pano) pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) * 0.42;
});

installerLesSurvols();
document.body.insertAdjacentHTML('beforeend', DEGRADES_DES_FIGURINES);
poserLesTextures();
J.sauver(etat);
rendre();
