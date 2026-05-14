import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import Image from 'next/image';

type TenantRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  'brand_color' | 'logo_url' | 'org_name'
>;

export const metadata: Metadata = {
  title: 'Engineering Progress Dashboard',
  description: 'Daily snapshot of team progress, goals, and weekly updates.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let brandColor = '#09090b';
  let logoUrl: string | null = null;
  let orgName: string | null = null;

  if (user) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('brand_color, logo_url, org_name')
      .eq('id', user.id)
      .single() as { data: TenantRow | null; error: unknown };

    if (tenant) {
      brandColor = tenant.brand_color;
      logoUrl = tenant.logo_url;
      orgName = tenant.org_name;
    }
  }

  return (
    <html lang="en">
      <body
        className="min-h-screen text-gray-900 antialiased"
        style={{ backgroundColor: brandColor }}
      >
        {user && orgName && (
          <header className="border-b border-black/5 px-6 py-3 flex items-center gap-3">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={`${orgName} logo`}
                width={32}
                height={32}
                className="h-8 w-auto object-contain"
              />
            )}
            <span className="text-sm font-semibold text-gray-700">{orgName}</span>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
