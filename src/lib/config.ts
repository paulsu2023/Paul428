export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const hasServerSupabaseEnv = Boolean(
  hasSupabaseEnv && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const shouldUseSupabase = hasServerSupabaseEnv && !isDemoMode;

export const flowApiBaseUrl = (process.env.FLOW_API_BASE_URL || 'http://127.0.0.1:38000').replace(/\/+$/, '');
export const flowApiKey = process.env.FLOW_API_KEY || 'han1234';
export const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
export const geminiBaseUrl = process.env.GEMINI_BASE_URL || '';

export const demoProfile = {
  id: 'demo-user',
  email: 'demo@local',
  display_name: 'Demo User',
  credits: 9999,
  plan: 'local',
} as const;

export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`缺少环境变量: ${name}`);
  }

  return value;
}
