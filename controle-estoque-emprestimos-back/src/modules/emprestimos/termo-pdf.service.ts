import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface TermoPdfData {
  numeroAno: string;
  responsavel: {
    nome: string;
    siape: string | null;
    lotacao: string;
    cargo: string;
  };
  unidade: string;
  dataAbertura: Date;
  dataFechamento: Date | null;
  item: {
    nome: string;
    tombamento: string | null;
    numeroSerie: string | null;
    descricao: string | null;
  };
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const formatarData = (val: any): string => {
  if (!val || val === 'null') return 'INDEFINIDO';
  const d = new Date(val);
  return isNaN(d.getTime()) ? 'INDEFINIDO' : d.toLocaleDateString('pt-BR');
};

@Injectable()
export class TermoPdfService {
  async gerar(data: TermoPdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Termo de Acautelamento Provisório Nº ${data.numeroAno}`);
    pdf.setSubject('Termo de responsabilidade de bem acautelado');

    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const addPageIfNeeded = (height: number) => {
      if (y - height < MARGIN) {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
    };

    const drawWrapped = (text: string, font = regular, size = 10, lineHeight = 14) => {
      const words = text.split(/\s+/);
      let line = '';
      const lines: string[] = [];

      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > CONTENT_WIDTH && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);

      for (const lineText of lines) {
        addPageIfNeeded(lineHeight);
        page.drawText(lineText, {
          x: MARGIN,
          y: y - size,
          size,
          font,
          color: rgb(0.12, 0.16, 0.2),
        });
        y -= lineHeight;
      }
    };

    const drawField = (label: string, value: string) => {
      drawWrapped(`${label}: ${value}`);
    };

    const drawSection = (title: string) => {
      y -= 20;
      addPageIfNeeded(24);
      page.drawRectangle({
        x: MARGIN,
        y: y - 5,
        width: CONTENT_WIDTH,
        height: 20,
        color: rgb(0.91, 0.94, 0.97),
      });
      page.drawText(title, {
        x: MARGIN + 8,
        y,
        size: 11,
        font: bold,
        color: rgb(0.12, 0.16, 0.2),
      });
      y -= 24;
    };

    const date = (value: Date) =>
      new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value);

    drawWrapped(
      'Conforme o item 10 da Instrução Normativa nº 205/88, todo servidor público poderá ser chamado à responsabilidade pelo desaparecimento do material que lhe for confiado, para guarda ou uso, bem como pelo dano que, doloso ou culposamente, causar a qualquer material, esteja ou não sob sua guarda.',
      regular,
      9,
      13,
    );
    y -= 12;

    const title = `TERMO DE ACAUTELAMENTO PROVISÓRIO Nº ${data.numeroAno}`;
    const titleWidth = bold.widthOfTextAtSize(title, 14);
    addPageIfNeeded(28);
    page.drawText(title, {
      x: (PAGE_WIDTH - titleWidth) / 2,
      y,
      size: 14,
      font: bold,
      color: rgb(0.08, 0.16, 0.26),
    });
    y -= 32;

    drawField('Nome', data.responsavel.nome);
    drawField('Siape', data.responsavel.siape ?? 'Não informado');
    drawField('Lotação', data.responsavel.lotacao);
    drawField('Cargo', data.responsavel.cargo);
    drawField('Unidade de Acautelamento', data.unidade);
    drawField('Data de Abertura', date(data.dataAbertura));
    drawField('Data Prevista para Fechamento', formatarData(data.dataFechamento));

    drawSection('BENS ACAUTELADOS');
    drawField(
      'Tombamento/Nº de Série',
      data.item.tombamento ?? data.item.numeroSerie ?? 'Sem identificação',
    );
    drawField('Denominação', data.item.nome);
    if (data.item.descricao) drawWrapped(data.item.descricao);

    drawSection('DECLARAÇÃO DE RESPONSABILIDADE');
    drawWrapped(
      'Declaro ter recebido o(s) bem(ns) patrimonial(ais) relacionado(s) no presente Termo. Assumindo total responsabilidade pela guarda e zelo do(s) mesmo(s), comprometendo-me a informar à Gerência de Infraestrutura sobre todas as ocorrências relativas ao(aos) referido(s) bem(ns) e ainda ressarcir o Órgão por perdas e danos caso comprovada a omissão da responsabilidade de minha parte.',
    );

    y -= 56;
    addPageIfNeeded(54);
    page.drawLine({
      start: { x: MARGIN + 45, y },
      end: { x: PAGE_WIDTH - MARGIN - 45, y },
      thickness: 1,
      color: rgb(0.25, 0.29, 0.33),
    });
    y -= 18;
    drawWrapped(data.responsavel.nome, bold, 10, 14);
    drawWrapped('Responsável pelo bem', regular, 9, 12);

    return pdf.save();
  }
}
