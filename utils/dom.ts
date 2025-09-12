export function $<T extends HTMLElement>(selector: string, parent: Document | HTMLElement = document): T | null {
    return parent.querySelector<T>(selector);
}
