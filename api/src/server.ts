import './register-path-alias'
import './instrument'

import { createApp } from '@/app/app-bootstrap'
;(async () => {
  const app = await createApp()

  await app.boostrap()
  await app.start()
})()
  .then((r) => console.log(r))
  .catch((e) => console.log(e))
