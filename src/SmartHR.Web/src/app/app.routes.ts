import { Routes } from '@angular/router';

import { AiAssistantComponent } from './features/ai-assistant/ai-assistant.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { EmployeesComponent } from './features/employees/employees.component';
import { InsightsComponent } from './features/insights/insights.component';
import { ReportsComponent } from './features/reports/reports.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'employees', component: EmployeesComponent },
  { path: 'ai', component: AiAssistantComponent },
  { path: 'insights', component: InsightsComponent },
  { path: 'reports', component: ReportsComponent },
  { path: '**', redirectTo: '' },
];
