import {createClient} from '@supabase/supabase-js';
// Public project connection only. Authorization is enforced by database RLS.
export const db = createClient('https://ecurjotykfqiejrpczdm.supabase.co','sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX');
