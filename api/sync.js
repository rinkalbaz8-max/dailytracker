import { get, put } from '@vercel/blob';

const PATHNAME = 'glowquest/state.json';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function authorized(request) {
  const expected = process.env.GLOWQUEST_SYNC_PIN || '';
  const received = request.headers.get('x-glowquest-pin') || '';
  return Boolean(expected && received && received === expected);
}

async function handleRequest(request) {
  // This endpoint is private to the tracker. Opening /api/sync directly in a
  // browser should return 401 because the browser is not sending the PIN header.
  if (!authorized(request)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET') {
    const result = await get(PATHNAME, {
      access: 'private',
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return json({ error: 'No cloud copy yet' }, 404);
    }

    const text = await new Response(result.stream).text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (request.method === 'POST') {
    const text = await request.text();

    if (!text || text.length > 15_000_000) {
      return json({ error: 'Invalid or too-large payload' }, 400);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Invalid tracker state' }, 400);
    }

    await put(PATHNAME, JSON.stringify(parsed), {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return json({ ok: true, savedAt: new Date().toISOString() });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// Current Vercel Web Handler format for framework-less /api functions.
// Using `fetch()` guarantees that `request` is the Web-standard Request object,
// so request.headers.get() and request.text() work consistently.
export default {
  async fetch(request) {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error('GlowQuest sync error:', error);
      return json(
        {
          error: 'Cloud sync server error',
          detail: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};
