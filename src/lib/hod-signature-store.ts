/**
 * HOD Signature & Institutional Sign-Off Store
 * 
 * Provides persistence (localStorage) and default realistic SVG signatures
 * and institutional stamps for the Departmental Clearance Pass.
 */

export interface HodSignoffData {
  hodName: string;
  hodTitle: string;
  departmentName: string;
  facultyName: string;
  institutionName: string;
  academicSession: string;
  semester: string;
  signatureImage: string; // Base64 data URL or SVG data URL
  stampImage: string;     // Base64 data URL or SVG data URL
  officialSealText: string;
  updatedAt: string;
}

const STORAGE_KEY = 'bcams_hod_signoff_data';

// Highly realistic cursive SVG signature (fountain pen ink style)
export const DEFAULT_SVG_SIGNATURE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
  <defs>
    <filter id="ink-bleed" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="0.4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <g fill="none" stroke="#1e3a8a" stroke-linecap="round" stroke-linejoin="round" filter="url(#ink-bleed)">
    <!-- Capital A with flourish -->
    <path d="M 30 75 C 38 45, 52 20, 65 18 C 72 17, 75 32, 60 78 C 55 90, 48 92, 42 85 C 38 80, 45 68, 62 65 C 80 62, 95 64, 110 52" stroke-width="2.8" />
    <!-- Loop and 'deleke' letters -->
    <path d="M 110 52 C 118 42, 126 40, 128 50 C 130 60, 118 64, 125 64 C 132 64, 140 45, 146 32 C 148 28, 143 28, 140 38 C 135 55, 148 65, 158 55 C 165 48, 172 45, 175 58 C 177 65, 185 64, 192 50 C 196 42, 202 42, 204 54 C 206 62, 215 58, 222 46" stroke-width="2.4" />
    <!-- Loop cross stroke -->
    <path d="M 50 56 Q 130 48 230 45" stroke-width="2.1" />
    <!-- Dramatic Underline flourish -->
    <path d="M 40 88 C 90 85, 160 82, 220 80 C 255 79, 275 83, 290 88 C 298 90, 270 94, 235 93" stroke-width="2.6" />
    <!-- Two accent dots -->
    <circle cx="270" cy="74" r="2.2" fill="#1e3a8a" />
    <circle cx="282" cy="71" r="2.2" fill="#1e3a8a" />
  </g>
</svg>
`)}`;

// Realistic circular institutional official stamp
export const DEFAULT_SVG_STAMP = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <path id="circlePathOuter" d="M 80, 80 m -62, 0 a 62,62 0 1,1 124,0 a 62,62 0 1,1 -124,0" />
    <path id="circlePathInner" d="M 80, 80 m -46, 0 a 46,46 0 1,0 92,0 a 46,46 0 1,0 -92,0" />
  </defs>
  <g fill="none" stroke="#dc2626" opacity="0.88" transform="rotate(-8 80 80)">
    <!-- Outer rings -->
    <circle cx="80" cy="80" r="74" stroke-width="2.8" stroke-dasharray="7 2" />
    <circle cx="80" cy="80" r="68" stroke-width="1.6" />
    <circle cx="80" cy="80" r="50" stroke-width="1.2" />
    <circle cx="80" cy="80" r="47" stroke-width="0.8" />
    
    <!-- Outer curved text -->
    <text font-family="'Courier New', Courier, monospace" font-size="8.8" font-weight="900" fill="#dc2626" letter-spacing="1.5">
      <textPath href="#circlePathOuter" startOffset="50%" text-anchor="middle">
        FAMSAS COLLEGE OF HEALTH
      </textPath>
    </text>
    
    <!-- Inner bottom curved text -->
    <text font-family="'Courier New', Courier, monospace" font-size="7.5" font-weight="800" fill="#dc2626" letter-spacing="1.2">
      <textPath href="#circlePathInner" startOffset="50%" text-anchor="middle">
        ★ DEPT OF COMPUTER SCIENCE ★
      </textPath>
    </text>
    
    <!-- Central boxed verification text -->
    <rect x="36" y="66" width="88" height="28" rx="3" stroke-width="1.8" fill="#fef2f2" fill-opacity="0.2" />
    <text x="80" y="77" font-family="'Arial Black', Impact, sans-serif" font-size="9" font-weight="bold" fill="#dc2626" text-anchor="middle" letter-spacing="1">
      APPROVED
    </text>
    <text x="80" y="89" font-family="'Courier New', monospace" font-size="7.5" font-weight="bold" fill="#dc2626" text-anchor="middle">
      EXAM CLEARANCE
    </text>
  </g>
</svg>
`)}`;

export const DEFAULT_HOD_SIGNOFF: HodSignoffData = {
  hodName: 'Dr. A. B. Adeleke, Ph.D.',
  hodTitle: 'Head of Department',
  departmentName: 'Department of Computer Science',
  facultyName: 'College of Natural & Applied Sciences',
  institutionName: 'FAMSAS COLLEGE OF HEALTH',
  academicSession: '2026/2027 Academic Session',
  semester: 'First Semester',
  signatureImage: DEFAULT_SVG_SIGNATURE,
  stampImage: DEFAULT_SVG_STAMP,
  officialSealText: 'ACADEMIC CLEARANCE VALIDATED — MINIMUM 75% ATTENDANCE VERIFIED',
  updatedAt: new Date().toISOString(),
};

/**
 * Retrieve current HOD sign-off configurations from localStorage
 */
export function getHodSignoffData(): HodSignoffData {
  if (typeof window === 'undefined') {
    return DEFAULT_HOD_SIGNOFF;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HOD_SIGNOFF;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_HOD_SIGNOFF,
      ...parsed,
      // Fallback if image was removed or empty
      signatureImage: parsed.signatureImage || DEFAULT_SVG_SIGNATURE,
      stampImage: parsed.stampImage || DEFAULT_SVG_STAMP,
    };
  } catch (err) {
    console.warn('Failed to parse HOD sign-off data from localStorage, using defaults', err);
    return DEFAULT_HOD_SIGNOFF;
  }
}

/**
 * Persist updated HOD sign-off data to localStorage and dispatch event for live updates
 */
export function saveHodSignoffData(data: Partial<HodSignoffData>): HodSignoffData {
  const current = getHodSignoffData();
  const updated: HodSignoffData = {
    ...current,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('bcams:hod-signoff-updated', { detail: updated }));
  } catch (err) {
    console.error('Failed to save HOD sign-off data to localStorage', err);
  }

  return updated;
}

/**
 * Reset HOD sign-off data back to system defaults
 */
export function resetHodSignoffData(): HodSignoffData {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('bcams:hod-signoff-updated', { detail: DEFAULT_HOD_SIGNOFF }));
  } catch (err) {
    console.error('Failed to reset HOD sign-off data', err);
  }
  return DEFAULT_HOD_SIGNOFF;
}

