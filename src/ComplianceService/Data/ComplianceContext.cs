using Microsoft.EntityFrameworkCore;
using ComplianceService.Models;

namespace ComplianceService.Data;

public class ComplianceContext : DbContext
{
    public ComplianceContext(DbContextOptions<ComplianceContext> options) : base(options) { }
    public DbSet<ComplianceProfile> Profiles { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ComplianceProfile>().ToTable("ComplianceProfiles");
    }
}
