import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Inkrya Studio',description:'Ruang menulis untuk cerita dan dunia milikmu.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="id"><body>{children}</body></html>}
