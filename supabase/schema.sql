-- ============================================
-- DubLK Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Profiles Table (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Movies Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.movies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tmdb_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  genres TEXT[] DEFAULT '{}',
  rating NUMERIC(3,1) DEFAULT 0,
  release_year INTEGER,
  runtime INTEGER,
  free_servers JSONB DEFAULT '[]'::jsonb,
  vip_servers JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_movies_slug ON public.movies(slug);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON public.movies(tmdb_id);

-- ============================================
-- Purchases Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  movie_id UUID REFERENCES public.movies(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('single', 'full')) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  payment_method TEXT,
  payment_proof_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user purchase lookups
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);

-- ============================================
-- Row Level Security
-- ============================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Movies
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published movies are viewable by everyone"
  ON public.movies FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can do everything with movies"
  ON public.movies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchases"
  ON public.purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update purchases"
  ON public.purchases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================
-- Storage Bucket for Payment Proofs
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Admins can view payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================
-- Coming Soon Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.coming_soon (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('movie', 'tv')) DEFAULT 'movie',
  poster_url TEXT NOT NULL,
  backdrop_url TEXT,
  description TEXT,
  release_date TEXT,
  genres TEXT[] DEFAULT '{}',
  rating NUMERIC(3,1) DEFAULT 0,
  tmdb_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coming_soon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public coming_soon items are viewable by everyone"
  ON public.coming_soon FOR SELECT
  USING (true);

CREATE POLICY "Admins can do everything with coming_soon"
  ON public.coming_soon FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.role IN ('admin', 'editor', 'moderator'))
    )
  );

