import { config } from '../../config.ts';
import { createMidtrans } from './midtrans.ts';
import { createMock } from './mock.ts';
import type { PaymentProvider } from './types.ts';

export const payments: PaymentProvider = config.PAYMENT_PROVIDER === 'midtrans'
  ? createMidtrans({
      serverKey: config.MIDTRANS_SERVER_KEY!,
      clientKey: config.MIDTRANS_CLIENT_KEY!,
      isProduction: config.MIDTRANS_IS_PRODUCTION,
      siteUrl: config.SITE_URL.replace(/\/$/, '')
    })
  : createMock(config.SITE_URL.replace(/\/$/, ''));

export * from './types.ts';
