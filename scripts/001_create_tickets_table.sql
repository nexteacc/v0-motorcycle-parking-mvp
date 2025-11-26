-- Create tickets table for parking management
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  plate_number VARCHAR(20) NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exited', 'error', 'abnormal')),
  device_id VARCHAR(100),
  parking_lot_id VARCHAR(100) NOT NULL DEFAULT 'default',
  plate_modified BOOLEAN NOT NULL DEFAULT FALSE,
  original_plate_number VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_plate_number ON tickets(plate_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_parking_lot_id ON tickets(parking_lot_id);
CREATE INDEX IF NOT EXISTS idx_tickets_entry_time ON tickets(entry_time);

-- Create operation_logs table for audit trail (撤销操作等)
CREATE TABLE IF NOT EXISTS operation_logs (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  device_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_ticket_id ON operation_logs(ticket_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
