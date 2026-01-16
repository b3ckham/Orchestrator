using Microsoft.EntityFrameworkCore;
using AuditService.Models;

namespace AuditService.Data;

public class AuditContext : DbContext
{
    public AuditContext(DbContextOptions<AuditContext> options) : base(options)
    {
    }

    public DbSet<SystemError> SystemErrors { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
}
