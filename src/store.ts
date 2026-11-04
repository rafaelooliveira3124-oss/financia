import {createClient} from '@supabase/supabase-js';
// O modo local só pode ser habilitado no servidor de desenvolvimento.
export const demoEnabled=import.meta.env.DEV&&import.meta.env.VITE_ENABLE_DEMO==='true';
export const supabase=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true}}):null;
