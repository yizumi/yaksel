import * as functions from 'firebase-functions'

import DeepL from './services/DeepL'
import FirebasePersistence from './services/FirebasePersistor'
import SlackMessenger from './services/SlackMessenger'
import Yaksel from './services/Yaksel'
import {getAppConfig} from './models/GetAppConfig'

let __yaksel: Yaksel

async function getYakselInstance() {
  if (!__yaksel) {
    const appConfig = await getAppConfig()

    const translator = new DeepL(appConfig.deepl.apikey)
    const persistor = new FirebasePersistence(appConfig.app.realtime_database_url)
    const messenger = new SlackMessenger(appConfig.slack.apikey)
    const logger = functions.logger

    __yaksel = new Yaksel({
      translator: translator,
      persistor: persistor,
      messenger: messenger,
      logger: logger,
    })
  }
  return __yaksel
}

export const translate = functions.https.onRequest(async (req, res) => {
  const {challenge, event} = req.body

  if (challenge) {
    res.send({challenge})
    return
  }

  await (await getYakselInstance()).handleEvent(event)
  res.send({message: 'success'})
})
