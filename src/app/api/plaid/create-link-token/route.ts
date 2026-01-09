// Plaid Link Token API
// Creates a link token to initialize Plaid Link

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES, isPlaidConfigured } from '@/lib/plaid/client';

export async function POST() {
  try {
    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured' },
        { status: 503 }
      );
    }

    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create link token
    // Note: redirect_uri only needed for OAuth flows and must be registered in Plaid Dashboard
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: session.user.id,
      },
      client_name: 'SpendSignal',
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: 'en',
    });

    return NextResponse.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: unknown) {
    // Log detailed Plaid error
    const plaidError = error as { response?: { data?: unknown } };
    console.error('Create link token error:', JSON.stringify(plaidError.response?.data, null, 2));
    return NextResponse.json(
      { error: 'Failed to create link token', details: plaidError.response?.data },
      { status: 500 }
    );
  }
}
