export interface AccountPageProps {
  onToggleTheme: () => void;
  isLightTheme: boolean;
}

export type ActiveSection =
  | 'profile'
  | 'explain'
  | 'transcriber'
  | 'text-processing'
  | 'lectures'
  | 'catalog'
  | 'catalog-moderation'
  | 'admin'
  | 'board';

export const getFilterModalSurface = (isLightTheme: boolean) => isLightTheme
  ? {
      background: 'linear-gradient(145deg, rgba(255, 255, 240, 0.98), rgba(248, 235, 220, 0.96))',
      border: '1px solid rgba(68, 41, 43, 0.12)',
      boxShadow: '0 40px 140px rgba(31, 21, 22, 0.25)'
    }
  : {
      background: 'linear-gradient(145deg, rgba(33, 24, 25, 0.97), rgba(18, 12, 14, 0.92))',
      border: '1px solid rgba(255, 255, 240, 0.08)',
      boxShadow: '0 40px 140px rgba(0, 0, 0, 0.65)'
    };

export const getFilterBadgeStyles = (isLightTheme: boolean) => isLightTheme
  ? { background: 'rgba(68, 41, 43, 0.08)', color: '#6d3d3f' }
  : { background: 'rgba(255, 255, 240, 0.08)', color: '#f5ead8' };

export const getFilterInfoSurface = (isLightTheme: boolean) => isLightTheme
  ? { background: 'rgba(68, 41, 43, 0.04)', border: '1px solid rgba(68, 41, 43, 0.12)' }
  : { background: 'rgba(255, 255, 240, 0.03)', border: '1px solid rgba(255, 255, 240, 0.08)' };

export const getPrimaryFilterButton = (isLightTheme: boolean) => isLightTheme
  ? { background: '#44292b', color: '#fff9f1', boxShadow: '0 20px 45px rgba(68, 41, 43, 0.35)' }
  : { background: '#fff8f0', color: '#1f1516', boxShadow: '0 25px 45px rgba(0, 0, 0, 0.45)' };

export const getSecondaryFilterButton = (isLightTheme: boolean) => isLightTheme
  ? { background: 'rgba(68, 41, 43, 0.06)', color: '#4e2e30', border: '1px solid rgba(68, 41, 43, 0.2)' }
  : { background: 'rgba(255, 255, 240, 0.02)', color: '#f1e6d7', border: '1px solid rgba(255, 255, 240, 0.08)' };

export const getErrorModalSurface = (isLightTheme: boolean) => isLightTheme
  ? {
      background: 'linear-gradient(145deg, rgba(255, 255, 240, 0.98), rgba(250, 238, 230, 0.96))',
      border: '1px solid rgba(68, 41, 43, 0.15)',
      boxShadow: '0 40px 120px rgba(34, 23, 24, 0.35)'
    }
  : {
      background: 'linear-gradient(145deg, rgba(31, 21, 22, 0.96), rgba(15, 10, 12, 0.92))',
      border: '1px solid rgba(255, 255, 240, 0.1)',
      boxShadow: '0 45px 120px rgba(0, 0, 0, 0.65)'
    };

export const getErrorAccentBadge = (isLightTheme: boolean) => isLightTheme
  ? { background: 'rgba(181, 132, 136, 0.15)', color: '#7f4c52' }
  : { background: 'rgba(255, 232, 225, 0.08)', color: '#f8d7cd' };

export const getErrorInfoSurface = (isLightTheme: boolean) => isLightTheme
  ? { background: 'rgba(181, 132, 136, 0.08)', border: '1px solid rgba(181, 132, 136, 0.3)', color: '#4b2d2f' }
  : { background: 'rgba(255, 248, 240, 0.04)', border: '1px solid rgba(255, 232, 225, 0.15)', color: '#f3d6cf' };

export const getErrorPrimaryButton = (isLightTheme: boolean) => isLightTheme
  ? { background: '#44292b', color: '#fff9f2', boxShadow: '0 20px 45px rgba(68, 41, 43, 0.35)' }
  : { background: '#fff8f0', color: '#1f1516', boxShadow: '0 25px 45px rgba(0, 0, 0, 0.45)' };

export const getThemeColors = (isLightTheme: boolean) => ({
  headingColor: isLightTheme ? '#2a1918' : '#fff7ec',
  bodyColor: isLightTheme ? '#4b2d2f' : '#f3e7d8',
  mutedColor: isLightTheme ? '#7a5a5c' : '#c6b7a7',
});
