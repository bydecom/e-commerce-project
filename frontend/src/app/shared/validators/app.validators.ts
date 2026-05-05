import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value ?? '';
  if (!v) return null;
  const errors: ValidationErrors = {};
  if (v.length < 8) errors['minlength'] = { requiredLength: 8, actualLength: v.length };
  if (!/[A-Z]/.test(v)) errors['noUppercase'] = true;
  if (!/[0-9]/.test(v)) errors['noNumber'] = true;
  return Object.keys(errors).length ? errors : null;
}

export function matchPasswordsValidator(pwField: string, confirmField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const pw = control.get(pwField)?.value ?? '';
    const confirm = control.get(confirmField)?.value ?? '';
    if (!pw || !confirm) return null;
    return pw === confirm ? null : { passwordMismatch: true };
  };
}
