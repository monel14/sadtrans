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

            // Map snake_case to camelCase to match User interface
            return {
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
                solde: userProfile.solde,
                commissions_mois_estimees: userProfile.commissions_mois_estimees,
                commissions_dues: userProfile.commissions_dues,
                solde_revenus: userProfile.solde_revenus,
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
            
            // Map snake_case to camelCase to match User interface
            return {
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
                solde: userProfile.solde,
                commissions_mois_estimees: userProfile.commissions_mois_estimees,
                commissions_dues: userProfile.commissions_dues,
                solde_revenus: userProfile.solde_revenus,
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
