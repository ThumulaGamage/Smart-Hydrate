// config/profileImageService.js
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://axdavhzpencifcsivpej.supabase.co';
const supabaseKey =  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4ZGF2aHpwZW5jaWZjc2l2cGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMzI5NDUsImV4cCI6MjA3MzYwODk0NX0.tWXJT5I9XjHYZ9mwtETDpr9UE8jm_0v3LwgE94PakKM';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

