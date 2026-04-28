import { createClient } from '@/lib/supabase/server';
import { demoProfile, shouldUseSupabase } from '@/lib/config';
import { redirect } from 'next/navigation';
import BillingClient from './BillingClient';

export default async function BillingPage() {
  if (!shouldUseSupabase) {
    return <BillingClient profile={{ ...demoProfile, plan: 'demo' }} isDemoMode />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, email, display_name, plan')
    .eq('id', user.id)
    .single();
  return <BillingClient profile={profile || { credits: 0, email: user.email || '', display_name: '', plan: 'free' }} />;
}
