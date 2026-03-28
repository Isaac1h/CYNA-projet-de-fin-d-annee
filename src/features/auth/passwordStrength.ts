import { PASSWORD_RULES, checkPasswordRules, type PasswordRule } from '@/lib/auth';

export type StrengthLevel = 'empty' | 'tres_faible' | 'faible' | 'moyen' | 'fort' | 'tres_fort';

export type PasswordStrength = {
  /** Number of password rules satisfied (0–5). */
  score: number;
  /** Total number of rules tested. */
  outOf: number;
  level: StrengthLevel;
  label: string;
  /** Tailwind class for the filled portion of the strength bar. */
  barColorClass: string;
  /** Tailwind class for the label text colour. */
  labelColorClass: string;
  /** Status of each individual rule, for the per-rule checklist. */
  ruleStatus: Record<PasswordRule, boolean>;
};

const RULE_LABEL: Record<PasswordRule, string> = {
  length: 'Au moins 8 caractères',
  uppercase: 'Une majuscule',
  lowercase: 'Une minuscule',
  digit: 'Un chiffre',
  special: 'Un caractère spécial',
};

export const RULE_LABELS: { rule: PasswordRule; label: string }[] = PASSWORD_RULES.map((rule) => ({
  rule,
  label: RULE_LABEL[rule],
}));

const LEVEL_TABLE: { min: number; level: StrengthLevel; label: string; bar: string; text: string }[] = [
  { min: 0, level: 'empty', label: '—', bar: 'bg-transparent', text: 'text-muted-foreground' },
  { min: 1, level: 'tres_faible', label: 'Très faible', bar: 'bg-destructive', text: 'text-destructive' },
  { min: 2, level: 'faible', label: 'Faible', bar: 'bg-destructive/80', text: 'text-destructive' },
  { min: 3, level: 'moyen', label: 'Moyen', bar: 'bg-amber-500', text: 'text-amber-500' },
  { min: 4, level: 'fort', label: 'Fort', bar: 'bg-lime-500', text: 'text-lime-500' },
  { min: 5, level: 'tres_fort', label: 'Très fort', bar: 'bg-green-500', text: 'text-green-500' },
];

export const evaluatePassword = (password: string): PasswordStrength => {
  const ruleStatus = checkPasswordRules(password);
  const score = PASSWORD_RULES.reduce((acc, rule) => acc + (ruleStatus[rule] ? 1 : 0), 0);
  const outOf = PASSWORD_RULES.length;
  const tier = password.length === 0 ? LEVEL_TABLE[0] : LEVEL_TABLE[score];

  return {
    score,
    outOf,
    level: tier.level,
    label: tier.label,
    barColorClass: tier.bar,
    labelColorClass: tier.text,
    ruleStatus,
  };
};
