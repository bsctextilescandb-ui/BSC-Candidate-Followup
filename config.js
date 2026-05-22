/**
 * BSC Candidate CRM — Configuration
 * Replace SCRIPT_URL after deploying Google Apps Script as Web App
 */
const CONFIG = {
  // ── PASTE YOUR APPS SCRIPT WEB APP URL HERE ──
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwolTclzyP2skiQi4ndcPs4y4z0s0gRglN0fUK3jmBq-w8RAxBUltcw47QqyjGGRF-3/exec',

  // App metadata
  APP_NAME:    'BSC Candidate Followup',
  COMPANY:     'BSC The Textile Mall',
  VERSION:     '1.0.0',

  // Session key for localStorage
  SESSION_KEY: 'bsc_crm_session',

  // Salary validation (INR)
  SALARY_MIN:  8000,
  SALARY_MAX:  200000,

  // Interview cutoff (out of 60 per round)
  INTERVIEW_CUTOFF: 36,
  INTERVIEW_MAX:    60,

  // Offer follow-up SLA (days before flagging as urgent)
  OFFER_SLA_DAYS: 3,

  // Onboarding items total
  OB_TOTAL_ITEMS: 8,

  // Pages that require login (all except candidate-entry)
  PROTECTED_PAGES: [
    'dashboard.html',
    'candidates.html',
    'interview-panel.html',
    'offer-process.html',
    'onboarding.html',
    'employee-exit.html'
  ],

  // Role → home page mapping
  ROLE_HOME: {
    HR:           'dashboard.html',
    'Floor Manager': 'interview-panel.html',
    Manager:      'interview-panel.html',
    Admin:        'dashboard.html'
  },

  // Nav items visible per role
  ROLE_NAV: {
    HR: ['dashboard','candidates','interview','offer','onboarding','exit','form'],
    'Floor Manager': ['interview','candidates'],
    Manager: ['interview','dashboard'],
    Admin: ['dashboard','candidates','interview','offer','onboarding','exit','form','settings']
  }
};

// Duplicate phone detection threshold (ms debounce)
CONFIG.DUP_DEBOUNCE = 600;

// Freeze so it can't be mutated at runtime
Object.freeze(CONFIG);
