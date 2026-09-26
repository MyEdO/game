/**
 * DesignGallery — galerie design system IN-APP (#412, DEV uniquement), ratifiant le kit HTML
 * « Atelier du scribe » en PRIMITIVES React réelles. Chaque entrée est un spécimen VIVANT (données
 * réelles de `src/data`, jamais inventées, sauf note explicite) — la référence de goût pérenne
 * remplace la planche HTML (retraitée par ce ticket). Extension utilisateur (2026-07-14, verbatim :
 * « Faudrait forcer à ce que la galerie ait toutes les primitives ») : le contenu vient du REGISTRE
 * `./registry.ts` (SOURCE UNIQUE) — la garde structurelle `gallery-exhaustive.test.ts` exige une
 * entrée par primitive `src/ui/**.tsx` de `src/data/primitives.manifest.json`.
 */
import { useState } from 'react';
import { ScreenShell } from '../ScreenShell';
import { MasterDetail } from '../MasterDetail';
import { Icon } from '../Icon';
import { useGame } from '../../state/store';
import { GALLERY_SPECIMENS, GALLERY_CATEGORIES } from './registry';
import { Row } from '../Layout';

export function DesignGallery() {
  const setScreen = useGame((s) => s.setScreen);
  const [activeId, setActiveId] = useState(GALLERY_SPECIMENS[0]?.id);
  const entry = GALLERY_SPECIMENS.find((s) => s.id === activeId) ?? GALLERY_SPECIMENS[0];
  const Render = entry?.render;
  /* PLEIN CHAMP : un spécimen qui EST un écran (le pont se dimensionne sur la fenêtre, le dialogue
     s'aligne au bas du champ) ne peut pas se juger dans une vignette de liste — il se rend dans le
     PLATEAU réel, dont la grille à deux rangées (hud.css) le pose comme à l'écran. Le monde est une
     IMAGE : la recette lui pose une capture du monde réel, la galerie seule la laisse vide. La barre
     haute porte le retour à la liste, à la place où vit le menu ☰. */
  if (entry && Render && entry.pleinChamp) {
    return (
      <div className="screen campaign-view" data-maquette={entry.id}>
        <main className="stage">
          <img data-maquette-monde="" alt="" />
          <Render />
          {/* RETOUR À LA LISTE : chrome de la GALERIE, pas une surface d'écran. Il se rend APRÈS le
              spécimen et se cale au bord OPPOSÉ (gallery.css) — un spécimen qui monte la vraie barre
              haute du jeu occupe le coin du menu ☰, et le recouvrirait sinon. */}
          <Row className="hud-topbar">
            <button type="button" className="btn small" onClick={() => setActiveId(GALLERY_SPECIMENS[0]?.id)}>Galerie</button>
          </Row>
        </main>
      </div>
    );
  }
  return (
    <ScreenShell title={<><Icon id="nav/art-gallery" /> Design system — L'Atelier du scribe</>} onClose={() => setScreen('menu')} body="centered-wide" className="gallery-screen">
      <div className="gallery-body">
        <MasterDetail
          listLabel="Primitives du design system"
          list={
            <>
              {GALLERY_CATEGORIES.map((cat) => (
                <div className="gallery-list-group" key={cat}>
                  <h4 className="gallery-list-heading">{cat}</h4>
                  {GALLERY_SPECIMENS.filter((s) => s.category === cat).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      /* Le spécimen se DÉSIGNE par son id STABLE : c'est par lui que la recette le
                         sélectionne, jamais par son libellé (de l'affichage). */
                      data-specimen={s.id}
                      className={`btn gallery-list-item${s.id === activeId ? ' active' : ''}`}
                      onClick={() => setActiveId(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ))}
            </>
          }
          detail={
            entry && Render ? (
              <div className="gallery-detail-wrap">
                <Row className="gallery-detail-head">
                  <h3>{entry.label}</h3>
                  <span className="gallery-detail-source">{entry.file}</span>
                </Row>
                {entry.note && <p className="hint">{entry.note}</p>}
                <div className="gallery-detail">
                  <div className="gallery-spec">
                    <Row className="gallery-spec-stage">
                      <Render />
                    </Row>
                  </div>
                </div>
              </div>
            ) : (
              <p className="hint">Aucun spécimen.</p>
            )
          }
        />
      </div>
    </ScreenShell>
  );
}
