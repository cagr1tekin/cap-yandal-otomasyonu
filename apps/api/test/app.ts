import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenVerifier } from '../src/auth/auth';
import { IdentityPort } from '../src/identity/identity';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';
import { FakeIdentity, FakeTokenVerifier } from './fakes';

/** Gerçek PostgreSQL test veritabanıyla uygulama; kimlik doğrulama ve kimlik servisi sahte. */
export async function bootstrap() {
  const identity = new FakeIdentity();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifier)
    .useValue(new FakeTokenVerifier())
    .overrideProvider(IdentityPort)
    .useValue(identity)
    .compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger: false });
  configureApp(app, { WEB_ORIGIN: 'http://localhost:3000' });
  await app.init();
  const prisma = app.get(PrismaService);
  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(`/api/v1${url}`).set('authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => http().post(`/api/v1${url}`).set('authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body: object) => http().put(`/api/v1${url}`).set('authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) => http().patch(`/api/v1${url}`).set('authorization', `Bearer ${token}`).send(body),
    del: (url: string) => http().delete(`/api/v1${url}`).set('authorization', `Bearer ${token}`),
    upload: (no: string, fields: Record<string, string>, file: Buffer, name = 'belge.pdf') => {
      const r = http().post(`/api/v1/students/${no}/documents`).set('authorization', `Bearer ${token}`);
      for (const [k, v] of Object.entries(fields)) r.field(k, v);
      return r.attach('file', file, name);
    },
  });
  return { app, prisma, identity, http, as };
}

/** Geçerli en küçük PDF. */
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');
export const KOORD = 'koord.bilgisayar';
export const HEAD = 'bolum.bilgisayar';
export const TERM = 'T-2026-GUZ';
