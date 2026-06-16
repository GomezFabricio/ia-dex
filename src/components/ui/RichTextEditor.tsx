import { useEffect, useState } from 'react'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

// ---------------------------------------------------------------------------
// RichTextEditor — a controlled WYSIWYG input for the publication body.
//
// CONTROLLED-COMPONENT CONTRACT: the parent owns `value` (an HTML string) and
// `onChange`. The component mirrors that string in a TipTap document, but the
// parent's state is the single source of truth — exactly like a controlled
// <input>. Two editing modes share that one value:
//   - 'visual' — TipTap toolbar + EditorContent
//   - 'html'   — a raw <textarea> exposing the underlying HTML
// Switching modes never loses content because both read/write the same `value`.
//
// EMPTY-DOC SUBTLETY ('' vs '<p></p>'): an empty TipTap document serializes to
// '<p></p>', NOT ''. The parent form relies on `cuerpo === '' ? null` to store
// NULL for an empty body. So onUpdate emits '' (not '<p></p>') when the editor
// isEmpty, keeping the empty-means-null contract intact. The external-value
// sync effect compares against the same isEmpty-aware "current" string so it
// never fights the editor or clobbers the caret on every keystroke.
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  id?: string
  placeholder?: string
}

type Mode = 'visual' | 'html'

// Reactive toolbar snapshot. Every button's active/disabled state is derived
// here so a single useEditorState subscription drives the whole toolbar.
interface ToolbarState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  heading2: boolean
  heading3: boolean
  bulletList: boolean
  orderedList: boolean
  blockquote: boolean
  code: boolean
  link: boolean
  canUndo: boolean
  canRedo: boolean
}

// All-off fallback. useEditorState returns null while the editor is null
// (immediatelyRender:false defers creation), so we coalesce to this so the
// toolbar always reads a concrete state.
const TOOLBAR_OFF: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  heading2: false,
  heading3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  code: false,
  link: false,
  canUndo: false,
  canRedo: false,
}

export default function RichTextEditor({
  value,
  onChange,
  id,
  placeholder,
}: RichTextEditorProps) {
  const [mode, setMode] = useState<Mode>('visual')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  // External-value sync: re-seed the editor only when `value` genuinely differs
  // from what the editor currently holds (async edit-form hydration, or coming
  // back from HTML mode). Comparing against the isEmpty-aware current string
  // avoids both the update loop and caret clobbering on every keystroke.
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  // Reactive toolbar state. The selector guards a null editor; useEditorState
  // itself returns null until the editor exists (immediatelyRender:false), so
  // coalesce to TOOLBAR_OFF below for a concrete, non-null toolbar state.
  const editorState = useEditorState<ToolbarState>({
    editor,
    selector: ({ editor }): ToolbarState => {
      if (!editor) return TOOLBAR_OFF
      return {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        heading2: editor.isActive('heading', { level: 2 }),
        heading3: editor.isActive('heading', { level: 3 }),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        blockquote: editor.isActive('blockquote'),
        code: editor.isActive('code'),
        link: editor.isActive('link'),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      }
    },
  })
  const toolbar = editorState ?? TOOLBAR_OFF

  // Link prompt: window.prompt is fine here (admin-only UI, keep it simple). A
  // non-empty URL sets/updates the link over the current selection; empty or
  // cancelled while a link is active removes it.
  function handleLink() {
    if (!editor) return
    const href = window.prompt('URL del enlace (vacío para quitar)')
    if (href === null) return
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  // Shared button classes: matte by default, accent outline when active.
  const baseBtn =
    'rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent/60 hover:text-text disabled:opacity-40'
  const activeBtn = 'border-accent text-accent bg-accent/15'
  const btnClass = (active: boolean) => `${baseBtn} ${active ? activeBtn : ''}`

  return (
    <div className="bg-bg border border-border rounded-lg transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
        {mode === 'visual' && (
          <>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={btnClass(toolbar.bold)}
              aria-label="Negrita"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={btnClass(toolbar.italic)}
              aria-label="Cursiva"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={btnClass(toolbar.underline)}
              aria-label="Subrayado"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              className={btnClass(toolbar.strike)}
              aria-label="Tachado"
            >
              <s>S</s>
            </button>

            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={btnClass(toolbar.heading2)}
              aria-label="Título 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              className={btnClass(toolbar.heading3)}
              aria-label="Título 3"
            >
              H3
            </button>

            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={btnClass(toolbar.bulletList)}
              aria-label="Lista con viñetas"
            >
              • Lista
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={btnClass(toolbar.orderedList)}
              aria-label="Lista numerada"
            >
              1. Lista
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={btnClass(toolbar.blockquote)}
              aria-label="Cita"
            >
              ❝
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleCode().run()}
              className={btnClass(toolbar.code)}
              aria-label="Código en línea"
            >
              {'</>'}
            </button>
            <button
              type="button"
              onClick={handleLink}
              className={btnClass(toolbar.link)}
              aria-label="Enlace"
            >
              🔗
            </button>

            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

            <button
              type="button"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!toolbar.canUndo}
              className={btnClass(false)}
              aria-label="Deshacer"
            >
              ↶
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!toolbar.canRedo}
              className={btnClass(false)}
              aria-label="Rehacer"
            >
              ↷
            </button>
          </>
        )}

        {/* Mode toggle — pushed to the right */}
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'visual' ? 'html' : 'visual'))}
          className={`${baseBtn} ml-auto`}
          aria-label={mode === 'visual' ? 'Editar HTML' : 'Editor visual'}
        >
          {mode === 'visual' ? 'HTML' : 'Visual'}
        </button>
      </div>

      {/* Editable area */}
      {mode === 'visual' ? (
        <EditorContent
          editor={editor}
          id={id}
          className="dex-prose min-h-[16rem] cursor-text px-3 py-2"
        />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-text min-h-[16rem] w-full resize-y bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:outline-none"
          placeholder={placeholder}
        />
      )}
    </div>
  )
}
