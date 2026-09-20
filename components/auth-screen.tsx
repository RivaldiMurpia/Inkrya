'use client';
import {useEffect,useState} from 'react';
import {Feather,Github} from 'lucide-react';
import {db} from '@/lib/supabase';
import {authReturnUrl} from '@/lib/auth-redirect';

const returnUrl=()=>authReturnUrl(window.location.origin);
type SocialProvider='google'|'github';
export default function AuthScreen(){
 const [signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [providers,setProviders]=useState<Record<SocialProvider,boolean>|null>(null);
 const [email,setEmail]=useState(''),[cooldown,setCooldown]=useState(0);
 useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(v=>v-1),1000);return ()=>clearTimeout(timer)},[cooldown]);
 async function resend(){
  if(busy||cooldown>0)return;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setMessage('Isi alamat email yang digunakan saat mendaftar.');return;}
  setBusy(true);setMessage('');
  try{const {error}=await db.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:returnUrl()}});
   if(error){setMessage(error.status===429?'Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba lagi.':'Konfirmasi belum dapat dikirim. Coba lagi nanti.');if(error.status===429)setCooldown(60);}
   else{setMessage('Jika akun menunggu konfirmasi, tautan akan dikirim ke email tersebut. Periksa inbox dan spam, lalu kembali untuk masuk.');setCooldown(60);}
  }catch{setMessage('Koneksi terputus. Periksa internet dan coba lagi.');}finally{setBusy(false);}
 }
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/auth/providers',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(setProviders).catch(()=>{if(!controller.signal.aborted)setMessage('Metode login belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.');});
  const params=new URLSearchParams(location.hash.slice(1));
  if(params.has('error')){setMessage('Login tidak selesai. Akses mungkin dibatalkan atau tautan sudah kedaluwarsa. Silakan coba lagi.');history.replaceState(null,'',location.pathname);}
  return ()=>controller.abort();
 },[]);
 async function social(provider:SocialProvider){
  if(busy||!providers?.[provider])return;setBusy(true);setMessage('');
  try{const {error}=await db.auth.signInWithOAuth({provider,options:{redirectTo:returnUrl(),...(provider==='google'?{queryParams:{prompt:'select_account'}}:{scopes:'read:user user:email'})}});if(error)throw error;}
  catch{setMessage('Login tidak dapat dimulai. Silakan coba lagi nanti.');setBusy(false);}
 }
 async function submit(form:FormData){
  setBusy(true);setMessage('');
  try{
   const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};
   const {data,error}=signup?await db.auth.signUp({...credentials,options:{emailRedirectTo:returnUrl()}}):await db.auth.signInWithPassword(credentials);
   if(error){
    if(error.code==='unexpected_failure'||error.message.includes('Database error'))setMessage('Permintaan gagal di server. Jika sebelumnya sudah mendaftar, gunakan Masuk atau Kirim ulang konfirmasi email; tidak perlu membuat akun baru.');
    else if(error.code==='email_not_confirmed')setMessage('Konfirmasi email terlebih dahulu, lalu masuk kembali.');
    else if(error.code==='invalid_credentials')setMessage('Email atau kata sandi tidak sesuai.');
    else setMessage(error.message);
   }else if(signup&&!data.session)setMessage('Cek email untuk tautan konfirmasi. Setelah dikonfirmasi, kembali ke Inkrya dan masuk.');
  }catch{setMessage('Koneksi terputus. Periksa internet dan coba lagi.');}finally{setBusy(false);}
 }
 return <main className="auth"><section className="auth-intro"><div className="brand"><Feather/> INKRYA</div><span className="eyebrow">INKRYA STUDIO · EARLY ALPHA</span><h1>Ruang untuk<br/>cerita besarmu.</h1><p>Mulai satu bab. Bangun sebuah dunia.<br/>Simpan setiap langkah perjalanan menulismu.</p><div className="intro-footer">Your story. Your world.</div></section><section className="auth-form"><div className="auth-content"><span className="eyebrow">SELAMAT DATANG</span><h2>{signup?'Mulai perjalananmu':'Kembali ke ceritamu'}</h2><p>{signup?'Buat akun untuk menyimpan naskahmu.':'Masuk ke ruang menulis pribadimu.'}</p><div className="social-buttons"><button type="button" className="social-button" disabled={busy||!providers?.google} onClick={()=>social('google')}><span aria-hidden="true" className="google-letter">G</span>Lanjutkan dengan Google</button><button type="button" className="social-button" disabled={busy||!providers?.github} onClick={()=>social('github')}><Github size={19}/>Lanjutkan dengan GitHub</button></div>{providers&&(!providers.google||!providers.github)&&<p className="provider-note">{[!providers.google&&'Google',!providers.github&&'GitHub'].filter(Boolean).join(' dan ')} belum tersedia. Gunakan email sementara.</p>}<div className="auth-divider"><span>atau dengan email</span></div><form action={submit}><label>Email<input name="email" value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required disabled={busy}/></label><label>Kata sandi<input name="password" type="password" minLength={signup?8:undefined} autoComplete={signup?'new-password':'current-password'} required disabled={busy}/></label><button className="primary" disabled={busy}>{busy?'Memproses…':signup?'Buat akun':'Masuk ke Studio'}</button></form><button type="button" className="text-button" disabled={busy||cooldown>0} onClick={resend}>{cooldown>0?`Kirim ulang dalam ${cooldown} detik`:'Kirim ulang konfirmasi email'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{setSignup(!signup);setMessage('')}}>{signup?'Sudah punya akun? Masuk':'Belum punya akun? Daftar'}</button>{message&&<p role="status" className="notice">{message}</p>}</div></section></main>;
}
