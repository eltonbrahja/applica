-- Supabase Database Setup for Applica
-- Execute this script in your Supabase SQL Editor

-- 1. Create Tables
CREATE TABLE public.psychologists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    supabase_tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    anon_name TEXT NOT NULL,
    notes TEXT, -- This will be encrypted by the client before insertion
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, cancelled
    type TEXT NOT NULL DEFAULT 'session', -- session, first-visit, follow-up, assessment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.psychologists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Psychologists can only see their own profile
CREATE POLICY "Psychologists can view and edit their own profile" 
    ON public.psychologists 
    FOR ALL 
    USING (supabase_tenant_id = auth.uid());

-- Patients: Psychologists can only access patients belonging to them
CREATE POLICY "Psychologists can access their own patients" 
    ON public.patients 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

-- Appointments: Psychologists can only access their own appointments
CREATE POLICY "Psychologists can access their own appointments" 
    ON public.appointments 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

-- Invoices: Psychologists can only access their own invoices
CREATE POLICY "Psychologists can access their own invoices" 
    ON public.invoices 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

-- Materials: Psychologists can only access their own materials
CREATE POLICY "Psychologists can access their own materials" 
    ON public.materials 
    FOR ALL 
    USING (psychologist_id IN (
        SELECT id FROM public.psychologists WHERE supabase_tenant_id = auth.uid()
    ));

-- 4. Set up Supabase Storage (Required for Invoices and Materials)
-- Make sure to create buckets named 'invoices' and 'materials' in the Supabase Dashboard
-- and apply similar RLS policies to them using auth.uid() to restrict path access.

-- 5. Helper Functions (Optional but recommended)
-- Function to automatically create a psychologist profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.psychologists (email, supabase_tenant_id)
  VALUES (new.email, new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after a user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
