# TikTok web IM client: what's in the page and what the server allows

Recon from tiktok.com/messages, Oct 26 2026. Module ids change every build, so code finds
modules by their source text, never by number.

## Getting at the client

- Webpack runtime: push a fake chunk onto `window.__LOADABLE_LOADED_CHUNKS__` to get `require`.
- The React layer for the IM SDK is the module whose source contains `ZustandStoreProxy`,
  `ConversationApi` and `useMessageApi`. It exports `ConversationApi`, `ZustandStoreProxy`,
  `MessagePersistState`, hooks (`useMessageApi`, `useActiveConversationApi`, `useReactions`,
  `useTypingUsers`, `useReadReceipts`, `useUnreadCount` ...).
- A live `ConversationApi` for the open chat sits in a React hook state. Walk the fiber tree from
  the root and test `instanceof ConversationApi`.
- `conv.store.getState()` is the IM store: `conversationMap`, `messageMap`, `messageListMap`,
  `activeConversationId`, `participantMap`, `userId`, `core`.
- Each entry in `messageMap` has `.api` (the message API) plus flags: `isFromMe`, `isFailed`,
  `isRecalled`, `type`, `content` (parsed), `myReactions`, `reactionUidsMap`, `sendResult`.

## ConversationApi (one chat)

`markRead, setAsActive, toggleStickOnTop, toggleMute, toggleFavorite, typing, delete, dissolve,
leave, setGroupName, setGroupDesc, setGroupAvatar, setGroupNotice, addParticipants,
removeParticipants, updateParticipant, updateReadReceipt, setReferenceMessage,
clearReferenceMessage, createMessage, forwardMessage, sendMessage, sendTextMessage, _addFiles,
addFiles, removeFile, clearFiles, sendFileMessage, updateExtend, loadMoreMessages`

- `createMessage({ type, content: JSON string, ext })` then `sendMessage(msg)`.
- `_addFiles([File])` then `sendFileMessage()` uploads and sends photos/videos.

## Message API (one message, `messageMap` entry `.api`)

`delete, recall, send, toggleSingleReaction, toggleReaction, setAsReferenceMessage,
getReadReceipt, refresh, forward, updateExtend, decryptMedia`

## SDK core (`conv.core`)

Includes `recallMessage({message})`, `modifyMessageProperty({message, modifyContent})`,
`markMessage` (batch unmark with tags), `sendInputStatus({conversation, status, ext})` (typing),
`getReadReceipt`, `createFileMessage`, `upsertMessageExt`, `getMessagesByConversation`.

## Message formats

- Text: type 7, content `{"aweType":0,"text":"..."}`.
- Sticker card: type 1805, content
  `{ sticker: { url_list, image_id, resolution, fallback_icon_type }, preview_hint, req_base: {
  query_data: { extra: { "a:sticker_id", "a:sticker_type", "a:sticker_sub_type",
  "a:sticker_set_id", "a:sticker_creator_user_id" } } }, resp_base }`.
- Hello sticker: type 15. Shared video: type 8.
- Reactions are message properties keyed `e:<name>`, the heart is `e:love`.

## What the server accepts from the web client (account: nokoding, Oct 26 2026)

| Action | Result |
|---|---|
| Text messages | works |
| Reactions (`toggleReaction`) | works |
| Unsend for everyone (`recall`) | works |
| Pin chat to top (`toggleStickOnTop`) | works |
| Mute (`toggleMute`) | works |
| Star chat (`toggleFavorite`) | works |
| Sticker card (type 1805) | refused, error 200001 |
| Photo or video (`sendFileMessage`) | refused, "This feature isn't available" (check_code 2) |

The A/B flags only switch the web UI on. The server decides per account whether web may send
media, so the photo button stays useless until TikTok enables it for the account.
