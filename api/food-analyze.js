// Server-side OpenAI call: never put OPENAI_API_KEY inside index.html or GitHub.
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
    if (!process.env.OPENAI_API_KEY) return reply({ error: 'OPENAI_API_KEY is missing in Vercel Environment Variables. Add it and redeploy.' }, 503);
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
    const target = finiteBetween(payload?.target?.kcal, 500, 6000) ? Math.round(payload.target.kcal) : null;
    const proteinGoal = finiteBetween(payload?.target?.protein, 0, 400) ? Math.round(payload.target.protein) : null;
    const logged = finiteBetween(payload?.alreadyLogged, 0, 30000) ? Math.round(payload.alreadyLogged) : 0;

    try {
      // Don't send stored tracker records, gender, age, or medical data to the model.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 26000);
      let response;
      try {
        response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini', store: false, max_output_tokens: 1600,
            text: { format: { type: 'json_schema', name: 'glowquest_food_macros', strict: true, schema } },
            input: [
              { role: 'system', content: `You are a careful nutritional ESTIMATOR for a personal vegetarian meal diary, not a doctor or weight-loss coach. Infer approximate nutrition for the WHOLE meal as eaten. Return separate items with portions and kcal, protein g, carbs g, fat g, fiber g. Keep each item realistic; account for ghee/oil, milk/sugar in chai and Indian serving sizes. If a quantity, recipe, preparation, brand or cooking fat was not specified, make a transparent modest assumption and name it in assumptions. Do not claim precise calories: all estimates are uncertain. Do not invent measured weights. If the meal is genuinely unidentifiable, use low confidence, state what's missing and avoid false precision. Output items up to 10, assumptions up to 8; numerical values nonnegative. The user may have a daily kcal planning target but that MUST NOT bias food-calorie estimates.` },
              { role: 'user', content: JSON.stringify({ meal: description, meal_time: slot, daily_kcal_planning_target: target, protein_guide_g: proteinGoal, calories_already_logged: logged }) },
            ],
          }),
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) {
        // Never echo the full upstream response: it may contain implementation details.
        if (response.status === 429) return reply({ error: 'AI rate limit or API budget reached. Try again later.' }, 429);
        if (response.status === 401 || response.status === 403) return reply({ error: 'The server OpenAI API key was rejected. Check OPENAI_API_KEY in Vercel.' }, 503);
        console.error('OpenAI food analyze status', response.status, (await response.text()).slice(0, 300));
        return reply({ error: 'Food estimation failed at the AI provider. Check Vercel logs.' }, 502);
      }
      const raw = await response.json();
      const text = (raw.output || []).flatMap(part => part.content || []).find(p => p.type === 'output_text')?.text;
      if (!text) return reply({ error: 'No food estimate returned. Please try a clearer portion description.' }, 502);
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
      console.error('GlowQuest AI food estimation error:', error);
      return reply({ error: error?.name === 'AbortError' ? 'AI request timed out. Try again.' : 'Food estimation unavailable. Try again or use the offline ingredient logger.' }, error?.name === 'AbortError' ? 504 : 502);
    }
  },
};
