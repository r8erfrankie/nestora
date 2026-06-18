'use client';

import { useState } from 'react';
import { Building2, HardHat } from 'lucide-react';
import { setUserRole } from '@/app/actions/role-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserRole } from '@/lib/roles';

export function SelectRoleClient() {
  const [loading, setLoading] = useState<UserRole | null>(null);
  const [error, setError] = useState('');

  const handleSelect = async (role: UserRole) => {
    setLoading(role);
    setError('');
    try {
      await setUserRole(role);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(null);
    }
  };

  const options: Array<{
    role: UserRole;
    icon: React.ReactNode;
    title: string;
    description: string;
  }> = [
    {
      role: 'landlord',
      icon: <Building2 className="h-8 w-8" />,
      title: 'Landlord',
      description: 'I own or manage rental properties and want to track maintenance.',
    },
    {
      role: 'contractor',
      icon: <HardHat className="h-8 w-8" />,
      title: 'Contractor',
      description: 'I do repairs and maintenance work assigned by property managers.',
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to Nestora</h1>
          <p className="text-muted-foreground text-base">How will you be using Nestora?</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {options.map(({ role, icon, title, description }) => (
            <button
              key={role}
              onClick={() => handleSelect(role)}
              disabled={!!loading}
              className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Card className="h-full cursor-pointer transition-all duration-150 group-hover:border-primary group-hover:shadow-md group-focus-visible:border-primary group-focus-visible:shadow-md">
                <CardHeader className="pb-3">
                  <div className="text-primary mb-2">
                    {loading === role ? (
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
          ))}
        </div>

        {error && (
          <p className="text-destructive text-center text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
