const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');

navToggle?.addEventListener('click', () => {
  const expanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!expanded));
  nav.classList.toggle('open');
});

const accordionToggles = Array.from(document.querySelectorAll('.accordion-toggle'));

function closeAllAccordions() {
  accordionToggles.forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    const panel = button.nextElementSibling;
    if (panel instanceof HTMLElement) {
      panel.classList.remove('open');
    }
  });
}

accordionToggles.forEach((button) => {
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    const panel = button.nextElementSibling;

    // Close all before toggling for an accordion-like behavior
    closeAllAccordions();

    if (!expanded) {
      button.setAttribute('aria-expanded', 'true');
      if (panel instanceof HTMLElement) {
        panel.classList.add('open');
      }
    }
  });
});

// Smooth scroll for anchor links
const scrollLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
scrollLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = (link.getAttribute('href') || '').slice(1);
    const targetEl = document.getElementById(targetId);

    if (targetEl) {
      event.preventDefault();
      targetEl.scrollIntoView({ behavior: 'smooth' });
      nav.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  });
});

// Example CTA interaction for start buttons
const startButtons = Array.from(document.querySelectorAll('[data-action="start"]'));
startButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.href = 'login.html';
  });
});
