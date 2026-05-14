import { 
    auth, 
    db, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    addDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    Timestamp 
} from './firebase.js';

// Global State
let currentUser = null;
let currentRole = null;
let currentUserData = null;

// ============== AUTHENTICATION ==============

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData(user.uid);
        routePage();
    } else {
        redirectTo('login.html');
    }
});

// Load user data from Firestore
async function loadUserData(uid) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            currentUserData = snapshot.docs[0].data();
            currentUserData.id = snapshot.docs[0].id;
            currentRole = currentUserData.role;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Route based on current page
function routePage() {
    const path = window.location.pathname;
    
    if (path.includes('login.html') || path.endsWith('/')) {
        if (currentUser) {
            if (currentRole === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'students.html';
            }
        }
    } else if (path.includes('admin.html') || path.includes('activities.html')) {
        if (!currentUser || currentRole !== 'admin') {
            redirectTo('login.html');
        } else {
            initAdminPage();
        }
    } else if (path.includes('students.html')) {
        if (!currentUser || currentRole !== 'student') {
            redirectTo('login.html');
        } else {
            initStudentDashboard();
        }
    } else if (path.includes('leaderboard.html')) {
        if (!currentUser) {
            redirectTo('login.html');
        } else {
            initLeaderboard();
        }
    } else if (path.includes('history.html')) {
        if (!currentUser || currentRole !== 'student') {
            redirectTo('login.html');
        } else {
            initHistory();
        }
    }
}

function redirectTo(page) {
    window.location.href = page;
}

// Toggle between login and signup
window.toggleSignup = function(e) {
    e.preventDefault();
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabs = document.getElementById('loginTabs');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        document.getElementById('toggleText').innerHTML = "Don't have an account? <a href=\"#\" onclick=\"toggleSignup(event)\" class=\"text-link\">Sign up</a>";
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        document.getElementById('toggleText').innerHTML = "Already have an account? <a href=\"#\" onclick=\"toggleSignup(event)\" class=\"text-link\">Login</a>";
    }
};

// Handle role tabs on login
document.addEventListener('DOMContentLoaded', function() {
    const loginTabs = document.getElementById('loginTabs');
    if (loginTabs) {
        const tabs = loginTabs.querySelectorAll('[data-role]');
        
        // Initialize first tab as active
        if (tabs[0]) {
            tabs[0].classList.add('active');
        }
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Remove active from all
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.transition = 'all 0.3s ease';
                });
                
                // Add active to clicked
                this.classList.add('active');
                currentRole = this.dataset.role;
                
                // Animate role info update
                const roleLabel = document.getElementById('roleLabel');
                const roleInfo = document.getElementById('roleInfo');
                
                if (roleLabel && roleInfo) {
                    roleInfo.style.transition = 'all 0.3s ease';
                    
                    if (currentRole === 'admin') {
                        roleLabel.innerHTML = '🔐 Logging in as <strong>Admin</strong>';
                        roleInfo.style.backgroundColor = '#fff3cd';
                        roleInfo.style.borderColor = '#ffc107';
                        roleInfo.style.color = '#856404';
                    } else {
                        roleLabel.innerHTML = '📚 Logging in as <strong>Student</strong>';
                        roleInfo.style.backgroundColor = '#d1ecf1';
                        roleInfo.style.borderColor = '#bee5eb';
                        roleInfo.style.color = '#0c5460';
                    }
                }
            });
        });
        
        // Set initial role display
        const roleLabel = document.getElementById('roleLabel');
        const roleInfo = document.getElementById('roleInfo');
        if (roleLabel && roleInfo) {
            roleLabel.innerHTML = '📚 Logging in as <strong>Student</strong>';
            roleInfo.style.backgroundColor = '#d1ecf1';
            roleInfo.style.borderColor = '#bee5eb';
            roleInfo.style.color = '#0c5460';
        }
    }

    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const roleTab = document.querySelector('[data-role].active');
    const selectedRole = roleTab ? roleTab.dataset.role : 'student';
    
    if (!email || !password) {
        showError('Please enter email and password');
        return;
    }
    
    showLoading();
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Verify user role
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            
            if (userData.role === selectedRole) {
                currentUser = user;
                currentRole = selectedRole;
                currentUserData = userData;
                currentUserData.id = snapshot.docs[0].id;
                
                showSuccess(`✅ Login successful! Redirecting...`);
                
                // Wait for success message to show, then redirect
                setTimeout(() => {
                    if (selectedRole === 'admin') {
                        window.location.replace('./admin.html');
                    } else {
                        window.location.replace('./students.html');
                    }
                }, 800);
            } else {
                showError(`❌ This account is registered as ${userData.role}. Please select the correct role.`);
            }
        } else {
            showError('❌ User not found in database. Please contact admin.');
        }
    } catch (error) {
        console.error('Login error:', error);
        let errorMsg = error.message;
        if (error.code === 'auth/user-not-found') errorMsg = '❌ Email not found';
        if (error.code === 'auth/wrong-password') errorMsg = '❌ Wrong password';
        if (error.code === 'auth/invalid-email') errorMsg = '❌ Invalid email';
        showError(errorMsg);
    }
    
    hideLoading();
}

// Handle signup
window.signupUser = async function() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    
    if (!name || !email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }
    
    showLoading();
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create student user document
        const docRef = await addDoc(collection(db, 'users'), {
            uid: user.uid,
            name: name,
            email: email,
            role: 'student',
            totalPoints: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        
        currentUser = user;
        currentRole = 'student';
        currentUserData = {
            id: docRef.id,
            uid: user.uid,
            name: name,
            email: email,
            role: 'student',
            totalPoints: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        
        showSuccess('🎉 Account created successfully! Redirecting...');
        
        // Wait a moment before redirecting
        setTimeout(() => {
            window.location.replace('./students.html');
        }, 1000);
    } catch (error) {
        console.error('Signup error:', error);
        let errorMsg = error.message;
        if (error.code === 'auth/email-already-in-use') errorMsg = '❌ Email already registered';
        if (error.code === 'auth/weak-password') errorMsg = '❌ Password too weak';
        if (error.code === 'auth/invalid-email') errorMsg = '❌ Invalid email';
        showError(errorMsg);
    }
    
    hideLoading();
};

// Logout functions
window.logoutAdmin = async function() {
    await logoutUser();
};

window.logoutStudent = async function() {
    await logoutUser();
};

window.logout = async function() {
    await logoutUser();
};

async function logoutUser() {
    try {
        await signOut(auth);
        currentUser = null;
        currentRole = null;
        currentUserData = null;
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        showError(error.message);
    }
}

// ============== ADMIN PAGE ==============

function initAdminPage() {
    const path = window.location.pathname;
    
    if (path.includes('admin.html')) {
        loadStudents();
        loadStats();
    } else if (path.includes('activities.html')) {
        loadActivities();
        loadActivitySelects();
    }
}

// Load students list
async function loadStudents() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'student'), orderBy('totalPoints', 'desc'));
        
        onSnapshot(q, (snapshot) => {
            const tbody = document.getElementById('studentsTableBody');
            tbody.innerHTML = '';
            
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No students found</td></tr>';
                return;
            }
            
            snapshot.forEach(doc => {
                const student = doc.data();
                const createdDate = new Date(student.createdAt.toDate()).toLocaleDateString();
                
                tbody.innerHTML += `
                    <tr>
                        <td>${student.name}</td>
                        <td>${student.email}</td>
                        <td><strong>${student.totalPoints}</strong> pts</td>
                        <td>${createdDate}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="editStudent('${doc.id}', '${student.name}', '${student.email}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${doc.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
    } catch (error) {
        console.error('Error loading students:', error);
        showError('Failed to load students');
    }
}

// Add student
window.addStudent = async function() {
    const name = document.getElementById('studentName').value;
    const email = document.getElementById('studentEmail').value;
    const password = document.getElementById('studentPassword').value;
    
    if (!name || !email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    showLoading();
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await addDoc(collection(db, 'users'), {
            uid: user.uid,
            name: name,
            email: email,
            role: 'student',
            totalPoints: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        
        showSuccess('Student added successfully!');
        document.getElementById('studentName').value = '';
        document.getElementById('studentEmail').value = '';
        document.getElementById('studentPassword').value = '';
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
        modal.hide();
    } catch (error) {
        console.error('Error adding student:', error);
        showError(error.message);
    }
    
    hideLoading();
};

// Edit student
window.editStudent = function(docId, name, email) {
    document.getElementById('editStudentName').value = name;
    document.getElementById('editStudentEmail').value = email;
    document.getElementById('editStudentName').dataset.docId = docId;
    
    const modal = new bootstrap.Modal(document.getElementById('editStudentModal'));
    modal.show();
};

// Save student edit
window.saveStudentEdit = async function() {
    const docId = document.getElementById('editStudentName').dataset.docId;
    const name = document.getElementById('editStudentName').value;
    const email = document.getElementById('editStudentEmail').value;
    
    if (!name || !email) {
        showError('Please fill in all fields');
        return;
    }
    
    showLoading();
    
    try {
        await updateDoc(doc(db, 'users', docId), {
            name: name,
            email: email,
            updatedAt: Timestamp.now()
        });
        
        showSuccess('Student updated successfully!');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editStudentModal'));
        modal.hide();
    } catch (error) {
        console.error('Error updating student:', error);
        showError(error.message);
    }
    
    hideLoading();
};

// Delete student
window.deleteStudent = async function(docId) {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
        return;
    }
    
    showLoading();
    
    try {
        await deleteDoc(doc(db, 'users', docId));
        showSuccess('Student deleted successfully!');
    } catch (error) {
        console.error('Error deleting student:', error);
        showError(error.message);
    }
    
    hideLoading();
};

// Load stats
async function loadStats() {
    try {
        const usersRef = collection(db, 'users');
        const studentsQuery = query(usersRef, where('role', '==', 'student'));
        const studentsSnapshot = await getDocs(studentsQuery);
        document.getElementById('totalStudents').textContent = studentsSnapshot.size;
        
        const activitiesRef = collection(db, 'activities');
        const activitiesSnapshot = await getDocs(activitiesRef);
        document.getElementById('totalActivities').textContent = activitiesSnapshot.size;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============== ACTIVITIES ==============

// Load activities
async function loadActivities() {
    try {
        const activitiesRef = collection(db, 'activities');
        const q = query(activitiesRef, orderBy('createdAt', 'desc'));
        
        onSnapshot(q, (snapshot) => {
            const grid = document.getElementById('activitiesGrid');
            grid.innerHTML = '';
            
            if (snapshot.empty) {
                grid.innerHTML = '<div class="col-12"><p class="text-muted text-center py-4">No activities created yet</p></div>';
                return;
            }
            
            snapshot.forEach(doc => {
                const activity = doc.data();
                grid.innerHTML += `
                    <div class="col-md-6 col-lg-4">
                        <div class="activity-card">
                            <h5>${activity.name}</h5>
                            <p>${activity.description}</p>
                            <p><strong>${activity.defaultPoints} pts</strong></p>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteActivity('${doc.id}')">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        });
    } catch (error) {
        console.error('Error loading activities:', error);
        showError('Failed to load activities');
    }
}

// Create activity
window.createActivity = async function() {
    const name = document.getElementById('activityName').value;
    const description = document.getElementById('activityDescription').value;
    const points = parseInt(document.getElementById('activityPoints').value);
    
    if (!name || !description || !points) {
        showError('Please fill in all fields');
        return;
    }
    
    showLoading();
    
    try {
        await addDoc(collection(db, 'activities'), {
            name: name,
            description: description,
            defaultPoints: points,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        
        showSuccess('Activity created successfully!');
        document.getElementById('activityName').value = '';
        document.getElementById('activityDescription').value = '';
        document.getElementById('activityPoints').value = '';
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addActivityModal'));
        modal.hide();
        
        loadActivitySelects();
    } catch (error) {
        console.error('Error creating activity:', error);
        showError(error.message);
    }
    
    hideLoading();
};

// Delete activity
window.deleteActivity = async function(docId) {
    if (!confirm('Are you sure you want to delete this activity?')) {
        return;
    }
    
    showLoading();
    
    try {
        await deleteDoc(doc(db, 'activities', docId));
        showSuccess('Activity deleted successfully!');
        loadActivitySelects();
    } catch (error) {
        console.error('Error deleting activity:', error);
        showError(error.message);
    }
    
    hideLoading();
};

// Load activity selects
async function loadActivitySelects() {
    try {
        const activitiesRef = collection(db, 'activities');
        const q = query(activitiesRef, orderBy('name'));
        const snapshot = await getDocs(q);
        
        const select = document.getElementById('pointActivity');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select an activity</option>';
        
        snapshot.forEach(doc => {
            const activity = doc.data();
            select.innerHTML += `<option value="${doc.id}">${activity.name} (${activity.defaultPoints} pts)</option>`;
        });
    } catch (error) {
        console.error('Error loading activity selects:', error);
    }
}

// Load student selects
async function loadStudentSelects() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'student'), orderBy('name'));
        const snapshot = await getDocs(q);
        
        const select = document.getElementById('pointStudent');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a student</option>';
        
        snapshot.forEach(doc => {
            const student = doc.data();
            select.innerHTML += `<option value="${doc.id}">${student.name}</option>`;
        });
    } catch (error) {
        console.error('Error loading student selects:', error);
    }
}

// Assign points
window.assignPoints = async function() {
    const studentId = document.getElementById('pointStudent').value;
    const activityId = document.getElementById('pointActivity').value;
    const amount = parseInt(document.getElementById('pointAmount').value);
    
    if (!studentId || !activityId || !amount) {
        showError('Please fill in all fields');
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        showError('Points must be a positive number');
        return;
    }
    
    showLoading();
    
    try {
        // Get student and activity data using getDoc for direct docID access
        const studentDocSnap = await getDoc(doc(db, 'users', studentId));
        if (!studentDocSnap.exists()) {
            showError('Student not found');
            hideLoading();
            return;
        }
        const studentData = studentDocSnap.data();
        
        const activityDocSnap = await getDoc(doc(db, 'activities', activityId));
        if (!activityDocSnap.exists()) {
            showError('Activity not found');
            hideLoading();
            return;
        }
        const activityData = activityDocSnap.data();
        
        // Add point record
        await addDoc(collection(db, 'points'), {
            studentId: studentId,
            studentName: studentData.name,
            activityId: activityId,
            activityName: activityData.name,
            points: amount,
            givenBy: currentUser.email,
            createdAt: Timestamp.now()
        });
        
        // Update student total points
        const newTotal = (studentData.totalPoints || 0) + amount;
        await updateDoc(doc(db, 'users', studentId), {
            totalPoints: newTotal,
            updatedAt: Timestamp.now()
        });
        
        showSuccess(`✅ ${amount} points assigned to ${studentData.name}!`);
        document.getElementById('pointAmount').value = '';
        document.getElementById('pointStudent').value = '';
        document.getElementById('pointActivity').value = '';
    } catch (error) {
        console.error('Error assigning points:', error);
        showError(`Error assigning points: ${error.message}`);
    }
    
    hideLoading();
};

// Load on activities page init
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    if (path.includes('activities.html')) {
        loadStudentSelects();
        loadActivitySelects();
    }
});

// ============== STUDENT DASHBOARD ==============

function initStudentDashboard() {
    if (currentUserData) {
        document.getElementById('welcomeName').textContent = currentUserData.name;
        document.getElementById('studentNameDisplay').textContent = currentUserData.name;
    }
    
    loadStudentStats();
    loadRecentPoints();
}

async function loadStudentStats() {
    try {
        if (!currentUserData) return;
        
        // Get my points
        document.getElementById('myPoints').textContent = currentUserData.totalPoints || 0;
        
        // Get my rank
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'student'), orderBy('totalPoints', 'desc'));
        const snapshot = await getDocs(q);
        
        let rank = 0;
        snapshot.forEach((doc, index) => {
            if (doc.data().uid === currentUser.uid) {
                rank = index + 1;
            }
        });
        
        document.getElementById('myRank').textContent = rank > 0 ? `#${rank}` : '#-';
        
        // Get recent activity count
        const pointsRef = collection(db, 'points');
        const pointsQuery = query(pointsRef, where('studentId', '==', currentUserData.id));
        const pointsSnapshot = await getDocs(pointsQuery);
        
        document.getElementById('recentActivity').textContent = pointsSnapshot.size;
    } catch (error) {
        console.error('Error loading student stats:', error);
    }
}

async function loadRecentPoints() {
    try {
        if (!currentUserData) return;
        
        const pointsRef = collection(db, 'points');
        const q = query(
            pointsRef,
            where('studentId', '==', currentUserData.id),
            orderBy('createdAt', 'desc')
        );
        
        onSnapshot(q, (snapshot) => {
            const container = document.getElementById('recentPointsList');
            container.innerHTML = '';
            
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-muted text-center py-4">No recent activities</p>';
                return;
            }
            
            let html = '<ul class="list-unstyled">';
            
            snapshot.forEach(doc => {
                const point = doc.data();
                const date = new Date(point.createdAt.toDate()).toLocaleDateString();
                html += `
                    <li class="mb-3 pb-3 border-bottom border-secondary">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="text-white mb-1">${point.activityName}</h6>
                                <small class="text-muted">${date}</small>
                            </div>
                            <div>
                                <span class="badge badge-success">+${point.points} pts</span>
                            </div>
                        </div>
                    </li>
                `;
            });
            
            html += '</ul>';
            container.innerHTML = html;
        });
    } catch (error) {
        console.error('Error loading recent points:', error);
    }
}

// ============== LEADERBOARD ==============

function initLeaderboard() {
    const path = window.location.pathname;
    
    if (path.includes('leaderboard.html')) {
        if (currentRole === 'admin') {
            document.getElementById('pageRole').textContent = 'Admin Panel';
        } else if (currentRole === 'student') {
            document.getElementById('pageRole').textContent = 'Student';
        }
        
        loadLeaderboard();
    }
}

async function loadLeaderboard() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'student'), orderBy('totalPoints', 'desc'));
        
        onSnapshot(q, (snapshot) => {
            const tbody = document.getElementById('leaderboardBody');
            tbody.innerHTML = '';
            
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No students yet</td></tr>';
                return;
            }
            
            let rank = 1;
            let myRank = 0;
            let myPoints = 0;
            let topPoints = 0;
            
            snapshot.forEach((doc, index) => {
                const student = doc.data();
                
                if (index === 0) {
                    topPoints = student.totalPoints;
                }
                
                if (student.uid === currentUser?.uid) {
                    myRank = rank;
                    myPoints = student.totalPoints;
                }
                
                let rankBadge = '';
                if (rank === 1) {
                    rankBadge = '<span class="rank-badge rank-1">🥇</span>';
                } else if (rank === 2) {
                    rankBadge = '<span class="rank-badge rank-2">🥈</span>';
                } else if (rank === 3) {
                    rankBadge = '<span class="rank-badge rank-3">🥉</span>';
                } else {
                    rankBadge = `<span class="rank-badge rank-default">#${rank}</span>`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td>${rankBadge}</td>
                        <td>${student.name}</td>
                        <td><strong>${student.totalPoints}</strong></td>
                        <td id="activities-count-${doc.id}">0</td>
                    </tr>
                `;
                
                // Load activity count
                loadActivityCount(doc.id, `activities-count-${doc.id}`);
                
                rank++;
            });
            
            // Show my position if student
            if (currentRole === 'student' && myRank > 0) {
                const myCard = document.getElementById('myPositionCard');
                myCard.style.display = 'block';
                document.getElementById('myPositionRank').textContent = `#${myRank}`;
                document.getElementById('myPositionPoints').textContent = myPoints;
                document.getElementById('myPositionDiff').textContent = topPoints - myPoints;
            }
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showError('Failed to load leaderboard');
    }
}

async function loadActivityCount(studentId, elementId) {
    try {
        const pointsRef = collection(db, 'points');
        const q = query(pointsRef, where('studentId', '==', studentId));
        const snapshot = await getDocs(q);
        
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = snapshot.size;
        }
    } catch (error) {
        console.error('Error loading activity count:', error);
    }
}

// ============== HISTORY PAGE ==============

function initHistory() {
    if (currentUserData) {
        document.getElementById('studentNameDisplay').textContent = currentUserData.name;
    }
    
    loadHistoryStats();
    loadHistoryTimeline();
}

async function loadHistoryStats() {
    try {
        if (!currentUserData) return;
        
        // Total points
        document.getElementById('totalPoints').textContent = currentUserData.totalPoints || 0;
        
        // Activity count
        const pointsRef = collection(db, 'points');
        const q = query(pointsRef, where('studentId', '==', currentUserData.id));
        const snapshot = await getDocs(q);
        document.getElementById('activitiesCount').textContent = snapshot.size;
        
        // This month points
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let monthPoints = 0;
        
        snapshot.forEach(doc => {
            const date = doc.data().createdAt.toDate();
            if (date >= monthStart) {
                monthPoints += doc.data().points;
            }
        });
        
        document.getElementById('monthPoints').textContent = monthPoints;
        
        // Current rank
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('role', '==', 'student'), orderBy('totalPoints', 'desc'));
        const usersSnapshot = await getDocs(usersQuery);
        
        let rank = 0;
        usersSnapshot.forEach((doc, index) => {
            if (doc.data().uid === currentUser.uid) {
                rank = index + 1;
            }
        });
        
        document.getElementById('currentRank').textContent = rank > 0 ? `#${rank}` : '#-';
    } catch (error) {
        console.error('Error loading history stats:', error);
    }
}

async function loadHistoryTimeline() {
    try {
        if (!currentUserData) return;
        
        const pointsRef = collection(db, 'points');
        const q = query(
            pointsRef,
            where('studentId', '==', currentUserData.id),
            orderBy('createdAt', 'desc')
        );
        
        onSnapshot(q, (snapshot) => {
            const timeline = document.getElementById('historyTimeline');
            timeline.innerHTML = '';
            
            if (snapshot.empty) {
                timeline.innerHTML = '<p class="text-muted text-center py-4">No activities yet</p>';
                return;
            }
            
            let html = '<div class="timeline">';
            
            snapshot.forEach(doc => {
                const point = doc.data();
                const date = new Date(point.createdAt.toDate());
                const dateStr = date.toLocaleDateString();
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                html += `
                    <div class="timeline-item">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="text-white mb-1">${point.activityName}</h6>
                                <small class="text-muted">${dateStr} at ${timeStr}</small>
                            </div>
                            <span class="badge badge-success" style="font-size: 1rem;">+${point.points}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            timeline.innerHTML = html;
        });
    } catch (error) {
        console.error('Error loading history timeline:', error);
    }
}

// ============== UTILITIES ==============

function showError(message) {
    const alertDiv = document.getElementById('errorAlert');
    if (!alertDiv) return;
    
    document.getElementById('errorMessage').textContent = message;
    alertDiv.style.display = 'block';
    
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const alertDiv = document.getElementById('successAlert');
    if (!alertDiv) return;
    
    document.getElementById('successMessage').textContent = message;
    alertDiv.style.display = 'block';
    
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

function showLoading() {
    const submitBtn = document.querySelector('#loginForm button[type=\"submit\"], #signupForm button[type=\"button\"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Loading...';
    }
}

function hideLoading() {
    const submitBtn = document.querySelector('#loginForm button[type=\"submit\"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
}

// ============== INITIALIZE ==============

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Page-specific initialization is handled by routePage()
});

export { currentUser, currentRole, currentUserData };
