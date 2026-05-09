/**
 * Stripe / PayPal client stub.
 *
 * TODO: replace with `loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)`
 * once Stripe Checkout / Elements is wired in. Payments must use Stripe
 * Checkout / Elements only — no card data on our servers (see CLAUDE.md).
 */

type MockStripe = {
  elements: () => {
    create: () => { mount: () => void; on: () => void };
  };
};

export const stripePromise: Promise<MockStripe> = Promise.resolve({
  elements: () => ({
    create: () => ({
      mount: () => {},
      on: () => {},
    }),
  }),
});

export const PAYPAL_CLIENT_ID: string =
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? 'demo';
