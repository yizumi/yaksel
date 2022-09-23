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

export async function getAppConfig() {
  if (process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test') {
    console.info('Using local .appConfig.local')
    const localConfig = await import('../.appConfig.local')
    return localConfig.appConfig
  }
  console.info('Using functions config')
  return functions.config() as AppConfig
}
