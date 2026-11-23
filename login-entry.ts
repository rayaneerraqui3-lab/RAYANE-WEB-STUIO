import {
  signInWithGoogle,
  signOutUser,
  syncUserProfileToFirestore,
  watchAuthState,
  type CachedProfile,
} from './lib/firebase-client';

const params = new URLSearchParams(window.location.search);
const isSwitchMode = params.get('switch') === '1';

const signedInPanel = document.getElementById('signed-in-panel') as HTMLElement;
const signedOutPanel = document.getElementById('signed-out-panel') as HTMLElement;
const googleSigninBtn = document.getElementById('google-signin-btn') as HTMLButtonElement;
const googleBtnLabel = document.getElementById('google-btn-label') as HTMLElement;
const switchGoogleBtn = document.getElementById('switch-google-btn') as HTMLButtonElement;
const signoutBtn = document.getElementById('signout-btn') as HTMLButtonElement;
const acctAv = document.getElementById('acct-av') as HTMLElement;
const acctName = document.getElementById('acct-name') as HTMLElement;
const acctEmail = document.getElementById('acct-email') as HTMLElement;
const authStatus = document.getElementById('auth-status') as HTMLElement;
const loginTitle = document.getElementById('login-title') as HTMLElement;

function showStatus(kind: 'info' | 'error', msg: string): void {
  authStatus.className = `status-banner ${kind}`;
  authStatus.textContent = msg;
  authStatus.hidden = false;
}

function hideStatus(): void {
  authStatus.hidden = true;
}

function renderSignedInCard(profile: CachedProfile): void {
  acctName.textContent = profile.name;
  acctEmail.textContent = profile.email || 'Compte Gmail connecté';
  acctAv.replaceChildren();
  if (/^(https?:\/\/|\/|data:image\/)/i.test(profile.photo)) {
    const img = document.createElement('img');
    img.src = profile.photo;
    img.alt = profile.name;
    img.referrerPolicy = 'no-referrer';
    acctAv.append(img);
  } else {
    acctAv.textContent = profile.name.slice(0, 1).toUpperCase();
  }
}

async function handleGooglePopup(button: HTMLButtonElement, labelEl?: HTMLElement): Promise<void> {
  hideStatus();
  button.disabled = true;
  const prevText = labelEl ? labelEl.textContent : button.textContent;
  if (labelEl) labelEl.textContent = 'Connexion Google en cours...';
  else button.textContent = 'Connexion Google en cours...';

  try {
    await signInWithGoogle();
    showStatus('info', 'Connexion réussie. Redirection vers l’accueil...');
    window.location.replace('index.html');
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      showStatus('error', 'Fenêtre de connexion fermée avant la fin. Réessayez pour vous connecter.');
    } else if (code === 'auth/popup-blocked') {
      showStatus('error', 'Le navigateur a bloqué la fenêtre Google. Autorisez les pop-ups puis réessayez.');
    } else if (code === 'auth/unauthorized-domain') {
      showStatus('error', 'Ce domaine doit être autorisé dans Firebase Auth pour la connexion Google.');
    } else {
      showStatus('error', 'Impossible de finaliser la connexion Google. Veuillez réessayer.');
    }
    button.disabled = false;
    if (labelEl && prevText) labelEl.textContent = prevText;
    else if (prevText) button.textContent = prevText;
  }
}

googleSigninBtn.addEventListener('click', () => {
  void handleGooglePopup(googleSigninBtn, googleBtnLabel);
});

switchGoogleBtn.addEventListener('click', () => {
  void handleGooglePopup(switchGoogleBtn);
});

signoutBtn.addEventListener('click', async () => {
  hideStatus();
  signoutBtn.disabled = true;
  try {
    await signOutUser();
    signedInPanel.hidden = true;
    signedOutPanel.hidden = false;
    loginTitle.textContent = 'Connectez-vous avec votre compte Gmail';
    showStatus('info', 'Vous êtes déconnecté.');
  } catch {
    showStatus('error', 'Erreur lors de la déconnexion.');
  } finally {
    signoutBtn.disabled = false;
  }
});

watchAuthState((user, profile) => {
  if (!user || !profile) {
    signedInPanel.hidden = true;
    signedOutPanel.hidden = false;
    return;
  }

  if (!isSwitchMode) {
    window.location.replace('index.html');
    return;
  }

  void syncUserProfileToFirestore(user).catch(() => {});

  loginTitle.textContent = 'Votre compte Gmail connecté';
  renderSignedInCard(profile);
  signedOutPanel.hidden = true;
  signedInPanel.hidden = false;
});
