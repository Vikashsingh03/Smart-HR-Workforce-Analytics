using Microsoft.EntityFrameworkCore;
using SmartHR.Core.Entities;

namespace SmartHR.Core;

/// <summary>
/// Entity Framework Core context for Smart HR Workforce Analytics.
/// Table and column names are snake_case, exactly as in sql/queries.sql,
/// and are identical on PostgreSQL and SQLite.
/// </summary>
public class HrDbContext : DbContext
{
    public HrDbContext(DbContextOptions<HrDbContext> options) : base(options)
    {
    }

    public DbSet<DimEmployee> DimEmployees => Set<DimEmployee>();
    public DbSet<FactEmployment> FactEmployments => Set<FactEmployment>();
    public DbSet<FactSatisfaction> FactSatisfactions => Set<FactSatisfaction>();
    public DbSet<FactAttrition> FactAttritions => Set<FactAttrition>();
    public DbSet<LoadLog> LoadLogs => Set<LoadLog>();
    public DbSet<QuarantineRow> QuarantineRows => Set<QuarantineRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DimEmployee>(e =>
        {
            e.ToTable("dim_employee");
            e.HasKey(x => x.EmployeeNumber);
            e.Property(x => x.EmployeeNumber).HasColumnName("employee_number");
            e.Property(x => x.Age).HasColumnName("age");
            e.Property(x => x.Gender).HasColumnName("gender");
            e.Property(x => x.Department).HasColumnName("department");
            e.Property(x => x.JobRole).HasColumnName("job_role");
            e.Property(x => x.Education).HasColumnName("education");
            e.Property(x => x.EducationField).HasColumnName("education_field");
            e.Property(x => x.MaritalStatus).HasColumnName("marital_status");
            e.Property(x => x.BusinessTravel).HasColumnName("business_travel");
            e.Property(x => x.DistanceFromHome).HasColumnName("distance_from_home");
            e.HasOne(x => x.Employment).WithOne(f => f.Employee)
                .HasForeignKey<FactEmployment>(f => f.EmployeeNumber);
            e.HasOne(x => x.Satisfaction).WithOne(f => f.Employee)
                .HasForeignKey<FactSatisfaction>(f => f.EmployeeNumber);
            e.HasOne(x => x.Attrition).WithOne(f => f.Employee)
                .HasForeignKey<FactAttrition>(f => f.EmployeeNumber);
        });

        modelBuilder.Entity<FactEmployment>(e =>
        {
            e.ToTable("fact_employment");
            e.HasKey(x => x.EmployeeNumber);
            e.Property(x => x.EmployeeNumber).HasColumnName("employee_number");
            e.Property(x => x.MonthlyIncome).HasColumnName("monthly_income");
            e.Property(x => x.DailyRate).HasColumnName("daily_rate");
            e.Property(x => x.HourlyRate).HasColumnName("hourly_rate");
            e.Property(x => x.MonthlyRate).HasColumnName("monthly_rate");
            e.Property(x => x.PercentSalaryHike).HasColumnName("percent_salary_hike");
            e.Property(x => x.OverTime).HasColumnName("over_time");
            e.Property(x => x.YearsAtCompany).HasColumnName("years_at_company");
            e.Property(x => x.YearsInCurrentRole).HasColumnName("years_in_current_role");
            e.Property(x => x.YearsSinceLastPromotion).HasColumnName("years_since_last_promotion");
            e.Property(x => x.YearsWithCurrManager).HasColumnName("years_with_curr_manager");
            e.Property(x => x.TotalWorkingYears).HasColumnName("total_working_years");
            e.Property(x => x.NumCompaniesWorked).HasColumnName("num_companies_worked");
            e.Property(x => x.JobLevel).HasColumnName("job_level");
            e.Property(x => x.StockOptionLevel).HasColumnName("stock_option_level");
            e.Property(x => x.TrainingTimesLastYear).HasColumnName("training_times_last_year");
            e.Property(x => x.JobInvolvement).HasColumnName("job_involvement");
            e.Property(x => x.PerformanceRating).HasColumnName("performance_rating");
            e.Property(x => x.TenureBand).HasColumnName("tenure_band");
            e.Property(x => x.IncomeBand).HasColumnName("income_band");
        });

        modelBuilder.Entity<FactSatisfaction>(e =>
        {
            e.ToTable("fact_satisfaction");
            e.HasKey(x => x.EmployeeNumber);
            e.Property(x => x.EmployeeNumber).HasColumnName("employee_number");
            e.Property(x => x.EnvironmentSatisfaction).HasColumnName("environment_satisfaction");
            e.Property(x => x.JobSatisfaction).HasColumnName("job_satisfaction");
            e.Property(x => x.RelationshipSatisfaction).HasColumnName("relationship_satisfaction");
            e.Property(x => x.WorkLifeBalance).HasColumnName("work_life_balance");
            e.Property(x => x.SatisfactionScore).HasColumnName("satisfaction_score");
        });

        modelBuilder.Entity<FactAttrition>(e =>
        {
            e.ToTable("fact_attrition");
            e.HasKey(x => x.EmployeeNumber);
            e.Property(x => x.EmployeeNumber).HasColumnName("employee_number");
            e.Property(x => x.Attrition).HasColumnName("attrition");
        });

        modelBuilder.Entity<LoadLog>(e =>
        {
            e.ToTable("load_log");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
            e.Property(x => x.RunStartedAt).HasColumnName("run_started_at");
            e.Property(x => x.SourceFile).HasColumnName("source_file");
            e.Property(x => x.SourceChecksum).HasColumnName("source_checksum");
            e.Property(x => x.RowsRead).HasColumnName("rows_read");
            e.Property(x => x.RowsLoaded).HasColumnName("rows_loaded");
            e.Property(x => x.RowsQuarantined).HasColumnName("rows_quarantined");
            e.Property(x => x.Status).HasColumnName("status");
        });

        modelBuilder.Entity<QuarantineRow>(e =>
        {
            e.ToTable("quarantine");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
            e.Property(x => x.EmployeeNumber).HasColumnName("employee_number");
            e.Property(x => x.Reason).HasColumnName("reason");
            e.Property(x => x.RawLine).HasColumnName("raw_line");
        });
    }
}
