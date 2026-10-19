GlowQuest — GEMINI FREE-TIER AI FOOD MACROS + GITA TRACKER
======================================================

QUICK SETUP (NO OPENAI KEY NEEDED)
--------------------------------
1. Open your existing deployed GlowQuest website on your laptop and select
   Backup -> Download backup. Keep the JSON on your laptop, not in GitHub.

2. Extract this ZIP. Replace the files in your GitHub REPOSITORY ROOT:
      index.html
      package.json
      api/sync.js
      api/food-analyze.js
      README-DEPLOY.txt
      README-AI-SETUP.txt
   Don't place them inside a second nested folder.

3. At https://aistudio.google.com/api-keys create a Gemini API key.
   In Vercel -> dailytracker -> Settings -> Environment Variables, set:
      GEMINI_API_KEY     (Secret; Production)  = your Gemini API key
      GLOWQUEST_SYNC_PIN (Secret; Production)  = your EXISTING sync PIN
   Keep the PIN you already use for phone/laptop sync. Never put either
   secret into index.html, GitHub, or your JSON backup.

   OPTIONAL (if your account cannot use the default model):
      GEMINI_MODEL = gemini-3.1-flash-lite
   Default model: gemini-3.5-flash-lite. Both have limited free API access
   according to the current Google AI pricing page; availability/quota can
   vary by account, region and date. Do not enable paid billing unless you
   explicitly intend to use it.

4. Commit and push the project to GitHub; Vercel should deploy the code.
   IMPORTANT: Redeploy AFTER setting the environment variable if you added
   it after your last deployment.

5. Open GlowQuest -> Make it mine -> Phone + laptop cloud sync -> Connect.
   Use the same PIN as GLOWQUEST_SYNC_PIN. The AI feature also accepts this
   PIN when prompted, even if Blob sync is temporarily not working.

6. Go to Nutrition Studio -> Ask about my meal. Enter a detailed food
   description (e.g., "3 medium thepla cooked with oil, 100g homemade curd,
   150ml chai with sugar"), choose meal time, click Estimate my macros.
   Review ingredients, portions and assumptions and then save to the
   selected day. Edit or remove the saved meal later if needed.

7. Your Gita Tracker, daily habits, weekly planner, existing food logs,
   offline ingredient logger, browser save, JSON backup and Blob sync remain.
   Restoring a JSON backup is only necessary if your data is missing.

TROUBLESHOOTING
---------------
- "GEMINI_API_KEY is missing": Add it as a Secret, then redeploy.
- "Connect with your private GlowQuest PIN": Enter your current sync PIN.
- 401 Incorrect PIN: Use the same PIN value as GLOWQUEST_SYNC_PIN.
- 403 Gemini key rejected: Check AI Studio key and account access.
- 404 model unavailable: Set GEMINI_MODEL=gemini-3.1-flash-lite in Vercel,
  redeploy, and try again. Check Google AI Studio for models available to you.
- 429 Gemini free-tier rate limit: Wait and retry later.
- 404 Vercel page for /api/food-analyze: Check the file under repo ROOT/api/.
- 500 from Vercel: Look under Vercel project -> Logs -> /api/food-analyze.

SECURITY & LIMITATIONS
----------------------
- AI estimation is only called from the Vercel server function. GEMINI_API_KEY
  is not exposed to the browser, unlike unsafe frontend API calls.
- The API requires GLOWQUEST_SYNC_PIN for requests. Don't publish your PIN.
- The meal description and meal time are sent to Google Gemini for processing.
  Calorie targets, weight, other daily logs and profile are NOT sent.
- Gemini's free tier is usage-limited and Google may use free-tier content
  to improve its products; avoid entering private medical details.
- All nutrients are estimates, not laboratory or exact nutrition database
  values. Review assumed quantities, oil/ghee, brands and portions.
- The app compares macros against your planning target, but does not measure
  an actual physiological calorie deficit.
