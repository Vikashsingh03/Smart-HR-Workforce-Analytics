import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ActionRow,
  AiExplainResult,
  EmployeeDetail,
  EmployeeRow,
  HealthStatus,
  MatrixRow,
  NlToSqlResult,
  PagedResult,
  RateRow,
  SatisfactionRow,
  Summary,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${this.baseUrl}/health`);
  }

  getSummary(): Observable<Summary> {
    return this.http.get<Summary>(`${this.baseUrl}/analytics/summary`);
  }

  getAttritionByDepartment(): Observable<RateRow[]> {
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/attrition-by-department`);
  }

  getOvertime(byDepartment?: boolean): Observable<RateRow[]> {
    let params = new HttpParams();
    if (byDepartment !== undefined) {
      params = params.set('byDepartment', String(byDepartment));
    }
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/overtime`, { params });
  }

  getAttritionByRole(): Observable<RateRow[]> {
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/attrition-by-role`);
  }

  getSatisfaction(): Observable<SatisfactionRow[]> {
    return this.http.get<SatisfactionRow[]>(`${this.baseUrl}/analytics/satisfaction`);
  }

  getTenure(): Observable<RateRow[]> {
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/tenure`);
  }

  getIncome(byDepartment?: boolean): Observable<RateRow[]> {
    let params = new HttpParams();
    if (byDepartment !== undefined) {
      params = params.set('byDepartment', String(byDepartment));
    }
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/income`, { params });
  }

  getActionFirst(): Observable<ActionRow[]> {
    return this.http.get<ActionRow[]>(`${this.baseUrl}/analytics/action-first`);
  }

  getEmployees(params: {
    search?: string;
    department?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PagedResult<EmployeeRow>> {
    let httpParams = new HttpParams();
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.department) {
      httpParams = httpParams.set('department', params.department);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.pageSize !== undefined) {
      httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    return this.http.get<PagedResult<EmployeeRow>>(`${this.baseUrl}/employees`, {
      params: httpParams,
    });
  }

  explainAi(body: {
    title: string;
    facts: { label: string; value: string | number }[];
  }): Observable<AiExplainResult> {
    return this.http.post<AiExplainResult>(`${this.baseUrl}/ai/explain`, body);
  }

  askAi(body: { question: string }): Observable<NlToSqlResult> {
    return this.http.post<NlToSqlResult>(`${this.baseUrl}/ai/ask`, body);
  }

  getAgeBands(): Observable<RateRow[]> {
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/age-bands`);
  }

  getDistanceBands(): Observable<RateRow[]> {
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/distance`);
  }

  getJobLevel(): Observable<RateRow[]> {
    return this.http.get<RateRow[]>(`${this.baseUrl}/analytics/job-level`);
  }

  getDepartmentRoleMatrix(): Observable<MatrixRow[]> {
    return this.http.get<MatrixRow[]>(`${this.baseUrl}/analytics/department-role-matrix`);
  }

  getEmployeeDetail(employeeNumber: number): Observable<EmployeeDetail> {
    return this.http.get<EmployeeDetail>(`${this.baseUrl}/employees/${employeeNumber}`);
  }
}
