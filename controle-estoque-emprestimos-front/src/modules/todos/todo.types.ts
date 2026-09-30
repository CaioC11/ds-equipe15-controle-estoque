export const TODO_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em Progresso',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const TODO_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string;
}

export type UpdateTodoDto = Partial<CreateTodoDto>;
