BEGIN;

CREATE TABLE IF NOT EXISTS public.custom_part_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code text NOT NULL UNIQUE,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text,
  company_name text,
  part_name text NOT NULL,
  part_type text,
  dimensions text,
  alloy_condition text,
  quantity text NOT NULL DEFAULT '1',
  notes text,
  attachment_name text,
  attachment_mime text,
  attachment_size integer,
  attachment_bytes bytea,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','reviewing','quoted','accepted','rejected','completed')),
  internal_note text,
  quote_amount numeric(18,2),
  quote_currency text NOT NULL DEFAULT 'IRT'
    CHECK (quote_currency IN ('IRT','IRR','USD','EUR')),
  customer_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_part_requests_attachment_size_check
    CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 8388608)),
  CONSTRAINT custom_part_requests_attachment_pair_check
    CHECK ((attachment_bytes IS NULL) = (attachment_size IS NULL)),
  CONSTRAINT custom_part_requests_attachment_name_check
    CHECK (attachment_bytes IS NULL OR (attachment_name IS NOT NULL AND attachment_mime IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS custom_part_requests_status_created_idx
  ON public.custom_part_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS custom_part_requests_phone_created_idx
  ON public.custom_part_requests (phone, created_at DESC);

ALTER TABLE public.custom_part_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.custom_part_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.custom_part_requests TO service_role;

COMMIT;
