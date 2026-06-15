import { createClient } from '@/lib/supabase/server';
import { PropertiesClient } from './properties-client';

export default async function PropertiesPage() {
  const supabase = await createClient();

  const { data: properties, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  // Pass error down so the client can show a helpful message instead of only console logging
  if (error) {
    // error will be passed to client for display
  }

  return (
    <div className="p-6">
      <PropertiesClient initialProperties={properties || []} loadError={error} />
    </div>
  );
}
