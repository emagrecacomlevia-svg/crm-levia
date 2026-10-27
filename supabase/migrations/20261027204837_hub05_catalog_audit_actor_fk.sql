-- HUB-05 performance: additive FK index on isolated private audit trail.
create index if not exists hub05_audit_actor_fk on hub_catalog_private.audit_events(actor_auth_user_id);
