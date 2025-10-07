/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { App } from './app';

document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('app');
    if (rootElement) {
        const app = new App(rootElement);
        app.init();
    } else {
        console.error("Root element #app not found.");
    }
});
