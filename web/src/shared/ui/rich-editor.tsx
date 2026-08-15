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

    editor?.commands.setContent(value ?? '')
  }, [value, editor])

  return (
    <Root data-disabled={disabled || undefined}>
      {showEditPanel && (
        <Toolbar gap={'1'} align={'center'}>
          <CustomIconButton
            variant="ghost"
            onClick={() => editor?.chain().focus().undo().run()}
            color={'gray'}
            type={'button'}
          >
            <ResetIcon />
          </CustomIconButton>
          <CustomIconButton
            variant="ghost"
            onClick={() => editor?.chain().focus().redo().run()}
            style={{ transform: 'scaleX(-1)' }}
            color={'gray'}
            type={'button'}
          >
            <ResetIcon />
          </CustomIconButton>
          <Separator orientation="vertical" />
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive('bold') || undefined}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            color={'gray'}
            type={'button'}
          >
            <FontBoldIcon />
          </CustomIconButton>
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive('italic') || undefined}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            color={'gray'}
            type={'button'}
          >
            <FontItalicIcon />
          </CustomIconButton>
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive('underline') || undefined}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            color={'gray'}
            type={'button'}
          >
            <UnderlineIcon />
          </CustomIconButton>
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive('strike') || undefined}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            color={'gray'}
            type={'button'}
          >
            <StrikethroughIcon />
          </CustomIconButton>
          <Separator orientation="vertical" />
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive({ textAlign: 'left' }) || undefined}
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            color={'gray'}
            type={'button'}
          >
            <TextAlignLeftIcon />
          </CustomIconButton>
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive({ textAlign: 'center' }) || undefined}
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            color={'gray'}
            type={'button'}
          >
            <TextAlignCenterIcon />
          </CustomIconButton>
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive({ textAlign: 'right' }) || undefined}
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            color={'gray'}
            type={'button'}
          >
            <TextAlignRightIcon />
          </CustomIconButton>
          <CustomIconButton
            variant="ghost"
            data-active={
              editor?.isActive({ textAlign: 'justify' }) || undefined
            }
            onClick={() =>
              editor?.chain().focus().setTextAlign('justify').run()
            }
            color={'gray'}
            type={'button'}
          >
            <TextAlignJustifyIcon />
          </CustomIconButton>
          <Separator orientation="vertical" />
          <CustomIconButton
            variant="ghost"
            data-active={editor?.isActive('link') || undefined}
            color={'gray'}
            onClick={() => {
              const url = window.prompt(t('profile.editor.linkPrompt'))
              if (url) {
                editor?.chain().focus().setLink({ href: url }).run()
              }
            }}
            type={'button'}
          >
            <Link2Icon />
          </CustomIconButton>
        </Toolbar>
      )}
      <Content>
        <Editor disabled={disabled} editor={editor} id={id} />
      </Content>
    </Root>
  )
}

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
