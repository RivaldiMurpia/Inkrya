const PRODUCTION_ORIGIN='https://inkrya.vercel.app';
const HACKATHON_ORIGIN='https://inkrya-git-hackathon-nebius-2026-rivaldi-murpias-projects.vercel.app';

// Exact owned origins only; never accept a query-provided redirect or a broad
// *.vercel.app match. Supabase must allow the same Preview URL server-side.
export function authReturnUrl(origin:string){
 return (origin===HACKATHON_ORIGIN?HACKATHON_ORIGIN:PRODUCTION_ORIGIN)+'/';
}
