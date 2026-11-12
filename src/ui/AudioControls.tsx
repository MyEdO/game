import { useState } from 'react';
import { getVolume, getMusicVolume, isMuted, setMuted, setVolume, setMusicVolume, playSfx } from '../audio/engine';
import { Icon } from './Icon';
import { Stack } from './Layout';

/** Contrôles audio du menu ☰ (Jalon 8 — sons CC0) : sourdine globale + volumes effets/musique,
 *  persistants. Bouger le volume d'effets joue un échantillon ; la musique s'ajuste en direct. */
export function AudioControls() {
  const [volume, setVol] = useState(getVolume());
  const [musicVol, setMusicVol] = useState(getMusicVolume());
  const [muted, setMute] = useState(isMuted());
  return (
    <Stack gap="xs">
      <span className="mini-title">Audio</span>
      <div className="audio-controls">
        <button
          type="button"
          className="btn small"
          aria-label={muted ? 'Réactiver le son' : 'Couper le son'}
          title={muted ? 'Réactiver le son' : 'Couper le son'}
          onClick={() => {
            setMuted(!muted);
            setMute(!muted);
          }}
        >
          <Icon id={muted ? 'son/coupe' : 'son/volume'} size="sm" />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={muted}
          aria-label="Volume des effets"
          title="Effets"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            setVol(v);
          }}
          onPointerUp={() => playSfx('des')}
        />
      </div>
      <div className="audio-controls">
        <span className="audio-icon" aria-hidden><Icon id="son/musique" size="sm" /></span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={musicVol}
          disabled={muted}
          aria-label="Volume de la musique"
          title="Musique"
          onChange={(e) => {
            const v = Number(e.target.value);
            setMusicVolume(v);
            setMusicVol(v);
          }}
        />
      </div>
    </Stack>
  );
}
