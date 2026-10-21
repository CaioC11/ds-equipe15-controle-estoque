import { type SidebarData } from '@cincoders/cinnamon';
import { ListChecks, Users, Tags, Warehouse, ClipboardList } from 'lucide-react';
import { Links } from './enums';
import cincodersLogo from '../assets/icons/logo_cincoders-icon.svg';

 /**
 * Conteúdo da sidebar (Drawer aberto pelo botão de menu do Navbar).
 * `navMain` fica sempre visível; `navGroups` são seções colapsáveis.
 */

export const sidebar: SidebarData = {
  appName: 'Controle de Estoque e Empréstimos',
  // Import de módulo (não um caminho em public/): o bundler resolve a URL
  // final já considerando o base configurado (VITE_BASE_URL), do mesmo
  // jeito que `cin-logo.svg` em pages/login.
  appLogoSrc: cincodersLogo,
  navMain: [
    {
      id: 'todos',
      title: 'Tarefas de Exemplo',
      href: Links.TODOS,
      IconComponent: ListChecks,
    },
    {
      id: 'estoques',
      title: 'Estoques',
      href: Links.ESTOQUES,
      IconComponent: Warehouse,
    },
    {
      id: 'categorias',
      title: 'Categorias',
      href: Links.CATEGORIAS,
      IconComponent: Tags,
    },
        {
      id: 'emprestimos',
      title: 'Empréstimos',
      href: Links.EMPRESTIMOS,
      IconComponent: ClipboardList,
    },
    {
      id: 'team',
      title: 'Gerenciar Equipe',
      href: Links.TEAM,
      IconComponent: Users,
    },
  ],
};
