import { supabase } from './supabase.service';
import { User } from '../models';

export class AuthService {
    private static instance: AuthService;

    private constructor() {
        // ApiService is no longer needed here.
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    public async getCurrentUser(): Promise<User | null> {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('Error getting session:', sessionError.message);
            return null;
        }

        if (session?.user) {
            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single();

            if (profileError) {
                console.error('Error fetching user profile for session:', profileError.message);
                // If profile is not found, the user is in an inconsistent state. Log them out.
                await this.logout();
                return null;
            }

            return userProfile as User;
        }

        return null;
    }

    public async login(email: string, password: string): Promise<User | null> {
        const { data: { user: authUser }, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Supabase login error:', error.message);
            return null;
        }

        if (authUser) {
            // The README implies the 'users' table is linked by email.
            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('email', authUser.email)
                .single();

            if (profileError) {
                console.error('Error fetching user profile:', profileError.message);
                // Log out user if profile not found to prevent being in a broken state
                await this.logout();
                return null;
            }
            
            return userProfile as User;
        }
        
        return null;
    }

    public async logout(): Promise<void> {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Supabase logout error:', error);
        }
    }
}
