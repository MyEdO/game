// @vitest-environment jsdom
/** #1619 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { residusDom, cleFichierTest, messageResiduDom } from './test-setup';
import { DOM_RESIDU_STOCK } from '../scripts/guards/lib/domResiduStock.mjs';
import { ecartsDeStock } from '../scripts/guards/lib/stock.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';

// src/portable-paths-guard.test.ts:51
const LECTEUR = 'C' + ':';

describe('barrière de fuite DOM — verdict', () => {
  it('nomme le fichier ET les nœuds laissés dans document.body', () => {
    const div = document.createElement('div');
    div.className = 'fuite-jouet';
    document.body.appendChild(div);
    try {
      const residus = residusDom(document.body);
      expect(residus).toEqual(['<div class="fuite-jouet">']);
      const msg = messageResiduDom('src/ui/JouetQuiFuit.test.tsx', residus, new Set());
      expect(msg).toContain('src/ui/JouetQuiFuit.test.tsx');
      expect(msg).toContain('<div class="fuite-jouet">');
    } finally {
      div.remove();
    }
  });

  it('se tait pour un fichier du stock d’extinction, et pour un body vide', () => {
    const fichier = 'src/ui/JouetQuiFuit.test.tsx';
    expect(messageResiduDom(fichier, ['<div>'], new Set([fichier]))).toBeNull();
    expect(messageResiduDom('src/ui/JouetQuiFuit.test.tsx', [], new Set())).toBeNull();
    expect(residusDom(document.body)).toEqual([]);
  });

  it('la clé de stock est le chemin POSIX relatif à la racine, quelle que soit la séparation', () => {
    expect(cleFichierTest(LECTEUR + '\\dépôt\\src\\ui\\A.test.tsx', LECTEUR + '\\dépôt')).toBe('src/ui/A.test.tsx');
    expect(cleFichierTest('/dépôt/src/ui/A.test.tsx', '/dépôt')).toBe('src/ui/A.test.tsx');
  });
});

/** #1619 */
describe('stock d’extinction — cliquet', () => {
  it('ne porte que des fichiers existants (une ligne morte se retire)', () => {
    const { perimees } = ecartsDeStock({
      observe: [...DOM_RESIDU_STOCK].filter((f) => existsSync(f)),
      stock: DOM_RESIDU_STOCK,
      cle: (f) => f,
    });
    expect(perimees, `ligne(s) du stock sans fichier — retirer de domResiduStock.mjs :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('chaque ligne est un CHEMIN de fichier de test — c’est ce que la porte de plage voit', () => {
    const muettes = [...DOM_RESIDU_STOCK].filter((f) => !(f.startsWith('src/') && estSuiteVitest(f)));
    expect(muettes, `ligne(s) dont la graphie n’est pas un chemin POSIX sous \`src/\` : elles seraient\n` +
      `INVISIBLES à \`croissanceDesStocks\`, et un append ne coûterait rien :\n${muettes.join('\n')}`).toEqual([]);
  });
});
