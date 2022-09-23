import * as functions from 'firebase-functions'

import DeepL from './services/DeepL'
import FirebasePersistence from './services/FirebasePersistor'
import SlackMessenger from './services/SlackMessenger'
import Yaksel from './services/Yaksel'
import {appConfig} from './models/AppConfig'

const translator = new DeepL(appConfig.deepl.apikey)
const persistor = new FirebasePersistence(appConfig.app.realtime_database_url)
const messenger = new SlackMessenger(appConfig.slack.apikey)
const logger = functions.logger

const yaksel = new Yaksel({
  translator: translator,
  persistor: persistor,
  messenger: messenger,
  logger: logger,
})

export const translate = functions.https.onRequest(async (req, res) => {
  const {challenge, event} = req.body

  if (challenge) {
    res.send({challenge})
    return
  }

  await yaksel.handleEvent(event)
  res.send({message: 'success'})
})
