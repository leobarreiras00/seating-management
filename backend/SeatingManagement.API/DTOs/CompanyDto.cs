using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.DTOs
{
    public static class ImageRules
    {
        public const int MaxDataUriLength = 3 * 1024 * 1024; // about 2.2 MB of image data once base64-encoded
        public const string DataUriPattern = @"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$";
    }

    public class CompanyResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string LogoUrl { get; set; } = string.Empty;
    }

    public class CreateCompanyDto
    {
        [Required(AllowEmptyStrings = false, ErrorMessage = "O nome da empresa é obrigatório.")]
        [StringLength(100, MinimumLength = 1)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(ImageRules.MaxDataUriLength)]
        public string LogoUrl { get; set; } = string.Empty; 
    }

    public class UpdateCompanyDto
    {
        [Required(AllowEmptyStrings = false, ErrorMessage = "O nome da empresa é obrigatório.")]
        [StringLength(100, MinimumLength = 1)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(ImageRules.MaxDataUriLength)]
        public string LogoUrl { get; set; } = string.Empty;
    }

    public class UpdateCompanyLogoDto
    {
        [MaxLength(ImageRules.MaxDataUriLength, ErrorMessage = "O logótipo excede o tamanho máximo.")]
        [RegularExpression(ImageRules.DataUriPattern, ErrorMessage = "O logótipo deve ser uma imagem (PNG, JPEG, WEBP ou GIF).")]
        public string LogoBase64 { get; set; } = string.Empty;
    }
}