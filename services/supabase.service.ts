/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { createClient } from '@supabase/supabase-js';

// Using hardcoded keys as process.env is not available in this environment.
const supabaseUrl = 'https://fmdefcgenhfesdxozvxz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtZGVmY2dlbmhmZXNkeG96dnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MTcxMDAsImV4cCI6MjA3MzI5MzEwMH0.2pyTKB0htoXWsN59gKoNXc0uaY7Ig1T9QdalkQLsRSY';

if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = "Supabase URL and Anon Key are not configured.";
    console.error(errorMsg);
    // This block should ideally not be reached now.
    throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
