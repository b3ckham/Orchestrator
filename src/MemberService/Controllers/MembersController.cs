using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MemberService.Data;
using MemberService.Models;
using Orchestrator.Shared.Models;
using Orchestrator.Shared.Contracts;
using MassTransit;
using System.Text.Json.Serialization;

namespace MemberService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MembersController : ControllerBase
{
    private readonly MemberContext _context;
    private readonly IPublishEndpoint _publishEndpoint;

    public MembersController(MemberContext context, IPublishEndpoint publishEndpoint)
    {
        _context = context;
        _publishEndpoint = publishEndpoint;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Member>>> GetMembers()
    {
        return await _context.Members
            .OrderByDescending(m => m.CreatedAt)
            .Take(50)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Member>> GetMember(int id)
    {
        var member = await _context.Members.FindAsync(id);

        if (member == null)
        {
            return NotFound();
        }

        return member;
    }

    [HttpGet("by-membership/{membershipId}")]
    public async Task<ActionResult<Member>> GetMemberByMembershipId(string membershipId)
    {
        var member = await _context.Members
            .FirstOrDefaultAsync(m => m.MembershipId == membershipId);

        if (member == null)
        {
            return NotFound();
        }

        return member;
    }

    [HttpGet("ids")]
    public async Task<ActionResult<IEnumerable<string>>> GetMemberIds()
    {
        return await _context.Members
            .Select(m => m.MembershipId)
            .ToListAsync();
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateStatusRequest request)
    {
        Member? member = null;

        // 1. Try Lookup by Int ID (Legacy/Internal)
        if (int.TryParse(id, out var intId))
        {
            member = await _context.Members.FindAsync(intId);
        }

        // 2. If not found or not int, Try Lookup by MembershipId (Public/String)
        if (member == null)
        {
            member = await _context.Members.FirstOrDefaultAsync(m => m.MembershipId == id);
        }

        if (member == null)
        {
            return NotFound();
        }

        if (request.Status == null)
        {
            return BadRequest("Status is required in the request body.");
        }

        var oldStatus = member.Status;
        member.Status = request.Status.Value;
        await _context.SaveChangesAsync();
        
        try 
        {
            // Publish event to RabbitMQ
            await _publishEndpoint.Publish(new MemberStatusChanged(
                member.MembershipId,
                oldStatus,
                member.Status,
                DateTime.Now
            ));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to publish status change event", details = ex.Message });
        }

        // Publish generic update event
        await _publishEndpoint.Publish(new MemberUpdated(
            member.MembershipId,
            member.Email,
            member.FirstName,
            member.LastName,
            member.Phone,
            member.Status.ToString(),
            member.Risk_Level.ToString(),
            member.KYC_Level.ToString(),
            member.Email_Verified,
            member.Phone_Verified,
            member.WalletStatus.ToString(),
            member.GameStatus.ToString(),
            DateTime.Now
        ));

        return NoContent();
    }

    [HttpPut("{id}/profile")]
    public async Task<IActionResult> UpdateProfile(int id, [FromBody] UpdateProfileRequest request)
    {
        var member = await _context.Members.FindAsync(id);
        if (member == null) return NotFound();

        member.FirstName = request.FirstName;
        member.LastName = request.LastName;
        member.Email = request.Email;
        member.Phone = request.Phone;
        member.Email_Verified = request.Email_Verified;
        member.Phone_Verified = request.Phone_Verified;
        member.GameStatus = request.GameStatus;
        member.Risk_Level = request.Risk_Level;
        member.KYC_Level = request.KYC_Level;
        member.WalletStatus = request.WalletStatus;

        await _context.SaveChangesAsync();
        
        // Publish update event to sync Risk/KYC to Compliance and WalletStatus to Wallet
        await _publishEndpoint.Publish(new MemberUpdated(
            member.MembershipId,
            member.Email,
            member.FirstName,
            member.LastName,
            member.Phone,
            member.Status.ToString(),
            member.Risk_Level.ToString(),
            member.KYC_Level.ToString(),
            member.Email_Verified,
            member.Phone_Verified,
            member.WalletStatus.ToString(),
            member.GameStatus.ToString(),
            DateTime.Now
        ));

        return NoContent();
    }

    [HttpPut("{id}/wallet")]
    public async Task<IActionResult> UpdateWallet(int id, [FromBody] UpdateWalletRequest request)
    {
        var member = await _context.Members.FindAsync(id);
        if (member == null) return NotFound();

        member.WalletStatus = request.WalletStatus;
        await _context.SaveChangesAsync();
        
        // We could publish a WalletStatusChanged event here too if needed
        
        return NoContent();
    }

    [HttpPut("{id}/eligibility")]
    public async Task<IActionResult> UpdateEligibility(string id, [FromBody] UpdateEligibilityRequest request)
    {
        Member? member = null;
        if (int.TryParse(id, out var intId)) member = await _context.Members.FindAsync(intId);
        if (member == null) member = await _context.Members.FirstOrDefaultAsync(m => m.MembershipId == id); // Lookup by string ID

        if (member == null) return NotFound();

        if (request.BonusEligibility.HasValue) member.BonusEligibility = request.BonusEligibility.Value;
        if (request.DepositEligibility.HasValue) member.DepositEligibility = request.DepositEligibility.Value;
        if (request.WithdrawalEligibility.HasValue) member.WithdrawalEligibility = request.WithdrawalEligibility.Value;
        if (request.BankAccountMgmtLevel.HasValue) member.BankAccountMgmtLevel = request.BankAccountMgmtLevel.Value;

        await _context.SaveChangesAsync();
        
        // Publish generic update (fields will be effectively ignored by listeners if not updated in contract, but data is safe)
        // TODO: Update shared contract MemberUpdated to include these new fields
        
        return NoContent();
    }

    [HttpPost]
    public async Task<ActionResult<Member>> CreateMember([FromBody] CreateMemberRequest request)
    {
        var member = new Member
        {
            MembershipId = string.IsNullOrEmpty(request.MembershipId) ? Guid.NewGuid().ToString() : request.MembershipId,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            Status = request.Status,
            Risk_Level = request.Risk_Level,
            KYC_Level = request.KYC_Level,
            WalletStatus = request.WalletStatus,
            GameStatus = request.GameStatus,
            CreatedAt = DateTime.Now
        };

        _context.Members.Add(member);
        
        try 
        {
            await _context.SaveChangesAsync();
            
            await _publishEndpoint.Publish(new MemberCreated(
                member.MembershipId,
                member.Email,
                member.FirstName,
                member.LastName,
                member.Phone,
                member.Status,
                member.Risk_Level,
                member.KYC_Level,
                member.Email_Verified,
                member.Phone_Verified,
                member.WalletStatus,
                member.GameStatus,
                request.Currency,
                member.CreatedAt
            ));
        }
        catch (DbUpdateException)
        {
            if (await _context.Members.AnyAsync(m => m.MembershipId == member.MembershipId || m.Email == member.Email))
            {
                return Conflict("Membership ID or Email already exists.");
            }
            throw;
        }

        return CreatedAtAction(nameof(GetMember), new { id = member.Id }, member);
    }

    [HttpPut("{id}/game-lock")]
    public async Task<IActionResult> UpdateGameLock(string id, [FromBody] UpdateGameLockRequest request)
    {
        Member? member = null;
        if (int.TryParse(id, out var intId)) member = await _context.Members.FindAsync(intId);
        if (member == null) member = await _context.Members.FirstOrDefaultAsync(m => m.MembershipId == id);

        if (member == null) return NotFound();

        member.GameStatus = request.IsLocked ? GameStatus.Locked : GameStatus.Unlocked;
        await _context.SaveChangesAsync();
        
        // Publish update event
        await _publishEndpoint.Publish(new MemberUpdated(
            member.MembershipId,
            member.Email,
            member.FirstName,
            member.LastName,
            member.Phone,
            member.Status.ToString(),
            member.Risk_Level.ToString(),
            member.KYC_Level.ToString(),
            member.Email_Verified,
            member.Phone_Verified,
            member.WalletStatus.ToString(),
            member.GameStatus.ToString(),
            DateTime.Now
        ));
        
        return NoContent();
    }
}

public class UpdateGameLockRequest
{
    public bool IsLocked { get; set; }
}

public class CreateMemberRequest
{
    public string MembershipId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public MemberStatus Status { get; set; } = MemberStatus.Active;
    public RiskLevel Risk_Level { get; set; } = RiskLevel.Low;
    public KycLevel KYC_Level { get; set; } = KycLevel.Pending;
    public WalletStatus WalletStatus { get; set; } = WalletStatus.Unlocked;
    public GameStatus GameStatus { get; set; } = GameStatus.Unlocked;
    public Currency Currency { get; set; } = Currency.CNY;
}

public class UpdateStatusRequest
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public MemberStatus? Status { get; set; }
}

public class UpdateProfileRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool Email_Verified { get; set; }
    public bool Phone_Verified { get; set; }
    public GameStatus GameStatus { get; set; } = GameStatus.Unlocked;
    public RiskLevel Risk_Level { get; set; } = RiskLevel.Low;
    public KycLevel KYC_Level { get; set; } = KycLevel.Pending;
    public WalletStatus WalletStatus { get; set; } = WalletStatus.Unlocked;
}

public class UpdateWalletRequest
{
    public WalletStatus WalletStatus { get; set; }
}

public class UpdateEligibilityRequest
{
    public bool? BonusEligibility { get; set; }
    public bool? DepositEligibility { get; set; }
    public bool? WithdrawalEligibility { get; set; }
    public BankAccountMgmtLevel? BankAccountMgmtLevel { get; set; }
}

