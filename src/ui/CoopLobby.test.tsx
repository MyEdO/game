/**
 * CoopLobby — rendu des libellés i18n Phase D.
 * Rendu statique via renderToStaticMarkup. CoopLobby lit `location.search` — mock global requis.
 * On teste le mode 'local' (état initial du store) pour vérifier les libellés du shell
 * et des sections principales. Les modes guest/host sont testés comme état du catalogue uniquement.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { CoopLobby } from './CoopLobby';
import { t } from '../i18n';

// Mock minimal de location.search (indisponible en env Node)
beforeEach(() => {
  (globalThis as Record<string, unknown>).location = { search: '' };
  useGame.setState({ net: { ...useGame.getState().net, mode: 'local' } });
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).location;
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
    expect(t("coop.host.invite.section")).toBe("Inviter — partagez le code");
    expect(t("coop.host.players.section")).toBe("Joueurs connectés");
    expect(t("coop.host.assign.section")).toBe("Attribution des héros");
    expect(t("coop.host.compose")).toBe("Composer le groupe →");
    expect(t("coop.host.loadGame")).toBe("Charger une partie");
    expect(t("coop.invite.attente.reconnexion")).toBe("Reconnexion en cours…");
  });
});
