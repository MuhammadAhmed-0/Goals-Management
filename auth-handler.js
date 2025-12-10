import { signUp, signIn, logOut } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  setupAuthForms();
});

function setupAuthForms() {
  const signUpForm = document.getElementById('signup-form');
  const signInForm = document.getElementById('signin-form');
  const logOutBtn = document.getElementById('logout-btn');
  const showSignInBtn = document.getElementById('show-signin');
  const showSignUpBtn = document.getElementById('show-signup');
  const signUpSection = document.getElementById('signup-section');
  const signInSection = document.getElementById('signin-section');

  if (signUpForm) {
    signUpForm.addEventListener('submit', handleSignUp);
  }

  if (signInForm) {
    signInForm.addEventListener('submit', handleSignIn);
  }

  if (logOutBtn) {
    logOutBtn.addEventListener('click', handleLogOut);
  }

  if (showSignInBtn) {
    showSignInBtn.addEventListener('click', () => {
      signUpSection.style.display = 'none';
      signInSection.style.display = 'block';
    });
  }

  if (showSignUpBtn) {
    showSignUpBtn.addEventListener('click', () => {
      signInSection.style.display = 'none';
      signUpSection.style.display = 'block';
    });
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  if (password.length < 6) {
    window.showMessage('Password must be at least 6 characters', 'error');
    return;
  }

  const result = await signUp(email, password);
  if (result.success) {
    window.showMessage('Account created successfully!', 'success');
    e.target.reset();
  } else {
    window.showMessage(result.error, 'error');
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;

  const result = await signIn(email, password);
  if (result.success) {
    window.showMessage('Logged in successfully!', 'success');
    e.target.reset();
  } else {
    window.showMessage(result.error, 'error');
  }
}

async function handleLogOut() {
  const result = await logOut();
  if (result.success) {
    window.showMessage('Logged out successfully!', 'success');
  } else {
    window.showMessage(result.error, 'error');
  }
}
