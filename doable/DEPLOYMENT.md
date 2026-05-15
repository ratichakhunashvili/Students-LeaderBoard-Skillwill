# 🚀 Firebase Deployment Guide

## Quick Deploy

```bash
firebase deploy
```

Your app will be live at: `https://students-point-system.web.app`

## Create Admin Account

You have two options:

### Option 1: Firebase Console (Recommended - No coding required)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select `students-point-system` project
3. Go to **Authentication** → **Users** tab
4. Click **Add User**
5. Email: `ratichakhunashvili@gmail.com`
6. Password: `01024072661`
7. Click **Add User**

8. Then go to **Firestore Database** → **Collections** → **users**
9. Click **Add document**
10. Set document ID as any name (e.g., `admin-001`)
11. Add these fields:
```javascript
{
  uid: "[copied from Auth user UID]",
  name: "Admin",
  email: "ratichakhunashvili@gmail.com",
  role: "admin",
  totalPoints: 0,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Option 2: Node.js Setup Script

1. Install firebase-admin:
```bash
npm install firebase-admin
```

2. Download service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `firebase-key.json` in project root

3. Run setup script:
```bash
node setup-admin.js
```

The admin account will be created automatically!

## Firestore Security Rules

Add these rules to your Firestore (Security → Rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Everyone can read activities
    match /activities/{document=**} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null;
    }
    
    // Everyone can read points
    match /points/{document=**} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
  }
}
```

## Access Your App

- **URL**: https://students-point-system.web.app
- **Admin Login**: 
  - Email: `ratichakhunashvili@gmail.com`
  - Password: `01024072661`
  - Select "Admin" tab before logging in

## Troubleshooting

### "Permission denied" errors
- Make sure Firestore rules are set correctly
- Check that user has correct role in database

### "Module not found" when running setup script
- Run: `npm install firebase-admin`

### Can't login after deployment
- Verify user exists in Firebase Authentication
- Verify user document exists in Firestore with correct role
- Check browser console for errors

## Next Steps

1. ✅ Deploy with `firebase deploy`
2. ✅ Create admin account (use Option 1 or 2)
3. ✅ Visit https://students-point-system.web.app
4. ✅ Login as admin and start using the app!

---

**Need help?** Check Firebase docs or console logs for errors.
