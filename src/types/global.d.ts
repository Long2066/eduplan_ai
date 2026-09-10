export {};

declare global {
  interface Window {
    eduplanDesktop?: {
      platform: string;
    };
  }
}
