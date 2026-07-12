import { NextRequest } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    try {
        const params = await context.params;
        const url = `${OLLAMA_BASE_URL}/api/${params.path.join('/')}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            return new Response(JSON.stringify({ error: `Ollama error: ${response.statusText}` }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const data = await response.text();
        return new Response(data, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Failed to connect to Ollama' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    try {
        const params = await context.params;
        const body = await request.text();
        const url = `${OLLAMA_BASE_URL}/api/${params.path.join('/')}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, application/x-ndjson'
            },
            body
        });
        
        if (!response.ok) {
            return new Response(JSON.stringify({ error: `Ollama error: ${response.statusText}` }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Pass the response body stream directly back to the client!
        // This is beautiful for Server-Sent Events / ndjson streaming
        return new Response(response.body, {
            status: 200,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
            }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Failed to connect to Ollama' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
