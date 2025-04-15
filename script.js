document.addEventListener('DOMContentLoaded', function() {
    // Fix the query selector to only select anchors with non-empty href
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Contact form handling
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitButton = this.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Küldés...';

            const userEmail = this.querySelector('input[name="user_email"]').value;

            // Send email using EmailJS with updated template
            emailjs.send("service_o5auoib", "template_jw4sfeg", {
                title: "Kapcsolatfelvétel",
                name: this.querySelector('input[name="from_name"]').value,
                time: new Date().toLocaleString('hu-HU'),
                email: this.querySelector('textarea[name="message"]').value,
                user_email: userEmail,
                email_to: 'contact.propti@gmail.com',
                confirmation_to: userEmail // This will be used to send confirmation email
            })
            .then((response) => {
                console.log('SUCCESS!', response.status, response.text);
                alert('Köszönjük megkeresését! Hamarosan felvesszük Önnel a kapcsolatot.');
                contactForm.reset();
            })
            .catch((error) => {
                console.error('FAILED...', error);
                alert('Sajnáljuk, hiba történt az üzenet küldése közben. Kérjük próbálja újra később.');
            })
            .finally(() => {
                submitButton.disabled = false;
                submitButton.textContent = 'Küldés';
            });
        });
    }

    // Mobile navigation toggle
    const navLinks = document.querySelector('.nav-links');
    const mobileMenu = document.createElement('button');
    mobileMenu.classList.add('mobile-menu');
    mobileMenu.innerHTML = '☰';
    
    if (window.innerWidth <= 768) {
        document.querySelector('nav').prepend(mobileMenu);
        mobileMenu.addEventListener('click', () => {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        });
    }

    // Calculator functionality
    const options = document.querySelectorAll('.option');
    const calculatorResult = document.querySelector('.calculator-result');
    let answers = {};

    options.forEach(option => {
        option.addEventListener('click', function() {
            // Remove selected class from siblings
            const siblings = option.parentElement.querySelectorAll('.option');
            siblings.forEach(sib => sib.classList.remove('selected'));
            
            // Add selected class to clicked option
            option.classList.add('selected');
            
            // Store answer
            const question = option.closest('.question');
            const questionIndex = Array.from(question.parentElement.children).indexOf(question);
            answers[questionIndex] = option.dataset.value;

            // If all questions answered, show result
            if (Object.keys(answers).length === 3) {
                calculateSavings(answers);
            }
        });
    });

    function calculateSavings(answers) {
        let timeSavingPercent, hoursPerMonth, hoursPerYear;
        
        // Calculate based on property count
        const propertyMultiplier = answers[0] === '1-2' ? 1 : answers[0] === '2-6' ? 1.5 : 2;
        
        // Calculate based on current time spent
        const baseHours = answers[1] === '1' ? 1 : answers[1] === '3' ? 3 : 6;
        
        // Adjust based on biggest challenge
        const challengeMultiplier = answers[2] === 'communication' ? 1.2 : 
                                  answers[2] === 'admin' ? 1.3 : 1.1;

        // Calculate final numbers
        timeSavingPercent = Math.round(65 * challengeMultiplier);
        hoursPerMonth = Math.round((baseHours * 4 * propertyMultiplier) * 0.7);
        hoursPerYear = hoursPerMonth * 12;

        // Update DOM
        calculatorResult.querySelector('.stat:nth-child(1) .number').textContent = timeSavingPercent + '%';
        calculatorResult.querySelector('.stat:nth-child(2) .number').textContent = hoursPerMonth;
        calculatorResult.querySelector('.stat:nth-child(3) .number').textContent = hoursPerYear;

        // Add recommendation text based on savings
        let recommendationText = '';
        if (hoursPerYear > 100) {
            recommendationText = 'A Propti Professional csomag tökéletes választás az Ön igényeihez.';
        } else {
            recommendationText = 'Az Alap csomag megfelelő lehet az Ön igényeihez.';
        }

        // Add or update recommendation
        let recommendation = calculatorResult.querySelector('.recommendation');
        if (!recommendation) {
            recommendation = document.createElement('p');
            recommendation.className = 'recommendation';
            calculatorResult.insertBefore(recommendation, calculatorResult.querySelector('.btn-primary'));
        }
        recommendation.textContent = recommendationText;

        calculatorResult.style.display = 'block';
        calculatorResult.scrollIntoView({ behavior: 'smooth' });
    }

    // FAQ Functionality
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', () => {
            const faqItem = button.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Close all FAQ items
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Open clicked item if it wasn't active
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });

    // Pricing Toggle
    document.getElementById('pricingToggle').addEventListener('change', function() {
        const pricingCards = document.querySelector('.pricing-cards');
        if (this.checked) {
            pricingCards.classList.add('yearly');
        } else {
            pricingCards.classList.remove('yearly');
        }
    });

    // Comparison table visibility
    document.getElementById('compareButton').addEventListener('click', function() {
        const table = document.getElementById('comparisonTable');
        if (table.style.display === 'none') {
            table.style.display = 'block';
            this.textContent = 'Összehasonlítás bezárása';
        } else {
            table.style.display = 'none';
            this.textContent = 'Összes csomag összehasonlítása';
        }
    });

    // Login Modal Functionality
    const loginModal = document.getElementById('loginModal');
    const loginBtn = document.getElementById('loginBtn');
    const closeModal = document.querySelector('.close-modal');
    const showRegisterBtn = document.getElementById('showRegister');
    const showLoginBtn = document.getElementById('showLogin');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // Show/hide modal
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        loginModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Switch between login and register forms
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
    });

    // Trial Request Modal Functionality
    const trialButtons = document.querySelectorAll('a[href="#proba"]');
    const trialModal = document.createElement('div');
    trialModal.className = 'trial-modal';
    trialModal.innerHTML = `
        <div class="trial-modal-content">
            <span class="close-modal">&times;</span>
            <form class="trial-form">
                <h2>Igényeljen 1 hetes próbaverziót</h2>
                <input type="text" name="trial_name" placeholder="Név" required>
                <input type="email" name="trial_email" placeholder="Email cím" required>
                <input type="tel" name="trial_phone" placeholder="Telefonszám" required>
                <textarea name="trial_message" placeholder="Üzenet (opcionális)"></textarea>
                <button type="submit" class="btn-primary">Próbaverzió igénylése</button>
            </form>
        </div>
    `;
    document.body.appendChild(trialModal);

    // Handle trial button clicks
    trialButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            trialModal.style.display = 'block';
        });
    });

    // Handle trial form submission
    const trialForm = trialModal.querySelector('.trial-form');
    trialForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const submitButton = this.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Küldés...';

        // Get form values
        const name = this.querySelector('input[name="trial_name"]').value;
        const email = this.querySelector('input[name="trial_email"]').value;
        const phone = this.querySelector('input[name="trial_phone"]').value;
        const message = this.querySelector('textarea[name="trial_message"]').value;

        emailjs.send('service_o5auoib', 'template_jw4sfeg', {
            title: "Próbaverzió Igénylés",
            name: name,
            time: new Date().toLocaleString('hu-HU'),
            email: `--FREE TRIAL--\n\nNév: ${name}\nTelefonszám: ${phone}\n\n${message ? 'Üzenet: ' + message : ''}`,
            user_email: email,
        })
        .then(() => {
            alert('Köszönjük érdeklődését! Hamarosan felvesszük Önnel a kapcsolatot a próbaverzióval kapcsolatban.');
            trialForm.reset();
            trialModal.style.display = 'none';
        })
        .catch(() => {
            alert('Sajnáljuk, hiba történt a küldés során. Kérjük próbálja újra később.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'Próbaverzió igénylése';
        });
    });

    // Close trial modal
    const closeTrialModal = trialModal.querySelector('.close-modal');
    closeTrialModal.addEventListener('click', () => {
        trialModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === trialModal) {
            trialModal.style.display = 'none';
        }
    });

    // Redirect to Instagram page
    const instagramLogo = document.querySelector('.social-links a.instagram');
    if (instagramLogo) {
        instagramLogo.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            window.location.href = 'https://www.instagram.com/proptiofficial/';
        });
    }

    // Redirect to Instagram page (footer)
    const footerInstagram = document.querySelector('.footer-col .social-links a[aria-label="Instagram"]');
    if (footerInstagram) {
        footerInstagram.setAttribute('href', 'https://www.instagram.com/proptiofficial/');
        footerInstagram.setAttribute('target', '_blank');
        footerInstagram.setAttribute('rel', 'noopener noreferrer');
    }

    // Testimonial Carousel
    const container = document.querySelector('.testimonials-container');
    const cards = container.querySelectorAll('.testimonial-card');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const dotsContainer = document.querySelector('.carousel-dots');
    
    let currentIndex = 0;
    const totalCards = cards.length;
    const cardWidth = 280; // Fixed card width
    const gap = 32; // 2rem gap
    const visibleCards = 5;
    const halfVisible = Math.floor(visibleCards / 2);
    
    // Create dots
    for (let i = 0; i < totalCards; i++) {
        const dot = document.createElement('span');
        dot.classList.add('dot');
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
    }

    // Initial position setup
    positionCards();

    function positionCards() {
        cards.forEach((card, index) => {
            let position = index - currentIndex;
            
            // Handle circular wrapping
            if (position < -halfVisible) position += totalCards;
            if (position > halfVisible) position -= totalCards;
            
            // Calculate x position
            const x = position * (cardWidth + gap);
            const scale = Math.abs(position) > halfVisible ? 0.8 : 1 - (Math.abs(position) * 0.1);
            const opacity = Math.abs(position) > halfVisible ? 0 : 1 - (Math.abs(position) * 0.15);
            
            card.style.transform = `translateX(${x}px) scale(${scale})`;
            card.style.opacity = opacity;
            card.style.left = `${(container.offsetWidth - cardWidth) / 2}px`; // Center the card
        });

        // Update dots
        const dots = dotsContainer.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    function goToSlide(index) {
        currentIndex = index;
        positionCards();
    }

    function slideNext() {
        currentIndex = (currentIndex + 1) % totalCards;
        positionCards();
    }

    function slidePrev() {
        currentIndex = (currentIndex - 1 + totalCards) % totalCards;
        positionCards();
    }

    // Event listeners
    nextBtn.addEventListener('click', slideNext);
    prevBtn.addEventListener('click', slidePrev);

    // Auto-slide every 5 seconds
    let autoSlideInterval = setInterval(slideNext, 5000);

    // Pause auto-slide on hover
    container.addEventListener('mouseenter', () => {
        clearInterval(autoSlideInterval);
    });

    container.addEventListener('mouseleave', () => {
        autoSlideInterval = setInterval(slideNext, 5000);
    });

    // Touch support
    let touchStartX = 0;
    let touchEndX = 0;

    container.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        clearInterval(autoSlideInterval);
    }, false);

    container.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
        autoSlideInterval = setInterval(slideNext, 5000);
    }, false);

    function handleSwipe() {
        const swipeThreshold = 50;
        const difference = touchStartX - touchEndX;
        
        if (Math.abs(difference) > swipeThreshold) {
            if (difference > 0) {
                slideNext();
            } else {
                slidePrev();
            }
        }
    }

    // Handle window resize
    window.addEventListener('resize', positionCards);
});
