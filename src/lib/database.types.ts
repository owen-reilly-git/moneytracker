export type RoommateStatus = "pending" | "approved" | "declined";
export type ExpenseFrequency = "one_time" | "recurring";

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          home_code: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          home_code: string;
          owner_id: string;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          home_code: string;
          owner_id: string;
        }>;
        Relationships: [];
      };
      roommates: {
        Row: {
          id: string;
          household_id: string;
          user_id: string | null;
          name: string;
          email: string;
          status: RoommateStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          name: string;
          email: string;
          status?: RoommateStatus;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          email: string;
          status: RoommateStatus;
        }>;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          household_id: string;
          paid_by: string;
          label: string;
          amount: number;
          frequency: ExpenseFrequency;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          paid_by: string;
          label: string;
          amount: number;
          frequency: ExpenseFrequency;
          created_at?: string;
        };
        Update: Partial<{
          label: string;
          amount: number;
          frequency: ExpenseFrequency;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      find_household_by_code: {
        Args: { code: string };
        Returns: { id: string; name: string }[];
      };
      auth_household_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      is_household_owner: {
        Args: { hh_id: string };
        Returns: boolean;
      };
    };
  };
}

export type Household = Database["public"]["Tables"]["households"]["Row"];
export type Roommate = Database["public"]["Tables"]["roommates"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
