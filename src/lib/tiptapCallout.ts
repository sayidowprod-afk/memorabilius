import { Node, mergeAttributes } from '@tiptap/core'

export type CalloutKind = 'tip' | 'warning' | 'info'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (kind: CalloutKind) => ReturnType
      unsetCallout: () => ReturnType
    }
  }
}

// Encadré "astuce/attention/info" façon Notion — pas d'extension Tiptap officielle
// pour ça, donc node custom. Rendu en <div data-callout="tip|warning|info"> (jamais
// de `class`/`style` arbitraire) pour rester filtrable par une liste blanche stricte
// côté sanitize-html (src/app/guides/[slug]/page.tsx) — les couleurs viennent d'une
// règle CSS scoped sur [data-callout] dans globals.css, pas du HTML généré ici.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      calloutKind: {
        default: 'tip',
        parseHTML: el => el.getAttribute('data-callout') || 'tip',
        renderHTML: attrs => ({ 'data-callout': attrs.calloutKind }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setCallout: (kind: CalloutKind) => ({ commands }) => {
        return commands.wrapIn(this.name, { calloutKind: kind })
      },
      unsetCallout: () => ({ commands }) => {
        return commands.lift(this.name)
      },
    }
  },
})
