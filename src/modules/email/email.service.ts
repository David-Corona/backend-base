import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { VERIFICATION_HTML, PASSWORD_RESET_HTML, escapeHtml } from './email.templates';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.getOrThrow<string>('RESEND_API_KEY'));
    this.fromEmail = this.configService.getOrThrow<string>('FROM_EMAIL');
  }

  async sendVerificationEmail(to: string, link: string, token: string, expiresIn: string): Promise<void> {
    const html = VERIFICATION_HTML
      .replaceAll('{{link}}', escapeHtml(link))
      .replaceAll('{{token}}', escapeHtml(token))
      .replaceAll('{{expiresIn}}', escapeHtml(expiresIn));
    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Verify your email address',
      html,
    });
  }

  async sendPasswordResetEmail(to: string, link: string, expiresIn: string): Promise<void> {
    const html = PASSWORD_RESET_HTML
      .replaceAll('{{link}}', escapeHtml(link))
      .replaceAll('{{expiresIn}}', escapeHtml(expiresIn));
    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Reset your password',
      html,
    });
  }
}
