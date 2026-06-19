import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getCurrentUserRole, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Layers, Building2, Clock, AlertCircle, UserX, ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Set Up Your Tenant Account' }

export default async function TenantOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>
}) {
  const { join } = await searchParams
  // Normalize to uppercase; treat empty/missing as no code
  const joinCode = join?.trim().toUpperCase() || null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    const returnTo = joinCode
      ? `/tenant-onboarding?join=${joinCode}`
      : '/tenant-onboarding'
    redirect(`/login?redirectTo=${encodeURIComponent(returnTo)}`)
  }

  const role = await getCurrentUserRole()

  // ── Server actions ────────────────────────────────────────────────────────────

  async function handleSignOut() {
    'use server'
    const sc = await createClient()
    await sc.auth.signOut()
    redirect('/login')
  }

  async function requestPropertyAccess(formData: FormData) {
    'use server'
    const propertyId = formData.get('property_id') as string
    const landlordId = formData.get('landlord_id') as string
    const code = formData.get('join_code') as string

    const sc = await createClient()
    const {
      data: { user: u },
    } = await sc.auth.getUser()
    if (!u?.email) redirect('/login')

    // Idempotent — skip if a link already exists for this (property, email) pair
    const { data: existing } = await sc
      .from('tenant_property_links')
      .select('id')
      .eq('property_id', propertyId)
      .eq('tenant_email', u.email.toLowerCase())
      .single()

    if (!existing) {
      await sc.from('tenant_property_links').insert({
        landlord_id: landlordId,
        property_id: propertyId,
        tenant_email: u.email.toLowerCase(),
        tenant_id: u.id,
        status: 'pending',
        initiated_by: 'tenant',
      })
    }

    redirect(`/tenant-onboarding?join=${code}`)
  }

  // ── Wrong role ────────────────────────────────────────────────────────────────
  if (role === 'landlord' || role === 'contractor') {
    const roleLabel = role === 'landlord' ? 'Landlord' : 'Contractor'
    return (
      <Wrapper>
        <Card>
          <CardHeader className="pb-3 text-center">
            <div className="mb-3 flex justify-center">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <UserX className="text-muted-foreground h-6 w-6" />
              </div>
            </div>
            <CardTitle>Wrong account type</CardTitle>
            <CardDescription>
              You&apos;re signed in as a{' '}
              <strong className="text-foreground">{roleLabel}</strong>. Please sign out to continue
              as a tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSignOut}>
              <Button type="submit" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </Wrapper>
    )
  }

  // ── Load existing links for this tenant ───────────────────────────────────────
  const { data: links } = await supabase
    .from('tenant_property_links')
    .select('id, property_id, status, unit, initiated_by, created_at')
    .eq('tenant_email', user.email.toLowerCase())
    .neq('status', 'removed')
    .order('created_at', { ascending: false })

  // Already approved anywhere → dashboard
  if (links?.some((l) => l.status === 'approved')) {
    redirect('/tenant')
  }

  const pendingLinks = (links ?? []).filter((l) => l.status === 'pending')

  // ── With join code ─────────────────────────────────────────────────────────────
  if (joinCode) {
    // Use admin client — tenant RLS does not allow reading other users' properties
    const admin = createAdminClient()
    const { data: property } = await admin
      .from('properties')
      .select('id, name, address, user_id')
      .eq('join_code', joinCode)
      .single()

    // Code not found
    if (!property) {
      return (
        <Wrapper>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3 text-center">
                <div className="mb-3 flex justify-center">
                  <div className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <AlertCircle className="text-destructive h-6 w-6" />
                  </div>
                </div>
                <CardTitle>Code not recognised</CardTitle>
                <CardDescription>
                  No property matched{' '}
                  <strong className="text-foreground font-mono">{joinCode}</strong>. Double-check
                  the code with your landlord and try again.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/tenant-onboarding"
                  className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Try a different code
                </Link>
              </CardContent>
            </Card>
            <SignOutFooter handleSignOut={handleSignOut} />
          </div>
        </Wrapper>
      )
    }

    // Check if this user already has a link for this exact property
    const existingLink = links?.find((l) => l.property_id === property.id)

    if (existingLink?.status === 'pending') {
      return (
        <Wrapper>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3 text-center">
                <div className="mb-3 flex justify-center">
                  <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <Clock className="text-primary h-6 w-6" />
                  </div>
                </div>
                <CardTitle>Request sent</CardTitle>
                <CardDescription>
                  Your request to join{' '}
                  <strong className="text-foreground">{property.name}</strong> is awaiting your
                  landlord&apos;s approval.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center text-sm">
                  You&apos;ll be able to submit maintenance requests once approved.
                </p>
              </CardContent>
            </Card>
            <SignOutFooter handleSignOut={handleSignOut} />
          </div>
        </Wrapper>
      )
    }

    // No link (or previously removed) — show confirmation to request access
    return (
      <Wrapper>
        <div className="space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Join property</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Request access to submit maintenance requests.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Building2 className="text-primary h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">{property.name}</CardTitle>
                  {property.address && (
                    <CardDescription className="mt-0.5">{property.address}</CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Your landlord will be notified and can approve your access. Once approved, you can
                submit maintenance requests for this property.
              </p>
              <form action={requestPropertyAccess}>
                <input type="hidden" name="property_id" value={property.id} />
                <input type="hidden" name="landlord_id" value={property.user_id} />
                <input type="hidden" name="join_code" value={joinCode} />
                <Button type="submit" className="w-full">
                  Request Access
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link
              href="/tenant-onboarding"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Enter a different code
            </Link>
          </div>

          <SignOutFooter handleSignOut={handleSignOut} />
        </div>
      </Wrapper>
    )
  }

  // ── No join code — show code entry ─────────────────────────────────────────────
  // Fetch property names for pending links so the list is meaningful
  let propertyNameMap: Record<string, string> = {}
  if (pendingLinks.length > 0) {
    const admin = createAdminClient()
    const { data: props } = await admin
      .from('properties')
      .select('id, name')
      .in(
        'id',
        pendingLinks.map((l) => l.property_id),
      )
    propertyNameMap = Object.fromEntries((props ?? []).map((p) => [p.id, p.name as string]))
  }

  return (
    <Wrapper>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set up your account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect to your rental property using the code from your landlord.
          </p>
        </div>

        {/* Pending connections */}
        {pendingLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Pending approval
            </p>
            {pendingLinks.map((link) => (
              <div
                key={link.id}
                className="bg-card flex items-center gap-3 rounded-lg border px-4 py-3"
              >
                <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {propertyNameMap[link.property_id] ?? 'Property'}
                    {link.unit && (
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        · Unit {link.unit}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">Awaiting landlord approval</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Code entry */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {pendingLinks.length > 0 ? 'Add another property' : 'Connect to your property'}
            </CardTitle>
            <CardDescription>
              Enter the 8-character code from your landlord, or scan the QR code posted in your
              building.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* GET form — navigates to ?join=CODE without a server action */}
            <form method="GET" action="/tenant-onboarding" className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="join" className="text-sm font-medium">
                  Property code
                </label>
                <Input
                  id="join"
                  name="join"
                  placeholder="A3F7C201"
                  className="font-mono uppercase tracking-widest"
                  maxLength={8}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>

        <SignOutFooter handleSignOut={handleSignOut} />
      </div>
    </Wrapper>
  )
}

// ── Layout and shared primitives ───────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

// Server actions can be passed as props between server components in the same module.
function SignOutFooter({ handleSignOut }: { handleSignOut: () => Promise<void> }) {
  return (
    <form action={handleSignOut} className="text-center">
      <button
        type="submit"
        className="text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Sign out
      </button>
    </form>
  )
}
