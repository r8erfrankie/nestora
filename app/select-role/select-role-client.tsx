'use client';

import { useFormStatus } from 'react-dom';
import { Building2, HardHat, Home } from 'lucide-react';
import { setUserRoleAction } from '@/app/actions/role-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlighted?: boolean;
}

// Must be a separate component so useFormStatus reads the status of its
// parent <form> element (the hook only works inside a form's subtree).
function RoleCard({ icon, title, description, highlighted }: RoleCardProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Card className={cn(
        'h-full cursor-pointer transition-all duration-150 group-hover:border-primary group-hover:shadow-md group-focus-visible:border-primary group-focus-visible:shadow-md',
        highlighted && 'border-primary ring-2 ring-primary/20',
      )}>
        <CardHeader className="pb-3">
          <div className="text-primary mb-2">
            {pending ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              icon
            )}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
        </CardContent>
      </Card>
    </button>
  );
}

interface SelectRoleClientProps {
  hint?: string;
  join?: string;
}

export function SelectRoleClient({ hint, join }: SelectRoleClientProps) {
  const isTenantHint = hint === 'tenant';

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to Nestora</h1>
          <p className="text-muted-foreground text-base">How will you be using Nestora?</p>
        </div>

        {/* Contextual banner when arriving from a /join/[code] QR link */}
        {isTenantHint && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm text-primary">
            You&apos;re joining a property — select <strong>Tenant</strong> below to continue.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <form action={setUserRoleAction}>
            <input type="hidden" name="role" value="landlord" />
            {join && <input type="hidden" name="join" value={join} />}
            <RoleCard
              icon={<Building2 className="h-8 w-8" />}
              title="Landlord"
              description="I own or manage rental properties and want to track maintenance."
            />
          </form>

          <form action={setUserRoleAction}>
            <input type="hidden" name="role" value="contractor" />
            {join && <input type="hidden" name="join" value={join} />}
            <RoleCard
              icon={<HardHat className="h-8 w-8" />}
              title="Contractor"
              description="I do repairs and maintenance work assigned by property managers."
            />
          </form>

          <form action={setUserRoleAction}>
            <input type="hidden" name="role" value="tenant" />
            {join && <input type="hidden" name="join" value={join} />}
            <RoleCard
              icon={<Home className="h-8 w-8" />}
              title="Tenant"
              description="I rent a property and want to submit maintenance requests."
              highlighted={isTenantHint}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
