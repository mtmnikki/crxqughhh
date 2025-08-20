/**
 * Airtable configuration and client factory
 * - Exposes base/table/field IDs for this project.
 * - Uses airtable.js for direct client access where needed.
 * - Reads Base ID and PAT (Personal Access Token) from localStorage.
 */

import Airtable from 'airtable';

/**
 * Default production base ID for this project (updated to the new base).
 * Source: provided base metadata (appuo6esxsc55yCgI).
 */
export const AIRTABLE_BASE_ID = 'appuo6esxsc55yCgI';

/**
 * Get Airtable Base ID.
 * Reads from localStorage.AIRTABLE_BASE_ID, falls back to AIRTABLE_BASE_ID.
 */
export function getAirtableBaseId(): string {
  try {
    return localStorage.getItem('AIRTABLE_BASE_ID') || AIRTABLE_BASE_ID;
  } catch {
    return AIRTABLE_BASE_ID;
  }
}

/**
 * Get Airtable Personal Access Token (PAT) from localStorage.
 * Accepts either AIRTABLE_API_KEY or AIRTABLE_PAT for convenience.
 */
export function getAirtableToken(): string | null {
  try {
    return (
      localStorage.getItem('AIRTABLE_API_KEY') ||
      localStorage.getItem('AIRTABLE_PAT')
    );
  } catch {
    return null;
  }
}

/**
 * Create an Airtable Base client using the official airtable.js package.
 * Throws if PAT is missing, so callers can present a clear error.
 */
export function getAirtableBase(): Airtable.Base {
  const apiKey = getAirtableToken();
  const baseId = getAirtableBaseId();

  if (!apiKey) {
    throw new Error('Airtable PAT not found. Set AIRTABLE_API_KEY or AIRTABLE_PAT in this browser.');
  }

  const airtable = new Airtable({ apiKey });
  return airtable.base(baseId);
}

/**
 * TABLE_IDS: Centralized table ID references used across the app.
 * - programs: "ClinicalPrograms"
 * - members: "memberAccounts"
 * - plus related child tables used by Program Detail + Resource library
 */
export const TABLE_IDS = {
  programs: 'tblXsjw9EvEX1JnCy',               // ClinicalPrograms
  members: 'tblxoJz15zMr6CeeV',                // memberAccounts
  trainingModules: 'tblrXWJ8gC6G3L2wG',        // TrainingModules
  protocolManuals: 'tblh5Hqrd512J5C9e',        // ProtocolManuals
  documentationForms: 'tblFahap8ERhQk0p5',     // DocumentationForms
  additionalResources: 'tbldWUMJBg4nuq6rQ',    // AdditionalResources
  patientHandouts: 'tblF0sNzTgGF4EBga',        // PatientHandouts (resource library page)
  clinicalGuidelines: 'tblfIcFCFpVlOpsGr',     // ClinicalGuidelines (resource library page)
  medicalBillingResources: 'tbly4NjBbcptuc9G5',// MedicalBillingResources (resource library page)
} as const;

/**
 * FIELD_IDS: Field ID maps by table used in pages/services.
 * Program fields are taken from the "ClinicalPrograms" schema.
 */
export const FIELD_IDS = {
  programs: {
    name: 'fldZMC178eiIyTq3w',           // programName
    description: 'fldVNSdftxLraYp6P',    // programDescription
    summary: 'fldNRUwiQcesXso0s',        // programOverview
    level: 'fldAxTeupBBeP9XDb',          // experienceLevel
    slug: 'fldqrANZRsEuolDR6',           // programSlug
  },
  trainingModules: {
    moduleName: 'fldGNfcyijbCckJ77',
    moduleLength: 'fldCbTTBwwjxp6z7d',
    moduleFile: 'fld7FOPvfmAxWd1TI',
    moduleLink: 'fldKyw9533skmVv3p',
  },
  protocolManuals: {
    protocolName: 'fldBy2Thpsn4AlIbU',
    protocolFile: 'fldi28XFMhDfcosX2',
    fileLink: 'fld1fFDUsAnnAmmLo',
  },
  documentationForms: {
    formName: 'fldk7HpJIGHv3VOc4',
    formFile: 'fldrRhyCyGgUpWuIG',
    formCategory: 'fldfuX4T5a7NBb9ey',
    formLink: 'fldGi4HEH9nq4BLVy',
  },
  additionalResources: {
    resourceName: 'fldPhWKcmTg8mcNUz',
    resourceFile: 'fldOahqDBWH463d6y',
    resourceLink: 'fldTqxYoEEFAw0Y0p',
  },
} as const;
