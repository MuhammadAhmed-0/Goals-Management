import { onAuthChange } from './auth.js';

let currentUser = null;
let unsubscribeAuth = null;

document.addEventListener('DOMContentLoaded', () => {
  unsubscribeAuth = onAuthChange((user) => {
    currentUser = user;
    updateUIForAuthState(user);
  });
});

function updateUIForAuthState(user) {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  const userEmailDisplay = document.getElementById('user-email');

  if (user) {
    if (authSection) authSection.style.display = 'none';
    if (appSection) appSection.style.display = 'block';
    if (userEmailDisplay) userEmailDisplay.textContent = user.email;
  } else {
    if (authSection) authSection.style.display = 'block';
    if (appSection) appSection.style.display = 'none';
  }
}

function showMessage(message, type = 'info') {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
}

window.showMessage = showMessage;
window.getCurrentUser = () => currentUser;
