import { User, Transaction, Partner, OperationType } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';
import { createTable } from '../components/Table';

// Chart.js is loaded globally from index.html, we can declare it to satisfy TypeScript
declare const Chart: any;

function renderChart(canvasId: string, type: 'line' | 'doughnut', labels: string[], datasets: { label: string, data: number[], backgroundColor?: string[] | string, borderColor?: string, borderWidth?: number, fill?: boolean, tension?: number }[]) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart instance if it exists to prevent flickering on re-render
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }

    new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: type === 'doughnut' ? 'right' : 'top',
                },
            },
            scales: type === 'line' ? {
                y: {
                    beginAtZero: true
                }
            } : undefined
        }
    });
}

export async function renderAdminRevenueDashboardView(user: User): Promise<HTMLElement> {
    const api = ApiService.getInstance(); // Keep for stats calculation
    const dataService = DataService.getInstance();
    
    const [stats, userMap, partnerMap, opTypeMap] = await Promise.all([
        api.getCompanyRevenueStats(),
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getOpTypeMap()
    ]);

    const { totalRevenue, revenueByPartner, revenueByCategory, revenueTrend, latestCommissions } = stats;
    const topService = Object.entries(revenueByCategory).sort(([, a], [, b]) => (b as number) - (a as number))[0];

    const container = document.createElement('div');
    container.innerHTML = `
        <!-- KPIs Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div class="card p-4">
                <p class="text-sm text-slate-500">Revenus Société (Total Validé)</p>
                <p class="text-3xl font-bold text-emerald-600">${formatAmount(totalRevenue)}</p>
            </div>
            <div class="card p-4">
                <p class="text-sm text-slate-500">Partenaire le Plus Rentable (pour la société)</p>
                <p class="text-2xl font-bold text-slate-800">${revenueByPartner[0]?.name || 'N/A'}</p>
                <p class="text-sm font-semibold text-slate-600">${formatAmount(revenueByPartner[0]?.total)}</p>
            </div>
            <div class="card p-4">
                <p class="text-sm text-slate-500">Service le Plus Rentable (pour la société)</p>
                <p class="text-2xl font-bold text-slate-800">${topService ? topService[0] : 'N/A'}</p>
                 <p class="text-sm font-semibold text-slate-600">${formatAmount(topService ? topService[1] as number : 0)}</p>
            </div>
        </div>

        <!-- Charts Row -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            <div class="lg:col-span-3 card h-96">
                <h3 class="font-semibold mb-4 text-slate-800">Tendance des Revenus Société (30 derniers jours)</h3>
                <div class="relative h-80">
                    <canvas id="revenueTrendChart"></canvas>
                </div>
            </div>
            <div class="lg:col-span-2 card h-96">
                <h3 class="font-semibold mb-4 text-slate-800">Répartition des Revenus Société par Service</h3>
                 <div class="relative h-80">
                    <canvas id="revenueByCategoryChart"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Details Row -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1" id="topPartnersCardContainer"></div>
            <div class="lg:col-span-2" id="latestCommissionsCardContainer"></div>
        </div>
    `;

    // Top Partners Card
    const topPartnersContent = document.createElement('div');
    const topPartnersList = document.createElement('ul');
    topPartnersList.className = 'space-y-3';
    revenueByPartner.slice(0, 5).forEach((partner: {name: string, total: number}, index: number) => {
        const li = document.createElement('li');
        li.className = 'flex items-center';
        li.innerHTML = `
            <span class="font-bold text-slate-500 w-8">${index + 1}.</span>
            <span class="flex-grow font-semibold text-slate-700">${partner.name}</span>
            <span class="font-bold text-slate-800">${formatAmount(partner.total)}</span>
        `;
        topPartnersList.appendChild(li);
    });
    topPartnersContent.appendChild(topPartnersList);
    const topPartnersCard = createCard('Top 5 Partenaires (Revenus Société)', topPartnersContent, 'fa-trophy');
    container.querySelector('#topPartnersCardContainer')?.appendChild(topPartnersCard);
    
    // Latest Commissions Table Card
    const latestCommissionsData = (latestCommissions as Transaction[]).map(t => {
        const agent = userMap.get(t.agentId);
        const partner = agent ? partnerMap.get(agent.partnerId!) : null;
        const opType = opTypeMap.get(t.opTypeId);
        return [
            formatDate(t.date),
            opType?.name || 'N/A',
            agent?.name || 'N/A',
            partner?.name || 'N/A',
            `<span class="font-semibold text-emerald-600">${formatAmount(t.commission_societe)}</span>`
        ];
    });
    const latestCommissionsTable = createTable(
        ['Date', 'Opération', 'Agent', 'Partenaire', 'Commission Société'],
        latestCommissionsData
    );
    const latestCommissionsCard = createCard('Dernières Commissions Encaissées par la Société', latestCommissionsTable, 'fa-receipt');
    container.querySelector('#latestCommissionsCardContainer')?.appendChild(latestCommissionsCard);

    // Defer chart rendering until the element is in the DOM
    setTimeout(() => {
        // Render Trend Chart
        const trendLabels = Object.keys(revenueTrend).map(d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        const trendData = Object.values(revenueTrend);
        renderChart('revenueTrendChart', 'line', trendLabels, [{
            label: 'Revenus Quotidiens (Société)',
            data: trendData as number[],
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            borderColor: 'rgba(124, 58, 237, 1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
        }]);

        // Render Category Chart
        const categoryLabels = Object.keys(revenueByCategory);
        const categoryData = Object.values(revenueByCategory);
        renderChart('revenueByCategoryChart', 'doughnut', categoryLabels, [{
            label: 'Revenus Société',
            data: categoryData as number[],
            backgroundColor: [
                '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4',
                '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'
            ]
        }]);
    }, 0);

    return container;
}