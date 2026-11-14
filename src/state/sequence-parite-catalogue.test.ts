/**
 * GARDE DE MIGRATION du texte joueur passé au catalogue (#1318 V8c₅), côté web : les libellés du registre clavier
 * (`keybindings.ts`) à PARITÉ À L'OCTET. Le côté « avant » est un oracle de phrase RENDUE ; le côté « après » monte le
 * CATALOGUE RÉEL (`fr.ts`) par les mêmes appels que la production. Les autres sites migrés se jouent en
 * `src/noyau/sequence-parite-catalogue.hors-store.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { KEYBINDINGS, bindingLabel, keySectionLabel, keyLabel } from './clavier/keybindings';

/** Un site migré : ce que le flux écrivait AVANT, ce que le catalogue rend APRÈS. */
interface Site {
  /** `fichier:ligne` du site de production migré. */
  site: string;
  /** La phrase telle que le gabarit inline la produisait (oracle figé, relu au diff). */
  avant: string;
  /** La MÊME phrase, montée depuis le catalogue par les appels de la production. */
  apres: string;
}

const CLAVIER: Site[] = [
  {
    site: 'keybindings.ts:213 — libellé d’un raccourci à l’écran Options (PRODUCTION)',
    avant: 'Curseur : valider',
    apres: bindingLabel(KEYBINDINGS.find((b) => b.id === 'curseur-valider')!),
  },
  {
    site: 'keybindings.ts:234 — libellé PARAMÉTRÉ d’un slot de barre d’action (PRODUCTION)',
    avant: 'Capacité 3 de la barre d’action',
    apres: bindingLabel(KEYBINDINGS.find((b) => b.id === 'capacite-3')!),
  },
  {
    site: 'keybindings.ts:29 — section « Barre d’action » de l’écran Options (PRODUCTION)',
    avant: "Barre d'action",
    apres: keySectionLabel('capacite'),
  },
  {
    site: 'keybindings.ts:294 — touche du pavé numérique (PRODUCTION)',
    avant: 'Pavé 5',
    apres: keyLabel('Numpad5'),
  },
  {
    // CORRIGÉ : le préfixe `Numpad` était testé AVANT la table nommée → « Pavé Enter » à l'écran.
    site: 'keybindings.ts:256 — Entrée du pavé numérique (entrée nommée redevenue atteignable)',
    avant: 'Entrée (pavé)',
    apres: keyLabel('NumpadEnter'),
  },
];

describe('#1318 V8b/V8b₂/V8c₀/V8c₁/V8c₂ — la migration au catalogue est à PARITÉ D’OCTET', () => {
  it.each(CLAVIER)('$site', ({ avant, apres }) => {
    expect(apres).toBe(avant);
  });
});
