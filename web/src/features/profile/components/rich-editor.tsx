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
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

type RichEditorProps = {
  value?: string
  onChange?: (value: string) => void
  id?: string
}

export const RichEditor = ({ value, onChange }: RichEditorProps) => {
  const { t } = useTranslation()
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  })

  useEffect(() => {
    editor?.on('selectionUpdate', forceUpdate)
    editor?.on('transaction', forceUpdate)
    return () => {
      editor?.off('selectionUpdate', forceUpdate)
      editor?.off('transaction', forceUpdate)
    }
  }, [editor])

  return (
    <Wrapper>
      <FlexToolbar gap={'1'} align={'center'}>
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
          data-active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          color={'gray'}
          type={'button'}
        >
          <FontBoldIcon />
        </CustomIconButton>

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          color={'gray'}
          type={'button'}
        >
          <FontItalicIcon />
        </CustomIconButton>

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          color={'gray'}
          type={'button'}
        >
          <UnderlineIcon />
        </CustomIconButton>

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive('strike')}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          color={'gray'}
          type={'button'}
        >
          <StrikethroughIcon />
        </CustomIconButton>

        <Separator orientation="vertical" />

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive({ textAlign: 'left' })}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          color={'gray'}
          type={'button'}
        >
          <TextAlignLeftIcon />
        </CustomIconButton>

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive({ textAlign: 'center' })}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          color={'gray'}
          type={'button'}
        >
          <TextAlignCenterIcon />
        </CustomIconButton>

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive({ textAlign: 'right' })}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          color={'gray'}
          type={'button'}
        >
          <TextAlignRightIcon />
        </CustomIconButton>

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive({ textAlign: 'justify' })}
          onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          color={'gray'}
          type={'button'}
        >
          <TextAlignJustifyIcon />
        </CustomIconButton>

        <Separator orientation="vertical" />

        <CustomIconButton
          variant="ghost"
          data-active={editor?.isActive('link')}
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
      </FlexToolbar>

      <EditorWrapper>
        <EditorContent editor={editor} id={id} />
      </EditorWrapper>
    </Wrapper>
  )
}

const Wrapper = styled.div`
  border: 1px solid var(--gray-6);
  border-radius: var(--radius-3);
  overflow: hidden;
`

const FlexToolbar = styled(Flex)`
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--gray-6);

  [data-active='true'] {
    background-color: var(--accent-3) !important;
    color: var(--ds-accent-11) !important;
  }
`

const CustomIconButton = styled(IconButton)`
  margin: 0;
`

const Separator = styled(RadixSeparator)`
  height: 24px;
`

const EditorWrapper = styled.div`
  padding: var(--space-3);
  min-height: 120px;

  .tiptap {
    outline: none;
    font-size: var(--font-size-2);
    line-height: var(--line-height-2);

    p {
      margin: 0;
    }
  }
`
