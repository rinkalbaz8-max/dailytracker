GlowQuest — AI FOOD MACRO ESTIMATOR + GITA TRACKER
==================================================

1. Before deploying, open your current GlowQuest website and use ↗ Backup
   to download your personal JSON data. Keep it private. Do NOT put it in GitHub.

2. Unzip and copy ALL project files to the ROOT of your existing GitHub repository:
     index.html
     package.json
     api/sync.js
     api/food-analyze.js   <-- new AI function
     README-DEPLOY.txt
     README-AI-SETUP.txt

3. In Vercel → dailytracker → Settings → Environment Variables, confirm:
     GLOWQUEST_SYNC_PIN = your existing private sync PIN (Secret, Production)
   And ADD:
     OPENAI_API_KEY = your OpenAI API Platform secret key (Secret, Production)
   Never include this key in index.html, GitHub or your JSON backup.
   Your ChatGPT subscription does not automatically provide OpenAI API credits.
   AI calls may incur charges on your OpenAI API account.

4. Push to GitHub, and REDEPLOY on Vercel after changing environment variables.

5. Open the site → Make it mine → Connect cloud sync using the same PIN
   as GLOWQUEST_SYNC_PIN. For AI food estimates, enter that PIN when asked
   on the first request (works even if your Blob sync is temporarily down).

6. Nutrition studio → ✨ Ask about my meal:
   Describe your food and quantities, choose Breakfast/Lunch/Dinner etc.,
   click Estimate my macros, READ the assumed portions, check the Review box,
   then click Save estimated meal. Totals update in the same daily food log.
   You can edit or remove the saved AI meal after that.

7. The old offline ingredient/label logger, editable weekly meal planning, Gita
   session tracker, localStorage backups, and Vercel Blob sync remain.

8. If AI returns "OPENAI_API_KEY is missing", check the variable and redeploy.
   If it returns "connect with your private PIN", connect cloud sync first.
   If it returns 404, check api/food-analyze.js is in the repo ROOT/api folder.
   If it returns 500, open Vercel → Logs and inspect /api/food-analyze.

Security: /api/food-analyze requires the configured sync PIN. The private
OPENAI_API_KEY is only read by the Vercel server function. Food descriptions
and daily planning target values are sent to OpenAI. Other daily tracker
records are not sent by this feature. Responses are approximate (not an exact
food database). Configure an API usage budget on your OpenAI Platform account
and keep the PIN secret to limit unauthorized usage.

IMPORTANT: This feature estimates portions. Confirm or correct guesses about
amounts, recipe, cooking oil, milk and sugar. Do not interpret targets or daily
remaining values as proof of an actual physiological deficit.
