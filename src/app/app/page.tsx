import { createClient } from '@/lib/supabase/server';
import { demoProfile, shouldUseSupabase } from '@/lib/config';
import { redirect } from 'next/navigation';
import AppClient from './AppClient';
import { UserProfile } from '@/types';

export const metadata = {
  title: 'Dashboard - TikTok AI Creator',
};

export default async function AppPage() {
  if (!shouldUseSupabase) {
    return <AppClient initialProfile={{ ...demoProfile, plan: 'enterprise' } as UserProfile} />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const userProfile: UserProfile = {
    id: user.id,
    email: user.email!,
    display_name: profile?.display_name || '',
    credits: profile?.credits || 0,
    plan: profile?.plan || 'free',
  };

  return <AppClient initialProfile={userProfile} />;
}
