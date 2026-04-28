import { createApp } from './app/app-bootstrap'
;(async () => {
  const app = await createApp()

  await app.boostrap()
  app.start()
})()
  .then((r) => console.log(r))
  .catch((e) => console.log(e))
