document.addEventListener('DOMContentLoaded', () => {
    // Create the lightbox overlay element
    const lightbox = document.createElement('div');
    lightbox.id = 'lightbox-overlay';
    lightbox.className = 'lightbox-overlay';
    
    // Create the image element inside the lightbox
    const lightboxImg = document.createElement('img');
    lightboxImg.className = 'lightbox-image';
    
    // Create a close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'lightbox-close';
    closeBtn.innerHTML = '&times;';
    
    // Append elements
    lightbox.appendChild(lightboxImg);
    lightbox.appendChild(closeBtn);
    document.body.appendChild(lightbox);
    
    // Function to open lightbox
    const openLightbox = (src, alt) => {
        lightboxImg.src = src;
        lightboxImg.alt = alt || '';
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    };
    
    // Function to close lightbox
    const closeLightbox = () => {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        // Clear src after transition to avoid flickering if needed, 
        // but keeping it can be fine for now.
    };
    
    // Event listener for images
    // We delegate or attach to specific classes.
    // The plan mentioned 'post-image' or 'lightbox-trigger'.
    // Let's target .post-image for now as it's already there, 
    // but we can also look for .lightbox-trigger if we add it.
    const images = document.querySelectorAll('.post-image, .lightbox-trigger');
    
    images.forEach(img => {
        img.style.cursor = 'zoom-in'; // Visual cue
        img.addEventListener('click', (e) => {
            e.preventDefault(); // In case it's wrapped in a link
            openLightbox(img.src, img.alt);
        });
    });
    
    // Close on click outside image or on close button
    lightbox.addEventListener('click', (e) => {
        if (e.target !== lightboxImg) {
            closeLightbox();
        }
    });
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
});
