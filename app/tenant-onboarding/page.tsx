import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Layers, Building2, Clock, AlertCircle, UserX, ArrowLeft, XCircle } from 'lucide-react'

export const metadata = { title: 'Set Up Your Tenant Account' }

export default async function TenantOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string; err?: string }>
}) {
  const { join, err } = await searchParams
  const joinCode = join?.trim().toUpperCase() || null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    const returnTo = joinCode ? `/tenant-onboarding?join=${joinCode}` : '/tenant-onboarding'
    redirect(`/login?redirectTo=${encodeURIComponent(returnTo)}`)
  }

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
    const fullName = (formData.get('full_name') as string | null)?.trim() || null
    const unitValue = (formData.get('unit') as string | null)?.trim() || null
    const phone = (formData.get('phone') as string | null)?.trim() || null

    const sc = await createClient()
    const {
      data: { user: u },
    } = await sc.auth.getUser()
    if (!u?.email) redirect('/login')

    const email = u.email.toLowerCase()
    const errUrl = `/tenant-onboarding?join=${code}&err=1`

    // Save name / phone to the tenant's own profile row so the landlord can
    // see them when reviewing the pending request (looked up by email on their side).
    // The tenant can UPDATE their own row (own-row-only RLS allows this).
    if (fullName || phone) {
      const updates: Record<string, string> = {}
      if (fullName) updates.full_name = fullName
      if (phone) updates.phone = phone
      await sc.from('profiles').update(updates).eq('id', u.id)
    }

    // Check for any existing link — including 'removed' and 'declined' ones.
    // .maybeSingle() returns null (no error) when zero rows match. We must check
    // all statuses because (property_id, tenant_email) has a UNIQUE constraint —
    // a plain INSERT over an existing row would silently fail with a 409 conflict.
    const { data: existing } = await sc
      .from('tenant_property_links')
      .select('id, status, initiated_by, unit')
      .eq('property_id', propertyId)
      .eq('tenant_email', email)
      .maybeSingle()

    if (existing?.status === 'approved') redirect('/tenant')

    if (existing?.status === 'pending') {
      if (existing.initiated_by === 'landlord') {
        // Tenant is accepting a landlord invite — link their account and update unit.
        // Admin client required: tenant RLS has no UPDATE policy on this table.
        const admin = createAdminClient()
        const { error } = await admin
          .from('tenant_property_links')
          .update({ tenant_id: u.id, unit: unitValue ?? (existing.unit as string | null) })
          .eq('id', existing.id)
        if (error) redirect(errUrl)
      }
      // Redirect to show the pending state regardless of initiated_by.
      redirect(`/tenant-onboarding?join=${code}`)
    }

    if (existing?.status === 'removed' || existing?.status === 'declined') {
      // Can't INSERT again due to UNIQUE constraint. Tenant RLS has no UPDATE
      // policy on this table, so use admin client scoped to the exact row ID.
      const admin = createAdminClient()
      const { error } = await admin
        .from('tenant_property_links')
        .update({ status: 'pending', initiated_by: 'tenant', tenant_id: u.id, unit: unitValue })
        .eq('id', existing.id)
      if (error) redirect(errUrl)
    } else {
      // No existing link — INSERT via regular client (passes tenant self-request RLS).
      const { error } = await sc
        .from('tenant_property_links')
        .insert({
          landlord_id: landlordId,
          property_id: propertyId,
          tenant_email: email,
          tenant_id: u.id,
          status: 'pending',
          initiated_by: 'tenant',
          unit: unitValue,
        })
      if (error) redirect(errUrl)
    }

    redirect(`/tenant-onboarding?join=${code}`)
  }

  // ── Profile: role check + form pre-fill in one query ─────────────────────────
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profileData?.role as string | null) ?? null
  const prefillName = (profileData?.full_name as string | null) ?? null
  const prefillPhone = (profileData?.phone as string | null) ?? null

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
    .select('id, property_id, status, unit, initiated_by, tenant_id, created_at')
    .eq('tenant_email', user.email.toLowerCase())
    .neq('status', 'removed')
    .order('created_at', { ascending: false })

  // Already approved → send to the dashboard.
  if (links?.some((l) => l.status === 'approved')) redirect('/tenant')

  const pendingLinks = (links ?? []).filter((l) => l.status === 'pending')
  const declinedLinks = (links ?? []).filter((l) => l.status === 'declined')

  // ── With join code ─────────────────────────────────────────────────────────────
  if (joinCode) {
    // Admin client required — tenant RLS does not allow reading others' properties.
    const admin = createAdminClient()
    const { data: property } = await admin
      .from('properties')
      .select('id, name, address, user_id')
      .eq('join_code', joinCode)
      .single()

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

    const existingLink = links?.find((l) => l.property_id === property.id)

    // ── Pending ────────────────────────────────────────────────────────────────
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
              <CardContent className="space-y-1 text-center">
                {existingLink.unit && (
                  <p className="text-muted-foreground text-sm">Unit {existingLink.unit}</p>
                )}
                <p className="text-muted-foreground text-sm">
                  You&apos;ll be able to submit maintenance requests once approved.
                </p>
              </CardContent>
            </Card>
            <SignOutFooter handleSignOut={handleSignOut} />
          </div>
        </Wrapper>
      )
    }

    // ── Landlord invite (not yet accepted) ────────────────────────────────────
    // A landlord-initiated pending link with no tenant_id means the tenant
    // hasn't filled in their details yet. Show the acceptance form.
    if (existingLink?.status === 'pending' && existingLink?.initiated_by === 'landlord' && !existingLink?.tenant_id) {
      return (
        <Wrapper>
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">You&apos;ve been invited</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Fill in your details so your landlord can approve your access.
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
              <CardContent className="space-y-4">
                <RequestForm
                  action={requestPropertyAccess}
                  propertyId={property.id}
                  landlordId={property.user_id as string}
                  joinCode={joinCode}
                  prefillName={prefillName}
                  prefillUnit={existingLink.unit as string | null}
                  prefillPhone={prefillPhone}
                  err={err}
                  submitLabel="Send Request"
                  phoneRequired
                />
              </CardContent>
            </Card>

            <SignOutFooter handleSignOut={handleSignOut} />
          </div>
        </Wrapper>
      )
    }

    // ── Declined ───────────────────────────────────────────────────────────────
    if (existingLink?.status === 'declined') {
      return (
        <Wrapper>
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Request declined</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Update your info below and request again, or contact your landlord.
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="bg-destructive/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <XCircle className="text-destructive h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{property.name}</CardTitle>
                    {property.address && (
                      <CardDescription className="mt-0.5">{property.address}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Your previous request was not approved. You can submit a new request below.
                </p>
                <RequestForm
                  action={requestPropertyAccess}
                  propertyId={property.id}
                  landlordId={property.user_id as string}
                  joinCode={joinCode}
                  prefillName={prefillName}
                  prefillUnit={existingLink.unit as string | null}
                  prefillPhone={prefillPhone}
                  err={err}
                  submitLabel="Request Again"
                />
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

    // ── No link (or previously removed) — initial request form ────────────────
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
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Your landlord will be notified and can approve your access.
              </p>
              <RequestForm
                action={requestPropertyAccess}
                propertyId={property.id}
                landlordId={property.user_id as string}
                joinCode={joinCode}
                prefillName={prefillName}
                prefillUnit={null}
                prefillPhone={prefillPhone}
                err={err}
                submitLabel="Request Access"
              />
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
  // Fetch property names + join codes for pending and declined links so the list
  // is meaningful and declined rows can link to the re-request flow.
  const linkedPropertyIds = [
    ...new Set([
      ...pendingLinks.map((l) => l.property_id),
      ...declinedLinks.map((l) => l.property_id),
    ]),
  ]
  let propertyMap: Record<string, { name: string; joinCode: string | null }> = {}
  if (linkedPropertyIds.length > 0) {
    const admin = createAdminClient()
    const { data: props } = await admin
      .from('properties')
      .select('id, name, join_code')
      .in('id', linkedPropertyIds)
    propertyMap = Object.fromEntries(
      (props ?? []).map((p) => [
        p.id,
        { name: p.name as string, joinCode: p.join_code as string | null },
      ])
    )
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
                    {propertyMap[link.property_id]?.name ?? 'Property'}
                    {link.unit && (
                      <span className="text-muted-foreground font-normal">
                        {' '}· Unit {link.unit}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">Awaiting landlord approval</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Declined connections */}
        {declinedLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Declined
            </p>
            {declinedLinks.map((link) => {
              const prop = propertyMap[link.property_id]
              return (
                <div
                  key={link.id}
                  className="bg-card flex items-center gap-3 rounded-lg border px-4 py-3"
                >
                  <XCircle className="text-destructive h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {prop?.name ?? 'Property'}
                      {link.unit && (
                        <span className="text-muted-foreground font-normal">
                          {' '}· Unit {link.unit}
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">Request declined by landlord</p>
                  </div>
                  {prop?.joinCode && (
                    <Link
                      href={`/tenant-onboarding?join=${prop.joinCode}`}
                      className="text-primary shrink-0 text-xs hover:underline"
                    >
                      Re-request →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Code entry */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {pendingLinks.length > 0 || declinedLinks.length > 0
                ? 'Add another property'
                : 'Connect to your property'}
            </CardTitle>
            <CardDescription>
              Enter the 8-character code from your landlord, or scan the QR code posted in your
              building.
            </CardDescription>
          </CardHeader>
          <CardContent>
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

// ── Shared request form (initial + re-request) ─────────────────────────────────

function RequestForm({
  action,
  propertyId,
  landlordId,
  joinCode,
  prefillName,
  prefillUnit,
  prefillPhone,
  err,
  submitLabel,
  phoneRequired,
}: {
  action: (formData: FormData) => Promise<void>
  propertyId: string
  landlordId: string
  joinCode: string
  prefillName: string | null
  prefillUnit: string | null
  prefillPhone: string | null
  err: string | undefined
  submitLabel: string
  phoneRequired?: boolean
}) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="landlord_id" value={landlordId} />
      <input type="hidden" name="join_code" value={joinCode} />

      <div className="space-y-1.5">
        <label htmlFor="full_name" className="text-sm font-medium">
          Full name
        </label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="Your name"
          defaultValue={prefillName ?? ''}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="unit" className="text-sm font-medium">
            Unit{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="unit"
            name="unit"
            placeholder="e.g. 12"
            defaultValue={prefillUnit ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium">
            Phone{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(555) 123-4567"
            defaultValue={prefillPhone ?? ''}
            required={phoneRequired}
          />
        </div>
      </div>

      {err === '1' && (
        <p className="text-destructive text-center text-sm">
          Something went wrong. Please try again or contact your landlord.
        </p>
      )}

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
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
