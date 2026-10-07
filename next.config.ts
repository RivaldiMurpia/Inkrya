import type {NextConfig} from 'next';

// Conservative security headers only — no CSP here on purpose: Supabase auth redirects,
// tiptap inline styles and the Next dev overlay would need a carefully tested policy first.
const securityHeaders=[
 {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains; preload'},
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
];

const nextConfig:NextConfig={
 async headers(){
  return [{source:'/:path*',headers:securityHeaders}];
 },
};

export default nextConfig;
