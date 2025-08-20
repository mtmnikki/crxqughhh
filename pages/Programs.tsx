/**
 * Programs listing page (Storage-only)
 * - Lists program folders from the "clinical-programs" bucket.
 * - Attempts to read {programSlug}/manifest.json for friendly names/descriptions.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { listProgramsFromStorage, type ProgramListItem } from '../services/storageCatalog';

/**
 * Programs page component
 * - Displays all available programs discovered in storage.
 */
export default function Programs() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetch program list from Supabase Storage */
  useEffect(() => {
    async function fetchPrograms() {
      try {
        setLoading(true);
        setError(null);

        const items = await listProgramsFromStorage();
        setPrograms(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load programs');
        // eslint-disable-next-line no-console
        console.error('Error fetching programs:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPrograms();
  }, []);

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Programs</h1>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading programs...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">Error loading programs</div>
          <div className="text-gray-600">{error}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Card key={p.slug} className="h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.description ? (
                  <p className="text-sm text-slate-600">{p.description}</p>
                ) : (
                  <p className="text-sm text-slate-600">Open to view training modules and resources.</p>
                )}
                <Link
                  to={`/program/${encodeURIComponent(p.slug)}`}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  View details →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
