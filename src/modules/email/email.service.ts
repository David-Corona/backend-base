import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private templates: Record<string, HandlebarsTemplateDelegate> = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.resend = new Resend(this.configService.getOrThrow<string>('RESEND_API_KEY'));
    this.fromEmail = this.configService.getOrThrow<string>('FROM_EMAIL');
  }

  onModuleInit(): void {
    const templateDir = join(__dirname, 'templates');
    const templateFiles = [
      { name: 'verification', fileName: 'verification-email.hbs' },
      { name: 'passwordReset', fileName: 'password-reset-email.hbs' },
    ];

    for (const { name, fileName } of templateFiles) {
      const templatePath = join(templateDir, fileName);
      const templateSource = readFileSync(templatePath, 'utf-8');
      this.templates[name] = Handlebars.compile(templateSource);
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    try {
      const html = this.templates.verification({ token });
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Verify your email address',
        html,
      });
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error), to, subject: 'Verify your email address' },
        'Failed to send verification email',
      );
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    try {
      const html = this.templates.passwordReset({ token });
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Reset your password',
        html,
      });
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error), to, subject: 'Reset your password' },
        'Failed to send password reset email',
      );
    }
  }
}
