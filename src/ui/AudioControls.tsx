import { useState } from 'react';
import { isMuted, setMuted } from '../audio/engine';
import { Icon } from './Icon';
import { Stack } from './Layout';

/** Contrôles audio du menu ☰ (Jalon 8 — sons CC0) : la sourdine globale, persistante. Les volumes des canaux sont des
 *  préférences (`PreferencesPanel`). */
export function AudioControls() {
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
      </div>
    </Stack>
  );
}
