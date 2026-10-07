/**
 * Sector taxonomy for job postings and templates — must match the backend's
 * closed `VALID_SECTORS` enum (`backend/app/modules/jobs/schemas.py`) exactly.
 * Single source of truth so JobForm and JobTemplatesPage can't drift apart
 * (a template saved with a sector outside this list can't ever pass a real
 * job-posting submit, since JobForm.applyTemplate discards anything not here).
 */
export const SECTORS = [
  'Government & Civil Services', 'Public Sector Undertakings (PSU)',
  'Management Consulting', 'Education & Training', 'NGO & Social Sector',
  'Banking & Finance', 'Legal', 'Research & Analytics', 'Media & Journalism',
  'Healthcare & Public Health', 'IT & Technology', 'Defence & Security',
  'International Organizations', 'Think Tanks & Policy', 'Entrepreneurship',
  'Corporate Affairs', 'Government & Policy', 'Consulting',
]
