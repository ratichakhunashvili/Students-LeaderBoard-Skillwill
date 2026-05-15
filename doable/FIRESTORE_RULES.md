# Firestore Rules for Admin Activity Management

Paste these in Firebase Console → Firestore Database → Rules → Publish.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isAdmin() {
      return signedIn() && userDoc().data.role == 'admin';
    }

    function isStudent() {
      return signedIn() && userDoc().data.role == 'student';
    }

    match /users/{userId} {
      allow read: if signedIn();
      allow create: if signedIn();
      allow update: if isAdmin() || request.auth.uid == resource.data.uid;
      allow delete: if isAdmin();
    }

    match /activities/{activityId} {
      allow read: if signedIn();
      allow create, update, delete: if isAdmin();
    }

    match /points/{pointId} {
      allow read: if signedIn();
      allow create, update, delete: if isAdmin();
    }
  }
}
```

Important: for the strict rules above, the Firestore user document ID should be the same as the Firebase Authentication UID. If your current user document has a random ID, either keep temporary permissive rules or create a second user document with the Auth UID as document ID.
