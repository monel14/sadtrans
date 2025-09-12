

export function createTable(
    headers: string[], 
    rowsData: (string | number | null)[][], 
    caption: string = "", 
    tableClasses: string = "w-full table"
): HTMLElement {
    const container = document.createElement('div');
    container.className = 'table-wrapper';

    if (caption) {
        const captionEl = document.createElement('p');
        captionEl.className = 'text-sm text-gray-600 mb-2 px-4 pt-4';
        captionEl.textContent = caption;
        container.appendChild(captionEl);
    }
    
    const table = document.createElement('table');
    table.className = tableClasses;

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.innerHTML = headerText; // Use innerHTML to allow for checkboxes, etc.
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    if (rowsData.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = headers.length;
        td.className = 'text-center text-gray-500 py-8';
        td.textContent = 'Aucune donnée disponible.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        rowsData.forEach(rowData => {
            const tr = document.createElement('tr');
            rowData.forEach((cellData, index) => {
                const td = document.createElement('td');
                const headerText = (headers[index] || '').replace(/<[^>]*>?/gm, '');
                td.setAttribute('data-label', headerText);
                
                if (typeof cellData === 'string' && (cellData.startsWith('<') || cellData.includes('&'))) {
                    td.innerHTML = cellData; // Allow HTML content for buttons, badges
                } else {
                    td.textContent = cellData?.toString() || '-';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);

    return container;
}