import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private templates: { verification: HandlebarsTemplateDelegate; passwordReset: HandlebarsTemplateDelegate } =
    undefined!;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.getOrThrow<string>('RESEND_API_KEY'));
    this.fromEmail = this.configService.getOrThrow<string>('FROM_EMAIL');
  }

  onModuleInit(): void {
    const templateDir = join(__dirname, 'templates');
    this.templates = {
      verification: Handlebars.compile(readFileSync(join(templateDir, 'verification-email.hbs'), 'utf-8')),
      passwordReset: Handlebars.compile(readFileSync(join(templateDir, 'password-reset-email.hbs'), 'utf-8')),
    };
  }

  async sendVerificationEmail(to: string, token: string, expiresIn: string): Promise<void> {
    const html = this.templates.verification({ token, expiresIn });
    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Verify your email address',
      html,
    });
  }

  async sendPasswordResetEmail(to: string, token: string, expiresIn: string): Promise<void> {
    const html = this.templates.passwordReset({ token, expiresIn });
    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Reset your password',
      html,
    });
  }
}
