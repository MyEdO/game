// La config d'`oxlint.config.mjs` bornée à `murs/noms-par-ligne` (#3821), pour son `--fix` : `npm run lint:noms-par-ligne`.
import config from './oxlint.config.mjs';

export default { ...config, overrides: [], options: {}, rules: { 'murs/noms-par-ligne': 'error' } };
