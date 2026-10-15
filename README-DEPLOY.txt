GLOWQUEST — VERCEL PHONE + LAPTOP SYNC

WHAT CHANGED
- index.html still saves every change in browser localStorage.
- It can now also sync one private JSON file through /api/sync.
- Cloud file storage uses Vercel Blob, not a traditional database.
- The same deployed URL + same private sync PIN gives you the same progress on phone and laptop.

IMPORTANT: DEPLOY THIS WHOLE FOLDER, NOT ONLY index.html.

VERCEL SETUP
1. Push these files to the ROOT of your GitHub repository:
     index.html
     package.json
     api/sync.js
     README-DEPLOY.txt
2. In Vercel, open your project.
3. Add a Vercel Blob store to the project and make it PRIVATE.
   New Blob stores on Vercel can use project OIDC authentication automatically.
4. In Project Settings -> Environment Variables add:
     GLOWQUEST_SYNC_PIN = choose-a-private-pin-or-passphrase
   Use a strong private value. Do not put this value in GitHub or inside index.html.
5. Redeploy the project.
6. Open your deployed site on your laptop.
7. Go to Make it mine -> Phone + laptop cloud sync -> Connect cloud sync.
8. Enter the same value you used for GLOWQUEST_SYNC_PIN.
9. Open the deployed site on your phone and connect cloud sync with the SAME PIN.

HOW IT WORKS
- Browser localStorage remains the fast/offline copy.
- Cloud sync stores glowquest/state.json as a PRIVATE Vercel Blob.
- On startup, the app compares updatedAt timestamps and uses the newer copy.
- Changes are uploaded automatically after a short delay.
- Manual JSON Backup/Restore still works as an extra safety option.

IMPORTANT WHEN MOVING FROM YOUR OLD DEPLOYMENT
Your existing laptop browser already has your local data on the same deployed domain.
After deploying this version, first connect cloud sync on THAT laptop. It will upload
that existing data. Then connect your phone with the same PIN.

SECURITY
- The Blob is private.
- The browser never receives Vercel Blob credentials.
- The sync PIN is checked only by the Vercel server function.
- The browser stores your PIN locally on each device so it can sync automatically.
