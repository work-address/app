import {
  FontBoldIcon,
  FontItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  TextAlignJustifyIcon,
  Link2Icon,
  ResetIcon,
} from '@radix-ui/react-icons'
import { Flex, IconButton, Separator as RadixSeparator } from '@radix-ui/themes'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useReducer } from 'react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Tooltip } from './tooltip'

import type { CSSProperties, ReactNode } from 'react'

type RichEditorProps = {
  value?: string
  onChange?: (value: string) => void
  id?: string
  showEditPanel?: boolean
  disabled?: boolean
}

export const RichEditor = ({
  value,
  onChange,
  id,
  showEditPanel = true,
  disabled,
}: RichEditorProps) => {
  const { t } = useTranslation()
  const [, forceUpdate] = useReducer((x) => x + 1, 0)
  const isInternalUpdateRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      isInternalUpdateRef.current = true
      onChange?.(editor.getHTML())
    },
  })

  useEffect(() => {
    editor?.on('selectionUpdate', forceUpdate)
    editor?.on('transaction', forceUpdate)
    return () => {
      editor?.off('selectionUpdate', forceUpdate)
      editor?.off('transaction', forceUpdate)
    }
  }, [editor])

  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false
      return
    }

    // React runs effects twice in development, and the first run's editor is
    // already destroyed by the time the second fires - calling into it throws.
    if (!editor || editor.isDestroyed) {
      return
    }

    editor.commands.setContent(value ?? '')
  }, [value, editor])

  return (
    <Root data-disabled={disabled || undefined}>
      {showEditPanel && (
        <Toolbar gap={'1'} align={'center'}>
          <ToolbarButton
            label={t('ui.editor.undo')}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <ResetIcon />
          </ToolbarButton>
          <ToolbarButton
            label={t('ui.editor.redo')}
            onClick={() => editor?.chain().focus().redo().run()}
            style={{ transform: 'scaleX(-1)' }}
          >
            <ResetIcon />
          </ToolbarButton>
          <Separator orientation="vertical" />
          <ToolbarButton
            label={t('ui.editor.bold')}
            active={editor?.isActive('bold')}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <FontBoldIcon />
          </ToolbarButton>
          <ToolbarButton
            label={t('ui.editor.italic')}
            active={editor?.isActive('italic')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <FontItalicIcon />
          </ToolbarButton>
          <ToolbarButton
            label={t('ui.editor.underline')}
            active={editor?.isActive('underline')}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </ToolbarButton>
          <ToolbarButton
            label={t('ui.editor.strike')}
            active={editor?.isActive('strike')}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <StrikethroughIcon />
          </ToolbarButton>
          <Separator orientation="vertical" />
          <ToolbarButton
            label={t('ui.editor.alignLeft')}
            active={editor?.isActive({ textAlign: 'left' })}
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          >
            <TextAlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton
            label={t('ui.editor.alignCenter')}
            active={editor?.isActive({ textAlign: 'center' })}
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          >
            <TextAlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton
            label={t('ui.editor.alignRight')}
            active={editor?.isActive({ textAlign: 'right' })}
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          >
            <TextAlignRightIcon />
          </ToolbarButton>
          <ToolbarButton
            label={t('ui.editor.alignJustify')}
            active={editor?.isActive({ textAlign: 'justify' })}
            onClick={() =>
              editor?.chain().focus().setTextAlign('justify').run()
            }
          >
            <TextAlignJustifyIcon />
          </ToolbarButton>
          <Separator orientation="vertical" />
          <ToolbarButton
            label={t('ui.editor.link')}
            active={editor?.isActive('link')}
            onClick={() => {
              const url = window.prompt(t('profile.editor.linkPrompt'))
              if (url) {
                editor?.chain().focus().setLink({ href: url }).run()
              }
            }}
          >
            <Link2Icon />
          </ToolbarButton>
        </Toolbar>
      )}
      <Content>
        <Editor disabled={disabled} editor={editor} id={id} />
      </Content>
    </Root>
  )
}

type ToolbarButtonProps = {
  label: string
  active?: boolean
  onClick: () => void
  style?: CSSProperties
  children: ReactNode
}

/**
 * A toolbar icon plus the two things an icon alone cannot carry: a tooltip for
 * sighted users and an accessible name for everyone else. Both come from the
 * same string, so they cannot describe different buttons.
 */
const ToolbarButton = ({
  label,
  active,
  onClick,
  style,
  children,
}: ToolbarButtonProps) => (
  <Tooltip content={label}>
    <CustomIconButton
      variant="ghost"
      color={'gray'}
      type={'button'}
      aria-label={label}
      aria-pressed={active}
      data-active={active || undefined}
      onClick={onClick}
      style={style}
    >
      {children}
    </CustomIconButton>
  </Tooltip>
)

const Root = styled.div`
  border: 1px solid var(--gray-6);
  border-radius: var(--radius-3);
  overflow: hidden;

  &[data-disabled] {
    pointer-events: none;
    cursor: not-allowed;
    background-color: var(--gray-3);
    opacity: 0.6;

    .tiptap {
      color: var(--gray-8);
    }

    div[contenteditable] {
      cursor: not-allowed;
    }
  }
`

const Toolbar = styled(Flex)`
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--gray-6);
`

const CustomIconButton = styled(IconButton)`
  margin: 0;

  /* Radix IconButton's own ghost-variant rule sets background/color for this
     class; doubling our generated class beats it without reaching for !important. */
  &&[data-active] {
    background-color: var(--ds-accent-3);
    color: var(--ds-accent-11);
  }
`

const Separator = styled(RadixSeparator)`
  height: 24px;
`

const Content = styled.div`
  padding: var(--space-3);

  .tiptap {
    outline: none;
    font-size: var(--font-size-2);
    line-height: var(--line-height-2);

    p {
      margin: 0;
    }
  }
`

const Editor = styled(EditorContent)`
  ${(p) => p.theme.breakpoints.down('md')} {
    div[contenteditable='true'] {
      font-size: var(--font-size-3);
    }
  }

  div[contenteditable='true'] {
    min-height: 120px;
  }
`
