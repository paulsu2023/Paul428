import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { CREDIT_PACKAGES } from '@/constants';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// IMPORTANT: This endpoint must NOT use the standard auth client
// It uses the service role key to bypass RLS for crediting users
async function createAdminSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const { user_id, package_id, credits } = session.metadata;

    if (!user_id || !credits) {
      console.error('[Webhook] Missing metadata:', session.metadata);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
    const supabase = await createAdminSupabase();

    const { error } = await supabase.rpc('add_credits', {
      p_user_id: user_id,
      p_amount: parseInt(credits),
      p_type: 'purchase',
      p_description: `购买 ${pkg?.name || '点数套餐'} (${credits} 点)`,
      p_stripe_payment_id: session.payment_intent,
    });

    if (error) {
      console.error('[Webhook] Failed to add credits:', error);
      return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
    }

    console.log(`[Webhook] ✅ Added ${credits} credits to user ${user_id}`);
  }

  return NextResponse.json({ received: true });
}
