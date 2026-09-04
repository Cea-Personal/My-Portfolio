-- The private app.digest wrapper (0114) resolves pgcrypto without widening the
-- publication function's security-definer search path to the public schema.
alter function app.stage_portfolio_publication()
  set search_path = pg_catalog, app, published;
