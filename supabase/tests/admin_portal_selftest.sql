-- Admin portal self-test. Paste into the Supabase SQL editor AFTER applying supabase/schema.sql.
-- Everything runs in one transaction that is rolled back: it leaves no data behind.
-- Pass: every block prints "PASS: ...". Fail: the script stops with "FAIL: ...".

begin;

do $$
declare
  op uuid := gen_random_uuid();
  target uuid := gen_random_uuid();
  res jsonb;
  n int;
  audit_before int; outbox_before int; status_before text;
  code text;
  proj uuid;
begin
  insert into auth.users (id, email, aud, role)
  values (op, 'selftest-op@example.invalid', 'authenticated', 'authenticated'),
         (target, 'selftest-target@example.invalid', 'authenticated', 'authenticated');

  -- admin_selftest_trigger ------------------------------------------------------------------
  select count(*) into n from user_status where user_id in (op, target) and status = 'active';
  if n <> 2 then raise exception 'FAIL: trigger: expected 2 active user_status rows, got %', n; end if;
  raise notice 'PASS: trigger creates user_status rows';

  insert into admin_users (user_id, role) values (op, 'operator');

  -- admin_selftest_suspend ------------------------------------------------------------------
  res := admin_set_user_status(op, target, 'suspended', 'abuse test', '127.0.0.1');
  if res->>'status' <> 'suspended' or res->>'previous_status' <> 'active' then
    raise exception 'FAIL: suspend: unexpected result %', res;
  end if;
  select count(*) into n from admin_audit_log where action = 'user.suspend' and target_id = target::text and actor_id = op;
  if n <> 1 then raise exception 'FAIL: suspend: expected 1 audit row, got %', n; end if;
  select count(*) into n from auth_outbox where user_id = target and action = 'ban' and status = 'pending';
  if n <> 1 then raise exception 'FAIL: suspend: expected 1 pending ban, got %', n; end if;
  raise notice 'PASS: suspend writes status, audit, and outbox together';

  -- admin_selftest_unsuspend ----------------------------------------------------------------
  res := admin_set_user_status(op, target, 'active', 'appeal accepted', '127.0.0.1');
  select count(*) into n from admin_audit_log where action = 'user.unsuspend' and target_id = target::text;
  if n <> 1 then raise exception 'FAIL: unsuspend: expected 1 audit row, got %', n; end if;
  select count(*) into n from auth_outbox where user_id = target and action = 'unban';
  if n <> 1 then raise exception 'FAIL: unsuspend: expected 1 unban, got %', n; end if;
  raise notice 'PASS: unsuspend writes audit and unban';

  -- admin_selftest_rollback: every error code leaves no partial writes ----------------------
  foreach code in array array['reason_too_short', 'invalid_status', 'self_action', 'not_operator', 'not_found'] loop
    select count(*) into audit_before from admin_audit_log;
    select count(*) into outbox_before from auth_outbox;
    select status into status_before from user_status where user_id = target;
    begin
      case code
        when 'reason_too_short' then perform admin_set_user_status(op, target, 'suspended', '  ab  ', null);
        when 'invalid_status'   then perform admin_set_user_status(op, target, 'deleted', 'valid reason', null);
        when 'self_action'      then perform admin_set_user_status(op, op, 'suspended', 'valid reason', null);
        when 'not_operator'     then perform admin_set_user_status(target, op, 'suspended', 'valid reason', null);
        when 'not_found'        then perform admin_set_user_status(op, gen_random_uuid(), 'suspended', 'valid reason', null);
      end case;
      raise exception 'FAIL: rollback: % did not raise', code;
    exception when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm <> code then raise exception 'FAIL: rollback: expected %, got %', code, sqlerrm; end if;
    end;
    select count(*) into n from admin_audit_log;
    if n <> audit_before then raise exception 'FAIL: rollback: % changed the audit log', code; end if;
    select count(*) into n from auth_outbox;
    if n <> outbox_before then raise exception 'FAIL: rollback: % changed the outbox', code; end if;
    if (select status from user_status where user_id = target) <> status_before then
      raise exception 'FAIL: rollback: % changed user_status', code;
    end if;
  end loop;
  raise notice 'PASS: every error code raises and leaves no partial writes';

  -- admin_selftest_append_only --------------------------------------------------------------
  begin
    update admin_audit_log set reason = 'x';
    raise exception 'FAIL: append-only: update succeeded';
  exception when others then
    if sqlerrm <> 'admin_audit_log is append-only' then raise exception 'FAIL: append-only update: %', sqlerrm; end if;
  end;
  begin
    delete from admin_audit_log;
    raise exception 'FAIL: append-only: delete succeeded';
  exception when others then
    if sqlerrm <> 'admin_audit_log is append-only' then raise exception 'FAIL: append-only delete: %', sqlerrm; end if;
  end;
  raise notice 'PASS: audit log rejects update and delete';

  -- admin_selftest_grants -------------------------------------------------------------------
  if has_function_privilege('anon', 'admin_set_user_status(uuid,uuid,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'admin_set_user_status(uuid,uuid,text,text,text)', 'execute') then
    raise exception 'FAIL: grants: browser roles can execute admin_set_user_status';
  end if;
  if has_table_privilege('anon', 'admin_audit_log', 'select')
     or has_table_privilege('authenticated', 'admin_users', 'select') then
    raise exception 'FAIL: grants: browser roles can read admin tables';
  end if;
  raise notice 'PASS: browser roles have no access to admin functions or tables';

  -- admin_selftest_backfill -----------------------------------------------------------------
  insert into projects (name, root_domain, owner_user_id, verified_at, verification_method, review_status)
  values ('selftest', 'selftest.example', op, now(), 'dns-txt', 'none')
  returning id into proj;
  perform admin_backfill();
  if (select review_status from projects where id = proj) <> 'approved' then
    raise exception 'FAIL: backfill: legacy DNS-verified project not approved';
  end if;
  select count(*) into n from admin_audit_log where action = 'migration.approve_legacy_dns' and target_id = proj::text and actor_id is null;
  if n <> 1 then raise exception 'FAIL: backfill: expected 1 migration audit row, got %', n; end if;
  perform admin_backfill();  -- idempotent: a second run approves nothing new
  select count(*) into n from admin_audit_log where action = 'migration.approve_legacy_dns' and target_id = proj::text;
  if n <> 1 then raise exception 'FAIL: backfill: second run wrote % audit rows', n; end if;
  raise notice 'PASS: backfill approves legacy DNS-verified projects once, with an audit row';
end $$;

rollback;
