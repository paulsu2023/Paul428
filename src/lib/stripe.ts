import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_for_build', {
  apiVersion: '2025-02-24.acacia' as any,
});
