import { NextResponse } from 'next/server';
import { createChallenge, randomInt } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    try {
        const hmacSecret = process.env.ALTCHA_HMAC_SECRET;
        const hmacKeySecret = process.env.ALTCHA_HMAC_KEY_SECRET;

        if (!hmacSecret) {
            // ALTCHA is optional. On zero-config BYOS deployments the captcha
            // is disabled rather than blocking auth with a 500.
            return NextResponse.json({ disabled: true }, {
                headers: {
                    'Cache-Control': 'no-store, max-age=0',
                },
            });
        }

        const challenge = await createChallenge({
            algorithm: 'PBKDF2/SHA-256',
            cost: 2_000,
            counter: randomInt(200, 50),
            deriveKey,
            expiresAt: Math.floor(Date.now() / 1000) + 5 * 60,
            hmacSignatureSecret: hmacSecret,
            hmacKeySignatureSecret: hmacKeySecret,
        });

        return NextResponse.json(challenge, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error) {
        console.error('ALTCHA challenge error:', error);
        return NextResponse.json(
            { error: 'Failed to create ALTCHA challenge.' },
            { status: 500 }
        );
    }
}
