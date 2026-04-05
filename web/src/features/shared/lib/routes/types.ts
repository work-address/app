/* eslint-disable @typescript-eslint/no-explicit-any */

export type BuildRoute<Params extends any> = (params: Params) => string

export type IdRouteBuild = BuildRoute<{ id: string }>

export type NoChildRoutes = undefined

export type Optional<
  Name extends string,
  Val extends any,
> = Val extends undefined
  ? { [key in Name]?: undefined }
  : { [key in Name]: Val }

export type Route<
  Schema extends string = string,
  Name extends string = string,
  Children extends Record<string, any> | undefined = undefined,
  Build extends BuildRoute<any> | undefined = undefined,
> = {
  [key in Name]: {
    schema: Schema
    showInMenu?: boolean
    disabled?: boolean
    desktopIcon?: string
    mobileIcon?: string
    translateKeyDesktop?: string
    translateKeyMobile?: string
    text?: string
    desktopOrder?: number
    mobileOrder?: number
    target?: '_blank'
    desktopRender?: 'textWithIcon' | 'text' | 'icon'
  } & Optional<'build', Build> &
    Optional<'children', Children>
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
