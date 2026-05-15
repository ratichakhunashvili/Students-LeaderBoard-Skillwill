# Firestore Rules for Student Activity + Timed QR Points

Use these rules in Firebase Console → Firestore Database → Rules.

These rules allow:
- signed-in users to read app data;
- admins to create/edit/delete activities;
- admins to manually assign/delete point records;
- students to create their own QR scan point record.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function currentUserByUid() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isAdmin() {
      return signedIn() && currentUserByUid().data.role == 'admin';
    }

    function isStudent() {
      return signedIn() && currentUserByUid().data.role == 'student';
    }

    match /users/{userId} {
      allow read: if signedIn();
      allow create: if signedIn();
      allow update: if isAdmin() || request.auth.uid == resource.data.uid || request.auth.uid == userId;
      allow delete: if isAdmin();
    }

    match /activities/{activityId} {
      allow read: if signedIn();
      allow create, update, delete: if isAdmin();
    }

    match /points/{pointId} {
      allow read: if signedIn();
      allow create: if isAdmin() || (isStudent() && request.resource.data.studentUid == request.auth.uid && request.resource.data.source == 'qr');
      allow update, delete: if isAdmin();
    }
  }
}
```

Important: strict rules expect each Firestore `users` document ID to be the same as the Firebase Auth UID. If your existing `users` document IDs are random, use the temporary permissive rule below until you migrate them:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
