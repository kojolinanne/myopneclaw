# Apps Script Bound Project — Common Pitfalls

## getActiveSpreadsheet vs openById

When an Apps Script project is **bound** to a Google Sheet (created via Extensions > Apps Script, or via API with `parentId`), always use:

```javascript
SpreadsheetApp.getActiveSpreadsheet()
```

Do NOT use `SpreadsheetApp.openById(ID)` — it requires extra authorization that web app users haven't granted, causing `google.script.run` calls to silently fail.

## ES6 Compatibility

Although Apps Script supports V8 runtime, `google.script.run` serialization has quirks:

- **Object shorthand** `{a, b}` — may silently fail. Use `{a: a, b: b}`
- **Arrow functions** in server code — generally works with V8, but if debugging, try converting to `function()` syntax
- **Spread operator** `[...new Set(arr)]` — works in V8 but avoid in time-critical debugging; use explicit loops

## Data Type Issues

### Dates
Sheets auto-formats text that looks like dates. `115年1月31日` becomes `0115年1月31日`.

Prevention:
- Write with `--input RAW` (gog CLI) or `valueInputOption: RAW` (API)
- Format cells as "Plain text" before writing
- In Code.gs, always `String(val).trim()` when reading

### Numbers
Sheets stores numbers and returns them as numbers. `getValues()` returns `12500` (number), not `"12500"` (string). Use `Number(val) || 0` for safe numeric operations.

## Web App Authorization Flow

When a web app is deployed as "Execute as: Me" + "Anyone with link":
1. First visit triggers a consent screen
2. User must authorize the required scopes
3. If `openById` is used instead of `getActiveSpreadsheet`, it requires Drive scope which the user hasn't consented to → silent failure

## Debugging Tips

1. Open the Apps Script editor → Executions to see server-side errors
2. Add `try/catch` in server functions and `Logger.log()` for debugging
3. In the HTML, add `.withFailureHandler(e => alert(e.message))` to all `google.script.run` calls
4. Test server functions directly in the Apps Script editor before testing via web app
