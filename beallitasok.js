import { getAuth, onAuthStateChanged, updateEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const auth = getAuth();
const db = getFirestore();

function updateUIWithUserData(userData, userEmail) {
    // Update form fields
    document.querySelector('input[type="text"]').value = userData.fullName || '';
    document.querySelector('input[type="email"]').value = userData.email || userEmail;
    document.querySelector('input[type="tel"]').value = userData.phoneNumber || '';
    
    // Update sidebar info
    document.querySelector('.user-info h4').textContent = userData.fullName || 'Névtelen';
    document.querySelector('.user-info p').textContent = userData.userType === 'tenant' ? 'Bérlő' : 'Bérbeadó';
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                updateUIWithUserData(userData, user.email);

                // Setup save button handler
                const saveButton = document.querySelector('.btn-primary');
                saveButton.addEventListener('click', async (event) => {
                    event.preventDefault();
                    saveButton.disabled = true;
                    const originalText = saveButton.textContent;
                    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

                    try {
                        const newData = {
                            fullName: document.querySelector('input[type="text"]').value.trim(),
                            email: document.querySelector('input[type="email"]').value.trim(),
                            phoneNumber: document.querySelector('input[type="tel"]').value.trim(),
                            updatedAt: new Date().toISOString()
                        };

                        // Update email in Auth if changed
                        if (newData.email !== user.email) {
                            await updateEmail(user, newData.email);
                        }

                        // Update in Firestore
                        await updateDoc(doc(db, 'users', user.uid), newData);
                        
                        // Update UI with new data
                        updateUIWithUserData(newData, newData.email);
                        
                        alert('Beállítások sikeresen mentve!');
                    } catch (error) {
                        console.error('Error updating user data:', error);
                        alert('Hiba történt a mentés során: ' + error.message);
                    } finally {
                        saveButton.disabled = false;
                        saveButton.textContent = originalText;
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            alert('Hiba történt az adatok betöltése során.');
        }
    } else {
        window.location.href = 'index.html';
    }
});

// Handle notification toggles
document.querySelectorAll('.notification-settings input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
        const settingType = e.target.closest('.setting-item').querySelector('h3').textContent;
        const isEnabled = e.target.checked;
        
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                [`notifications.${settingType}`]: isEnabled
            });
        } catch (error) {
            console.error('Error updating notification settings:', error);
            e.target.checked = !isEnabled;
            alert('Hiba történt a beállítások mentése során. Kérjük próbálja újra.');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const logoutBtn = document.getElementById('logoutBtn');

    // Update user display name
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    userDisplayNameElement.textContent = userData.fullName || user.email;
                    
                    // Populate settings form
                    document.querySelector('input[type="text"]').value = userData.fullName || '';
                    document.querySelector('input[type="email"]').value = userData.email || user.email;
                    document.querySelector('input[type="tel"]').value = userData.phoneNumber || '';
                } else {
                    userDisplayNameElement.textContent = user.email;
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                userDisplayNameElement.textContent = user.email;
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // Add logout functionality
    logoutBtn.addEventListener('click', () => {
        auth.signOut()
            .then(() => window.location.href = 'index.html')
            .catch(error => console.error('Error signing out:', error));
    });

    // Handle settings form submission
    const profileForm = document.querySelector('.profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const submitBtn = profileForm.querySelector('.btn-primary');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mentés...';

        try {
            const formData = {
                fullName: profileForm.querySelector('input[type="text"]').value,
                email: profileForm.querySelector('input[type="email"]').value,
                phoneNumber: profileForm.querySelector('input[type="tel"]').value,
                updatedAt: new Date().toISOString()
            };

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, formData);
            
            // Update display name in the sidebar
            userDisplayNameElement.textContent = formData.fullName;
            
            alert('Beállítások sikeresen mentve!');
        } catch (error) {
            console.error('Error updating user settings:', error);
            alert('Hiba történt a beállítások mentése közben: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Mentés';
        }
    });
});