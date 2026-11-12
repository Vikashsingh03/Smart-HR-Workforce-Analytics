export interface HealthStatus {
  status: string;
  rows: number;
  provider: string;
}

export interface Summary {
  totalEmployees: number;
  attritionCount: number;
  attritionRate: number;
  departmentCount: number;
  avgMonthlyIncome: number;
}

export interface RateRow {
  group: string;
  total: number;
  left: number;
  rate: number;
}

export interface SatisfactionRow {
  attrition: number;
  avgJobSatisfaction: number;
  avgEnvironmentSatisfaction: number;
  avgRelationshipSatisfaction: number;
  avgWorkLifeBalance: number;
  headcount: number;
}

export interface ActionRow {
  department: string;
  jobRole: string;
  total: number;
  left: number;
  rate: number;
}

export interface EmployeeRow {
  employeeNumber: number;
  age: number;
  gender: string;
  department: string;
  jobRole: string;
  monthlyIncome: number;
  yearsAtCompany: number;
  attrition: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AiExplainResult {
  explanation: string;
  action: string;
  source: string;
}

export interface NlToSqlResult {
  sql?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  source: string;
  blockedReason?: string;
}

export interface MatrixRow {
  department: string;
  jobRole: string;
  total: number;
  left: number;
  rate: number;
}

export interface EmployeeDetail {
  employeeNumber: number;
  age: number;
  gender: string;
  department: string;
  jobRole: string;
  education: number;
  educationField: string;
  maritalStatus: string;
  businessTravel: string;
  distanceFromHome: number;
  monthlyIncome: number;
  dailyRate: number;
  hourlyRate: number;
  monthlyRate: number;
  percentSalaryHike: number;
  overTime: number;
  yearsAtCompany: number;
  yearsInCurrentRole: number;
  yearsSinceLastPromotion: number;
  yearsWithCurrManager: number;
  totalWorkingYears: number;
  numCompaniesWorked: number;
  jobLevel: number;
  stockOptionLevel: number;
  trainingTimesLastYear: number;
  jobInvolvement: number;
  performanceRating: number;
  environmentSatisfaction: number;
  jobSatisfaction: number;
  relationshipSatisfaction: number;
  workLifeBalance: number;
  satisfactionScore: number;
  tenureBand: string;
  incomeBand: string;
  attrition: number;
}
