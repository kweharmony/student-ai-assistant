// Утилиты совместного редактирования полотна.

import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';

/**
 * Слияние локальной и удалённой сцен по версиям элементов (п.4).
 *
 * Вместо полной замены сцены (last-write-wins по всей доске, при котором
 * параллельные правки соавторов затирались) объединяем элементы по `id`:
 * для общих id побеждает элемент с большей `version`, при равенстве — с
 * меньшим `versionNonce` (детерминированно одинаково на всех клиентах).
 *
 * Примечание: метод работает с неудалёнными элементами, поэтому одновременное
 * удаление + правка одного и того же элемента — пограничный случай; для типового
 * сценария (каждый добавляет/правит свои объекты) правки больше не теряются.
 */
/**
 * Сериализация сцены для синхронизации/персиста.
 *
 * В отличие от serializeAsJSON (он вырезает удалённые элементы для экспорта),
 * здесь мы СОХРАНЯЕМ удалённые элементы (isDeleted с возросшей version). Без
 * этого удаление объекта не доходит до соавторов: их merge не узнаёт об
 * удалении и возвращает объект обратно. Передаётся вместе с files (картинки).
 */
export function serializeSceneForSync(
  elements: readonly ExcalidrawElement[],
  appState: { viewBackgroundColor?: string } | null | undefined,
  files: unknown,
): string {
  // Удалённые элементы храним (для распространения удаления), но бинари в files
  // оставляем только для активных элементов — иначе base64 удалённых картинок
  // копился бы в данных доски навсегда.
  const activeFileIds = new Set<string>();
  for (const el of elements) {
    const fid = (el as { fileId?: string }).fileId;
    if (!el.isDeleted && fid) activeFileIds.add(fid);
  }
  const prunedFiles: Record<string, unknown> = {};
  if (files && typeof files === 'object') {
    for (const [id, f] of Object.entries(files as Record<string, unknown>)) {
      if (activeFileIds.has(id)) prunedFiles[id] = f;
    }
  }
  return JSON.stringify({
    type: 'excalidraw-sync',
    elements,
    appState: { viewBackgroundColor: appState?.viewBackgroundColor },
    files: prunedFiles,
  });
}

export function mergeExcalidrawElements(
  local: readonly ExcalidrawElement[],
  remote: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const byId = new Map<string, ExcalidrawElement>();
  for (const el of local) byId.set(el.id, el);

  for (const el of remote) {
    const existing = byId.get(el.id);
    if (!existing) {
      byId.set(el.id, el);
      continue;
    }
    const lv = existing.version ?? 0;
    const rv = el.version ?? 0;
    if (rv > lv) {
      byId.set(el.id, el);
    } else if (rv === lv && (el.versionNonce ?? 0) < (existing.versionNonce ?? 0)) {
      byId.set(el.id, el);
    }
  }

  return Array.from(byId.values());
}
