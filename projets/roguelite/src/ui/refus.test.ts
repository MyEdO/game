// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { poserLaDetermination } from '../../../../src/engine/talentEffects';
import * as J from '../jeu';
import { tomber } from '../jeu/salles.testkit';
import { poserLesReglesDuRoguelite } from '../noyau';
import { installerLesSurvols } from './bulles';
import { ecranDuHeros, type Onglet } from './fiche';
import { ecranDeLExpedition, ecranDuHameau, type ChoixDeSalle } from './lieux';
import type { Apercu } from './pieces';
import { panneauDeService, type Emplacement, type Service } from './services';

poserLesReglesDuRoguelite();
beforeAll(installerLesSurvols);

/** Une partie où presque tout se ferme : la bourse vide, les bâtiments au premier palier, le Cartographe et l'hospice
 *  en ruine selon `ruines`, un héros à l'hospice, un autre hors de combat, sans PX. */
function partieFermee(ruines: boolean): J.Etat {
  const e = J.nouvellePartie(3);
  e.or = 0;
  e.trophees = 0;
  for (const k of Object.keys(e.batiments) as J.IdBatiment[]) e.batiments[k] = ruines ? 0 : 1;
  e.roster[1].sejour = { ou: 'temple', reste: 3, total: 7 };
  tomber(e.roster[2].c);
  for (const h of e.roster) h.c.xp = 0;
  return e;
}

const SERVICES: Service[] = ['relais', 'temple', 'salle', 'forge', 'cartographe', 'peage', 'chronique'];
const EMPLACEMENTS: Emplacement[] = ['main', 'secondaire', 'tir', 'armure'];
const ONGLETS: Onglet[] = ['progression', 'talents', 'sorts', 'equipement'];

/** Chaque écran du hameau sur la partie `e` : chaque service pour chaque héros servi (la forge à chaque emplacement),
 *  le départ, et chaque onglet de la fiche de chaque héros. */
function ecransDuHameau(e: J.Etat): [string, string][] {
  const ctx = (client: string, emplacement: Emplacement = 'main') => ({ e, client, emplacement, dest: J.DESTINATIONS[0].id, choix: new Set([e.roster[0].c.id]), congediement: null });
  return e.roster.flatMap((h) => [
    ...SERVICES.flatMap((s) => (s === 'forge' ? EMPLACEMENTS : ['main' as const]).map((k): [string, string] => [`${s} ${k} · ${h.c.label}`, ecranDuHameau(e, '', panneauDeService(ctx(h.c.id, k), s), '')])),
    ...ONGLETS.map((o): [string, string] => [`fiche ${o} · ${h.c.label}`, ecranDuHameau(e, ecranDuHeros({ e, congediement: null }, h.c.id, o), null, '')]),
  ]).concat([['départ', ecranDuHameau(e, '', panneauDeService(ctx(e.roster[0].c.id), 'depart'), '')]]);
}

/** La fiche du dernier héros d'une compagnie, qui ne se renvoie pas. */
function ficheDuDernier(): [string, string] {
  const e = J.nouvellePartie(3);
  e.roster = e.roster.slice(0, 1);
  return ['fiche · dernier héros', ecranDuHameau(e, ecranDuHeros({ e, congediement: null }, e.roster[0].c.id, 'talents'), null, '')];
}

/** Chaque écran d'une expédition dont le seul héros qui sait désarmer est hors de combat, dans une salle à choix de
 *  `type` ou entre deux salles (`null`), chaque héros parti en pleine santé avec chaque potion et remède de l'hospice :
 *  la salle, le socle qui attend le héros de chaque action (le blessé du soin de la nonne, entre deux salles), et la
 *  fiche de chaque héros en route. */
function ecransDeLExpedition(type: J.TypeDeSalle | null): [string, string][] {
  const e = J.nouvellePartie(3);
  e.or = 1000;
  e.batiments.temple = 1;
  for (const h of e.roster) for (const a of J.provisionsEnVente(e)) expect(J.acheterUneProvision(e, h.c.id, a.id)).toBeNull();
  expect(J.partir(e, J.DESTINATIONS[0].id, e.roster.map((h) => h.c.id))).toBeNull();
  const x = e.expedition!;
  if (type) x.salles[x.index] = { type, ennemis: [], faite: false, ouverte: true };
  const groupe = J.herosDuGroupe(e);
  tomber(groupe[3].c);
  const actions: ChoixDeSalle[] = !type ? [{ action: 'soigner', soigneur: groupe[1].c.id }]
    : type === 'camp' ? [] : (Object.keys(J.EPREUVES[type as J.SalleAJet].actions) as J.IdActionAJet[]).map((action) => ({ action }));
  return [
    [`salle ${type ?? 'à venir'}`, ecranDeLExpedition(e, '', null, '', null)],
    ...actions.map((c): [string, string] => [`salle ${type ?? 'à venir'} · ${c.action}`, ecranDeLExpedition(e, '', null, '', c)]),
    ...groupe.map((h): [string, string] => [`fiche en route · ${h.c.label}`, ecranDeLExpedition(e, ecranDuHeros({ e, congediement: null }, h.c.id, null), null, '', null)]),
  ];
}

/** Ce que le survol de `el` montre : la bulle, sinon le pied de l'aperçu. */
function ditAuSurvol(el: HTMLElement): string {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  const bulle = document.querySelector<HTMLElement>('.bulle-du-jeu')!;
  return (bulle.hidden ? document.querySelector('.apercu-du-jeu .pied')?.textContent : bulle.textContent) ?? '';
}

/** Tout ce qu'un écran dit hors de la raison de ses gestes fermés : son texte, ses bulles et ses aperçus. */
function ditAilleurs(hote: HTMLElement): string[] {
  const bulles = [...hote.querySelectorAll<HTMLElement>('[data-bulle]:not(:disabled)')].map((el) => el.dataset.bulle!);
  const apercus = [...hote.querySelectorAll<HTMLElement>('[data-apercu]')].map((el) => {
    const a = JSON.parse(el.dataset.apercu!) as Apercu;
    return [a.nom, a.nature, a.texte, a.pied, a.planche?.replace(/<[^>]*>/g, ' ')].join('\n');
  });
  return [hote.textContent ?? '', ...bulles, ...apercus];
}

describe('chaque geste fermé dit sa raison une fois, au survol', () => {
  const ecrans = [...ecransDuHameau(partieFermee(false)), ...ecransDuHameau(partieFermee(true)), ficheDuDernier(), ...ecransDeLExpedition('tresor'), ...ecransDeLExpedition('camp'), ...ecransDeLExpedition(null)];

  it('les écrans éprouvés ferment des gestes de chaque sorte', () => {
    const hote = document.createElement('div');
    const fermes = new Set<string>();
    for (const [, html] of ecrans) {
      hote.innerHTML = html;
      for (const el of hote.querySelectorAll<HTMLElement>(':disabled')) fermes.add(el.classList[0]);
    }
    expect([...fermes].sort()).toEqual(['boite-objet', 'carte-heros', 'lien', 'piece-epreuve', 'plaque']);
  });

  it.each(ecrans)('%s', (_, html) => {
    const hote = document.createElement('div');
    document.body.append(hote);
    hote.innerHTML = html;
    for (const el of hote.querySelectorAll<HTMLElement>(':disabled')) {
      const raison = el.dataset.bulle;
      const geste = `${el.className} « ${el.textContent?.trim().slice(0, 40)} »`;
      expect(raison, geste).toBeTruthy();
      expect(ditAuSurvol(el), geste).toBe(raison);
      expect(ditAilleurs(hote).filter((d) => d.includes(raison!)), `${geste} : « ${raison} » redit`).toEqual([]);
    }
    hote.remove();
  });
});

describe('entre deux salles, la Guérison refusée dit la raison du noyau au survol', () => {
  it('la case du soigneur, puis chaque blessé que le noyau lui refuse', () => {
    const e = J.nouvellePartie(3);
    expect(J.partir(e, J.DESTINATIONS[0].id, e.roster.map((h) => h.c.id))).toBeNull();
    const groupe = J.herosDuGroupe(e);
    const soigneur = groupe.find((h) => J.refusDuSoigneur(e, h) === 'Personne à soigner.')!;
    const hote = document.createElement('div');
    document.body.append(hote);
    const survol = (selecteur: string) => ditAuSurvol(hote.querySelector<HTMLElement>(`${selecteur}:disabled`)!);
    hote.innerHTML = ecranDeLExpedition(e, '', null, '', null);
    expect(survol(`.sacs [data-a="soigneur"][data-id="${soigneur.c.id}"]`)).toBe('Personne à soigner.');

    const blesse = groupe.find((h) => h !== soigneur)!;
    blesse.c.wounds.current = 1;
    hote.innerHTML = ecranDeLExpedition(e, '', null, '', { action: 'soigner', soigneur: soigneur.c.id });
    const refuses = groupe.filter((h) => J.refusDuPatient(soigneur, h));
    expect(refuses.map((h) => h.c.id)).toEqual(groupe.filter((h) => h !== blesse).map((h) => h.c.id));
    for (const h of refuses) expect(survol(`.socle-compagnie [data-a="tenter"][data-id="${h.c.id}"]`), h.c.label).toBe(J.refusDuPatient(soigneur, h));
    hote.remove();
  });
});

describe('entre deux salles, « Se relever » sans Détermination dit la raison du noyau au survol (LDB 17 l.61)', () => {
  it('la case du héros À Terre', () => {
    const e = J.nouvellePartie(3);
    expect(J.partir(e, J.DESTINATIONS[0].id, e.roster.map((h) => h.c.id))).toBeNull();
    const h = J.herosDuGroupe(e)[0];
    tomber(h.c);
    poserLaDetermination(h.c, 0);
    const hote = document.createElement('div');
    document.body.append(hote);
    hote.innerHTML = ecranDeLExpedition(e, '', null, '', null);
    const raison = J.refusDeSeRelever(h);
    expect(raison).toBeTruthy();
    expect(ditAuSurvol(hote.querySelector<HTMLElement>(`.sacs [data-a="relever"][data-id="${h.c.id}"]:disabled`)!)).toBe(raison);
    hote.remove();
  });
});
