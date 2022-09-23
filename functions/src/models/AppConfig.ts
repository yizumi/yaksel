import * as functions from 'firebase-functions'

export interface AppConfig {
  app: {
    realtime_database_url: string
  }
  deepl: {
    apikey: string
  }
  slack: {
    apikey: string
  }
}

export const appConfig = (() => {
  if (process.env.NODE_ENV === 'development') {
    console.info('Using local .appConfig.local')
    return require('../.appConfig.local.ts').appConfig
  }
  console.info('Using functions config')
  return functions.config() as AppConfig
})()

