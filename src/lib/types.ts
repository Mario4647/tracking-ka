export interface TouringUser {
  id: string;
  username: string;
  pin_hash: string;
  is_admin: boolean;
  pin_reset_at?: string | null;
  initial_location_name?: string | null;
  initial_lat?: number | null;
  initial_lng?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TouringSession {
  id: string;
  session_code: string;
  rider_id?: string | null;
  title: string;
  transport_type: string;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  fuel_level?: number | null;
  is_late_departure?: boolean;
  is_active?: boolean;
  is_completed?: boolean;
  status: string;
  route_progress_ratio?: number;
  total_distance_meters?: number;
  stopped_since?: string | null;
  stopped_location_label?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  touring_users?: TouringUser;
  touring_checkpoints?: Checkpoint[];
  touring_route_segments?: RouteSegment[];
}

export interface Checkpoint {
  id: string;
  session_id: string;
  name: string;
  order_index: number;
  latitude: number;
  longitude: number;
  target_time?: string | null;
  actual_time?: string | null;
  status: string;
  delay_minutes?: number;
  is_destination?: boolean;
  created_at: string;
}

export interface RouteSegment {
  id: string;
  session_id: string;
  from_checkpoint_id: string;
  to_checkpoint_id: string;
  distance_meters: number;
  duration_seconds: number;
  geometry_geojson: {
    type: string;
    coordinates: [number, number][];
  };
  transport_type: string;
  created_at: string;
}

export interface LocationTracking {
  id: string;
  session_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number | null;
  heading?: number | null;
  altitude_meters?: number | null;
  accuracy_meters?: number | null;
  battery_level?: number | null;
  is_charging?: boolean;
  recorded_at: string;
}

export interface ActiveViewer {
  id: string;
  session_id: string;
  viewer_name: string;
  device_info?: string | null;
  last_active_at: string;
  joined_at: string;
}

export interface NotificationLog {
  id: string;
  session_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
}
