document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const modal = document.getElementById('loginModal');
    const closeModal = document.querySelector('.close-modal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');

    // Open modal
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });

    // Close modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // Close modal on X click
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Form toggle handlers
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
    });

    // Login form handler
    loginForm.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;
        const submitButton = loginForm.querySelector('button[type="submit"]');
        
        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Bejelentkezés...';

        try {
            // Check if Firebase Auth is initialized
            if (!window.fbAuth || !window.fbAuth.auth) {
                throw new Error('Firebase Authentication is not initialized');
            }

            const { auth, signInWithEmailAndPassword } = window.fbAuth;
            
            // Add retry logic
            let retryCount = 0;
            const maxRetries = 3;
            let lastError = null;

            while (retryCount < maxRetries) {
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    console.log('Login successful:', userCredential.user);
                    window.location.href = 'landlord_dashboard.html';
                    return;
                } catch (error) {
                    lastError = error;
                    console.warn(`Login attempt ${retryCount + 1} failed:`, error);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
                    }
                }
            }
            
            // If we get here, all retries failed
            throw lastError;

        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Bejelentkezési hiba történt';
            
            // Provide more specific error messages
            if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Hálózati hiba történt. Kérjük, ellenőrizze az internetkapcsolatát.';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'Nem található felhasználó ezzel az email címmel.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Hibás jelszó.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Túl sok sikertelen próbálkozás. Kérjük, próbálja újra később.';
            } else if (error.message.includes('not initialized')) {
                errorMessage = 'A rendszer inicializálása folyamatban van. Kérjük, próbálja újra.';
            }
            
            alert(errorMessage);
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = 'Bejelentkezés';
        }
    });

    // Register form handler
    registerForm.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = registerForm.querySelector('input[type="email"]').value;
        const password = registerForm.querySelector('input[type="password"]').value;
        const confirmPassword = registerForm.querySelectorAll('input[type="password"]')[1].value;
        const fullName = registerForm.querySelector('input[type="text"]').value;
        const userType = registerForm.querySelector('select[name="userType"]').value;
        const phoneNumber = registerForm.querySelector('input[name="phoneNumber"]').value;
        const companyName = userType === 'landlord' ? registerForm.querySelector('input[name="companyName"]').value : null;

        if (password !== confirmPassword) {
            alert('A jelszavak nem egyeznek!');
            return;
        }

        try {
            // Create authentication user
            const { auth, createUserWithEmailAndPassword } = window.fbAuth;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Prepare user data for Firestore
            const userData = {
                email,
                fullName,
                userType,
                phoneNumber,
                companyName,
                createdAt: new Date().toISOString(),
                userId: user.uid
            };

            // Save to Firestore using proper methods
            const { db, doc, setDoc } = window.fbDb;
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, userData);

            console.log('Registration successful with additional data:', userData);
            alert('Sikeres regisztráció!');
            window.location.href = 'landlord_dashboard.html';
        } catch (error) {
            console.error('Registration error:', error);
            alert('Regisztrációs hiba történt: ' + error.message);
            
            // If database save fails, attempt to delete the authentication user
            if (error.code !== 'auth/email-already-in-use') {
                try {
                    const user = window.fbAuth.auth.currentUser;
                    if (user) await user.delete();
                } catch (deleteError) {
                    console.error('Error cleaning up auth user:', deleteError);
                }
            }
        }
    });

    // Add dynamic company name field visibility
    const userTypeSelect = registerForm.querySelector('select[name="userType"]');
    const companyNameField = registerForm.querySelector('.company-name-field');
    
    userTypeSelect.addEventListener('change', () => {
        if (userTypeSelect.value === 'landlord') {
            companyNameField.style.display = 'block';
            companyNameField.querySelector('input').required = true;
        } else {
            companyNameField.style.display = 'none';
            companyNameField.querySelector('input').required = false;
        }
    });

    // Add authentication state observer and Firebase initialization
    const checkAuthState = () => {
        if (window.fbAuth && window.fbAuth.auth) {
            window.fbAuth.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('User is signed in:', user);
                } else {
                    console.log('User is signed out');
                }
            });
        } else {
            // If Firebase Auth is not ready yet, try again in a moment
            setTimeout(checkAuthState, 100);
        }
    };

    // Start checking for Firebase Auth
    checkAuthState();
});
