/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IconProps } from '@radix-ui/react-icons/dist/types'
import type { ComponentType } from 'react'

export type BuildRoute<Params extends any = void> = (params: Params) => string

export type IdRouteParams = { id: string }

export type NoChildRoutes = undefined

export type Optional<
  Name extends string,
  Val extends any,
  InjectingType extends any = Val,
> = Val extends undefined
  ? { [key in Name]?: undefined }
  : { [key in Name]: InjectingType }

export type Route<
  Schema extends string = string,
  Name extends string = string,
  Children extends Record<string, any> | void = undefined,
  BuildArgs extends Record<string, any> | void = void,
> = {
  [key in Name]: {
    schema: Schema
    showInMenu?: boolean
    disabled?: boolean
    /** Drawn beside the label in both menus, so a link reads the same everywhere. */
    icon?: ComponentType<IconProps>
    translateKeyDesktop?: string
    translateKeyMobile?: string
    text?: string
    desktopOrder?: number
    mobileOrder?: number
    target?: '_blank'
    desktopRender?: 'text' | 'icon'
    build: BuildRoute<BuildArgs>
  } & Optional<'children', Children>
}

export type MappingRoute = Route<
  string,
  'data',
  any,
  BuildRoute<Record<string, string>>
>['data'] & {
  key: string
  children?: MappingRoute
}
