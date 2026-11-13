// @vitest-environment jsdom
/**
 * CoopLobby — rendu des libellés i18n Phase D, et l'issue d'un hébergement affichée telle que le salon la rend (#3009).
 * Le mode 'local' (état initial du store) porte les libellés du shell et des sections principales ; les modes
 * guest/host sont testés comme état du catalogue uniquement.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { initialNet } from '../noyau/etat';
import { CoopLobby } from './CoopLobby';
import { t } from '../i18n';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  useGame.setState({ net: initialNet() });
});

describe("CoopLobby -- libelles i18n Phase D", () => {
  it("mode local : titre Jouer en ligne, sections Heberger/Rejoindre, bouton Menu", () => {
    const html = renderToStaticMarkup(<CoopLobby />);
    expect(html).toContain("Jouer en ligne");
    expect(html).toContain("Votre nom");
    expect(html).toContain("Nom de joueur");
    expect(html).toContain("Héberger une partie");
    expect(html).toContain("Rejoindre une partie");
    expect(html).toContain("Héberger");
    expect(html).toContain("Rejoindre");
    const retour = html.slice(html.indexOf("menu-back"));
    expect(retour.slice(0, retour.indexOf("</button>"))).toContain(t("coop.back.menu"));
    expect(html).toContain("Le groupe se compose ensemble");
    expect(html).toContain("Le code de room fait 6 caractères.");
    expect(html).toContain("CODE");
  });

  it("catalogue : libelles coop guest/host resolus par t()", () => {
    // Verification que les valeurs du catalogue resolvent correctement
    expect(t("coop.title.guest")).toBe("Salon — invité");
    expect(t("coop.title.host")).toBe("Salon — hôte");
    expect(t("coop.back.quit")).toBe("Quitter");
    expect(t("coop.hote.inviter.section")).toBe("Inviter — partagez le code");
    expect(t("coop.hote.joueurs.section")).toBe("Joueurs connectés");
    expect(t("coop.hote.attribution.section")).toBe("Attribution des héros");
    expect(t("coop.hote.composer")).toBe("Composer le groupe →");
    expect(t("coop.hote.chargerUnePartie")).toBe("Charger une partie");
    expect(t("coop.invite.attente.reconnexion")).toBe("Reconnexion en cours…");
  });
});

describe("CoopLobby -- l'issue d'un hébergement", () => {
  let hote: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
    root = createRoot(hote);
    act(() => root.render(<CoopLobby />));
  });
  afterEach(() => {
    act(() => root.unmount());
    hote.remove();
    useGame.getState().netLeave();
    vi.unstubAllGlobals();
  });

  const saisirLeNom = (nom: string) => {
    const champ = hote.querySelector('input')!;
    const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      poser.call(champ, nom);
      champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const bouton = (libelle: string) => [...hote.querySelectorAll('button')].find((b) => b.textContent === libelle)!;

  it("relay injoignable : le texte rendu par le salon s'affiche", async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    saisirLeNom('Anne');
    await act(async () => { bouton(t('coop.hote.bouton')).click(); });
    expect(hote.textContent).toContain(t('coop.hote.erreur'));
  });

  it("hébergement abandonné par le retour au menu : le texte de l'abandon s'affiche", async () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    saisirLeNom('Anne');
    await act(async () => { bouton(t('coop.hote.bouton')).click(); });
    await act(async () => { hote.querySelector<HTMLButtonElement>('.menu-back')!.click(); });
    expect(hote.textContent).toContain(t('coop.ouvertureAbandonnee'));
  });
});
