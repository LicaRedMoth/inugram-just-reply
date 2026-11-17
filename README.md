# Just Reply

An [Inugram](https://github.com/teidesu/inugram) plugin that sends a reply without any text.
Select a message, leave the field empty, and the send button stays active.

## Install

Download [just-reply.inu.js](just-reply.inu.js) and open it in Inugram. The plugin needs the
`unsafe.jvm`, `unsafe.xposed` and `interceptRpc(messages.sendMessage)` grants. Disable the plugin
to get the stock behavior back.

## How it works

When a reply is selected, the plugin sets Telegram's `forceShowSendButton` flag, which keeps the
send button in place even with an empty input field.

When that empty reply is sent, `processSendingText` would normally drop it. The plugin gives it an
invisible marker instead, so the normal send path runs.

The outgoing `messages.sendMessage` request is then rewritten. The text and entities are cleared,
and a `rich_message` is added with this block:

```
pageBlockFooter
  textSubscript
    textPlain " "
```

The result is a real reply with no visible text.

The plugin does not touch secret chats, forwarding, the topic root in a forum, or story replies.

## Compatibility

Rich messages are a newer Telegram feature. On older Telegram clients the message may not render
at all, so the recipient can see no bubble or an empty reply. A client that supports rich messages
is needed to display it.

## License

MIT
