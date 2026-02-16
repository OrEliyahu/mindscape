'use client';

import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

interface ExcalidrawViewProps {
  onApi: (api: ExcalidrawImperativeAPI) => void;
  onSceneChange: (appState: AppState) => void;
}

export default function ExcalidrawView({ onApi, onSceneChange }: ExcalidrawViewProps) {
  return (
    <Excalidraw
      excalidrawAPI={onApi}
      viewModeEnabled={true}
      zenModeEnabled={true}
      onChange={(_elements, appState) => onSceneChange(appState)}
      UIOptions={{
        canvasActions: {
          saveToActiveFile: false,
          loadScene: false,
          clearCanvas: false,
          export: false,
          toggleTheme: false,
        },
      }}
    />
  );
}
