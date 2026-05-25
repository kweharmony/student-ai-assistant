import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const POLL_INTERVAL_MS = 5000;
const WORKER_OFFLINE_POLLS = 6; // ~30 сек без смены статуса → предупреждение

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface LectureMeta {
  title: string;
  subject?: string;
  description?: string;
  lecture_date?: string;
  is_public?: boolean;
}

interface FileUploadState {
  isUploading: boolean;
  uploadProgress: number;
  isPolling: boolean;
  taskStatus: TaskStatus | null;
  lectureId: string | null;
  taskId: string | null;
  progressMessage: string;
  error: string | null;
  success: boolean;
}

const INITIAL_STATE: FileUploadState = {
  isUploading: false,
  uploadProgress: 0,
  isPolling: false,
  taskStatus: null,
  lectureId: null,
  taskId: null,
  progressMessage: '',
  error: null,
  success: false,
};

export const useFileUpload = (token: string | null = null) => {
  const [state, setState] = useState<FileUploadState>(INITIAL_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pollCountRef.current = 0;
  };

  // Очистка при размонтировании компонента
  useEffect(() => () => stopPolling(), []);

  const uploadFile = async (file: File, meta: LectureMeta) => {
    stopPolling();
    setState({
      ...INITIAL_STATE,
      isUploading: true,
      progressMessage: 'Загрузка файла на сервер...',
    });

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', meta.title);
      if (meta.subject) formData.append('subject', meta.subject);
      if (meta.description) formData.append('description', meta.description);
      if (meta.lecture_date) formData.append('lecture_date', meta.lecture_date);
      formData.append('is_public', String(meta.is_public ?? false));

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/transcribe/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Ошибка загрузки файла');
      }

      const result = await res.json();
      const lectureId: string = result.lecture_id;
      const taskId: string = result.task_id;

      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 100,
        isPolling: true,
        lectureId,
        taskId,
        progressMessage: 'Файл в очереди на транскрибацию...',
      }));

      pollCountRef.current = 0;
      intervalRef.current = setInterval(async () => {
        try {
          pollCountRef.current += 1;

          const statusHeaders: Record<string, string> = {};
          if (token) statusHeaders['Authorization'] = `Bearer ${token}`;

          const statusRes = await fetch(
            `${API_BASE}/api/lectures/${lectureId}/task-status`,
            { headers: statusHeaders },
          );
          if (!statusRes.ok) return;

          const taskData = await statusRes.json();
          const taskStatus: TaskStatus = taskData.status;

          setState(prev => ({ ...prev, taskStatus }));

          if (taskStatus === 'pending') {
            if (pollCountRef.current >= WORKER_OFFLINE_POLLS) {
              setState(prev => ({
                ...prev,
                progressMessage:
                  'Файл в очереди. Воркеры транскрибации сейчас не подключены — ' +
                  'задача выполнится автоматически когда кто-то включит воркер.',
              }));
            }
          } else if (taskStatus === 'processing') {
            setState(prev => ({ ...prev, progressMessage: 'Обрабатывается воркером...' }));
          } else if (taskStatus === 'completed') {
            stopPolling();
            setState(prev => ({
              ...prev,
              isPolling: false,
              progressMessage: '',
              success: true,
            }));
          } else if (taskStatus === 'failed') {
            stopPolling();
            setState(prev => ({
              ...prev,
              isPolling: false,
              progressMessage: '',
              error: taskData.error_message || 'Ошибка транскрибации',
            }));
          }
        } catch {
          // Сетевая ошибка при поллинге — молча повторим на следующем тике
        }
      }, POLL_INTERVAL_MS);

    } catch (err) {
      stopPolling();
      setState({
        ...INITIAL_STATE,
        error: err instanceof Error ? err.message : 'Ошибка при загрузке файла',
      });
    }
  };

  const resetState = () => {
    stopPolling();
    setState(INITIAL_STATE);
  };

  return { ...state, uploadFile, resetState };
};
