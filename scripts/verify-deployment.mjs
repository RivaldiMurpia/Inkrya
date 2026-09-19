import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Opt-in catalog verification inside the trusted Vercel build environment.
// No inference, application data, or credential values are logged/transferred.
if (process.env.INKRYA_VERIFY_NEBIUS_BUILD === 'true') {
  const preflight = fileURLToPath(new URL('./nebius-preflight.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--experimental-strip-types', preflight, '--list-models'], {
    stdio: 'inherit', timeout: 15000, env: process.env,
  });
  if (result.error || result.status !== 0) {
    console.error('Nebius catalog preflight failed. No inference was requested.');
    process.exitCode = 1;
  }
}
