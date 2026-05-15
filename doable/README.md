# 🏆 Student Leaderboard Web App

A complete student excellence tracking system built with vanilla JavaScript, Firebase Authentication, and Firestore.

## Features

✅ **Admin Features:**
- Admin login with role-based access
- Add, edit, and delete students
- Create activities and award points
- View total students and activities
- Real-time student dashboard
- Assign points to students for completed activities

✅ **Student Features:**
- Student registration and login
- Personal dashboard with points and rank
- View complete leaderboard
- Track point history with timeline
- Real-time position updates
- See recent activities

✅ **General Features:**
- Dark modern dashboard UI
- Responsive Bootstrap design
- Sidebar navigation
- Real-time leaderboard updates via Firestore listeners
- Role-based access control
- Persistent authentication

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **UI Framework**: Bootstrap 5.3
- **Icons**: Bootstrap Icons
- **Firebase SDK**: Modular SDK (v9+)

## Project Structure

```
doable/
├── index.html                 # Redirect to login
├── login.html                # Login/Signup page
├── admin.html                # Admin dashboard (manage students)
├── activities.html           # Activities and points management
├── students.html             # Student dashboard
├── leaderboard.html          # Public leaderboard with real-time updates
├── history.html              # Student point history
├── package.json              # Dependencies
├── css/
│   └── style.css            # Complete dark theme styling
└── js/
    ├── firebase.js          # Firebase configuration and exports
    └── app.js               # Main application logic
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Configuration

The Firebase configuration is already set in `js/firebase.js`. If you need to use your own Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing
3. Enable:
   - ✅ Authentication (Email/Password)
   - ✅ Firestore Database
4. Copy your config and update in `js/firebase.js`

### 3. Firestore Setup

Create the following collections in Firestore:

#### Collection: `users`
```javascript
{
  uid: "firebase-uid",
  name: "John Doe",
  email: "john@example.com",
  role: "admin" | "student",
  totalPoints: 150,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Collection: `activities`
```javascript
{
  name: "Homework Assignment",
  description: "Complete math homework",
  defaultPoints: 50,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Collection: `points`
```javascript
{
  studentId: "user-doc-id",
  studentName: "John Doe",
  activityId: "activity-doc-id",
  activityName: "Homework Assignment",
  points: 50,
  givenBy: "admin@example.com",
  createdAt: Timestamp
}
```

### 4. Firestore Security Rules

Set these rules in Firestore Console (Security > Rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Activities collection
    match /activities/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.createdBy;
    }
    
    // Points collection
    match /points/{document=**} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.createdBy;
    }
  }
}
```

## Running the App

### Option 1: Using a Local Server

```bash
# Using Python
python -m http.server 8000

# Using Node.js (with http-server)
npx http-server
```

Then open `http://localhost:8000`

### Option 2: Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Default Test Accounts

### Admin Account
- Email: `admin@example.com`
- Password: `admin123`
- Role: Admin

### Student Accounts
- Email: `student1@example.com`
- Password: `student123`
- Role: Student

*Create your own accounts after first login*

## User Roles & Access

### Admin
- Access: `/admin.html`, `/activities.html`, `/leaderboard.html`
- Can: Manage students, create activities, assign points, view leaderboard

### Student
- Access: `/students.html`, `/leaderboard.html`, `/history.html`
- Can: View dashboard, check leaderboard, view point history

## Real-time Features

- **Leaderboard Updates**: Uses Firestore listeners for instant rank updates
- **Points Assignment**: Immediate reflection in student profiles
- **Activity Feed**: Real-time activity history with timestamps

## Features Breakdown

### Login Page (`login.html`)
- Dual role selection (Student/Admin)
- Email/Password authentication
- Student signup option
- Error messages and validation

### Admin Dashboard (`admin.html`)
- View all students with total points
- Add new students (creates account automatically)
- Edit student information
- Delete students
- Dashboard stats (total students, activities)

### Activities Management (`activities.html`)
- Create new activities
- View all activities
- Delete activities
- Assign points to students
- Real-time activity selector

### Student Dashboard (`students.html`)
- Personalized welcome
- Display of total points
- Current rank position
- Recent points earned
- Quick activity summary

### Leaderboard (`leaderboard.html`)
- Real-time ranked list of all students
- Total points display
- Activity count per student
- Top 3 medals (🥇 🥈 🥉)
- Student's own position card (for student role)
- Points behind leader calculation

### Point History (`history.html`)
- Timeline view of all activities
- Stats: Total points, activities completed, monthly points, current rank
- Detailed activity information
- Timestamps for each activity

## Styling

- **Dark Theme**: Custom CSS with dark blue/slate colors
- **Gradients**: Modern gradient cards and buttons
- **Responsive**: Works on mobile, tablet, and desktop
- **Bootstrap 5.3**: Utility-first approach
- **Animations**: Smooth transitions and loading states

## Technologies Used

| Technology | Purpose |
|-----------|---------|
| HTML5 | Structure and semantics |
| CSS3 | Styling and animations |
| JavaScript (ES6+) | Logic and interactivity |
| Firebase Auth | User authentication |
| Firestore | Real-time database |
| Bootstrap 5 | Responsive grid system |
| Bootstrap Icons | UI icons |

## API Endpoints (Firebase Calls)

### Authentication
- `createUserWithEmailAndPassword()` - Create account
- `signInWithEmailAndPassword()` - Login
- `signOut()` - Logout
- `onAuthStateChanged()` - Monitor auth state

### Firestore Queries
- `getDocs()` - Fetch data
- `onSnapshot()` - Real-time listeners
- `addDoc()` - Create document
- `updateDoc()` - Update document
- `deleteDoc()` - Delete document
- `query()` - Complex queries with filters

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Firebase Not Loading
- Check Firebase config in `js/firebase.js`
- Ensure Firebase project has Auth and Firestore enabled
- Clear browser cache

### Auth Errors
- Check email/password are correct
- Verify user exists in users collection
- Check role matches selected tab

### Real-time Updates Not Working
- Verify Firestore rules allow reads
- Check network connection
- Restart browser

### CORS Issues
- Use local server (not file:///)
- Deploy to Firebase Hosting or proper web server

## Security Notes

⚠️ **Production Considerations:**
- Use environment variables for Firebase config
- Implement proper Firestore security rules
- Add rate limiting for API calls
- Validate all data server-side
- Use HTTPS in production
- Implement refresh token rotation

## Future Enhancements

- [ ] Student profile customization
- [ ] Multiple activity categories
- [ ] Monthly/weekly leaderboards
- [ ] Achievements and badges
- [ ] Email notifications
- [ ] Export reports to PDF
- [ ] Admin analytics dashboard
- [ ] Point adjustment history
- [ ] Bulk student import
- [ ] Custom point multipliers

## License

Open source for educational purposes.

## Support

For issues and questions:
1. Check browser console for errors
2. Verify Firebase configuration
3. Check Firestore collection structure
4. Clear cache and try again

---

**Made with ❤️ for student excellence tracking**
#   S t u d e n t s - L e a d e r B o a r d - S k i l l w i l l  
 