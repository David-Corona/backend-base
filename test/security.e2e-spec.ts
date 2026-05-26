import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Server } from 'http';
import type { Express } from 'express';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { configureApp } from '@/bootstrap';

const mockPrismaService = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
};

async function createSecurityApp(
  allowedOrigins?: string,
  trustProxy?: number,
): Promise<INestApplication> {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalTrustProxy = process.env.TRUST_PROXY;

  try {
    if (allowedOrigins !== undefined) {
      process.env.ALLOWED_ORIGINS = allowedOrigins;
    } else {
      delete process.env.ALLOWED_ORIGINS;
    }

    if (trustProxy !== undefined) {
      process.env.TRUST_PROXY = String(trustProxy);
    } else {
      delete process.env.TRUST_PROXY;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    const app = moduleFixture.createNestApplication();
    const configService = app.get(ConfigService);
    configureApp(app, configService);
    await app.init();

    return app;
  } finally {
    if (originalAllowedOrigins !== undefined) {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    } else {
      delete process.env.ALLOWED_ORIGINS;
    }

    if (originalTrustProxy !== undefined) {
      process.env.TRUST_PROXY = originalTrustProxy;
    } else {
      delete process.env.TRUST_PROXY;
    }
  }
}

describe('Security Middleware (e2e)', () => {
  describe('Helmet', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createSecurityApp();
    });

    afterAll(async () => {
      await app?.close();
    });

    it('should include security headers from helmet', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('CORS', () => {
    let app: INestApplication;

    afterEach(async () => {
      await app?.close();
    });

    it('should not set CORS headers when ALLOWED_ORIGINS is unset', async () => {
      app = await createSecurityApp();
      const response = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .set('Origin', 'http://example.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should set CORS headers for allowed origins', async () => {
      app = await createSecurityApp('http://localhost:3001,http://localhost:3002');
      const response = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .set('Origin', 'http://localhost:3001')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    });

    it('should not set CORS headers for disallowed origins', async () => {
      app = await createSecurityApp('http://localhost:3001');
      const response = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .set('Origin', 'http://evil.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should trim whitespace from origins', async () => {
      app = await createSecurityApp('  http://localhost:3001  ');
      const response = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .set('Origin', 'http://localhost:3001')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    });

    it('should filter empty entries from origins', async () => {
      app = await createSecurityApp('http://localhost:3001,,http://localhost:3002');
      const response = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .set('Origin', 'http://localhost:3002')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3002');
    });
  });

  describe('Trust Proxy', () => {
    let app: INestApplication;

    afterEach(async () => {
      await app?.close();
    });

    it('should set trust proxy to default 0', async () => {
      app = await createSecurityApp();
      const expressApp = app.getHttpAdapter().getInstance() as Express;
      expect(expressApp.get('trust proxy')).toBe(0);
    });


  });
});
