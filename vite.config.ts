import { defineConfig,loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'VITE_');
 const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY;
 if(Boolean(url)!==Boolean(key))throw Error('Configure as duas variáveis públicas do Supabase.');
 let api="'none'";
 if(url&&key){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error('Use a URL HTTPS pública do seu projeto Supabase.');
  let publicKey=key.startsWith('sb_publishable_');
  try{publicKey ||= JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString()).role==='anon'}catch{}
  if(!publicKey)throw Error('Somente a chave pública publishable/anon pode entrar no frontend. Nunca use chaves secretas.');
  api=parsed.origin;
 }
 const csp=`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src ${api}; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`;
 return {base:'./',plugins:[tailwindcss(),{name:'security-policy',transformIndexHtml(html,ctx){return ctx.server?html:{html,tags:[{tag:'meta',attrs:{'http-equiv':'Content-Security-Policy',content:csp},injectTo:'head-prepend'},{tag:'meta',attrs:{name:'referrer',content:'no-referrer'},injectTo:'head-prepend'}]}}}]};
});
