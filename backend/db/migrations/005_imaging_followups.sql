BEGIN;
ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS root_order_id UUID REFERENCES radiology_orders(order_id);
ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS follow_up_of UUID REFERENCES radiology_orders(order_id);
ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS study_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS clinical_problem TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS radiology_orders_episode_version_idx
    ON radiology_orders(COALESCE(root_order_id,order_id),study_version);
CREATE INDEX IF NOT EXISTS radiology_orders_followup_idx ON radiology_orders(follow_up_of);
CREATE TABLE IF NOT EXISTS radiology_followup_events (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES radiology_orders(order_id),
    previous_order_id UUID REFERENCES radiology_orders(order_id),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
