# Bug fixes applied

## Fixed app logic
- Rebuilt `js/app.js` to avoid redirect loops and duplicated initialization.
- Replaced Firestore `where + orderBy` combinations with client-side sorting to avoid missing-index crashes.
- Fixed student/admin role routing.
- Fixed leaderboard loading for both admin and student users.
- Fixed student dashboard cards and history page stats.
- Fixed point history timeline sorting.
- Fixed activity point auto-fill when selecting an activity.
- Added proper error messages for common Firebase Auth/Firestore errors.

## Fixed admin features
- Admin can now create a student Auth account without logging out the admin account, using a secondary Firebase Auth app.
- Admin can edit Firestore student name/email.
- Admin delete now clearly deletes the Firestore student record only. Firebase Auth users must be deleted from Firebase Console/Admin SDK.

## Fixed Firebase setup
- Updated `js/firebase.js` exports so the app can create a secondary Firebase Auth instance safely.
- Added Firebase Hosting configuration in `firebase.json`.

## Notes
- Browser console messages like `lockdown-install.js: SES Removing unpermitted intrinsics` and `tabs:outgoing.message.ready` usually come from browser extensions, not this project.
- `favicon.ico 404` is harmless and the HTML pages already use an empty favicon link to avoid it.

## v3 Activity/Points Update

- Admin can create activities with a custom activity name and default point value.
- Admin can select a student, select an activity, and the app automatically uses that activity's default points.
- The points input is now read-only in the assign-points form to avoid manual mismatch.
- Point assignment now stores the activity ID/name, student ID/name, admin email, and timestamp.
- Student total points now uses Firestore `increment()` to prevent overwrite/race issues.
- Added `FIRESTORE_RULES.md` with admin-only write rules for activities and points.

## v4 QR Activity Scanner

Added QR-based activity awarding:

- Admin-created activities now receive a unique `qrToken` and `qrPayload` in Firestore.
- Activities page displays a unique QR code for each activity.
- Admin can download/open the QR code for sharing.
- Student dashboard now has a camera scanner.
- When a student scans a valid activity QR, points are awarded automatically from that activity's `defaultPoints` value.
- Duplicate QR awards are prevented per student per activity when the source is `qr`.

Important: camera scanning requires HTTPS or localhost and browser camera permission.
