CREATE TABLE IF NOT EXISTS cscx_kanban_config (
  id integer PRIMARY KEY CHECK (id = 1),
  config jsonb NOT NULL DEFAULT '{"order":[],"names":{},"custom":[],"deleted":[]}'::jsonb,
  version integer NOT NULL DEFAULT 0
);
INSERT INTO cscx_kanban_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
