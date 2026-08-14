CREATE TABLE public."Support_Ticket" (
    "ticketId" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "userId" uuid NOT NULL REFERENCES public."User"("userId") ON DELETE CASCADE,
    "subject" text NOT NULL,
    "description" text NOT NULL,
    "status" text NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'RESOLVED', 'CLOSED')),
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);

-- Bật Row Level Security (nếu hệ thống của bạn đang dùng)
ALTER TABLE public."Support_Ticket" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for backend" ON public."Support_Ticket" FOR ALL USING (true);