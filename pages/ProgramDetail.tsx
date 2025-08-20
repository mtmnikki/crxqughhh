/**
 * Program Detail (AppShell + glass hero + tabs below)
 * - Purpose: Present program-specific resources from Supabase storage_files_catalog using the program slug.
 * - Layout: AppShell with MemberSidebar, hero gradient with glassmorphism panel (no tabs in hero),
 *   and a single horizontal tab row rendered BELOW the hero (Overview, Training, Protocols, Forms, Additional Resources).
 * - Data: file groups via getProgramResourcesGrouped (table-first, fallback to storage). Program info via programService.getBySlug with ProgramMeta fallback.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { getProgramResourcesGrouped, ProgramSlugs, ProgramSlug } from '../services/storageCatalog';
import type { StorageFileItem } from '../services/supabaseStorage';
import ProgramResourceRow from '../components/resources/ProgramResourceRow';
import { Loader2 } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import MemberSidebar from '../components/layout/MemberSidebar';
import { programService } from '../services/supabase';

/** Tab keys for the program detail view */
type TabKey = 'overview' | 'training' | 'protocols' | 'forms' | 'resources';

interface SectionMap {
  training: StorageFileItem[];
  protocols: StorageFileItem[];
  forms: StorageFileItem[];
  resources: StorageFileItem[];
}

/** Minimal metadata for program overview */
interface ProgramMetaMinimal {
  name: string;
  description?: string | null;
  overview?: string | null;
}

/**
 * Helper: Friendly name/description fallback for known slugs.
 * (Mirrors ProgramMeta from storageCatalog; duplicated locally to avoid tight coupling.)
 */
const FallbackMeta: Record<string, ProgramMetaMinimal> = {
  mtmthefuturetoday: {
    name: 'MTM The Future Today',
    description:
      'Team-based Medication Therapy Management with proven protocols and scalable results.',
  },
  timemymeds: {
    name: 'TimeMyMeds',
    description: 'Appointment-based synchronization to enable consistent clinical service delivery.',
  },
  testandtreat: {
    name: 'Test & Treat Services',
    description: 'Assessments, CLIA-waived testing, and treatment for flu, strep, and COVID-19.',
  },
  hba1c: {
    name: 'HbA1c Testing',
    description: 'Training and resources for A1c point-of-care testing and quality metrics.',
  },
  oralcontraceptives: {
    name: 'Pharmacist-Initiated Oral Contraceptives',
    description:
      'From patient intake to billing and documentation—simplified, step-by-step workflows.',
  },
};

/**
 * ProgramDetail component
 * - Tabs are rendered below the hero as a single horizontal row.
 */
export default function ProgramDetail() {
  const { programSlug = '' } = useParams() as { programSlug?: string };

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [sections, setSections] = useState<SectionMap>({
    training: [],
    protocols: [],
    forms: [],
    resources: [],
  });
  const [meta, setMeta] = useState<ProgramMetaMinimal | null>(null);
  const [notFound, setNotFound] = useState(false);

  /** Validate slug once */
  const isValidSlug = useMemo(
    () => ProgramSlugs.includes(programSlug as ProgramSlug),
    [programSlug]
  );

  /**
   * Load file sections + program metadata
   * - Files: table-first via storageCatalog.getProgramResourcesGrouped
   * - Metadata: programService.getBySlug; fallback to local FallbackMeta
   */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setNotFound(false);

        if (!isValidSlug) {
          if (active) setNotFound(true);
          return;
        }

        // Parallel: files + metadata
        const [filesGrouped, programRow] = await Promise.all([
          getProgramResourcesGrouped(programSlug as ProgramSlug),
          programService.getBySlug(programSlug),
        ]);

        const metaFromDb: ProgramMetaMinimal | null = programRow
          ? {
              name: programRow.name,
              description: programRow.description || null,
              overview: programRow.overview || null,
            }
          : null;

        const metaFinal =
          metaFromDb ||
          FallbackMeta[programSlug] || {
            name: programSlug,
            description: null,
            overview: null,
          };

        if (active) {
          setSections({
            training: filesGrouped.training || [],
            protocols: filesGrouped.protocols || [],
            forms: filesGrouped.forms || [],
            resources: filesGrouped.resources || [],
          });
          setMeta(metaFinal);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load program', e);
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [programSlug, isValidSlug]);

  /** Tab list with counts derived from files (compute before any conditional return) */
  const tabConfig: Array<{ key: TabKey; label: string; count?: number }> = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'training', label: 'Training', count: sections.training.length },
      { key: 'protocols', label: 'Protocols', count: sections.protocols.length },
      { key: 'forms', label: 'Forms', count: sections.forms.length },
      { key: 'resources', label: 'Additional Resources', count: sections.resources.length },
    ],
    [sections]
  );

  // Render "not found" after hooks are declared to satisfy hooks rules.
  if (notFound) {
    return (
      <AppShell sidebar={<MemberSidebar />}>
        <section className="px-3 py-10">
          <Card className="mx-auto max-w-3xl">
            <CardHeader>
              <CardTitle>Program Not Found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600">
                The program you&apos;re looking for doesn&apos;t exist or may have been moved.
              </p>
              <Link to="/programs">
                <Button>Back to Programs</Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell sidebar={<MemberSidebar />}>
      {/* Hero with gradient + glassmorphism container (NO TABS HERE) */}
      <section className="relative -mx-3 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-300 px-3 py-10 text-white">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-4">
            <Breadcrumbs
              variant="light"
              items={[
                { label: 'Dashboard', to: '/dashboard' },
                { label: 'Programs', to: '/programs' },
                { label: meta?.name || programSlug },
              ]}
            />
          </div>

          <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
            <h1 className="text-3xl font-bold">{meta?.name || programSlug}</h1>
            {meta?.description ? (
              <p className="mt-1 text-white/90">{meta.description}</p>
            ) : (
              <p className="mt-1 text-white/80">Program resources and training files</p>
            )}
          </div>
        </div>
      </section>

      {/* Horizontal tab row BELOW the hero */}
      <section className="mb-6">
        <div className="mx-auto max-w-[1440px]">
          <nav
            aria-label="Program sections"
            role="tablist"
            className="-mx-1 overflow-x-auto no-scrollbar pb-2"
          >
            <div className="flex gap-2 px-1">
              {tabConfig.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    className={[
                      'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                    onClick={() => setActiveTab(t.key)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    {t.label}
                    {typeof t.count === 'number' ? (
                      <span
                        className={[
                          'ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs',
                          isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700',
                        ].join(' ')}
                      >
                        {t.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </section>

      {/* Body */}
      <section>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-600">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading program…
          </div>
        ) : (
          <>
            {activeTab === 'overview' ? (
              <div className="mx-auto max-w-4xl">
                <Card>
                  <CardHeader>
                    <CardTitle>About this Program</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-slate-700">
                    {meta?.overview ? (
                      <p>{meta.overview}</p>
                    ) : meta?.description ? (
                      <p>{meta.description}</p>
                    ) : (
                      <p>
                        Explore the tabs above for training modules, protocols, forms, and additional
                        resources tailored to this program.
                      </p>
                    )}
                    <div className="flex gap-3">
                      {sections.training.length > 0 ? (
                        <Button onClick={() => setActiveTab('training')}>Start Training</Button>
                      ) : null}
                      {sections.protocols.length > 0 ? (
                        <Button
                          variant="outline"
                          className="bg-white"
                          onClick={() => setActiveTab('protocols')}
                        >
                          View Protocols
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === 'training' ? (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Training</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.training.map((item) => (
                    <ResourceCard key={item.path} item={item} />
                  ))}
                  {sections.training.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-slate-600">No training files.</CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'protocols' ? (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Protocols</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.protocols.map((item) => (
                    <ResourceCard key={item.path} item={item} />
                  ))}
                  {sections.protocols.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-slate-600">No protocol manuals.</CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'forms' ? (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Forms</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.forms.map((item) => (
                    <ResourceCard key={item.path} item={item} />
                  ))}
                  {sections.forms.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-slate-600">No forms.</CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'resources' ? (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Additional Resources</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.resources.map((item) => (
                    <ResourceCard key={item.path} item={item} />
                  ))}
                  {sections.resources.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-slate-600">No additional resources.</CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}
