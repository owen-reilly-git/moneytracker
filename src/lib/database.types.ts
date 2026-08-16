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
      expense_participants: {
        Row: {
          id: string;
          expense_id: string;
          household_id: string;
          roommate_id: string;
          opted_out: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          household_id: string;
          roommate_id: string;
          opted_out?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          opted_out: boolean;
        }>;
        Relationships: [
          {
            foreignKeyName: "expense_participants_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_participants_roommate_id_fkey";
            columns: ["roommate_id"];
            isOneToOne: false;
            referencedRelation: "roommates";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          household_id: string;
          recipient_roommate_id: string;
          expense_id: string | null;
          message: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          recipient_roommate_id: string;
          expense_id?: string | null;
          message: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          read_at: string | null;
        }>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          household_id: string;
          from_roommate_id: string;
          to_roommate_id: string;
          amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          from_roommate_id: string;
          to_roommate_id: string;
          amount: number;
          note?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
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
      create_expense_with_participants: {
        Args: {
          p_household_id: string;
          p_paid_by: string;
          p_label: string;
          p_amount: number;
          p_frequency: ExpenseFrequency;
        };
        Returns: string;
      };
    };
  };
}

export type Household = Database["public"]["Tables"]["households"]["Row"];
export type Roommate = Database["public"]["Tables"]["roommates"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseParticipant = Database["public"]["Tables"]["expense_participants"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];

export type ExpenseWithParticipants = Expense & {
  expense_participants: Pick<ExpenseParticipant, "roommate_id" | "opted_out">[];
};
