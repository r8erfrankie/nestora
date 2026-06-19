-- Activity log + manual notes for work orders.
-- note_type = 'system' rows are written by server actions on mutations.
-- note_type = 'manual' rows are written by users and can be edited by the author.

CREATE TABLE IF NOT EXISTS public.work_order_notes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  uuid        NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  author_email   text        NOT NULL,                     -- lowercase email of the acting user
  author_role    text        NOT NULL CHECK (author_role IN ('landlord', 'contractor')),
  note_type      text        NOT NULL CHECK (note_type IN ('manual', 'system')),
  content        text        NOT NULL CHECK (char_length(content) > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: work order owner or assigned contractor
CREATE POLICY "View notes for accessible work orders"
  ON public.work_order_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders
      WHERE work_orders.id = work_order_notes.work_order_id
        AND (
          work_orders.user_id = auth.uid()
          OR lower(work_orders.assigned_contractor_email) = lower(auth.jwt() ->> 'email')
        )
    )
  );

-- INSERT: same — both owner and contractor can add notes
CREATE POLICY "Insert notes for accessible work orders"
  ON public.work_order_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_orders
      WHERE work_orders.id = work_order_notes.work_order_id
        AND (
          work_orders.user_id = auth.uid()
          OR lower(work_orders.assigned_contractor_email) = lower(auth.jwt() ->> 'email')
        )
    )
  );

-- UPDATE: only the author can edit their own manual notes
CREATE POLICY "Edit own manual notes"
  ON public.work_order_notes FOR UPDATE
  USING (
    lower(author_email) = lower(auth.jwt() ->> 'email')
    AND note_type = 'manual'
  )
  WITH CHECK (
    lower(author_email) = lower(auth.jwt() ->> 'email')
    AND note_type = 'manual'
  );

-- Index for the primary access pattern
CREATE INDEX IF NOT EXISTS work_order_notes_work_order_id_idx
  ON public.work_order_notes (work_order_id, created_at);
