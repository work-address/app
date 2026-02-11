import {createApp} from './app/AppBootstrap';

(async () => {
  const app = await createApp();

  await app.boostrap();
  app.start();
})()
  .then(r => console.log(r))
  .catch(e => console.log(e));
