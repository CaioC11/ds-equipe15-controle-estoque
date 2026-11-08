import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { TermoStorageService } from './termo-storage.service';

describe('TermoStorageService', () => {
  it('persiste e lê o arquivo dentro do storage configurado', async () => {
    const root = await mkdtemp(join(tmpdir(), 'termos-'));
    const service = new TermoStorageService({
      get: () => root,
    } as ConfigService);
    const contents = Buffer.from('%PDF');

    try {
      await service.write('2026/termo.pdf', contents);
      await expect(service.read('2026/termo.pdf')).resolves.toEqual(contents);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('recusa caminhos fora do storage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'termos-'));
    const service = new TermoStorageService({
      get: () => root,
    } as ConfigService);

    try {
      await expect(service.read('../fora.pdf')).rejects.toThrow('fora do storage');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
