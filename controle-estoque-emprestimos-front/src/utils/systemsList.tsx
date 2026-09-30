import { type System } from '@cincoders/cinnamon';
import { LayoutDashboard, Calendar, Users, GraduationCap, CheckSquare, Printer, BookOpen } from 'lucide-react';

export const listSystems: System[] = [
  {
    title: 'Dashboard',
    IconComponent: () => <LayoutDashboard className="h-6 w-6 text-red-600" />,
    description: 'Painel geral e métricas',
    href: '/',
  },
  {
    title: 'Allocation',
    IconComponent: () => <Calendar className="h-6 w-6 text-red-600" />,
    description: 'Sistema para alocação e planejamento de disciplinas',
    href: 'https://allocation.cin.ufpe.br/',
  },
  {
    title: 'Gestão de Recursos Humanos',
    IconComponent: () => <Users className="h-6 w-6 text-red-600" />,
    description: 'Sistema de gestão de pessoas e equipes',
    href: '/hr',
  },
  {
    title: 'Seleção Pós-Graduação',
    IconComponent: () => <GraduationCap className="h-6 w-6 text-red-600" />,
    description: 'Sistema de seleção para pós-graduação',
    href: 'https://selecao.cin.ufpe.br/',
  },
  {
    title: 'FrequenCIn',
    IconComponent: () => <CheckSquare className="h-6 w-6 text-red-600" />,
    description: 'Sistema para registro e controle de frequência',
    href: 'https://frequencin.cin.ufpe.br/',
  },
  {
    title: 'Prints',
    IconComponent: () => <Printer className="h-6 w-6 text-red-600" />,
    description: 'Sistema para consulta de saldo e logs de impressão',
    href: '/prints',
  },
  {
    title: 'Sistema de Pesquisa',
    IconComponent: () => <BookOpen className="h-6 w-6 text-red-600" />,
    description: 'Sistema para acompanhamento de pesquisas e publicações',
    href: '/pesquisa',
  },
];
