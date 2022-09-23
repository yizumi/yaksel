import {WebClient} from '@slack/web-api'
import {IncomingMessage, OutgoingMessage, UserInfo} from '../models/Message'
import {Messenger} from './Yaksel'

export default class SlackMessenger implements Messenger {
  slack: WebClient

  constructor(slackApiKey: string) {
    this.slack = new WebClient(slackApiKey)
  }

  async fetchMessage(channel: string, id: string): Promise<IncomingMessage | null> {
    const messageResponse = await this.slack.conversations.history({
      channel: channel,
      inclusive: true,
      latest: id,
      limit: 1,
    })

    const message = messageResponse?.messages?.[0]
    if (!message) {
      return null
    }

    // In case of message
    if (message.ts === id) {
      return {
        kind: 'message',
        thread_ts: message.ts,
        text: message.text,
        attachments: message.attachments,
      }
    }

    const replyResponse = await this.slack.conversations.replies({
      channel: channel,
      inclusive: true,
      ts: id,
      limit: 1,
    })

    const reply = replyResponse?.messages?.[0]
    if (!reply) {
      return null
    }
    // logger.info("Reply from Slack", reply);
    if (reply.ts === id) {
      return {
        kind: 'reply',
        ...reply,
      }
    }
    return null
  }

  async postMessage(channel: string, message: OutgoingMessage) {
    await this.slack.chat.postMessage({
      ...message,
      channel: channel,
    })
  }

  async fetchUser(userId: string): Promise<UserInfo | null> {
    const userInfo = await this.slack.users.info({user: userId})
    const {user} = userInfo
    if (!userInfo.ok || !user) {
      return null
    }

    return {
      id: userId,
      isBot: !!user.is_bot,
      botId: user.profile?.bot_id,
      name: user.profile?.real_name_normalized || '(noname)',
    }
  }
}
