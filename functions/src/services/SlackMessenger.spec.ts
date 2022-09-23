import SlackMessenger from './SlackMessenger'
import {appConfig} from '../models/AppConfig'

let messenger: SlackMessenger

beforeEach(() => {
  messenger = new SlackMessenger(appConfig.slack.apikey)
})

describe('SlackMessenger', () => {
  it('should respond with user info', async () => {
    const userInfo = await messenger.fetchUser('U03J9FTHH8B')
    expect(userInfo).toStrictEqual({
      id: 'U03J9FTHH8B',
      isBot: true,
      botId: 'B03J6LUQCFP',
    })
  })
})
