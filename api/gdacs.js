import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP';

let cached = null;
let cachedAt = 0;
const CACHE_TTL = 600_000; // 10 minutes

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
      const resp = await fetch(GDACS_URL, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; WorldMonitor/1.0)',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`GDACS HTTP ${resp.status}`);
      cached = await resp.text();
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
