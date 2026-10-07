export interface PasswordRule {
  key: string
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'len',     label: 'At least 8 characters',  test: (p) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',    test: (p) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter',    test: (p) => /[a-z]/.test(p) },
  { key: 'num',     label: 'One number',              test: (p) => /\d/.test(p) },
  { key: 'special', label: 'One special character',   test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]
