// src/hooks/useMLProcessor.ts
// Custom hook для работы с ML API

import { useState, useRef } from 'react';
import { MLMode, MLProcessRequest, MLProcessResponse, MLProcessingState } from '../types/ml';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const useMLProcessor = () => {
  const [state, setState] = useState<MLProcessingState>({
    isProcessing: false,
    currentMode: null,
    result: null,
    error: null
  });

  // AbortController для отмены запросов
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Основная функция обработки текста через ML API
   */
  const processText = async (text: string, mode: MLMode, topic?: string): Promise<string | null> => {
    // Валидация входных данных
    if (!text.trim()) {
      setState(prev => ({ ...prev, error: 'Текст не может быть пустым' }));
      return null;
    }

    if (mode === 'expand_topic' && !topic?.trim()) {
      setState(prev => ({ 
        ...prev, 
        error: 'Для режима "Расширение темы" нужно указать тему' 
      }));
      return null;
    }

    // Начало обработки
    setState({
      isProcessing: true,
      currentMode: mode,
      result: null,
      error: null
    });

    // Создаем новый AbortController для этого запроса
    abortControllerRef.current = new AbortController();

    try {
      const requestBody: MLProcessRequest = {
        text,
        mode,
        ...(topic && { topic })
      };

      const response = await fetch(`${API_BASE_URL}/api/ml/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal  // Добавляем signal для отмены
      });

      if (!response.ok) {
        let errorMessage = 'Ошибка обработки текста';
        try {
          const errorData = await response.json();
          console.error('❌ Ответ с ошибкой от API:', errorData);
          
          // Обрабатываем разные форматы ошибок
          if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
            } else {
              errorMessage = JSON.stringify(errorData.detail);
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (parseError) {
          console.error('❌ Не удалось распарсить ошибку:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data: MLProcessResponse = await response.json();

      // Проверяем наличие обработанного текста
      if (!data.processed_text) {
        throw new Error('API вернул пустой результат обработки');
      }

      // Успешная обработка
      setState({
        isProcessing: false,
        currentMode: mode,
        result: data.processed_text,
        error: null
      });

      return data.processed_text;

    } catch (error: any) {
      // Проверяем, была ли отмена запроса
      if (error.name === 'AbortError') {
        setState({
          isProcessing: false,
          currentMode: mode,
          result: null,
          error: null  // Не показываем ошибку при отмене
        });
        return null;
      }

      console.error('❌ Ошибка обработки текста:', error);
      
      const errorMessage = error.message || 'Неизвестная ошибка';
      
      setState({
        isProcessing: false,
        currentMode: mode,
        result: null,
        error: errorMessage
      });
      
      return null;
    } finally {
      // Очищаем AbortController
      abortControllerRef.current = null;
    }
  };

  /**
   * Сброс состояния обработки
   */
  const reset = () => {
    setState({
      isProcessing: false,
      currentMode: null,
      result: null,
      error: null
    });
  };

  /**
   * Отмена текущей обработки
   */
  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  return {
    // Состояние
    isProcessing: state.isProcessing,
    currentMode: state.currentMode,
    result: state.result,
    error: state.error,
    
    // Методы
    processText,
    reset,
    cancelProcessing
  };
};
