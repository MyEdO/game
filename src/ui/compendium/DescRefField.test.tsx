// @vitest-environment jsdom
/**
 * Rendu du champ d'ADRESSE DE PROSE (`DescRefField`, #1389) : ce qui est prouvé ici est le CÂBLAGE —
 * l'empreinte est RECALCULÉE au geste de l'auteur (jamais saisie), un fragment neuf CONTINUE le
 * montage au lieu de le dupliquer, un refus porte sa raison au survol/focus, et chaque code du
 * parseur devient une phrase d'auteur. Le chapitre est une fixture synthétique, aucun `Source/`
 * n'est lu.
 *
 * Le CHARGEUR (`data/source/chapitres`) est INJECTÉ par la prop `chargeurs` — JAMAIS `vi.mock` : la
 * suite partage son graphe de modules (`isolate: false`, `vite.config.ts`), un mock de module y fuit
 * d'un fichier de test à l'autre, et `src/vi-mock-isolate-guard.test.ts` le REFUSE. L'injection donne
 * le même isolement sans toucher au registre : chaque cas monte le champ avec SA fixture, et les
 * mémoires de promesse du vrai chargeur (qui feraient décider au premier cas ce que tous les autres
 * voient — la branche « chapitre saisi au numéro » ne serait jamais montée) ne sont jamais touchées.
 * Le contrat PROPRE du vrai chargeur (adresse-URL, cache, échec non mémorisé) est prouvé chez lui,
 * `src/data/source/chapitres.test.ts`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { inferFields } from './editFields';
import { DescRefField, PHRASE_LIGNE_AMBIGUE_TABLE, PHRASE_REFUS, type ChargeursSource } from './DescRefField';
import { empreinteDe, parseChapitre, prefixesDeChapitres, resoudreAdresse, estErreur, tablesOf, type DescRef, type Fragment, type FragmentBlocs, type FragmentCellule } from '../../data/source/decoupe';

/** Ce que le chargeur injecté sert, et ce qu'on lui a demandé — réglable par cas. */
const etat = { manifeste: true, appels: [] as string[] };

/** Les chargeurs INJECTÉS — la fixture, là où la production passe par le réseau. */
const CHARGEURS: ChargeursSource = {
  manifeste: () => (etat.manifeste
    ? Promise.resolve(MANIFESTE)
    : Promise.reject(new Error('manifeste-introuvable : 404'))),
  // Le chargeur répond APRÈS un tour de boucle, comme le réseau : c'est pendant ce délai que le champ
  // tient encore l'ANCIEN chapitre alors que l'adresse désigne déjà le nouveau. Répondre en microtâche
  // effacerait la fenêtre où le bug vit — et le test ne prouverait plus rien.
  chapitre: async (book: string, ch: string) => {
    etat.appels.push(`${book}|${ch}`);
    await new Promise((r) => { setTimeout(r, 0); });
    const md = TEXTES[ch];
    if (md === undefined) throw new Error(`chapitre-introuvable : ${book} ch.${ch} (HTTP 404)`);
    return parseChapitre(md);
  },
};

const CHAPITRE = [
  '### Terreur',
  '',
  "Les créatures les plus perturbantes de l'Empire glacent le sang de quiconque croise leur route.",
  '',
  'Une fois le Test de Psychologie effectué, la créature cause la Peur au lieu de la Terreur glaçante.',
  '',
  // Bloc TROP COURT pour un montage (< 40 caractères normalisés) : il ne doit jamais être offert à un
  // fragment neuf, et il sert à prouver qu'une erreur de montage désigne SA rangée.
  'Bref.',
  '',
  '### Peur',
  '',
  'La Peur est une réaction devant ce qui dépasse l’entendement, et elle se mesure par un Indice propre.',
  '',
  '### Sans contenu',
  '',
].join('\n');

/** Un chapitre dont AUCUNE section ne porte de bloc : rien n'y est adressable. */
const CHAPITRE_CREUX = ['### Titre nu', '', '### Autre titre nu', ''].join('\n');

/** Un chapitre à TABLE : une cellule y est adressable, et la section garde des blocs libres autour. */
const CHAPITRE_TABLE = [
  '### Blessures',
  '',
  'Les blessures graves laissent des séquelles durables, décrites par la table ci-dessous.',
  '',
  '| Localisation | Séquelle |',
  '| --- | --- |',
  '| Bras | Fracture ouverte qui empêche toute action de la main concernée. |',
  // Cellule TROP COURTE pour un montage : une adresse qui la cite est déjà fautive — le cas de la
  // recette où « + Fragment » se croyait sur un chapitre épuisé.
  '| Tete | Assommé. |',
  '',
  'Un guérisseur expérimenté peut réduire ces séquelles avec du temps et des soins constants.',
  '',
].join('\n');

/** Un chapitre à BANNIÈRE (rangée de tête absorbée) et à LÉGENDE `**X**` : les deux titres de table ;
 *  puis une table SANS titre et une seconde « TABLEAU DES CHUTES », qui partagent la ligne « Saut ». */
const CHAPITRE_TITRES = [
  '### Tables',
  '',
  '| | TABLEAU DES MOUVEMENTS | |',
  '|--|--|--|',
  '| Mouvement | Allure | Course |',
  '| Marche | 4 | 8 |',
  '',
  '**TABLEAU DES CHUTES**',
  '',
  '| Hauteur | Dégâts |',
  '| --- | --- |',
  '| 2 m | 1d10 |',
  '| Marche | 0 |',
  '',
  'Texte de liaison entre les tables.',
  '',
  '| Élan | Bonus |',
  '| --- | --- |',
  '| Saut | 2 |',
  '',
  '**TABLEAU DES CHUTES**',
  '',
  '| Hauteur | Dégâts |',
  '| --- | --- |',
  '| Saut | 5 |',
  '',
].join('\n');

/** Les chapitres que le chargeur remplaçant sert, par numéro ; tout autre numéro est introuvable. */
const TEXTES: Record<string, string> = {
  21: CHAPITRE,
  22: '### Corruption\n\nUn second chapitre, dont le premier bloc est assez long pour être adressé sans ambiguïté.\n',
  23: CHAPITRE_CREUX,
  24: CHAPITRE_TABLE,
  25: CHAPITRE_TITRES,
};

const PARSE = parseChapitre(CHAPITRE);

/** L'empreinte JUSTE d'un fragment de la fixture, posée par le helper unique. */
function sumDe(sec: string, b0: number, b1: number): string {
  const sum = empreinteDe(PARSE, { kind: 'blocs', sec, secOcc: 1, b0, b1, sum: '' });
  if (typeof sum !== 'string') throw new Error(`fixture non résoluble : ${sum.error}`);
  return sum;
}

const frag = (sec: string, b0: number, b1: number): FragmentBlocs =>
  ({ kind: 'blocs', sec, secOcc: 1, b0, b1, sum: sumDe(sec, b0, b1) });

const adresse = (...parts: FragmentBlocs[]): DescRef => ({ book: 'livre-de-base', ch: '21', parts });

/** Le manifeste que le plugin sert (`/source/manifest.json`) — en DEV seulement. */
const MANIFESTE = {
  'livre-de-base': {
    abbr: 'LDB',
    chapitres: [
      { ch: '21', fichier: '21 - Psychologie.md', titre: 'Psychologie', octets: 4242 },
      // Chapitre dont l'extraction n'a laissé qu'une ancre Word : le manifeste ne le NOMME pas, et le
      // nom de fichier n'est PAS un repli (il porte la même ancre).
      { ch: '22', fichier: '22 - _gjdgxs.md', titre: '', octets: 2424 },
      { ch: '23', fichier: '23 - Titres nus.md', titre: 'Titres nus', octets: 100 },
      { ch: '24', fichier: '24 - Blessures.md', titre: 'Blessures', octets: 900 },
      { ch: '25', fichier: '25 - Tables.md', titre: 'Tables', octets: 300 },
    ],
  },
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;

/** Règle le chargeur remplaçant pour le cas : `manifeste` dit si l'index est servi. Rend la liste
 *  des chapitres DEMANDÉS (`livre|ch`), remise à zéro à chaque appel. */
function sonde(manifeste = true): string[] {
  etat.manifeste = manifeste;
  etat.appels.length = 0;
  return etat.appels;
}

beforeEach(() => { sonde(); });

/** Le manifeste et le chapitre arrivent par promesse, le chapitre APRÈS un tour de boucle : deux
 *  passes de minuterie laissent l'état se poser. */
async function laisserPoser() {
  await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
}

async function monter(value: DescRef | undefined, onChange: (v: DescRef | undefined) => void) {
  const boite = document.createElement('div');
  document.body.appendChild(boite);
  container = boite;
  const racine = createRoot(boite);
  root = racine;
  await act(async () => { racine.render(<DescRefField label="Adresse" value={value} onChange={onChange} chargeurs={CHARGEURS} />); });
  await laisserPoser();
}

/**
 * Monte le champ sous un porteur qui GARDE l'adresse posée — comme le formulaire du Codex. Sans lui,
 * `value` ne bouge jamais et les cas où un geste change l'adresse PUIS le champ doit se rendre
 * dessus (changer de chapitre, muter un fragment) ne sont pas jouables du tout.
 */
async function monterVivant(initial: DescRef | undefined, journal: (v: DescRef | undefined) => void) {
  function Porteur() {
    const [v, setV] = useState(initial);
    return <DescRefField label="Adresse" value={v} onChange={(x) => { journal(x); setV(x); }} chargeurs={CHARGEURS} />;
  }
  const boite = document.createElement('div');
  document.body.appendChild(boite);
  container = boite;
  const racine = createRoot(boite);
  root = racine;
  await act(async () => { racine.render(<Porteur />); });
  await laisserPoser();
}

/** Démonte ce qui est monté (tous les cas ne montent pas : la route d'édition est un test PUR). */
function demonter() {
  const monte = root;
  if (monte) { act(() => { monte.unmount(); }); root = undefined; }
  container?.remove();
  container = undefined;
}

afterEach(() => { demonter(); });

/** Le champ nombre portant ce libellé visible ou ce nom accessible. */
const champ = (nom: string) =>
  [...(container?.querySelectorAll('input') ?? [])].find((i) => (i.getAttribute('aria-label') ?? i.getAttribute('name')) === nom
    || i.labels?.[0]?.textContent === nom);

const bouton = (texte: string) =>
  [...(container?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(texte));

/** Pose une valeur DOM comme le navigateur le ferait (setter natif + événement). */
async function poserValeur(el: HTMLInputElement | HTMLSelectElement, valeur: string) {
  const proto = el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, valeur);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

const clic = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('REFUS lisibles — chaque code du parseur a sa phrase d’AUTEUR', () => {
  it('aucune phrase n’est vide, ni la répétition de son code, et toutes sont distinctes', () => {
    const entrees = Object.entries(PHRASE_REFUS);
    const muettes = entrees.filter(([code, phrase]) => !phrase.trim() || phrase.includes(code));
    expect(muettes.map(([c]) => c), 'code(s) rendus BRUTS à l’auteur — écrire la phrase').toEqual([]);
    expect(new Set(entrees.map(([, p]) => p)).size, 'deux codes partagent la même phrase : l’un des deux ne dit pas ce qu’il faut faire').toBe(entrees.length);
    // Une phrase d'auteur est une PHRASE : sujet, verbe, et le geste à faire.
    expect(entrees.filter(([, p]) => p.length < 30).map(([c]) => c), 'phrase(s) trop courtes pour porter un geste').toEqual([]);
  });
});

describe('ROUTE d’ÉDITION — une `descRef` arrive sur CE champ, jamais sur le sous-formulaire générique', () => {
  it('`inferFields` classe le champ `descRef` en `descRef`', () => {
    const champs = inferFields([{ id: 'terreur', descRef: adresse(frag('terreur', 0, 0)) as unknown as Record<string, unknown> }]);
    expect(champs.find((f) => f.key === 'descRef')?.kind).toBe('descRef');
  });
});

describe('MANIFESTE — le chapitre se PIOCHE et se NOMME, ou se saisit au numéro', () => {
  it('le chapitre se choisit dans la liste, nommé par son TITRE, et en changer le charge', async () => {
    const appels = sonde();
    const poses: (DescRef | undefined)[] = [];
    await monter(adresse(frag('terreur', 0, 0)), (v) => poses.push(v));

    const liste = container?.querySelector('select[aria-label="Chapitre du passage"]') as HTMLSelectElement | null;
    expect(liste, 'aucune liste de chapitres — la branche manifeste est morte').toBeTruthy();
    expect([...liste!.options].map((o) => o.value)).toEqual(['', '21', '22', '23', '24', '25']);
    // Le TITRE nomme le chapitre ; sans titre, le champ le DIT — jamais le nom de fichier Word.
    expect([...liste!.options].map((o) => o.textContent)).toEqual([
      '— (chapitre) —', '21 — Psychologie', '22 — (chapitre sans titre)', '23 — Titres nus', '24 — Blessures', '25 — Tables',
    ]);

    await poserValeur(liste!, '22');
    expect(poses[poses.length - 1]).toEqual({ book: 'livre-de-base', ch: '22', parts: [] });

    demonter();
    await monter({ book: 'livre-de-base', ch: '22', parts: [] }, () => {});
    expect(appels).toContain('livre-de-base|22');
  });

  it('SANS manifeste servi, le chapitre se saisit au NUMÉRO, et le saisir charge le chapitre', async () => {
    const appels = sonde(false);
    const poses: (DescRef | undefined)[] = [];
    await monter({ book: 'livre-de-base', ch: '', parts: [] }, (v) => poses.push(v));

    expect(container?.querySelector('select[aria-label="Chapitre du passage"]'), 'aucun manifeste servi : la liste ne doit pas être rendue').toBeNull();
    const numero = champ('chapitre');
    expect(numero, 'le champ nombre de repli n’est pas rendu').toBeTruthy();

    await poserValeur(numero!, '21');
    expect(poses[poses.length - 1]).toEqual({ book: 'livre-de-base', ch: '21', parts: [] });

    demonter();
    await monter({ book: 'livre-de-base', ch: '21', parts: [] }, () => {});
    expect(appels).toContain('livre-de-base|21');
    expect(bouton('+ Fragment'), 'le chapitre chargé doit offrir d’ajouter un fragment').toBeTruthy();
  });

  it('SANS manifeste, la GRAPHIE vient de la fonction : `7` → « 07 », `105` → « 105 », vide → rien', async () => {
    // Cette branche ne connaît PAS le livre (elle n'est montée que faute de liste) : elle pose la
    // largeur MINIMALE du numéro, et aucun plafond littéral ne borne la saisie.
    sonde(false);
    const poses: (DescRef | undefined)[] = [];
    // Porteur VIVANT : la graphie posée revient dans `value`, donc le champ rend bien ce qu'il a
    // posé — sans lui, React réécrit l'input à l'ancienne valeur et le geste suivant est muet.
    await monterVivant({ book: 'livre-de-base', ch: '', parts: [] }, (v) => poses.push(v));
    const numero = champ('chapitre');
    expect(numero, 'le champ nombre de repli n’est pas rendu').toBeTruthy();
    expect(numero!.getAttribute('max'), 'aucun plafond littéral : un livre peut passer la centaine').toBeNull();
    expect(numero!.getAttribute('min'), 'le chapitre 0 est l’index, pas un chapitre').toBe('1');

    await poserValeur(numero!, '7');
    expect(poses[poses.length - 1]).toEqual({ book: 'livre-de-base', ch: '07', parts: [] });

    await poserValeur(numero!, '105');
    expect(poses[poses.length - 1]).toEqual({ book: 'livre-de-base', ch: '105', parts: [] });

    // Le champ VIDÉ efface l'adresse au lieu de forger une graphie.
    await poserValeur(numero!, '');
    expect(poses[poses.length - 1]).toEqual({ book: 'livre-de-base', ch: '', parts: [] });

    // `0` est calé à la borne basse : la graphie ne reçoit jamais un numéro qui n'en est pas un.
    await poserValeur(numero!, '0');
    expect(poses[poses.length - 1]).toEqual({ book: 'livre-de-base', ch: '01', parts: [] });
  });

  it('l’index `00` n’est JAMAIS offert dans la liste : ce n’est pas un chapitre', async () => {
    // Le manifeste est bâti par `chapitresDe` → `prefixesDeChapitres` : un dossier qui porte
    // `00 - Index.md` n'en sort AUCUN chapitre `00`, donc la liste n'en offre aucun.
    expect(prefixesDeChapitres(['00 - Index.md', '07 - Peur.md', '21 - Psychologie.md'])).toEqual(['07', '21']);
    await monter(adresse(frag('terreur', 0, 0)), () => {});
    const liste = container?.querySelector('select[aria-label="Chapitre du passage"]') as HTMLSelectElement | null;
    expect([...liste!.options].map((o) => o.value)).not.toContain('00');
  });
});

describe('`DescRefField` — l’empreinte est RECALCULÉE, jamais saisie', () => {
  it('poser un dernier bloc plus loin REPOSE un `sum` différent, celui du nouveau texte', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter(adresse(frag('terreur', 0, 0)), (v) => poses.push(v));
    const b1 = champ('dernier bloc');
    expect(b1, 'le champ « dernier bloc » n’est pas rendu — le chapitre n’a pas été chargé').toBeTruthy();
    // Le libellé est VISIBLE (`NumberField variant="champ"`), pas seulement accessible.
    expect(b1!.labels?.[0]?.textContent, 'le champ n’a pas de libellé visible').toBe('dernier bloc');

    await poserValeur(b1!, '1');

    const dernier = poses[poses.length - 1];
    expect(dernier?.parts[0]).toMatchObject({ b0: 0, b1: 1 });
    expect(dernier?.parts[0].sum, 'l’empreinte n’a pas suivi le texte : elle a été recopiée').toBe(sumDe('terreur', 0, 1));
    expect(dernier?.parts[0].sum).not.toBe(sumDe('terreur', 0, 0));
  });

  it('une adresse HORS BORNES affiche la phrase d’auteur DANS la rangée du fragment, et aucune prose', async () => {
    await monter(adresse({ ...frag('terreur', 0, 0), b1: 9 }), () => {});
    expect(container?.querySelector('.de-warn')?.textContent).toBe(PHRASE_REFUS['bornes-hors-limites']);
    // Le code moteur reste disponible, mais REPLIÉ, jamais en tête.
    expect(container?.querySelector('details.fold')?.textContent).toContain('bornes-hors-limites');
    // L'aperçu reste RENDU, avec le fragment fautif MARQUÉ à sa place — l'auteur ne perd pas le texte.
    expect(container?.querySelector('.panel')?.textContent).toContain('[fragment 1 : non résolu]');
    // L'erreur vit DANS la rangée du fragment fautif, pas en pied de champ.
    expect(container?.querySelector('.de-reflrow .de-warn'), 'le message doit désigner SA rangée').toBeTruthy();
  });
});

describe('« + Fragment » — CONTINUE le montage, ou porte sa RAISON', () => {
  it('le fragment neuf prend le bloc SUIVANT : aucun passage n’est cité deux fois', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter(adresse(frag('terreur', 0, 0)), (v) => poses.push(v));
    await clic(bouton('+ Fragment')!);

    const pose = poses[poses.length - 1]!;
    expect(pose.parts).toHaveLength(2);
    expect(pose.parts[1]).toMatchObject({ sec: 'terreur', secOcc: 1, b0: 1, b1: 1 });
    expect(pose.parts[1].sum, 'le fragment neuf naît sans empreinte : il ne résout pas').toBeTruthy();

    // PREUVE SUR LE TEXTE RÉSOLU : le montage rend deux passages DISTINCTS, et il résout.
    const rendu = resoudreAdresse(PARSE, pose);
    expect(estErreur(rendu), `le montage neuf est refusé : ${JSON.stringify(rendu)}`).toBe(false);
    const morceaux = (rendu as { md: string }).md.split('\n\n');
    expect(morceaux).toHaveLength(2);
    expect(morceaux[0]).not.toBe(morceaux[1]);
  });

  it('le fragment neuf ne RECULE JAMAIS sur un bloc déjà cité — les trois états du montage résolvent', async () => {
    // Les trois états mesurés par le juge : un fragment, deux dans deux sections, et le cas où le
    // dernier fragment est SEUL dans la section précédente — le neuf doit trouver un passage LIBRE.
    for (const depart of [
      [frag('terreur', 0, 0)],
      [frag('terreur', 0, 0), frag('peur', 0, 0)],
      [frag('terreur', 1, 1), frag('peur', 0, 0)],
    ]) {
      const poses: (DescRef | undefined)[] = [];
      await monter(adresse(...depart), (v) => poses.push(v));
      await clic(bouton('+ Fragment')!);
      const pose = poses[poses.length - 1]!;
      expect(pose.parts.length, `aucun fragment posé depuis ${JSON.stringify(depart.map((f) => [f.sec, f.b0]))}`).toBe(depart.length + 1);
      const rendu = resoudreAdresse(PARSE, pose);
      expect(estErreur(rendu), `le montage neuf est refusé : ${JSON.stringify(rendu)}`).toBe(false);
      demonter();
    }
  });

  it('le fragment neuf passe à la SECTION suivante quand la section courante est épuisée', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter(adresse(frag('terreur', 0, 0), frag('terreur', 1, 1)), (v) => poses.push(v));
    await clic(bouton('+ Fragment')!);

    const pose = poses[poses.length - 1]!;
    expect(pose.parts[2]).toMatchObject({ sec: 'peur', secOcc: 1, b0: 0, b1: 0 });
    expect(estErreur(resoudreAdresse(PARSE, pose))).toBe(false);
  });

  it('à TROIS fragments, le bouton porte sa raison au lieu de se taire, et un clic ne pose rien', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter(adresse(frag('terreur', 0, 0), frag('terreur', 1, 1), frag('peur', 0, 0)), (v) => poses.push(v));
    const btn = bouton('+ Fragment')!;
    // `aria-disabled`, JAMAIS `disabled` : la raison doit rester atteignable au clavier et au doigt.
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(false);
    expect(document.getElementById(btn.getAttribute('aria-describedby') ?? '')?.textContent).toContain('trois fragments au plus');
    await clic(btn);
    expect(poses, 'un clic sur un bouton refusé ne doit RIEN poser').toHaveLength(0);
  });

  it('sur un chapitre SANS bloc adressable, le bouton porte l’autre raison', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter({ book: 'livre-de-base', ch: '23', parts: [] }, (v) => poses.push(v));
    const btn = bouton('+ Fragment')!;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(btn.getAttribute('aria-describedby') ?? '')?.textContent).toContain('aucun bloc adressable');
    await clic(btn);
    expect(poses).toHaveLength(0);
  });
});

describe('REFUS « cellule » — raison au survol/focus, jamais inline', () => {
  it('le segment refusé porte `aria-disabled`, sa raison liée, et son clic est inerte', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter(adresse(frag('terreur', 0, 0)), (v) => poses.push(v));
    const segs = [...(container?.querySelectorAll('.seg button') ?? [])] as HTMLButtonElement[];
    const cellule = segs.find((b) => b.textContent?.trim() === 'cellule')!;
    expect(cellule.getAttribute('aria-disabled'), 'le segment refusé doit rester focalisable').toBe('true');
    expect(cellule.hasAttribute('disabled'), '`disabled` sortirait le segment du clavier et du tap').toBe(false);
    expect(document.getElementById(cellule.getAttribute('aria-describedby') ?? '')?.textContent).toContain('aucune table');
    // La raison n'est PAS écrite sous l'option (arbitrage user 2026-08-24).
    expect(container?.querySelector('.de-warn')).toBeNull();
    await clic(cellule);
    expect(poses, 'un segment refusé ne doit rien poser').toHaveLength(0);
  });
});

describe('« + Fragment » APRÈS UNE CELLULE — le chapitre n’est pas « épuisé »', () => {
  const PARSE24 = parseChapitre(CHAPITRE_TABLE);
  const CELLULE: Fragment = (() => {
    const brouillon: Fragment = { kind: 'cellule', sec: 'blessures', secOcc: 1, row: 'Bras', col: 'Séquelle', sum: '' };
    const sum = empreinteDe(PARSE24, brouillon);
    if (typeof sum !== 'string') throw new Error(`fixture de cellule non résoluble : ${sum.error}`);
    return { ...brouillon, sum };
  })();

  it('un montage qui commence par une CELLULE continue sur un bloc LIBRE de la section', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter({ book: 'livre-de-base', ch: '24', parts: [CELLULE] }, (v) => poses.push(v));

    const btn = bouton('+ Fragment')!;
    expect(btn.getAttribute('aria-disabled'), 'refusé alors que la section garde des blocs libres').not.toBe('true');
    await clic(btn);

    const pose = poses[poses.length - 1]!;
    expect(pose.parts, 'aucun fragment posé après une cellule').toHaveLength(2);
    expect(pose.parts[1].kind).toBe('blocs');
    const rendu = resoudreAdresse(PARSE24, pose);
    expect(estErreur(rendu), `le montage neuf est refusé : ${JSON.stringify(rendu)}`).toBe(false);
  });

  it('une CELLULE d’un mot n’est plus « trop courte » : le montage qu’elle ouvre RÉSOUT', async () => {
    // Règle D : le plancher de 40 caractères ne vise que les fragments `blocs`. « Assommé. » est
    // adressée EXACTEMENT (section, ligne, colonne) — lui opposer « étendez les bornes de blocs »
    // était un remède impossible (mesuré en recette sur la table des races, ch. 04).
    const courte: Fragment = { kind: 'cellule', sec: 'blessures', secOcc: 1, row: 'Tete', col: 'Séquelle', sum: '' };
    const sum = empreinteDe(PARSE24, courte);
    if (typeof sum !== 'string') throw new Error(`fixture non résoluble : ${sum.error}`);
    const seule = { book: 'livre-de-base', ch: '24', parts: [{ ...courte, sum }] };
    expect(estErreur(resoudreAdresse(PARSE24, seule)), 'PRÉMISSE : la cellule seule doit résoudre').toBe(false);

    const poses: (DescRef | undefined)[] = [];
    await monter(seule, (v) => poses.push(v));
    const btn = bouton('+ Fragment')!;
    expect(btn.getAttribute('aria-disabled'), '« chapitre épuisé » alors que la section a des blocs libres').not.toBe('true');
    await clic(btn);

    const pose = poses[poses.length - 1]!;
    expect(pose.parts).toHaveLength(2);
    const rendu = resoudreAdresse(PARSE24, pose);
    expect(estErreur(rendu), `le montage cellule + blocs est refusé : ${JSON.stringify(rendu)}`).toBe(false);
  });
});

describe('les tables d’une section — celles du lecteur canonique `tablesOf` (#1739)', () => {
  it('lignes et colonnes offertes = celles de `tablesOf` : la bannière absorbée n’est ni un en-tête ni une ligne', async () => {
    const parse = parseChapitre(CHAPITRE_TITRES);
    const brouillon: Fragment = { kind: 'cellule', sec: 'tables', secOcc: 1, row: '2 m', col: 'Dégâts', sum: '' };
    const sum = empreinteDe(parse, brouillon);
    if (typeof sum !== 'string') throw new Error(`fixture non résoluble : ${sum.error}`);
    await monter({ book: 'livre-de-base', ch: '25', parts: [{ ...brouillon, sum }] }, () => {});
    const options = (nom: string) => [...(container?.querySelector(`select[aria-label="Fragment 1 — ${nom} de la table"]`)?.querySelectorAll('option') ?? [])].map((o) => o.textContent);
    const tables = tablesOf(parse.sections.find((s) => s.slug === 'tables')!);
    expect(options('colonne')).toEqual(['Hauteur', 'Dégâts']);
    expect(options('ligne')).toEqual(tables.flatMap((t) => t.table.rows.map((r) => r[0])));
    expect(options('colonne')).not.toContain('TABLEAU DES MOUVEMENTS');
  });

  const scelle = (over: Partial<Fragment>) => {
    const brouillon = { kind: 'cellule', sec: 'tables', secOcc: 1, row: 'Marche', col: 'Allure', sum: '', ...over } as Fragment;
    const sum = empreinteDe(parseChapitre(CHAPITRE_TITRES), brouillon);
    if (typeof sum !== 'string') throw new Error(`fixture non résoluble : ${sum.error}`);
    return { book: 'livre-de-base', ch: '25', parts: [{ ...brouillon, sum }] } as DescRef;
  };
  const combo = (nom: string) => container?.querySelector(`select[aria-label="Fragment 1 — ${nom}"]`) as HTMLSelectElement | null;

  it('une clé de ligne AMBIGUË entre tables titrées fait paraître le choix de la table ; le choisir pose `table`', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monterVivant(scelle({ table: 'tableau des mouvements#1' }), (v) => poses.push(v));
    const table = combo('table de la ligne');
    expect([...(table?.options ?? [])].map((o) => o.value)).toEqual(['', 'tableau des mouvements#1', 'tableau des chutes#1']);
    expect(table?.value).toBe('tableau des mouvements#1');
    await poserValeur(table!, 'tableau des chutes#1');
    expect((poses[poses.length - 1]!.parts[0] as { table?: string }).table).toBe('tableau des chutes#1');
  });

  const brut = (over: Partial<FragmentCellule>): DescRef =>
    ({ book: 'livre-de-base', ch: '25', parts: [{ kind: 'cellule', sec: 'tables', secOcc: 1, row: 'Marche', col: 'Allure', sum: '', ...over }] });
  const textes = (el: HTMLSelectElement | null) => [...(el?.options ?? [])].map((o) => o.textContent);

  it('le choix de table se LIT au titre, avec un rang seulement entre tables de même titre', async () => {
    await monter(scelle({ table: 'tableau des mouvements#1' }), () => {});
    expect(textes(combo('table de la ligne'))).toEqual(['—', 'TABLEAU DES MOUVEMENTS', 'TABLEAU DES CHUTES (1)']);
  });

  it('une ligne dans une table TITRÉE et une SANS titre : le choix paraît, et ne propose que la titrée', async () => {
    await monter(brut({ row: 'Saut', col: 'Dégâts' }), () => {});
    const table = combo('table de la ligne');
    expect([...(table?.options ?? [])].map((o) => o.value)).toEqual(['', 'tableau des chutes#2']);
    expect(textes(table)).toEqual(['—', 'TABLEAU DES CHUTES (2)']);
  });

  it('une ligne, une colonne ou une table ABSENTE reste la valeur affichée de son combo, nommée comme telle', async () => {
    await monter(brut({ row: 'Envol', col: 'Inconnue', table: 'tableau des vols#1' }), () => {});
    expect(combo('ligne de la table')?.value).toBe('Envol');
    expect(combo('colonne de la table')?.value).toBe('Inconnue');
    expect(combo('table de la ligne')?.value).toBe('tableau des vols#1');
    expect(textes(combo('colonne de la table'))[0]).toBe('Inconnue — colonne absente de la section');
    expect(textes(combo('table de la ligne'))[1]).toBe('table absente de la section');
  });

  it('une table POSÉE hors de la ligne se nomme par son TITRE, jamais par sa clé moteur', async () => {
    await monter(brut({ row: '2 m', col: 'Dégâts', table: 'tableau des mouvements#1' }), () => {});
    expect(textes(combo('table de la ligne'))).toEqual(['—', 'TABLEAU DES MOUVEMENTS — table absente de la ligne', 'TABLEAU DES CHUTES (1)']);
  });

  it('une ligne AMBIGUË dont la rangée propose la table dit de CHOISIR la table', async () => {
    await monter(brut({ row: 'Marche', col: 'Allure' }), () => {});
    expect(combo('table de la ligne')).not.toBeNull();
    expect(container?.querySelector('[data-fragment="0"] .de-warn')?.textContent).toBe(PHRASE_LIGNE_AMBIGUE_TABLE);
  });

  it('les colonnes offertes sont celles des tables qui PORTENT la ligne — celle de `table` s’il est posé', async () => {
    const colonnes = () => [...(combo('colonne de la table')?.options ?? [])].map((o) => o.value);
    await monter(brut({ row: '2 m', col: 'Dégâts' }), () => {});
    expect(colonnes(), 'la ligne « 2 m » ne propose pas « Allure »').toEqual(['Hauteur', 'Dégâts']);
    demonter();
    await monter(brut({ row: 'Marche', col: 'Allure', table: 'tableau des mouvements#1' }), () => {});
    expect(colonnes()).toEqual(['Mouvement', 'Allure', 'Course']);
    demonter();
    await monter(brut({ row: 'Saut', col: 'Dégâts' }), () => {});
    expect(colonnes()).toEqual(['Élan', 'Bonus', 'Hauteur', 'Dégâts']);
    demonter();
    await monter(brut({ row: '2 m', col: 'Allure' }), () => {});
    expect(colonnes()[0], 'la colonne courante hors de la table de la ligne reste affichée').toBe('Allure');
  });

  it('une clé de ligne UNIQUE ne montre aucun choix de table', async () => {
    await monter(scelle({ row: '2 m', col: 'Dégâts' }), () => {});
    expect(combo('table de la ligne')).toBeNull();
  });

  it('changer de LIGNE retire le `table` choisi pour l’ancienne', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monterVivant(scelle({ table: 'tableau des mouvements#1' }), (v) => poses.push(v));
    await poserValeur(combo('ligne de la table')!, '2 m');
    expect(poses[poses.length - 1]!.parts[0]).not.toHaveProperty('table');
  });
});

describe('« + Fragment » — ce que l’ajout FERAIT NAÎTRE se dit, et n’est pas un chapitre épuisé', () => {
  it('un fragment de BLOCS trop court résout SEUL, et « + Fragment » refuse en NOMMANT la cause', async () => {
    // PRÉMISSE explicite : « Bref. » (bloc 2 de § terreur) fait moins de 40 caractères normalisés,
    // mais les seuils de la règle D ne mordent qu'à partir de DEUX fragments — l'adresse est donc
    // saine avant le clic. Ajouter quoi que ce soit la ferait basculer en montage et abîmerait CE
    // fragment-là : aucun autre candidat n'y changerait rien, et « chapitre épuisé » enverrait
    // l'auteur chercher au mauvais endroit.
    const seul = adresse(frag('terreur', 2, 2));
    expect(estErreur(resoudreAdresse(PARSE, seul)), 'PRÉMISSE : le fragment court doit résoudre SEUL').toBe(false);
    expect(
      estErreur(resoudreAdresse(PARSE, adresse(frag('terreur', 2, 2), frag('peur', 0, 0)))),
      'PRÉMISSE : le même fragment en MONTAGE doit être refusé',
    ).toBe(true);

    const poses: (DescRef | undefined)[] = [];
    await monter(seul, (v) => poses.push(v));

    const btn = bouton('+ Fragment')!;
    expect(btn.getAttribute('aria-disabled'), 'le bouton devrait refuser : l’ajout abîmerait le fragment 1').toBe('true');
    // SA raison, pas la première de l'écran : le champ en porte d'autres (le segment « cellule »).
    // C'est `aria-describedby` qui apparie le bouton à sa copie hors écran — l'id vient de `useId`
    // et contient des `:`, donc `getElementById`, jamais un sélecteur CSS.
    const idRaison = btn.getAttribute('aria-describedby') ?? '';
    expect(idRaison, 'le bouton refusé doit désigner sa raison').not.toBe('');
    const raison = document.getElementById(idRaison)?.textContent ?? '';
    expect(raison, `raison lue : « ${raison} »`).toContain('rendrait le fragment 1 trop court');
    expect(raison, 'la raison DÉSIGNE le geste qui la lève').toContain('étendez d’abord ses bornes de blocs');
    expect(raison, '« chapitre épuisé » est faux ici : la section a des blocs libres').not.toContain('aucun bloc adressable');

    await clic(btn);
    expect(poses, 'un bouton refusé ne pose rien').toHaveLength(0);
  });

  it('une adresse DÉJÀ fautive ne condamne pas les candidats — la faute reste la SIENNE', async () => {
    // Empreinte divergente sur l'unique fragment : la faute existe AVANT tout ajout, avec le même
    // code et le même indice après. Un candidat ne l'a pas causée, donc il tient.
    const abime = { ...frag('terreur', 0, 0), sum: '0'.repeat(16) };
    const avant = resoudreAdresse(PARSE, adresse(abime));
    expect(estErreur(avant) && avant.error, 'PRÉMISSE : l’adresse doit être fautive AVANT le clic').toBe('empreinte-divergente');

    const poses: (DescRef | undefined)[] = [];
    await monter(adresse(abime), (v) => poses.push(v));
    const btn = bouton('+ Fragment')!;
    expect(btn.getAttribute('aria-disabled'), 'une adresse déjà fautive ne doit condamner aucun candidat').not.toBe('true');
    await clic(btn);

    const pose = poses[poses.length - 1]!;
    expect(pose.parts).toHaveLength(2);
    const apres = resoudreAdresse(PARSE, pose);
    expect(estErreur(apres) && apres.fragment, 'la faute a changé de fragment').toBe(0);
  });
});

describe('CHANGER DE CHAPITRE — l’amorce ne cite jamais l’ANCIEN', () => {
  it('le fragment amorcé appartient au NOUVEAU chapitre, et aucune rangée fautive n’apparaît', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monterVivant(adresse(frag('terreur', 0, 0)), (v) => poses.push(v));

    const liste = container?.querySelector('select[aria-label="Chapitre du passage"]') as HTMLSelectElement;
    await poserValeur(liste, '22');
    await laisserPoser();

    const pose = poses[poses.length - 1]!;
    expect(pose.ch).toBe('22');
    expect(pose.parts, 'le nouveau chapitre doit être amorcé').toHaveLength(1);
    // § terreur n'existe pas dans le ch. 22 : une amorce sur les sections PÉRIMÉES la citerait.
    expect(pose.parts[0].sec, 'l’amorce a cité une section de l’ANCIEN chapitre').toBe('corruption');
    expect(container?.querySelector('.de-warn'), 'aucun refus ne doit s’afficher entre deux chapitres').toBeNull();
  });

  // PAS de cas « course 21 → 22 → 23 » ici : il ne serait jamais rouge. Écrit puis MESURÉ par
  // mutation — couper l'appariement (`charge.book/ch`) le laisse vert (le drapeau `vivant` du
  // nettoyage d'effet jette déjà la réponse tardive), et couper `vivant` le laisse vert aussi
  // (l'appariement refuse la réponse posée). Deux mécanismes indépendants qui suffisent chacun :
  // aucun DÉBRANCHEMENT SIMPLE ne rend l'état périmé observable, donc un tel cas ne prouverait pas
  // le câblage qu'il prétend tenir. Le contrat de l'appariement est prouvé par le cas ci-dessus,
  // rouge à sa coupe ; la redondance est documentée là où elle vit (`DescRefField.tsx`).
});

describe('RESCELLER — un geste de l’auteur, jamais automatique', () => {
  it('un geste sur UN fragment ne rescelle pas les AUTRES', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monterVivant(adresse(frag('terreur', 0, 0), { ...frag('peur', 0, 0), sum: '0'.repeat(16) }), (v) => poses.push(v));

    // Geste sur le PREMIER fragment : son « dernier bloc » passe à 1.
    await poserValeur(champ('dernier bloc')!, '1');

    const pose = poses[poses.length - 1]!;
    expect(pose.parts[0].sum, 'le fragment MUTÉ doit être rescellé').toBe(sumDe('terreur', 0, 1));
    expect(pose.parts[1].sum, 'le fragment NON TOUCHÉ a été rescellé en silence : l’adresse ferait foi sur un texte jamais relu').toBe('0'.repeat(16));
    // Et l'avertissement reste à l'écran, avec son geste.
    expect(container?.textContent).toContain(PHRASE_REFUS['empreinte-divergente']);
    expect(bouton('Resceller après relecture')).toBeTruthy();
  });

  it('une empreinte divergente offre « Resceller après relecture », et le clic repose des `sum` justes', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter(adresse({ ...frag('terreur', 0, 0), sum: '0'.repeat(16) }), (v) => poses.push(v));

    expect(container?.querySelector('.de-warn')?.textContent).toBe(PHRASE_REFUS['empreinte-divergente']);
    const btn = bouton('Resceller après relecture');
    expect(btn, 'aucune affordance pour resceller — la phrase promettrait un geste inexistant').toBeTruthy();
    // Rien n'a été rescellé TOUT SEUL : l'adresse posée n'a pas bougé sans geste.
    expect(poses, 'le rescellement ne doit JAMAIS être automatique').toHaveLength(0);

    await clic(btn!);
    const pose = poses[poses.length - 1]!;
    expect(pose.parts[0].sum).toBe(sumDe('terreur', 0, 0));
    expect(estErreur(resoudreAdresse(PARSE, pose))).toBe(false);
  });
});

describe('AMORCE et APERÇU — un chapitre choisi n’attend pas', () => {
  it('choisir un chapitre AMORCE un fragment, avec son empreinte', async () => {
    const poses: (DescRef | undefined)[] = [];
    await monter({ book: 'livre-de-base', ch: '21', parts: [] }, (v) => poses.push(v));
    const pose = poses[poses.length - 1];
    expect(pose?.parts, 'le champ doit amorcer un premier fragment').toHaveLength(1);
    // La première section TITRÉE à blocs, jamais le préambule d'extraction.
    expect(pose?.parts[0]).toMatchObject({ sec: 'terreur', secOcc: 1, b0: 0, b1: 0 });
    expect(pose?.parts[0].sum).toBe(sumDe('terreur', 0, 0));
  });

  it('un montage à UN fragment fautif garde l’aperçu des VALIDES, et marque le fautif à sa place', async () => {
    await monter(adresse(frag('terreur', 0, 0), { ...frag('peur', 0, 0), b1: 9 }), () => {});
    const apercu = container?.querySelector('.panel')?.textContent ?? '';
    expect(apercu, 'le texte du fragment VALIDE a disparu').toContain('glacent le sang');
    expect(apercu).toContain('[fragment 2 : non résolu]');
  });

  it('une erreur de MONTAGE DÉSIGNE sa rangée (2ᵉ fragment trop court)', async () => {
    // Le 3ᵉ bloc de § terreur (« Bref. ») fait moins de 40 caractères normalisés.
    await monter(adresse(frag('terreur', 0, 0), frag('terreur', 2, 2)), () => {});
    const rangees = [...(container?.querySelectorAll('.de-reflrow') ?? [])];
    const avec = rangees.filter((r) => r.querySelector('.de-warn'));
    expect(avec, 'une seule rangée doit porter le refus').toHaveLength(1);
    expect(avec[0].textContent).toContain(PHRASE_REFUS['fragment-trop-court']);
    // C'est bien la DEUXIÈME rangée de fragment (la première est saine).
    expect(rangees.indexOf(avec[0])).toBe(rangees.findIndex((r) => r.querySelector('select[aria-label^="Section du fragment"]')) + 1);
  });
});

describe('CHARGEMENT — un chapitre absent se dit en français', () => {
  it('l’erreur du chargeur est une phrase, le message technique est replié', async () => {
    await monter({ book: 'mer-des-griffes', ch: '98', parts: [] }, () => {});
    expect(container?.querySelector('.de-warn')?.textContent).toBe('Ce chapitre n’a pas pu être chargé — vérifiez le livre et son numéro.');
    expect(container?.querySelector('details.fold')?.textContent).toContain('chapitre-introuvable : mer-des-griffes ch.98');
  });
});
