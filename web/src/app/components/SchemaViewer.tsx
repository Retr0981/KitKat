import Editor, { type OnMount } from '@monaco-editor/react';

/**
 * Read-only JSON viewer built on Monaco. Wrapped so the two apps (web +
 * extension) share the same KitKat dark theme. Editable mode for the inline
 * editor.
 */
export function SchemaViewer({
  value,
  editable = false,
  onChange,
  height = '100%',
  language = 'json',
}: {
  value: unknown;
  editable?: boolean;
  onChange?: (v: string) => void;
  height?: string | number;
  language?: string;
}) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
  return (
    <Editor
      height={height}
      defaultLanguage={language}
      theme="vs-dark"
      value={text}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={((_e, monaco) => {
        monaco.editor.defineTheme('kitkat-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: { 'editor.background': '#0e1117' },
        });
        monaco.editor.setTheme('kitkat-dark');
      }) as OnMount}
      options={{
        readOnly: !editable,
        minimap: { enabled: false },
        fontSize: 12.5,
        fontFamily: 'var(--font-mono)',
        lineNumbers: 'off',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderLineHighlight: 'none',
        padding: { top: 10 },
        automaticLayout: true,
        smoothScrolling: true,
      }}
    />
  );
}
