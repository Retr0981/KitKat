import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

/**
 * JSON Schema / payload viewer built on Monaco. Read-only by default, with an
 * editable mode for the Sandbox. Bundled into the DevTools panel (normal page
 * context — web workers work cleanly there). The popup uses a lightweight
 * <pre> instead to stay fast.
 */
export function SchemaViewer({
  value,
  editable = false,
  onChange,
  height = '100%',
}: {
  value: unknown;
  editable?: boolean;
  onChange?: (v: string) => void;
  height?: string | number;
}) {
  const mounted = useRef<OnMount | null>(null);

  useEffect(() => {
    // Configure Monaco's theme once.
  }, []);

  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);

  return (
    <Editor
      height={height}
      defaultLanguage="json"
      theme="vs-dark"
      value={text}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={((_, monaco) => {
        mounted.current = monaco as any;
        monaco.editor.defineTheme('kitkat-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: { 'editor.background': '#0f1218' },
        });
        monaco.editor.setTheme('kitkat-dark');
      }) as OnMount}
      options={{
        readOnly: !editable,
        minimap: { enabled: false },
        fontSize: 12.5,
        fontFamily: '"JetBrains Mono", monospace',
        lineNumbers: 'off',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderLineHighlight: 'none',
        padding: { top: 8 },
        automaticLayout: true,
      }}
    />
  );
}
