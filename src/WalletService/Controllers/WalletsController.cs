using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WalletService.Data;
using WalletService.Models;
using Orchestrator.Shared.Models;
using Orchestrator.Shared.Contracts;
using MassTransit;
using System.Text.Json.Serialization;

namespace WalletService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WalletsController : ControllerBase
{
    private readonly WalletContext _context;
    private readonly IPublishEndpoint _publishEndpoint;

    public WalletsController(WalletContext context, IPublishEndpoint publishEndpoint)
    {
        _context = context;
        _publishEndpoint = publishEndpoint;
    }

    [HttpGet("{membershipId}")]
    public async Task<ActionResult<Wallet>> GetWallet(string membershipId)
    {
        var wallet = await _context.Wallets
            .FirstOrDefaultAsync(w => w.MembershipId == membershipId);

        if (wallet == null) return NotFound();

        return wallet;
    }

    [HttpPut("{membershipId}/adjust")]
    public async Task<IActionResult> AdjustBalance(string membershipId, [FromBody] AdjustBalanceRequest request)
    {
        var wallet = await _context.Wallets
            .FirstOrDefaultAsync(w => w.MembershipId == membershipId);

        if (wallet == null) return NotFound();

        wallet.Balance += request.Amount;
        // Optionally update other fields if they were in the request, e.g. Status
        
        await _context.SaveChangesAsync();

        await _publishEndpoint.Publish(new WalletUpdated(
            wallet.MembershipId,
            wallet.Balance,
            wallet.Currency,
            wallet.Status,
            wallet.Status, // Previous Status (Same)
            DateTime.Now
        ));

        return NoContent();
    }
    [HttpPut("{membershipId}/status")]
    public async Task<IActionResult> UpdateStatus(string membershipId, [FromBody] UpdateWalletStatusRequest request)
    {
        var member = await _context.Wallets.FirstOrDefaultAsync(w => w.MembershipId == membershipId);
        if (member == null) return NotFound();

        var previousStatus = member.Status;
        
        member.Status = request.Status; // From Request
        
        await _context.SaveChangesAsync();
        
        // Publish Event
        await _publishEndpoint.Publish(new WalletUpdated(
            member.MembershipId,
            member.Balance,
            member.Currency,
            member.Status,
            previousStatus,
            DateTime.Now
        ));

        Console.WriteLine($"[DEBUG] Publishing WalletUpdated: {member.MembershipId} Status: {member.Status}");

        return NoContent();
    }
}

public class UpdateWalletStatusRequest
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public WalletStatus Status { get; set; } = WalletStatus.Unlocked;
}

public class AdjustBalanceRequest
{
    public decimal Amount { get; set; }
}
