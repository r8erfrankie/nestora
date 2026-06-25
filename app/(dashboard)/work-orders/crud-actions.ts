'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { insertNotification } from '@/lib/notifications';

export async function deleteWorkOrder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Ownership check (defense in depth — RLS is the primary guard)
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchErr || !wo || wo.user_id !== user.id) {
    const reason = fetchErr ? fetchErr.message : 'not found or not owned by current user';
    console.error(`[deleteWorkOrder] ownership check failed for ${id}: ${reason}`);
    throw new Error('Not authorized to delete this work order');
  }

  // 1. Find any maintenance requests linked to this work order before we null the FK.
  //    We need the IDs now so we can write system notes after the unlink.
  const { data: linkedRequests } = await supabase
    .from('maintenance_requests')
    .select('id')
    .eq('converted_to_work_order_id', id);

  // 2. Null the FK and set status → 'Closed' in a single update.
  //    - Nulling the FK is required: the original constraint had no ON DELETE clause
  //      (defaults to RESTRICT), which blocks the delete for any work order converted
  //      from a tenant request. fix-maintenance-request-work-order-fk.sql changes this
  //      to ON DELETE SET NULL permanently, but the explicit update handles older installs.
  //    - 'Closed' status signals to the tenant that the issue was not resolved via this
  //      work order. Requires add-maintenance-request-closed-status.sql to be applied.
  const { error: unlinkErr } = await supabase
    .from('maintenance_requests')
    .update({ converted_to_work_order_id: null, status: 'Closed' })
    .eq('converted_to_work_order_id', id);

  if (unlinkErr) {
    console.error(`[deleteWorkOrder] failed to unlink maintenance_requests for ${id}:`, unlinkErr.message);
    throw new Error(`Failed to unlink maintenance requests: ${unlinkErr.message}`);
  }

  // 3. Add a system note on each affected maintenance request so the tenant can see why
  //    the status changed. Best-effort — a note failure must not block the delete.
  if (linkedRequests && linkedRequests.length > 0 && user.email) {
    try {
      await supabase.from('maintenance_request_notes').insert(
        linkedRequests.map((r) => ({
          request_id: r.id,
          author_email: user.email!.toLowerCase(),
          author_role: 'landlord',
          note_type: 'system',
          content: 'The linked work order was deleted by the landlord.',
        }))
      );
    } catch (noteErr) {
      console.error(`[deleteWorkOrder] failed to insert system notes for ${id}:`, noteErr);
    }
  }

  // 2. Fetch photo records so we can remove the storage objects before the rows are gone.
  const { data: photos, error: photosErr } = await supabase
    .from('work_order_photos')
    .select('id, url')
    .eq('work_order_id', id);

  if (photosErr) {
    console.error(`[deleteWorkOrder] failed to fetch photos for ${id}:`, photosErr.message);
    throw new Error(`Failed to fetch photos: ${photosErr.message}`);
  }

  // 3. Delete storage objects (best-effort — log failures but don't abort the delete).
  if (photos && photos.length > 0) {
    const paths = photos
      .map((p) => {
        const marker = '/work-order-photos/';
        const idx = (p.url as string).indexOf(marker);
        return idx !== -1 ? (p.url as string).substring(idx + marker.length).split('?')[0] : null;
      })
      .filter((path): path is string => path !== null);

    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from('work-order-photos').remove(paths);
      if (storageErr) {
        console.error(`[deleteWorkOrder] storage removal partial failure for ${id}:`, storageErr.message);
      }
    }

    // 4. Delete photo rows explicitly (cascade would handle this, but be explicit).
    const { error: photoRowErr } = await supabase
      .from('work_order_photos')
      .delete()
      .eq('work_order_id', id);

    if (photoRowErr) {
      console.error(`[deleteWorkOrder] failed to delete photo rows for ${id}:`, photoRowErr.message);
      throw new Error(`Failed to delete photo records: ${photoRowErr.message}`);
    }
  }

  // 5. Delete the work order (cascade handles notes and archives).
  const { error: deleteErr } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', id);

  if (deleteErr) {
    console.error(`[deleteWorkOrder] final delete failed for ${id}:`, deleteErr.message);
    throw new Error(`Failed to delete work order: ${deleteErr.message}`);
  }
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: prop, error: fetchErr } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchErr || !prop || prop.user_id !== user.id) {
    throw new Error('Not authorized to delete this property');
  }

  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw new Error(error.message || 'Failed to delete property');
}

export async function updateWorkOrderBudget(id: string, cost: number | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('work_orders')
    .update({ cost })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message || 'Failed to update budget');

  if (user.email) {
    try {
      await supabase.from('work_order_notes').insert({
        work_order_id: id,
        author_email: user.email.toLowerCase(),
        author_role: 'landlord',
        note_type: 'system',
        content: cost != null ? `Budget updated to $${cost.toFixed(2)}` : 'Budget cleared',
      });
    } catch { /* non-fatal */ }
  }
}

export async function updateWorkOrderStatus(id: string, newStatus: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch current for ownership + notify details
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id, title, status, assigned_contractor_email, properties(name)')
    .eq('id', id)
    .single() as {
      data: {
        user_id: string;
        title: string;
        status: string;
        assigned_contractor_email: string | null;
        properties: { name: string } | null;
      } | null;
      error: any;
    };

  if (fetchErr || !wo || wo.user_id !== user.id) {
    throw new Error('Not authorized to update this work order');
  }

  const previousStatus = wo.status;

  if (newStatus === previousStatus) {
    return; // no change
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: newStatus })
    .eq('id', id);

  if (updateErr) throw new Error(updateErr.message || 'Failed to update status');

  if (user.email) {
    try {
      await supabase.from('work_order_notes').insert({
        work_order_id: id,
        author_email: user.email.toLowerCase(),
        author_role: 'landlord',
        note_type: 'system',
        content: `Status changed from ${previousStatus} to ${newStatus}`,
      });
    } catch { /* non-fatal */ }
  }

  // Notify the assigned contractor when the landlord changes the status.
  if (wo.assigned_contractor_email) {
    try {
      const admin = createAdminClient();
      const { data: contractorProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', wo.assigned_contractor_email.toLowerCase())
        .maybeSingle();
      if (contractorProfile?.id) {
        await insertNotification({
          userId: contractorProfile.id as string,
          type: 'work_order_status_changed',
          title: `Nestora: Work order ${newStatus.toLowerCase()}`,
          message: `"${wo.title}"${wo.properties?.name ? ` at ${wo.properties.name}` : ''} has been moved to ${newStatus}.`,
          link: '/contractor',
        });
      }
    } catch { /* non-fatal */ }
  }
}

export async function updateContractorAssignment(
  id: string,
  data: {
    assigned_contractor: string | null;
    assigned_contractor_email: string | null;
    assigned_contractor_phone: string | null;
    trade: string | null;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch current row for ownership check + fields needed for notification
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id, title, description, priority, due_date, unit, assigned_contractor_email, properties(name, unit_label_type)')
    .eq('id', id)
    .single() as {
      data: {
        user_id: string;
        title: string;
        description: string | null;
        priority: string;
        due_date: string | null;
        unit: string | null;
        assigned_contractor_email: string | null;
        properties: { name: string; unit_label_type?: string | null } | null;
      } | null;
      error: any;
    };

  if (fetchErr || !wo || wo.user_id !== user.id) {
    throw new Error('Not authorized to update this work order');
  }

  const previousEmail = wo.assigned_contractor_email;
  // Normalise upfront so we can use it in the update payload and the notify block.
  const newEmail = data.assigned_contractor_email?.trim().toLowerCase() ?? null;

  // Hybrid model: clear assigned_contractor_id whenever the email changes so a stale
  // ID from a previous contractor never persists. The notify block below re-sets it
  // when the new contractor already has a Nestora account.
  const assignmentChanged = newEmail !== previousEmail;
  const updatePayload: Record<string, unknown> = {
    assigned_contractor: data.assigned_contractor,
    assigned_contractor_email: newEmail,
    assigned_contractor_phone: data.assigned_contractor_phone,
    trade: data.trade,
    ...(assignmentChanged && { assigned_contractor_id: null }),
  };

  const { error } = await supabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', id);

  if (error) throw new Error(error.message || 'Failed to update contractor assignment');

  if (user.email) {
    try {
      const label = data.assigned_contractor
        ? `${data.assigned_contractor}${data.assigned_contractor_email ? ` (${data.assigned_contractor_email})` : ''}`
        : 'unassigned';
      await supabase.from('work_order_notes').insert({
        work_order_id: id,
        author_email: user.email.toLowerCase(),
        author_role: 'landlord',
        note_type: 'system',
        content: data.assigned_contractor
          ? `Contractor assigned: ${label}`
          : 'Contractor removed',
      });
    } catch { /* non-fatal */ }
  }

  // Notify/invite contractor when email is added for the first time or changed.
  // Skip when email is unchanged (name/trade-only edit) to avoid duplicate notifications.
  if (newEmail && newEmail !== previousEmail) {
    try {
      const admin = createAdminClient();

      const [contractorProfile, landlordProfile] = await Promise.all([
        admin.from('profiles').select('id').eq('email', newEmail).maybeSingle(),
        admin.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);

      const landlordName = (landlordProfile.data?.full_name as string | null) ?? undefined;

      if (contractorProfile.data) {
        // Contractor is registered — link their ID now so future email changes
        // don't break the association (hybrid model: ID wins over email long-term).
        try {
          await supabase
            .from('work_orders')
            .update({ assigned_contractor_id: contractorProfile.data.id as string })
            .eq('id', id);
        } catch { /* non-fatal — backfill in role-actions.ts will recover this */ }

        const { notifyContractorNewWorkOrder } = await import('@/app/actions/email');
        await notifyContractorNewWorkOrder({
          title: wo.title,
          description: wo.description,
          priority: wo.priority,
          due_date: wo.due_date,
          propertyName: wo.properties?.name || null,
          unit: wo.unit,
          unit_label_type: wo.properties?.unit_label_type ?? null,
          assigned_contractor_email: newEmail,
          landlordName,
        });
        await insertNotification({
          userId: contractorProfile.data.id as string,
          type: 'work_order_assigned',
          title: 'Nestora: Work order assigned',
          message: `"${wo.title}"${wo.properties?.name ? ` at ${wo.properties.name}` : ''} has been assigned to you.`,
          link: '/contractor',
        });
      } else {
        // Unregistered — ensure a directory entry exists then send combined invite.
        const { data: existingEntry } = await admin
          .from('contractors')
          .select('id')
          .eq('landlord_id', user.id)
          .eq('email', newEmail)
          .maybeSingle();

        if (!existingEntry) {
          await admin.from('contractors').insert({
            landlord_id: user.id,
            name: data.assigned_contractor?.trim() || newEmail,
            email: newEmail,
            phone: data.assigned_contractor_phone?.trim() || null,
            trade: data.trade || null,
          });
        }

        const { sendContractorWorkOrderInvitation } = await import('@/app/actions/email');
        await sendContractorWorkOrderInvitation({
          contractorEmail: newEmail,
          landlordName,
          workOrder: {
            title: wo.title,
            priority: wo.priority,
            due_date: wo.due_date,
            propertyName: wo.properties?.name || null,
            unit: wo.unit,
            unit_label_type: wo.properties?.unit_label_type ?? null,
          },
        });
      }
    } catch (err) {
      console.error('[updateContractorAssignment] contractor notification failed (non-fatal):', err);
    }
  }
}

export async function toggleWorkOrderPaid(id: string, paid: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('work_orders')
    .update({ paid })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message || 'Failed to update paid status');
}

export async function respondToContractorQuote(id: string, approved: boolean | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id, title, contractor_quote, assigned_contractor_email, properties(name)')
    .eq('id', id)
    .single() as {
      data: {
        user_id: string;
        title: string;
        contractor_quote: number | null;
        assigned_contractor_email: string | null;
        properties: { name: string } | null;
      } | null;
      error: unknown;
    };

  if (fetchErr || !wo || wo.user_id !== user.id) throw new Error('Not authorized');

  const { error } = await supabase
    .from('work_orders')
    .update({ quote_approved: approved })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  // Notify contractor — only on an actual decision, not on undo
  if (approved !== null && wo.assigned_contractor_email && wo.contractor_quote != null) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', wo.assigned_contractor_email.toLowerCase())
        .maybeSingle();
      if (profile?.id) {
        const prop = wo.properties?.name;
        const amount = `$${wo.contractor_quote.toFixed(2)}`;
        await insertNotification({
          userId: profile.id as string,
          type: approved ? 'quote_accepted' : 'quote_declined',
          title: approved ? 'Nestora: Quote accepted' : 'Nestora: Quote declined',
          message: `"${wo.title}"${prop ? ` at ${prop}` : ''} — your ${amount} quote has been ${approved ? 'accepted' : 'declined'}.`,
          link: '/contractor',
        });
      }
    } catch { /* non-fatal */ }
  }
}

export async function createWorkOrder(data: {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  property_id: string;
  unit?: string | null;
  assigned_contractor?: string | null;
  assigned_contractor_email?: string | null;
  assigned_contractor_phone?: string | null;
  trade?: string | null;
  cost?: number | null;
  propertyName?: string | null;
  unit_label_type?: string | null;
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  // In Next.js 16, throwing from a Server Action produces a 500 that the
  // framework treats as a fatal RSC error instead of routing to the caller's
  // catch block. All error paths therefore return { data: null, error } so the
  // client receives a normal response it can display as a form error.
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { data: null, error: 'Not authenticated' };

    const { data: inserted, error } = await supabase
      .from('work_orders')
      .insert({
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        due_date: data.due_date || null,
        property_id: data.property_id,
        unit: data.unit || null,
        assigned_contractor: data.assigned_contractor || null,
        assigned_contractor_email: data.assigned_contractor_email?.trim().toLowerCase() || null,
        assigned_contractor_phone: data.assigned_contractor_phone || null,
        trade: data.trade || null,
        cost: data.cost || 0,
        user_id: user.id,
        status: 'Open',
      })
      .select()
      .single();

    if (error) {
      console.error('[createWorkOrder] insert failed:', error.message, error.code);
      return { data: null, error: error.message || 'Failed to create work order' };
    }

    if (user.email) {
      try {
        await supabase.from('work_order_notes').insert({
          work_order_id: inserted.id,
          author_email: user.email.toLowerCase(),
          author_role: 'landlord',
          note_type: 'system',
          content: 'Work order created',
        });
      } catch { /* non-fatal */ }
    }

    // Notify or invite the assigned contractor (non-fatal — work order is already created).
    const contractorEmail = data.assigned_contractor_email?.trim().toLowerCase();
    if (contractorEmail) {
      try {
        const admin = createAdminClient();
        const [contractorProfile, landlordProfile] = await Promise.all([
          admin.from('profiles').select('id').eq('email', contractorEmail).maybeSingle(),
          admin.from('profiles').select('full_name').eq('id', user.id).single(),
        ]);
        const landlordName = (landlordProfile.data?.full_name as string | null) ?? undefined;

        if (contractorProfile.data) {
          // Contractor is registered — link their ID immediately (hybrid model).
          try {
            await supabase
              .from('work_orders')
              .update({ assigned_contractor_id: contractorProfile.data.id as string })
              .eq('id', inserted.id);
          } catch { /* non-fatal */ }

          const { notifyContractorNewWorkOrder } = await import('@/app/actions/email');
          await notifyContractorNewWorkOrder({
            title: inserted.title,
            description: inserted.description,
            priority: inserted.priority,
            due_date: inserted.due_date,
            propertyName: data.propertyName,
            unit: data.unit,
            unit_label_type: data.unit_label_type,
            assigned_contractor_email: contractorEmail,
            landlordName,
          });
          await insertNotification({
            userId: contractorProfile.data.id as string,
            type: 'work_order_assigned',
            title: 'New work order assigned',
            message: `"${inserted.title as string}"${data.propertyName ? ` at ${data.propertyName}` : ''} has been assigned to you.`,
            link: '/contractor',
          });
        } else {
          const { data: existingEntry } = await admin
            .from('contractors')
            .select('id')
            .eq('landlord_id', user.id)
            .eq('email', contractorEmail)
            .maybeSingle();

          if (!existingEntry) {
            await admin.from('contractors').insert({
              landlord_id: user.id,
              name: data.assigned_contractor?.trim() || contractorEmail,
              email: contractorEmail,
              phone: data.assigned_contractor_phone?.trim() || null,
              trade: data.trade || null,
            });
          }

          const { sendContractorWorkOrderInvitation } = await import('@/app/actions/email');
          await sendContractorWorkOrderInvitation({
            contractorEmail,
            landlordName,
            workOrder: {
              title: inserted.title,
              priority: inserted.priority,
              due_date: inserted.due_date,
              propertyName: data.propertyName,
              unit: data.unit,
              unit_label_type: data.unit_label_type,
            },
          });
        }
      } catch (err) {
        console.error('[createWorkOrder] contractor notification failed (non-fatal):', err);
      }
    }

    return { data: inserted as Record<string, unknown>, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error creating work order';
    console.error('[createWorkOrder] unexpected error:', msg);
    return { data: null, error: msg };
  }
}
