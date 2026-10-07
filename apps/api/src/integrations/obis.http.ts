import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config';
import { Problem } from '../common/http';
import { CacheService } from './cache.service';
import {
  ObisPort,
  type ObisStanding,
  type ObisStudent,
  type ObisTrack,
  OsymPort,
  type OsymVerification,
} from './obis.port';

const TIMEOUT_MS = 5000;
const RETRIES = 2;
const STANDING_TTL_S = 300;

/** OBİS'e HTTP ile bağlanan adapter. Geliştirmede apps/mock-obis'e bağlanır. */
@Injectable()
export class HttpObisAdapter extends ObisPort {
  private readonly logger = new Logger('OBIS');

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly cache: CacheService,
  ) {
    super();
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await fetch(`${this.config.OBIS_BASE_URL}${path}`, {
          ...init,
          headers: { 'x-api-key': this.config.OBIS_API_KEY, 'content-type': 'application/json', ...init.headers },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 404) throw new Problem(HttpStatus.NOT_FOUND, 'Bulunamadı', 'Öğrenci OBİS\'te bulunamadı.');
        if (!res.ok) throw new Error(`OBİS ${res.status}`);
        return (await res.json()) as T;
      } catch (e) {
        if (e instanceof Problem) throw e;
        lastError = e;
        this.logger.warn(`OBİS isteği başarısız (${attempt + 1}/${RETRIES + 1}): ${path}`);
      }
    }
    this.logger.error(lastError);
    throw new Problem(HttpStatus.SERVICE_UNAVAILABLE, 'OBİS\'e ulaşılamıyor', 'Öğrenci bilgi sistemine şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.');
  }

  getStudent(no: string) {
    return this.request<ObisStudent>(`/students/${encodeURIComponent(no)}`);
  }

  async getStanding(no: string, opts: { fresh?: boolean } = {}) {
    const key = `obis:standing:${no}`;
    if (!opts.fresh) {
      const hit = await this.cache.get<ObisStanding>(key);
      if (hit) return hit;
    }
    const s = await this.request<ObisStanding>(`/students/${encodeURIComponent(no)}/standing`);
    await this.cache.set(key, s, STANDING_TTL_S);
    return s;
  }

  getTrack(no: string, programId: string) {
    return this.request<ObisTrack>(`/students/${encodeURIComponent(no)}/tracks/${encodeURIComponent(programId)}`);
  }

  async getProgramBaseScore(programId: string, year: number) {
    const r = await this.request<{ baseScore: number | null }>(
      `/programs/${encodeURIComponent(programId)}/base-score?year=${year}`,
    );
    return r.baseScore;
  }

  async isRegistered(no: string, programId: string) {
    const r = await this.request<{ registered: boolean }>(
      `/registrations?studentNo=${encodeURIComponent(no)}&programId=${encodeURIComponent(programId)}`,
    );
    return r.registered;
  }

  async getAdvisees(username: string) {
    const r = await this.request<{ studentNos: string[] }>(`/advisors/${encodeURIComponent(username)}/students`);
    return r.studentNos;
  }

  async ping() {
    try {
      const res = await fetch(`${this.config.OBIS_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

@Injectable()
export class HttpOsymAdapter extends OsymPort {
  constructor(private readonly obis: HttpObisAdapter) {
    super();
  }

  verifyResultDocument(docNo: string, verificationCode: string) {
    return this.obis.request<OsymVerification>('/osym/verify', {
      method: 'POST',
      body: JSON.stringify({ docNo, verificationCode }),
    });
  }
}
