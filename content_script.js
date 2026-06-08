function fieldCandidates() {
  return Array.from(document.querySelectorAll('input,textarea,select'));
}

function normalizeKey(value) {
  return (value || '').toString().trim().toLowerCase();
}

function getLabelText(inp) {
  const id = inp.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.innerText;
  }
  const parentLabel = inp.closest('label');
  return parentLabel ? parentLabel.innerText : '';
}

function fieldHasToken(fieldText, tokens) {
  if (!fieldText) return false;
  const norm = normalizeKey(fieldText);
  return tokens.some(token => norm.includes(token));
}

const fieldKeywords = {
  fullName: ['full name', 'name', 'applicant'],
  firstName: ['first name', 'first_name', 'firstname', 'given name'],
  lastName: ['last name', 'last_name', 'lastname', 'family name', 'surname'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['phone', 'mobile', 'tel', 'telephone', 'cell', 'contact number'],
  contact: ['contact', 'contact information'],
  coverLetter: ['cover letter', 'cover-letter', 'cover_letter', 'application letter', 'application message', 'motivation letter', 'motivation'],
  address: ['address', 'location', 'residence', 'street', 'postal', 'zip', 'zipcode'],
  city: ['city', 'town', 'municipality'],
  country: ['country', 'nation'],
  linkedin: ['linkedin'],
  github: ['github'],
  portfolio: ['portfolio', 'website', 'site', 'personal website'],
  currentTitle: ['current title', 'job title', 'position', 'role', 'designation'],
  currentCompany: ['company', 'employer', 'organization', 'organisation', 'current company', 'current employer'],
  yearsExperience: ['years experience', 'experience years', 'years of experience', 'years', 'total experience', 'experience years'],
  degree: ['degree', 'qualification', 'major', 'bachelor', 'master', 'mba', 'phd'],
  university: ['university', 'college', 'school', 'institution'],
  skills: ['skills', 'technical skills', 'expertise', 'competencies', 'technologies'],
  experience: ['experience', 'work history', 'career', 'role', 'position', 'company', 'employer'],
  education: ['education', 'university', 'college', 'school', 'degree', 'major'],
  summary: ['summary', 'about', 'bio', 'profile', 'objective', 'personal statement', 'motivation', 'personal details', 'coverletter', 'application letter'],
  dob: ['dob', 'date of birth', 'birthday', 'birthdate']
};

function detectFieldTypes(attrs) {
  const matches = [];
  const tokens = attrs.map(normalizeKey).filter(Boolean);
  for (const [type, keywords] of Object.entries(fieldKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      for (const attr of tokens) {
        if (attr === keyword) {
          score += 50 + keyword.length;
        } else if (attr.includes(keyword)) {
          score += 10 + keyword.length;
        }
      }
    }
    if (score > 0) {
      matches.push({ type, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.map(item => item.type);
}

function getFieldValue(type, data, attrs) {
  const lowerAttrs = attrs.map(normalizeKey);
  switch (type) {
    case 'fullName':
      return data.fullName || data.name || '';
    case 'firstName':
      if (data.firstName) return data.firstName;
      if (data.fullName) return data.fullName.split(' ')[0];
      return '';
    case 'lastName':
      if (data.lastName) return data.lastName;
      if (data.fullName) return data.fullName.split(' ').slice(1).join(' ');
      return '';
    case 'email':
      return data.email || '';
    case 'phone':
      return data.phone || '';
    case 'dob':
      return data.dob || '';
    case 'address':
      if (fieldHasToken(lowerAttrs.join(' '), ['city', 'town'])) return data.city || data.address || '';
      if (fieldHasToken(lowerAttrs.join(' '), ['country', 'nation'])) return data.country || data.address || '';
      return data.address || '';
    case 'city':
      return data.city || '';
    case 'country':
      return data.country || '';
    case 'linkedin':
      return data.linkedIn || data.linkedin || data.portfolio || '';
    case 'github':
      return data.github || data.portfolio || '';
    case 'portfolio':
      return data.portfolio || data.linkedIn || data.github || '';
    case 'currentTitle':
      return data.currentTitle || data.currentJobTitle || '';
    case 'currentCompany':
      return data.currentCompany || '';
    case 'yearsExperience':
      return data.yearsExperience || '';
    case 'degree':
      return data.degree || '';
    case 'university':
      return data.university || '';
    case 'skills':
      return data.skills || '';
    case 'experience':
      if (Array.isArray(data.experience)) return data.experience.join(', ');
      return data.experience || data.yearsExperience || data.currentTitle || data.currentCompany || '';
    case 'education':
      return data.degree || data.university || data.education || '';
    case 'summary':
      return data.summary || '';
    case 'coverLetter':
      return data.coverLetter || '';
    case 'contact':
      return data.phone || data.email || '';
    default:
      return '';
  }
}

function fillInputValue(input, value) {
  if (!value) return false;
  try {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (e) {
    console.warn('Could not fill field:', input, e);
    return false;
  }
}

function fillForm(data) {
  const inputs = fieldCandidates();
  inputs.forEach(input => {
    const tagName = input.tagName.toLowerCase();
    if (input.type === 'hidden' || input.type === 'button' || input.type === 'submit' || input.disabled) return;

    const attrs = [input.name, input.id, input.placeholder, input.getAttribute('aria-label'), input.title, getLabelText(input)]
      .filter(Boolean)
      .map(normalizeKey);

    const candidateTypes = detectFieldTypes(attrs);
    if (candidateTypes.length === 0) return;

    const uniqueTypes = Array.from(new Set(candidateTypes));
    let chosenType = uniqueTypes[0];
    if (uniqueTypes.length > 1) {
      const exactMatch = uniqueTypes.find(type => attrs.some(attr => attr === type));
      if (exactMatch) {
        chosenType = exactMatch;
      } else {
        const priority = ['email', 'firstName', 'lastName', 'fullName', 'coverLetter', 'phone', 'dob', 'address', 'city', 'country', 'linkedin', 'github', 'portfolio', 'currentTitle', 'currentCompany', 'degree', 'university', 'skills', 'experience', 'summary', 'contact', 'education', 'website'];
        chosenType = uniqueTypes.sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0];
      }
    }

    const value = getFieldValue(chosenType, data, attrs);
    if (!value) return;

    const filled = fillInputValue(input, value);
    console.debug('[Resume Autofill] filling', chosenType, 'into', input, 'success', filled, 'attrs', attrs);
  });

  const emailField = inputs.find(inp => normalizeKey(inp.type) === 'email');
  if (emailField && data.email) fillInputValue(emailField, data.email);
  const telField = inputs.find(inp => normalizeKey(inp.type) === 'tel');
  if (telField && data.phone) fillInputValue(telField, data.phone);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'fill') {
    console.debug('[Resume Autofill] received fill request', msg.data);
    fillForm(msg.data || {});
    sendResponse({ success: true, message: 'Form filled' });
  }
});
