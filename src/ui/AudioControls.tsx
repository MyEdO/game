import { useState } from 'react';
import { pref } from '../noyau/preferences';
import { setPreference } from '../state/preferences';
import { Icon } from './Icon';
import { Stack } from './Layout';

/** Contrôles audio du menu ☰ (Jalon 8 — sons CC0) : la préférence `son-coupe`, réglée par `setPreference` comme au
 *  panneau `PreferencesPanel`, où vivent aussi les volumes des canaux (#4081). */
export function AudioControls() {
  const [coupe, poserCoupe] = useState(pref('son-coupe') === true);
  return (
    <Stack gap="xs">
      <span className="mini-title">Audio</span>
      <div className="audio-controls">
        <button
          type="button"
          className="btn small"
          aria-label={coupe ? 'Réactiver le son' : 'Couper le son'}
          title={coupe ? 'Réactiver le son' : 'Couper le son'}
          onClick={() => {
            setPreference('son-coupe', !coupe);
            poserCoupe(!coupe);
          }}
        >
          <Icon id={coupe ? 'son/coupe' : 'son/volume'} size="sm" />
        </button>
      </div>
    </Stack>
  );
}
