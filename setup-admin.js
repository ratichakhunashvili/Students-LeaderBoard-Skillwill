// This script creates a default admin account in Firebase
// Run with: node setup-admin.js

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-key.json'); // You need to download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'students-point-system'
});

const db = admin.firestore();
const auth = admin.auth();

async function createAdminAccount() {
  try {
    console.log('Creating admin account...');

    // Create auth user
    const userRecord = await auth.createUser({
      email: 'ratichakhunashvili@gmail.com',
      password: '01024072661',
      displayName: 'Admin'
    });

    console.log('✓ User created:', userRecord.uid);

    // Create user document in Firestore
    await db.collection('users').add({
      uid: userRecord.uid,
      name: 'Admin',
      email: 'ratichakhunashvili@gmail.com',
      role: 'admin',
      totalPoints: 0,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('✓ Admin account created successfully!');
    console.log('Email: ratichakhunashvili@gmail.com');
    console.log('Password: 01024072661');

    process.exit(0);
  } catch (error) {
    console.error('✗ Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdminAccount();
