/**
 * Resource Library (AppShell + search + quick cards + left filters + table)
 * - Purpose: Unified Resource Library listing from Supabase table-backed catalog.
 * - Layout:
 *   1) Search bar
 *   2) Six square quick-filter cards
 *   3) Two-column: left checkbox filters, right file table
 * - Data: Uses storageCatalog helpers (table-first).
 */

import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import MemberSidebar from '../components/layout/MemberSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  getAllResources,
  getGlobalCategory,
  ProgramSlugs,
  ProgramSlug,
} from '../services/storageCatalog';
import type { StorageFileItem } from '../services/supabaseStorage';
import {
  isDoc,
  isPdf,
  isSpreadsheet,
  isVideo,
} from '../services/supabaseStorage';
import { Loader2, Search } from 'lucide-react';

/** Primary scope for server fetch */
type Scope = 'all' | 'handouts' | 'guidelines' | 'billing' | 'program';
/** Quick filter cards (client-side toggles) */
type QuickCardKey = 'all' | 'handouts' | 'guidelines' | 'billing' | 'program' | 'videos';
/** Category tags parsed from path */
type CategoryTag =
  | 'handouts'
  | 'guidelines'
  | 'billing'
  | 'forms'
  | 'protocols'
  | 'resources'
  | 'training'
  | 'unknown';

interface FilterState {
  /** File types */
  types: {
    pdf: boolean;
    doc: boolean;
    sheet: boolean;
    video: boolean;
  };
  /** Category tags */
  cats: Record<CategoryTag, boolean>;
  /** Program slug filters (any selected applies) */
  programs: Record<ProgramSlug, boolean>;
}

function emptyFilters(): FilterState {
  const catDefaults: Record<CategoryTag, boolean> = {
    handouts: false,
    guidelines: false,
    billing: false,
    forms: false,
    protocols: false,
    resources: false,
    training: false,
    unknown: false,
  };
  const progDefaults = Object.fromEntries(
    ProgramSlugs.map((p) => [p, false])
  ) as Record<ProgramSlug, boolean>;
  return {
    types: { pdf: false, doc: false, sheet: false, video: false },
    cats: catDefaults,
    programs: progDefaults,
  };
}

/** Derive category and program from the storage path */
function parseMeta(item: StorageFileItem): { category: CategoryTag; program?: ProgramSlug } {
  const p = item.path.toLowerCase();

  if (p.startsWith('patienthandouts/')) return { category: 'handouts' };
  if (p.startsWith('clinicalguidelines/')) return { category: 'guidelines' };
  if (p.startsWith('medicalbilling/')) return { category: 'billing' };

  for (const slug of ProgramSlugs) {
    const low = slug.toLowerCase();
    if (p.startsWith(`${low}/`)) {
      if (p.includes(`/${'forms'.toLowerCase()}/`) || p.includes('/forms/')) {
        return { category: 'forms', program: slug };
      }
      if (p.includes('/protocols/')) {
        return { category: 'protocols', program: slug };
      }
      if (p.includes('/resources/')) {
        return { category: 'resources', program: slug };
      }
      if (p.includes('/training/')) {
        return { category: 'training', program: slug };
      }
      return { category: 'unknown', program: slug };
    }
  }
  return { category: 'unknown' };
}

/** Detect file type bucket */
function typeTag(item: StorageFileItem): 'pdf' | 'doc' | 'sheet' | 'video' | 'other' {
  if (isVideo(item)) return 'video';
  if (isSpreadsheet(item)) return 'sheet';
  if (isPdf(item)) return 'pdf';
  if (isDoc(item)) return 'doc';
  return 'other';
}

/** Table row structure with enriched metadata */
interface Row extends StorageFileItem {
  category: CategoryTag;
  program?: ProgramSlug;
  typeTag: ReturnType<typeof typeTag>;
  sizeLabel?: string;
}

/** Format size to a readable label (if available) */
function formatSize(bytes?: number): string | undefined {
  if (typeof bytes !== 'number') return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Resources() {
  const [scope, setScope] = useState<Scope>('all');
  const [program, setProgram] = useState<ProgramSlug>('mtmthefuturetoday');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Client quick-card filter (e.g., videos)
  const [quick, setQuick] = useState<QuickCardKey>('all');
  // Left panel filters
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  /** Load resources based on current scope/program */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        let data: StorageFileItem[] = [];
        if (scope === 'all') {
          data = await getAllResources({ includeProgram: program });
        } else if (scope === 'handouts' || scope === 'guidelines' || scope === 'billing') {
          data = await getGlobalCategory(scope);
        } else if (scope === 'program') {
          data = await getAllResources({ includeProgram: program });
        }
        const rows: Row[] = data.map((d) => {
          const parsed = parseMeta(d);
          return {
            ...d,
            category: parsed.category,
            program: parsed.program,
            typeTag: typeTag(d),
            sizeLabel: formatSize(d.size),
          };
        });
        if (active) setItems(rows);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load resources', e);
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [scope, program]);

  /** Toggle helpers for left filters */
  function toggleType(key: keyof FilterState['types']) {
    setFilters((f) => ({ ...f, types: { ...f.types, [key]: !f.types[key] } }));
  }
  function toggleCat(cat: CategoryTag) {
    setFilters((f) => ({ ...f, cats: { ...f.cats, [cat]: !f.cats[cat] } }));
  }
  function toggleProgram(slug: ProgramSlug) {
    setFilters((f) => ({ ...f, programs: { ...f.programs, [slug]: !f.programs[slug] } }));
  }
  function clearAllFilters() {
    setFilters(emptyFilters());
    setQuick('all');
  }

  /** Apply quick card + left filters + search */
  const filtered = useMemo(() => {
    let out = items;

    // Quick-card filters
    if (quick === 'videos') {
      out = out.filter((r) => r.typeTag === 'video');
    } else if (quick === 'handouts') {
      out = out.filter((r) => r.category === 'handouts');
    } else if (quick === 'guidelines') {
      out = out.filter((r) => r.category === 'guidelines');
    } else if (quick === 'billing') {
      out = out.filter((r) => r.category === 'billing');
    } else if (quick === 'program') {
      out = out.filter((r) => r.program);
    }

    // Left types: if any selected, OR between them
    const typeKeys = Object.entries(filters.types)
      .filter(([, v]) => v)
      .map(([k]) => k) as Array<'pdf' | 'doc' | 'sheet' | 'video'>;
    if (typeKeys.length) {
      out = out.filter((r) => typeKeys.includes(r.typeTag as any));
    }

    // Left categories: if any selected, OR between them
    const catKeys = Object.entries(filters.cats)
      .filter(([, v]) => v)
      .map(([k]) => k as CategoryTag);
    if (catKeys.length) {
      out = out.filter((r) => catKeys.includes(r.category));
    }

    // Left programs: if any selected, OR between them
    const progKeys = Object.entries(filters.programs)
      .filter(([, v]) => v)
      .map(([k]) => k as ProgramSlug);
    if (progKeys.length) {
      out = out.filter((r) => (r.program ? progKeys.includes(r.program) : false));
    }

    // Search
    const s = q.trim().toLowerCase();
    if (s) {
      out = out.filter((it) => it.title.toLowerCase().includes(s) || it.filename.toLowerCase().includes(s));
    }

    // Sort by name asc for stability
    out = [...out].sort((a, b) => a.title.localeCompare(b.title));

    return out;
  }, [items, q, quick, filters]);

  /** Quick card definitions */
  const quickCards: Array<{
    key: QuickCardKey;
    title: string;
    desc: string;
  }> = [
    { key: 'all', title: 'All Resources', desc: 'Everything you can access' },
    { key: 'handouts', title: 'Patient Handouts', desc: 'Education materials' },
    { key: 'guidelines', title: 'Clinical Guidelines', desc: 'Evidence-based care' },
    { key: 'billing', title: 'Medical Billing', desc: 'Codes and templates' },
    { key: 'program', title: 'Program Files', desc: 'Forms, protocols, training' },
    { key: 'videos', title: 'Videos', desc: 'Training and walkthroughs' },
  ];

  /** Utility: badge text for category */
  function catLabel(cat: CategoryTag): string {
    switch (cat) {
      case 'handouts':
        return 'Handouts';
      case 'guidelines':
        return 'Guidelines';
      case 'billing':
        return 'Billing';
      case 'forms':
        return 'Forms';
      case 'protocols':
        return 'Protocols';
      case 'resources':
        return 'Resources';
      case 'training':
        return 'Training';
      default:
        return 'Other';
    }
  }

  return (
    <AppShell sidebar={<MemberSidebar />}>
      {/* Title + search */}
      <section className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">ClinicalRxQ Resource Library</h1>
        <p className="text-sm text-slate-600">Browse and download files from your library.</p>

        <div className="mt-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by filename…"
              className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              aria-label="Search resources"
            />
          </div>
        </div>
      </section>

      {/* Quick filter cards */}
      <section className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {quickCards.map((qc) => {
            const active = quick === qc.key;
            return (
              <Card
                key={qc.key}
                className={[
                  'cursor-pointer transition',
                  active ? 'border-blue-300 ring-2 ring-blue-200' : 'hover:shadow',
                ].join(' ')}
                onClick={() => setQuick(qc.key)}
                role="button"
                aria-pressed={active}
              >
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{qc.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-slate-600">{qc.desc}</CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Filters + table */}
      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* Left filters */}
          <aside className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Filters</CardTitle>
                  <button
                    className="text-xs text-blue-700 hover:underline"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                {/* Scope selector (server-side) */}
                <div>
                  <div className="mb-1 font-medium text-slate-900">Scope</div>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'handouts', 'guidelines', 'billing', 'program'] as Scope[]).map((s) => (
                      <Button
                        key={s}
                        variant={scope === s ? 'default' : 'outline'}
                        onClick={() => setScope(s)}
                        className={scope === s ? '' : 'bg-white'}
                        size="sm"
                      >
                        {s === 'program' ? 'Program' : s[0].toUpperCase() + s.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Program selection when scope=program or quick=program */}
                {(scope === 'program' || quick === 'program') && (
                  <div>
                    <label className="mb-1 block font-medium text-slate-900">Program</label>
                    <select
                      value={program}
                      onChange={(e) => setProgram(e.target.value as ProgramSlug)}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                      aria-label="Select program"
                    >
                      {ProgramSlugs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* File Types */}
                <div>
                  <div className="mb-1 font-medium text-slate-900">Type</div>
                  <div className="space-y-2">
                    {(['pdf', 'doc', 'sheet', 'video'] as Array<keyof FilterState['types']>).map(
                      (t) => (
                        <label key={t} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filters.types[t]}
                            onChange={() => toggleType(t)}
                          />
                          <span className="capitalize">{t}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <div className="mb-1 font-medium text-slate-900">Category</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        'handouts',
                        'guidelines',
                        'billing',
                        'forms',
                        'protocols',
                        'resources',
                        'training',
                      ] as CategoryTag[]
                    ).map((c) => (
                      <label key={c} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.cats[c]}
                          onChange={() => toggleCat(c)}
                        />
                        <span className="capitalize">{catLabel(c)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Programs list */}
                <div>
                  <div className="mb-1 font-medium text-slate-900">Programs</div>
                  <div className="grid grid-cols-1 gap-2">
                    {ProgramSlugs.map((p) => (
                      <label key={p} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.programs[p]}
                          onChange={() => toggleProgram(p)}
                        />
                        <span className="uppercase">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Right table */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading files…
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Name</th>
                          <th className="px-3 py-2 text-left font-medium">Category</th>
                          <th className="px-3 py-2 text-left font-medium">Program</th>
                          <th className="px-3 py-2 text-left font-medium">Type</th>
                          <th className="px-3 py-2 text-left font-medium">Size</th>
                          <th className="px-3 py-2 text-left font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((f) => (
                          <tr key={f.path} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{f.title}</div>
                              <div className="text-xs text-slate-500">{f.filename}</div>
                            </td>
                            <td className="px-3 py-2">{catLabel(f.category)}</td>
                            <td className="px-3 py-2">{f.program ?? '—'}</td>
                            <td className="px-3 py-2 capitalize">
                              {f.typeTag === 'sheet' ? 'spreadsheet' : f.typeTag}
                            </td>
                            <td className="px-3 py-2">{f.sizeLabel ?? '—'}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {f.typeTag === 'video' ? (
                                  <a href={f.url} target="_blank" rel="noreferrer">
                                    <Button variant="outline" className="bg-white" size="sm">
                                      Play
                                    </Button>
                                  </a>
                                ) : null}
                                <a href={f.url} target="_blank" rel="noreferrer">
                                  <Button size="sm">Download</Button>
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!filtered.length ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-6 text-center text-slate-600">
                              No files match your search or filters.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
