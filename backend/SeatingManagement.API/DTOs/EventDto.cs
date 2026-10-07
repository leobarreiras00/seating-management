using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.DTOs
{
    public class EventResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
    
    public class CreateEventDto : IValidatableObject
    {
        [Required(AllowEmptyStrings = false, ErrorMessage = "O nome do evento é obrigatório.")]
        [StringLength(100, MinimumLength = 1, ErrorMessage = "O nome do evento deve ter entre 1 e 100 caracteres.")]
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
            => EventDateRules.Validate(StartDate, EndDate);
    }

    public static class EventDateRules
    {
        public const int MinYear = 2000;
        public const int MaxYear = 2100;

        public static IEnumerable<ValidationResult> Validate(DateTime start, DateTime end)
        {
            if (start.Year < MinYear || start.Year > MaxYear || end.Year < MinYear || end.Year > MaxYear)
                yield return new ValidationResult($"As datas devem estar entre {MinYear} e {MaxYear}.", new[] { nameof(CreateEventDto.StartDate), nameof(CreateEventDto.EndDate) });
            if (end < start)
                yield return new ValidationResult("A data de fim não pode ser anterior à data de início.", new[] { nameof(CreateEventDto.EndDate) });
        }
    }
}