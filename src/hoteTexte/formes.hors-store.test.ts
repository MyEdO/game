/**
 * LA FORME ENTIÈRE D'UN ARGUMENT DE VERBE (#3538), jouée par l'hôte texte (`hote.testkit.ts`) : la frontière lit chaque
 * champ d'un argument à sa forme (`lireALaForme`, src/hote/formes.ts), à toute profondeur, celui que le geste crée
 * (`HorsDesignation`) compris. Un brouillon malformé se refuse en `validation`, au chemin de son champ fautif, et rien
 * ne s'écrit ; le noyau ne le reçoit pas.
 */
import { rosterDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach, afterAll, beforeAll } from 'vitest';
import { fermerLaTable, table, verbe } from './hote.testkit';
import { brouillonComplet } from '../noyau/creation/engagement.testkit';
import { engagement } from '../noyau/creation/engagement';
import { newDraft, stepIds, validateStep, type CreatorDraft } from '../noyau/creation/brouillon';
import { fillDraftDefaults } from '../noyau/creation/defauts';
import { apresLeGeste, brouillonDeLaPartie, pagesDeCreation, rubriquesDeLaPage, type GesteDuBrouillon } from '../noyau/creation/vueDeLaCreation';
import { ecrireLeRoster, lireLeRoster } from '../noyau/persistance/roster';
import { gesteDuVerbe, intentionDuGeste, SANS_PISTE } from '../hote/geste';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie } from '../hote/partie';
import { adresseDeCreation } from '../engine/adresseDeCreation';
import { pregens } from '../data';
import type { GesteDeLAgent } from './serveur';

afterEach(fermerLaTable);

/** Le brouillon complet du banc, tel qu'un hôte l'écrit en JSON. */
const complet = (): Record<string, unknown> => JSON.parse(JSON.stringify(brouillonComplet('Témoin')));

/** Le geste joué aux écuries est refusé en `validation`, au message `message`, le fichier intact. */
function refuseALaFrontiere(geste: GesteDeLAgent, message: RegExp): void {
  const t = table();
  expect(t.nouvelle('fenetre-ecuries', { graine: 7 }).erreur).toBeNull();
  const avant = t.fichier();
  const r = t.jouer(geste);
  const texte = r.texte.split('\n  ').join(' ');
  expect(r.erreur, texte).toBe('validation');
  expect(texte).not.toMatch(/a levé/);
  expect(texte).toMatch(message);
  expect(t.fichier(), 'un geste refusé a été écrit au fichier').toBe(avant);
}

describe('un brouillon malformé se refuse à la frontière, au chemin de son champ', () => {
  it('brouillon vide : le champ requis qui manque', { timeout: 120_000 }, () => {
    refuseALaFrontiere(verbe('recruterLeHeros', { brouillon: {} }), /recruterLeHeros : heros\.brouillon\.speciesId manque/);
  });
  it('le membre de l’union que la valeur vise rend son écart : `brouillon` qui n’est pas un objet', { timeout: 120_000 }, () => {
    refuseALaFrontiere(verbe('recruterLeHeros', { brouillon: 3 }), /recruterLeHeros : heros\.brouillon : un objet JSON /);
  });
  it('un id en nombre sous le brouillon : `careerRolls[0].id`', { timeout: 120_000 }, () => {
    const brouillon = { ...complet(), careerRolls: [{ roll: 3, id: 1 }] };
    refuseALaFrontiere(verbe('recruterLeHeros', { brouillon }), /heros\.brouillon\.careerRolls\[0\]\.id : une chaîne attendue/);
  });
});

describe('la frontière lit le brouillon entier, à la forme du type du verbe', () => {
  let partie: ReturnType<typeof ouvrirLaPartie>['partie'];
  beforeAll(() => {
    ({ partie } = ouvrirLaPartie(nouvelEntete('fenetre-ecuries', { graine: 7 }), () => {}));
  });
  afterAll(() => partie.fermer());
  /** Les arguments lus par la frontière (`gesteDuVerbe`), ou le message de son refus `validation`. */
  const lire = (type: string, args: unknown[]): { args: unknown[] } | { refus: string } => {
    try {
      return { args: gesteDuVerbe(partie.etat(), { type, args }, SANS_PISTE).args };
    } catch (e) {
      if (e instanceof ErreurDeGeste && e.categorie === 'validation') return { refus: e.message };
      throw e;
    }
  };
  const refus = (type: string, args: unknown[]): string => {
    const l = lire(type, args);
    return 'refus' in l ? l.refus : `admis : ${JSON.stringify(l.args).slice(0, 200)}`;
  };
  const adresse = adresseDeCreation.especeTalent(0);
  /** Le brouillon complet, son option « n parmi » de Talent d'espèce posée à `option` (`AdvancementRef`). */
  const avecOption = (option: unknown) => [{ brouillon: { ...complet(), speciesTalentChoices: { [adresse]: option } } }];

  it('le brouillon complet bâtit le héros, à la place d’un héros du groupe complet', () => {
    const geste = gesteDuVerbe(partie.etat(), { type: 'remplacerLeHeros', args: [partie.etat().party[0].id, { brouillon: complet() }] }, SANS_PISTE);
    const r = partie.envoyer(intentionDuGeste(partie.etat(), geste));
    expect(partie.etat().party.map((h) => h.label), JSON.stringify(r).slice(0, 300)).toContain('Témoin');
  });
  it('une forme récursive (`AdvancementRef`, `FORMES`) : un « n parmi » imbriqué valide passe, l’invalide se refuse à son chemin', () => {
    expect(lire('recruterLeHeros', avecOption({ pick: 1, of: [{ id: 'x' }, { pick: 1, of: [{ random: 1 }] }] }))).toHaveProperty('args');
    expect(refus('recruterLeHeros', avecOption({ pick: 1, of: [{ pick: 1, of: [{ id: 3 }] }] })))
      .toContain(`heros.brouillon.speciesTalentChoices["${adresse}"].of[0].of[0].id : une chaîne attendue`);
  });
  it('une imbrication sans fond se refuse en `validation`, sans lever', () => {
    let option: unknown = { random: 1 };
    for (let i = 0; i < 20_000; i++) option = { pick: 1, of: [option] };
    expect(refus('recruterLeHeros', avecOption(option))).toMatch(/niveaux d’imbrication/);
  });
  it('une valeur de dictionnaire se refuse à sa clé ; une clé `__proto__` reste une entrée propre', () => {
    expect(refus('recruterLeHeros', [{ brouillon: { ...complet(), specChoices: { [adresse]: 3 } } }])).toContain(`heros.brouillon.specChoices["${adresse}"] : une chaîne attendue`);
    const proto = (valeur: unknown) => JSON.parse(`{"brouillon":${JSON.stringify(complet()).replace(/\}$/, `,"talentRerolls":{"__proto__":${JSON.stringify(valeur)}}}`)}}`);
    expect(refus('recruterLeHeros', [proto('trois')])).toContain('heros.brouillon.talentRerolls["__proto__"] : un nombre attendu');
    const lu = lire('recruterLeHeros', [proto(3)]);
    const rerolls = 'args' in lu ? (lu.args[0] as { brouillon: { talentRerolls: object } }).brouillon.talentRerolls : null;
    expect(rerolls && Object.getOwnPropertyDescriptor(rerolls, '__proto__')?.value).toBe(3);
    expect(rerolls && Object.getPrototypeOf(rerolls)).toBe(Object.prototype);
  });
  it('une clé que l’objet ne déclare pas se refuse : `brouillon` et `pretire` ensemble ; chacun seul passe', () => {
    const pretire = pregens[0].id;
    expect(refus('recruterLeHeros', [{ brouillon: complet(), pretire }]))
      .toContain('heros : vise plusieurs membres de HerosEngage (heros.pretire : clé inconnue (admises : brouillon, id, idDeRoster) ; heros.brouillon : clé inconnue (admises : pretire))');
    expect(refus('recruterLeHeros', [{ brouillon: { ...complet(), zzz: 1 } }])).toContain('heros.brouillon.zzz : clé inconnue (admises : ');
    expect(lire('recruterLeHeros', [{ pretire }])).toHaveProperty('args');
    expect(lire('recruterLeHeros', [{ brouillon: complet() }])).toHaveProperty('args');
  });
  it('une énumération de littéraux se refuse en nommant ses valeurs', () => {
    expect(refus('jetLancer', ['zzz'])).toMatch(/flux : "zzz" n’est pas FluxDuVerbe \(admises : .*"attaque"/);
    expect(refus('fenetreFermer', ['zzz'])).toMatch(/fenetre : "zzz" n’est pas FenetreQuiSeFerme \(admises : /);
  });
  it('aucun brouillon légitime ne se refuse : neufs, complétés étape par étape, joués par les gestes des pages, rendus par le roster', () => {
    const brouillons: [string, CreatorDraft][] = [];
    for (let graine = 0; graine < 4; graine++) {
      brouillons.push([`neuf ${graine}`, newDraft(graine)]);
      for (const etape of stepIds()) brouillons.push([`défauts ${graine}@${etape}`, fillDraftDefaults(newDraft(100 + graine), etape)]);
      let d = brouillonDeLaPartie(77, graine);
      for (const page of pagesDeCreation()) {
        for (let k = 0; k < 3; k++) {
          const gestes = rubriquesDeLaPage(d, page).flatMap((r): GesteDuBrouillon[] => (r.genre === 'geste' ? (r.refus ? [] : [r.geste]) : r.genre === 'choix' ? r.options.flatMap((o) => (o.refus ? [] : [o.geste])) : []));
          if (!gestes.length) break;
          d = apresLeGeste(d, gestes[(graine + k) % gestes.length]);
          brouillons.push([`geste ${graine}@${page}#${k}`, d]);
        }
        const etape = page.split('.')[0] as ReturnType<typeof stepIds>[number];
        if (validateStep(d, etape) !== null) d = fillDraftDefaults(d, etape);
      }
      brouillons.push([`complété ${graine}`, d]);
      for (const e of lireLeRoster(ecrireLeRoster([engagement(d, rosterDeTest('roster'))]))?.heros ?? []) brouillons.push([`roster ${graine}`, e.draft]);
    }
    const refuses = brouillons.flatMap(([nom, d]) => {
      const l = lire('recruterLeHeros', [JSON.parse(JSON.stringify({ brouillon: d, id: 'h1' }))]);
      return 'refus' in l ? [`${nom} : ${l.refus.slice(0, 300)}`] : [];
    });
    expect(brouillons.length, 'témoin : des brouillons de chaque provenance').toBeGreaterThan(40);
    expect(refuses).toEqual([]);
  });
});
