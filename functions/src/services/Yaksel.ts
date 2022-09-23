import {Attachment} from
  '@slack/web-api/dist/response/ConversationsHistoryResponse'

import {
  SlackEvent,
  IncomingMessage,
  OutgoingMessage, UserInfo,
} from '../models/Message'
import invariant from 'ts-invariant'

export type SUPPORTED_LANGUAGE = 'en' | 'ja' | 'vn';

export const TARGET_LANGUAGES: { [key: string]: SUPPORTED_LANGUAGE} = {
  'english': 'en',
  'japanese': 'ja',
  'vietnamese': 'vn',
}

export interface Persistor {
  select: <T>(key: string) => Promise<T>;
  upsert: <T>(key: string, value: T) => Promise<void>;
}

export interface Translator {
  translate: (text: string, targetLanguage: SUPPORTED_LANGUAGE) => Promise<string>
}

export interface Logger {
  info: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
}

export interface Messenger {
  fetchMessage: (channel: string, id: string) => Promise<IncomingMessage | null>
  postMessage: (channel: string, message: OutgoingMessage) => Promise<void>
  fetchUser: (userId: string) => Promise<UserInfo | null>
}

export default class Yaksel {
  messenger: Messenger
  translator: Translator
  logger: Logger
  persistor: Persistor

  constructor({messenger, translator, logger, persistor}:{
        messenger: Messenger,
        translator: Translator,
        logger: Logger,
        persistor: Persistor,
    }) {
    this.messenger = messenger
    this.translator = translator
    this.logger = logger
    this.persistor = persistor
  }

  async handleEvent(event: SlackEvent) {
    if (!event) {
      this.logger.error('Called without event')
      throw Error('Called without error')
    }

    this.logger.info(`Event: ${JSON.stringify(event)}`)

    switch (event.type) {
      case 'reaction_added':
        return await this.handleReactionAdded(event)
      case 'app_mention':
        return await this.handleAppMention(event)
      case 'message':
        return await this.handleAutotranslate(event)
      default:
        throw Error(`Unsupported event '${event.type}'`)
    }
  }

  async handleReactionAdded(event: SlackEvent) {
    const {reaction} = event
    invariant(reaction, 'Missing reaction')
    if (!Object.keys(TARGET_LANGUAGES).includes(reaction)) {
      this.logger.info('Not a translation reaction. Ignoring.')
      return
    }

    const targetLanguage = TARGET_LANGUAGES[reaction]
    await this.handleTranslation(event, targetLanguage)
  }

  async validateEventTimestamp(channel: string, timestamp: string) {
    const key = `/channels/${channel}/${timestamp.replace('.', '_')}`

    const value = await this.persistor.select<boolean>(key)
    if (value) {
      throw new Error('Timestamp exists already')
    }
    await this.persistor.upsert(key, true)
  }

  async translateAttachments(
      attachments: Attachment[] | undefined,
      targetLanguage: SUPPORTED_LANGUAGE,
  ) {
    if (!attachments) {
      return undefined
    }

    const returnValue: { text: string }[] = []
    for (let i = 0; i < attachments.length; i++) {
      const a: Attachment = attachments[i]
      const text = a.text || a.fallback
      if (text) {
        const translation = await this.translator.translate(text, targetLanguage)
        returnValue.push({
          text: translation,
        })
      }
    }
    return returnValue
  }

  async handleTranslation({event_ts, ts, item, channel}: SlackEvent, targetLanguage: SUPPORTED_LANGUAGE) {
    const normalizedChannel = item?.channel || channel
    invariant(event_ts, 'Missing timestamp')
    invariant(normalizedChannel, 'Missing channel')
    invariant(item?.ts, 'Missing item timestamp')

    // this prevents the same message to be translated twice
    await this.validateEventTimestamp(normalizedChannel, event_ts)
    const message = await this.messenger.fetchMessage(normalizedChannel, item.ts)
    if (!message) {
      throw Error('Message not found! Nothing to translate')
    }
    await this.translateAndPostMessage(normalizedChannel, message, targetLanguage)
  }

  async translateAndPostMessage(channel: string, message: IncomingMessage, targetLanguage: SUPPORTED_LANGUAGE) {
    const outgoingMessage = await this.translateSlackMessage(message, targetLanguage)
    await this.messenger.postMessage(channel, outgoingMessage)
  }

  async translateSlackMessage(message: IncomingMessage, targetLanguage: SUPPORTED_LANGUAGE): Promise<OutgoingMessage> {
    invariant(message.text, 'Missing text on the message. Nothing to translate')
    this.logger.info(`Translating into ${targetLanguage}`, message)
    const translation = await this.translator.translate(message.text, targetLanguage)
    const attachments = await this.translateAttachments(
        message.attachments,
        targetLanguage,
    )
    return {
      thread_ts: message.thread_ts,
      reply_broadcast: (message.kind === 'message'),
      text: translation,
      attachments: attachments,
    }
  }

  readonly autotranslateEnablePattern = /enable autotranslate (<@)?([\dA-Z]+)(>)? into (en|ja|vn)+/
  readonly autotranslateDisablePattern = /disable autotranslate (<@)?([\dA-Z]+)(>)?/

  async handleAppMention({text}: SlackEvent) {
    invariant(text, 'Missing text')

    const enable = text.match(this.autotranslateEnablePattern)
    if (enable) {
      await this.enableAutoTranslate(enable[2], enable[4] as SUPPORTED_LANGUAGE)
      return
    }

    const disable = text.match(this.autotranslateDisablePattern)
    if (disable) {
      await this.disableAutoTranslate(disable[2])
      return
    }
    this.logger.warn('Called with wrong arugment')
  }

  async enableAutoTranslate(userId: string, targetLanguage: SUPPORTED_LANGUAGE) {
    const userInfo = await this.messenger.fetchUser(userId)
    invariant(userInfo, `Failed to fetch user '${userId}'. Ignoring`)
    const userOrBotId = userInfo.isBot ? userInfo.botId : userInfo.id
    const key = `/autotranslate/${userOrBotId}`
    await this.persistor.upsert(key, targetLanguage)
  }

  async disableAutoTranslate(userId: string) {
    const userInfo = await this.messenger.fetchUser(userId)
    invariant(userInfo, `Failed to fetch user '${userId}'. Ignoring`)
    const userOrBotId = userInfo.isBot ? userInfo.botId : userInfo.id
    const key = `/autotranslate/${userOrBotId}`
    await this.persistor.upsert(key, false)
  }

  async handleAutotranslate(event: SlackEvent) {
    const sender = event.user || event.bot_id
    if (!sender) {
      this.logger.info('Not a message sent by a user or bot. Ignoring.')
      return
    }
    invariant(event.channel, 'Missing event.channel')
    invariant(event.event_ts, 'Missing event.event_ts')
    const targetLanguage = await this.getAutotranslateTargetLanguage(sender)
    if (!targetLanguage) {
      this.logger.info(`Sender ${sender} not registered for auto-translate. Ignoring.`)
      return
    }

    const incomingMessage = {
      kind: 'message',
      text: event.text,
      attachments: event.attachments,
      thread_ts: event.event_ts,
    } as IncomingMessage

    await this.validateEventTimestamp(event.channel, event.event_ts)
    await this.translateAndPostMessage(event.channel, incomingMessage, targetLanguage)
  }

  async getAutotranslateTargetLanguage(userId: string): Promise<false | SUPPORTED_LANGUAGE> {
    const key = `/autotranslate/${userId}`
    return await this.persistor.select<false | SUPPORTED_LANGUAGE>(key)
  }
}
