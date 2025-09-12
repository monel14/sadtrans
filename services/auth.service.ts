import { ApiService } from './api.service';
import { User } from '../models';

export class AuthService {
    private api: ApiService;
    private static instance: AuthService;

    private constructor() {
        this.api = ApiService.getInstance();
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    public async login(email: string): Promise<User | null> {
        const users = await this.api.getUsers();
        
        // Find user by email, ignoring case. In a real app, you would also validate the password.
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        return user || null;
    }
}
