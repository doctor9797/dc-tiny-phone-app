export type WorldType = 'ancient-scroll' | 'cyber-hud' | 'broken' | 'ritual';

export interface WorldDetailProps {
  config: { background: string; theme: string };
  onStart: () => void;
  onExit: () => void;
}

export interface WorldOption {
  type: WorldType;
  label: string;
  subtitle: string;
  description: string;
}
