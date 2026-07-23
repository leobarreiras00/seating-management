namespace SeatingManagement.API.DTOs
{
    public class CompanyResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string LogoUrl { get; set; } = string.Empty;
    }

    public class CreateCompanyDto
    {
        public string Name { get; set; } = string.Empty;
        // O URL direto para a imagem do logótipo (ex: alojada no Imgur, AWS S3, etc.)
        public string LogoUrl { get; set; } = string.Empty; 
    }

    public class UpdateCompanyDto
    {
        public string Name { get; set; } = string.Empty;
        public string LogoUrl { get; set; } = string.Empty;
    }
}