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

// Diagnostics require one exact commit. Readback is the default and costs no
// inference. Explicit smoke/prose modes opt into bounded synthetic paid calls.
const smokeCommit=process.env.INKRYA_VERIFY_PHASE1_COMMIT;
if (!process.exitCode && /^[a-f0-9]{40}$/.test(smokeCommit||'') && smokeCommit===process.env.VERCEL_GIT_COMMIT_SHA) {
  if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='hackathon/nebius-2026') {
    console.error('Phase 1 smoke is restricted to the hackathon Preview branch.');
    process.exitCode=1;
  } else {
    const mode=process.env.INKRYA_VERIFY_PHASE1_MODE;
    const paid=mode==='smoke'||mode==='prose';
    const script=fileURLToPath(new URL(mode==='prose'?'./phase1-prose-pilot.mjs':paid?'./phase1-smoke.mjs':'./phase1-readback.mjs',import.meta.url));
    const result=spawnSync(process.execPath,['--experimental-strip-types',script,...(paid?['--allow-credit-usage']:[])],{stdio:'inherit',timeout:180000,env:process.env});
    if(result.error||result.status!==0){console.error('Phase 1 activation smoke failed.');process.exitCode=1}
  }
}
