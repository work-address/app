/*
Сборка роута с параметрами:

  crud: {
    schema: '/crud/edit/:id',
    build: (id: string) => `/crud/edit/${id}`,
  }


Вложенные роуты:

  nestedRoute: {
    schema: '/nested',

    innerRoute: {
      schema: '/nested/inner
    }
  }
*/

export const router = {
  signIn: {
    schema: '/sign-in',
  },
  dashboard: {
    schema: '/',
  },
  profile: {
    schema: '/profile',
  },
}
