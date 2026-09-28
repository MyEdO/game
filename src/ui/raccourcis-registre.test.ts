/**
 * GARDE STRUCTURELLE — UN SEUL LECTEUR DE CLAVIER GLOBAL (#1687 lot 0).
 *
 * Verbatim utilisateur (2026-09-09) : « faut que l'ensemble des raccourci soit cohérent. » Un
 * raccourci d'application vit dans `state/keybindings.ts` et n'est lu que par le hook unique
 * `ui/useGameKeyboard.ts` : remappable à l'écran Options, arbitré par un seul `find`, sans collision
 * silencieuse. Un `window.addEventListener('keydown')` posé ailleurs ré-ouvre exactement ce qui a été
 * fermé — l'éditeur avait ainsi trois listeners, dont deux sur `e.key` (donc faux en AZERTY).
 *
 * CE QUE CETTE GARDE MESURE, exactement (contrat POSITIF, par SIGNAL STRUCTUREL — jamais une liste de
 * chemins) :
 *  1. tout fichier de `src/**` qui pose un écouteur clavier GLOBAL (sur `window` ou `document`) est
 *     soit le LECTEUR du registre — signal : un `import { … KEYBINDINGS … } from '…/keybindings'`
 *     RÉEL, jamais la simple mention du mot dans un commentaire —, soit une couche déclarée HORS
 *     registre PAR NATURE : marque `@clavier-hors-registre <raison>` ANCRÉE dans l'EN-TÊTE du
 *     fichier (ses `LIGNES_ENTETE` premières lignes), là où tombe l'œil de qui l'ouvre — une marque
 *     enfouie en bas de fichier n'exempte rien : l'exemption est AU SITE et se lit d'emblée ;
 *  2. toute marque `@clavier-hors-registre` correspond à un écouteur RÉEL (aucune marque morte) ;
 *  3. le registre, son hook et `resoudreEchap` ne lisent jamais `e.key` : les touches sont des
 *     POSITIONS (`e.code`).
 *
 * PÉRIMÈTRE RESTANT, hors de cette garde et NOMMÉ comme un lot de #1687 (garde « jeu FERMÉ ∪
 * `rovingKeyDown` ») : les `onKeyDown` de JSX — 20 sites hors tests, dans 15 fichiers (mesuré
 * 2026-09-09). 7 sont produits par la primitive `rovingKeyDown` (`ui/rovingFocus.ts`, 4 fichiers) ;
 * les 13 autres ne comparent qu'un jeu FERMÉ de touches de contrôle (`Enter`, `' '`, `Escape`,
 * flèches, `Home`/`End`, `ContextMenu`, Maj+`F10`), dont deux roulent leur roving à la main
 * (`ui/CareerPath.tsx`, `ui/PartyScreen.tsx`). Aucun n'est un raccourci d'application — mais aucun
 * SIGNAL STRUCTUREL ne l'atteste : c'est ce que le lot pose (un `onKeyDown` de JSX compose
 * `rovingKeyDown`, ou ne compare que ce jeu fermé).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/** Pose d'un écouteur clavier GLOBAL : la cible est la fenêtre ou le document, pas un nœud du rendu ;
 *  le type est un littéral clavier, ou une VARIABLE dans un fichier qui nomme un type clavier (littéral
 *  ou clé d'objet) — une table de types délégués n'échappe pas à la garde. */
const ECOUTEUR_LITTERAL = /\b(?:window|document)\.addEventListener\(\s*['"]key(?:down|up)['"]/;
const ECOUTEUR_A_TYPE_VARIABLE = /\b(?:window|document)\.addEventListener\(\s*[A-Za-z_$]/;
const TYPE_CLAVIER_NOMME = /['"]key(?:down|up)['"]|\bkey(?:down|up)\s*:/;
const ecouteurGlobal = (text: string): boolean =>
  ECOUTEUR_LITTERAL.test(text) || (ECOUTEUR_A_TYPE_VARIABLE.test(text) && TYPE_CLAVIER_NOMME.test(text));
/** Déclaration, DANS le fichier, qu'il porte une couche clavier hors registre par nature. */
const MARQUE_HORS_REGISTRE = /@clavier-hors-registre\s+\S/;
/** Signal du LECTEUR du registre : il en IMPORTE la table (une mention en commentaire n'est rien). */
const IMPORTE_LE_REGISTRE = /import\s*(?:type\s*)?\{[^}]*\bKEYBINDINGS\b[^}]*\}\s*from\s*['"][^'"]*keybindings['"]/;
/** EN-TÊTE d'un fichier : ce qu'on lit en l'ouvrant. L'exemption s'y ancre, ou elle n'existe pas. */
const LIGNES_ENTETE = 40;
const enTete = (text: string): string => text.split('\n').slice(0, LIGNES_ENTETE).join('\n');

/** Le fichier est-il en règle ? `null` = oui, sinon la RAISON du refus. */
function verdictClavier(text: string): string | null {
  if (!ecouteurGlobal(text)) return null;
  if (IMPORTE_LE_REGISTRE.test(text)) return null;
  if (MARQUE_HORS_REGISTRE.test(enTete(text))) return null;
  return MARQUE_HORS_REGISTRE.test(text)
    ? `marque « @clavier-hors-registre » hors de l'EN-TÊTE (${LIGNES_ENTETE} premières lignes) — `
      + "l'exemption se lit d'emblée, au SITE, ou elle n'exempte rien"
    : 'écouteur clavier global hors du registre — pose le raccourci dans `state/keybindings.ts` '
      + "(le hook `useGameKeyboard` le jouera), ou déclare la couche dans l'en-tête du fichier par "
      + '« @clavier-hors-registre <raison> »';
}

const CORPUS = readCorpus(['src']);

describe('raccourcis — un seul lecteur de clavier global', () => {
  it('tout écouteur clavier GLOBAL est le lecteur du registre, ou se déclare hors registre par nature', () => {
    const fautes = CORPUS
      .map(({ rel, text }) => ({ rel, raison: verdictClavier(text) }))
      .filter(({ raison }) => raison !== null)
      .map(({ rel, raison }) => `${rel} : ${raison}`);
    expect(fautes).toEqual([]);
  });

  it('une marque enfouie EN BAS de fichier n’exempte rien — elle s’ancre dans l’en-tête', () => {
    const ecouteur = "window.addEventListener('keydown', onKey);\n";
    const enBas = 'const x = 1;\n'.repeat(LIGNES_ENTETE) + ecouteur
      + '// @clavier-hors-registre une raison posée là où personne ne la lit\n';
    expect(verdictClavier(enBas)).toMatch(/hors de l'EN-TÊTE/);
    const enHaut = '/** @clavier-hors-registre la couche du dessus possède la touche. */\n'
      + 'const x = 1;\n'.repeat(LIGNES_ENTETE) + ecouteur;
    expect(verdictClavier(enHaut)).toBeNull();
  });

  it('un type d’événement VARIABLE (table de délégation) est un écouteur clavier dès qu’un type clavier est nommé', () => {
    const delegue = 'const PHASES = { mouseover: false, keydown: true };\n'
      + 'for (const [type, capture] of Object.entries(PHASES)) document.addEventListener(type, f, capture);\n';
    expect(verdictClavier(delegue)).toMatch(/hors du registre/);
    expect(verdictClavier("const SUITE = ['pointermove', 'pointerup'];\nfor (const t of SUITE) window.addEventListener(t, f);\n")).toBeNull();
  });

  it('« lecteur du registre » = un IMPORT réel, jamais la mention `KEYBINDINGS` en commentaire', () => {
    const ecouteur = "window.addEventListener('keydown', onKey);\n";
    expect(verdictClavier('// cf. KEYBINDINGS pour le reste\n' + ecouteur)).toMatch(/hors du registre/);
    expect(verdictClavier("import { KEYBINDINGS } from '../state/keybindings';\n" + ecouteur)).toBeNull();
  });

  it('les couches déclarées hors registre EXISTENT et posent bien un écouteur (aucune marque morte)', () => {
    const marques = CORPUS.filter(({ text }) => MARQUE_HORS_REGISTRE.test(text));
    expect(marques.length, 'la marque doit rester un fait mesuré, pas un vœu').toBeGreaterThan(0);
    const mortes = marques.filter(({ text }) => !ecouteurGlobal(text)).map(({ rel }) => rel);
    expect(mortes, 'marque « @clavier-hors-registre » sans écouteur clavier global').toEqual([]);
  });

  it('le registre et son hook raisonnent en POSITIONS de touche (`e.code`), jamais en caractères', () => {
    const surKey = CORPUS
      .filter(({ rel }) => /state[\\/]keybindings\.ts$|ui[\\/]useGameKeyboard\.ts$|state[\\/]resoudreEchap\.ts$/.test(rel))
      .filter(({ text }) => /\be\.key\b/.test(text))
      .map(({ rel }) => rel);
    expect(surKey, '`e.key` est le CARACTÈRE : il ment sur un clavier AZERTY').toEqual([]);
  });
});
