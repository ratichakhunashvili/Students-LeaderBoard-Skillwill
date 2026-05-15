# Mobile + QR + Points Update

## What changed

- Added mobile-friendly navigation so dashboard, leaderboard, point history, activities, and logout stay visible on phones.
- Updated the visual style to feel more like a clean Skillwill/college product: light cards, purple/blue gradient accents, rounded cards, better spacing, and mobile touch targets.
- Added an admin point ledger on the Activities page:
  - see which student received points;
  - see which activity gave the points;
  - see whether it came from Admin/manual or QR scan;
  - delete incorrect point records.
- Added rotating live QR codes for every activity:
  - QR code changes every 30 seconds;
  - downloaded QR is only the current live QR;
  - old screenshot QR codes expire.

## Deploy reminder

The project is configured to deploy from the `public` folder.

```powershell
firebase deploy --only hosting --project students-point-system
```

## QR camera reminder

Phone camera scanning works only on HTTPS or localhost. Firebase Hosting is HTTPS, so it should work after deployment.

## Firestore rules

Check `FIRESTORE_RULES.md`. If your user documents still have random document IDs instead of Auth UID IDs, use the temporary permissive rule shown there while testing.
