import { StreamableFile } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ url: '/api/v1/termo' }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  };

  it('não embrulha respostas PDF em envelope JSON', async () => {
    const file = new StreamableFile(Buffer.from('%PDF'));
    const interceptor = new TransformInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept(context as never, { handle: () => of(file) } as never),
    );

    expect(result).toBe(file);
  });

  it('mantém o envelope padrão para respostas JSON', async () => {
    const interceptor = new TransformInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept(context as never, { handle: () => of({ id: 'item-1' }) } as never),
    );

    expect(result).toMatchObject({
      statusCode: 200,
      path: '/api/v1/termo',
      data: { id: 'item-1' },
    });
  });
});
