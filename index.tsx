/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { App } from './app';
import { pwaService } from './services/pwa.service';

document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('app');
    if (rootElement) {
        const app = new App(rootElement);
        app.init();
        
        // Initialiser le service PWA
        pwaService.createInstallButton();
    } else {
        console.error("Root element #app not found.");
    }
});
