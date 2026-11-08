import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TermoStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configuredPath = config.get<string>('TERMO_STORAGE_PATH', './storage/termos');
    this.root = resolve(configuredPath);
  }

  async write(relativePath: string, contents: Uint8Array): Promise<void> {
    const absolutePath = this.resolvePath(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents, { flag: 'wx' });
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(this.resolvePath(relativePath));
  }

  async remove(relativePath: string): Promise<void> {
    await rm(this.resolvePath(relativePath), { force: true });
  }

  private resolvePath(relativePath: string): string {
    if (isAbsolute(relativePath)) {
      throw new Error('O caminho do arquivo do termo deve ser relativo ao storage.');
    }

    const absolutePath = resolve(this.root, relativePath);
    const fromRoot = relative(this.root, absolutePath);
    if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new Error('O caminho do arquivo do termo está fora do storage configurado.');
    }
    return absolutePath;
  }
}
