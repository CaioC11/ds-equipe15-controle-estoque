import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import {
  TODO_PRIORITY_LABELS,
  TODO_STATUS_LABELS,
} from '../todo.types';
import type { TodoPriority, TodoStatus } from '../todo.types';

export function StatusBadge({ status }: { status: TodoStatus }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {TODO_STATUS_LABELS.COMPLETED}
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
          <Clock className="h-3.5 w-3.5" />
          {TODO_STATUS_LABELS.IN_PROGRESS}
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {TODO_STATUS_LABELS.CANCELLED}
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {TODO_STATUS_LABELS.PENDING}
        </span>
      );
  }
}

export function PriorityBadge({ priority }: { priority: TodoPriority }) {
  switch (priority) {
    case 'URGENT':
      return (
        <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900/60 dark:text-red-200">
          {TODO_PRIORITY_LABELS.URGENT}
        </span>
      );
    case 'HIGH':
      return (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
          {TODO_PRIORITY_LABELS.HIGH}
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
          {TODO_PRIORITY_LABELS.MEDIUM}
        </span>
      );
    case 'LOW':
    default:
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {TODO_PRIORITY_LABELS.LOW}
        </span>
      );
  }
}
