import { useState } from 'react';

interface FileUploadState {
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  success: boolean;
}

export const useFileUpload = () => {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    uploadProgress: 0,
    error: null,
    success: false
  });

  const uploadFile = async (file: File) => {
    setState({
      isUploading: true,
      uploadProgress: 0,
      error: null,
      success: false
    });

    try {
      // Симуляция загрузки файла
      const formData = new FormData();
      formData.append('audio', file);

      // Здесь будет реальная логика загрузки на сервер
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData
      // });

      // Симуляция прогресса
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setState(prev => ({ ...prev, uploadProgress: i }));
      }

      setState({
        isUploading: false,
        uploadProgress: 100,
        error: null,
        success: true
      });

      // Сброс состояния через 3 секунды
      setTimeout(() => {
        setState({
          isUploading: false,
          uploadProgress: 0,
          error: null,
          success: false
        });
      }, 3000);

    } catch (error) {
      setState({
        isUploading: false,
        uploadProgress: 0,
        error: 'Ошибка при загрузке файла',
        success: false
      });
    }
  };

  const resetState = () => {
    setState({
      isUploading: false,
      uploadProgress: 0,
      error: null,
      success: false
    });
  };

  return {
    ...state,
    uploadFile,
    resetState
  };
};
