/**
 * Member Content page (Programs listing)
 * - Purpose: Show available programs from /api/clinical-programs (list) aligned with Airtable fields.
 * - Layout: AppShell with MemberSidebar (consistent member pages frame).
 * - Visual: Gradient hero retained; content moved inside AppShell main area.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { BookOpen, FileText, Play, Zap, Award, Loader2 } from 'lucide-react';
import Breadcrumbs from '../components/common/Breadcrumbs';
import SafeText from '../components/common/SafeText';
import { fetchProgramList, ProgramListItem } from '../services/airtable/client';
import AppShell from '../components/layout/AppShell';
import MemberSidebar from '../components/layout/MemberSidebar';

/** UI type for program card */
interface ProgramUIItem {
  id: string; // programSlug
  title: string; // programName
  description: string; // programDescription
  level?: string; // experienceLevel
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Visual mapping helper using experienceLevel */
function getProgramVisuals(level?: string) {
  const lower = (level || '').toLowerCase();
  if (lower.includes('advanced') || lower.includes('expert')) {
    return { color: 'from-blue-600 via-cyan-500 to-teal-300', icon: Zap };
  }
  if (lower.includes('intermediate')) {
    return { color: 'from-blue-600 via-cyan-500 to-teal-300', icon: Award };
  }
  return { color: 'from-blue-600 via-cyan-500 to-teal-300', icon: FileText };
}

/** MemberContent component */
export default function MemberContent() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Load program list from serverless API with Airtable-aligned fields */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const { items } = await fetchProgramList();
        setPrograms(items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load programs');
        // eslint-disable-next-line no-console
        console.error('Error fetching programs:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /** Map DTO → UI model */
  const programUIItems: ProgramUIItem[] = useMemo(
    () =>
      (programs || []).map((p) => {
        const visuals = getProgramVisuals(p.experienceLevel);
        return {
          id: p.programSlug,
          title: p.programName,
          description: p.programDescription,
          level: p.experienceLevel,
          color: visuals.color,
          icon: visuals.icon,
        };
      }),
    [programs]
  );

  return (
    <AppShell sidebar={<MemberSidebar />}>
      {/* Hero */}
      <section className="relative -mx-3 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-300 px-3 py-12 text-white">
        <div className="mx-auto max-w-[1440px]">
          <div className="max-w-4xl">
            <Breadcrumbs
              variant="light"
              items={[
                { label: 'Dashboard', to: '/dashboard' },
                { label: 'Clinical Programs' },
              ]}
              className="mb-4"
            />
            <h1 className="text-3xl font-bold">Member Content</h1>
            <p className="text-white/90">
              Access your clinical training programs and resources
            </p>
          </div>
        </div>
      </section>

      {/* Quick Resources */}
      <section className="py-6">
        <div className="max-w-4xl">
          <Card className="border-cyan-400 bg-gradient-to-r from-blue-50 to-cyan-50">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-300">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Resource Library
                  </h3>
                  <p className="text-gray-600">
                    Access clinical tools, forms, and educational materials
                  </p>
                </div>
              </div>
              <Link to="/resources">
                <Button className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-300 hover:opacity-90">
                  <BookOpen className="mr-2 h-4 w-4" />
                  View Resources
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Programs */}
      <section className="py-6">
        <div className="max-w-6xl">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading programs...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <div className="mb-2 text-red-600">Error loading programs</div>
              <div className="text-gray-600">{error}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {programUIItems.map((program) => {
                const Icon = program.icon;
                const to = `/program/${program.id}`;
                return (
                  <Card
                    key={program.id}
                    className="overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <div className={`h-2 bg-gradient-to-r ${program.color}`} />
                    <CardHeader>
                      <div className="mb-4 flex items-start justify-between">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r ${program.color}`}
                        >
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        {program.level ? (
                          <div className="flex gap-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                              <SafeText value={program.level} />
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <CardTitle className="mb-2 text-xl">
                        <SafeText value={program.title} />
                      </CardTitle>
                      {program.description ? (
                        <CardDescription className="mb-4 text-gray-600">
                          <SafeText value={program.description} />
                        </CardDescription>
                      ) : null}
                    </CardHeader>

                    <CardContent>
                      <div className="flex gap-3">
                        <Link to={to} className="flex-1">
                          <Button
                            className={`w-full bg-gradient-to-r ${program.color} hover:opacity-90`}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            View Program
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
