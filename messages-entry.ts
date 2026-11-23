import { requireAuthGate, syncUserProfileToFirestore, type CachedProfile } from './lib/firebase-client';
import {
  appendMessageToState,
  createMessage,
  createSeedMessagesState,
  filterContacts,
  formatMessageTime,
  getLayoutCompactState,
  safeMediaUrl,
  selectContactInState,
  type Contact,
  type MessageItem,
  type MessagesState,
} from './lib/messages-logic';

const MESSAGES_STORAGE_KEY = 'rws_messages_state_v1';

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const me = $<HTMLAnchorElement>('me');
const meAv = $<HTMLElement>('me-av');
const meName = $<HTMLElement>('me-name');
const railProfile = $<HTMLAnchorElement>('rail-profile');
const rail = $<HTMLElement>('rail');

const searchBox = $<HTMLElement>('search');
const searchBtn = $<HTMLButtonElement>('search-btn');
const searchInput = $<HTMLInputElement>('q');

const workspace = $<HTMLElement>('msg-workspace');
const contactsSidebar = $<HTMLElement>('contacts-sidebar');
const chatEmptyState = $<HTMLElement>('chat-empty-state');
const chatActive = $<HTMLElement>('chat-active');
const chatPeerAv = $<HTMLElement>('chat-peer-av');
const chatPeerName = $<HTMLElement>('chat-peer-name');
const chatExpandBtn = $<HTMLButtonElement>('chat-expand-btn');
const chatThread = $<HTMLElement>('chat-thread');

const composerForm = $<HTMLFormElement>('chat-composer');
const composerInput = $<HTMLInputElement>('composer-input');
const btnLike = $<HTMLButtonElement>('btn-like');
const btnMic = $<HTMLButtonElement>('btn-mic');
const btnVideo = $<HTMLButtonElement>('btn-video');
const btnPhoto = $<HTMLButtonElement>('btn-photo');
const filePhoto = $<HTMLInputElement>('file-photo');
const fileVideo = $<HTMLInputElement>('file-video');

const composerNotice = $<HTMLElement>('composer-notice');
const composerNoticeText = $<HTMLElement>('composer-notice-text');
const recCancelBtn = $<HTMLButtonElement>('rec-cancel-btn');
const recStopBtn = $<HTMLButtonElement>('rec-stop-btn');

const lightbox = $<HTMLElement>('lightbox');
const lightboxImg = $<HTMLImageElement>('lightbox-img');
const lightboxClose = $<HTMLButtonElement>('lightbox-close');

let currentAuthorName = 'Utilisateur';
let searchQuery = '';
let state: MessagesState = loadMessagesState();

function loadMessagesState(): MessagesState {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MessagesState;
      if (parsed && Array.isArray(parsed.contacts) && parsed.threads) {
        return {
          contacts: parsed.contacts,
          threads: parsed.threads,
          selectedContactId: null, // Toujours démarrer en vue liste complète (Image 1) sauf sélection explicite
        };
      }
    }
  } catch {}
  return createSeedMessagesState();
}

function persistMessagesState(): void {
  try {
    localStorage.setItem(
      MESSAGES_STORAGE_KEY,
      JSON.stringify({
        contacts: state.contacts,
        threads: state.threads,
        selectedContactId: null,
      })
    );
  } catch {}
}

/* ---------- Rail gauche (identique à index.html) ---------- */
const setRail = (open: boolean) => {
  rail.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
};
rail.addEventListener('pointerenter', (e) => {
  if (e.pointerType === 'mouse') setRail(true);
});
rail.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') setRail(false);
});
rail.addEventListener('focusin', (e) => {
  if ((e.target as HTMLElement).matches(':focus-visible')) setRail(true);
});
rail.addEventListener('focusout', (e) => {
  if (!rail.contains(e.relatedTarget as Node)) setRail(false);
});
rail.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest('a');
  if (link && (link.dataset.direct === 'true' || rail.classList.contains('open'))) {
    return;
  }
  e.preventDefault();
  setRail(!rail.classList.contains('open'));
});
document.addEventListener('click', (e) => {
  if (!rail.contains(e.target as Node)) setRail(false);
});

/* ---------- Recherche de contacts ---------- */
let closeSearchTimer = 0;
let insideSearch = false;

function setSearch(open: boolean): void {
  window.clearTimeout(closeSearchTimer);
  searchBox.classList.toggle('open', open);
  searchBtn.setAttribute('aria-expanded', String(open));
  searchInput.tabIndex = open ? 0 : -1;
  if (open) {
    setTimeout(() => {
      if (searchBox.classList.contains('open')) searchInput.focus();
    }, 220);
  } else {
    searchInput.value = '';
    searchQuery = '';
    searchInput.blur();
    renderContacts();
  }
}

searchBox.addEventListener('pointerenter', (e) => {
  if (e.pointerType === 'mouse') {
    insideSearch = true;
    window.clearTimeout(closeSearchTimer);
  }
});
searchBox.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') {
    insideSearch = false;
    if (searchBox.classList.contains('open') && !searchInput.value.trim()) {
      closeSearchTimer = window.setTimeout(() => {
        if (!insideSearch && !searchInput.value.trim()) setSearch(false);
      }, 350);
    }
  }
});
searchBtn.addEventListener('click', () => {
  setSearch(!searchBox.classList.contains('open'));
});
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderContacts();
});

/* ---------- Profil haut ---------- */
function applyProfile(profile: CachedProfile): void {
  currentAuthorName = profile.name || 'Utilisateur';
  me.href = 'login.html?switch=1';
  me.title = `Connecté : ${profile.name}${profile.email ? ` (${profile.email})` : ''} — Changer de compte`;
  if (railProfile) railProfile.href = 'login.html?switch=1';
  meName.textContent = profile.name;
  meAv.replaceChildren();
  if (safeMediaUrl(profile.photo)) {
    const img = document.createElement('img');
    img.src = profile.photo;
    img.alt = profile.name;
    img.referrerPolicy = 'no-referrer';
    meAv.append(img);
  }
}

try {
  const cachedRaw = sessionStorage.getItem('rws_auth_user') || localStorage.getItem('rws_auth_user');
  const cached = JSON.parse(cachedRaw || 'null') as CachedProfile | null;
  if (cached && cached.name) applyProfile(cached);
} catch {}

/* ---------- Rendu Contacts (Image 1 <-> Images 2..6) ---------- */
function createAvatarImg(url: string, alt: string): HTMLElement[] {
  if (!safeMediaUrl(url)) return [];
  const img = document.createElement('img');
  img.src = url;
  img.alt = alt;
  img.referrerPolicy = 'no-referrer';
  return [img];
}

function renderContacts(): void {
  const visibleContacts = filterContacts(state.contacts, searchQuery);
  contactsSidebar.replaceChildren();

  if (!visibleContacts.length) {
    const empty = document.createElement('p');
    empty.className = 'contacts-empty';
    empty.textContent = 'Aucun contact trouvé.';
    contactsSidebar.append(empty);
    return;
  }

  visibleContacts.forEach((contact: Contact) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'contact-item' + (state.selectedContactId === contact.id ? ' is-active' : '');
    btn.dataset.contactId = contact.id;
    btn.dataset.name = contact.name;
    btn.setAttribute('aria-label', `Ouvrir la conversation avec ${contact.name}`);
    btn.setAttribute('aria-pressed', String(state.selectedContactId === contact.id));
    btn.title = `${contact.name} — ${contact.role}`;

    const av = document.createElement('span');
    av.className = 'contact-av';
    av.append(...createAvatarImg(contact.avatar, ''));

    const pill = document.createElement('span');
    pill.className = 'contact-pill';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'contact-name';
    nameSpan.textContent = contact.name;
    pill.append(nameSpan);

    if (contact.unread > 0) {
      const badge = document.createElement('span');
      badge.className = 'contact-unread';
      badge.textContent = String(contact.unread);
      pill.append(badge);
    }

    btn.append(av, pill);
    btn.addEventListener('click', () => handleSelectContact(contact.id));
    contactsSidebar.append(btn);
  });
}

function renderActiveConversation(): void {
  const layout = getLayoutCompactState(state.selectedContactId);
  workspace.setAttribute('data-compact', String(layout.isCompact));

  if (!state.selectedContactId) {
    chatEmptyState.hidden = false;
    chatActive.hidden = true;
    return;
  }

  const peer = state.contacts.find((c) => c.id === state.selectedContactId);
  if (!peer) {
    chatEmptyState.hidden = false;
    chatActive.hidden = true;
    return;
  }

  chatEmptyState.hidden = true;
  chatActive.hidden = false;

  chatPeerAv.replaceChildren(...createAvatarImg(peer.avatar, peer.name));
  chatPeerName.textContent = peer.name;
  chatPeerName.title = `${peer.name} · ${peer.role}`;

  const thread = state.threads[peer.id] || [];
  chatThread.replaceChildren(
    ...thread.map((msg: MessageItem) => {
      const row = document.createElement('div');
      row.className = 'msg-row ' + (msg.sender === 'me' ? 'is-me' : 'is-them');

      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';

      if (msg.kind === 'like') {
        bubble.classList.add('is-like');
        bubble.textContent = '👍';
      } else if (msg.kind === 'image' && msg.mediaUrl && safeMediaUrl(msg.mediaUrl)) {
        bubble.classList.add('is-media');
        const img = document.createElement('img');
        img.className = 'msg-media-img';
        img.src = msg.mediaUrl;
        img.alt = msg.text || 'Image envoyée';
        img.addEventListener('click', () => {
          lightboxImg.src = msg.mediaUrl!;
          lightbox.hidden = false;
        });
        bubble.append(img);
      } else if (msg.kind === 'video' && msg.mediaUrl && safeMediaUrl(msg.mediaUrl)) {
        bubble.classList.add('is-media');
        const vid = document.createElement('video');
        vid.className = 'msg-media-vid';
        vid.src = msg.mediaUrl;
        vid.controls = true;
        vid.playsInline = true;
        vid.preload = 'metadata';
        bubble.append(vid);
      } else if (msg.kind === 'audio' && msg.mediaUrl && safeMediaUrl(msg.mediaUrl)) {
        bubble.classList.add('is-media');
        const audio = document.createElement('audio');
        audio.className = 'msg-media-audio';
        audio.src = msg.mediaUrl;
        audio.controls = true;
        bubble.append(audio);
      } else {
        bubble.textContent = msg.text;
      }

      const time = document.createElement('span');
      time.className = 'msg-time';
      time.textContent = formatMessageTime(msg.createdAt);

      row.append(bubble, time);
      return row;
    })
  );

  requestAnimationFrame(() => {
    chatThread.scrollTop = chatThread.scrollHeight;
  });
}

function handleSelectContact(contactId: string | null): void {
  state = selectContactInState(state, contactId);
  renderContacts();
  renderActiveConversation();
  if (contactId) {
    setTimeout(() => composerInput.focus(), 180);
  }
}

chatExpandBtn.addEventListener('click', () => {
  handleSelectContact(null);
});

/* ---------- Envoi de messages, J'aime, Photo, Vidéo, Audio ---------- */
function sendMessage(
  kind: 'text' | 'like' | 'image' | 'video' | 'audio',
  text?: string,
  mediaUrl?: string
): void {
  if (!state.selectedContactId) return;
  const activeId = state.selectedContactId;
  const msg = createMessage({
    sender: 'me',
    senderName: currentAuthorName,
    kind,
    text,
    mediaUrl,
  });
  if (!msg) return;

  state = appendMessageToState(state, activeId, msg);
  persistMessagesState();
  renderContacts();
  renderActiveConversation();
}

composerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = composerInput.value.trim();
  if (!value) return;
  composerInput.value = '';
  sendMessage('text', value);
});

btnLike.addEventListener('click', () => {
  sendMessage('like', '👍');
});

function readFileAsDataUrl(file: File, isVideo: boolean, cb: (url: string) => void): void {
  if (isVideo && file.size > 4 * 1024 * 1024) {
    cb(URL.createObjectURL(file));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => cb(String(reader.result || ''));
  reader.readAsDataURL(file);
}

btnPhoto.addEventListener('click', () => filePhoto.click());
filePhoto.addEventListener('change', () => {
  const file = filePhoto.files?.[0];
  if (file) {
    readFileAsDataUrl(file, false, (url) => sendMessage('image', file.name, url));
  }
  filePhoto.value = '';
});

btnVideo.addEventListener('click', () => fileVideo.click());
fileVideo.addEventListener('change', () => {
  const file = fileVideo.files?.[0];
  if (file) {
    readFileAsDataUrl(file, true, (url) => sendMessage('video', file.name, url));
  }
  fileVideo.value = '';
});

/* ---------- Enregistrement vocal via MediaRecorder ---------- */
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recStream: MediaStream | null = null;
let recTimer = 0;
let recSeconds = 0;

function stopRecordingCleanup(): void {
  window.clearInterval(recTimer);
  btnMic.classList.remove('is-recording');
  composerNotice.hidden = true;
  if (recStream) {
    recStream.getTracks().forEach((t) => t.stop());
    recStream = null;
  }
  mediaRecorder = null;
  audioChunks = [];
}

async function toggleMicRecording(): Promise<void> {
  if (!state.selectedContactId) return;
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    composerNoticeText.textContent = 'Microphone indisponible sur ce navigateur.';
    composerNotice.hidden = false;
    window.setTimeout(() => {
      composerNotice.hidden = true;
    }, 2400);
    return;
  }

  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    recSeconds = 0;
    mediaRecorder = new MediaRecorder(recStream);

    mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    });

    mediaRecorder.addEventListener('stop', () => {
      const shouldSend = audioChunks.length > 0 && recStopBtn.dataset.send === 'true';
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      stopRecordingCleanup();
      if (shouldSend && blob.size > 0) {
        const reader = new FileReader();
        reader.onload = () => {
          sendMessage('audio', 'Message vocal', String(reader.result || ''));
        };
        reader.readAsDataURL(blob);
      }
    });

    recStopBtn.dataset.send = 'true';
    mediaRecorder.start();
    btnMic.classList.add('is-recording');
    composerNoticeText.textContent = 'Enregistrement vocal : 00:00';
    composerNotice.hidden = false;

    recTimer = window.setInterval(() => {
      recSeconds += 1;
      const mins = String(Math.floor(recSeconds / 60)).padStart(2, '0');
      const secs = String(recSeconds % 60).padStart(2, '0');
      composerNoticeText.textContent = `Enregistrement vocal : ${mins}:${secs}`;
    }, 1000);
  } catch {
    stopRecordingCleanup();
    composerNoticeText.textContent = 'Autorisation microphone refusée.';
    composerNotice.hidden = false;
    window.setTimeout(() => {
      composerNotice.hidden = true;
    }, 2400);
  }
}

btnMic.addEventListener('click', () => {
  void toggleMicRecording();
});
recStopBtn.addEventListener('click', () => {
  recStopBtn.dataset.send = 'true';
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
});
recCancelBtn.addEventListener('click', () => {
  recStopBtn.dataset.send = 'false';
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  } else {
    stopRecordingCleanup();
  }
});

/* ---------- Lightbox image & Escape ---------- */
lightboxClose.addEventListener('click', () => {
  lightbox.hidden = true;
  lightboxImg.src = '';
});
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) {
    lightbox.hidden = true;
    lightboxImg.src = '';
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!lightbox.hidden) {
      lightbox.hidden = true;
      lightboxImg.src = '';
      return;
    }
    if (searchBox.classList.contains('open')) {
      setSearch(false);
      searchBtn.focus();
    }
  }
});

/* ---------- Initialisation ---------- */
renderContacts();
renderActiveConversation();
setSearch(false);

requireAuthGate((profile, user) => {
  applyProfile(profile);
  void syncUserProfileToFirestore(user).catch(() => {});
});
