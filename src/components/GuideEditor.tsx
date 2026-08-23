'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { uploadGuideImage } from '@/lib/guideUpload'
import { Callout, type CalloutKind } from '@/lib/tiptapCallout'

interface Props {
  content: string
  onChange: (html: string) => void
}

// Éditeur riche admin-only pour le contenu des guides (titres, listes, citations,
// tableaux, checklists, encadrés astuce/attention, images uploadées vers le bucket
// dédié guide-images, vidéos YouTube embarquées). Le HTML produit est sanitisé côté
// serveur avant affichage public (voir src/app/guides/[slug]/page.tsx) — toute
// extension ajoutée ici doit avoir son équivalent dans la liste blanche là-bas,
// sinon son rendu disparaît silencieusement sur la page publique.
export default function GuideEditor({ content, onChange }: Props) {
  const { dark } = useTheme()
  const { t } = useLang()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 embarque désormais link + underline en interne — désactivés ici
      // pour ne pas entrer en conflit avec nos propres instances configurées ci-dessous
      // (Tiptap logue "Duplicate extension names" et le dernier gagne silencieusement sinon).
      StarterKit.configure({ link: false, underline: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, HTMLAttributes: { style: 'max-width:100%;border-radius:8px;' } }),
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { style: 'max-width:100%;border-radius:8px;' } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Callout,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        style: `min-height:320px; padding:16px; outline:none; font-size:15px; line-height:1.6; color:${dark ? '#e0e0e0' : '#222'};`,
      },
    },
  })

  if (!editor) return null

  const addImage = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const url = await uploadGuideImage(file, 'content/')
      if (url) editor.chain().focus().setImage({ src: url }).run()
    }
    input.click()
  }

  const addYoutube = () => {
    const url = window.prompt(t('editor_youtube_prompt'))
    if (!url) return
    editor.chain().focus().setYoutubeVideo({ src: url }).run()
  }

  const addLink = () => {
    // Pré-remplit avec le lien existant si le curseur est déjà dessus, et vider le
    // champ (au lieu d'annuler) retire le lien — jusqu'ici aucun moyen d'en enlever un.
    const previousUrl = editor.getAttributes('link').href || ''
    const url = window.prompt(t('editor_link_prompt'), previousUrl)
    if (url === null) return
    if (url.trim() === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const toggleCallout = (kind: CalloutKind) => {
    if (editor.isActive('callout', { calloutKind: kind })) editor.chain().focus().unsetCallout().run()
    else editor.chain().focus().setCallout(kind).run()
  }

  const border = dark ? '#2a2a2a' : '#eee'
  const btnBase: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', background: dark ? '#2a2a2a' : '#fafafa', color: dark ? '#e0e0e0' : '#333',
  }
  const btnActive: React.CSSProperties = { ...btnBase, background: '#003DA6', color: 'white', borderColor: '#003DA6' }
  const sep: React.CSSProperties = { width: 1, alignSelf: 'stretch', background: border, margin: '0 2px' }

  const ToolbarButton = ({ active, onClick, label, disabled }: { active: boolean; onClick: () => void; label: string; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...(active ? btnActive : btnBase), opacity: disabled ? 0.4 : 1 }}>{label}</button>
  )

  const inTable = editor.isActive('table')

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderBottom: `1px solid ${border}`, background: dark ? '#1a1a1a' : '#f7f8fa' }}>
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label={t('editor_bold')} />
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label={t('editor_italic')} />
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} label={t('editor_underline')} />
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} label={t('editor_strike')} />
        <ToolbarButton active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} label={t('editor_highlight')} />
        <div style={sep} />
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label={t('editor_h2')} />
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label={t('editor_h3')} />
        <div style={sep} />
        <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} label={t('editor_align_left')} />
        <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} label={t('editor_align_center')} />
        <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} label={t('editor_align_right')} />
        <div style={sep} />
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label={t('editor_bullet_list')} />
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label={t('editor_ordered_list')} />
        <ToolbarButton active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} label={t('editor_task_list')} />
        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label={t('editor_quote')} />
        <div style={sep} />
        <ToolbarButton active={editor.isActive('callout', { calloutKind: 'tip' })} onClick={() => toggleCallout('tip')} label={t('editor_callout_tip')} />
        <ToolbarButton active={editor.isActive('callout', { calloutKind: 'warning' })} onClick={() => toggleCallout('warning')} label={t('editor_callout_warning')} />
        <ToolbarButton active={editor.isActive('callout', { calloutKind: 'info' })} onClick={() => toggleCallout('info')} label={t('editor_callout_info')} />
        <div style={sep} />
        <ToolbarButton active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} label={t('editor_divider')} />
        <ToolbarButton active={inTable} onClick={insertTable} label={t('editor_table')} />
        {inTable && (
          <>
            <ToolbarButton active={false} onClick={() => editor.chain().focus().addColumnAfter().run()} label={t('editor_table_add_col')} />
            <ToolbarButton active={false} onClick={() => editor.chain().focus().addRowAfter().run()} label={t('editor_table_add_row')} />
            <ToolbarButton active={false} onClick={() => editor.chain().focus().deleteColumn().run()} label={t('editor_table_del_col')} />
            <ToolbarButton active={false} onClick={() => editor.chain().focus().deleteRow().run()} label={t('editor_table_del_row')} />
            <ToolbarButton active={false} onClick={() => editor.chain().focus().deleteTable().run()} label={t('editor_table_delete')} />
          </>
        )}
        <div style={sep} />
        <ToolbarButton active={editor.isActive('link')} onClick={addLink} label={t('editor_link')} />
        <ToolbarButton active={false} onClick={addImage} label={t('editor_image')} />
        <ToolbarButton active={false} onClick={addYoutube} label={t('editor_youtube')} />
      </div>
      <EditorContent editor={editor} className="guide-editor-content" style={{ background: dark ? '#121212' : 'white' }} />
    </div>
  )
}
