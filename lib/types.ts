export interface Ticket {
  id: number
  plate_number: string
  entry_time: string
  exit_time: string | null
  photo_url: string | null
  status: "active" | "exited" | "error" | "abnormal"
  device_id: string | null
  parking_lot_id: string
  plate_modified: boolean
  original_plate_number: string | null
  created_at: string
  updated_at: string
}

export interface OperationLog {
  id: number
  ticket_id: number
  operation_type: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  device_id: string | null
  created_at: string
}

export type TicketStatus = "active" | "exited" | "error" | "abnormal"
