// Mirrors the API policy (StrongPasswordAttribute): 8 to 72 characters, at least one letter and one digit.
export const PASSWORD_HINT = "Mínimo 8 caracteres, com letras e números";
export const PASSWORD_ERROR = "A palavra-passe deve ter entre 8 e 72 caracteres, com pelo menos uma letra e um número.";

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 72 && /\p{L}/u.test(password) && /\d/.test(password);
}
