import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Airtable CJS import (supported in Vercel Node runtime)
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Airtable = require('airtable');

/** Minimal attachment object from Airtable */
interface AirtableAttachment {
  url: string;
  filename?: string;
}

/**
 * Get first attachment URL if present.
 */
function firstAttachmentUrl(attachments: unknown): string | undefined {
  const list = (attachments as AirtableAttachment[]) || [];
  if (Array.isArray(list) && list.length > 0 && list[0]?.url) return list[0].url;
  return undefined;
}

/**
 * Helper: read query string safely from Node req
 */
function getQuery(req: any): Record<string, string | undefined> {
  const url = new URL(req.url || '', 'http://localhost');
  const params: Record<string, string | undefined> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  return params;
}

/**
 * Escape a string for Airtable filterByFormula single-quoted literals.
 * Replaces single quotes with escaped version.
 */
function escapeFormulaString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * API handler for Clinical Programs
 * - Query:
 *   - GET /api/clinical-programs                -> list programs
 *   - GET /api/clinical-programs?programSlug=x -> single program detail
 * - Response shapes mirror Airtable field/table names for consistency.
 */
export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
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
          error: 'Airtable is not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in your Vercel project.',
        })
      );
      return;
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const query = getQuery(req);
    const programSlug = (query.programSlug || '').trim();

    /**
     * List mode: return compact list of programs for listings (aligned to Airtable)
     */
    if (!programSlug) {
      const records = await base('ClinicalPrograms')
        .select({
          fields: ['programName', 'programDescription', 'programSlug', 'experienceLevel'],
          pageSize: 50,
        })
        .all();

      const items = records.map((r: any) => ({
        programSlug: (r.get('programSlug') as string) || '',
        programName: (r.get('programName') as string) || '',
        programDescription: (r.get('programDescription') as string) || '',
        experienceLevel: (r.get('experienceLevel') as string) || undefined,
      }));

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      // Public caching via Vercel Edge/CDN
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.end(JSON.stringify({ items }));
      return;
    }

    /**
     * Detail mode: return full program detail (aligned to Airtable)
     */
    const esc = escapeFormulaString(programSlug);
    const progRecords = await base('ClinicalPrograms')
      .select({
        filterByFormula: `{programSlug} = '${esc}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!progRecords || progRecords.length === 0) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Program not found' }));
      return;
    }

    const p = progRecords[0];
    const programName = (p.get('programName') as string) || '';
    const programDescription = (p.get('programDescription') as string) || '';
    const programOverviewRaw = (p.get('programOverview') as string) || '';
    const experienceLevel = (p.get('experienceLevel') as string) || undefined;

    // Split overview into paragraphs by empty line or newline (derived field)
    const programOverviewParagraphs: string[] = programOverviewRaw
      ? programOverviewRaw
          .split(/\n\s*\n|\r\n\r\n|\n/g)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Fetch related records by programSlug in child tables
    const [modules, manuals, forms, resources] = await Promise.all([
      base('TrainingModules')
        .select({
          filterByFormula: `'${esc}' IN {programSlug}`,
          fields: ['moduleName', 'moduleLength', 'moduleFile', 'moduleLink', 'sortOrder'],
          sort: [{ field: 'sortOrder', direction: 'asc' } as any],
          pageSize: 100,
        })
        .all(),
      base('ProtocolManuals')
        .select({
          filterByFormula: `'${esc}' IN {programSlug}`,
          fields: ['protocolName', 'protocolFile', 'fileLink'],
          pageSize: 100,
        })
        .all(),
      base('DocumentationForms')
        .select({
          filterByFormula: `'${esc}' IN {programSlug}`,
          fields: ['formName', 'formFile', 'formCategory', 'formLink'],
          pageSize: 200,
        })
        .all(),
      base('AdditionalResources')
        .select({
          filterByFormula: `'${esc}' IN {programSlug}`,
          fields: ['resourceName', 'resourceFile', 'resourceLink'],
          pageSize: 100,
        })
        .all(),
    ]);

    const detail = {
      programSlug,
      programName,
      programDescription,
      programOverview: programOverviewRaw,
      programOverviewParagraphs,
      experienceLevel,
      trainingModules: modules.map((m: any) => ({
        id: m.id,
        moduleName: (m.get('moduleName') as string) || '',
        moduleLength: (m.get('moduleLength') as string) || undefined,
        moduleLink: typeof m.fields['moduleLink'] === 'string' ? (m.fields['moduleLink'] as string) : undefined,
        moduleFileUrl: firstAttachmentUrl(m.get('moduleFile')) || undefined,
      })),
      protocolManuals: manuals.map((doc: any) => ({
        id: doc.id,
        protocolName: (doc.get('protocolName') as string) || '',
        protocolFileUrl:
          (typeof doc.fields['fileLink'] === 'string' ? (doc.fields['fileLink'] as string) : undefined) ||
          firstAttachmentUrl(doc.get('protocolFile')) ||
          undefined,
      })),
      documentationForms: forms.map((f: any) => ({
        id: f.id,
        formName: (f.get('formName') as string) || '',
        formCategory: (f.get('formCategory') as string) || undefined,
        formLink: typeof f.fields['formLink'] === 'string' ? (f.fields['formLink'] as string) : undefined,
        formFileUrl: firstAttachmentUrl(f.get('formFile')) || undefined,
      })),
      additionalResources: resources.map((r: any) => ({
        id: r.id,
        resourceName: (r.get('resourceName') as string) || '',
        resourceLink: typeof r.fields['resourceLink'] === 'string' ? (r.fields['resourceLink'] as string) : undefined,
        resourceFileUrl: firstAttachmentUrl(r.get('resourceFile')) || undefined,
      })),
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.end(JSON.stringify(detail));
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('API /clinical-programs error:', err?.message || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}
