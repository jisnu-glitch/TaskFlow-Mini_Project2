import { NextResponse } from 'next/server';
import { verifySolution, type Payload, type PayloadV1 } from 'altcha-lib';
import { verifySolution as verifySolutionV1 } from 'altcha-lib/v1';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

function decodePayload(encodedPayload: string): Payload | PayloadV1 | null {
    try {
        const decoded = Buffer.from(encodedPayload, 'base64').toString('utf8');
        return JSON.parse(decoded) as Payload | PayloadV1;
    } catch {
        return null;
    }
}

function isPayloadV2(payload: Payload | PayloadV1): payload is Payload {
    return typeof payload === 'object' && payload !== null && 'challenge' in payload && 'solution' in payload;
}

export async function POST(request: Request) {
    try {
        const { payload } = await request.json();
        const hmacSecret = process.env.ALTCHA_HMAC_SECRET;
        const hmacKeySecret = process.env.ALTCHA_HMAC_KEY_SECRET;

        if (!hmacSecret) {
            // ALTCHA is optional. When no server secret is configured the
            // captcha is disabled so auth still works on zero-config BYOS.
            return NextResponse.json({ success: true });
        }

        if (!payload || typeof payload !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Missing ALTCHA payload.' },
                { status: 400 }
            );
        }

        const parsedPayload = decodePayload(payload);
        if (!parsedPayload) {
            return NextResponse.json(
                { success: false, error: 'Invalid ALTCHA payload encoding.' },
                { status: 400 }
            );
        }

        if (isPayloadV2(parsedPayload)) {
            const result = await verifySolution({
                challenge: parsedPayload.challenge,
                solution: parsedPayload.solution,
                deriveKey,
                hmacSignatureSecret: hmacSecret,
                hmacKeySignatureSecret: hmacKeySecret,
            });

            if (!result.verified) {
                // Log the verification result for debugging on deployed environments.
                // Do NOT log secrets. This helps identify mismatched payloads, expiry,
                // or algorithm/cost mismatches when running on Vercel.
                console.error('ALTCHA verification failed - result:', {
                    verified: result.verified,
                    reason: (result as any).reason || null,
                    challenge: !!parsedPayload.challenge,
                });

                return NextResponse.json(
                    { success: false, error: 'ALTCHA verification failed.' },
                    { status: 400 }
                );
            }

            return NextResponse.json({ success: true });
        }

        const v1Verified = await verifySolutionV1(payload, hmacSecret, true);
        if (!v1Verified) {
            return NextResponse.json(
                { success: false, error: 'ALTCHA verification failed.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('ALTCHA verification error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error during ALTCHA verification.' },
            { status: 500 }
        );
    }
}
