import * as pdfjsLib from './vendor/pdf.min.js';

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
const resetBtn = document.getElementById('resetBtn');
const resumeUpload = document.getElementById('resumeUpload');
const uploadArea = document.getElementById('uploadArea');
const settingsIconBtn = document.getElementById('settingsIconBtn');
const settingsContainer = document.getElementById('settingsContainer');
const groqApiKeyInput = document.getElementById('groqApiKey');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
}

const AUTH_KEY = 'authEmail';
const PROFILE_KEY = 'savedProfile';
const SETTINGS_KEY = 'appSettings';
const REQUIRED_PROFILE_FIELDS = ['fullName', 'dob', 'email', 'phone', 'address', 'city', 'country'];

let currentAuth = null;
let currentProfile = null;
let currentSettings = { groqApiKey: '' };

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
  [loginContainer, mainContainer, profileContainer, settingsContainer].forEach(container => container.classList.add('hidden'));
  view.classList.remove('hidden');
  profileIconBtn.classList.toggle('hidden', view !== mainContainer);
  settingsIconBtn.classList.toggle('hidden', view === loginContainer || view === settingsContainer);
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
  chrome.storage.local.get([AUTH_KEY, PROFILE_KEY, SETTINGS_KEY], result => {
    currentAuth = result[AUTH_KEY] || null;
    currentProfile = result[PROFILE_KEY] || null;
    currentSettings = result[SETTINGS_KEY] || { groqApiKey: '' };

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

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all fields?')) {
      // Clear form inputs
      const emptyProfile = {};
      fieldDefinitions.forEach(field => emptyProfile[field.id] = '');
      // Keep email as current auth email
      if (currentAuth && currentAuth.email) {
        emptyProfile.email = currentAuth.email;
      }
      populateForm(emptyProfile);
    }
  });
}

if (settingsIconBtn) {
  settingsIconBtn.addEventListener('click', () => {
    groqApiKeyInput.value = currentSettings.groqApiKey || '';
    showView(settingsContainer);
  });
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener('click', () => {
    loadState(); // return to correct view
  });
}

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', () => {
    const groqApiKey = groqApiKeyInput.value.trim();
    currentSettings.groqApiKey = groqApiKey;
    chrome.storage.local.set({ [SETTINGS_KEY]: currentSettings }, () => {
      alert('Settings saved successfully!');
      loadState();
    });
  });
}

if (resumeUpload && uploadArea) {
  // Handle drag and drop styling
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
  });
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
  });
  uploadArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handlePdfUpload(files[0]);
    }
  });

  resumeUpload.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handlePdfUpload(e.target.files[0]);
    }
  });
}

async function handlePdfUpload(file) {
  if (file.type !== 'application/pdf') {
    alert('Please upload a PDF file.');
    return;
  }
  if (!pdfjsLib) {
    alert('PDF parser not loaded.');
    return;
  }

  try {
    const overlay = document.createElement('div');
    overlay.className = 'parsing-overlay';
    overlay.innerHTML = '<div class="spinner"></div><span class="parsing-text">Reading PDF...</span>';
    uploadArea.appendChild(overlay);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    let parsedData = {};

    if (currentSettings.groqApiKey) {
      overlay.querySelector('.parsing-text').textContent = 'Parsing with AI...';
      parsedData = await parseWithAI(fullText, currentSettings.groqApiKey);
    } else {
      // Fallback: Basic regex extraction
      const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = fullText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      const linkedinMatch = fullText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
      const githubMatch = fullText.match(/github\.com\/[a-zA-Z0-9_-]+/i);

      parsedData = {
        email: emailMatch ? emailMatch[0] : '',
        phone: phoneMatch ? phoneMatch[0] : '',
        linkedIn: linkedinMatch ? 'https://www.' + linkedinMatch[0] : '',
        github: githubMatch ? 'https://' + githubMatch[0] : '',
        summary: fullText.substring(0, 1000) // Put start of text in summary
      };

      // Try to guess name
      const words = fullText.trim().split(/\s+/);
      if (words.length >= 2) {
         const possibleName = words.slice(0, 2).join(' ');
         if (/^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(possibleName)) {
           parsedData.fullName = possibleName;
           parsedData.firstName = words[0];
           parsedData.lastName = words[1];
         }
      }
    }

    const currentForm = getProfileFromForm();
    const merged = { ...currentForm };
    for (const key in parsedData) {
      if (parsedData[key]) {
        merged[key] = parsedData[key];
      }
    }
    populateForm(merged);

  } catch (err) {
    console.error('Error parsing PDF:', err);
    alert('Error: ' + (err.message || 'Could not parse the PDF. Please try again.'));
  } finally {
    const overlay = uploadArea.querySelector('.parsing-overlay');
    if (overlay) overlay.remove();
    resumeUpload.value = '';
  }
}

async function parseWithAI(resumeText, apiKey) {
  const schemaStr = Object.keys(fieldDefinitions.reduce((acc, curr) => { acc[curr.id] = ''; return acc; }, {})).join(', ');
  
  const prompt = `You are an expert resume parser. Extract the following fields from the given resume text:
[${schemaStr}].
Return ONLY a valid JSON object matching these keys. If a field is not found, leave it as an empty string. Keep the summary concise.

Resume Text:
${resumeText.substring(0, 15000)}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || 'API request failed');
  }

  const data = await response.json();
  try {
    let resultText = data.choices[0].message.content;
    resultText = resultText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(resultText);
  } catch (e) {
    console.error('Failed to parse AI response as JSON', data);
    throw new Error('Invalid JSON response from AI');
  }
}

loadState();
