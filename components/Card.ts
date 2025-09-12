
export function createCard(
    title: string, 
    content: string | HTMLElement, 
    iconClass: string = 'fa-info-circle', 
    cardClasses: string = 'mb-6'
): HTMLElement {
    const card = document.createElement('div');
    card.className = `card ${cardClasses}`;

    const titleElement = document.createElement('h3');
    titleElement.className = 'text-lg font-semibold text-slate-800 mb-4 flex items-center';
    titleElement.innerHTML = `<i class="fas ${iconClass} mr-3 text-violet-500"></i>${title}`;

    card.appendChild(titleElement);

    if (typeof content === 'string') {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = content;
        card.appendChild(contentDiv);
    } else {
        card.appendChild(content);
    }

    return card;
}
