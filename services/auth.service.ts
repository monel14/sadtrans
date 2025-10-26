import { supabase } from './supabase.service';
import { User } from '../models';

export class AuthService {
    private static instance: AuthService;
    private currentUser: User | null = null;
    private sessionRefreshedCallback: (() => void) | null = null;

    private constructor() {
        // ApiService is no longer needed here.
        this.setupAuthStateListener();
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    // Configuration de l'écouteur d'état d'authentification
    private setupAuthStateListener() {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            
            switch (event) {
                case 'SIGNED_IN':
                    // La session a été établie ou rétablie
                    console.log('User signed in or session re-established');
                    break;
                    
                case 'SIGNED_OUT':
                    // L'utilisateur s'est déconnecté
                    console.log('User signed out');
                    this.currentUser = null;
                    break;
                    
                case 'TOKEN_REFRESHED':
                    // Les tokens ont été rafraîchis
                    console.log('Session tokens refreshed');
                    if (this.sessionRefreshedCallback) {
                        this.sessionRefreshedCallback();
                    }
                    break;
                    
                case 'USER_UPDATED':
                    // Les informations utilisateur ont été mises à jour
                    console.log('User profile updated');
                    break;
                    
                case 'INITIAL_SESSION':
                    // Session initiale chargée depuis le stockage
                    console.log('Initial session loaded from storage');
                    break;
            }
        });
    }

    // Définir un callback pour être notifié lorsque la session est rafraîchie
    public setSessionRefreshedCallback(callback: () => void) {
        this.sessionRefreshedCallback = callback;
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

            // Check if user is suspended
            if (userProfile.status === 'suspended' || userProfile.status === 'inactive') {
                console.log('User account is suspended or inactive, logging out');
                await this.logout();
                return null;
            }

            // Map snake_case to camelCase to match User interface
            // FIX: Removed deprecated 'solde' and 'solde_revenus' properties. Balances are managed at the agency level.
            this.currentUser = {
                id: userProfile.id,
                name: userProfile.name,
                firstName: userProfile.first_name,
                lastName: userProfile.last_name,
                email: userProfile.email,
                role: userProfile.role,
                avatarSeed: userProfile.avatar_seed,
                status: userProfile.status,
                partnerId: userProfile.partner_id,
                agencyId: userProfile.agency_id,
                commissions_mois_estimees: userProfile.commissions_mois_estimees,
                commissions_dues: userProfile.commissions_dues,
                volume_partner_mois: userProfile.volume_partner_mois,
                commissions_partner_mois: userProfile.commissions_partner_mois,
                agents_actifs: userProfile.agents_actifs,
                phone: userProfile.phone,
                contactPerson: userProfile.contact_person,
                agencyName: userProfile.agency_name,
                idCardNumber: userProfile.id_card_number,
                ifu: userProfile.ifu,
                rccm: userProfile.rccm,
                address: userProfile.address,
                idCardImageUrl: userProfile.id_card_image_url
            } as User;
            
            return this.currentUser;
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

            // Check if user is suspended or inactive
            if (userProfile.status === 'suspended' || userProfile.status === 'inactive') {
                console.log('User account is suspended or inactive, login denied');
                await this.logout();
                // Throw a specific error for suspended accounts
                throw new Error(`ACCOUNT_${userProfile.status.toUpperCase()}`);
            }
            
            // Map snake_case to camelCase to match User interface
            // FIX: Removed deprecated 'solde' and 'solde_revenus' properties. Balances are managed at the agency level.
            this.currentUser = {
                id: userProfile.id,
                name: userProfile.name,
                firstName: userProfile.first_name,
                lastName: userProfile.last_name,
                email: userProfile.email,
                role: userProfile.role,
                avatarSeed: userProfile.avatar_seed,
                status: userProfile.status,
                partnerId: userProfile.partner_id,
                agencyId: userProfile.agency_id,
                commissions_mois_estimees: userProfile.commissions_mois_estimees,
                commissions_dues: userProfile.commissions_dues,
                volume_partner_mois: userProfile.volume_partner_mois,
                commissions_partner_mois: userProfile.commissions_partner_mois,
                agents_actifs: userProfile.agents_actifs,
                phone: userProfile.phone,
                contactPerson: userProfile.contact_person,
                agencyName: userProfile.agency_name,
                idCardNumber: userProfile.id_card_number,
                ifu: userProfile.ifu,
                rccm: userProfile.rccm,
                address: userProfile.address,
                idCardImageUrl: userProfile.id_card_image_url
            } as User;
            
            return this.currentUser;
        }
        
        return null;
    }

    public async logout(): Promise<void> {
        console.log('🔐 Logging out from AuthService...');
        
        // Nettoyer l'état local
        this.currentUser = null;
        
        // Déconnexion Supabase
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('❌ Supabase logout error:', error);
        } else {
            console.log('✅ Supabase logout successful');
        }
    }
    
    // Méthode pour vérifier si la session est valide
    public async isSessionValid(): Promise<boolean> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            return !!session?.user;
        } catch (error) {
            console.error('Error checking session validity:', error);
            return false;
        }
    }
    
    // Méthode pour rafraîchir manuellement la session si nécessaire
    public async refreshSession(): Promise<boolean> {
        try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
                console.error('Error refreshing session:', error);
                return false;
            }
            return !!data.session;
        } catch (error) {
            console.error('Error during session refresh:', error);
            return false;
        }
    }
}