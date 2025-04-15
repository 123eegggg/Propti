import { getAuth, onAuthStateChanged, updateEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const auth = getAuth();
const db = getFirestore();

function getUserTypeDisplay(userType) {
    return userType === 'tenant' ? 'Bérlő' : 'Bérbeadó';
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Fill form with user data
                document.querySelector('input[type="text"]').value = userData.fullName || '';
                document.querySelector('input[type="email"]').value = userData.email || user.email;
                document.querySelector('input[type="tel"]').value = userData.phoneNumber || '';
                
                // Update sidebar info
                document.querySelector('.user-info h4').textContent = userData.fullName || '';
                document.querySelector('.user-info p').textContent = getUserTypeDisplay(userData.userType);

                // Add event listener to save button
                const saveButton = document.querySelector('.btn-primary');
                
                // Remove any existing event listeners
                const newSaveButton = saveButton.cloneNode(true);
                saveButton.parentNode.replaceChild(newSaveButton, saveButton);
                
                newSaveButton.addEventListener('click', async (event) => {
                    event.preventDefault();
                    
                    // Show loading state
                    newSaveButton.disabled = true;
                    const originalText = newSaveButton.textContent;
                    newSaveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

                    try {
                        const newFullName = document.querySelector('input[type="text"]').value;
                        const newEmail = document.querySelector('input[type="email"]').value;
                        const newPhoneNumber = document.querySelector('input[type="tel"]').value;

                        // Create update data object
                        const updateData = {
                            fullName: newFullName,
                            email: newEmail,
                            phoneNumber: newPhoneNumber,
                            updatedAt: new Date().toISOString()
                        };

                        // If email changed, update it in Firebase Auth
                        if (newEmail !== user.email) {
                            await updateEmail(user, newEmail);
                        }

                        // Update in Firestore
                        await updateDoc(doc(db, 'users', user.uid), updateData);

                        // Update UI
                        document.querySelector('.user-info h4').textContent = newFullName;

                        alert('Beállítások sikeresen mentve!');
                    } catch (error) {
                        console.error('Error updating user data:', error);
                        alert('Hiba történt a mentés során: ' + error.message);
                    } finally {
                        // Restore button state
                        newSaveButton.disabled = false;
                        newSaveButton.textContent = originalText;
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