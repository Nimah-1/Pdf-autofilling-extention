const loginEmailInput = document.getElementById('loginEmail');
const loginBtn = document.getElementById('loginBtn');
const startBtn = document.getElementById('startBtn');
const profileIconBtn = document.getElementById('profileIconBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const loginContainer = document.getElementById('loginContainer');
const mainContainer = document.getElementById('mainContainer');
const profileContainer = document.getElementById('profileContainer');
const profileFieldsContainer = document.getElementById('profileFields');
const saveBtn = document.getElementById('saveBtn');

const AUTH_KEY = 'authEmail';
const PROFILE_KEY = 'savedProfile';
const REQUIRED_PROFILE_FIELDS = ['fullName', 'dob', 'email', 'phone', 'address', 'city', 'country'];

let currentAuth = null;
let currentProfile = null;

const fieldDefinitions = [
  { id: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Jane Doe' },
  { id: 'firstName', label: 'First Name', type: 'text', placeholder: 'Jane' },
  { id: 'lastName', label: 'Last Name', type: 'text', placeholder: 'Doe' },
  { id: 'email', label: 'Email Address', type: 'email', placeholder: 'jane.doe@example.com' },
  { id: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+1 555 123 4567' },
  { id: 'dob', label: 'Date of Birth', type: 'date', placeholder: '' },
  { id: 'address', label: 'Address', type: 'text', placeholder: '123 Main Street' },
  { id: 'city', label: 'City', type: 'text', placeholder: 'San Francisco' },
  { id: 'country', label: 'Country', type: 'text', placeholder: 'United States' },
  { id: 'linkedIn', label: 'LinkedIn URL', type: 'url', placeholder: 'https://www.linkedin.com/in/janedoe' },
  { id: 'github', label: 'GitHub URL', type: 'url', placeholder: 'https://github.com/janedoe' },
  { id: 'portfolio', label: 'Portfolio Website', type: 'url', placeholder: 'https://janedoe.dev' },
  { id: 'currentTitle', label: 'Current Job Title', type: 'text', placeholder: 'Senior Software Engineer' },
  { id: 'currentCompany', label: 'Current Company', type: 'text', placeholder: 'Example Corp' },
  { id: 'yearsExperience', label: 'Years of Experience', type: 'number', placeholder: '8' },
  { id: 'degree', label: 'Degree', type: 'text', placeholder: 'M.Sc. Computer Science' },
  { id: 'university', label: 'University / School', type: 'text', placeholder: 'Stanford University' },
  { id: 'skills', label: 'Skills', type: 'textarea', placeholder: 'JavaScript, React, Node.js, SQL', rows: 3 },
  { id: 'summary', label: 'Personal Summary', type: 'textarea', placeholder: 'A concise paragraph describing your professional experience.', rows: 4 },
  { id: 'coverLetter', label: 'Cover Letter', type: 'textarea', placeholder: 'Write a direct cover letter or application message for forms that accept cover letter text.', rows: 6 }
];

function debug(...args) {
  console.debug('[Resume Autofill]', ...args);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function profileComplete(profile) {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every(key => String(profile[key] || '').trim());
}

function showView(view) {
  [loginContainer, mainContainer, profileContainer].forEach(container => container.classList.add('hidden'));
  view.classList.remove('hidden');
  profileIconBtn.classList.toggle('hidden', view !== mainContainer);
}

function renderProfileFields() {
  if (!profileFieldsContainer) return;
  profileFieldsContainer.innerHTML = '';
  fieldDefinitions.forEach(def => {
    profileFieldsContainer.appendChild(createField(def));
  });
}

function getProfileFromForm() {
  const profile = {};
  fieldDefinitions.forEach(field => {
    const el = document.getElementById(field.id);
    profile[field.id] = el ? el.value.trim() : '';
  });
  return profile;
}

function populateForm(profile = {}) {
  fieldDefinitions.forEach(field => {
    const el = document.getElementById(field.id);
    if (!el) return;
    el.value = profile[field.id] || '';
  });
}

function createField(def) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-item';

  const label = document.createElement('label');
  label.htmlFor = def.id;
  label.textContent = def.label;

  let input;
  if (def.type === 'textarea') {
    input = document.createElement('textarea');
    if (def.rows) input.rows = def.rows;
  } else {
    input = document.createElement('input');
    input.type = def.type || 'text';
  }

  input.id = def.id;
  input.placeholder = def.placeholder || '';
  input.autocomplete = 'off';

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function loadState() {
  chrome.storage.local.get([AUTH_KEY, PROFILE_KEY], result => {
    currentAuth = result[AUTH_KEY] || null;
    currentProfile = result[PROFILE_KEY] || null;

    if (!currentAuth || !currentAuth.email) {
      showView(loginContainer);
      return;
    }

    if (!profileComplete(currentProfile)) {
      renderProfileFields();
      populateForm(currentProfile || {});
      showView(profileContainer);
      return;
    }

    showView(mainContainer);
  });
}

loginBtn.addEventListener('click', () => {
  const email = loginEmailInput.value.trim().toLowerCase();
  if (!validateEmail(email)) {
    return;
  }
  chrome.storage.local.set({ [AUTH_KEY]: { email } }, () => {
    currentAuth = { email };
    loadState();
  });
});

saveBtn.addEventListener('click', () => {
  const profile = getProfileFromForm();
  if (!profileComplete(profile)) {
    return;
  }
  if (!profile.email && currentAuth?.email) {
    profile.email = currentAuth.email;
  }
  chrome.storage.local.set({ [PROFILE_KEY]: profile }, () => {
    currentProfile = profile;
    showView(mainContainer);
  });
});

startBtn.addEventListener('click', () => {
  if (!currentProfile || !profileComplete(currentProfile)) {
    showView(profileContainer);
    return;
  }

  const data = currentProfile;
  if (!data.fullName && !data.email && !data.phone) {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) {
      return;
    }
    const tabUrl = tabs[0].url || '';
    if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('about:') || tabUrl.startsWith('edge://')) {
      console.warn('[Resume Autofill] Cannot autofill on:', tabUrl);
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action: 'fill', data }, response => {
      if (chrome.runtime.lastError) {
        console.error('[Resume Autofill] sendMessage error:', chrome.runtime.lastError.message);
      } else {
        debug('Autofill message sent successfully.');
      }
    });
  });
});

profileIconBtn.addEventListener('click', () => {
  if (!currentAuth) {
    return;
  }
  renderProfileFields();
  populateForm(currentProfile || { email: currentAuth.email });
  showView(profileContainer);
});

cancelEditBtn.addEventListener('click', () => {
  loadState();
});

loadState();
