import type { NextFunction, Request, Response } from 'express';
import Stripe from 'stripe';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import * as cartService from '../cart/cart.service';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw httpError(500, 'STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

export async function createStripePaymentIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }

    const pricing = await cartService.getCartWithPricing(auth.userId);
    if (!pricing.total || pricing.total <= 0) {
      throw httpError(400, 'Cart total must be greater than 0');
    }

    // Stripe expects the smallest currency unit. For VND, this is already integer.
    const amount = Math.round(pricing.total);

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'vnd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(auth.userId),
      },
    });

    res.status(200).json(
      success(
        {
          clientSecret: intent.client_secret,
          paymentIntent: {
            id: intent.id,
            status: intent.status,
            amount: intent.amount,
            currency: intent.currency,
          },
          cart: pricing,
        },
        'OK'
      )
    );
  } catch (err) {
    next(err);
  }
}

