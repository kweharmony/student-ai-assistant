// src/hooks/useMLProcessor.ts
// Custom hook для работы с ML API

import { useState } from 'react';
import { MLMode, MLProcessRequest, MLProcessResponse, MLProcessingState } from '../types/ml';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const useMLProcessor = () => {
  const [state, setState] = useState<MLProcessingState>({
    isProcessing: false,
    currentMode: null,
    result: null,
    error: null
  });

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

    try {
      const requestBody: MLProcessRequest = {
        text,
        mode,
        ...(topic && { topic })
      };

      console.log('🚀 Отправка запроса к ML API:', {
        url: `${API_BASE_URL}/api/ml/process`,
        mode,
        textLength: text.length,
        topic
      });

      const response = await fetch(`${API_BASE_URL}/api/ml/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
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

      console.log('✅ Полный ответ от API:', data);
      console.log('✅ Успешная обработка:', {
        mode: data.mode,
        inputLength: data.input_length,
        outputLength: data.output_length,
        processingTime: data.processing_time,
        hasProcessedText: !!data.processed_text
      });

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
      console.error('❌ Ошибка обработки текста:', error);
      
      const errorMessage = error.message || 'Неизвестная ошибка';
      
      setState({
        isProcessing: false,
        currentMode: mode,
        result: null,
        error: errorMessage
      });
      
      return null;
    }
  };

  /**
   * Пакетная обработка текста несколькими режимами
   */
  const batchProcess = async (text: string, modes: MLMode[]) => {
    if (!text.trim()) {
      setState(prev => ({ ...prev, error: 'Текст не может быть пустым' }));
      return null;
    }

    setState({
      isProcessing: true,
      currentMode: null,
      result: null,
      error: null
    });

    try {
      console.log('🚀 Пакетная обработка:', { modes, textLength: text.length });

      const response = await fetch(`${API_BASE_URL}/api/ml/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, modes })
      });

      if (!response.ok) {
        throw new Error('Ошибка пакетной обработки');
      }

      const data = await response.json();

      console.log('✅ Пакетная обработка завершена:', data);

      setState({
        isProcessing: false,
        currentMode: null,
        result: JSON.stringify(data.results, null, 2),
        error: null
      });

      return data.results;

    } catch (error: any) {
      console.error('❌ Ошибка пакетной обработки:', error);
      
      setState({
        isProcessing: false,
        currentMode: null,
        result: null,
        error: error.message
      });
      
      return null;
    }
  };

  /**
   * Получение списка доступных режимов обработки
   */
  const getModes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ml/modes`);
      
      if (!response.ok) {
        throw new Error('Не удалось получить список режимов');
      }
      
      const data = await response.json();
      console.log('📋 Доступные режимы:', data.modes);
      
      return data.modes;
    } catch (error) {
      console.error('❌ Ошибка получения режимов:', error);
      return [];
    }
  };

  /**
   * Проверка работоспособности ML API
   */
  const checkHealth = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ml/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      const isHealthy = data.status === 'healthy';
      
      console.log(isHealthy ? '✅ ML API работает' : '❌ ML API недоступен');
      
      return isHealthy;
    } catch (error) {
      console.error('❌ ML API недоступен:', error);
      return false;
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

  return {
    // Состояние
    isProcessing: state.isProcessing,
    currentMode: state.currentMode,
    result: state.result,
    error: state.error,
    
    // Методы
    processText,
    batchProcess,
    getModes,
    checkHealth,
    reset
  };
};
