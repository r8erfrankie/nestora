import { createClient } from '@/lib/supabase/server';
import { ProjectsClient } from './projects-client';

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-6">
      <ProjectsClient initialProjects={projects ?? []} loadError={error} />
    </div>
  );
}
