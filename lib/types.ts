export type Class = {
  id: string;
  day: number;
  time: string;
  end_time: string | null;
  class_name: string;
  location: string | null;
  capacity: number;
  created_at?: string;
};

export type Signup = {
  id: string;
  week_key: string;
  class_id: string;
  name: string;
  email: string;
  signed_up_at: string;
};

export type Override = {
  id: string;
  week_key: string;
  class_id: string;
  cancelled: boolean;
  time: string | null;
  end_time: string | null;
  class_name: string | null;
  location: string | null;
  capacity: number | null;
};

// A class merged with its override for the current week
export type EffectiveClass = Class & {
  overridden?: boolean;
  cancelled?: boolean;
};

// Signups keyed by class_id → array of signups
export type SignupMap = Record<string, Signup[]>;

// Overrides keyed by class_id
export type OverrideMap = Record<string, Override>;
