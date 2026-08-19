'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

interface Props {
  content: string
  onChange: (html: string) => void
}

// Éditeur riche admin-only pour le contenu des guides (titres, listes, citations,
// images uploadées vers le bucket dédié guide-images, vidéos YouTube embarquées).
// Le HTML produit est sanitisé côté serveur avant affichage public (voir
// src/app/guides/[slug]/page.tsx) — cet éditeur n'a donc pas besoin de se soucier
// lui-même de la sécurité du HTML qu'il génère.
export default function GuideEditor({ content, onChange }: Props) {
  const { dark } = useTheme()
  const { t } = useLang()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, HTMLAttributes: { style: 'max-width:100%;border-radius:8px;' } }),
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { style: 'max-width:100%;border-radius:8px;' } }),
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
      if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo)'); return }
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('guide-images').upload(path, file)
      if (error) { toast.error("Erreur d'upload : " + error.message); return }
      const { data } = supabase.storage.from('guide-images').getPublicUrl(path)
      editor.chain().focus().setImage({ src: data.publicUrl }).run()
    }
    input.click()
  }

  const addYoutube = () => {
    const url = window.prompt(t('editor_youtube_prompt'))
    if (!url) return
    editor.chain().focus().setYoutubeVideo({ src: url }).run()
  }

  const addLink = () => {
    const url = window.prompt(t('editor_link_prompt'))
    if (!url) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const border = dark ? '#2a2a2a' : '#eee'
  const btnBase: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', background: dark ? '#2a2a2a' : '#fafafa', color: dark ? '#e0e0e0' : '#333',
  }
  const btnActive: React.CSSProperties = { ...btnBase, background: '#003DA6', color: 'white', borderColor: '#003DA6' }

  const ToolbarButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button type="button" onClick={onClick} style={active ? btnActive : btnBase}>{label}</button>
  )

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderBottom: `1px solid ${border}`, background: dark ? '#1a1a1a' : '#f7f8fa' }}>
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label={t('editor_bold')} />
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label={t('editor_italic')} />
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label={t('editor_h2')} />
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label={t('editor_h3')} />
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label={t('editor_bullet_list')} />
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label={t('editor_ordered_list')} />
        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label={t('editor_quote')} />
        <ToolbarButton active={editor.isActive('link')} onClick={addLink} label={t('editor_link')} />
        <ToolbarButton active={false} onClick={addImage} label={t('editor_image')} />
        <ToolbarButton active={false} onClick={addYoutube} label={t('editor_youtube')} />
      </div>
      <EditorContent editor={editor} style={{ background: dark ? '#121212' : 'white' }} />
    </div>
  )
}
