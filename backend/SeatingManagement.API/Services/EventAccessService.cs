using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.Models;

namespace SeatingManagement.API.Services
{
    /// <summary>
    /// Central object-level authorization for event-scoped data.
    /// SuperAdmin: any event. Gestor: events of their own company or assigned to them.
    /// Any other role: only events assigned to the user.
    /// </summary>
    public interface IEventAccessService
    {
        IQueryable<Event> AccessibleEvents(ClaimsPrincipal principal);
        Task<bool> CanAccessEventAsync(ClaimsPrincipal principal, int eventId);
    }

    public class EventAccessService : IEventAccessService
    {
        private readonly AppDbContext _context;

        public EventAccessService(AppDbContext context)
        {
            _context = context;
        }

        public IQueryable<Event> AccessibleEvents(ClaimsPrincipal principal)
        {
            if (principal.IsInRole("SuperAdmin"))
                return _context.Events;

            if (!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userGuid))
                return _context.Events.Where(e => false);

            if (principal.IsInRole("Gestor") && int.TryParse(principal.FindFirstValue("CompanyId"), out var companyId))
                return _context.Events.Where(e => e.CompanyId == companyId
                                               || e.UserEvents.Any(ue => ue.User.UserGuid == userGuid));

            return _context.Events.Where(e => e.UserEvents.Any(ue => ue.User.UserGuid == userGuid));
        }

        public Task<bool> CanAccessEventAsync(ClaimsPrincipal principal, int eventId)
            => AccessibleEvents(principal).AnyAsync(e => e.Id == eventId);
    }
}
