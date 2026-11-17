// ==InuPlugin==
// @name Just Reply
// @id moe.redmoth.justreply
// @author RedMoth
// @version 1.0.0
// @description Reply to a message without any text
// @description:ru Ответ на сообщение без текста
// @grant unsafe.jvm
// @grant unsafe.xposed
// @grant interceptRpc(messages.sendMessage)
// @plugin-api 1
// @platform android
// ==/InuPlugin==

const ChatActivityEnterView = inu.jvm.cls('org.telegram.ui.Components.ChatActivityEnterView')
const DialogObject = inu.jvm.cls('org.telegram.messenger.DialogObject')

// The marker is only a carrier for the empty send; interceptRpc swaps it for a rich message.
const MARKER = '\u2063'

function textOf(value) {
    if (value == null) return ''
    if (typeof value === 'string') return value
    try {
        return value.call('toString')
    } catch (e) {
        return ''
    }
}

function hasForwarding(view) {
    try {
        const delegate = view.getField('delegate')
        return delegate != null && delegate.call('hasForwardingMessages') === true
    } catch (e) {
        return false
    }
}

function isSecretChat(view) {
    try {
        return DialogObject.callStatic('isEncryptedDialog', view.getField('dialog_id')) === true
    } catch (e) {
        return false
    }
}

// In a forum without a reply, replyingMessageObject is the topic root and must be ignored.
function hasRealReply(view) {
    if (isSecretChat(view)) return false

    try {
        const reply = view.getField('replyingMessageObject')
        return reply != null && reply.getField('isTopicMainMessage') !== true
    } catch (e) {
        return false
    }
}

function canSendEmptyReply(view) {
    return hasRealReply(view) && !hasForwarding(view)
}

function syncSendButton(view) {
    let force
    try {
        force = view.getField('forceShowSendButton') === true
    } catch (e) {
        return
    }

    if (hasRealReply(view)) {
        if (force) {
            view.call('checkSendButton', false)
        } else {
            view.call('setForceShowSendButton', true, false)
        }
        return
    }

    if (force && !hasForwarding(view)) {
        view.call('setForceShowSendButton', false, false)
    }
}

const disposers = []

function hookAll(name, hook) {
    try {
        disposers.push(inu.xposed.hookAllOverloads(ChatActivityEnterView, name, hook))
    } catch (e) {
        // Hooking is unavailable on some devices; the plugin then does nothing.
    }
}

// The two-argument overload delegates to the three-argument one, so react only to the latter.
hookAll('setReplyingMessageObject', {
    after(ctx) {
        if (ctx.args.length !== 3) return
        syncSendButton(ctx.thisObject)
    },
})

// Stock clears forceShowSendButton when forwarding ends, even if a reply is still selected.
hookAll('setForceShowSendButton', {
    before(ctx) {
        if (ctx.args[0] === false && hasRealReply(ctx.thisObject)) {
            ctx.args[0] = true
        }
    },
})

// Stock drops empty sends, so give it a marker and replace that marker at the RPC layer.
hookAll('processSendingText', {
    before(ctx) {
        if (!canSendEmptyReply(ctx.thisObject)) return
        if (textOf(ctx.args[0]).trim() !== '') return
        ctx.args[0] = MARKER
    },
})

// A footer block with a subscript space is a valid rich message with nothing visible in it.
function richReply() {
    return /** @type {tl.RawInputRichMessage} */ ({
        _: 'inputRichMessage',
        blocks: [{
            _: 'pageBlockFooter',
            text: {
                _: 'textSubscript',
                text: {
                    _: 'textPlain',
                    text: ' ',
                },
            },
        }],
    })
}

const offRpc = inu.interceptRpc('messages.sendMessage', (ctx, next) => {
    const request = ctx.request

    if (request.message === MARKER) {
        if (request.reply_to == null) {
            request.message = ' '
        } else {
            request.message = ''
            request.entities = []
            request.no_webpage = true
            request.rich_message = richReply()
        }
    }

    return next()
})

inu.onUnload(() => {
    offRpc()
    for (const off of disposers) off()
})
