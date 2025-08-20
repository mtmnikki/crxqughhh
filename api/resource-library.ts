import type { IncomingMessage, ServerResponse } from 'http';

// Use require to avoid type issues; airtable CJS is supported on Vercel Node runtime.
const Airtable = require('airtable');

/** Minimal Airtable attachment */
interface AirtableAttachment {
  url: string;
  filename?: string;
}

/** Basic item shape returned to the client */
type Category = 'handouts' | 'clinical' | 'billing';
interface SimpleItem {
  id: string;
  name: string;
  url?: string;
}

/**
 * Get the first attachment URL from an attachments field if present
 */
function firstAttachmentUrl(attachments: unknown): string | undefined {
  const list = (attachments as AirtableAttachment[]) || [];
  if (Array.isArray(list) && list.length > 0 && list[0]?.url) return list[0].url;
  return undefined;
}

/**
 * Read query parameters from the request URL
 */
function getQuery(req: any): Record<string, string | undefined> {
  const url = new URL(req.url || '', 'http://localhost');
  const params: Record<string, string | undefined> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  return params;
}

/**
 * API handler for the unified Resource Library
 */
export default async function handler(
  req: IncomingMessage & { method?: string },
  res: ServerResponse
) {
  try {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error:
            'Airtable is not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in your Vercel project.',
        })
      );
      return;
    }

    const { cat, q } = getQuery(req);
    const filterCat = (cat || '').toLowerCase();
    const qlc = (q || '').toLowerCase();
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    /**
     * Fetch a table as a list of SimpleItem
     * @param table Airtable table name
     * @param nameField Field name for the item title
     * @param fileField Field name for the attachments
     * @param linkField Optional field name with a direct link overriding attachments
     */
    async function fetchTable(
      table: string,
      nameField: string,
      fileField: string,
      linkField?: string
    ): Promise<SimpleItem[]> {
      const records = await base(table)
        .select({
          fields: [nameField, fileField, linkField || ''],
          pageSize: 100,
        })
        .all();

      return records.map((r: any) => {
        const name = (r.get(nameField) as string) || '';
        const link =
          (linkField ? (r.get(linkField) as string) : undefined) ||
          firstAttachmentUrl(r.get(fileField));
        return { id: r.id, name, url: link };
      });
    }

    // Decide which tables to query based on category filter
    const doHandouts = !filterCat || filterCat === 'handouts';
    const doClinical = !filterCat || filterCat === 'clinical';
    const doBilling = !filterCat || filterCat === 'billing';

    // Fetch in parallel with consistent typing
    const [handouts, clinical, billing] = await Promise.all([
      doHandouts
        ? fetchTable('PatientHandouts', 'handoutName', 'handoutFile')
        : Promise.resolve<SimpleItem[]>([]),
      doClinical
        ? fetchTable('ClinicalGuidelines', 'guidelineName', 'guidelineFile', 'guidelineLink')
        : Promise.resolve<SimpleItem[]>([]),
      doBilling
        ? fetchTable('MedicalBillingResources', 'billingresourceName', 'billingresourceFile')
        : Promise.resolve<SimpleItem[]>([]),
    ]);

    /** Aggregate and tag category */
    const results: Array<SimpleItem & { category: Category }> = [];
    handouts.forEach((r: SimpleItem) => results.push({ ...r, category: 'handouts' }));
    clinical.forEach((r: SimpleItem) => results.push({ ...r, category: 'clinical' }));
    billing.forEach((r: SimpleItem) => results.push({ ...r, category: 'billing' }));

    // Basic text filter on name + category
    const filtered: Array<SimpleItem & { category: Category }> = qlc
      ? results.filter((r) => `${r.name} ${r.category}`.toLowerCase().includes(qlc))
      : results;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    // Public caching via Vercel Edge/CDN
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.end(JSON.stringify({ items: filtered }));
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('API /resource-library error:', err?.message || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}