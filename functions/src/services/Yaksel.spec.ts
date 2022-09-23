import Yaksel, {Logger, Messenger, Persistor, Translator} from './Yaksel'

class MockPersistor implements Persistor {
  private readonly data: { [key: string]: any }
  constructor() {
    this.data = {}
  }

  select<T>(key: string): Promise<T> {
    return new Promise((resolve) => {
      resolve(this.data[key] as T)
    })
  }

  upsert<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      this.data[key] = value
      resolve(undefined)
    })
  }
}

let yaksel: Yaksel

beforeEach(() => {
  const mockMessenger: Messenger = {
    fetchMessage: jest.fn((channel: string, id: string) => Promise.resolve({
      text: 'こんにちは、赤ちゃん',
      kind: 'message',
      thread_ts: id,
    })),
    postMessage: jest.fn(() => Promise.resolve()),
    fetchUser: jest.fn(() => Promise.resolve(null)),
  }

  const mockTranslator: Translator = {
    translate: jest.fn(() => Promise.resolve('Hello, baby')),
  }

  const mockLogger: Logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const mockPersistor = new MockPersistor()

  yaksel = new Yaksel({
    messenger: mockMessenger,
    persistor: mockPersistor,
    translator: mockTranslator,
    logger: mockLogger,
  })
})

describe('Yaksel', () => {
  it('should post a translated slack message', async () => {
    await yaksel.handleEvent({
      type: 'reaction_added',
      reaction: 'english',
      event_ts: '1234',
      item: {
        channel: 'test',
        ts: '1234',
      },
    })

    expect(yaksel.messenger.postMessage).toBeCalledWith('test', {
      reply_broadcast: true,
      text: 'Hello, baby',
      thread_ts: '1234',
    })
  })

  it('should post a translated slack message with attachments', async () => {
    yaksel.messenger.fetchMessage = jest.fn(() => Promise.resolve({
      text: 'こんにちは、赤ちゃん',
      kind: 'message',
      thread_ts: '1234',
      attachments: [
        {
          text: '本当に困りました',
        },
      ],
    }))

    await yaksel.handleEvent({
      type: 'reaction_added',
      reaction: 'english',
      event_ts: '1234',
      item: {
        channel: 'test',
        ts: '1234',
      },
    })

    expect(yaksel.messenger.postMessage).toBeCalledWith('test', {
      reply_broadcast: true,
      text: 'Hello, baby',
      thread_ts: '1234',
      attachments: [{
        text: 'Hello, baby',
      }],
    })
  })

  it('should enable auto translate', async () => {
    yaksel.messenger.fetchUser = jest.fn(() => Promise.resolve({
      id: 'U1234567890',
      isBot: false,
      name: 'Yusuke',
    }))
    await yaksel.handleEvent({
      type: 'app_mention',
      text: '/<@U1234567890> enable autotranslate <@U1234567890> into en',
      channel: 'test',
    })
    expect(await yaksel.persistor.select<boolean>('/autotranslate/U1234567890')).toBe('en')
    expect(await yaksel.messenger.postMessage).toBeCalledWith('test', {
      text: 'You got it! All message from Yusuke will be automatically translated to English',
      reply_broadcast: false,
    })
  })

  it('should enable auto translate bot', async () => {
    yaksel.messenger.fetchUser = jest.fn(() => Promise.resolve({
      id: 'U03J9FTHH8B',
      isBot: true,
      botId: 'B03J6LUQCFP',
      name: 'PandaBot',
    }))

    await yaksel.handleEvent({
      type: 'app_mention',
      text: '<@U1234567890> enable autotranslate <@U03J9FTHH8B> into en',
      channel: 'test',
    })

    expect(await yaksel.persistor.select<boolean>('/autotranslate/B03J6LUQCFP')).toBe('en')
    expect(await yaksel.messenger.postMessage).toBeCalledWith('test', {
      text: 'You got it! All message from PandaBot will be automatically translated to English',
      reply_broadcast: false,
    })
  })

  it('should disable auto translate', async () => {
    yaksel.messenger.fetchUser = jest.fn(() => Promise.resolve({
      id: 'U1234567890',
      isBot: false,
      name: 'Yusuke',
    }))

    await yaksel.persistor.upsert('/autotranslate/U1234567890', 'en')
    await yaksel.handleEvent({
      type: 'app_mention',
      text: '/<@U1234567890> disable autotranslate <@U1234567890>',
      channel: 'test',
    })
    expect(await yaksel.persistor.select<boolean>('/autotranslate/U1234567890')).toBeFalsy()
    expect(await yaksel.messenger.postMessage).toBeCalledWith('test', {
      text: 'You got it! Auto-translate disabled for Yusuke',
      reply_broadcast: false,
    })
  })

  it('should disable auto translate bot', async () => {
    yaksel.messenger.fetchUser = jest.fn(() => Promise.resolve({
      id: 'U03J9FTHH8B',
      isBot: true,
      botId: 'B03J6LUQCFP',
      name: 'PandaBot',
    }))

    await yaksel.persistor.upsert('/autotranslate/B03J6LUQCFP', 'en')
    await yaksel.handleEvent({
      type: 'app_mention',
      text: '/<@U1234567890> disable autotranslate <@U03J9FTHH8B>',
      channel: 'test',
    })
    expect(await yaksel.persistor.select<boolean>('/autotranslate/B03J6LUQCFP')).toBeFalsy()
    expect(await yaksel.messenger.postMessage).toBeCalledWith('test', {
      text: 'You got it! Auto-translate disabled for PandaBot',
      reply_broadcast: false,
    })
  })

  it('should not auto translate if user is not registered', async () => {
    await yaksel.handleEvent({
      type: 'message',
      channel: 'C024BE91L',
      user: 'U2147483697',
      text: 'Live long and prospect.',
      ts: '1355517523.000005',
      event_ts: '1355517523.000005',
    })
    expect(yaksel.messenger.postMessage).not.toBeCalled()
  })

  it('should auto translate if user is registered', async () => {
    await yaksel.persistor.upsert('/autotranslate/U1234567890', 'en')
    await yaksel.handleEvent({
      type: 'message',
      text: 'これで泉さんが言ったことはすべて英語に自動翻訳されます',
      user: 'U1234567890',
      ts: '1663744530.106939',
      channel: 'C042WBT763B',
      event_ts: '1663744530.106939',
    })
    expect(yaksel.messenger.postMessage).toBeCalledWith('C042WBT763B', {
      reply_broadcast: true,
      text: 'Hello, baby',
      thread_ts: '1663744530.106939',
    })
    expect(yaksel.persistor.select('/channels/C042WBT763B/1663744530_106939')).toBeTruthy()
  })

  it('should auto translate if bot is registered', async () => {
    await yaksel.persistor.upsert('/autotranslate/B03J6LUQCFP', 'en')

    await yaksel.handleEvent({
      type: 'message',
      text: 'これでアプリが言ったことはすべて英語に自動翻訳されます',
      bot_id: 'B03J6LUQCFP',
      ts: '1663744530.106939',
      channel: 'C042WBT763B',
      event_ts: '1663744530.106939',
    })

    expect(yaksel.messenger.postMessage).toBeCalledWith('C042WBT763B', {
      reply_broadcast: true,
      text: 'Hello, baby',
      thread_ts: '1663744530.106939',
    })

    expect(yaksel.persistor.select('/channels/C042WBT763B/1663744530_106939')).toBeTruthy()
  })
})
