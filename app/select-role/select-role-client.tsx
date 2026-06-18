'use client';

import { useFormStatus } from 'react-dom';
import { Building2, HardHat } from 'lucide-react';
import { setUserRoleAction } from '@/app/actions/role-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// Must be a separate component so useFormStatus reads the status of its
// parent <form> element (the hook only works inside a form's subtree).
function RoleCard({ icon, title, description }: RoleCardProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Card className="h-full cursor-pointer transition-all duration-150 group-hover:border-primary group-hover:shadow-md group-focus-visible:border-primary group-focus-visible:shadow-md">
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

export function SelectRoleClient() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to Nestora</h1>
          <p className="text-muted-foreground text-base">How will you be using Nestora?</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <form action={setUserRoleAction}>
            <input type="hidden" name="role" value="landlord" />
            <RoleCard
              icon={<Building2 className="h-8 w-8" />}
              title="Landlord"
              description="I own or manage rental properties and want to track maintenance."
            />
          </form>

          <form action={setUserRoleAction}>
            <input type="hidden" name="role" value="contractor" />
            <RoleCard
              icon={<HardHat className="h-8 w-8" />}
              title="Contractor"
              description="I do repairs and maintenance work assigned by property managers."
            />
          </form>
        </div>
      </div>
    </div>
  );
}
