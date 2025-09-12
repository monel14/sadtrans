
export function renderFooter(): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = 'app-footer md:ml-64';

    footer.innerHTML = `
        <p>&copy; ${new Date().getFullYear()} SadTrans. Tous droits réservés.</p>
        <p class="mt-1">
            <a href="#">Aide</a> | 
            <a href="#">Support Technique</a> | 
            <a href="#">Politique de Confidentialité</a>
        </p>
    `;

    return footer;
}