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
 * DÉTECTION : `scripts/guards/lib/raccourcisGlobaux.mjs`.
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
import { LIGNES_ENTETE, fautesClavier, marquesHorsRegistre, verdictClavier } from '../../scripts/guards/lib/raccourcisGlobaux.mjs';

/** Témoin : un fichier seul, sous un chemin neutre. */
const temoin = (text: string) => verdictClavier({ rel: 'temoin.ts', text });

describe('raccourcis — un seul lecteur de clavier global', () => {
  it('tout écouteur clavier GLOBAL est le lecteur du registre, ou se déclare hors registre par nature', () => {
    expect(fautesClavier(readCorpus(['src']))).toEqual([]);
  });

  it('une marque enfouie EN BAS de fichier n’exempte rien — elle s’ancre dans l’en-tête', () => {
    const ecouteur = "window.addEventListener('keydown', onKey);\n";
    const enBas = 'const x = 1;\n'.repeat(LIGNES_ENTETE) + ecouteur
      + '// @clavier-hors-registre une raison posée là où personne ne la lit\n';
    expect(temoin(enBas)).toMatch(/hors de l'EN-TÊTE/);
    const enHaut = '/** @clavier-hors-registre la couche du dessus possède la touche. */\n'
      + 'const x = 1;\n'.repeat(LIGNES_ENTETE) + ecouteur;
    expect(temoin(enHaut)).toBeNull();
  });

  it('un type d’événement VARIABLE se résout : table locale, boucle, rappel `forEach`', () => {
    const delegue = 'const PHASES = { mouseover: false, keydown: true };\n'
      + 'for (const [type, capture] of Object.entries(PHASES)) document.addEventListener(type, f, capture);\n';
    expect(temoin(delegue)).toMatch(/hors du registre/);
    expect(temoin("const SUITE = ['pointermove', 'pointerup'];\nfor (const t of SUITE) window.addEventListener(t, f);\n")).toBeNull();
    expect(temoin("const T = ['keyup'] as const;\nT.forEach((t) => window.addEventListener(t, f));\n")).toMatch(/hors du registre/);
    expect(temoin('const TYPE = "keydown";\ndocument.addEventListener(TYPE, f);\n')).toMatch(/hors du registre/);
    expect(temoin('function poser(type: string) { window.addEventListener(type, f); }\n')).toMatch(/NON RÉSOLU/);
  });

  it('la CLASSE, pas la co-occurrence : écouteur local, mot en commentaire, table importée, gabarit', () => {
    expect(temoin("window.addEventListener('pointermove', f);\nbouton.addEventListener('keydown', g);\n"),
      'un écouteur clavier LOCAL à côté d’un écouteur global de pointeur').toBeNull();
    expect(temoin("// 'keydown' n'est ici qu'un mot\nconst T = ['pointermove'];\nfor (const t of T) window.addEventListener(t, f);\n"),
      '« keydown » dans un commentaire').toBeNull();
    const table = { rel: 'src/x/types.ts', text: "export const TYPES = ['keydown', 'keyup'] as const;\n" };
    const lecteur = { rel: 'src/x/lecteur.ts', text: "import { TYPES } from './types';\nfor (const t of TYPES) document.addEventListener(t, f);\n" };
    expect(verdictClavier(lecteur, [table, lecteur]), 'table importée d’un module du dépôt')
      .toMatch(/hors du registre/);
    expect(temoin('window.addEventListener(`keydown`, f);\n'), 'gabarit sans trou').toMatch(/hors du registre/);
  });

  it('« lecteur du registre » = un IMPORT réel, jamais la mention `KEYBINDINGS` en commentaire', () => {
    const ecouteur = "window.addEventListener('keydown', onKey);\n";
    expect(temoin('// cf. KEYBINDINGS pour le reste\n' + ecouteur)).toMatch(/hors du registre/);
    expect(temoin("import { KEYBINDINGS } from '../state/keybindings';\n" + ecouteur)).toBeNull();
  });

  it('les couches déclarées hors registre EXISTENT et posent bien un écouteur (aucune marque morte)', () => {
    const { marques, mortes } = marquesHorsRegistre(readCorpus(['src']));
    expect(marques.length, 'la marque doit rester un fait mesuré, pas un vœu').toBeGreaterThan(0);
    expect(mortes, 'marque « @clavier-hors-registre » sans écouteur clavier global').toEqual([]);
  });

  it('le registre et son hook raisonnent en POSITIONS de touche (`e.code`), jamais en caractères', () => {
    const surKey = readCorpus(['src'])
      .filter(({ rel }) => /state[\\/]keybindings\.ts$|ui[\\/]useGameKeyboard\.ts$|state[\\/]resoudreEchap\.ts$/.test(rel))
      .filter(({ text }) => /\be\.key\b/.test(text))
      .map(({ rel }) => rel);
    expect(surKey, '`e.key` est le CARACTÈRE : il ment sur un clavier AZERTY').toEqual([]);
  });
});
