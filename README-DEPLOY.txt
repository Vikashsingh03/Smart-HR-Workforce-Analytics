Smart HR Workforce Analytics — LIVE DEPLOYMENT PATCH
=====================================================
Is patch me sirf deployment wali 6 files hain (frontend v4 code nahi —
wo aapke laptop pe pehle se hai, aur GitHub pe push ho chuka hai):

  Dockerfile                              (Render: API ko Docker me chalata hai)
  .dockerignore                           (Docker build se junk bahar rakhta hai)
  render.yaml                             (Render Blueprint: free plan, health check)
  src/SmartHR.Api/Program.cs              (Render ke $PORT pe sunta hai)
  src/SmartHR.Web/angular.json            (prod build me prod environment use karega)
  src/SmartHR.Web/src/environments/environment.prod.ts
                                          (live API URL — abhi placeholder hai,
                                           Render URL milte hi badlega)

LAGANE KE COMMANDS (PowerShell, ek-ek karke):
----------------------------------------------
Expand-Archive -Path "D:\Downloads\SmartHR-deploy.zip" -DestinationPath "$env:TEMP\hrdep" -Force
Copy-Item -Path "$env:TEMP\hrdep\SmartHR\*" -Destination "$env:USERPROFILE\SmartHR" -Recurse -Force

PHIR PUSH (wahi terminal me):
------------------------------
cd C:\Users\HP\SmartHR
git status --short
git add .
git commit -m "Add Render + Vercel deployment config"
git push

git status me ye dikhna chahiye: Dockerfile, .dockerignore, render.yaml,
environment.prod.ts naye (A) aur Program.cs + angular.json badle hue (M).

USKE BAAD (Muse batayega jab URL mile):
---------------------------------------
1. Render dashboard -> New -> Blueprint -> repo chuno -> GEMINI_API_KEY
   jab puche to wahan daalo (chat me kabhi nahi). Deploy hone do.
2. API URL milega (https://smarthr-api-xxxx.onrender.com) — /api/health
   kholo, {"status":"ok","rows":1470} dikhna chahiye.
3. environment.prod.ts me RENDER_API_URL ki jagah asli URL daal ke
   dobara push karo.
4. Vercel -> Import repo -> Root Directory: src/SmartHR.Web ->
   Build: npm run build, Output: dist/smart-hr-web -> Deploy.
5. Render dashboard me env var add karo:
   AllowedOrigins__0 = https://<vercel-app>.vercel.app
   (redeploy hoga; tab live site API se data lega).
6. Live site kholo, dashboard numbers + AI Assistant check karo.

NOTE: Render free plan ~15 min idle ke baad so jata hai, pehli baar
khulne me 30-60 sec lag sakte hain — demo me normal hai.
