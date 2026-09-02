-- Atomically consume exactly one valid, unexpired 2FA code.
create or replace function public.consume_two_factor_code(
  p_user_id uuid,
  p_purpose text,
  p_target_user_id uuid,
  p_code_hash text
)
returns table("codeId" uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select t."codeId"
    from public."TwoFactorCode" t
    where t."userId" = p_user_id
      and t."purpose" = p_purpose
      and t."targetUserId" = p_target_user_id
      and t."codeHash" = p_code_hash
      and t."consumedAt" is null
      and t."expiresAt" >= now()
    order by t."createdAt" desc
    limit 1
    for update skip locked
  )
  update public."TwoFactorCode" t
  set "consumedAt" = now()
  from candidate c
  where t."codeId" = c."codeId" and t."consumedAt" is null
  returning t."codeId";
end;
$$;
