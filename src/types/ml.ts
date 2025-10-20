// src/types/ml.ts
// TypeScript типы для ML API интеграции

// Режимы обработки текста (соответствуют API)
export type MLMode = 
  | 'summarize'
  | 'extract_terms'
  | 'expand_topic'
  | 'generate_questions'
  | 'detailed_notes'
  | 'cheat_sheet';

// Запрос на обработку текста
export interface MLProcessRequest {
  text: string;
  mode: MLMode;
  topic?: string;  // Обязательно для режима expand_topic
}

// Ответ от ML API
export interface MLProcessResponse {
  processed_text: string;
  mode: MLMode;
  input_length: number;
  output_length: number;
  processing_time?: number;
}

// Описание режима для UI
export interface MLModeInfo {
  id: MLMode;
  name: string;
  description: string;
  icon: string;
  requiresTopic?: boolean;  // Нужно ли вводить тему
}

// Состояние обработки
export interface MLProcessingState {
  isProcessing: boolean;
  currentMode: MLMode | null;
  result: string | null;
  error: string | null;
}

// Результат пакетной обработки
export interface BatchProcessResult {
  mode: MLMode;
  result: string;
  error?: string;
}

export interface BatchProcessResponse {
  results: Record<MLMode, string>;
  total_processing_time: number;
}
