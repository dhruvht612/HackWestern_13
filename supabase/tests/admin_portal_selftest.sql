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

do $$
declare
  older uuid := '00000000-0000-4000-8000-000000000001';
  newer uuid := '00000000-0000-4000-8000-000000000002';
  joined timestamptz := now();
  recent_event bigint;
  actor_email text;
  new_audit_id bigint;
  p uuid;
  before_counts record;
  after_counts record;
  fn text;
begin
  select * into before_counts from admin_overview_counts(now() - interval '90 days');
  insert into auth.users (id, email, aud, role, created_at)
  values (older, older::text || '@admin-read-selftest.example', 'authenticated', 'authenticated', joined),
         (newer, newer::text || '@admin-read-selftest.example', 'authenticated', 'authenticated', joined);

  insert into projects (name, root_domain, owner_user_id, verified_at)
  values ('read test', 'read-test.example', newer, now()) returning id into p;
  insert into scans (project_id, status) values (p, 'failed');
  insert into review_items (kind, user_id, risk_level, signals) values ('user', newer, 'medium', '[]');

  if (select array_agg(id) from admin_list_users('ADMIN-READ-SELFTEST.EXAMPLE', 'active', 'low', 1, null, null))
       is distinct from array[newer]
     or (select array_agg(id) from admin_list_users('admin-read-selftest.example', 'active', 'low', 1, joined, newer))
       is distinct from array[older]
     or (select projects from admin_list_users(newer::text, null, null, 1, null, null)) is distinct from 1::bigint then
    raise exception 'FAIL: directory filtering, cursor tie-break, or project count';
  end if;
  raise notice 'PASS: directory filters and pages users with equal join times';

  insert into security_events (type, user_id) values ('selftest_read', older);
  insert into security_events (type, user_id) values ('selftest_read', newer) returning id into recent_event;
  insert into security_events (type, user_id) values ('blocklist_hit', newer);
  if (select user_id from admin_list_events('selftest_read', 1, null)) is distinct from newer
     or (select user_email from admin_list_events('selftest_read', 1, recent_event))
       is distinct from older::text || '@admin-read-selftest.example' then
    raise exception 'FAIL: events filter, cursor, or user lookup';
  end if;

  insert into admin_audit_log (actor_id, action, target_type, target_id)
  values (newer, 'selftest.read', 'user', older::text) returning id into new_audit_id;
  select a.actor_email into actor_email from admin_list_audit('selftest.', 1, new_audit_id + 1) a;
  if actor_email is distinct from newer::text || '@admin-read-selftest.example' then
    raise exception 'FAIL: audit prefix, cursor, or actor lookup';
  end if;
  raise notice 'PASS: event and audit feeds apply filters and resolve emails';

  select * into after_counts from admin_overview_counts(now() - interval '90 days');
  if after_counts.users <> before_counts.users + 2
     or after_counts.verified_domains <> before_counts.verified_domains + 1
     or after_counts.pending_reviews <> before_counts.pending_reviews + 1
     or after_counts.scans_24h <> before_counts.scans_24h + 1
     or after_counts.scan_failures_24h <> before_counts.scan_failures_24h + 1
     or after_counts.blocklist_hits_24h <> before_counts.blocklist_hits_24h + 1 then
    raise exception 'FAIL: overview aggregates';
  end if;
  raise notice 'PASS: overview counts reflect stored data';

  foreach fn in array array[
    'admin_list_users(text,text,text,int,timestamptz,uuid)', 'admin_list_events(text,int,bigint)',
    'admin_list_audit(text,int,bigint)', 'admin_overview_counts(timestamptz)'
  ] loop
    if has_function_privilege('anon', fn, 'execute')
       or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'FAIL: read RPC grants for %', fn;
    end if;
  end loop;
  raise notice 'PASS: admin read RPCs are restricted to the backend service role';
end $$;

do $$
declare
  op uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  v_project uuid;
  review_id uuid;
  scan_id uuid;
  proof jsonb;
begin
  insert into auth.users (id, email, aud, role)
  values (op, 'review-operator-' || op::text || '@example.invalid', 'authenticated', 'authenticated'),
         (owner_id, 'review-owner-' || owner_id::text || '@example.invalid', 'authenticated', 'authenticated');
  insert into admin_users (user_id, role) values (op, 'operator'), (owner_id, 'operator');
  insert into projects (name, root_domain, owner_user_id, verification_token_hash, verification_expires_at)
  values ('review self-test', 'review-selftest.example', owner_id, 'mock-hash', now() + interval '1 hour')
  returning id into v_project;

  proof := record_domain_proof(v_project, 'mock-hash', 'high', '[{"id":"signal:dns_proof","label":"DNS proof","value":"passed"}]');
  if proof->>'review_status' <> 'pending_review' or proof->>'queued' <> 'true' then
    raise exception 'FAIL: proof should create a high-risk review';
  end if;
  select r.id into strict review_id from review_items r where r.project_id = v_project;
  begin
    perform queue_authorized_scan(v_project, owner_id);
    raise exception 'FAIL: pending claim queued a scan';
  exception when others then
    if sqlerrm <> 'scan_denied' then raise; end if;
  end;
  begin
    perform admin_decide_review(review_id, owner_id, 'approve', 'self-review test', null);
    raise exception 'FAIL: self-review accepted';
  exception when others then
    if sqlerrm <> 'self_action' then raise; end if;
  end;

  update review_items set analysis_started_at = now() where id = review_id;
  if not finish_admin_review(review_id, now(), '{"fallback_used":true}', '{"fallback_used":true,"error_category":"self_test"}') then
    raise exception 'FAIL: reviewer could not save advice';
  end if;
  if (select status from review_items where id = review_id) <> 'pending' then
    raise exception 'FAIL: saving advice changed the decision';
  end if;
  perform admin_decide_review(review_id, op, 'approve', 'independent review passed', null);
  begin
    perform admin_decide_review(review_id, op, 'reject', 'duplicate reviewer attempt', null);
    raise exception 'FAIL: a duplicate decision succeeded';
  exception when others then
    if sqlerrm <> 'already_decided' then raise; end if;
  end;
  if (select count(*) from admin_audit_log where target_id = v_project::text and action = 'review.approve') <> 1 then
    raise exception 'FAIL: approval and audit did not commit together';
  end if;

  scan_id := queue_authorized_scan(v_project, owner_id);
  begin
    perform queue_authorized_scan(v_project, owner_id);
    raise exception 'FAIL: two active scans were allowed';
  exception when others then
    if sqlerrm <> 'scan_active' then raise; end if;
  end;
  perform admin_revoke_domain(v_project, op, 'authorization withdrawn', null);
  if (select status from scans where id = scan_id) <> 'cancelled' then
    raise exception 'FAIL: revocation did not cancel queued scan';
  end if;
  begin
    perform queue_authorized_scan(v_project, owner_id);
    raise exception 'FAIL: revoked claim queued a scan';
  exception when others then
    if sqlerrm <> 'scan_denied' then raise; end if;
  end;
  perform admin_blocklist_change('blocked-selftest.example', 'suffix', op, 'blocklist test', null);
  perform admin_blocklist_change('blocked-selftest.example', null, op, 'remove blocklist test', null);
  if (select count(*) from admin_audit_log where actor_id = op and action like 'blocklist.%') <> 2 then
    raise exception 'FAIL: blocklist changes lack audit entries';
  end if;
  if has_table_privilege('authenticated', 'admin_review_rows', 'select')
     or has_function_privilege('anon', 'admin_decide_review(uuid,uuid,text,text,text)', 'execute') then
    raise exception 'FAIL: browser has access to review internals';
  end if;
  raise notice 'PASS: DNS proof, review, advice, authorization, revocation, blocklist, and grants';
end $$;

rollback;
