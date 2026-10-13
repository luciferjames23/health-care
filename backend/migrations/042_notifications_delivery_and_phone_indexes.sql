-- Migration 042: Notifications delivery tracking and patient phone indexes
-- Extends notifications table with read_at and adds performance indexes

ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

-- Performance index for fast delivery status webhook matching by external_message_id (wamid)
CREATE INDEX IF NOT EXISTS idx_notifications_external_msg_id 
  ON notifications(external_message_id) 
  WHERE external_message_id IS NOT NULL;

-- Patient contact indexes for normalized phone lookups
CREATE INDEX IF NOT EXISTS idx_patients_phone_exact 
  ON patients(phone);

CREATE INDEX IF NOT EXISTS idx_patients_whatsapp_exact 
  ON patients(whatsapp_number);
