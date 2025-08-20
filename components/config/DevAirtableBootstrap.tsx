/**
 * DevAirtableBootstrap
 * - Purpose: For this preview environment only, seed localStorage with the provided
 *   Airtable Base ID and PAT so browser-side fallbacks can connect live to Airtable.
 * - Security: This embeds a secret in the client. Do NOT use in production.
 * - Behavior: Only sets keys if they are not already present in localStorage.
 */

import { useEffect } from 'react';

/**
 * DevAirtableBootstrap component
 * - Mount once near the app root to initialize local dev credentials.
 */
export default function DevAirtableBootstrap() {
  useEffect(() => {
    try {
      const haveBase = typeof localStorage !== 'undefined' && localStorage.getItem('AIRTABLE_BASE_ID');
      const havePat =
        typeof localStorage !== 'undefined' &&
        (localStorage.getItem('AIRTABLE_API_KEY') || localStorage.getItem('AIRTABLE_PAT'));

      // Provided by user for this environment
      const BASE_ID = 'appuo6esxsc55yCgI';
      const PAT =
        'patZD489KhUcFqxWN.202c504fb6ca866cbe365d974e319bddccb651e5be3800d6aaee1212c90137bb';

      if (!haveBase) {
        localStorage.setItem('AIRTABLE_BASE_ID', BASE_ID);
        // eslint-disable-next-line no-console
        console.info('[Airtable] Set AIRTABLE_BASE_ID for this browser.');
      }
      if (!havePat) {
        // We accept either key; our code reads AIRTABLE_PAT or AIRTABLE_API_KEY
        localStorage.setItem('AIRTABLE_PAT', PAT);
        // eslint-disable-next-line no-console
        console.info('[Airtable] Set AIRTABLE_PAT for this browser.');
      }
    } catch {
      // ignore if storage is disabled
    }
  }, []);

  return null;
}
