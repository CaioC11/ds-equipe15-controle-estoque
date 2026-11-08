import { PDFDocument } from 'pdf-lib';
import { TermoPdfService } from './termo-pdf.service';

describe('TermoPdfService', () => {
  it('gera um PDF válido com título numerado do termo', async () => {
    const service = new TermoPdfService();
    const bytes = await service.gerar({
      numeroAno: '01/2026',
      responsavel: {
        nome: 'Pessoa de Teste',
        siape: '0000000',
        lotacao: 'Centro de Informática',
        cargo: 'Servidor',
      },
      unidade: 'Estoque de teste',
      dataAbertura: new Date('2026-02-27T12:00:00.000Z'),
      dataFechamento: null,
      item: {
        nome: 'Notebook de teste',
        tombamento: null,
        numeroSerie: 'SERIE-TESTE',
        descricao: 'Equipamento de demonstração',
      },
    });

    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toBe('Termo de Acautelamento Provisório Nº 01/2026');
    expect(document.getPageCount()).toBeGreaterThan(0);
    expect(Buffer.from(bytes).toString('latin1')).toContain('%PDF-');
  });
});
