import { User, Transaction } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { createTable } from '../components/Table';
import { formatAmount, formatDate } from '../utils/formatters';

// Chart.js is loaded globally, declare it to satisfy TypeScript
declare const Chart: any;

function renderCommissionChart(canvasId: string, labels: string[], data: number[]) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart instance if it exists
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Commissions Gagnées',
                data: data,
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                borderColor: 'rgba(124, 58, 237, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: 'rgba(124, 58, 237, 1)',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value: number) => formatAmount(value)
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => `${context.dataset.label}: ${formatAmount(context.raw)}`
                    }
                }
            }
        }
    });
}


export async function renderPartnerCommissionsView(user: User): Promise<HTMLElement> {
    if (!user.partnerId) {
        return createCard('Erreur', '<p>Partenaire non identifié.</p>', 'fa-exclamation-triangle');
    }

    const dataService = DataService.getInstance();
    const [allTransactions, allUsers, opTypeMap] = await Promise.all([
        dataService.getTransactions(),
        dataService.getUsers(),
        dataService.getOpTypeMap()
    ]);

    const partnerAgents = allUsers.filter(u => u.partnerId === user.partnerId);
    const agentIds = partnerAgents.map(a => a.id);
    const partnerTransactions = allTransactions
        .filter(t => agentIds.includes(t.agentId) && t.statut === 'Validé')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // --- KPI Calculations ---
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTransactions = partnerTransactions.filter(t => new Date(t.date) >= startOfMonth);

    const totalCommissionsMonth = monthlyTransactions.reduce((sum, tx) => sum + tx.commission_partenaire, 0);
    const totalVolumeMonth = monthlyTransactions.reduce((sum, tx) => sum + tx.montant_principal, 0);

    const commissionsByAgent = monthlyTransactions.reduce((acc, tx) => {
        acc[tx.agentId] = (acc[tx.agentId] || 0) + tx.commission_partenaire;
        return acc;
    }, {} as Record<string, number>);

    const topAgentId = Object.keys(commissionsByAgent).sort((a, b) => commissionsByAgent[b] - commissionsByAgent[a])[0];
    const topAgent = allUsers.find(u => u.id === topAgentId);

    const commissionsByService = monthlyTransactions.reduce((acc, tx) => {
        const opType = opTypeMap.get(tx.opTypeId);
        if (opType) {
            acc[opType.name] = (acc[opType.name] || 0) + tx.commission_partenaire;
        }
        return acc;
    }, {} as Record<string, number>);
    
    const topService = Object.keys(commissionsByService).sort((a, b) => commissionsByService[b] - commissionsByService[a])[0];

    // --- Chart Data Calculation ---
    const last7Days: { date: string; total: number }[] = [];
    const dailyCommissions = new Map<string, number>();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        dailyCommissions.set(dateString, 0);
    }
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    
    partnerTransactions
        .filter(t => new Date(t.date) >= sevenDaysAgo)
        .forEach(tx => {
            const dateString = tx.date.split('T')[0];
            if (dailyCommissions.has(dateString)) {
                dailyCommissions.set(dateString, dailyCommissions.get(dateString)! + tx.commission_partenaire);
            }
        });

    const chartLabels = Array.from(dailyCommissions.keys()).map(d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    const chartData = Array.from(dailyCommissions.values());


    const container = document.createElement('div');
    container.className = 'space-y-6';

    // KPI Cards
    const kpiGrid = document.createElement('div');
    kpiGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6';
    kpiGrid.innerHTML = `
        <div class="card p-4">
            <p class="text-sm text-slate-500">Total Commissions (Mois)</p>
            <p class="text-3xl font-bold text-emerald-600">${formatAmount(totalCommissionsMonth)}</p>
        </div>
        <div class="card p-4">
            <p class="text-sm text-slate-500">Volume d'Affaires (Mois)</p>
            <p class="text-3xl font-bold text-slate-800">${formatAmount(totalVolumeMonth)}</p>
        </div>
        <div class="card p-4">
            <p class="text-sm text-slate-500">Meilleur Agent (Mois)</p>
            <p class="text-2xl font-bold text-slate-800">${topAgent?.name || 'N/A'}</p>
        </div>
        <div class="card p-4">
            <p class="text-sm text-slate-500">Service le Plus Rentable</p>
            <p class="text-2xl font-bold text-slate-800">${topService || 'N/A'}</p>
        </div>
    `;
    container.appendChild(kpiGrid);
    
    // Chart Card
    const chartCardContent = document.createElement('div');
    chartCardContent.className = 'relative h-80';
    chartCardContent.innerHTML = `<canvas id="partnerCommissionChart"></canvas>`;
    const chartCard = createCard('Commissions des 7 derniers jours', chartCardContent, 'fa-chart-line');
    container.appendChild(chartCard);
    
    // Recent commissions table
    const recentCommissions = partnerTransactions.slice(0, 20);
    const rowsData = recentCommissions.map(tx => {
        const agent = allUsers.find(u => u.id === tx.agentId);
        const opType = opTypeMap.get(tx.opTypeId);
        return [
            formatDate(tx.date),
            agent?.name || 'N/A',
            opType?.name || 'N/A',
            formatAmount(tx.montant_principal),
            `<span class="font-semibold text-emerald-600">${formatAmount(tx.commission_partenaire)}</span>`
        ];
    });

    const table = createTable(
        ['Date', 'Agent', 'Opération', 'Montant', 'Ma Commission'],
        rowsData
    );

    const tableCard = createCard('Détail des Dernières Commissions Reçues', table, 'fa-coins');
    container.appendChild(tableCard);

    // Defer chart rendering until the element is in the DOM
    setTimeout(() => {
        renderCommissionChart('partnerCommissionChart', chartLabels, chartData);
    }, 0);

    return container;
}
