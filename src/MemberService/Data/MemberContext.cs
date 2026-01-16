using Microsoft.EntityFrameworkCore;
using MemberService.Models;

namespace MemberService.Data;

public class MemberContext : DbContext
{
    public MemberContext(DbContextOptions<MemberContext> options) : base(options) { }

    public DbSet<Member> Members { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Member>()
            .HasIndex(m => m.MembershipId)
            .IsUnique();
            
        modelBuilder.Entity<Member>()
            .HasIndex(m => m.Email)
            .IsUnique();
    }
}
