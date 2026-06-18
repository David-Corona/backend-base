import { registerDecorator, type ValidationOptions } from 'class-validator';

export function IsPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (value.length < 8) return false;
          if (value.length > 128) return false;
          if (!/[a-z]/.test(value)) return false;
          if (!/[A-Z]/.test(value)) return false;
          if (!/[0-9]/.test(value)) return false;
          return true;
        },
        defaultMessage(): string {
          return 'Password must be at least 8 characters long, and contain an uppercase letter, a lowercase letter, and a digit';
        },
      },
    });
  };
}
