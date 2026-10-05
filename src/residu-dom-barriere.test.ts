// @vitest-environment jsdom
/**
 * Barrières de fin de test de `src/test-setup.ts` (#1619, #2286) : nœuds laissés dans `document.body`
 * ou `document.head`, dérive des registres d'art. Un fichier qui laisse un résidu échoue CHEZ LUI,
 * sans exception, et le résidu est retiré après le verdict : le test suivant part d'un état vierge.
 */
import { describe, it, expect, onTestFinished } from 'vitest';
import { residusDom, cleFichierTest, messageResiduDom, rigArtRegistrySignatures } from './test-setup';
import { ARMOUR } from './gameIso/rig/parts/armour';

// src/portable-paths-guard.test.ts:51
const LECTEUR = 'C' + ':';

describe('barrière de fuite DOM — verdict', () => {
  it('nomme le fichier, le conteneur ET les nœuds laissés', () => {
    const div = document.createElement('div');
    div.className = 'fuite-jouet';
    document.body.appendChild(div);
    try {
      const residus = residusDom(document.body);
      expect(residus).toEqual(['<div class="fuite-jouet">']);
      const msg = messageResiduDom('src/ui/JouetQuiFuit.test.tsx', 'document.body', residus);
      expect(msg).toContain('dans document.body par src/ui/JouetQuiFuit.test.tsx');
      expect(msg).toContain('<div class="fuite-jouet">');
    } finally {
      div.remove();
    }
  });

  it('aucun fichier n’est toléré : tout résidu se dit, un conteneur vide se tait', () => {
    expect(messageResiduDom('src/ui/Quelconque.test.tsx', 'document.head', ['<style>'])).toContain(
      'dans document.head par src/ui/Quelconque.test.tsx',
    );
    expect(messageResiduDom('src/ui/JouetQuiFuit.test.tsx', 'document.body', [])).toBeNull();
    expect(residusDom(document.body)).toEqual([]);
  });

  it('la clé du fichier est le chemin POSIX relatif à la racine, quelle que soit la séparation', () => {
    expect(cleFichierTest(LECTEUR + '\\dépôt\\src\\ui\\A.test.tsx', LECTEUR + '\\dépôt')).toBe('src/ui/A.test.tsx');
    expect(cleFichierTest('/dépôt/src/ui/A.test.tsx', '/dépôt')).toBe('src/ui/A.test.tsx');
  });
});

// `fails` : chaque fautif DOIT échouer, et seul le teardown de `src/test-setup.ts` peut l'y conduire —
// son corps n'asserte rien et ne retire rien. `onTestFinished` joue APRÈS les `afterEach` : il ne fait
// que capturer l'erreur. Le test qui suit constate le verdict ET la remise à vierge.
const erreursDe = (task: { result?: { errors?: readonly { message?: unknown }[] } }) =>
  (task.result?.errors ?? []).map((e) => String(e.message));

describe('barrière de fuite DOM — câblage réel au teardown', () => {
  let erreursBody: string[] = [];
  let erreursHead: string[] = [];

  it.fails('un hôte laissé dans document.body fait échouer le test qui l’a posé', () => {
    const hote = document.createElement('div');
    hote.className = 'hote-oublie';
    document.body.appendChild(hote);
    onTestFinished(({ task }) => {
      erreursBody = erreursDe(task);
    });
  });

  it('l’échec est celui de la barrière, il nomme CE fichier et le nœud, et document.body est vidé', () => {
    const ceFichier = cleFichierTest(expect.getState().testPath);
    expect(erreursBody.some((m) => m.includes(`Nœud(s) laissé(s) dans document.body par ${ceFichier}`)
      && m.includes('<div class="hote-oublie">')), erreursBody.join('\n')).toBe(true);
    expect(residusDom(document.body)).toEqual([]);
  });

  it.fails('une feuille laissée dans document.head fait échouer le test qui l’a posée', () => {
    const feuille = document.createElement('style');
    feuille.textContent = '.hote-oublie { color: red; }';
    document.head.appendChild(feuille);
    onTestFinished(({ task }) => {
      erreursHead = erreursDe(task);
    });
  });

  it('l’échec nomme document.head et CE fichier, et document.head est vidé', () => {
    const ceFichier = cleFichierTest(expect.getState().testPath);
    expect(erreursHead.some((m) => m.includes(`Nœud(s) laissé(s) dans document.head par ${ceFichier}`)
      && m.includes('<style>')), erreursHead.join('\n')).toBe(true);
    expect(residusDom(document.head)).toEqual([]);
  });
});

describe('barrière des registres d’art — câblage réel au teardown', () => {
  const CLE = 'armour/index.ts#ARMOUR';
  const plaque = ARMOUR.plaque as Record<string, unknown>;
  let signatureOrigine: string | undefined;
  let piedOrigine: unknown;
  let erreursArt: string[] = [];

  it.fails('un registre d’art laissé muté fait échouer le test qui l’a muté', () => {
    signatureOrigine = rigArtRegistrySignatures().get(CLE);
    piedOrigine = plaque.pied;
    plaque.pied = '<g id="derive-du-banc"/>';
    onTestFinished(({ task }) => {
      erreursArt = erreursDe(task);
    });
  });

  it('l’échec nomme CE fichier et le registre, et le registre est remis à l’origine', () => {
    const ceFichier = cleFichierTest(expect.getState().testPath);
    expect(erreursArt.some((m) => m.includes(`Registre d'art du rig laissé MUTÉ par ${ceFichier}`)
      && m.includes(CLE)), erreursArt.join('\n')).toBe(true);
    expect(signatureOrigine).toBeTruthy();
    expect(plaque.pied).toBe(piedOrigine);
    expect(rigArtRegistrySignatures().get(CLE)).toBe(signatureOrigine);
  });
});
