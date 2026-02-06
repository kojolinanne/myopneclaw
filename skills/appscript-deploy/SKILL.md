---
name: appscript-deploy
description: Deploy and troubleshoot Google Apps Script web apps bound to Google Sheets. Use when creating, updating, or fixing Apps Script projects via the Apps Script API, including OAuth setup, code upload, versioning, deployment, and common issues like viewport, data loading failures, and date formatting in Sheets.
---

# Apps Script Deploy

Deploy and manage Google Apps Script web apps bound to Google Sheets via the REST API.

## Prerequisites

- Google Cloud project with **Apps Script API** enabled
- User must enable API access at https://script.google.com/home/usersettings
- OAuth token with scopes: `script.projects`, `script.deployments`, `drive`, `spreadsheets`

## OAuth Setup

Get a token with Apps Script scopes (separate from gog's default scopes):

```
https://accounts.google.com/o/oauth2/auth?access_type=offline
  &client_id=<CLIENT_ID>
  &redirect_uri=http://localhost:1
  &response_type=code
  &scope=https://www.googleapis.com/auth/script.projects
         https://www.googleapis.com/auth/script.deployments
         https://www.googleapis.com/auth/drive
         https://www.googleapis.com/auth/spreadsheets
  &prompt=consent
```

Exchange code for tokens:

```bash
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "code=<CODE>" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "redirect_uri=http://localhost:1" \
  -d "grant_type=authorization_code"
```

**Save the refresh token permanently** (e.g. `.script_token.json` in workspace, added to `.gitignore`). Token expires ~7 days; refresh with `grant_type=refresh_token`.

## Deployment Workflow

### 1. Create Project (first time only)

```bash
curl -s -X POST "https://script.googleapis.com/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "<NAME>", "parentId": "<SPREADSHEET_ID>"}'
```

Binding to a Spreadsheet allows `getActiveSpreadsheet()` without extra auth.

### 2. Upload Code

```bash
curl -s -X PUT "https://script.googleapis.com/v1/projects/<SCRIPT_ID>/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"files": [
    {"name":"Code","type":"SERVER_JS","source":"<escaped_gs>"},
    {"name":"Index","type":"HTML","source":"<escaped_html>"},
    {"name":"appsscript","type":"JSON","source":"<escaped_manifest>"}
  ]}'
```

### 3. Create Version

```bash
curl -s -X POST "https://script.googleapis.com/v1/projects/<SCRIPT_ID>/versions" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"description": "<version_desc>"}'
```

### 4. Create or Update Deployment

Create:
```bash
curl -s -X POST "https://script.googleapis.com/v1/projects/<SCRIPT_ID>/deployments" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"versionNumber": <N>, "manifestFileName": "appsscript", "description": "<desc>"}'
```

Update existing:
```bash
curl -s -X PUT "https://script.googleapis.com/v1/projects/<SCRIPT_ID>/deployments/<DEPLOY_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"deploymentConfig": {"scriptId":"<SCRIPT_ID>","versionNumber":<N>,"manifestFileName":"appsscript","description":"<desc>"}}'
```

## Common Issues & Fixes

### 1. Mobile viewport not working

**Symptom**: Page doesn't respond to mobile screen size.

**Cause**: Apps Script wraps HTML in an iframe; `<meta viewport>` in HTML alone is insufficient.

**Fix**: Add `addMetaTag` in `doGet()`:

```javascript
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

### 2. Data fails to load (stuck on "loading")

**Symptom**: Web app renders but `google.script.run` calls never return.

**Causes & fixes**:

- **`openById()` on bound project** — Use `SpreadsheetApp.getActiveSpreadsheet()` instead. Bound projects don't need the ID and `openById` requires extra authorization the web app user hasn't granted.
- **ES6+ syntax** — `const`, `let`, arrow functions, spread operator may cause silent failures in some Apps Script runtimes. Use `var` and `for` loops for maximum compatibility.
- **Object shorthand** — `{income, expense}` may fail. Use explicit `{income: income, expense: expense}`.

### 3. Date/number formatting in Sheets

**Symptom**: `115年1月31日` becomes `0115年1月31日` in Sheets.

**Cause**: Google Sheets auto-interprets values as dates/numbers and reformats them.

**Fix**:
- Use `--input RAW` when writing via gog/API to prevent interpretation
- In Apps Script, always `String(value).trim()` when reading cell values
- To fix existing data: overwrite the column with `--input RAW`

### 4. Scope insufficient errors

**Symptom**: `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`

**Fix**: Apps Script API requires dedicated scopes (`script.projects`, `script.deployments`) not included in gog's default OAuth. Create a separate auth flow with these scopes.

### 5. User has not enabled Apps Script API

**Symptom**: `403 User has not enabled the Apps Script API`

**Fix**: User must visit https://script.google.com/home/usersettings and toggle the API **ON** (separate from enabling the API in Cloud Console).

## Manifest Template

```json
{
  "timeZone": "Asia/Taipei",
  "dependencies": {},
  "webapp": {
    "access": "ANYONE_ANONYMOUS",
    "executeAs": "USER_DEPLOYING"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

## Automation Script

See `scripts/deploy.sh` for a one-command deploy script that handles upload → version → deploy → git push.
