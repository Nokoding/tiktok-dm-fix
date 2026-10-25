# App analysis for the TikTok DM project

This pulls the messaging related strings, layout names and class names out of the Android and iOS
TikTok apps, then compares them. It never uploads the app files and only writes small text reports.

## Run it in a Codespace

1. Open a Codespace on this repo (Code button, Codespaces tab, New codespace).
2. Drag the APK (or APKM) and the IPA into the `apps/` folder in the file explorer. Make the folder
   if it is not there. `.gitignore` keeps these files out of git.
3. In the terminal:

```
mkdir -p reports
python3 tools/app-analysis/analyze_app.py scan apps/YOUR_FILE.apk --out reports/android.json
python3 tools/app-analysis/analyze_app.py scan apps/YOUR_FILE.ipa --out reports/ios.json
python3 tools/app-analysis/analyze_app.py compare reports/android.json reports/ios.json --out reports/compare.md
```

4. Commit and push the `reports/` folder (small files only):

```
git add reports && git commit -m "Add app reports" && git push
```

Then tell Claude the reports are pushed.

Nothing here needs pip. Big files can take a minute or two.
