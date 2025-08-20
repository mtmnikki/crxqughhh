/**
 * Airtable API client (browser) that talks to our Vercel Serverless endpoints.
 * - Keeps PAT secure by never calling Airtable directly from the browser.
 * - Provides typed helpers for Program Detail and Resource Library.
 * - Types and query params are aligned with Airtable field/table names.
 */

export interface TrainingModuleItem {
  id: string;
  moduleName: string;
  moduleLength?: string;
  moduleLink?: string;
  moduleFileUrl?: string;
}

export interface ProtocolManualItem {
  id: string;
  protocolName: string;
  protocolFileUrl?: string;
}

export interface DocumentationFormItem {
  id: string;
  formName: string;
  formCategory?: string;
  formLink?: string;
  formFileUrl?: string;
}

export interface AdditionalResourceItem {
  id: string;
  resourceName: string;
  resourceLink?: string;
  resourceFileUrl?: string;
}

export interface ProgramDetailData {
  programSlug: string;
  programName: string;
  programDescription: string;
  programOverview: string;
  programOverviewParagraphs: string[];
  experienceLevel?: string;
  trainingModules: TrainingModuleItem[];
  protocolManuals: ProtocolManualItem[];
  documentationForms: DocumentationFormItem[];
  additionalResources: AdditionalResourceItem[];
}

export interface ProgramListItem {
  programSlug: string;
  programName: string;
  programDescription: string;
  experienceLevel?: string;
}

export interface ResourceLibraryItem {
  id: string;
  name: string;
  category: 'handouts' | 'clinical' | 'billing';
  url?: string;
}

/** Fetch JSON helper with basic error surface */
async function getJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init });
  if (!res.ok) {
    // Throw including body for easier debugging
    let text = '';
    try {
      text = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch a single program detail by Airtable's programSlug.
 */
export async function fetchProgramDetail(programSlug: string): Promise<ProgramDetailData> {
  return getJSON<ProgramDetailData>(`/api/clinical-programs?programSlug=${encodeURIComponent(programSlug)}`);
}

/**
 * Fetch program list aligned with Airtable names.
 */
export async function fetchProgramList(): Promise<{ items: ProgramListItem[] }> {
  return getJSON<{ items: ProgramListItem[] }>(`/api/clinical-programs`);
}

/**
 * Fetch unified Resource Library items (optionally filtered by category and query).
 * NOTE: Left as-is to avoid breaking existing library behavior.
 */
export async function fetchResourceLibrary(params?: { cat?: 'handouts' | 'clinical' | 'billing'; q?: string }) {
  const usp = new URLSearchParams();
  if (params?.cat) usp.set('cat', params.cat);
  if (params?.q) usp.set('q', params.q);
  const qs = usp.toString();
  return getJSON<{ items: ResourceLibraryItem[] }>(`/api/resource-library${qs ? `?${qs}` : ''}`);
}
