/**
 * Streaming proxy for HAR upload — bypasses Next.js 10MB body limit.
 * Pipes the request body directly to the NestJS API without buffering.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const dynamic = 'force-dynamic';
// Disable Next.js body parsing — we stream it ourselves
export const maxDuration = 120; // 2 min timeout for large files

export async function POST(request: Request) {
  try {
    // Stream body straight to the NestJS backend — no buffering in Next.js
    const upstream = await fetch(`${API_URL}/api/har/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      // Pass the raw ReadableStream through — no await, no buffering
      body: request.body,
      // @ts-ignore — Node.js fetch needs this to allow streaming
      duplex: 'half',
    });

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ message: err.message || 'Upload failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
