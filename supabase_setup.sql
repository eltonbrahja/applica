-- Supabase Database Setup for Applica
-- Execute this script in your Supabase SQL Editor

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.psychologists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    supabase_tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    specialization TEXT,
    license_number TEXT,
    studio_name TEXT,
    studio_address TEXT,
    working_hours JSONB DEFAULT '{
        "monday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
        "tuesday":   {"enabled": true,  "start": "09:00", "end": "18:00"},
        "wednesday": {"enabled": true,  "start": "09:00", "end": "18:00"},
        "thursday":  {"enabled": true,  "start": "09:00", "end": "18:00"},
        "friday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
        "saturday":  {"enabled": false, "start": "09:00", "end": "13:00"},
        "sunday":    {"enabled": false, "start": "09:00", "end": "13:00"}
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    anon_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    fiscal_code TEXT,
    gender TEXT,
    address TEXT,
    emergency_contact TEXT,
    therapy_type TEXT,
    session_frequency TEXT,
    start_date DATE,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'confirmed',
    type TEXT NOT NULL DEFAULT 'session',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.psychologist_vacation_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(psychologist_id, date)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.psychologists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychologist_vacation_dates ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
CREATE POLICY "Psychologists can view and edit their own profile" 
    ON public.psychologists 
    FOR ALL 
    USING (supabase_tenant_id = auth.uid());

CREATE POLICY "Psychologists can access their own patients" 
    ON public.patients 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

CREATE POLICY "Psychologists can access their own appointments" 
    ON public.appointments 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

CREATE POLICY "Psychologists can access their own invoices" 
    ON public.invoices 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

CREATE POLICY "Psychologists can access their own materials" 
    ON public.materials 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

CREATE POLICY "Psychologists can manage their own vacation dates"
    ON public.psychologist_vacation_dates
    FOR ALL
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

-- 4. Helper Functions
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.psychologists (email, supabase_tenant_id)
  VALUES (new.email, new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Migration for existing databases (safe to run multiple times)
-- Add new columns to psychologists if they don't exist
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS studio_name TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS studio_address TEXT;
ALTER TABLE public.psychologists ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
    "monday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
    "tuesday":   {"enabled": true,  "start": "09:00", "end": "18:00"},
    "wednesday": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "thursday":  {"enabled": true,  "start": "09:00", "end": "18:00"},
    "friday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
    "saturday":  {"enabled": false, "start": "09:00", "end": "13:00"},
    "sunday":    {"enabled": false, "start": "09:00", "end": "13:00"}
}'::jsonb;

-- Add new columns to patients if they don't exist
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS fiscal_code TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS therapy_type TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS session_frequency TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
