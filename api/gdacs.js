import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP';

let cached = null;
let cachedAt = 0;
const CACHE_TTL = 600_000; // 10 minutes

function getRelayBaseUrl() {
  const relayUrl = process.env.WS_RELAY_URL || '';
  if (!relayUrl) return '';
  return relayUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace(/\/$/, '');
}

function getRelayHeaders(baseHeaders = {}) {
  const headers = { ...baseHeaders };
  const relaySecret = process.env.RELAY_SHARED_SECRET || '';
  if (relaySecret) {
    const relayHeader = (process.env.RELAY_AUTH_HEADER || 'x-relay-key').toLowerCase();
    headers[relayHeader] = relaySecret;
  }
  return headers;
}

async function fetchDirect() {
  const resp = await fetch(GDACS_URL, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!resp.ok) throw new Error(`GDACS HTTP ${resp.status}`);
  return resp.text();
}

async function fetchViaRelay() {
  const base = getRelayBaseUrl();
  if (!base) return null;
  const resp = await fetch(`${base}/gdacs`, {
    headers: getRelayHeaders({ 'Accept': 'application/json' }),
    signal: AbortSignal.timeout(25000),
  });
  if (!resp.ok) return null;
  return resp.text();
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const now = Date.now();
    if (!cached || now - cachedAt > CACHE_TTL) {
      let data = null;
      try {
        data = await fetchDirect();
      } catch {
        data = await fetchViaRelay();
      }
      if (!data) throw new Error('All fetch methods failed');
      cached = data;
      cachedAt = now;
    }

    return new Response(cached, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=600, stale-while-revalidate=300',
        ...corsHeaders,
      },
    });
  } catch (err) {
    // Serve stale cache if available
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=60, stale-while-revalidate=600',
          'X-Stale': 'true',
          ...corsHeaders,
        },
      });
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
