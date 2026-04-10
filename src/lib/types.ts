export interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  group_id: number | null;
  group_name: string | null;
  created_at: string;
  status: "active" | "unsubscribed";
}

export interface Group {
  id: number;
  name: string;
  created_at: string;
  subscriber_count: number;
}

export interface SendLog {
  id: number;
  subject: string;
  html_content: string;
  recipient_count: number;
  sent_at: string;
  status: "sent" | "failed" | "partial";
  prompt: string | null;
}
