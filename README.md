# Sadtrans B2B Platform

## Vercel Deployment Fix

The project was experiencing build issues on Vercel related to Rollup optional dependencies. The error was:

```
Error: Cannot find module @rollup/rollup-linux-x64-gnu. npm has a bug related to optional dependencies
```

### Solution Applied

1. Removed problematic optional dependencies from [package.json](file:///c:/Users/HP/Downloads/dev/sadtrans/package.json):
   - `@rollup/rollup-linux-x64-gnu`
   - `@rollup/rollup-win32-x64-msvc`

2. Added [vercel.json](file:///c:/Users/HP/Downloads/dev/sadtrans/vercel.json) configuration file for proper static file serving.

3. Added a specific `vercel-build` script to [package.json](file:///c:/Users/HP/Downloads/dev/sadtrans/package.json).

### If You Still Experience Issues

If the build still fails, try these steps locally before deploying:

1. Delete `package-lock.json` and `node_modules` directory:
   ```bash
   rm package-lock.json
   rm -rf node_modules
   ```

2. Reinstall dependencies:
   ```bash
   npm install
   ```

3. Test the build locally:
   ```bash
   npm run build
   ```

4. Deploy to Vercel again.

This issue is related to a known npm bug with optional dependencies: https://github.com/npm/cli/issues/4828