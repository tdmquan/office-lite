import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { TabHandle } from '../types';

interface Props {
  bytes: Uint8Array;
  ext: string;
}

const FONT = 'Arial';

async function buildDocx(text: string): Promise<Uint8Array> {
  const lines = text.split(/\r?\n/);
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, font: FONT, size: 24 })],
      }),
  );
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

const WordTab = forwardRef<TabHandle, Props>(function WordTab({ bytes, ext }, ref) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (ext === 'doc') {
      setError('Định dạng .doc cũ chưa được hỗ trợ. Hãy mở bằng Word và lưu thành .docx.');
      setLoading(false);
      return;
    }
    const arrayBuffer = bytes.slice().buffer as ArrayBuffer;
    mammoth
      .extractRawText({ arrayBuffer })
      .then((result) => {
        if (cancelled) return;
        setText(result.value.replace(/\n+$/, ''));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bytes, ext]);

  const getBytes = useCallback(() => buildDocx(text), [text]);
  useImperativeHandle(ref, () => ({ getBytes }), [getBytes]);

  if (error) {
    return <div className="notice notice-error">{error}</div>;
  }

  return (
    <div className="word-tab">
      <div className="toolbar toolbar-sub">
        <span className="muted small">
          Soạn nội dung văn bản (chỉ lưu chữ, không giữ định dạng gốc) — font {FONT}
        </span>
      </div>
      {loading ? (
        <div className="notice">Đang đọc file Word…</div>
      ) : (
        <textarea
          className="word-editor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
});

export default WordTab;
