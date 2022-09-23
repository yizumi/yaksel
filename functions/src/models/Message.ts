
export interface SlackEvent {
  type: 'reaction_added' | 'app_mention' | 'message'
  bot_id?: string
  channel?: string
  event_ts?: string
  item?: {
    channel: string
    ts: string
  }
  reaction?: string
  text?: string
  ts?: string
  user?: string
  attachments?: IncomingMessageAttachment[]
}

export interface IncomingMessage {
  kind: 'message' | 'reply'
  thread_ts?: string
  text?: string
  attachments?: IncomingMessageAttachment[]
}

export interface IncomingMessageAttachment {
  text?: string
}

export interface OutgoingMessage {
    thread_ts?: string
    reply_broadcast: boolean
    text: string
    attachments?: OutgoingMessageAttachment[]
}

export interface OutgoingMessageAttachment {
    text: string
}

export interface UserInfo {
  id: string
  isBot: boolean
  botId?: string
  name: string
}
