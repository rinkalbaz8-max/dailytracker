// Server-side Gemini call: keep GEMINI_API_KEY in Vercel Secret env vars, never in HTML or GitHub.
// The user's existing GLOWQUEST_SYNC_PIN protects this endpoint from anonymous calls.
import { timingSafeEqual } from 'node:crypto';

const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];
const macroProperties = Object.fromEntries(nutrientKeys.map(key => [key, { type: 'number' }]));
const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    items: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: { name: { type: 'string' }, portion: { type: 'string' }, ...macroProperties },
        required: ['name', 'portion', ...nutrientKeys],
      },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'confidence', 'items', 'assumptions'],
};

function reply(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
function validPin(request) {
  const expected = process.env.GLOWQUEST_SYNC_PIN;
  const got = request.headers.get('x-glowquest-pin');
  if (!expected || !got) return false;
  const a = Buffer.from(expected); const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}
function finiteBetween(n, min, max) { return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max; }

export default {
  async fetch(request) {
    if (!validPin(request)) return reply({ error: 'Connect with your private GlowQuest PIN first.' }, 401);
    if (request.method !== 'POST') return reply({ error: 'Use POST from Nutrition Studio.' }, 405);
    if (!process.env.GEMINI_API_KEY) return reply({ error: 'GEMINI_API_KEY is missing in Vercel Environment Variables. Add it as a Secret and redeploy.' }, 503);
    let payload;
    try {
      if (Number(request.headers.get('content-length')) > 6000) return reply({ error: 'Meal description is too long.' }, 413);
      payload = await request.json();
    } catch { return reply({ error: 'Invalid JSON body.' }, 400); }
    const description = typeof payload?.description === 'string' ? payload.description.trim() : '';
    const slot = payload?.slot;
    if (description.length < 4 || description.length > 700 || !['Breakfast', 'Lunch', 'Dinner', 'Snack & chai', 'Other'].includes(slot)) {
      return reply({ error: 'Describe a meal (4–700 characters) and choose a meal time.' }, 400);
    }

    try {
      // Only the meal description and meal-time are sent to Gemini, NOT profile,
      // calorie targets, food history, weight, age, gender, or other tracker data.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 26000);
      const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
      let response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: controller.signal,
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `You are a careful nutritional ESTIMATOR for a personal vegetarian meal diary, not a doctor or weight-loss coach. Infer approximate nutrition for the WHOLE meal as eaten. Return separate items with portions and kcal, protein g, carbs g, fat g, fiber g. Keep each item realistic; account for ghee/oil, milk/sugar in chai, and Indian serving sizes. If a quantity, recipe, preparation, brand, or cooking fat was not specified, make a transparent modest assumption and name it in assumptions. Never claim precise nutrition measurements. If the meal is unidentifiable, use low confidence and list missing details instead of false precision. Up to 10 foods and 8 assumptions, all nutrition amounts nonnegative. Estimate what the user actually described; do not adjust calories to fit a diet goal. Return JSON only.` }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify({ meal: description, meal_time: slot }) }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
              responseJsonSchema: schema,
            },
          }),
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) {
        // Don't send upstream error text to the browser (could contain internal details).
        if (response.status === 429) return reply({ error: 'Gemini free-tier rate limit reached. Wait a little and retry.' }, 429);
        if (response.status === 401 || response.status === 403) return reply({ error: 'Gemini rejected your API key or access. Check GEMINI_API_KEY in Vercel.' }, 503);
        if (response.status === 404) return reply({ error: `Gemini model ${model} is unavailable for this key. Check availability in Google AI Studio or set GEMINI_MODEL in Vercel.` }, 503);
        console.error('Gemini food analyze HTTP status', response.status, (await response.text()).slice(0, 300));
        return reply({ error: 'Gemini food estimation failed. Check Vercel function logs.' }, 502);
      }
      const raw = await response.json();
      const parts = raw?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map(part => part?.text || '').join('').trim() : '';
      if (!text) return reply({ error: 'Gemini returned no food estimate. Try a clearer meal description.' }, 502);
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.items) || parsed.items.length < 1 || parsed.items.length > 10 ||
          !Array.isArray(parsed.assumptions) || parsed.assumptions.length > 8 ||
          !['low', 'medium', 'high'].includes(parsed.confidence) || typeof parsed.title !== 'string') {
        return reply({ error: 'AI returned incomplete nutrition details. Please retry.' }, 502);
      }
      let totals = Object.fromEntries(nutrientKeys.map(k => [k, 0]));
      const items = parsed.items.map(item => {
        if (typeof item.name !== 'string' || typeof item.portion !== 'string' || !item.name ||
            item.name.length > 120 || item.portion.length > 120 || nutrientKeys.some(k => !finiteBetween(item[k], 0, k === 'kcal' ? 3000 : 800))) {
          throw new Error('Invalid AI estimate');
        }
        let clean = { name: item.name, portion: item.portion };
        for (const k of nutrientKeys) {
          clean[k] = Math.round(item[k] * 10) / 10;
          totals[k] += clean[k];
        }
        return clean;
      });
      for (const k of nutrientKeys) totals[k] = Math.round(totals[k] * 10) / 10;
      if (totals.kcal > 6000 || totals.protein + totals.carbs + totals.fat > 2000) throw new Error('Unreasonable totals');
      const assumptions = parsed.assumptions.map(a => {
        if (typeof a !== 'string' || a.length > 400) throw new Error('Invalid AI assumptions');
        return a;
      });
      return reply({ title: parsed.title.slice(0, 200), confidence: parsed.confidence, items, assumptions, totals, isEstimate: true });
    } catch (error) {
      console.error('GlowQuest Gemini food estimation error:', error);
      return reply({ error: error?.name === 'AbortError' ? 'AI request timed out. Try again.' : 'Food estimation unavailable. Try again or use the offline ingredient logger.' }, error?.name === 'AbortError' ? 504 : 502);
    }
  },
};
