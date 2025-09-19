import { AuthService } from '../services/auth.service';

export function renderLoginPage(): HTMLElement {
    const page = document.createElement('div');
    page.id = 'loginPage';
    page.className = 'min-h-screen flex items-center justify-center bg-gray-900 bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 p-4';

    const defaultEmailForDemo = 'agent@example.com';
    const defaultPasswordForDemo = 'Password123!';
    
    page.innerHTML = `
        <div class="bg-slate-800/60 backdrop-blur-lg border border-slate-700 p-8 sm:p-12 rounded-2xl w-full max-w-md shadow-2xl shadow-slate-900/50">
            <div class="text-center mb-8">
                <i class="fas fa-shield-alt text-5xl text-violet-400"></i>
                <h1 class="text-3xl font-bold text-slate-100 mt-4">SadTrans</h1>
                <p class="text-slate-400">Plateforme de services financiers</p>
            </div>
            <form id="loginForm">
                 <div class="mb-6">
                    <label for="email" class="form-label text-slate-300">Adresse Email</label>
                    <input type="email" id="email" class="form-input bg-slate-700 text-white border-slate-600 placeholder-slate-400 focus:ring-violet-500 focus:border-violet-500" placeholder="votreadresse@email.com" value="${defaultEmailForDemo}" autocomplete="email" required>
                    <p class="text-xs text-slate-500 mt-2">Emails de démo: admin.adam@example.com, partner.patrice@example.com, agent.alice@example.com, dev@example.com</p>
                </div>
                <div class="mb-6">
                    <label for="password" class="form-label text-slate-300">Mot de passe</label>
                    <input type="password" id="password" class="form-input bg-slate-700 text-white border-slate-600 placeholder-slate-400 focus:ring-violet-500 focus:border-violet-500" placeholder="********" value="${defaultPasswordForDemo}" autocomplete="current-password" required>
                    <p class="text-xs text-slate-500 mt-2">Le mot de passe par défaut est: <strong class="text-violet-300">${defaultPasswordForDemo}</strong>. Assurez-vous que les utilisateurs de démo sont créés dans votre projet Supabase avec ce mot de passe.</p>
                </div>
                <button type="submit" class="btn btn-primary w-full text-lg bg-violet-600 hover:bg-violet-700">
                    <i class="fas fa-sign-in-alt mr-2"></i>Se connecter
                </button>
            </form>
            <p class="text-center text-sm text-slate-500 mt-6">
                Mot de passe oublié ? <a href="#" class="text-violet-400 hover:underline">Réinitialiser</a>
            </p>
        </div>
    `;

    const form = page.querySelector('#loginForm') as HTMLFormElement;
    const emailInput = page.querySelector('#email') as HTMLInputElement;
    const passwordInput = page.querySelector('#password') as HTMLInputElement;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = page.querySelector('button[type="submit"]') as HTMLButtonElement;

        const originalButtonHtml = submitButton.innerHTML;
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Connexion...`;
        submitButton.disabled = true;

        try {
            const authService = AuthService.getInstance();
            const user = await authService.login(emailInput.value, passwordInput.value);

            if (user) {
                page.dispatchEvent(new CustomEvent('loginSuccess', {
                    detail: { user },
                    bubbles: true,
                    composed: true
                }));
            } else {
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Email ou mot de passe incorrect.', type: 'error' }
                }));
                submitButton.innerHTML = originalButtonHtml;
                submitButton.disabled = false;
            }
        } catch (error) {
            let errorMessage = 'Email ou mot de passe incorrect.';
            
            if (error instanceof Error) {
                if (error.message === 'ACCOUNT_SUSPENDED') {
                    errorMessage = 'Votre compte a été suspendu. Contactez un administrateur.';
                } else if (error.message === 'ACCOUNT_INACTIVE') {
                    errorMessage = 'Votre compte est inactif. Contactez un administrateur.';
                }
            }
            
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: errorMessage, type: 'error' }
            }));
            submitButton.innerHTML = originalButtonHtml;
            submitButton.disabled = false;
        }
    });

    return page;
}