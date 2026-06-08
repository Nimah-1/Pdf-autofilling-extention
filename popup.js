const pdfInput = document.getElementById('pdfInput');
const statusMessage = document.getElementById('statusMessage');
const structureView = document.getElementById('structureView');
const rawTextView = document.getElementById('rawTextView');
const profileFieldsContainer = document.getElementById('profileFields');
const saveBtn = document.getElementById('saveBtn');
const autofillBtn = document.getElementById('autofillBtn');
const exportBtn = document.getElementById('exportJsonBtn');
const resetBtn = document.getElementById('resetBtn');
const fileLabel = document.querySelector('.file-label');

const PROFILE_KEY = 'savedProfile';
const PARSED_KEY = 'lastParsedResume';
let pdfjsLib = null;
let lastParsed = null;

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

function setStatus(message, type = 'info') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = 'status ' + type;
}

function debug(...args) {
  console.debug('[Resume Autofill]', ...args);
}

function normalizeLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

function sanitizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ').trim();
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

function mergeProfileWithParsed(profile = {}, parsed = {}) {
  const mapped = {
    fullName: parsed.name || profile.fullName || '',
    firstName: profile.firstName || (profile.fullName ? profile.fullName.split(' ')[0] : ''),
    lastName: profile.lastName || (profile.fullName ? profile.fullName.split(' ').slice(1).join(' ') : ''),
    email: parsed.email || profile.email || '',
    phone: parsed.phone || profile.phone || '',
    dob: profile.dob || '',
    address: profile.address || '',
    city: profile.city || '',
    country: profile.country || '',
    linkedIn: parsed.linkedIn || profile.linkedIn || '',
    github: parsed.github || profile.github || '',
    portfolio: parsed.portfolio || profile.portfolio || '',
    currentTitle: parsed.currentTitle || profile.currentTitle || '',
    currentCompany: parsed.currentCompany || profile.currentCompany || '',
    yearsExperience: parsed.yearsExperience || profile.yearsExperience || '',
    degree: parsed.degree || profile.degree || '',
    university: parsed.university || profile.university || '',
    skills: parsed.skills ? parsed.skills.join(', ') : profile.skills || '',
    summary: parsed.summary || profile.summary || '',
    coverLetter: profile.coverLetter || ''
  };
  return mapped;
}

async function initPdfLibrary() {
  try {
    await import('./vendor/pdf.min.js');
    pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('pdfjsLib did not initialize');
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.js');
    setStatus('PDF library loaded and ready', 'success');
    debug('PDF.js loaded');
  } catch (error) {
    console.error('[Resume Autofill] PDF.js load failed', error);
    setStatus('Failed to load PDF parser: ' + (error.message || 'Unknown error'), 'error');
  }
}

initPdfLibrary();

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /(?:\+\d{1,3}[\s-.]*)?(?:\(\d+\)|\d+)(?:[\s-.]*\d+){1,5}/g;
const urlRegex = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi;
const sectionKeywords = {
  skills: ['skills', 'technical skills', 'expertise', 'competencies', 'areas of expertise', 'technologies'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'career history', 'roles'],
  education: ['education', 'academic background', 'qualifications', 'academics', 'education and training', 'training'],
  projects: ['projects', 'project experience', 'selected projects', 'portfolio projects', 'project work'],
  certifications: ['certifications', 'certificates', 'licenses', 'awards', 'honors'],
  summary: ['summary', 'professional summary', 'profile', 'about me', 'objective'],
  contact: ['contact', 'contact information', 'personal details']
};

function headingCandidate(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const cleaned = trimmed.replace(/[:\s]+$/u, '').toLowerCase();
  if (Object.values(sectionKeywords).flat().some(term => cleaned === term || cleaned.startsWith(term + ' ') || cleaned.includes(' ' + term + ' '))) {
    return trimmed.replace(/[:\s]+$/u, '');
  }
  if (/^[A-Z\d\s\-&()]{3,50}$/.test(trimmed) && trimmed === trimmed.toUpperCase() && trimmed.split(/\s+/).length <= 6) {
    return trimmed;
  }
  if (/^.+[:]\s*$/.test(trimmed)) {
    return trimmed.replace(/[:]\s*$/, '');
  }
  return false;
}

function splitSections(lines) {
  const sections = [];
  let current = { title: 'header', lines: [] };
  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    const heading = headingCandidate(line);
    if (heading) {
      if (current.lines.length > 0 || current.title !== 'header') {
        sections.push(current);
      }
      current = { title: heading, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length > 0 || current.title !== 'header') {
    sections.push(current);
  }
  return sections;
}

function normalizedLine(line) {
  return normalizeLine(line.replace(/\u2022|\u2023|\u25E6|\u2043|\u2219/gu, '-'));
}

function parseListSection(lines) {
  const items = [];
  for (const rawLine of lines) {
    const line = normalizedLine(rawLine);
    if (!line) continue;
    let entry = line.replace(/^[-*•\s]+/, '').trim();
    if (!entry) continue;
    const parts = entry.split(/[,;]|\band\b|\bor\b/i).map(part => part.trim()).filter(Boolean);
    items.push(...parts);
  }
  return Array.from(new Set(items.map(item => item.replace(/[.]$/, '').trim()).filter(Boolean)));
}

function parseBlockSection(lines) {
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) {
        blocks.push(current.join(' '));
        current = [];
      }
      continue;
    }
    if (/^[-*•]/.test(line) && current.length) {
      blocks.push(current.join(' '));
      current = [line.replace(/^[-*•\s]+/, '').trim()];
      continue;
    }
    current.push(line);
  }
  if (current.length) {
    blocks.push(current.join(' '));
  }
  return blocks.map(item => item.replace(/[.]$/, '').trim()).filter(Boolean);
}

function detectEmail(text) {
  const match = text.match(emailRegex);
  return match ? match[0].trim() : '';
}

function detectPhone(text) {
  const matches = text.match(phoneRegex) || [];
  for (const match of matches) {
    const cleaned = match.replace(/[\s().-]/g, '');
    if (cleaned.length >= 8 && cleaned.length <= 15) {
      return match.trim();
    }
  }
  return '';
}

function detectWebsite(lines, keyword) {
  const lowerKeyword = keyword.toLowerCase();
  for (const rawLine of lines) {
    const line = normalizedLine(rawLine);
    if (!line) continue;
    const match = line.match(urlRegex);
    if (!match) continue;
    for (const url of match) {
      if (url.toLowerCase().includes(lowerKeyword)) return url.trim();
    }
  }
  return '';
}

function detectTopWebsite(lines, patterns) {
  for (const pattern of patterns) {
    const found = detectWebsite(lines, pattern);
    if (found) return found;
  }
  return '';
}

function detectName(lines, text) {
  const candidates = lines.slice(0, 12).filter(line => {
    if (!line) return false;
    if (/@|linkedin|github|portfolio|http|www\.|\+?\d/.test(line.toLowerCase())) return false;
    if (/^(resume|curriculum vitae|cv|profile|summary|objective|contact)/i.test(line)) return false;
    return true;
  });
  const nameRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})$/;
  const strong = candidates.find(line => nameRegex.test(line));
  if (strong) return strong.trim();
  const fallback = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/);
  return fallback ? fallback[1].trim() : '';
}

function detectDegree(lines) {
  const degreeRegex = /\b(Bachelor|Master|MBA|PhD|Doctor|Associate|B\.Sc\.|M\.Sc\.|B\.A\.|M\.A\.|BS|MS|BA|MA)\b[\w\s,.-]{0,40}/i;
  const text = lines.join(' ');
  const match = text.match(degreeRegex);
  return match ? match[0].trim() : '';
}

function detectUniversity(lines) {
  const candidate = lines.find(line => /\b(university|college|institute|school|academy)\b/i.test(line));
  return candidate ? candidate.trim() : '';
}

function detectYearsExperience(text) {
  const match = text.match(/(\d+)\+?\s+years?\s+of\s+experience|years?\s+experience/i);
  if (match) return match[1] || ''; 
  const matched = text.match(/(\d+)\+?\s+years?/i);
  return matched ? matched[1] : '';
}

function detectCurrentRole(lines) {
  const header = lines.slice(0, 12).join(' ');
  const roleMatch = header.match(/(Senior|Lead|Principal|Junior|Manager|Director|Engineer|Developer|Analyst|Consultant|Designer)[^,\n\r]{0,40}/i);
  const companyMatch = header.match(/at\s+([A-Z][\w&\s.-]{2,40})/i);
  return {
    title: roleMatch ? roleMatch[0].trim() : '',
    company: companyMatch ? companyMatch[1].trim() : ''
  };
}

function classifySection(title) {
  const lower = title.toLowerCase();
  for (const [category, keywords] of Object.entries(sectionKeywords)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return category;
    }
  }
  return 'other';
}

function parseResume(rawText) {
  const text = sanitizeText(rawText);
  const lines = text.split(/\n+/).map(normalizeLine).filter(Boolean);
  const parsed = {
    name: '',
    email: '',
    phone: '',
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    summary: '',
    rawText: text,
    linkedIn: '',
    github: '',
    portfolio: '',
    degree: '',
    university: '',
    yearsExperience: '',
    currentTitle: '',
    currentCompany: ''
  };

  parsed.email = detectEmail(text);
  parsed.phone = detectPhone(text);
  parsed.name = detectName(lines, text);
  parsed.linkedIn = detectTopWebsite(lines, ['linkedin.com']);
  parsed.github = detectTopWebsite(lines, ['github.com']);
  parsed.portfolio = detectTopWebsite(lines, ['portfolio', 'behance.net', 'dribbble.com', 'www.']);

  const sections = splitSections(lines);
  debug('Parsed sections:', sections.map(section => section.title));

  const merged = {
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: []
  };

  for (const section of sections) {
    const category = classifySection(section.title);
    if (category === 'skills') {
      merged.skills.push(...parseListSection(section.lines));
      continue;
    }
    if (category === 'experience') {
      merged.experience.push(...parseBlockSection(section.lines));
      continue;
    }
    if (category === 'education') {
      merged.education.push(...parseBlockSection(section.lines));
      continue;
    }
    if (category === 'projects') {
      merged.projects.push(...parseBlockSection(section.lines));
      continue;
    }
    if (category === 'certifications') {
      merged.certifications.push(...parseListSection(section.lines));
      continue;
    }
    if (category === 'summary') {
      parsed.summary = section.lines.join(' ');
    }
  }

  parsed.skills = Array.from(new Set(merged.skills)).slice(0, 100);
  parsed.experience = Array.from(new Set(merged.experience)).slice(0, 100);
  parsed.education = Array.from(new Set(merged.education)).slice(0, 100);
  parsed.projects = Array.from(new Set(merged.projects)).slice(0, 100);
  parsed.certifications = Array.from(new Set(merged.certifications)).slice(0, 100);

  if (!parsed.skills.length) {
    parsed.skills = parseListSection(lines.filter(line => /skills|technical skills|expertise|competencies/i.test(line) || /,/.test(line)));
  }
  if (!parsed.experience.length) {
    parsed.experience = parseBlockSection(lines.filter(line => /experience|worked as|company|role|internship|project/i.test(line)));
  }
  if (!parsed.education.length) {
    parsed.education = parseBlockSection(lines.filter(line => /graduate|bachelor|master|degree|university|college|school|certification/i.test(line)));
  }

  const roleInfo = detectCurrentRole(lines);
  parsed.currentTitle = roleInfo.title;
  parsed.currentCompany = roleInfo.company;
  parsed.degree = detectDegree(lines);
  parsed.university = detectUniversity(lines);
  parsed.yearsExperience = detectYearsExperience(text);

  if (!parsed.summary) {
    const summaryLine = lines.find(line => /summary|profile|objective|about me/i.test(line));
    parsed.summary = summaryLine || '';
  }

  return parsed;
}

function renderParsed(parsed) {
  if (structureView) structureView.textContent = JSON.stringify(parsed, null, 2);
  if (rawTextView) rawTextView.value = parsed.rawText || '';
}

function createAutofillPayload(profile) {
  return {
    fullName: profile.fullName || '',
    firstName: profile.firstName || (profile.fullName ? profile.fullName.split(' ')[0] : ''),
    lastName: profile.lastName || (profile.fullName ? profile.fullName.split(' ').slice(1).join(' ') : ''),
    name: profile.fullName || '',
    email: profile.email || '',
    phone: profile.phone || '',
    dob: profile.dob || '',
    address: profile.address || '',
    city: profile.city || '',
    country: profile.country || '',
    linkedIn: profile.linkedIn || '',
    github: profile.github || '',
    portfolio: profile.portfolio || '',
    currentTitle: profile.currentTitle || '',
    currentCompany: profile.currentCompany || '',
    yearsExperience: profile.yearsExperience || '',
    experience: profile.experience || profile.yearsExperience || '',
    degree: profile.degree || '',
    university: profile.university || '',
    skills: profile.skills || '',
    summary: profile.summary || '',
    coverLetter: profile.coverLetter || ''
  };
}

async function parseAndDisplayPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF parser is not loaded');
  }
  setStatus('Reading PDF text...', 'loading');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  debug('PDF pages:', pdf.numPages);

  const allLines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let currentLine = '';
    let lastY = null;
    content.items.forEach(item => {
      const str = item.str || '';
      const y = item.transform ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) allLines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine += (currentLine ? ' ' : '') + str;
      }
      lastY = y;
    });
    if (currentLine.trim()) allLines.push(currentLine.trim());
  }

  const rawText = allLines.map(normalizeLine).filter(Boolean).join('\n');
  if (!rawText) throw new Error('No text extracted from PDF');

  const parsedResume = parseResume(rawText);
  lastParsed = parsedResume;
  renderParsed(parsedResume);
  setStatus('PDF parsed. Review the profile fields and save your profile.', 'success');
  chrome.storage.local.set({ [PARSED_KEY]: parsedResume });

  const currentProfile = getProfileFromForm();
  const merged = mergeProfileWithParsed(currentProfile, parsedResume);
  populateForm(merged);

  return parsedResume;
}

function clearManualProfile() {
  fieldDefinitions.forEach(field => {
    const el = document.getElementById(field.id);
    if (el) el.value = '';
  });
  setStatus('Manual profile fields reset. You can start fresh or upload a PDF again.', 'info');
}

pdfInput.addEventListener('change', async event => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    setStatus('No file selected.', 'error');
    return;
  }
  if (fileLabel) fileLabel.textContent = file.name;

  try {
    await parseAndDisplayPdf(file);
  } catch (error) {
    console.error('[Resume Autofill] PDF parse error', error);
    setStatus('Failed to read PDF: ' + (error.message || 'Unknown error'), 'error');
  }
});

saveBtn.addEventListener('click', () => {
  const profile = getProfileFromForm();
  chrome.storage.local.set({ [PROFILE_KEY]: profile }, () => {
    setStatus('Profile saved locally.', 'success');
    debug('Saved profile', profile);
  });
});

exportBtn.addEventListener('click', () => {
  const profile = getProfileFromForm();
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profile.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

resetBtn?.addEventListener('click', () => {
  clearManualProfile();
});

autofillBtn.addEventListener('click', () => {
  const currentProfile = getProfileFromForm();
  chrome.storage.local.get([PROFILE_KEY], result => {
    const savedProfile = result[PROFILE_KEY] || {};
    const mergedProfile = mergeProfileWithParsed(
      Object.keys(currentProfile).some(key => currentProfile[key]) ? currentProfile : savedProfile,
      lastParsed || savedProfile
    );
    const data = createAutofillPayload(mergedProfile);
    if (!data.fullName && !data.email && !data.phone) {
      setStatus('Please save a profile, fill in profile fields, or upload a PDF before autofilling.', 'error');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]) {
        setStatus('No active tab to autofill.', 'error');
        return;
      }
      const tabUrl = tabs[0].url || '';
      if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('about:') || tabUrl.startsWith('edge://')) {
        setStatus('Cannot autofill on browser internal pages. Visit a website and try again.', 'error');
        console.warn('[Resume Autofill] Cannot autofill on:', tabUrl);
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'fill', data }, response => {
        if (chrome.runtime.lastError) {
          console.error('[Resume Autofill] sendMessage error:', chrome.runtime.lastError.message);
          console.warn('[Resume Autofill] Tab URL:', tabUrl);
          console.warn('[Resume Autofill] Tab ID:', tabs[0].id);
          setStatus('Autofill failed: Content script not available. Try refreshing the page or visiting a different website.', 'error');
        } else if (response && response.success) {
          setStatus('Autofill successful!', 'success');
        } else {
          setStatus('Autofill message sent.', 'success');
        }
      });
    });
  });
});

chrome.storage.local.get([PROFILE_KEY, PARSED_KEY], result => {
  renderProfileFields();

  if (result[PROFILE_KEY]) {
    populateForm(result[PROFILE_KEY]);
    setStatus('Loaded saved profile. You can edit and save it again.', 'success');
  } else {
    setStatus('Create your profile manually, or upload a resume to prefill it.', 'info');
  }

  if (result[PARSED_KEY]) {
    lastParsed = result[PARSED_KEY];
    renderParsed(lastParsed);
  }
});
