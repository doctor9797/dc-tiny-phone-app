export interface ThemeProps {
  config: { background: string; theme: string };
  onExit: () => void;
  onStart: () => void;
}
