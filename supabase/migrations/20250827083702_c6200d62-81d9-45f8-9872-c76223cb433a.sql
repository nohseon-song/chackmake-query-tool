-- Harden functions: set explicit search_path to avoid mutable resolution

-- 1) get_user_billing
CREATE OR REPLACE FUNCTION public.get_user_billing()
 RETURNS TABLE(name text, email text, total_requests bigint, total_cost_usd numeric, total_tokens_used numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public','extensions'
AS $function$
DECLARE
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
BEGIN
    start_date := date_trunc('month', now());
    end_date := start_date + interval '1 month';

    RETURN QUERY
    SELECT
      up.name,
      up.email,
      COUNT(al.id),
      SUM(al.calculated_cost),
      SUM(al.total_tokens)
    FROM
      public.api_logs AS al
    JOIN
      public.user_profiles AS up ON al.user_id = up.id
    WHERE
      al.created_at >= start_date AND al.created_at < end_date
    GROUP BY
      up.name, up.email
    ORDER BY
      SUM(al.calculated_cost) DESC;
END;
$function$;

-- 2) get_company_billing
CREATE OR REPLACE FUNCTION public.get_company_billing()
 RETURNS TABLE(name text, total_requests bigint, total_cost_usd numeric, total_tokens_used numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public','extensions'
AS $function$
DECLARE
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
BEGIN
    start_date := date_trunc('month', now());
    end_date := start_date + interval '1 month';

    RETURN QUERY
    SELECT
      o.name,
      COUNT(al.id),
      SUM(al.calculated_cost),
      SUM(al.total_tokens)
    FROM
      public.api_logs AS al
    JOIN
      public.organizations AS o ON al.organization_id = o.id
    WHERE
      al.created_at >= start_date AND al.created_at < end_date
    GROUP BY
      o.name
    ORDER BY
      SUM(al.calculated_cost) DESC;
END;
$function$;

-- 3) calculate_and_store_monthly_api_billings
CREATE OR REPLACE FUNCTION public.calculate_and_store_monthly_api_billings(billing_ref_date date, company_name text DEFAULT 'SNS기계기술'::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public','extensions'
AS $function$
DECLARE
    period_start_date DATE;
    period_end_date DATE;
    billing_cycle_date DATE;
BEGIN
    period_end_date := billing_ref_date - INTERVAL '1 day';
    period_start_date := billing_ref_date - INTERVAL '1 month';
    billing_cycle_date := DATE_TRUNC('month', billing_ref_date)::DATE;

    DELETE FROM public.monthly_api_billings
    WHERE billing_month = billing_cycle_date 
      AND user_id IN (
          SELECT al.user_id
          FROM public.api_logs al
          JOIN public.organizations o ON al.organization_id = o.id
          WHERE o.name = company_name
          AND al.created_at >= period_start_date
          AND al.created_at < (period_end_date + INTERVAL '1 day')
      )
      AND organization_id = (SELECT id FROM public.organizations WHERE name = company_name);

    INSERT INTO public.monthly_api_billings (
        billing_month, user_id, organization_id, total_requests, total_cost_usd, total_tokens_used
    )
    SELECT
        billing_cycle_date AS billing_month,
        al.user_id,
        o.id AS organization_id,
        COUNT(al.id) AS total_requests,
        SUM(al.calculated_cost) AS total_cost_usd,
        SUM(al.total_tokens) AS total_tokens_used
    FROM
        public.api_logs al
    JOIN
        public.user_profiles up ON al.user_id = up.id
    JOIN
        public.organizations o ON al.organization_id = o.id
    WHERE
        o.name = company_name
        AND al.created_at >= period_start_date
        AND al.created_at < (period_end_date + INTERVAL '1 day')
    GROUP BY
        al.user_id, o.id;
END;
$function$;

-- 4) get_user_api_summary_for_billing_cycle
CREATE OR REPLACE FUNCTION public.get_user_api_summary_for_billing_cycle(billing_reference_date date, company_name text DEFAULT 'checkmakeAPI'::text)
 RETURNS TABLE(user_id uuid, user_name text, user_email text, total_requests bigint, total_cost_usd numeric, total_tokens_used numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public','extensions'
AS $function$
DECLARE
    period_start_date DATE;
    period_end_date DATE;
BEGIN
    period_end_date := billing_reference_date - INTERVAL '1 day';
    period_start_date := billing_reference_date - INTERVAL '1 month';

    RETURN QUERY
    SELECT
        al.user_id,
        up.name AS user_name,
        up.email AS user_email,
        COUNT(al.id) AS total_requests,
        SUM(al.calculated_cost) AS total_cost_usd,
        SUM(al.total_tokens) AS total_tokens_used
    FROM
        public.api_logs al
    JOIN
        public.user_profiles up ON al.user_id = up.id
    JOIN
        public.organizations o ON al.organization_id = o.id
    WHERE
        o.name = company_name
        AND al.created_at >= period_start_date
        AND al.created_at < (period_end_date + INTERVAL '1 day')
    GROUP BY
        al.user_id, up.name, up.email
    ORDER BY
        total_cost_usd DESC;
END;
$function$;

-- 5) calculate_and_and_store_monthly_api_billings (typo preserved)
CREATE OR REPLACE FUNCTION public.calculate_and_and_store_monthly_api_billings(billing_ref_date date, company_name text DEFAULT 'SNS기계기술'::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public','extensions'
AS $function$
DECLARE
    period_start_date DATE;
    period_end_date DATE;
    billing_cycle_date DATE;
BEGIN
    period_end_date := billing_ref_date - INTERVAL '1 day';
    period_start_date := billing_ref_date - INTERVAL '1 month';
    billing_cycle_date := DATE_TRUNC('month', billing_ref_date)::DATE;

    DELETE FROM public.monthly_api_billings
    WHERE billing_month = billing_cycle_date AND organization_id = (SELECT id FROM public.organizations WHERE name = company_name);

    INSERT INTO public.monthly_api_billings (
        billing_month, user_id, organization_id, total_requests, total_cost_usd, total_tokens_used
    )
    SELECT
        billing_cycle_date AS billing_month,
        al.user_id,
        o.id AS organization_id,
        COUNT(al.id) AS total_requests,
        SUM(al.calculated_cost) AS total_cost_usd,
        SUM(al.total_tokens) AS total_tokens_used
    FROM
        public.api_logs al
    JOIN
        public.user_profiles up ON al.user_id = up.id
    JOIN
        public.organizations o ON al.organization_id = o.id
    WHERE
        o.name = company_name
        AND al.created_at >= period_start_date
        AND al.created_at < (period_end_date + INTERVAL '1 day')
    GROUP BY
        al.user_id, o.id;
END;
$function$;

-- 6) execute_sql
CREATE OR REPLACE FUNCTION public.execute_sql(sql text)
 RETURNS TABLE(result_json json)
 LANGUAGE plpgsql
 SET search_path TO 'public','extensions'
AS $function$
BEGIN
    RETURN QUERY EXECUTE 'SELECT array_to_json(array_agg(row_to_json(t))) FROM (' || sql || ') t';
END;
$function$;