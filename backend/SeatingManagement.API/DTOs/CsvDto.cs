using CsvHelper.Configuration.Attributes;

namespace SeatingManagement.API.DTOs
{
    public class SeatCsvRecord
    {
        [Optional]
        [Name("mesa", "m", "table")]
        public string? Mesa { get; set; }

        [Optional]
        [Name("lugar", "l", "seat")]
        public string? Lugar { get; set; }

        [Optional]
        [Name("categoria", "status", "estado", "c")]
        public string? Categoria { get; set; }

        [Optional]
        [Name("nome", "name", "pessoa", "n")]
        public string? Nome { get; set; }
    }

    public class ClearDatabaseDto
    {
        public string Pin { get; set; } = string.Empty;
    }
}