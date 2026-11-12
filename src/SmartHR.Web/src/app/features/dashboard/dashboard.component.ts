import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiRowComponent } from './kpi-row/kpi-row.component';
import { ExecutiveSummaryComponent } from './executive-summary/executive-summary.component';
import { ChartsDeptComponent } from './charts-dept/charts-dept.component';
import { ChartsDriversComponent } from './charts-drivers/charts-drivers.component';
import { HeatmapInsightsComponent } from './heatmap-insights/heatmap-insights.component';
import { DistributionsComponent } from './distributions/distributions.component';
import { ActionTableComponent } from './action-table/action-table.component';

/**
 * Dashboard shell (v2). This component only composes the seven dashboard
 * sections in order and gives each one a section header. Every section
 * fetches its own data from the API — the shell passes no inputs.
 *
 * Order: KPI row, executive summary, department charts (Q1–Q3), driver
 * charts (Q4–Q6), department x role heatmap + findings, distributions,
 * action table (Q7).
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    KpiRowComponent,
    ExecutiveSummaryComponent,
    ChartsDeptComponent,
    ChartsDriversComponent,
    HeatmapInsightsComponent,
    DistributionsComponent,
    ActionTableComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {}
